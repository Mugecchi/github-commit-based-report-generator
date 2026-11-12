import { Octokit } from '@octokit/rest';
import { createGitHubClient } from './github.client.js';
import { isFixCommit, parseCommitMessage } from './report.parser.js';
import { OllamaService } from './ollama.service.js';
import {
  detectRepositoryApplications,
  filterCommitsByApplication,
} from './application.detector.js';
import { KNOWN_42SYSTEM_APPLICATIONS } from './report.xlsx.js';
import type {
  ChangedFileItem,
  ContributorStats,
  DailyActivityStats,
  DetectedApplication,
  GitHubReportData,
  GitHubReportFilterParams,
  ReportCommit,
  ReportCommitTypeBreakdown,
  ReportSummary,
  RepositoryStructureInfo,
} from './report.types.js';

export class ReportServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'ReportServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Normalizes user-supplied date string into ISO boundary strings.
 * If user passes "2026-09-01", since should be "2026-09-01T00:00:00.000Z".
 * If user passes "2026-09-22", until should be "2026-09-22T23:59:59.999Z".
 */
export function normalizeDateBoundaries(
  since?: string,
  until?: string
): { normalizedSince?: string; normalizedUntil?: string } {
  let normalizedSince: string | undefined;
  let normalizedUntil: string | undefined;

  if (since) {
    const trimmed = since.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      normalizedSince = new Date(`${trimmed}T00:00:00.000Z`).toISOString();
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        normalizedSince = parsed.toISOString();
      }
    }
  }

  if (until) {
    const trimmed = until.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      normalizedUntil = new Date(`${trimmed}T23:59:59.999Z`).toISOString();
    } else {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        normalizedUntil = parsed.toISOString();
      }
    }
  }

  return { normalizedSince, normalizedUntil };
}

/**
 * Executes async tasks with a maximum concurrency limit.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export class GitHubReportService {
  private octokit: Octokit;
  private ollamaService: OllamaService;

  constructor(octokit?: Octokit, ollamaService?: OllamaService) {
    this.octokit = octokit || createGitHubClient();
    this.ollamaService = ollamaService || new OllamaService();
  }

  /**
   * Generates a full GitHub development report for a repository.
   */
  async generateReport(params: GitHubReportFilterParams): Promise<GitHubReportData> {
    const { owner, repo, branch, author, since, until, githubToken } = params;

    const octokit = githubToken ? createGitHubClient(githubToken) : this.octokit;

    const { normalizedSince, normalizedUntil } = normalizeDateBoundaries(since, until);

    // 1. Fetch raw commits from GitHub with pagination
    const rawCommits = await this.fetchAllCommits(
      {
        owner,
        repo,
        sha: branch || undefined,
        author: author || undefined,
        since: normalizedSince,
        until: normalizedUntil,
      },
      octokit
    );

    if (rawCommits.length === 0) {
      return {
        metadata: {
          owner,
          repo,
          branch: branch || 'default',
          since: normalizedSince,
          until: normalizedUntil,
          authorFilter: author,
          generatedAt: new Date().toISOString(),
        },
        summary: {
          totalCommits: 0,
          contributors: 0,
          totalFilesChanged: 0,
          totalAdditions: 0,
          totalDeletions: 0,
          types: {
            features: 0,
            fixes: 0,
            refactors: 0,
            documentation: 0,
            tests: 0,
            chores: 0,
            perf: 0,
            style: 0,
            build: 0,
            ci: 0,
            revert: 0,
            other: 0,
          },
          features: 0,
          fixes: 0,
          refactors: 0,
          documentation: 0,
        },
        contributors: [],
        dailyActivity: [],
        commits: [],
      };
    }

    // 2. Fetch detailed stats for each commit with bounded concurrency
    const detailedCommits: ReportCommit[] = await mapWithConcurrency(
      rawCommits,
      10, // Concurrency limit
      async (raw) => {
        return this.fetchCommitDetails(owner, repo, raw, octokit);
      }
    );

    // Automatically identify applications (whether single root or multiple sub-folders)
    const structureInfo = await detectRepositoryApplications({
      owner,
      repo,
      branch,
      octokit,
      commits: detailedCommits,
    });

    // Identify target application from params or filter
    const appParam = params.application?.trim();
    let activeCommits = detailedCommits;
    let selectedApp: DetectedApplication | undefined;

    if (appParam && appParam !== 'ALL' && appParam !== 'root') {
      const match = structureInfo.applications.find(
        (a) =>
          a.id.toLowerCase() === appParam.toLowerCase() ||
          a.code.toLowerCase() === appParam.toLowerCase()
      );
      if (match) {
        selectedApp = match;
        activeCommits = filterCommitsByApplication(detailedCommits, match.id);
      } else {
        const known = KNOWN_42SYSTEM_APPLICATIONS.find(
          (a) => a.code.toUpperCase() === appParam.toUpperCase()
        );
        if (known) {
          activeCommits = filterCommitsByApplication(detailedCommits, known.code);
        }
      }
    }

    // 3. Aggregate summaries, contributors, and daily activity
    const summary = this.calculateSummary(activeCommits);
    const contributors = this.calculateContributors(activeCommits);
    const dailyActivity = this.calculateDailyActivity(activeCommits);

    // 4. Consolidate all commit messages (via Ollama AI or deterministic fallback)
    const repoContextName = selectedApp
      ? `${repo} (${selectedApp.fullName} - ${selectedApp.code})`
      : repo;
    const consolidated = await this.ollamaService.consolidateCommits(activeCommits, {
      model: params.ollamaModel,
      repoInfo: { owner, repo: repoContextName },
      useOllama: params.useOllama,
    });

    return {
      metadata: {
        owner,
        repo,
        branch: branch || 'default',
        since: normalizedSince,
        until: normalizedUntil,
        authorFilter: author,
        generatedAt: new Date().toISOString(),
        ollamaModelUsed: consolidated.modelUsed,
        application: selectedApp ? selectedApp.code : appParam,
        applicationName: selectedApp ? selectedApp.fullName : undefined,
        structureInfo,
      },
      summary,
      contributors,
      dailyActivity,
      commits: activeCommits,
      consolidated,
      applications: structureInfo.applications,
    };
  }

  /**
   * Automatically identifies the number of applications within the repo,
   * whether it be 1 (root folder) or multiple sub-folders.
   */
  async detectApplications(params: {
    owner: string;
    repo: string;
    branch?: string;
    githubToken?: string;
  }): Promise<RepositoryStructureInfo> {
    const octokit = params.githubToken ? createGitHubClient(params.githubToken) : this.octokit;
    let sampleCommits: ReportCommit[] = [];
    try {
      const res = await octokit.repos.listCommits({
        owner: params.owner,
        repo: params.repo,
        sha: params.branch || undefined,
        per_page: 30,
      });
      sampleCommits = (res.data || []).map((c: any) => ({
        ...parseCommitMessage(c.commit.message),
        sha: c.sha,
        shortSha: c.sha.substring(0, 7),
        date: c.commit.author?.date || '',
        author: c.commit.author?.name || '',
        authorEmail: c.commit.author?.email || '',
        message: c.commit.message,
        url: c.html_url,
      })) as ReportCommit[];
    } catch {
      // Gracefully continue with empty sample commits if listCommits fails
    }

    return detectRepositoryApplications({
      owner: params.owner,
      repo: params.repo,
      branch: params.branch,
      octokit,
      commits: sampleCommits,
    });
  }

  /**
   * Paginates through GitHub commits API to retrieve all matching commits.
   */
  private async fetchAllCommits(
    options: {
      owner: string;
      repo: string;
      sha?: string;
      author?: string;
      since?: string;
      until?: string;
    },
    client: Octokit = this.octokit
  ): Promise<any[]> {
    const allCommits: any[] = [];
    let page = 1;
    const perPage = 100;
    const maxPages = 50; // Safety guard: max 5,000 commits per report request

    try {
      while (page <= maxPages) {
        const response = await client.repos.listCommits({
          owner: options.owner,
          repo: options.repo,
          sha: options.sha,
          author: options.author,
          since: options.since,
          until: options.until,
          per_page: perPage,
          page,
        });

        const commits = response.data;
        if (!commits || commits.length === 0) {
          break;
        }

        allCommits.push(...commits);

        if (commits.length < perPage) {
          // Reached the last page
          break;
        }

        page++;
      }

      return allCommits;
    } catch (error: any) {
      this.handleGitHubError(error, options.owner, options.repo);
      throw error;
    }
  }

  /**
   * Fetches single commit details including file changes, additions, and deletions.
   */
  private async fetchCommitDetails(
    owner: string,
    repo: string,
    rawCommit: any,
    client: Octokit = this.octokit
  ): Promise<ReportCommit> {
    const sha = rawCommit.sha;
    const shortSha = sha ? sha.substring(0, 7) : '';
    const rawMessage = rawCommit.commit?.message || '';
    const parsed = parseCommitMessage(rawMessage);

    const authorName =
      rawCommit.commit?.author?.name ||
      rawCommit.author?.login ||
      'Unknown';
    const authorEmail = rawCommit.commit?.author?.email || '';
    const date =
      rawCommit.commit?.author?.date ||
      rawCommit.commit?.committer?.date ||
      new Date().toISOString();
    const htmlUrl =
      rawCommit.html_url || `https://github.com/${owner}/${repo}/commit/${sha}`;

    try {
      const detailResponse = await client.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });

      const data = detailResponse.data;
      const stats = data.stats || { total: 0, additions: 0, deletions: 0 };
      const files = data.files || [];

      const changedFiles: ChangedFileItem[] = files.map((f: any) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        rawUrl: f.raw_url,
        blobUrl: f.blob_url,
        patch: f.patch,
      }));

      return {
        sha,
        shortSha,
        date,
        author: authorName,
        authorEmail,
        message: rawMessage,
        subject: parsed.subject || rawMessage.split('\n')[0] || '',
        type: parsed.type,
        scope: parsed.scope,
        isBreaking: parsed.isBreaking,
        filesChanged: files.length,
        additions: stats.additions ?? 0,
        deletions: stats.deletions ?? 0,
        url: htmlUrl,
        changedFiles,
      };
    } catch (err) {
      // If fetching individual commit stats fails (e.g. rate limit / network drop),
      // preserve Git facts from rawCommit rather than dropping the whole report
      return {
        sha,
        shortSha,
        date,
        author: authorName,
        authorEmail,
        message: rawMessage,
        subject: parsed.subject || rawMessage.split('\n')[0] || '',
        type: parsed.type,
        scope: parsed.scope,
        isBreaking: parsed.isBreaking,
        filesChanged: 0,
        additions: 0,
        deletions: 0,
        url: htmlUrl,
        changedFiles: [],
      };
    }
  }

  /**
   * Summarizes total metrics and conventional commit type distribution.
   */
  private calculateSummary(commits: ReportCommit[]): ReportSummary {
    const contributorSet = new Set<string>();
    let totalFilesChanged = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;

    const types: ReportCommitTypeBreakdown = {
      features: 0,
      fixes: 0,
      refactors: 0,
      documentation: 0,
      tests: 0,
      chores: 0,
      perf: 0,
      style: 0,
      build: 0,
      ci: 0,
      revert: 0,
      other: 0,
    };

    for (const commit of commits) {
      contributorSet.add(commit.author.toLowerCase());
      totalFilesChanged += commit.filesChanged;
      totalAdditions += commit.additions;
      totalDeletions += commit.deletions;

      if (commit.type === 'fix' || isFixCommit(commit)) {
        types.fixes++;
      } else {
        switch (commit.type) {
          case 'feat':
            types.features++;
            break;
          case 'refactor':
            types.refactors++;
            break;
          case 'docs':
            types.documentation++;
            break;
          case 'test':
            types.tests++;
            break;
          case 'chore':
            types.chores++;
            break;
          case 'perf':
            types.perf++;
            break;
          case 'style':
            types.style++;
            break;
          case 'build':
            types.build++;
            break;
          case 'ci':
            types.ci++;
            break;
          case 'revert':
            types.revert++;
            break;
          default:
            types.other++;
            break;
        }
      }
    }

    return {
      totalCommits: commits.length,
      contributors: contributorSet.size,
      totalFilesChanged,
      totalAdditions,
      totalDeletions,
      types,
      features: types.features,
      fixes: types.fixes,
      refactors: types.refactors,
      documentation: types.documentation,
    };
  }

  /**
   * Aggregates commit statistics by contributor, sorted descending by commits.
   */
  private calculateContributors(commits: ReportCommit[]): ContributorStats[] {
    const map = new Map<string, ContributorStats>();

    for (const commit of commits) {
      const key = commit.author.trim() || 'Unknown';
      const existing = map.get(key);

      if (existing) {
        existing.commits += 1;
        existing.additions += commit.additions;
        existing.deletions += commit.deletions;
        existing.filesChanged += commit.filesChanged;
        if (!existing.authorEmail && commit.authorEmail) {
          existing.authorEmail = commit.authorEmail;
        }
      } else {
        map.set(key, {
          author: key,
          authorEmail: commit.authorEmail || '',
          commits: 1,
          additions: commit.additions,
          deletions: commit.deletions,
          filesChanged: commit.filesChanged,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.commits - a.commits);
  }

  /**
   * Aggregates commit statistics by day, sorted chronologically ascending.
   */
  private calculateDailyActivity(commits: ReportCommit[]): DailyActivityStats[] {
    const map = new Map<string, DailyActivityStats>();

    for (const commit of commits) {
      const day = commit.date.substring(0, 10); // YYYY-MM-DD
      const existing = map.get(day);

      if (existing) {
        existing.commits += 1;
        existing.filesChanged += commit.filesChanged;
        existing.additions += commit.additions;
        existing.deletions += commit.deletions;
      } else {
        map.set(day, {
          date: day,
          commits: 1,
          filesChanged: commit.filesChanged,
          additions: commit.additions,
          deletions: commit.deletions,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Translates Octokit HTTP errors into descriptive user-facing ReportServiceError instances.
   */
  private handleGitHubError(error: any, owner: string, repo: string): never {
    const status = error.status || error.response?.status;
    const msg = error.message || '';

    if (status === 404) {
      throw new ReportServiceError(
        `GitHub repository "${owner}/${repo}" was not found or is private without authorized access.`,
        404
      );
    }
    if (status === 401) {
      throw new ReportServiceError(
        'GitHub authentication failed. Please verify your custom GitHub token or server GITHUB_TOKEN environment variable.',
        401
      );
    }
    if (status === 403 || status === 429) {
      if (msg.includes('rate limit')) {
        throw new ReportServiceError(
          'GitHub API rate limit exceeded. Please provide a custom GitHub token, configure GITHUB_TOKEN on the server, or wait before retrying.',
          429
        );
      }
      throw new ReportServiceError(
        `Access forbidden for repository "${owner}/${repo}". Check repository permissions or your GitHub token.`,
        403
      );
    }

    throw new ReportServiceError(
      `Failed to fetch commits from GitHub: ${msg || 'Unknown network error'}`,
      status || 500
    );
  }
}
