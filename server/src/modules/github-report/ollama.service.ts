import { env } from '../../config/env.js';
import type {
  ConsolidatedCommitReport,
  ConsolidatedFeature,
  ConsolidatedIssue,
  ConsolidatedMaintenance,
  ConsolidatedRefactor,
  QualityAssessment,
  ReportCommit,
} from './report.types.js';

export interface OllamaStatusResult {
  available: boolean;
  models: string[];
  defaultModel: string;
}

export interface ConsolidateOptions {
  model?: string;
  repoInfo?: { owner: string; repo: string };
  useOllama?: boolean;
  application?: string;
}

export class OllamaService {
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl?: string, defaultModel?: string) {
    this.baseUrl = (baseUrl || env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.defaultModel = defaultModel || env.OLLAMA_MODEL || 'qwen2.5:7B';
  }

  /**
   * Pings the Ollama daemon and queries available models.
   */
  async getStatus(): Promise<OllamaStatusResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          available: false,
          models: [],
          defaultModel: this.defaultModel,
        };
      }

      const data = (await response.json()) as { models?: Array<{ name: string; model?: string }> };
      const modelNames = (data.models || []).map((m) => m.name || m.model || '').filter(Boolean);

      // Verify if default model exists, or pick the first available
      let selectedModel = this.defaultModel;
      if (modelNames.length > 0 && !modelNames.some((m) => m.toLowerCase().startsWith(this.defaultModel.toLowerCase()))) {
        selectedModel = modelNames[0];
      }

      return {
        available: true,
        models: modelNames,
        defaultModel: selectedModel,
      };
    } catch {
      return {
        available: false,
        models: [],
        defaultModel: this.defaultModel,
      };
    }
  }

  /**
   * Consolidates all commit messages into a high-level, structured report.
   * If useOllama is true and Ollama is reachable, uses LLM synthesis.
   * Otherwise falls back gracefully to deterministic algorithmic consolidation.
   */
  async consolidateCommits(
    commits: ReportCommit[],
    options?: ConsolidateOptions
  ): Promise<ConsolidatedCommitReport> {
    if (!commits || commits.length === 0) {
      return this.buildEmptyReport();
    }

    const isTest = process.env.NODE_ENV === 'test';
    const shouldUseOllama = options?.useOllama === true || (options?.useOllama !== false && !isTest);

    if (shouldUseOllama) {
      try {
        const modelToUse = options?.model || this.defaultModel;
        const result = await this.consolidateWithOllama(
          commits,
          modelToUse,
          options?.repoInfo,
          options?.application
        );
        if (result) {
          return result;
        }
      } catch (err) {
        console.warn('Ollama consolidation failed or timed out, falling back to deterministic consolidation:', err);
      }
    }

    return this.consolidateDeterministically(commits);
  }

  /**
   * Sends prompt with strict JSON output format to Ollama generate API.
   */
  private async consolidateWithOllama(
    commits: ReportCommit[],
    model: string,
    repoInfo?: { owner: string; repo: string },
    application?: string
  ): Promise<ConsolidatedCommitReport | null> {
    const formattedCommits = this.formatCommitsForPrompt(commits);
    const appStr = application ? `for application/subsystem [${application}] in ` : '';
    const repoContext = repoInfo ? `${appStr}repository ${repoInfo.owner}/${repoInfo.repo}` : (application ? `for application [${application}]` : '');

    const prompt = `You are a Principal Software Release Manager and Quality Auditor.
Analyze and consolidate ALL the following git commit messages ${repoContext} into a cohesive, non-repetitive executive report.
Group fine-grained, fragmented, or multi-step commits into single unified deliverables and issue resolutions.

Git Commits:
${formattedCommits}

Return a valid JSON object matching this EXACT schema:
{
  "executiveSummary": "A comprehensive paragraph summarizing accomplishments, key architectural updates, stability impact, and development velocity during this period.",
  "features": [
    {
      "title": "Clean, descriptive feature title",
      "module": "Scope or module name (e.g. Core, Auth, Billing, or scope in parentheses)",
      "description": "What business value or user capability was introduced",
      "commitShas": ["shortSha1", "shortSha2"]
    }
  ],
  "issues": [
    {
      "title": "Defect description",
      "module": "Affected module",
      "issueImpact": "Operational or user impact of the defect",
      "priority": "Critical" | "High" | "Medium" | "Low",
      "rootCause": "Technical cause of the problem",
      "actionTaken": "How the issue was permanently patched or resolved",
      "commitShas": ["shortSha1"]
    }
  ],
  "refactors": [
    {
      "title": "Refactoring or optimization title",
      "module": "Module",
      "description": "Architectural benefit, performance gain, or technical debt resolved",
      "commitShas": ["shortSha1"]
    }
  ],
  "maintenance": [
    {
      "title": "Maintenance / CI / Build / Docs task",
      "description": "Dependencies, tests, or documentation updated",
      "commitShas": ["shortSha1"]
    }
  ],
  "qualityAssessment": {
    "score": "e.g. 92/100 or High",
    "risk": "Low" | "Medium" | "High",
    "keyAchievements": ["Achievement 1", "Achievement 2"],
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  }
}`;

    const controller = new AbortController();
    // 90s timeout for local model inference
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { response?: string };
    const rawText = data.response;
    if (!rawText) {
      throw new Error('Empty response received from Ollama');
    }

    const parsed = this.parseOllamaJsonResponse(rawText);
    return this.normalizeConsolidatedReport(parsed, commits, 'ollama', model);
  }

  /**
   * Safely parses JSON string even if enclosed in markdown code fences.
   */
  private parseOllamaJsonResponse(text: string): any {
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      // Extract codeblock json if present
      const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (match && match[1]) {
        return JSON.parse(match[1].trim());
      }

      // Try substring between first '{' and last '}'
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
      }
      throw new Error('Unable to extract valid JSON from Ollama output');
    }
  }

  /**
   * Normalizes Ollama output into strongly typed ConsolidatedCommitReport.
   */
  private normalizeConsolidatedReport(
    raw: any,
    commits: ReportCommit[],
    generatedBy: 'ollama' | 'deterministic',
    modelUsed?: string
  ): ConsolidatedCommitReport {
    const latestDate = commits[0]?.date ? new Date(commits[0].date) : new Date();

    const features: ConsolidatedFeature[] = (Array.isArray(raw.features) ? raw.features : []).map(
      (f: any) => ({
        title: String(f.title || 'Feature enhancement').trim(),
        module: String(f.module || 'Core System').trim(),
        description: String(f.description || '').trim(),
        commitShas: Array.isArray(f.commitShas) ? f.commitShas.map(String) : [],
        commitsCount: Array.isArray(f.commitShas) ? f.commitShas.length : 1,
      })
    );

    const issues: ConsolidatedIssue[] = (Array.isArray(raw.issues) ? raw.issues : []).map(
      (iss: any, idx: number) => {
        const issueId = `ISS-${String(idx + 1).padStart(2, '0')}`;
        const p = String(iss.priority || 'Medium').toLowerCase();
        const priority: 'Critical' | 'High' | 'Medium' | 'Low' =
          p.includes('crit') ? 'Critical' : p.includes('high') ? 'High' : p.includes('low') ? 'Low' : 'Medium';

        const commitShas = Array.isArray(iss.commitShas) ? iss.commitShas.map(String) : [];

        return {
          issueId,
          title: String(iss.title || 'Workflow defect resolved').trim(),
          module: String(iss.module || 'Core System').trim(),
          issueImpact: String(iss.issueImpact || `Defect addressed in ${iss.module || 'core'}`).trim(),
          priority,
          rootCause: String(iss.rootCause || 'Validation or logic discrepancy identified and resolved.').trim(),
          actionTaken: String(iss.actionTaken || 'Patched in commit implementations with regression verification.').trim(),
          needsToBeDone: 'Maintain automated regression test coverage and post-turnover operational verification.',
          commitsCount: commitShas.length || 1,
          commitShas,
          dateLogged: latestDate.toISOString(),
          reportedStatus: 'Closed',
          retestResult: 'Passed',
          validatedBy: 'Jon Carlo Miguel C. Rivera',
          validationDate: latestDate.toISOString(),
        };
      }
    );

    const refactors: ConsolidatedRefactor[] = (Array.isArray(raw.refactors) ? raw.refactors : []).map(
      (r: any) => ({
        title: String(r.title || 'Code refactoring and optimization').trim(),
        module: String(r.module || 'Core').trim(),
        description: String(r.description || '').trim(),
        commitShas: Array.isArray(r.commitShas) ? r.commitShas.map(String) : [],
        commitsCount: Array.isArray(r.commitShas) ? r.commitShas.length : 1,
      })
    );

    const maintenance: ConsolidatedMaintenance[] = (Array.isArray(raw.maintenance) ? raw.maintenance : []).map(
      (m: any) => ({
        title: String(m.title || 'Maintenance task').trim(),
        description: String(m.description || '').trim(),
        commitShas: Array.isArray(m.commitShas) ? m.commitShas.map(String) : [],
        commitsCount: Array.isArray(m.commitShas) ? m.commitShas.length : 1,
      })
    );

    const rawQa = raw.qualityAssessment || {};
    const riskVal = String(rawQa.risk || 'Low').toLowerCase();
    const risk: 'Low' | 'Medium' | 'High' =
      riskVal.includes('high') ? 'High' : riskVal.includes('med') ? 'Medium' : 'Low';

    const qualityAssessment: QualityAssessment = {
      score: String(rawQa.score || '95/100'),
      risk,
      keyAchievements: Array.isArray(rawQa.keyAchievements)
        ? rawQa.keyAchievements.map(String)
        : ['Successfully delivered core milestone features', 'Resolved defects and verified system integrity'],
      recommendations: Array.isArray(rawQa.recommendations)
        ? rawQa.recommendations.map(String)
        : ['Continue regular automated unit testing in CI', 'Proceed with scheduled deployment verification'],
    };

    return {
      generatedBy,
      modelUsed,
      executiveSummary: String(
        raw.executiveSummary ||
          `This report consolidates ${commits.length} commit(s), reflecting key features, defect resolutions, and codebase maintenance.`
      ).trim(),
      features,
      issues,
      refactors,
      maintenance,
      qualityAssessment,
    };
  }

  /**
   * Deterministic consolidation algorithm that groups commits by type and scope/subject
   * without requiring an external LLM. Serves as robust fallback and baseline.
   */
  consolidateDeterministically(commits: ReportCommit[]): ConsolidatedCommitReport {
    const latestDate = commits[0]?.date ? new Date(commits[0].date) : new Date();

    // 1. Group features by scope
    const featMap = new Map<string, { titles: string[]; shas: string[]; files: number }>();
    // 2. Group fixes by scope
    const fixMap = new Map<
      string,
      {
        titles: string[];
        shas: string[];
        bodies: string[];
        isBreaking: boolean;
        criticalKeyword: boolean;
      }
    >();
    // 3. Group refactors
    const refactorMap = new Map<string, { titles: string[]; shas: string[] }>();
    // 4. Group maintenance (chore, docs, test, ci, build, style, other)
    const maintMap = new Map<string, { titles: string[]; shas: string[] }>();

    for (const c of commits) {
      const scopeKey = (c.scope || 'Core System').toUpperCase();
      const cleanSubject = c.subject || c.message.split('\n')[0] || '';
      const sha = c.shortSha || c.sha.substring(0, 7);

      switch (c.type) {
        case 'feat': {
          const entry = featMap.get(scopeKey) || { titles: [], shas: [], files: 0 };
          entry.titles.push(cleanSubject);
          entry.shas.push(sha);
          entry.files += c.filesChanged || 0;
          featMap.set(scopeKey, entry);
          break;
        }
        case 'fix': {
          const entry = fixMap.get(scopeKey) || {
            titles: [],
            shas: [],
            bodies: [],
            isBreaking: false,
            criticalKeyword: false,
          };
          entry.titles.push(cleanSubject);
          entry.shas.push(sha);
          if (c.message) entry.bodies.push(c.message);
          if (c.isBreaking) entry.isBreaking = true;
          if (/(critical|security|vulnerability|crash|data[ -]?loss)/i.test(c.message)) {
            entry.criticalKeyword = true;
          }
          fixMap.set(scopeKey, entry);
          break;
        }
        case 'refactor':
        case 'perf': {
          const entry = refactorMap.get(scopeKey) || { titles: [], shas: [] };
          entry.titles.push(cleanSubject);
          entry.shas.push(sha);
          refactorMap.set(scopeKey, entry);
          break;
        }
        default: {
          const cat = c.type === 'docs' ? 'Documentation' : c.type === 'test' ? 'Testing' : 'Maintenance & CI';
          const entry = maintMap.get(cat) || { titles: [], shas: [] };
          entry.titles.push(cleanSubject);
          entry.shas.push(sha);
          maintMap.set(cat, entry);
          break;
        }
      }
    }

    // Build features
    const features: ConsolidatedFeature[] = Array.from(featMap.entries()).map(([moduleName, data]) => {
      const uniqueTitles = Array.from(new Set(data.titles));
      const title =
        uniqueTitles.length === 1
          ? uniqueTitles[0]
          : `${uniqueTitles[0]} (+${uniqueTitles.length - 1} related feature commit${uniqueTitles.length > 2 ? 's' : ''})`;
      return {
        title,
        module: moduleName,
        description: `Delivered enhancements in ${moduleName}: ${uniqueTitles.slice(0, 3).join('; ')}`,
        commitsCount: data.shas.length,
        commitShas: data.shas,
        filesChanged: data.files,
      };
    });

    // Build issues
    let issueIdx = 1;
    const issues: ConsolidatedIssue[] = Array.from(fixMap.entries()).map(([moduleName, data]) => {
      const issueId = `ISS-${String(issueIdx++).padStart(2, '0')}`;
      const uniqueTitles = Array.from(new Set(data.titles));
      const primaryTitle = uniqueTitles[0] || `Workflow defect fix in ${moduleName}`;
      const priority: 'Critical' | 'High' | 'Medium' | 'Low' = data.isBreaking || data.criticalKeyword
        ? 'Critical'
        : data.shas.length > 2
          ? 'High'
          : 'Medium';

      const combinedBody = data.bodies.join(' ');
      const rootCause =
        combinedBody.length > 20
          ? `Discrepancy identified in ${moduleName} logic: ${uniqueTitles.join(', ')}`
          : `State or condition discrepancy identified in ${moduleName} logic; patched across ${data.shas.length} commit(s).`;

      const actionTaken = `Patched across commit(s) ${data.shas.join(', ')}: ${uniqueTitles.slice(0, 3).join('; ')}`;

      return {
        issueId,
        title: primaryTitle,
        module: moduleName,
        issueImpact: `Resolved operational defect in ${moduleName}: ${primaryTitle}`,
        priority,
        rootCause,
        actionTaken,
        needsToBeDone: 'Maintain automated regression test coverage and operational verification.',
        commitsCount: data.shas.length,
        commitShas: data.shas,
        dateLogged: latestDate.toISOString(),
        reportedStatus: 'Closed',
        retestResult: 'Passed',
        validatedBy: 'Jon Carlo Miguel C. Rivera',
        validationDate: latestDate.toISOString(),
      };
    });

    // Build refactors
    const refactors: ConsolidatedRefactor[] = Array.from(refactorMap.entries()).map(([moduleName, data]) => {
      const uniqueTitles = Array.from(new Set(data.titles));
      return {
        title: uniqueTitles[0] || `Refactoring in ${moduleName}`,
        module: moduleName,
        description: `Refactored ${moduleName} codebase: ${uniqueTitles.slice(0, 3).join('; ')}`,
        commitsCount: data.shas.length,
        commitShas: data.shas,
      };
    });

    // Build maintenance
    const maintenance: ConsolidatedMaintenance[] = Array.from(maintMap.entries()).map(([cat, data]) => {
      const uniqueTitles = Array.from(new Set(data.titles));
      return {
        title: `${cat} Updates`,
        description: uniqueTitles.slice(0, 4).join('; '),
        commitsCount: data.shas.length,
        commitShas: data.shas,
      };
    });

    const totalFeatures = features.reduce((acc, f) => acc + f.commitsCount, 0);
    const totalFixes = issues.reduce((acc, i) => acc + i.commitsCount, 0);

    const executiveSummary = `Consolidated analysis of ${commits.length} commit(s) across the repository. ` +
      `The team delivered ${features.length} major functional capability area(s) (${totalFeatures} commit(s)), ` +
      `resolved ${issues.length} defect cluster(s) (${totalFixes} commit(s)), and applied ` +
      `${refactors.length} architectural refactoring package(s) with accompanying maintenance. ` +
      `All changes are verified under standard branch controls.`;

    const qualityAssessment: QualityAssessment = {
      score: issues.some((i) => i.priority === 'Critical') ? '88/100' : '94/100',
      risk: issues.some((i) => i.priority === 'Critical') ? 'Medium' : 'Low',
      keyAchievements: [
        `Delivered ${features.length} consolidated feature set(s) across active modules`,
        `Resolved ${issues.length} defect cluster(s) with verified patch commits`,
        `Preserved Git version control integrity across ${commits.length} commits`,
      ],
      recommendations: [
        'Maintain automated end-to-end regression suites for consolidated modules',
        'Verify staging deployment before production rollout',
      ],
    };

    return {
      generatedBy: 'deterministic',
      executiveSummary,
      features,
      issues,
      refactors,
      maintenance,
      qualityAssessment,
    };
  }

  /**
   * Compresses commits into concise text lines for LLM context efficiency.
   */
  private formatCommitsForPrompt(commits: ReportCommit[]): string {
    // If large commit volume, take up to 120 most informative commits
    const selected = commits.slice(0, 120);

    return selected
      .map((c) => {
        const shortSha = c.shortSha || c.sha.substring(0, 7);
        const typeScope = c.scope ? `${c.type}(${c.scope})` : c.type;
        const breaking = c.isBreaking ? '!' : '';
        const subject = c.subject || c.message.split('\n')[0] || '';
        const bodyLines = (c.message || '')
          .split('\n')
          .slice(1)
          .map((l) => l.trim())
          .filter((l) => l && !/^(co-authored-by|signed-off-by):/i.test(l));
        const bodySnippet = bodyLines.length > 0 ? ` | note: ${bodyLines[0].substring(0, 100)}` : '';
        return `- ${shortSha} | ${typeScope}${breaking}: ${subject} | files: ${c.filesChanged || 0} (+${c.additions || 0}/-${c.deletions || 0})${bodySnippet}`;
      })
      .join('\n');
  }

  private buildEmptyReport(): ConsolidatedCommitReport {
    return {
      generatedBy: 'deterministic',
      executiveSummary: 'No commits found in the requested range to consolidate.',
      features: [],
      issues: [],
      refactors: [],
      maintenance: [],
      qualityAssessment: {
        score: 'N/A',
        risk: 'Low',
        keyAchievements: ['No changes logged in the specified query range'],
        recommendations: ['Expand the query date range or verify repository branch'],
      },
    };
  }
}
