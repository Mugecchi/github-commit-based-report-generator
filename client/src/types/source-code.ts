export interface SourceCodeFileItem {
  path: string;
  relativePath: string;
  filename: string;
  language: string;
  extension: string;
  size: number;
  sha?: string;
}

export interface SourceCodeApplication {
  code: string;
  name: string;
  fullName: string;
  path: string;
  isRoot: boolean;
  fileCount: number;
  totalSize: number;
  estimatedLines: number;
  languageStats: Record<string, number>;
  files: SourceCodeFileItem[];
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
  applications: SourceCodeApplication[];
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
  application?: string;
  includeLineNumbers?: boolean;
  selectedFiles?: string[];
}
