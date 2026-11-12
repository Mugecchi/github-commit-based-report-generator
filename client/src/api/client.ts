import axios from 'axios';
import {
  GitHubReportData,
  GitHubReportFilterParams,
  RepositoryStructureInfo,
} from '../types/report.js';
import {
  AccomplishmentDayItem,
  AccomplishmentReportData,
  GenerateAccomplishmentParams,
} from '../types/accomplishment.js';
import {
  SourceCodeDownloadParams,
  SourceCodeScanParams,
  SourceCodeScanResult,
} from '../types/source-code.js';

export const apiClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function fetchRepositoryApplications(params: {
  owner: string;
  repo: string;
  branch?: string;
  githubToken?: string;
}): Promise<RepositoryStructureInfo> {
  const queryParams = new URLSearchParams();
  queryParams.append('owner', params.owner.trim());
  queryParams.append('repo', params.repo.trim());

  if (params.branch?.trim()) queryParams.append('branch', params.branch.trim());
  if (params.githubToken?.trim()) queryParams.append('githubToken', params.githubToken.trim());

  const headers: Record<string, string> = {};
  if (params.githubToken?.trim()) {
    headers['x-github-token'] = params.githubToken.trim();
  }

  const response = await apiClient.get<RepositoryStructureInfo>(
    `/api/reports/github/applications?${queryParams.toString()}`,
    { headers }
  );
  return response.data;
}

export async function fetchGitHubReport(
  params: GitHubReportFilterParams
): Promise<GitHubReportData> {
  const queryParams = new URLSearchParams();
  queryParams.append('owner', params.owner.trim());
  queryParams.append('repo', params.repo.trim());

  if (params.branch?.trim()) queryParams.append('branch', params.branch.trim());
  if (params.author?.trim() && params.author !== 'All') {
    queryParams.append('author', params.author.trim());
  }
  if (params.since?.trim()) queryParams.append('since', params.since.trim());
  if (params.until?.trim()) queryParams.append('until', params.until.trim());
  if (params.application?.trim()) {
    queryParams.append('application', params.application.trim());
  }
  if (typeof params.useOllama === 'boolean') {
    queryParams.append('useOllama', String(params.useOllama));
  }
  if (params.ollamaModel?.trim()) {
    queryParams.append('ollamaModel', params.ollamaModel.trim());
  }
  if (params.githubToken?.trim()) {
    queryParams.append('githubToken', params.githubToken.trim());
  }

  const headers: Record<string, string> = {};
  if (params.githubToken?.trim()) {
    headers['x-github-token'] = params.githubToken.trim();
  }

  const response = await apiClient.get<GitHubReportData>(
    `/api/reports/github/commits?${queryParams.toString()}`,
    { headers }
  );
  return response.data;
}

export async function fetchOllamaStatus(): Promise<{
  available: boolean;
  models: string[];
  defaultModel: string;
}> {
  const response = await apiClient.get('/api/ollama/status');
  return response.data;
}

export async function consolidateCommitsApi(payload: {
  commits: any[];
  model?: string;
  repoInfo?: { owner: string; repo: string };
  useOllama?: boolean;
  application?: string;
}): Promise<any> {
  const response = await apiClient.post('/api/reports/github/consolidate', payload);
  return response.data;
}

export async function downloadGitHubReportExcel(
  params: GitHubReportFilterParams
): Promise<void> {
  const queryParams = new URLSearchParams();
  queryParams.append('owner', params.owner.trim());
  queryParams.append('repo', params.repo.trim());

  if (params.branch?.trim()) queryParams.append('branch', params.branch.trim());
  if (params.author?.trim() && params.author !== 'All') {
    queryParams.append('author', params.author.trim());
  }
  if (params.since?.trim()) queryParams.append('since', params.since.trim());
  if (params.until?.trim()) queryParams.append('until', params.until.trim());
  if (params.application?.trim()) {
    queryParams.append('application', params.application.trim());
  }
  if (typeof params.useOllama === 'boolean') {
    queryParams.append('useOllama', String(params.useOllama));
  }
  if (params.ollamaModel?.trim()) {
    queryParams.append('ollamaModel', params.ollamaModel.trim());
  }
  if (params.githubToken?.trim()) {
    queryParams.append('githubToken', params.githubToken.trim());
  }

  const excelHeaders: Record<string, string> = {};
  if (params.githubToken?.trim()) {
    excelHeaders['x-github-token'] = params.githubToken.trim();
  }

  const response = await apiClient.get(
    `/api/reports/github/commits.xlsx?${queryParams.toString()}`,
    {
      responseType: 'blob',
      headers: excelHeaders,
    }
  );

  // Extract filename from Content-Disposition header if available
  const contentDisposition = response.headers['content-disposition'];
  let filename = params.application === 'ALL'
    ? `github-report_${params.owner}_${params.repo}_all_applications.zip`
    : `github-report_${params.owner}_${params.repo}.xlsx`;

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1];
    }
  }

  const contentType = (response.headers['content-type'] as string) || '';
  const isZip = contentType.includes('zip') || filename.toLowerCase().endsWith('.zip');
  const mimeType = isZip
    ? 'application/zip'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  // Create downloadable object URL
  const blob = new Blob([response.data], {
    type: mimeType,
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchCalendarDaysApi(params: {
  startDate: string;
  endDate: string;
  excludeFridays?: boolean;
  excludeWeekends?: boolean;
  hoursPerDay?: string;
}): Promise<{ periodLabel: string; days: AccomplishmentDayItem[] }> {
  const response = await apiClient.post('/api/reports/accomplishment/calendar', params);
  return response.data;
}

export async function generateAccomplishmentReportApi(
  params: GenerateAccomplishmentParams
): Promise<AccomplishmentReportData> {
  const headers: Record<string, string> = {};
  if (params.githubToken?.trim()) {
    headers['x-github-token'] = params.githubToken.trim();
  }

  const response = await apiClient.post<AccomplishmentReportData>(
    '/api/reports/accomplishment/generate',
    params,
    { headers }
  );
  return response.data;
}

export async function downloadAccomplishmentDocxApi(
  reportData: AccomplishmentReportData
): Promise<void> {
  const response = await apiClient.post(
    '/api/reports/accomplishment/docx',
    { reportData },
    { responseType: 'blob' }
  );

  const contentDisposition = response.headers['content-disposition'];
  let filename = `Accomplishment_Report_${reportData.metadata.startDate}_to_${reportData.metadata.endDate}.docx`;

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1];
    }
  }

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function scanSourceCodeRepositoryApi(
  params: SourceCodeScanParams
): Promise<SourceCodeScanResult> {
  const headers: Record<string, string> = {};
  if (params.githubToken?.trim()) {
    headers['x-github-token'] = params.githubToken.trim();
  }

  const response = await apiClient.post<SourceCodeScanResult>(
    '/api/reports/source-code/scan',
    params,
    { headers }
  );
  return response.data;
}

export async function downloadSourceCodeReportApi(
  params: SourceCodeDownloadParams,
  onProgress?: (progressPercent: number) => void
): Promise<void> {
  const headers: Record<string, string> = {};
  if (params.githubToken?.trim()) {
    headers['x-github-token'] = params.githubToken.trim();
  }

  const response = await apiClient.post(
    '/api/reports/source-code/download',
    params,
    {
      headers,
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    }
  );

  const contentDisposition = (response.headers['content-disposition'] as string) || '';
  const contentType = (response.headers['content-type'] as string) || '';
  const isZip = contentType.includes('application/zip');
  let defaultFilename = isZip
    ? `${params.repo}_all_applications_source_code.zip`
    : `${params.repo}_${params.application || 'Application'}_Source_Code.docx`;

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch && filenameMatch[1]) {
      defaultFilename = filenameMatch[1];
    }
  }

  const blob = new Blob([response.data], {
    type:
      contentType ||
      (isZip
        ? 'application/zip'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', defaultFilename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

