import { describe, expect, it } from 'vitest';
import {
  convertFixCommitToIssue,
  convertFixCommitsToIssues,
  parseCommitMessage,
} from '../report.parser.js';

describe('Conventional Commit Parser', () => {
  it('should parse standard conventional commit with type and subject', () => {
    const result = parseCommitMessage('feat: add user authentication');
    expect(result.type).toBe('feat');
    expect(result.scope).toBeNull();
    expect(result.isBreaking).toBe(false);
    expect(result.subject).toBe('add user authentication');
  });

  it('should parse conventional commit with scope', () => {
    const result = parseCommitMessage('feat(CGSO): regenerate PO items from procurement request');
    expect(result.type).toBe('feat');
    expect(result.scope).toBe('CGSO');
    expect(result.isBreaking).toBe(false);
    expect(result.subject).toBe('regenerate PO items from procurement request');
  });

  it('should parse breaking changes marked with !', () => {
    const result1 = parseCommitMessage('feat!: remove deprecated v1 API');
    expect(result1.type).toBe('feat');
    expect(result1.scope).toBeNull();
    expect(result1.isBreaking).toBe(true);
    expect(result1.subject).toBe('remove deprecated v1 API');

    const result2 = parseCommitMessage('fix(auth)!: change token expiration format');
    expect(result2.type).toBe('fix');
    expect(result2.scope).toBe('auth');
    expect(result2.isBreaking).toBe(true);
    expect(result2.subject).toBe('change token expiration format');
  });

  it('should detect breaking changes from footer in multiline commit', () => {
    const message = `refactor(db): migrate connection pooling

BREAKING CHANGE: connection timeout defaults to 5000ms`;
    const result = parseCommitMessage(message);
    expect(result.type).toBe('refactor');
    expect(result.scope).toBe('db');
    expect(result.isBreaking).toBe(true);
    expect(result.subject).toBe('migrate connection pooling');
  });

  it('should support all standard types: feat, fix, refactor, docs, test, chore, perf, style, build, ci, revert', () => {
    const types = [
      'feat',
      'fix',
      'refactor',
      'docs',
      'test',
      'chore',
      'perf',
      'style',
      'build',
      'ci',
      'revert',
    ] as const;

    for (const t of types) {
      const res = parseCommitMessage(`${t}(core): sample update`);
      expect(res.type).toBe(t);
      expect(res.scope).toBe('core');
      expect(res.subject).toBe('sample update');
    }
  });

  it('should classify non-conventional commits strictly as "other" without guessing', () => {
    const nonConventionalMessages = [
      'Update README.md',
      'Fixed a bug in payment gateway',
      'WIP: initial prototype',
      'Merge pull request #42 from owner/patch-1',
      'Quick fix for production issue',
      '1.2.0 release',
    ];

    for (const msg of nonConventionalMessages) {
      const res = parseCommitMessage(msg);
      expect(res.type).toBe('other');
    }
  });

  it('should handle empty or undefined messages gracefully', () => {
    expect(parseCommitMessage('')).toEqual({
      type: 'other',
      scope: null,
      isBreaking: false,
      subject: '',
    });
    expect(parseCommitMessage(null as any)).toEqual({
      type: 'other',
      scope: null,
      isBreaking: false,
      subject: '',
    });
  });
});

describe('Fix Commits to IssuesAndActionsEntry Parser', () => {
  it('should convert a standard fix commit into a structured IssuesAndActionsEntry', () => {
    const fixCommit: any = {
      sha: 'a82f31c123456789',
      shortSha: 'a82f31c',
      date: '2026-09-10T14:30:00.000Z',
      author: 'Jon Carlo Miguel C. Rivera',
      authorEmail: 'lead.dev@cauayancity.gov.ph',
      message: 'fix(POSD): update patrol route mapping\n\nEnsure offline map coordinates synchronize correctly.',
      subject: 'update patrol route mapping',
      type: 'fix',
      scope: 'POSD',
      isBreaking: false,
      filesChanged: 2,
      additions: 25,
      deletions: 5,
      url: 'https://github.com/Mugecchi/42System/commit/a82f31c',
    };

    const issue = convertFixCommitToIssue(fixCommit, 0, {
      branch: 'main',
      evaluationDate: new Date('2026-09-22T00:00:00.000Z'),
    });

    expect(issue.issueId).toBe('ISS-01');
    expect(issue.module).toBe('POSD');
    expect(issue.issueImpact).toContain('Update patrol route mapping');
    expect(issue.priority).toBe('Medium');
    expect(issue.rootCause).toBe('Ensure offline map coordinates synchronize correctly.');
    expect(issue.reportedStatus).toBe('Closed');
    expect(issue.retestResult).toBe('Passed');
    expect(issue.validatedBy).toBe('Jon Carlo Miguel C. Rivera');
    expect(issue.completionEvidence).toContain('Commit a82f31c');
    expect(issue.completionEvidence).toContain('2 file(s) modified');
    expect(issue.validationDate.getTime()).toBeLessThanOrEqual(new Date('2026-09-22T00:00:00.000Z').getTime());
  });

  it('should detect Critical priority for breaking fixes or security keywords', () => {
    const criticalCommit: any = {
      sha: 'c123456789',
      shortSha: 'c123456',
      date: '2026-09-12T10:00:00.000Z',
      author: 'Security Lead',
      message: 'fix(auth)!: critical patch for session token leakage',
      subject: 'critical patch for session token leakage',
      type: 'fix',
      scope: 'auth',
      isBreaking: true,
      filesChanged: 1,
      additions: 10,
      deletions: 2,
      url: 'https://github.com/test/repo/commit/c123456',
    };

    const issue = convertFixCommitToIssue(criticalCommit, 4);
    expect(issue.issueId).toBe('ISS-05');
    expect(issue.priority).toBe('Critical');
  });

  it('should filter only fix commits when calling convertFixCommitsToIssues', () => {
    const mixedCommits: any[] = [
      {
        sha: '111',
        message: 'feat(CGSO): add procurement PO item validation',
        type: 'feat',
      },
      {
        sha: '222',
        message: 'fix(CGSO): prevent duplicate PO item numbers',
        type: 'fix',
        scope: 'CGSO',
        subject: 'prevent duplicate PO item numbers',
        date: '2026-09-15T00:00:00.000Z',
      },
      {
        sha: '333',
        message: 'docs: update deployment instructions',
        type: 'docs',
      },
      {
        sha: '444',
        message: 'fix(CAO): resolve deduction tax rounding issue',
        type: 'fix',
        scope: 'CAO',
        subject: 'resolve deduction tax rounding issue',
        date: '2026-09-18T00:00:00.000Z',
      },
    ];

    const issues = convertFixCommitsToIssues(mixedCommits);
    expect(issues.length).toBe(2);
    expect(issues[0].issueId).toBe('ISS-01');
    expect(issues[0].module).toBe('CGSO');
    expect(issues[1].issueId).toBe('ISS-02');
    expect(issues[1].module).toBe('CAO');
  });

  it('should identify non-conventional and bracketed fix commits as issues', () => {
    const diverseFixes: any[] = [
      {
        sha: 'aaa',
        message: 'Fixed crash when submitting empty permit form',
        type: 'other',
        date: '2026-09-10T00:00:00.000Z',
      },
      {
        sha: 'bbb',
        message: '[CGSO] Fixed purchase order line item calculation\n\nPrevents duplicate unit count.',
        type: 'other',
        date: '2026-09-11T00:00:00.000Z',
      },
      {
        sha: 'ccc',
        message: 'bugfix(POSD): correct patrol map coordinates',
        type: 'fix',
        scope: 'POSD',
        date: '2026-09-12T00:00:00.000Z',
      },
      {
        sha: 'ddd',
        message: 'Hotfix: emergency memory leak patch in auth worker',
        type: 'other',
        date: '2026-09-13T00:00:00.000Z',
      },
      {
        sha: 'eee',
        message: 'docs: updated api specification',
        type: 'docs',
        date: '2026-09-14T00:00:00.000Z',
      },
    ];

    const issues = convertFixCommitsToIssues(diverseFixes);
    expect(issues.length).toBe(4);
    expect(issues[0].issueId).toBe('ISS-01');
    expect(issues[0].issueImpact).toContain('Crash when submitting empty permit form');
    expect(issues[1].issueId).toBe('ISS-02');
    expect(issues[1].module).toBe('CGSO');
    expect(issues[1].issueImpact).toContain('Purchase order line item calculation');
    expect(issues[2].issueId).toBe('ISS-03');
    expect(issues[2].module).toBe('POSD');
    expect(issues[3].issueId).toBe('ISS-04');
    expect(issues[3].priority).toBe('High');
  });
});


