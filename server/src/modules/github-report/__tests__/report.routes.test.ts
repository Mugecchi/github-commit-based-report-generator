import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildApp } from '../../../app.js';
import { GitHubReportService } from '../report.service.js';
import { KNOWN_42SYSTEM_APPLICATIONS } from '../report.xlsx.js';
import type { GitHubReportData } from '../report.types.js';

describe('Report Routes - Export Endpoints (XLSX & ZIP)', () => {
  const sampleMultiAppData: GitHubReportData = {
    metadata: {
      owner: 'Mugecchi',
      repo: '42System',
      branch: 'main',
      since: '2026-09-01T00:00:00.000Z',
      until: '2026-09-22T23:59:59.999Z',
      generatedAt: '2026-09-22T12:00:00.000Z',
      structureInfo: {
        type: 'multi-application',
        applicationsCount: KNOWN_42SYSTEM_APPLICATIONS.length,
        applications: KNOWN_42SYSTEM_APPLICATIONS.map((app) => ({
          id: app.code,
          code: app.code,
          name: app.name,
          fullName: app.fullName,
          path: app.code,
          isRoot: false,
          commitCount: 1,
        })),
        detectedFrom: 'repo-tree',
        summaryDescription: '9 Applications detected',
      },
    },
    summary: {
      totalCommits: 2,
      contributors: 1,
      totalFilesChanged: 2,
      totalAdditions: 50,
      totalDeletions: 10,
      types: {
        features: 1,
        fixes: 1,
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
      features: 1,
      fixes: 1,
      refactors: 0,
      documentation: 0,
    },
    contributors: [
      {
        author: 'Lead Dev',
        authorEmail: 'dev@cauayan.gov.ph',
        commits: 2,
        additions: 50,
        deletions: 10,
        filesChanged: 2,
      },
    ],
    dailyActivity: [
      {
        date: '2026-09-05',
        commits: 2,
        filesChanged: 2,
        additions: 50,
        deletions: 10,
      },
    ],
    commits: [
      {
        sha: '1111111111111111',
        message: 'feat(CGSO): add inventory batch tracker',
        author: 'Lead Dev',
        date: '2026-09-05T10:00:00Z',
        url: 'https://github.com/Mugecchi/42System/commit/111',
        type: 'feat',
        scope: 'CGSO',
        subject: 'add inventory batch tracker',
        additions: 30,
        deletions: 5,
        filesChanged: 1,
        changedFiles: [{ filename: 'CGSO/src/tracker.ts', status: 'added', additions: 30, deletions: 5, changes: 35 }],
      },
      {
        sha: '2222222222222222',
        message: 'fix(CAO): resolve ledger tax computation formula',
        author: 'Lead Dev',
        date: '2026-09-05T14:00:00Z',
        url: 'https://github.com/Mugecchi/42System/commit/222',
        type: 'fix',
        scope: 'CAO',
        subject: 'resolve ledger tax computation formula',
        additions: 20,
        deletions: 5,
        filesChanged: 1,
        changedFiles: [{ filename: 'CAO/src/ledger.ts', status: 'modified', additions: 20, deletions: 5, changes: 25 }],
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/reports/github/commits.xlsx with application=ALL should deliver a ZIP archive of all program excels', async () => {
    vi.spyOn(GitHubReportService.prototype, 'generateReport').mockResolvedValue(sampleMultiAppData);

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/github/commits.xlsx?owner=Mugecchi&repo=42System&since=2026-09-01&until=2026-09-22&application=ALL',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/zip');
    expect(response.headers['content-disposition']).toContain('all_applications');
    expect(response.headers['content-disposition']).toContain('.zip');
    expect(response.rawPayload.length).toBeGreaterThan(1000);
  });

  it('GET /api/reports/github/commits.xlsx with specific application (CGSO) should deliver a single XLSX workbook', async () => {
    vi.spyOn(GitHubReportService.prototype, 'generateReport').mockResolvedValue({
      ...sampleMultiAppData,
      metadata: {
        ...sampleMultiAppData.metadata,
        application: 'CGSO',
      },
    });

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/github/commits.xlsx?owner=Mugecchi&repo=42System&since=2026-09-01&until=2026-09-22&application=CGSO',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(response.headers['content-disposition']).toContain('_CGSO');
    expect(response.headers['content-disposition']).toContain('.xlsx');
    expect(response.rawPayload.length).toBeGreaterThan(1000);
  });

  it('GET /api/reports/github/commits.zip should deliver a ZIP archive', async () => {
    vi.spyOn(GitHubReportService.prototype, 'generateReport').mockResolvedValue(sampleMultiAppData);

    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/github/commits.zip?owner=Mugecchi&repo=42System&since=2026-09-01&until=2026-09-22',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/zip');
    expect(response.headers['content-disposition']).toContain('all_applications');
    expect(response.headers['content-disposition']).toContain('.zip');
    expect(response.rawPayload.length).toBeGreaterThan(1000);
  });
});
