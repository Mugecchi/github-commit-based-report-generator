export interface SourceFileItem {
  path: string;            // Full path within repository, e.g. "CGSO/src/index.ts"
  relativePath: string;    // Path relative to application root, e.g. "src/index.ts"
  filename: string;        // e.g. "index.ts"
  language: string;        // e.g. "TypeScript", "JavaScript"
  extension: string;       // e.g. ".ts"
  size: number;            // File size in bytes
  linesCount: number;      // Total lines of code
  content?: string;        // Source code content (when loaded)
  sha?: string;            // GitHub blob SHA
  applicationCode: string; // e.g. "CGSO", "ROOT"
}

export interface ApplicationSourceBundle {
  application: {
    code: string;
    name: string;
    fullName: string;
    path: string;
    isRoot: boolean;
    owningOffice?: string;
  };
  repository: {
    owner: string;
    repo: string;
    branch: string;
  };
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  languageStats: Record<string, number>; // Language name -> file count
  files: SourceFileItem[];
  generatedAt: string;
}

export interface SourceCodeScanResult {
  repository: {
    owner: string;
    repo: string;
    branch: string;
    sourceType: 'github' | 'local';
  };
  structureType: 'single-application' | 'multi-application';
  totalApplications: number;
  totalFiles: number;
  totalSize: number;
  totalEstimatedLines: number;
  applications: Array<{
    code: string;
    name: string;
    fullName: string;
    path: string;
    isRoot: boolean;
    fileCount: number;
    totalSize: number;
    estimatedLines: number;
    languageStats: Record<string, number>;
    files: Array<{
      path: string;
      relativePath: string;
      filename: string;
      language: string;
      extension: string;
      size: number;
      sha?: string;
    }>;
  }>;
}

export interface SourceCodeScanParams {
  owner: string;
  repo: string;
  branch?: string;
  githubToken?: string;
  srcOnly?: boolean;
  sourceType?: 'github' | 'local';
  localPath?: string;
}

export interface SourceCodeDownloadParams extends SourceCodeScanParams {
  application?: string; // 'ALL' or specific application code like 'CGSO'
  includeLineNumbers?: boolean;
  selectedFiles?: string[];
}
