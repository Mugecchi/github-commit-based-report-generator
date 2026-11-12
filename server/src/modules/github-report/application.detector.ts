import { Octokit } from '@octokit/rest';
import type { DetectedApplication, ReportCommit, RepositoryStructureInfo } from './report.types.js';
import { KNOWN_42SYSTEM_APPLICATIONS } from './report.xlsx.js';

export interface DetectApplicationsOptions {
  owner: string;
  repo: string;
  branch?: string;
  octokit?: Octokit;
  commits?: ReportCommit[];
}

// Folders that represent developer tooling, VCS, or repository metadata (never distinct applications)
export const IGNORED_SYSTEM_DIRS = new Set([
  '.git',
  '.github',
  '.vscode',
  '.idea',
  '.husky',
  '.changeset',
  '.turbo',
  '.svn',
  '.gemini',
  '.agents',
  '.cursor',
  '.devcontainer',
  'docs',
  'documentation',
  'doc',
  'wiki',
  'specs',
  'spec',
  'licenses',
  'changelog',
  'build',
  'dist',
  'out',
  'target',
  'coverage',
  '.next',
  '.nuxt',
  'bin',
  'obj',
  '.vite',
  'node_modules',
  'vendor',
  'bower_components',
  'scripts',
  'script',
  'tools',
  'tooling',
  'ci',
  '.circleci',
  '.gitlab',
  'workflows',
  'data',
  'datasets',
  'dataset',
  'fixtures',
  'fixture',
  'mocks',
  'mock',
  'seeds',
  'seed',
]);

/**
 * Checks whether a directory should be completely ignored from application consideration.
 * Automatically ignores all dot-folders (hidden tooling directories) and system directories.
 */
export function isIgnoredDirectory(name: string): boolean {
  const base = name.includes('/') ? name.split('/')[name.split('/').length - 1] : name;
  const lower = base.toLowerCase();
  if (lower.startsWith('.')) return true;
  return IGNORED_SYSTEM_DIRS.has(lower);
}

// Folders that represent standard internal organization for a SINGLE application
export const SINGLE_APP_CONVENTIONAL_DIRS = new Set([
  'src',
  'lib',
  'app',
  'public',
  'assets',
  'static',
  'test',
  'tests',
  '__tests__',
  'components',
  'pages',
  'styles',
  'utils',
  'types',
  'config',
  'migrations',
  'locales',
  'views',
  'controllers',
  'models',
  'routes',
  'middleware',
  'helpers',
  'templates',
]);

export const MONOREPO_CONTAINER_DIRS = ['apps', 'packages', 'services', 'projects', 'modules'];

/**
 * Automatically identifies the number of applications within a GitHub repository.
 * Detects whether the repository has:
 *   1) Exactly 1 application (meaning it is the root folder)
 *   2) Multiple applications (divided across distinct sub-folders)
 */
export async function detectRepositoryApplications(
  options: DetectApplicationsOptions
): Promise<RepositoryStructureInfo> {
  const { owner, repo, branch, octokit, commits = [] } = options;

  let rootDirs: string[] = [];
  let detectedFrom: 'repo-tree' | 'commits' | 'hybrid' = 'commits';
  let monorepoContainerFound: string | null = null;
  let subAppDirs: string[] = [];
  let hasWorkspaceFile = false;

  // Step 1: Query GitHub API repository tree/contents if Octokit client is provided
  if (octokit) {
    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path: '',
        ref: branch || undefined,
      });

      if (Array.isArray(response.data)) {
        detectedFrom = 'repo-tree';
        rootDirs = response.data
          .filter((item) => item.type === 'dir' && !isIgnoredDirectory(item.name))
          .map((item) => item.name);

        hasWorkspaceFile = response.data.some(
          (item) =>
            item.type === 'file' &&
            ['pnpm-workspace.yaml', 'turbo.json', 'lerna.json', 'nx.json'].includes(
              item.name.toLowerCase()
            )
        );

        // Check if there is an explicit monorepo container directory like apps/ or packages/
        for (const container of MONOREPO_CONTAINER_DIRS) {
          if (rootDirs.some((d) => d.toLowerCase() === container)) {
            monorepoContainerFound = container;
            try {
              const containerRes = await octokit.repos.getContent({
                owner,
                repo,
                path: container,
                ref: branch || undefined,
              });
              if (Array.isArray(containerRes.data)) {
                subAppDirs = containerRes.data
                  .filter((item) => item.type === 'dir' && !isIgnoredDirectory(item.name))
                  .map((item) => `${container}/${item.name}`);
              }
            } catch {
              // Ignore failure reading sub-container
            }
            break;
          }
        }
      }
    } catch {
      // Octokit call might fail (e.g. rate limit / network error); fallback gracefully to commits analysis
      detectedFrom = 'commits';
    }
  }

  // Step 2: Extract sub-folder candidates from commit file paths and commit scopes
  const commitFolderCounts = new Map<string, { commits: number; files: number }>();
  const commitScopes = new Set<string>();

  for (const c of commits) {
    if (c.scope?.trim()) {
      commitScopes.add(c.scope.trim().toUpperCase());
    }

    if (c.changedFiles && c.changedFiles.length > 0) {
      for (const f of c.changedFiles) {
        const norm = f.filename.replace(/\\/g, '/');
        const parts = norm.split('/').filter(Boolean);
        if (parts.length > 1) {
          const firstPart = parts[0];
          let folderKey = firstPart;

          // If path is apps/foo or packages/bar, use the two-level path
          if (
            MONOREPO_CONTAINER_DIRS.includes(firstPart.toLowerCase()) &&
            parts.length > 2
          ) {
            folderKey = `${firstPart}/${parts[1]}`;
          }

          if (!isIgnoredDirectory(firstPart)) {
            const current = commitFolderCounts.get(folderKey) || { commits: 0, files: 0 };
            current.files += 1;
            commitFolderCounts.set(folderKey, current);
          }
        }
      }
    }
  }

  // Cross-reference commits with folder candidates
  if (commits.length > 0 && detectedFrom === 'repo-tree') {
    detectedFrom = 'hybrid';
  }

  // Step 3: Determine candidate application sub-folders
  const candidateFolders = new Set<string>();

  // If explicit container (apps/foo) found
  if (subAppDirs.length > 0) {
    for (const d of subAppDirs) {
      candidateFolders.add(d);
    }
  } else {
    // Add non-ignored root directories from API
    for (const d of rootDirs) {
      if (!isIgnoredDirectory(d)) {
        candidateFolders.add(d);
      }
    }

    // Add candidate folders discovered in commit file changes
    for (const d of commitFolderCounts.keys()) {
      candidateFolders.add(d);
    }

    // Check for known 42System app codes matching commit scopes or directory names
    for (const app of KNOWN_42SYSTEM_APPLICATIONS) {
      if (
        commitScopes.has(app.code) ||
        rootDirs.some((d) => d.toUpperCase() === app.code) ||
        commitFolderCounts.has(app.code)
      ) {
        candidateFolders.add(app.code);
      }
    }
  }

  // Step 4: Evaluate whether candidate folders are genuine multi-apps or single-app internal code folders
  const candidateList = Array.from(candidateFolders);

  // Check if all non-ignored folders are standard internal single-app source directories (e.g. only ['src', 'public', 'test'])
  const nonConventionalCandidates = candidateList.filter(
    (folder) => !SINGLE_APP_CONVENTIONAL_DIRS.has(folder.toLowerCase())
  );

  const isMultiApp =
    nonConventionalCandidates.length >= 2 ||
    subAppDirs.length >= 2 ||
    nonConventionalCandidates.some((c) =>
      KNOWN_42SYSTEM_APPLICATIONS.some((app) => app.code === c.toUpperCase())
    ) ||
    (nonConventionalCandidates.includes('client') && nonConventionalCandidates.includes('server')) ||
    (nonConventionalCandidates.includes('frontend') && nonConventionalCandidates.includes('backend'));

  // =========================================================================
  // Case A: Single Application (Root Folder)
  // =========================================================================
  if (!isMultiApp || nonConventionalCandidates.length <= 1) {
    const singleApp: DetectedApplication = {
      id: 'root',
      code: 'ROOT',
      name: `${repo} (Root Folder)`,
      fullName: `${owner}/${repo} Root Application`,
      path: '.',
      isRoot: true,
      commitCount: commits.length,
      filesChanged: commits.reduce((sum, c) => sum + (c.filesChanged || 0), 0),
    };

    return {
      type: 'single-application',
      applicationsCount: 1,
      applications: [singleApp],
      detectedFrom,
      summaryDescription:
        '1 Application identified: Root Folder (entire repository functions as a single root application).',
    };
  }

  // =========================================================================
  // Case B: Multiple Applications (Sub-Folders Monorepo)
  // =========================================================================
  const detectedApps: DetectedApplication[] = nonConventionalCandidates.map((folder) => {
    const folderBase = folder.includes('/') ? folder.split('/')[1] : folder;
    const upperCode = folderBase.toUpperCase();

    // Check if this matches a known 42System LGU application
    const knownApp = KNOWN_42SYSTEM_APPLICATIONS.find(
      (a) => a.code.toUpperCase() === upperCode
    );

    const code = knownApp ? knownApp.code : folderBase.toUpperCase();
    const fullName = knownApp
      ? knownApp.fullName
      : `${folderBase} Sub-folder Application`;
    const name = knownApp
      ? `${knownApp.code} — ${knownApp.fullName}`
      : `${folderBase} (Sub-folder)`;

    // Calculate commits touching this sub-folder application
    const matchingCommits = filterCommitsByApplication(commits, folder);

    return {
      id: folder,
      code,
      name,
      fullName,
      path: folder,
      isRoot: false,
      commitCount: matchingCommits.length,
      filesChanged: matchingCommits.reduce((sum, c) => sum + (c.filesChanged || 0), 0),
    };
  });

  // Sort applications by commit count descending, then alphabetically
  detectedApps.sort((a, b) => {
    const commitDiff = (b.commitCount || 0) - (a.commitCount || 0);
    if (commitDiff !== 0) return commitDiff;
    return a.code.localeCompare(b.code);
  });

  const appNames = detectedApps.map((a) => a.code).join(', ');

  return {
    type: 'multi-application',
    applicationsCount: detectedApps.length,
    applications: detectedApps,
    detectedFrom,
    summaryDescription: `${detectedApps.length} Applications identified across sub-folders: ${appNames}.`,
  };
}

/**
 * Filters commits for a specific detected application by scope, directory path, or message tags.
 */
export function filterCommitsByApplication(
  commits: ReportCommit[],
  appId: string
): ReportCommit[] {
  if (!appId || appId === 'ALL' || appId === 'root' || appId === '.') {
    return commits;
  }

  const upperCode = (appId.includes('/') ? appId.split('/')[1] : appId).toUpperCase();
  const rawPath = appId.replace(/\\/g, '/').toLowerCase();

  return commits.filter((c) => {
    // 1. Commit scope match (e.g. feat(CGSO): ...)
    if (c.scope && c.scope.toUpperCase() === upperCode) {
      return true;
    }

    // 2. Changed file paths starting with or containing app directory
    if (c.changedFiles && c.changedFiles.length > 0) {
      const matchesFile = c.changedFiles.some((f) => {
        const norm = f.filename.replace(/\\/g, '/');
        const normLower = norm.toLowerCase();
        return (
          normLower.startsWith(`${rawPath}/`) ||
          normLower.includes(`/${rawPath}/`) ||
          norm.toUpperCase().startsWith(`${upperCode}/`) ||
          norm.toUpperCase().includes(`/${upperCode}/`)
        );
      });
      if (matchesFile) return true;
    }

    // 3. Commit subject tag (e.g. feat(CGSO), [CGSO], CGSO: )
    const raw = (c.subject || c.message || '').toUpperCase();
    if (
      raw.includes(`(${upperCode})`) ||
      raw.includes(`[${upperCode}]`) ||
      raw.startsWith(`${upperCode}:`) ||
      raw.includes(`:${upperCode}:`)
    ) {
      return true;
    }

    return false;
  });
}
