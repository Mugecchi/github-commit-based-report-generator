import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Octokit } from '@octokit/rest';
import { createGitHubClient } from '../github-report/github.client.js';

const execFileAsync = promisify(execFile);
import {
  detectRepositoryApplications,
  isIgnoredDirectory,
} from '../github-report/application.detector.js';
import { KNOWN_42SYSTEM_APPLICATIONS } from '../github-report/report.xlsx.js';
import {
  getSourceLanguage,
  IGNORED_DIRS,
  MAX_FILE_SIZE_BYTES,
} from './source-code.constants.js';
import type {
  ApplicationSourceBundle,
  SourceCodeDownloadParams,
  SourceCodeScanParams,
  SourceCodeScanResult,
  SourceFileItem,
} from './source-code.types.js';
import type { DetectedApplication, RepositoryStructureInfo } from '../github-report/report.types.js';

export class SourceCodeServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'SourceCodeServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Executes async tasks with concurrency limiting.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

export class SourceCodeReportService {
  /**
   * Scans a repository tree and organizes source code files per detected application.
   */
  async scanRepository(params: SourceCodeScanParams): Promise<SourceCodeScanResult> {
    const isLocal =
      params.sourceType === 'local' ||
      params.owner?.toLowerCase() === 'local' ||
      !params.owner;

    if (isLocal) {
      return this.scanLocalDirectory(params);
    }

    return this.scanGitHubRepository(params);
  }

  /**
   * Scans a GitHub repository using Octokit.
   */
  private async scanGitHubRepository(params: SourceCodeScanParams): Promise<SourceCodeScanResult> {
    const { owner, repo, branch, githubToken, srcOnly = true } = params;
    const octokit = createGitHubClient(githubToken);

    let structureInfo: RepositoryStructureInfo;
    try {
      structureInfo = await detectRepositoryApplications({
        owner,
        repo,
        branch,
        octokit,
      });
    } catch {
      structureInfo = {
        type: 'single-application',
        applicationsCount: 1,
        applications: [
          {
            id: 'root',
            code: repo.toUpperCase(),
            name: repo,
            fullName: `${repo} Application`,
            path: '.',
            isRoot: true,
          },
        ],
        detectedFrom: 'repo-tree',
        summaryDescription: '1 Application (Root)',
      };
    }

    // Retrieve repository Git tree recursively
    let treeItems: Array<{ path?: string; type?: string; size?: number; sha?: string }> = [];
    try {
      const ref = branch?.trim() || 'HEAD';
      const treeRes = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: ref,
        recursive: 'true',
      });
      treeItems = treeRes.data.tree || [];
    } catch (err: any) {
      const status = err.status || 500;
      if (status === 404) {
        throw new SourceCodeServiceError(
          `Repository "${owner}/${repo}" or branch "${branch || 'default'}" not found. Please verify permissions and repository name.`,
          404
        );
      }
      // If GitHub REST API rate limit is exceeded (403), seamlessly fallback to shallow Git clone
      if (status === 403 || String(err.message).toLowerCase().includes('rate limit')) {
        try {
          const cacheDir = await this.cloneOrUpdateRepoCache(owner, repo, branch, githubToken);
          const localScan = await this.scanLocalDirectory({
            owner,
            repo,
            branch,
            sourceType: 'local',
            localPath: cacheDir,
            srcOnly,
          });
          return {
            ...localScan,
            repository: {
              owner,
              repo,
              branch: branch || 'main',
              sourceType: 'github',
            },
          };
        } catch (cloneErr: any) {
          throw new SourceCodeServiceError(
            `GitHub API rate limit exceeded and Git clone fallback failed: ${cloneErr.message || err.message}. Please provide a valid GitHub Personal Access Token or wait for rate limit to reset.`,
            status
          );
        }
      }
      if (status === 401) {
        throw new SourceCodeServiceError(
          `GitHub API authentication error: Invalid or expired GitHub token.`,
          401
        );
      }
      throw new SourceCodeServiceError(
        `Failed to fetch repository tree: ${err.message || 'Unknown error'}`,
        status
      );
    }

    return this.processTreeAndGroupApplications({
      owner,
      repo,
      branch: branch || 'HEAD',
      sourceType: 'github',
      structureInfo,
      treeItems,
      srcOnly,
    });
  }

  /**
   * Scans a local filesystem directory.
   */
  private async scanLocalDirectory(params: SourceCodeScanParams): Promise<SourceCodeScanResult> {
    let basePath = params.localPath || process.cwd();
    if (
      !params.localPath &&
      fs.existsSync(path.resolve(basePath, '../client')) &&
      fs.existsSync(path.resolve(basePath, '../server'))
    ) {
      basePath = path.resolve(basePath, '..');
    }
    const repoName = params.repo || path.basename(basePath);
    const ownerName = params.owner || 'Local';
    const srcOnly = params.srcOnly !== false;

    if (!fs.existsSync(basePath)) {
      throw new SourceCodeServiceError(`Local path "${basePath}" does not exist.`, 404);
    }

    // Recursively collect files
    const collectedFiles: Array<{ path: string; size: number }> = [];

    const traverse = (dir: string, rel: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.name.startsWith('.') || IGNORED_DIRS.has(ent.name) || isIgnoredDirectory(ent.name)) {
          continue;
        }
        const full = path.join(dir, ent.name);
        const relPath = rel ? `${rel}/${ent.name}` : ent.name;

        if (ent.isDirectory()) {
          traverse(full, relPath);
        } else if (ent.isFile()) {
          try {
            const stat = fs.statSync(full);
            collectedFiles.push({ path: relPath.replace(/\\/g, '/'), size: stat.size });
          } catch {
            // Ignore unreadable files
          }
        }
      }
    };

    traverse(basePath, '');

    // Detect if multi-app from root directory entries
    const rootSubdirs = fs
      .readdirSync(basePath, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !isIgnoredDirectory(e.name) && !IGNORED_DIRS.has(e.name))
      .map((e) => e.name);

    let structureInfo: RepositoryStructureInfo;
    const isMulti =
      rootSubdirs.includes('client') && rootSubdirs.includes('server')
        ? true
        : rootSubdirs.some((d) => KNOWN_42SYSTEM_APPLICATIONS.some((k) => k.code === d.toUpperCase())) ||
          rootSubdirs.length >= 2;

    if (isMulti) {
      const apps: DetectedApplication[] = rootSubdirs.map((dir) => {
        const upper = dir.toUpperCase();
        const known = KNOWN_42SYSTEM_APPLICATIONS.find((k) => k.code === upper);
        return {
          id: dir,
          code: known ? known.code : upper,
          name: known ? `${known.code} — ${known.fullName}` : dir,
          fullName: known ? known.fullName : `${dir} Application`,
          path: dir,
          isRoot: false,
        };
      });

      structureInfo = {
        type: 'multi-application',
        applicationsCount: apps.length,
        applications: apps,
        detectedFrom: 'repo-tree',
        summaryDescription: `${apps.length} Local Applications identified: ${apps.map((a) => a.code).join(', ')}`,
      };
    } else {
      structureInfo = {
        type: 'single-application',
        applicationsCount: 1,
        applications: [
          {
            id: 'root',
            code: repoName.toUpperCase(),
            name: repoName,
            fullName: `${repoName} Root Application`,
            path: '.',
            isRoot: true,
          },
        ],
        detectedFrom: 'repo-tree',
        summaryDescription: '1 Local Application (Root)',
      };
    }

    return this.processTreeAndGroupApplications({
      owner: ownerName,
      repo: repoName,
      branch: params.branch || 'local',
      sourceType: 'local',
      structureInfo,
      treeItems: collectedFiles.map((f) => ({ path: f.path, type: 'blob', size: f.size })),
      srcOnly,
    });
  }

  /**
   * Processes tree items, filters source code, and groups files per application.
   */
  private processTreeAndGroupApplications(opts: {
    owner: string;
    repo: string;
    branch: string;
    sourceType: 'github' | 'local';
    structureInfo: RepositoryStructureInfo;
    treeItems: Array<{ path?: string; type?: string; size?: number; sha?: string }>;
    srcOnly: boolean;
  }): SourceCodeScanResult {
    const { owner, repo, branch, sourceType, structureInfo, treeItems, srcOnly } = opts;

    // Filter to valid source code blobs
    const validBlobs = treeItems.filter((item) => {
      if (item.type !== 'blob' || !item.path) return false;
      const norm = item.path.replace(/\\/g, '/');

      // Check for ignored directory segments
      const segments = norm.split('/');
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i].toLowerCase();
        if (IGNORED_DIRS.has(seg) || isIgnoredDirectory(seg)) {
          return false;
        }
      }

      // Check language
      const lang = getSourceLanguage(norm);
      if (!lang) return false;

      // Check max size
      if (item.size && item.size > MAX_FILE_SIZE_BYTES) return false;

      return true;
    });

    // Group files per application
    const isSingleApp =
      structureInfo.type === 'single-application' || structureInfo.applications.length <= 1;

    type TempFile = {
      path: string;
      relativePath: string;
      filename: string;
      language: string;
      extension: string;
      size: number;
      sha?: string;
    };

    const appFilesMap = new Map<string, TempFile[]>();

    for (const app of structureInfo.applications) {
      appFilesMap.set(app.code, []);
    }

    for (const item of validBlobs) {
      const filePath = item.path!;
      const norm = filePath.replace(/\\/g, '/');
      const filename = norm.split('/').pop() || '';
      const ext = path.extname(filename).toLowerCase();
      const language = getSourceLanguage(norm) || 'Plain Text';
      const size = item.size || 0;

      if (isSingleApp) {
        const appCode = structureInfo.applications[0]?.code || repo.toUpperCase();
        const list = appFilesMap.get(appCode) || [];
        list.push({
          path: norm,
          relativePath: norm,
          filename,
          language,
          extension: ext,
          size,
          sha: item.sha,
        });
        appFilesMap.set(appCode, list);
      } else {
        // Multi-app matching: Find which application path or code matches
        let matchedApp = structureInfo.applications.find((app) => {
          if (!app.path || app.path === '.') return false;
          const appPathLower = app.path.toLowerCase() + '/';
          const normLower = norm.toLowerCase();
          return normLower.startsWith(appPathLower) || normLower.includes(`/${appPathLower}`);
        });

        if (!matchedApp) {
          // Check if first path segment matches app code
          const firstSeg = norm.split('/')[0].toUpperCase();
          matchedApp = structureInfo.applications.find(
            (app) => app.code.toUpperCase() === firstSeg
          );
        }

        if (matchedApp) {
          const list = appFilesMap.get(matchedApp.code) || [];
          // Relative path inside this application
          let rel = norm;
          if (matchedApp.path && norm.toLowerCase().startsWith(matchedApp.path.toLowerCase() + '/')) {
            rel = norm.substring(matchedApp.path.length + 1);
          } else if (norm.toUpperCase().startsWith(`${matchedApp.code}/`)) {
            rel = norm.substring(matchedApp.code.length + 1);
          }

          list.push({
            path: norm,
            relativePath: rel,
            filename,
            language,
            extension: ext,
            size,
            sha: item.sha,
          });
          appFilesMap.set(matchedApp.code, list);
        } else {
          // Fallback: Assign to root / first application
          const defaultCode = structureInfo.applications[0]?.code || 'COMMON';
          const list = appFilesMap.get(defaultCode) || [];
          list.push({
            path: norm,
            relativePath: norm,
            filename,
            language,
            extension: ext,
            size,
            sha: item.sha,
          });
          appFilesMap.set(defaultCode, list);
        }
      }
    }

    // Apply srcOnly filter per application
    // If srcOnly is enabled, filter to files containing /src/ or starting with src/
    // If an application has no files in src/, keep all its source files so it is not empty
    const applicationsResult = structureInfo.applications.map((app) => {
      let rawFiles = appFilesMap.get(app.code) || [];

      if (srcOnly) {
        const filesInSrc = rawFiles.filter(
          (f) =>
            f.relativePath.toLowerCase().startsWith('src/') ||
            f.path.toLowerCase().includes('/src/')
        );
        if (filesInSrc.length > 0) {
          rawFiles = filesInSrc;
        }
      }

      // Sort files alphabetically by relative path
      rawFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

      const totalSize = rawFiles.reduce((sum, f) => sum + f.size, 0);
      const estimatedLines = Math.round(totalSize / 35); // Approx 35 bytes per LOC
      const languageStats: Record<string, number> = {};

      for (const f of rawFiles) {
        languageStats[f.language] = (languageStats[f.language] || 0) + 1;
      }

      const knownApp = KNOWN_42SYSTEM_APPLICATIONS.find(
        (k) => k.code.toUpperCase() === app.code.toUpperCase()
      );

      return {
        code: app.code,
        name: knownApp ? `${knownApp.code} — ${knownApp.fullName}` : app.name,
        fullName: knownApp ? knownApp.fullName : app.fullName || `${app.name} Application`,
        path: app.path || '.',
        isRoot: Boolean(app.isRoot),
        fileCount: rawFiles.length,
        totalSize,
        estimatedLines,
        languageStats,
        files: rawFiles,
      };
    });

    // Filter out applications with 0 files (unless only 1 app exists)
    const activeApplications =
      applicationsResult.filter((a) => a.fileCount > 0).length > 0
        ? applicationsResult.filter((a) => a.fileCount > 0)
        : applicationsResult;

    const totalFiles = activeApplications.reduce((sum, a) => sum + a.fileCount, 0);
    const totalSize = activeApplications.reduce((sum, a) => sum + a.totalSize, 0);
    const totalEstimatedLines = activeApplications.reduce((sum, a) => sum + a.estimatedLines, 0);

    return {
      repository: {
        owner,
        repo,
        branch,
        sourceType,
      },
      structureType: activeApplications.length > 1 ? 'multi-application' : 'single-application',
      totalApplications: activeApplications.length,
      totalFiles,
      totalSize,
      totalEstimatedLines,
      applications: activeApplications,
    };
  }

  /**
   * Compiles the source code bundle with full content for a single application.
   */
  async compileApplicationBundle(
    params: SourceCodeDownloadParams,
    targetAppCode: string,
    selectedFilePaths?: string[]
  ): Promise<ApplicationSourceBundle> {
    const scan = await this.scanRepository(params);

    const appData = scan.applications.find(
      (a) => a.code.toUpperCase() === targetAppCode.toUpperCase()
    );

    if (!appData) {
      throw new SourceCodeServiceError(
        `Application "${targetAppCode}" not found in scanned repository. Available: ${scan.applications.map((a) => a.code).join(', ')}`,
        404
      );
    }

    // Filter to selected files if provided
    let filesToFetch = appData.files;
    if (selectedFilePaths && selectedFilePaths.length > 0) {
      const selectedSet = new Set(selectedFilePaths.map((p) => p.replace(/\\/g, '/')));
      filesToFetch = filesToFetch.filter((f) => selectedSet.has(f.path));
    }

    if (filesToFetch.length === 0) {
      throw new SourceCodeServiceError(
        `No source code files available to compile for application "${targetAppCode}".`,
        400
      );
    }

    // Fetch full contents
    const isLocal = scan.repository.sourceType === 'local';
    let localClonePath: string | null = null;

    if (!isLocal) {
      try {
        localClonePath = await this.cloneOrUpdateRepoCache(
          params.owner,
          params.repo,
          params.branch,
          params.githubToken
        );
      } catch {
        localClonePath = null;
      }
    }

    const octokit = isLocal || localClonePath ? null : createGitHubClient(params.githubToken);

    const loadedFiles: SourceFileItem[] = await mapWithConcurrency(
      filesToFetch,
      8, // 8 concurrent requests
      async (file) => {
        let content = '';

        if (localClonePath) {
          const fullPath = path.resolve(localClonePath, file.path);
          try {
            content = fs.readFileSync(fullPath, 'utf8');
          } catch {
            content = `// [Error: Unable to read cached repository file: ${file.path}]`;
          }
        } else if (isLocal) {
          let basePath = params.localPath || process.cwd();
          if (
            !params.localPath &&
            fs.existsSync(path.resolve(basePath, '../client')) &&
            fs.existsSync(path.resolve(basePath, '../server'))
          ) {
            basePath = path.resolve(basePath, '..');
          }
          const fullPath = path.resolve(basePath, file.path);
          try {
            content = fs.readFileSync(fullPath, 'utf8');
          } catch {
            content = `// [Error: Unable to read local file content: ${file.path}]`;
          }
        } else if (octokit) {
          try {
            if (file.sha) {
              const blobRes = await octokit.git.getBlob({
                owner: params.owner,
                repo: params.repo,
                file_sha: file.sha,
              });
              content = Buffer.from(blobRes.data.content, 'base64').toString('utf8');
            } else {
              const res = await octokit.repos.getContent({
                owner: params.owner,
                repo: params.repo,
                path: file.path,
                ref: params.branch || undefined,
              });
              if ('content' in res.data && res.data.content) {
                content = Buffer.from(res.data.content, 'base64').toString('utf8');
              }
            }
          } catch (err: any) {
            content = `// [Error fetching content from GitHub for ${file.path}: ${err.message || 'Unknown error'}]`;
          }
        }

        const lines = content.split(/\r?\n/);
        const linesCount = lines.length;

        return {
          path: file.path,
          relativePath: file.relativePath,
          filename: file.filename,
          language: file.language,
          extension: file.extension,
          size: file.size,
          linesCount,
          content,
          sha: file.sha,
          applicationCode: appData.code,
        };
      }
    );

    const totalLines = loadedFiles.reduce((sum, f) => sum + f.linesCount, 0);
    const totalSize = loadedFiles.reduce((sum, f) => sum + f.size, 0);

    const languageStats: Record<string, number> = {};
    for (const f of loadedFiles) {
      languageStats[f.language] = (languageStats[f.language] || 0) + 1;
    }

    const knownApp = KNOWN_42SYSTEM_APPLICATIONS.find(
      (k) => k.code.toUpperCase() === appData.code.toUpperCase()
    );

    return {
      application: {
        code: appData.code,
        name: appData.name,
        fullName: appData.fullName,
        path: appData.path,
        isRoot: appData.isRoot,
        owningOffice: knownApp?.owningOffice,
      },
      repository: {
        owner: scan.repository.owner,
        repo: scan.repository.repo,
        branch: scan.repository.branch,
      },
      totalFiles: loadedFiles.length,
      totalLines,
      totalSize,
      languageStats,
      files: loadedFiles,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Clones or fetches a GitHub repository shallowly (--depth 1) into a local temporary cache.
   * This bypasses the GitHub REST API rate limit completely and accelerates file loading.
   */
  async cloneOrUpdateRepoCache(
    owner: string,
    repo: string,
    branch?: string,
    token?: string
  ): Promise<string> {
    const safeOwner = owner.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRepo = repo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cacheDir = path.join(os.tmpdir(), 'commitreport-repos', `${safeOwner}_${safeRepo}`);

    const targetBranch = branch?.trim() || 'main';
    const authUrl = token?.trim()
      ? `https://${encodeURIComponent(token.trim())}@github.com/${owner}/${repo}.git`
      : `https://github.com/${owner}/${repo}.git`;

    try {
      if (fs.existsSync(path.join(cacheDir, '.git'))) {
        try {
          await execFileAsync('git', ['fetch', '--depth', '1', 'origin', targetBranch], {
            cwd: cacheDir,
            timeout: 25000,
          });
          await execFileAsync('git', ['reset', '--hard', `origin/${targetBranch}`], {
            cwd: cacheDir,
            timeout: 10000,
          });
          return cacheDir;
        } catch {
          fs.rmSync(cacheDir, { recursive: true, force: true });
        }
      }

      fs.mkdirSync(path.dirname(cacheDir), { recursive: true });
      const cloneArgs = ['clone', '--depth', '1'];
      if (branch?.trim()) {
        cloneArgs.push('--branch', branch.trim());
      }
      cloneArgs.push(authUrl, cacheDir);

      await execFileAsync('git', cloneArgs, { timeout: 60000 });
      return cacheDir;
    } catch (err: any) {
      const cleanedMessage = (err.message || 'Git clone failed').replace(
        /https:\/\/[^@]+@/g,
        'https://***@'
      );
      throw new SourceCodeServiceError(
        `Failed to clone repository: ${cleanedMessage}`,
        500
      );
    }
  }

  /**
   * Compiles source code bundles for all applications that have source code in the repository.
   */
  async compileAllApplicationBundles(
    params: SourceCodeDownloadParams
  ): Promise<ApplicationSourceBundle[]> {
    const scan = await this.scanRepository(params);

    if (scan.applications.length === 0) {
      throw new SourceCodeServiceError(
        'No applications or source code files found in the specified repository.',
        404
      );
    }

    const bundles: ApplicationSourceBundle[] = [];

    for (const app of scan.applications) {
      if (app.fileCount > 0) {
        const bundle = await this.compileApplicationBundle(params, app.code);
        bundles.push(bundle);
      }
    }

    return bundles;
  }
}
