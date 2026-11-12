import { describe, expect, it, vi } from 'vitest';
import { gitHubReportQuerySchema } from '../report.schema.js';
import {
  GitHubReportService,
  ReportServiceError,
  normalizeDateBoundaries,
} from '../report.service.js';

describe('GitHub Report Service & Date Filtering', () => {
  describe('normalizeDateBoundaries', () => {
    it('should set since to 00:00:00.000Z and until to 23:59:59.999Z for YYYY-MM-DD input', () => {
      const { normalizedSince, normalizedUntil } = normalizeDateBoundaries(
        '2026-09-01',
        '2026-09-22'
      );

      expect(normalizedSince).toBe('2026-09-01T00:00:00.000Z');
      expect(normalizedUntil).toBe('2026-09-22T23:59:59.999Z');
    });

    it('should handle undefined boundaries gracefully', () => {
      const { normalizedSince, normalizedUntil } = normalizeDateBoundaries(
        undefined,
        undefined
      );
      expect(normalizedSince).toBeUndefined();
      expect(normalizedUntil).toBeUndefined();
    });
  });

  describe('gitHubReportQuerySchema Validation', () => {
    it('should validate valid query params', () => {
      const result = gitHubReportQuerySchema.safeParse({
        owner: 'Mugecchi',
        repo: '42System',
        branch: 'main',
        since: '2026-09-01',
        until: '2026-09-22',
      });
      expect(result.success).toBe(true);
    });

    it('should reject when until is earlier than since', () => {
      const result = gitHubReportQuerySchema.safeParse({
        owner: 'Mugecchi',
        repo: '42System',
        since: '2026-09-22',
        until: '2026-09-01',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('cannot be earlier than');
      }
    });

    it('should reject missing owner or repo', () => {
      const result1 = gitHubReportQuerySchema.safeParse({ repo: '42System' });
      expect(result1.success).toBe(false);

      const result2 = gitHubReportQuerySchema.safeParse({ owner: 'Mugecchi' });
      expect(result2.success).toBe(false);
    });

    it('should accept an optional githubToken in query schema', () => {
      const result = gitHubReportQuerySchema.safeParse({
        owner: 'Mugecchi',
        repo: '42System',
        githubToken: 'ghp_friendstoken1234567890abcdef',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.githubToken).toBe('ghp_friendstoken1234567890abcdef');
      }
    });
  });

  describe('Report Aggregation & Mocked GitHub API', () => {
    it('should calculate complete report metrics from mocked GitHub commits', async () => {
      const mockRawCommits = [
        {
          sha: 'a82f31c1234567890abcdef',
          commit: {
            author: { name: 'Alice Dev', email: 'alice@example.com', date: '2026-09-05T10:00:00Z' },
            message: 'feat(core): implement authentication system',
          },
          html_url: 'https://github.com/owner/repo/commit/a82f31c',
        },
        {
          sha: 'b93e42d1234567890abcdef',
          commit: {
            author: { name: 'Bob Engineer', email: 'bob@example.com', date: '2026-09-05T14:30:00Z' },
            message: 'fix(auth): resolve session expiration bug',
          },
          html_url: 'https://github.com/owner/repo/commit/b93e42d',
        },
        {
          sha: 'c04f53e1234567890abcdef',
          commit: {
            author: { name: 'Alice Dev', email: 'alice@example.com', date: '2026-09-06T09:15:00Z' },
            message: 'docs: update README setup steps',
          },
          html_url: 'https://github.com/owner/repo/commit/c04f53e',
        },
        {
          sha: 'd15a64f1234567890abcdef',
          commit: {
            author: { name: 'Charlie', email: 'charlie@example.com', date: '2026-09-06T11:00:00Z' },
            message: 'Update dependencies and scripts',
          },
          html_url: 'https://github.com/owner/repo/commit/d15a64f',
        },
      ];

      const mockCommitDetails: Record<string, any> = {
        a82f31c1234567890abcdef: {
          stats: { additions: 150, deletions: 10, total: 160 },
          files: [
            { filename: 'src/auth.ts', status: 'added', additions: 150, deletions: 10, changes: 160 },
          ],
        },
        b93e42d1234567890abcdef: {
          stats: { additions: 25, deletions: 5, total: 30 },
          files: [
            { filename: 'src/auth.ts', status: 'modified', additions: 25, deletions: 5, changes: 30 },
          ],
        },
        c04f53e1234567890abcdef: {
          stats: { additions: 40, deletions: 0, total: 40 },
          files: [
            { filename: 'README.md', status: 'modified', additions: 40, deletions: 0, changes: 40 },
          ],
        },
        d15a64f1234567890abcdef: {
          stats: { additions: 5, deletions: 5, total: 10 },
          files: [
            { filename: 'package.json', status: 'modified', additions: 5, deletions: 5, changes: 10 },
          ],
        },
      };

      const mockOctokit: any = {
        repos: {
          listCommits: vi.fn().mockResolvedValue({ data: mockRawCommits }),
          getCommit: vi.fn().mockImplementation(({ ref }: { ref: string }) => {
            return Promise.resolve({ data: mockCommitDetails[ref] });
          }),
        },
      };

      const service = new GitHubReportService(mockOctokit);
      const report = await service.generateReport({
        owner: 'testowner',
        repo: 'testrepo',
        branch: 'main',
        since: '2026-09-01',
        until: '2026-09-22',
      });

      // Assert Summary
      expect(report.summary.totalCommits).toBe(4);
      expect(report.summary.contributors).toBe(3); // Alice Dev, Bob Engineer, Charlie
      expect(report.summary.totalFilesChanged).toBe(4);
      expect(report.summary.totalAdditions).toBe(220); // 150 + 25 + 40 + 5
      expect(report.summary.totalDeletions).toBe(20); // 10 + 5 + 0 + 5

      // Assert Conventional Commit type breakdown
      expect(report.summary.types.features).toBe(1);
      expect(report.summary.types.fixes).toBe(1);
      expect(report.summary.types.documentation).toBe(1);
      expect(report.summary.types.other).toBe(1);

      // Assert Contributor aggregation & sorting (Alice has 2 commits, others 1)
      expect(report.contributors).toHaveLength(3);
      expect(report.contributors[0].author).toBe('Alice Dev');
      expect(report.contributors[0].commits).toBe(2);
      expect(report.contributors[0].additions).toBe(190);

      // Assert Daily Activity aggregation (2026-09-05 and 2026-09-06)
      expect(report.dailyActivity).toHaveLength(2);
      expect(report.dailyActivity[0].date).toBe('2026-09-05');
      expect(report.dailyActivity[0].commits).toBe(2);
      expect(report.dailyActivity[1].date).toBe('2026-09-06');
      expect(report.dailyActivity[1].commits).toBe(2);

      // Assert Commits list
      expect(report.commits).toHaveLength(4);
      expect(report.commits[0].shortSha).toBe('a82f31c');
      expect(report.commits[0].type).toBe('feat');
      expect(report.commits[0].scope).toBe('core');
      expect(report.commits[0].changedFiles).toHaveLength(1);
    });

    it('should handle 404 repository not found with clear message', async () => {
      const mockOctokit: any = {
        repos: {
          listCommits: vi.fn().mockRejectedValue({ status: 404, message: 'Not Found' }),
        },
      };

      const service = new GitHubReportService(mockOctokit);
      await expect(
        service.generateReport({ owner: 'unknown', repo: 'missing' })
      ).rejects.toThrow(ReportServiceError);
    });

    it('should handle empty commit response without errors', async () => {
      const mockOctokit: any = {
        repos: {
          listCommits: vi.fn().mockResolvedValue({ data: [] }),
        },
      };

      const service = new GitHubReportService(mockOctokit);
      const report = await service.generateReport({ owner: 'test', repo: 'empty' });
      expect(report.summary.totalCommits).toBe(0);
      expect(report.contributors).toHaveLength(0);
      expect(report.dailyActivity).toHaveLength(0);
      expect(report.commits).toHaveLength(0);
    });
  });
});
