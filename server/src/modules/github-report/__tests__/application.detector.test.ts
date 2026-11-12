import { describe, expect, it } from 'vitest';
import {
  detectRepositoryApplications,
  filterCommitsByApplication,
  IGNORED_SYSTEM_DIRS,
  SINGLE_APP_CONVENTIONAL_DIRS,
} from '../application.detector.js';
import type { ReportCommit } from '../report.types.js';

describe('Application Detector (Multi-App Monorepo vs Single-App Root Folder)', () => {
  it('should identify exactly 1 application (root folder) when repo has standard single-app folders', async () => {
    // Mock Octokit returning standard single-application folders like src, public, test, .github
    const mockOctokit = {
      repos: {
        getContent: async () => ({
          data: [
            { type: 'dir', name: 'src' },
            { type: 'dir', name: 'public' },
            { type: 'dir', name: 'test' },
            { type: 'dir', name: '.github' },
            { type: 'file', name: 'package.json' },
            { type: 'file', name: 'README.md' },
          ],
        }),
      },
    } as any;

    const result = await detectRepositoryApplications({
      owner: 'facebook',
      repo: 'react',
      branch: 'main',
      octokit: mockOctokit,
      commits: [
        {
          sha: 'a1',
          shortSha: 'a1',
          date: '2026-09-01',
          author: 'Alice',
          authorEmail: 'alice@example.com',
          message: 'feat(ui): update root button',
          subject: 'feat(ui): update root button',
          type: 'feat',
          scope: 'ui',
          isBreaking: false,
          filesChanged: 2,
          additions: 10,
          deletions: 2,
          url: '',
          changedFiles: [{ filename: 'src/components/button.tsx', status: 'modified', additions: 10, deletions: 2, changes: 12 }],
        },
      ],
    });

    expect(result.type).toBe('single-application');
    expect(result.applicationsCount).toBe(1);
    expect(result.applications).toHaveLength(1);
    expect(result.applications[0].isRoot).toBe(true);
    expect(result.applications[0].path).toBe('.');
    expect(result.applications[0].name).toContain('Root Folder');
    expect(result.summaryDescription).toContain('1 Application identified: Root Folder');
  });

  it('should identify multiple applications when repo has multiple sub-folders (e.g. 42System LGU offices)', async () => {
    const mockOctokit = {
      repos: {
        getContent: async () => ({
          data: [
            { type: 'dir', name: 'CAO' },
            { type: 'dir', name: 'CDRRMO' },
            { type: 'dir', name: 'CENRO' },
            { type: 'dir', name: 'CEO' },
            { type: 'dir', name: 'CGSO' },
            { type: 'dir', name: 'CUPAO' },
            { type: 'dir', name: 'OCVM' },
            { type: 'dir', name: 'POSD' },
            { type: 'dir', name: 'SP' },
            { type: 'file', name: 'README.md' },
          ],
        }),
      },
    } as any;

    const commits: ReportCommit[] = [
      {
        sha: 'c1',
        shortSha: 'c1',
        date: '2026-09-01',
        author: 'Bob',
        authorEmail: 'bob@example.com',
        message: 'feat(CGSO): add inventory stock ledger',
        subject: 'feat(CGSO): add inventory stock ledger',
        type: 'feat',
        scope: 'CGSO',
        isBreaking: false,
        filesChanged: 3,
        additions: 100,
        deletions: 5,
        url: '',
        changedFiles: [{ filename: 'CGSO/src/ledger.ts', status: 'added', additions: 100, deletions: 5, changes: 105 }],
      },
      {
        sha: 'c2',
        shortSha: 'c2',
        date: '2026-09-02',
        author: 'Alice',
        authorEmail: 'alice@example.com',
        message: 'fix(CAO): resolve tax calculation error',
        subject: 'fix(CAO): resolve tax calculation error',
        type: 'fix',
        scope: 'CAO',
        isBreaking: false,
        filesChanged: 1,
        additions: 12,
        deletions: 4,
        url: '',
        changedFiles: [{ filename: 'CAO/src/tax.ts', status: 'modified', additions: 12, deletions: 4, changes: 16 }],
      },
    ];

    const result = await detectRepositoryApplications({
      owner: 'Mugecchi',
      repo: '42System',
      branch: 'main',
      octokit: mockOctokit,
      commits,
    });

    expect(result.type).toBe('multi-application');
    expect(result.applicationsCount).toBe(9);
    expect(result.applications.map((a) => a.code)).toContain('CGSO');
    expect(result.applications.map((a) => a.code)).toContain('CAO');
    expect(result.applications.find((a) => a.code === 'CGSO')?.fullName).toBe(
      'City General Services Office'
    );
    expect(result.applications.find((a) => a.code === 'CGSO')?.commitCount).toBe(1);
    expect(result.summaryDescription).toContain('9 Applications identified across sub-folders');
  });

  it('should identify monorepo applications when organized under apps/ or packages/ sub-folders', async () => {
    const mockOctokit = {
      repos: {
        getContent: async (opts: { path: string }) => {
          if (opts.path === '') {
            return {
              data: [
                { type: 'dir', name: 'apps' },
                { type: 'dir', name: '.github' },
                { type: 'file', name: 'turbo.json' },
              ],
            };
          }
          if (opts.path === 'apps') {
            return {
              data: [
                { type: 'dir', name: 'web-portal' },
                { type: 'dir', name: 'admin-dashboard' },
                { type: 'dir', name: 'mobile-api' },
              ],
            };
          }
          return { data: [] };
        },
      },
    } as any;

    const result = await detectRepositoryApplications({
      owner: 'enterprise',
      repo: 'monorepo',
      branch: 'main',
      octokit: mockOctokit,
    });

    expect(result.type).toBe('multi-application');
    expect(result.applicationsCount).toBe(3);
    expect(result.applications.map((a) => a.path)).toEqual([
      'apps/admin-dashboard',
      'apps/mobile-api',
      'apps/web-portal',
    ]);
  });

  it('should identify client and server peer sub-folders as multi-application', async () => {
    const mockOctokit = {
      repos: {
        getContent: async () => ({
          data: [
            { type: 'dir', name: 'client' },
            { type: 'dir', name: 'server' },
            { type: 'file', name: 'package.json' },
          ],
        }),
      },
    } as any;

    const result = await detectRepositoryApplications({
      owner: 'developer',
      repo: 'fullstack-app',
      octokit: mockOctokit,
    });

    expect(result.type).toBe('multi-application');
    expect(result.applicationsCount).toBe(2);
    expect(result.applications.map((a) => a.path)).toEqual(['client', 'server']);
  });

  it('should fall back to commit file paths and scopes when GitHub tree API is unavailable', async () => {
    const commits: ReportCommit[] = [
      {
        sha: 'c1',
        shortSha: 'c1',
        date: '2026-09-01',
        author: 'Bob',
        authorEmail: 'bob@example.com',
        message: 'feat(POSD): traffic ticket module',
        subject: 'feat(POSD): traffic ticket module',
        type: 'feat',
        scope: 'POSD',
        isBreaking: false,
        filesChanged: 2,
        additions: 50,
        deletions: 0,
        url: '',
        changedFiles: [{ filename: 'POSD/views/tickets.tsx', status: 'added', additions: 50, deletions: 0, changes: 50 }],
      },
      {
        sha: 'c2',
        shortSha: 'c2',
        date: '2026-09-02',
        author: 'Alice',
        authorEmail: 'alice@example.com',
        message: 'feat(CENRO): waste management logs',
        subject: 'feat(CENRO): waste management logs',
        type: 'feat',
        scope: 'CENRO',
        isBreaking: false,
        filesChanged: 2,
        additions: 80,
        deletions: 1,
        url: '',
        changedFiles: [{ filename: 'CENRO/views/waste.tsx', status: 'added', additions: 80, deletions: 1, changes: 81 }],
      },
    ];

    const result = await detectRepositoryApplications({
      owner: 'Mugecchi',
      repo: '42System',
      // No octokit provided -> fallback to commits
      commits,
    });

    expect(result.type).toBe('multi-application');
    expect(result.detectedFrom).toBe('commits');
    expect(result.applicationsCount).toBeGreaterThanOrEqual(2);
    expect(result.applications.map((a) => a.code)).toContain('POSD');
    expect(result.applications.map((a) => a.code)).toContain('CENRO');
  });

  it('should correctly filter commits by detected application path or scope', () => {
    const commits: ReportCommit[] = [
      {
        sha: 'c1',
        shortSha: 'c1',
        date: '2026-09-01',
        author: 'Bob',
        authorEmail: 'bob@example.com',
        message: 'feat(CGSO): stock management',
        subject: 'feat(CGSO): stock management',
        type: 'feat',
        scope: 'CGSO',
        isBreaking: false,
        filesChanged: 1,
        additions: 10,
        deletions: 0,
        url: '',
      },
      {
        sha: 'c2',
        shortSha: 'c2',
        date: '2026-09-02',
        author: 'Alice',
        authorEmail: 'alice@example.com',
        message: 'fix(CAO): payroll rounding',
        subject: 'fix(CAO): payroll rounding',
        type: 'fix',
        scope: 'CAO',
        isBreaking: false,
        filesChanged: 1,
        additions: 5,
        deletions: 2,
        url: '',
      },
      {
        sha: 'c3',
        shortSha: 'c3',
        date: '2026-09-03',
        author: 'Charlie',
        authorEmail: 'charlie@example.com',
        message: 'refactor: general shared utility',
        subject: 'refactor: general shared utility',
        type: 'refactor',
        scope: null,
        isBreaking: false,
        filesChanged: 1,
        additions: 8,
        deletions: 4,
        url: '',
        changedFiles: [{ filename: 'CGSO/utils/format.ts', status: 'modified', additions: 8, deletions: 4, changes: 12 }],
      },
    ];

    const cgsoCommits = filterCommitsByApplication(commits, 'CGSO');
    expect(cgsoCommits.map((c) => c.sha)).toEqual(['c1', 'c3']);

    const caoCommits = filterCommitsByApplication(commits, 'CAO');
    expect(caoCommits.map((c) => c.sha)).toEqual(['c2']);

    const allCommits = filterCommitsByApplication(commits, 'ALL');
    expect(allCommits).toHaveLength(3);
  });
});
