export type ConventionalCommitType =
  | 'feat'
  | 'fix'
  | 'refactor'
  | 'docs'
  | 'test'
  | 'chore'
  | 'perf'
  | 'style'
  | 'build'
  | 'ci'
  | 'revert'
  | 'other';

export interface ChangedFileItem {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  rawUrl?: string;
  blobUrl?: string;
  patch?: string;
}

export interface ReportCommit {
  sha: string;
  shortSha: string;
  date: string;
  author: string;
  authorEmail: string;
  message: string;
  subject: string;
  type: ConventionalCommitType;
  scope: string | null;
  isBreaking: boolean;
  filesChanged: number;
  additions: number;
  deletions: number;
  url: string;
  changedFiles?: ChangedFileItem[];
}

export interface ReportCommitTypeBreakdown {
  features: number;
  fixes: number;
  refactors: number;
  documentation: number;
  tests: number;
  chores: number;
  perf: number;
  style: number;
  build: number;
  ci: number;
  revert: number;
  other: number;
}

export interface ReportSummary {
  totalCommits: number;
  contributors: number;
  totalFilesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
  types: ReportCommitTypeBreakdown;
  features: number;
  fixes: number;
  refactors: number;
  documentation: number;
}

export interface ContributorStats {
  author: string;
  authorEmail: string;
  commits: number;
  additions: number;
  deletions: number;
  filesChanged: number;
}

export interface DailyActivityStats {
  date: string;
  commits: number;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface ConsolidatedFeature {
  title: string;
  module: string;
  description: string;
  commitsCount: number;
  commitShas: string[];
  filesChanged?: number;
}

export interface ConsolidatedIssue {
  issueId: string;
  title: string;
  module: string;
  issueImpact: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  rootCause: string;
  actionTaken: string;
  needsToBeDone?: string;
  commitsCount: number;
  commitShas: string[];
  dateLogged?: string;
  reportedStatus?: 'Closed' | 'In progress' | 'Not started' | 'Deferred';
  retestResult?: 'Passed' | 'Failed' | 'Pending';
  validatedBy?: string;
  validationDate?: string;
}

export interface ConsolidatedRefactor {
  title: string;
  module: string;
  description: string;
  commitsCount: number;
  commitShas: string[];
}

export interface ConsolidatedMaintenance {
  title: string;
  description: string;
  commitsCount: number;
  commitShas: string[];
}

export interface QualityAssessment {
  score: string;
  risk: 'Low' | 'Medium' | 'High';
  keyAchievements: string[];
  recommendations: string[];
}

export interface ConsolidatedCommitReport {
  generatedBy: 'ollama' | 'deterministic';
  modelUsed?: string;
  executiveSummary: string;
  features: ConsolidatedFeature[];
  issues: ConsolidatedIssue[];
  refactors: ConsolidatedRefactor[];
  maintenance: ConsolidatedMaintenance[];
  qualityAssessment: QualityAssessment;
}

export interface DetectedApplication {
  id: string;
  code: string;
  name: string;
  fullName: string;
  path: string;
  isRoot: boolean;
  commitCount?: number;
  filesChanged?: number;
}

export interface RepositoryStructureInfo {
  type: 'single-application' | 'multi-application';
  applicationsCount: number;
  applications: DetectedApplication[];
  detectedFrom: 'repo-tree' | 'commits' | 'hybrid';
  summaryDescription: string;
}

export interface GitHubReportFilterParams {
  owner: string;
  repo: string;
  branch?: string;
  author?: string;
  since?: string;
  until?: string;
  useOllama?: boolean;
  ollamaModel?: string;
  application?: string;
  githubToken?: string;
}

export interface GitHubReportData {
  metadata: {
    owner: string;
    repo: string;
    branch: string;
    since?: string;
    until?: string;
    authorFilter?: string;
    generatedAt: string;
    ollamaModelUsed?: string;
    application?: string;
    applicationName?: string;
    structureInfo?: RepositoryStructureInfo;
  };
  summary: ReportSummary;
  contributors: ContributorStats[];
  dailyActivity: DailyActivityStats[];
  commits: ReportCommit[];
  consolidated?: ConsolidatedCommitReport;
  applications?: DetectedApplication[];
}

