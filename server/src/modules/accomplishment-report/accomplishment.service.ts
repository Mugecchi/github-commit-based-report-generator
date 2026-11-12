import { createGitHubClient } from '../github-report/github.client.js';
import { OllamaService } from '../github-report/ollama.service.js';
import { ReportServiceError } from '../github-report/report.service.js';
import { parseCommitMessage } from '../github-report/report.parser.js';
import {
  AccomplishmentDayItem,
  AccomplishmentReportData,
  DayStatus,
  GenerateAccomplishmentParams,
} from './accomplishment.types.js';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_OF_WEEK_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export class AccomplishmentService {
  private ollamaService: OllamaService;

  constructor(ollamaService?: OllamaService) {
    this.ollamaService = ollamaService || new OllamaService();
  }

  /**
   * Generates calendar days list between two dates with initial exclusion rules.
   */
  generateCalendarDays(
    startDateStr: string,
    endDateStr: string,
    options: {
      excludeFridays?: boolean;
      excludeWeekends?: boolean;
      hoursPerDay?: string;
    } = {}
  ): AccomplishmentDayItem[] {
    const { excludeFridays = true, excludeWeekends = true, hoursPerDay = '10 hours' } = options;

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    const days: AccomplishmentDayItem[] = [];
    const current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    while (current <= endUtc) {
      const year = current.getUTCFullYear();
      const month = current.getUTCMonth();
      const dateNum = current.getUTCDate();
      const dayOfWeekIdx = current.getUTCDay();

      const yyyyMmDd = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
      const formattedDate = `${MONTH_NAMES[month]} ${dateNum}, ${year}`;
      const dayOfWeek = DAY_OF_WEEK_NAMES[dayOfWeekIdx];

      let status: DayStatus = 'working';
      let timeSpent = hoursPerDay;

      // Check default exclusion rules
      if (excludeWeekends && (dayOfWeekIdx === 0 || dayOfWeekIdx === 6)) {
        status = 'excluded';
        timeSpent = '';
      } else if (excludeFridays && dayOfWeekIdx === 5) {
        status = 'excluded';
        timeSpent = '';
      }

      days.push({
        date: yyyyMmDd,
        formattedDate,
        dayOfWeek,
        status,
        timeSpent,
        accomplishment: '',
        remarks: 'Full-Stack Development',
      });

      // Move to next day
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return days;
  }

  /**
   * Formats the human-readable period label for the document header.
   * e.g. "August 29 to September 13, 2026"
   */
  formatPeriodLabel(startDateStr: string, endDateStr: string): string {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    const startMonth = MONTH_NAMES[start.getUTCMonth()];
    const startDay = start.getUTCDate();
    const startYear = start.getUTCFullYear();

    const endMonth = MONTH_NAMES[end.getUTCMonth()];
    const endDay = end.getUTCDate();
    const endYear = end.getUTCFullYear();

    if (startYear === endYear) {
      if (startMonth === endMonth) {
        return `${startMonth} ${startDay} to ${endDay}, ${startYear}`;
      }
      return `${startMonth} ${startDay} to ${endMonth} ${endDay}, ${startYear}`;
    }

    return `${startMonth} ${startDay}, ${startYear} to ${endMonth} ${endDay}, ${endYear}`;
  }

  /**
   * Main report generation function:
   * 1. Evaluates calendar days and exclusions.
   * 2. Fetches repository commits.
   * 3. Distributes commits across all working days disregarding commit dates.
   */
  async generateReport(params: GenerateAccomplishmentParams): Promise<AccomplishmentReportData> {
    const {
      owner,
      repo,
      branch,
      author,
      githubToken,
      startDate,
      endDate,
      name = 'JON CARLO MIGUEL C. RIVERA',
      office = 'MAYOR’S OFFICE',
      position = 'ADMINISTRATIVE AIDE I',
      notedByName = 'MARIA CRISTINE C. ORDOÑEZ',
      notedByPosition = 'COOP Asst. Head & GAD Focal Person',
      hoursPerDay = '10 hours',
      excludeFridays = true,
      excludeWeekends = true,
      daysOverride,
      useOllama,
      ollamaModel,
    } = params;

    // 1. Establish calendar schedule
    let calendarDays: AccomplishmentDayItem[];
    if (daysOverride && daysOverride.length > 0) {
      calendarDays = daysOverride;
    } else {
      calendarDays = this.generateCalendarDays(startDate, endDate, {
        excludeFridays,
        excludeWeekends,
        hoursPerDay,
      });
    }

    // 2. Identify working days to populate
    const workingDayIndices: number[] = [];
    for (let i = 0; i < calendarDays.length; i++) {
      const d = calendarDays[i];
      if (d.status === 'working') {
        workingDayIndices.push(i);
        d.timeSpent = hoursPerDay;
      } else if (d.status === 'holiday') {
        d.timeSpent = 'Holiday';
        d.accomplishment = '';
        d.remarks = '';
      } else if (d.status === 'leave') {
        d.timeSpent = 'On Leave';
        d.accomplishment = '';
        d.remarks = '';
      } else {
        d.timeSpent = '';
        d.accomplishment = '';
        d.remarks = '';
      }
    }

    // 3. Fetch commits from GitHub repository
    const commits = await this.fetchCommits({
      owner,
      repo,
      branch,
      author,
      githubToken,
    });

    // 4. Populate working days according to commits (disregarding commit dates)
    if (workingDayIndices.length > 0) {
      await this.populateWorkingDays(calendarDays, workingDayIndices, commits, {
        useOllama,
        ollamaModel,
        repoInfo: { owner, repo },
      });
    }

    // 5. Calculate metrics
    const totalCalendarDays = calendarDays.length;
    const totalWorkingDays = calendarDays.filter((d) => d.status === 'working').length;
    const totalHolidays = calendarDays.filter((d) => d.status === 'holiday').length;
    const totalLeaves = calendarDays.filter((d) => d.status === 'leave').length;
    const totalExcludedDays = calendarDays.filter((d) => d.status === 'excluded').length;

    const periodLabel = this.formatPeriodLabel(startDate, endDate);

    return {
      metadata: {
        owner,
        repo,
        branch: branch || 'default',
        authorFilter: author,
        startDate,
        endDate,
        periodLabel,
        name,
        office,
        position,
        notedByName,
        notedByPosition,
        totalCalendarDays,
        totalWorkingDays,
        totalHolidays,
        totalLeaves,
        totalExcludedDays,
        hoursPerDay,
        generatedAt: new Date().toISOString(),
      },
      days: calendarDays,
    };
  }

  /**
   * Fetches commits from the repository (disregarding date boundary restrictions so we have full context).
   */
  private async fetchCommits(options: {
    owner: string;
    repo: string;
    branch?: string;
    author?: string;
    githubToken?: string;
  }): Promise<any[]> {
    const octokit = createGitHubClient(options.githubToken);

    try {
      const response = await octokit.repos.listCommits({
        owner: options.owner,
        repo: options.repo,
        sha: options.branch || undefined,
        author: options.author || undefined,
        per_page: 100,
      });

      return response.data || [];
    } catch (error: any) {
      const status = error.status || error.response?.status;
      if (status === 404) {
        throw new ReportServiceError(
          `GitHub repository "${options.owner}/${options.repo}" was not found or is private without authorized access.`,
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
        throw new ReportServiceError(
          `Access forbidden or rate limit reached for "${options.owner}/${options.repo}". Check token or rate limit.`,
          status
        );
      }
      throw new ReportServiceError(
        `Failed to fetch commits from GitHub: ${error.message || 'Unknown network error'}`,
        status || 500
      );
    }
  }

  /**
   * Populates working days using commit messages and metadata.
   */
  private async populateWorkingDays(
    allDays: AccomplishmentDayItem[],
    workingDayIndices: number[],
    rawCommits: any[],
    options: {
      useOllama?: boolean;
      ollamaModel?: string;
      repoInfo: { owner: string; repo: string };
    }
  ): Promise<void> {
    const workingDaysCount = workingDayIndices.length;

    // Parse commits
    const parsedCommits = rawCommits.map((c) => {
      const rawMsg = c.commit?.message || '';
      const parsed = parseCommitMessage(rawMsg);
      return {
        sha: c.sha ? c.sha.substring(0, 7) : '',
        message: rawMsg,
        subject: parsed.subject || rawMsg.split('\n')[0] || '',
        type: parsed.type,
        scope: parsed.scope,
        isBreaking: parsed.isBreaking,
      };
    });

    // Generate daily narratives deterministically
    const generatedAccomplishments = this.synthesizeAccomplishments(
      parsedCommits,
      workingDaysCount,
      options.repoInfo.repo
    );

    // Apply to each working day
    for (let i = 0; i < workingDayIndices.length; i++) {
      const dayIndex = workingDayIndices[i];
      const entry = generatedAccomplishments[i];
      if (entry) {
        allDays[dayIndex].accomplishment = entry.accomplishment;
        allDays[dayIndex].remarks = entry.remarks;
      }
    }
  }

  /**
   * Deterministic synthesis engine: maps any number of commits across W working days,
   * producing rich, professional narrative achievements matching the style of ACCOMPLISHMENT REPORT (1).docx.
   */
  private synthesizeAccomplishments(
    commits: Array<{
      sha: string;
      message: string;
      subject: string;
      type: string;
      scope: string | null;
      isBreaking: boolean;
    }>,
    targetDaysCount: number,
    repoName: string
  ): Array<{ accomplishment: string; remarks: string }> {
    const results: Array<{ accomplishment: string; remarks: string }> = [];

    // Fallback template milestones if no commits were found in repository
    const fallbackMilestones = [
      {
        title: 'Centralized Architecture & State Standardization',
        desc: 'Engineered modular application directories, built centralized state management providers, and established reusable service abstractions across system components.',
        remarks: 'System Architecture',
      },
      {
        title: 'Backend Controllers & Data Access Implementation',
        desc: 'Implemented structured RESTful API controllers, standard CRUD endpoints, and configured automated database seeders for multi-department workflows.',
        remarks: 'Full-Stack Development',
      },
      {
        title: 'Audit Logging Layer & User Metadata Capture',
        desc: 'Developed audit service infrastructure to record operator activities, chronological event sorting, and payload enrichment with granular role contexts.',
        remarks: 'System Security & Auditing',
      },
      {
        title: 'Frontend Views & Administrative Dashboard Integration',
        desc: 'Built intuitive administrative dashboard interfaces connected to shared context stores to facilitate real-time monitoring and reporting.',
        remarks: 'Frontend Engineering',
      },
      {
        title: 'Database Query Tuning & Data Integrity Verification',
        desc: 'Engineered optimized query indexes and verified relational consistency across application data tables to ensure sub-millisecond retrieval latency.',
        remarks: 'Database & API Engineering',
      },
      {
        title: 'Session Management & Authentication Hardening',
        desc: 'Configured automated session timeout policies, secured credential verification mechanisms, and reinforced role-based access boundaries.',
        remarks: 'Security & Access Control',
      },
      {
        title: 'Module Namespace Consistency & Dependency Cleanup',
        desc: 'Conducted deep package namespace compliance passes, retired deprecated aliases, and pruned legacy dependencies across shared libraries.',
        remarks: 'Codebase Maintenance',
      },
      {
        title: 'Documentation Maintenance & Technical Reference Cleanliness',
        desc: 'Conducted documentation maintenance by updating architectural walkthroughs, verifying setup guides, and streamlining repository developer references.',
        remarks: 'Repository Maintenance',
      },
      {
        title: 'Automated Test Coverage & Defect Remediation',
        desc: 'Authored unit test suites for critical business workflows, patched edge cases in form validations, and verified regression resilience.',
        remarks: 'Testing & Quality Assurance',
      },
      {
        title: 'Production Build Optimization & Release Packaging',
        desc: 'Streamlined production bundler configurations, eliminated unreferenced assets, and validated runtime stability for deployment readiness.',
        remarks: 'CI/CD & Deployment',
      },
    ];

    if (commits.length === 0) {
      for (let i = 0; i < targetDaysCount; i++) {
        const item = fallbackMilestones[i % fallbackMilestones.length];
        results.push({
          accomplishment: `${item.title}: ${item.desc}`,
          remarks: item.remarks,
        });
      }
      return results;
    }

    // If commits exist, let's group them or slice them across targetDaysCount
    const chunkSize = Math.max(1, Math.floor(commits.length / targetDaysCount));

    for (let dayIdx = 0; dayIdx < targetDaysCount; dayIdx++) {
      const startIdx = (dayIdx * chunkSize) % commits.length;
      const endIdx = Math.min(startIdx + chunkSize, commits.length);
      const dayCommits = commits.slice(startIdx, endIdx);

      const primaryCommit = dayCommits[0] || commits[dayIdx % commits.length];
      const secondaryCommit = dayCommits[1];

      // Extract subject and format title
      let rawSubject = primaryCommit.subject.trim();
      // Remove conventional commit prefix if present (e.g. feat(scope): message -> message)
      rawSubject = rawSubject.replace(/^(feat|fix|refactor|docs|test|chore|perf|style|build|ci|revert)(\([^)]+\))?:\s*/i, '');
      const capitalizedSubject = rawSubject.charAt(0).toUpperCase() + rawSubject.slice(1);

      // Determine category and remarks based on commit type & scope
      let title = '';
      let desc = '';
      let remarks = 'Full-Stack Development';

      const scope = primaryCommit.scope ? primaryCommit.scope.toUpperCase() : '';
      const type = primaryCommit.type.toLowerCase();

      if (type === 'feat') {
        const scopePrefix = scope ? `${scope} ` : '';
        title = `${scopePrefix}${this.toTitleCase(capitalizedSubject.slice(0, 45))}`;
        desc = `Engineered ${rawSubject.toLowerCase()} and integrated responsive application workflows to enhance end-user capability.`;
        remarks = scope.includes('UI') || scope.includes('CLIENT') ? 'Frontend Engineering' : 'Full-Stack Development';
      } else if (type === 'fix') {
        title = `${scope ? scope + ' ' : ''}Defect Resolution & Stability Patch`;
        desc = `Diagnosed root cause and implemented targeted fix for ${rawSubject.toLowerCase()} to restore verified operational behavior.`;
        remarks = 'System Stability & Bug Fixes';
      } else if (type === 'refactor') {
        title = `${scope ? scope + ' ' : ''}Architectural Refactoring & Modular Restructuring`;
        desc = `Refactored ${rawSubject.toLowerCase()} to eliminate technical debt, enhance maintainability, and improve system modularity.`;
        remarks = 'System Architecture';
      } else if (type === 'docs') {
        title = 'Technical Documentation & Reference Maintenance';
        desc = `Conducted documentation pass addressing ${rawSubject.toLowerCase()} and aligned technical guides with current codebase specifications.`;
        remarks = 'Documentation Maintenance';
      } else if (type === 'test') {
        title = 'Test Suite Expansion & Quality Verification';
        desc = `Authored automated regression tests covering ${rawSubject.toLowerCase()} to enforce continuous quality standards.`;
        remarks = 'Testing & Quality Assurance';
      } else if (type === 'perf') {
        title = 'Performance Optimization & Query Tuning';
        desc = `Analyzed operational metrics and optimized ${rawSubject.toLowerCase()} to reduce latency and maximize execution efficiency.`;
        remarks = 'Performance Engineering';
      } else {
        // chore / other / build
        title = `${scope ? scope + ' ' : ''}Codebase Hygiene & Infrastructure Maintenance`;
        desc = `Performed maintenance operations including ${rawSubject.toLowerCase()} and ensured cross-system dependency consistency.`;
        remarks = 'Repository Maintenance';
      }

      // If there was a secondary commit in this chunk, append its value
      if (secondaryCommit && secondaryCommit !== primaryCommit) {
        let secMsg = secondaryCommit.subject.replace(/^(feat|fix|refactor|docs|test|chore|perf|style|build|ci|revert)(\([^)]+\))?:\s*/i, '');
        desc += ` Additionally completed ${secMsg.toLowerCase()}.`;
      }

      // Ensure proper formatting
      title = title.replace(/[:.]+$/, '');
      const accomplishment = `${title}: ${desc}`;

      results.push({
        accomplishment,
        remarks,
      });
    }

    return results;
  }

  private toTitleCase(str: string): string {
    return str
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase())
      .replace(/([a-z])([A-Z])/g, '$1 $2');
  }
}
