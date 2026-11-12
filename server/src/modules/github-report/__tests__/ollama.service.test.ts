import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OllamaService } from '../ollama.service.js';
import { ReportCommit } from '../report.types.js';

describe('OllamaService & Commit Consolidation', () => {
  const sampleCommits: ReportCommit[] = [
    {
      sha: 'a82f31c1234567890abcdef',
      shortSha: 'a82f31c',
      date: '2026-09-05T10:00:00.000Z',
      author: 'Jon Carlo',
      authorEmail: 'jon@example.com',
      message: 'feat(CGSO): regenerate PO items from procurement request',
      subject: 'regenerate PO items from procurement request',
      type: 'feat',
      scope: 'CGSO',
      isBreaking: false,
      filesChanged: 2,
      additions: 80,
      deletions: 5,
      url: 'https://github.com/test/commit/a82f31c',
    },
    {
      sha: 'b93e42d1234567890abcdef',
      shortSha: 'b93e42d',
      date: '2026-09-06T14:30:00.000Z',
      author: 'Jon Carlo',
      authorEmail: 'jon@example.com',
      message: 'feat(CGSO): add automatic budget calculation for PO items',
      subject: 'add automatic budget calculation for PO items',
      type: 'feat',
      scope: 'CGSO',
      isBreaking: false,
      filesChanged: 1,
      additions: 45,
      deletions: 2,
      url: 'https://github.com/test/commit/b93e42d',
    },
    {
      sha: 'c04f53e1234567890abcdef',
      shortSha: 'c04f53e',
      date: '2026-09-07T09:15:00.000Z',
      author: 'Jon Carlo',
      authorEmail: 'jon@example.com',
      message: 'fix(auth): handle null session on token refresh\n\nFixes edge case on mobile login.',
      subject: 'handle null session on token refresh',
      type: 'fix',
      scope: 'auth',
      isBreaking: false,
      filesChanged: 1,
      additions: 15,
      deletions: 3,
      url: 'https://github.com/test/commit/c04f53e',
    },
    {
      sha: 'd15a64f1234567890abcdef',
      shortSha: 'd15a64f',
      date: '2026-09-08T11:00:00.000Z',
      author: 'Jon Carlo',
      authorEmail: 'jon@example.com',
      message: 'fix(auth): prevent session timeout race condition',
      subject: 'prevent session timeout race condition',
      type: 'fix',
      scope: 'auth',
      isBreaking: false,
      filesChanged: 1,
      additions: 10,
      deletions: 2,
      url: 'https://github.com/test/commit/d15a64f',
    },
    {
      sha: 'e26b75a1234567890abcdef',
      shortSha: 'e26b75a',
      date: '2026-09-09T16:00:00.000Z',
      author: 'Jon Carlo',
      authorEmail: 'jon@example.com',
      message: 'refactor(db): migrate connection pool to use connection pooling retry',
      subject: 'migrate connection pool to use connection pooling retry',
      type: 'refactor',
      scope: 'db',
      isBreaking: false,
      filesChanged: 3,
      additions: 60,
      deletions: 40,
      url: 'https://github.com/test/commit/e26b75a',
    },
    {
      sha: 'f37c86b1234567890abcdef',
      shortSha: 'f37c86b',
      date: '2026-09-10T08:00:00.000Z',
      author: 'Jon Carlo',
      authorEmail: 'jon@example.com',
      message: 'docs: update deployment and environment configuration guide',
      subject: 'update deployment and environment configuration guide',
      type: 'docs',
      scope: null,
      isBreaking: false,
      filesChanged: 1,
      additions: 30,
      deletions: 5,
      url: 'https://github.com/test/commit/f37c86b',
    },
  ];

  describe('getStatus', () => {
    it('should report available: false if daemon is offline or connection fails', async () => {
      const service = new OllamaService('http://127.0.0.1:99999', 'qwen2.5:7B');
      const status = await service.getStatus();
      expect(status.available).toBe(false);
      expect(status.models).toEqual([]);
      expect(status.defaultModel).toBe('qwen2.5:7B');
    });
  });

  describe('Deterministic Consolidation', () => {
    it('should consolidate fine-grained commits into unified feature and issue clusters', () => {
      const service = new OllamaService();
      const report = service.consolidateDeterministically(sampleCommits);

      expect(report.generatedBy).toBe('deterministic');
      expect(report.executiveSummary).toContain('Consolidated analysis of 6 commit(s)');

      // CGSO features should be grouped into 1 consolidated feature
      expect(report.features).toHaveLength(1);
      expect(report.features[0].module).toBe('CGSO');
      expect(report.features[0].commitsCount).toBe(2);
      expect(report.features[0].commitShas).toEqual(['a82f31c', 'b93e42d']);

      // Auth fixes should be grouped into 1 consolidated issue instead of 2 separate raw rows
      expect(report.issues).toHaveLength(1);
      expect(report.issues[0].issueId).toBe('ISS-01');
      expect(report.issues[0].module).toBe('AUTH');
      expect(report.issues[0].commitsCount).toBe(2);
      expect(report.issues[0].commitShas).toEqual(['c04f53e', 'd15a64f']);
      expect(report.issues[0].actionTaken).toContain('Patched across commit(s)');

      // Refactor and maintenance
      expect(report.refactors).toHaveLength(1);
      expect(report.refactors[0].module).toBe('DB');

      expect(report.maintenance).toHaveLength(1);

      // Quality assessment
      expect(report.qualityAssessment.risk).toBe('Low');
      expect(report.qualityAssessment.score).toBe('94/100');
      expect(report.qualityAssessment.keyAchievements.length).toBeGreaterThan(0);
    });

    it('should handle empty commit array gracefully', () => {
      const service = new OllamaService();
      const report = service.consolidateDeterministically([]);
      expect(report.features).toHaveLength(0);
      expect(report.issues).toHaveLength(0);
      expect(report.refactors).toHaveLength(0);
      expect(report.maintenance).toHaveLength(0);
    });
  });

  describe('Ollama LLM Integration & Fallback', () => {
    it('should fall back to deterministic consolidation if Ollama fails or times out', async () => {
      // Point to an invalid port to trigger fetch failure
      const service = new OllamaService('http://127.0.0.1:54321', 'nonexistent-model');
      const report = await service.consolidateCommits(sampleCommits, {
        useOllama: true,
      });

      expect(report.generatedBy).toBe('deterministic');
      expect(report.features.length).toBeGreaterThan(0);
      expect(report.issues.length).toBeGreaterThan(0);
    });

    it('should correctly parse Ollama JSON response when fetch succeeds', async () => {
      const service = new OllamaService();

      const mockOllamaResponse = {
        executiveSummary: 'Major sprint delivery focusing on CGSO procurement and security hardening.',
        features: [
          {
            title: 'Automated PO Procurement Engine',
            module: 'CGSO',
            description: 'Automates PO item regeneration and dynamic budget calculation.',
            commitShas: ['a82f31c', 'b93e42d'],
          },
        ],
        issues: [
          {
            title: 'Authentication Token Session Expiration',
            module: 'Auth',
            issueImpact: 'Prevented mobile login dropouts',
            priority: 'High',
            rootCause: 'Race condition on null refresh tokens',
            actionTaken: 'Synchronized token refresh queue',
            commitShas: ['c04f53e', 'd15a64f'],
          },
        ],
        refactors: [],
        maintenance: [],
        qualityAssessment: {
          score: '96/100',
          risk: 'Low',
          keyAchievements: ['Resolved all authentication race conditions'],
          recommendations: ['Monitor mobile token metrics in production'],
        },
      };

      // Mock global fetch for this test
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: JSON.stringify(mockOllamaResponse) }),
      });

      try {
        const report = await service.consolidateCommits(sampleCommits, {
          useOllama: true,
          model: 'qwen2.5:7B',
        });

        expect(report.generatedBy).toBe('ollama');
        expect(report.modelUsed).toBe('qwen2.5:7B');
        expect(report.executiveSummary).toContain('Major sprint delivery');
        expect(report.features[0].title).toBe('Automated PO Procurement Engine');
        expect(report.issues[0].issueId).toBe('ISS-01');
        expect(report.issues[0].priority).toBe('High');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
