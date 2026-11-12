import React, { useState } from 'react';
import {
  GitCommit,
  Users,
  Calendar,
  Layers,
  Clock,
  Sparkles,
  FileSpreadsheet,
  FileText,
  FolderGit2,
  Code2,
} from 'lucide-react';

import {
  downloadGitHubReportExcel,
  fetchGitHubReport,
  generateAccomplishmentReportApi,
} from './api/client.js';
import { ChangedFilesModal } from './components/ChangedFilesModal.js';
import { CommitTable } from './components/CommitTable.js';
import { CommitTypeStats } from './components/CommitTypeStats.js';
import { ConsolidatedSummaryView } from './components/ConsolidatedSummaryView.js';
import { ContributorsTable } from './components/ContributorsTable.js';
import { DailyActivityTable } from './components/DailyActivityTable.js';
import { ErrorAlert } from './components/ErrorAlert.js';
import { Header } from './components/Header.js';
import { ReportFilterForm } from './components/ReportFilterForm.js';
import { SummaryCards } from './components/SummaryCards.js';
import { AccomplishmentForm } from './components/AccomplishmentForm.js';
import { AccomplishmentView } from './components/AccomplishmentView.js';
import { SourceCodeReportView } from './components/SourceCodeReportView.js';
import {
  GitHubReportData,
  GitHubReportFilterParams,
  ReportCommit,
} from './types/report.js';
import {
  AccomplishmentDayItem,
  AccomplishmentReportData,
  GenerateAccomplishmentParams,
} from './types/accomplishment.js';

export const App: React.FC = () => {
  const [reportMode, setReportMode] = useState<'effectiveness' | 'accomplishment' | 'source-code'>('effectiveness');

  const [filters, setFilters] = useState<GitHubReportFilterParams>(() => {
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('github_custom_token') || '' : '';
    return {
      owner: 'Mugecchi',
      repo: '42System',
      branch: 'main',
      author: '',
      since: '',
      until: '',
      githubToken: savedToken,
    };
  });

  // Accomplishment Report State
  const [accomplishmentParams, setAccomplishmentParams] = useState<GenerateAccomplishmentParams>(() => {
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('github_custom_token') || '' : '';
    return {
      owner: 'Mugecchi',
      repo: '42System',
      branch: 'main',
      author: '',
      githubToken: savedToken,
      startDate: '2026-08-29',
      endDate: '2026-09-13',
      name: 'JON CARLO MIGUEL C. RIVERA',
      office: 'MAYOR’S OFFICE',
      position: 'ADMINISTRATIVE AIDE I',
      notedByName: 'MARIA CRISTINE C. ORDOÑEZ',
      notedByPosition: 'COOP Asst. Head & GAD Focal Person',
      hoursPerDay: '10 hours',
      excludeFridays: true,
      excludeWeekends: true,
    };
  });

  const [accomplishmentData, setAccomplishmentData] = useState<AccomplishmentReportData | null>(null);
  const [isAccomplishmentLoading, setIsAccomplishmentLoading] = useState(false);
  const [accomplishmentStep, setAccomplishmentStep] = useState('');

  const handleFilterChange = (newFilters: GitHubReportFilterParams) => {
    setFilters(newFilters);
    // Keep accomplishment params owner, repo, branch, githubToken in sync
    setAccomplishmentParams((prev) => ({
      ...prev,
      owner: newFilters.owner,
      repo: newFilters.repo,
      branch: newFilters.branch || prev.branch,
      author: newFilters.author,
      githubToken: newFilters.githubToken,
    }));

    if (typeof window !== 'undefined') {
      if (newFilters.githubToken?.trim()) {
        localStorage.setItem('github_custom_token', newFilters.githubToken.trim());
      } else {
        localStorage.removeItem('github_custom_token');
      }
    }
  };

  const handleAccomplishmentParamChange = (newParams: GenerateAccomplishmentParams) => {
    setAccomplishmentParams(newParams);
    if (typeof window !== 'undefined') {
      if (newParams.githubToken?.trim()) {
        localStorage.setItem('github_custom_token', newParams.githubToken.trim());
      } else {
        localStorage.removeItem('github_custom_token');
      }
    }
  };

  const handleGenerateAccomplishment = async (daysOverride: AccomplishmentDayItem[]) => {
    setIsAccomplishmentLoading(true);
    setAccomplishmentStep('Fetching repository commits & distributing accomplishments...');
    setErrorMessage(null);
    setErrorStatus(undefined);

    try {
      const data = await generateAccomplishmentReportApi({
        ...accomplishmentParams,
        daysOverride,
        githubToken: filters.githubToken || accomplishmentParams.githubToken,
      });
      setAccomplishmentData(data);
    } catch (err: any) {
      console.error('Accomplishment report error:', err);
      const status = err.response?.status;
      const message =
        err.response?.data?.message ||
        err.message ||
        'Failed to generate accomplishment report.';
      setErrorStatus(status);
      setErrorMessage(message);
    } finally {
      setIsAccomplishmentLoading(false);
      setAccomplishmentStep('');
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [reportData, setReportData] = useState<GitHubReportData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'consolidated' | 'commits' | 'contributors' | 'daily'>('consolidated');
  const [selectedCommitForModal, setSelectedCommitForModal] = useState<ReportCommit | null>(null);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setLoadingStep('Fetching GitHub commits & detailed diffs...');
    setErrorMessage(null);
    setErrorStatus(undefined);

    const stepTimer = setTimeout(() => {
      setLoadingStep('Consolidating commit messages with Ollama AI...');
    }, 1200);

    try {
      const data = await fetchGitHubReport(filters);
      clearTimeout(stepTimer);
      setReportData(data);
      if (data.consolidated) {
        setActiveTab('consolidated');
      }
    } catch (err: any) {
      clearTimeout(stepTimer);
      console.error('Report fetch error:', err);
      const status = err.response?.status;
      const message =
        err.response?.data?.message ||
        err.message ||
        'Failed to connect to the backend server. Please ensure the server is running.';
      setErrorStatus(status);
      setErrorMessage(message);
      setReportData(null);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleDownloadExcel = async () => {
    if (!filters.owner || !filters.repo) return;
    setIsDownloading(true);
    try {
      await downloadGitHubReportExcel(filters);
    } catch (err: any) {
      console.error('Download error:', err);
      let message = err.message || 'Failed to download report.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.message) message = parsed.message;
        } catch {
          // ignore
        }
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }
      setErrorMessage(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="app-container">
      <Header />

      {/* Mode Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.75rem',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '0.4rem',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          width: 'fit-content',
        }}
      >
        <button
          type="button"
          onClick={() => setReportMode('effectiveness')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: reportMode === 'effectiveness' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
            color: reportMode === 'effectiveness' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: reportMode === 'effectiveness' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <FileSpreadsheet size={16} />
          <span>System Effectiveness (Excel Workbook)</span>
        </button>

        <button
          type="button"
          onClick={() => setReportMode('accomplishment')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: reportMode === 'accomplishment' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
            color: reportMode === 'accomplishment' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: reportMode === 'accomplishment' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <FileText size={16} />
          <span>Daily Accomplishment Report (Word .docx)</span>
        </button>

        <button
          type="button"
          id="mode-source-code-btn"
          onClick={() => setReportMode('source-code')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: reportMode === 'source-code' ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' : 'transparent',
            color: reportMode === 'source-code' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: reportMode === 'source-code' ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Code2 size={16} />
          <span>Source Code Compilation (.docx / .zip)</span>
        </button>
      </div>

      {errorMessage && (
        <ErrorAlert
          message={errorMessage}
          statusCode={errorStatus}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* MODE 1: Effectiveness Report */}
      {reportMode === 'effectiveness' && (
        <>
          <ReportFilterForm
            filters={filters}
            onChange={handleFilterChange}
            onSubmit={handleGenerateReport}
            onDownloadExcel={handleDownloadExcel}
            isLoading={isLoading}
            isDownloading={isDownloading}
            loadingStep={loadingStep}
            hasReportData={Boolean(reportData)}
          />

          {reportData && (
            <div>
              {/* Metadata Banner */}
              <div
                className="glass-card"
                style={{
                  padding: '1rem 1.5rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  fontSize: '0.875rem',
                  borderLeft: '4px solid #3b82f6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Repository:</span>
                  <strong style={{ color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                    {reportData.metadata.owner}/{reportData.metadata.repo}
                  </strong>
                  <span style={{ color: 'var(--text-dim)' }}>•</span>
                  <span style={{ color: 'var(--text-muted)' }}>Branch:</span>
                  <span className="badge badge-scope">{reportData.metadata.branch}</span>

                  {/* Repository Structure Info (Auto-detected: 1 Root App vs N Sub-folder Apps) */}
                  {reportData.metadata.structureInfo && (
                    <>
                      <span style={{ color: 'var(--text-dim)' }}>•</span>
                      <span style={{ color: 'var(--text-muted)' }}>Structure:</span>
                      <span
                        className="badge"
                        style={{
                          background:
                            reportData.metadata.structureInfo.type === 'single-application'
                              ? 'rgba(16, 185, 129, 0.18)'
                              : 'rgba(99, 102, 241, 0.18)',
                          color:
                            reportData.metadata.structureInfo.type === 'single-application'
                              ? '#34d399'
                              : '#a5b4fc',
                          border: `1px solid ${
                            reportData.metadata.structureInfo.type === 'single-application'
                              ? 'rgba(16, 185, 129, 0.35)'
                              : 'rgba(99, 102, 241, 0.35)'
                          }`,
                        }}
                        title={reportData.metadata.structureInfo.summaryDescription}
                      >
                        {reportData.metadata.structureInfo.type === 'single-application' ? (
                          <>📁 1 App (Root Folder)</>
                        ) : (
                          <>📂 {reportData.metadata.structureInfo.applicationsCount} Apps (Sub-folders)</>
                        )}
                      </span>
                    </>
                  )}

                  {reportData.metadata.application && reportData.metadata.application !== 'ALL' && (
                    <>
                      <span style={{ color: 'var(--text-dim)' }}>•</span>
                      <span style={{ color: 'var(--text-muted)' }}>Target:</span>
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(96, 165, 250, 0.2)',
                          color: '#93c5fd',
                          border: '1px solid rgba(96, 165, 250, 0.4)',
                        }}
                        title={reportData.metadata.applicationName || reportData.metadata.application}
                      >
                        {reportData.metadata.application}
                        {reportData.metadata.applicationName ? ` (${reportData.metadata.applicationName})` : ''}
                      </span>
                    </>
                  )}

                  {(reportData.metadata.since || reportData.metadata.until) && (
                    <>
                      <span style={{ color: 'var(--text-dim)' }}>•</span>
                      <span style={{ color: 'var(--text-muted)' }}>Date Window:</span>
                      <span style={{ color: '#e5e7eb', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                        {reportData.metadata.since?.substring(0, 10) || 'Beginning'} →{' '}
                        {reportData.metadata.until?.substring(0, 10) || 'Latest'}
                      </span>
                    </>
                  )}

                  {reportData.consolidated && (
                    <>
                      <span style={{ color: 'var(--text-dim)' }}>•</span>
                      <span style={{ color: 'var(--text-muted)' }}>AI Consolidation:</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '10px',
                          background:
                            reportData.consolidated.generatedBy === 'ollama'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : 'rgba(156, 163, 175, 0.2)',
                          color: reportData.consolidated.generatedBy === 'ollama' ? '#34d399' : '#d1d5db',
                          fontWeight: 500,
                        }}
                      >
                        {reportData.consolidated.generatedBy === 'ollama'
                          ? `Ollama (${reportData.consolidated.modelUsed || 'qwen2.5:7B'})`
                          : 'Deterministic'}
                      </span>
                    </>
                  )}

                  {filters.githubToken?.trim() && (
                    <>
                      <span style={{ color: 'var(--text-dim)' }}>•</span>
                      <span style={{ color: 'var(--text-muted)' }}>Auth:</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '10px',
                          background: 'rgba(245, 158, 11, 0.2)',
                          color: '#fbbf24',
                          fontWeight: 500,
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                        }}
                        title="Generated using custom GitHub Personal Access Token"
                      >
                        Custom Token Active
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                  <Clock size={14} />
                  <span>Generated: {new Date(reportData.metadata.generatedAt).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Single Application Identified (Root Folder) */}
              {reportData.metadata.structureInfo?.type === 'single-application' && (
                <div
                  className="glass-card"
                  style={{
                    padding: '0.85rem 1.25rem',
                    marginBottom: '1.25rem',
                    background: 'rgba(16, 185, 129, 0.04)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <FolderGit2 size={18} color="#34d399" />
                    <div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#34d399' }}>
                        1 Application Identified: Root Folder
                      </span>
                      <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-dim)' }}>
                        The repository functions as a single unified application in root directory (<code>.</code>).
                      </p>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#a7f3d0',
                      background: 'rgba(16, 185, 129, 0.15)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    Root Directory (1 App)
                  </span>
                </div>
              )}

              {/* Multi-Application Monorepo (Sub-Folders) */}
              {reportData.metadata.structureInfo?.type === 'multi-application' &&
                reportData.applications &&
                reportData.applications.length > 0 && (
                  <div
                    className="glass-card"
                    style={{
                      padding: '1.15rem 1.25rem',
                      marginBottom: '1.25rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.75rem',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Layers size={17} color="#818cf8" />
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f3f4f6', margin: 0 }}>
                          Identified Monorepo Applications ({reportData.applications.length} Sub-folders)
                        </h3>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        Click an application to target its commits and Cauayan effectiveness sheet
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                        gap: '0.65rem',
                      }}
                    >
                      {reportData.applications.map((app) => {
                        const isCurrent =
                          filters.application === app.id || filters.application === app.code;
                        return (
                          <div
                            key={app.id}
                            onClick={() => {
                              handleFilterChange({
                                ...filters,
                                application: isCurrent ? 'ALL' : app.id,
                              });
                            }}
                            style={{
                              background: isCurrent
                                ? 'rgba(99, 102, 241, 0.15)'
                                : 'rgba(255, 255, 255, 0.03)',
                              border: `1px solid ${
                                isCurrent ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.07)'
                              }`,
                              borderRadius: '8px',
                              padding: '0.65rem 0.85rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '0.25rem',
                              }}
                            >
                              <strong
                                style={{
                                  fontSize: '0.825rem',
                                  color: isCurrent ? '#a5b4fc' : '#ffffff',
                                }}
                              >
                                {app.code}
                              </strong>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  color: 'var(--text-muted)',
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '6px',
                                }}
                              >
                                {app.commitCount || 0} commits
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-dim)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={app.fullName}
                            >
                              {app.fullName}
                            </div>
                            <div
                              style={{
                                fontSize: '0.68rem',
                                color: '#60a5fa',
                                marginTop: '0.2rem',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              📁 {app.path}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Summary Cards */}
              <SummaryCards summary={reportData.summary} />

              {/* Conventional Commit Breakdown Chart */}
              <CommitTypeStats
                types={reportData.summary.types}
                totalCommits={reportData.summary.totalCommits}
              />

              {/* Navigation Tabs */}
              <div className="tabs-nav">
                {reportData.consolidated && (
                  <button
                    className={`tab-btn ${activeTab === 'consolidated' ? 'active' : ''}`}
                    onClick={() => setActiveTab('consolidated')}
                    style={{ color: activeTab === 'consolidated' ? '#c084fc' : undefined, fontWeight: 600 }}
                  >
                    <Sparkles size={16} />
                    <span>AI Consolidated Report</span>
                  </button>
                )}
                <button
                  className={`tab-btn ${activeTab === 'commits' ? 'active' : ''}`}
                  onClick={() => setActiveTab('commits')}
                >
                  <GitCommit size={16} />
                  <span>Commits ({reportData.commits.length})</span>
                </button>
                <button
                  className={`tab-btn ${activeTab === 'contributors' ? 'active' : ''}`}
                  onClick={() => setActiveTab('contributors')}
                >
                  <Users size={16} />
                  <span>Contributors ({reportData.contributors.length})</span>
                </button>
                <button
                  className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
                  onClick={() => setActiveTab('daily')}
                >
                  <Calendar size={16} />
                  <span>Daily Activity ({reportData.dailyActivity.length} Days)</span>
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'consolidated' && reportData.consolidated && (
                <ConsolidatedSummaryView
                  consolidated={reportData.consolidated}
                  commits={reportData.commits}
                  onSelectCommit={(commit) => setSelectedCommitForModal(commit)}
                />
              )}

              {activeTab === 'commits' && (
                <CommitTable
                  commits={reportData.commits}
                  onSelectCommit={(commit) => setSelectedCommitForModal(commit)}
                />
              )}

              {activeTab === 'contributors' && (
                <ContributorsTable
                  contributors={reportData.contributors}
                  totalCommits={reportData.summary.totalCommits}
                />
              )}

              {activeTab === 'daily' && (
                <DailyActivityTable dailyActivity={reportData.dailyActivity} />
              )}

              {/* Changed Files Inspection Modal */}
              <ChangedFilesModal
                commit={selectedCommitForModal}
                onClose={() => setSelectedCommitForModal(null)}
              />
            </div>
          )}

          {!reportData && !isLoading && (
            <div
              className="glass-card"
              style={{
                padding: '4rem 2rem',
                textAlign: 'center',
                color: 'var(--text-dim)',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem auto',
                }}
              >
                <Layers size={30} color="#60a5fa" />
              </div>
              <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '0.5rem' }}>
                No Effectiveness Report Generated Yet
              </h3>
              <p style={{ maxWidth: '500px', margin: '0 auto', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Enter a GitHub repository above (such as <code>Mugecchi/42System</code>) and click <strong>Generate Report</strong> to inspect commits, conventional types, contributors, and export Excel workbooks.
              </p>
            </div>
          )}
        </>
      )}

      {/* MODE 2: Accomplishment Report (Civil Service Word .docx) */}
      {reportMode === 'accomplishment' && (
        <>
          {!accomplishmentData ? (
            <AccomplishmentForm
              params={accomplishmentParams}
              onChange={handleAccomplishmentParamChange}
              onSubmit={handleGenerateAccomplishment}
              isLoading={isAccomplishmentLoading}
              loadingStep={accomplishmentStep}
            />
          ) : (
            <AccomplishmentView
              reportData={accomplishmentData}
              onUpdateDays={(updated) =>
                setAccomplishmentData({
                  ...accomplishmentData,
                  days: updated,
                })
              }
              onBackToConfig={() => setAccomplishmentData(null)}
            />
          )}
        </>
      )}

      {/* MODE 3: Source Code Compilation (.docx per app, compressed into ZIP) */}
      {reportMode === 'source-code' && (
        <SourceCodeReportView initialToken={filters.githubToken} />
      )}
    </div>
  );
};
