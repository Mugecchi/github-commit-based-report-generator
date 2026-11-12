import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  Calendar,
  GitFork,
  User,
  FolderGit2,
  Loader2,
  Sparkles,
  Bot,
  CheckCircle2,
  AlertCircle,
  Layers,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { fetchOllamaStatus, fetchRepositoryApplications } from '../api/client.js';
import {
  GitHubReportFilterParams,
  RepositoryStructureInfo,
} from '../types/report.js';

export const LGU_APPLICATIONS = [
  { code: 'ALL', name: 'ALL', label: 'All Monorepo Applications (Auto-detect)' },
  { code: 'CAO', name: 'CAO', label: 'CAO — City Accounting Office' },
  { code: 'CDRRMO', name: 'CDRRMO', label: 'CDRRMO — City Disaster Risk Reduction and Management' },
  { code: 'CENRO', name: 'CENRO', label: 'CENRO — City Environment and Natural Resources' },
  { code: 'CEO', name: 'CEO', label: 'CEO — City Engineering Office' },
  { code: 'CGSO', name: 'CGSO', label: 'CGSO — City General Services Office' },
  { code: 'CUPAO', name: 'CUPAO', label: 'CUPAO — City Urban Planning and Action Office' },
  { code: 'OCVM', name: 'OCVM', label: 'OCVM — Office of the City Vice Mayor' },
  { code: 'POSD', name: 'POSD', label: 'POSD — Public Order and Safety Division' },
  { code: 'SP', name: 'SP', label: 'SP — Sangguniang Panlungsod' },
] as const;

interface ReportFilterFormProps {
  filters: GitHubReportFilterParams;
  onChange: (filters: GitHubReportFilterParams) => void;
  onSubmit: () => void;
  onDownloadExcel: () => void;
  isLoading: boolean;
  isDownloading: boolean;
  loadingStep: string;
  hasReportData: boolean;
  onStructureDetected?: (info: RepositoryStructureInfo) => void;
}

export const ReportFilterForm: React.FC<ReportFilterFormProps> = ({
  filters,
  onChange,
  onSubmit,
  onDownloadExcel,
  isLoading,
  isDownloading,
  loadingStep,
  hasReportData,
  onStructureDetected,
}) => {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<{
    available: boolean;
    models: string[];
    defaultModel: string;
  } | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(true);
  const [showToken, setShowToken] = useState(false);

  // Application Structure Auto-Detection State
  const [structureInfo, setStructureInfo] = useState<RepositoryStructureInfo | null>(null);
  const [isDetectingApps, setIsDetectingApps] = useState(false);

  const detectApps = useCallback(
    async (owner: string, repo: string, branch?: string, githubToken?: string) => {
      if (!owner.trim() || !repo.trim()) {
        setStructureInfo(null);
        setIsDetectingApps(false);
        return;
      }

      setIsDetectingApps(true);
      try {
        const info = await fetchRepositoryApplications({
          owner: owner.trim(),
          repo: repo.trim(),
          branch: branch?.trim(),
          githubToken: githubToken?.trim(),
        });
        setStructureInfo(info);
        onStructureDetected?.(info);

        // If repo is identified as single-application (root folder), reset filter to ALL
        if (info.type === 'single-application' && filters.application && filters.application !== 'ALL') {
          onChange({ ...filters, application: 'ALL' });
        }
      } catch (err) {
        console.warn('Repository application auto-detection failed:', err);
      } finally {
        setIsDetectingApps(false);
      }
    },
    [filters, onChange, onStructureDetected]
  );

  // Auto-detect applications with debounce whenever repository coordinates change
  useEffect(() => {
    const owner = filters.owner?.trim();
    const repo = filters.repo?.trim();

    if (!owner || !repo) {
      setStructureInfo(null);
      return;
    }

    const timer = setTimeout(() => {
      detectApps(owner, repo, filters.branch, filters.githubToken);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.owner, filters.repo, filters.branch, filters.githubToken, detectApps]);

  const handleManualRefresh = () => {
    if (filters.owner && filters.repo) {
      detectApps(filters.owner, filters.repo, filters.branch, filters.githubToken);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchOllamaStatus()
      .then((status) => {
        if (isMounted) {
          setOllamaStatus(status);
          setCheckingOllama(false);
          // If Ollama is available and filter not set yet, enable by default
          if (status.available && filters.useOllama === undefined) {
            onChange({
              ...filters,
              useOllama: true,
              ollamaModel: status.defaultModel,
            });
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setOllamaStatus({ available: false, models: [], defaultModel: 'qwen2.5:7B' });
          setCheckingOllama(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!filters.owner.trim()) {
      setValidationError('Owner is required (e.g. Mugecchi, facebook, vercel)');
      return;
    }
    if (!filters.repo.trim()) {
      setValidationError('Repository name is required (e.g. 42System, react, next.js)');
      return;
    }

    if (filters.since && filters.until) {
      if (new Date(filters.until).getTime() < new Date(filters.since).getTime()) {
        setValidationError('"Date To" cannot be earlier than "Date From"');
        return;
      }
    }

    setValidationError(null);
    onSubmit();
  };

  const handlePreset = (owner: string, repo: string, branch: string = 'main', application: string = 'ALL') => {
    onChange({
      ...filters,
      owner,
      repo,
      branch,
      application,
    });
    // Trigger detection immediately for the selected preset
    detectApps(owner, repo, branch, filters.githubToken);
  };

  const currentAppTitle =
    structureInfo?.applications.find(
      (a) => a.id === filters.application || a.code === filters.application
    )?.name ||
    LGU_APPLICATIONS.find((a) => a.code === filters.application)?.label ||
    filters.application;

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Search size={20} color="#60a5fa" />
          <span>Report Configuration</span>
        </h2>

        {/* Quick presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>Quick fill:</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
            onClick={() => handlePreset('Mugecchi', '42System', 'main', 'CGSO')}
          >
            42System (CGSO)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
            onClick={() => handlePreset('Mugecchi', '42System', 'main', 'CAO')}
          >
            42System (CAO)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
            onClick={() => handlePreset('Mugecchi', '42System', 'main', 'ALL')}
          >
            42System (All)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
            onClick={() => handlePreset('facebook', 'react', 'main', 'ALL')}
          >
            facebook/react
          </button>
        </div>
      </div>

      {validationError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 1rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
          }}
        >
          {validationError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid-cols-3" style={{ marginBottom: '1.25rem' }}>
          {/* Owner */}
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} /> Owner / Organization
              </span>
              <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Mugecchi or vercel"
              value={filters.owner}
              onChange={(e) => onChange({ ...filters, owner: e.target.value })}
              required
            />
          </div>

          {/* Repo */}
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <FolderGit2 size={14} /> Repository
              </span>
              <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 42System or next.js"
              value={filters.repo}
              onChange={(e) => onChange({ ...filters, repo: e.target.value })}
              required
            />
          </div>

          {/* Application */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Layers size={14} color="#818cf8" /> Application / System
                </span>
              </label>
              <button
                type="button"
                onClick={handleManualRefresh}
                title="Re-detect applications in repository"
                disabled={isDetectingApps || !filters.owner || !filters.repo}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isDetectingApps ? '#60a5fa' : 'var(--text-dim)',
                  cursor: isDetectingApps || !filters.owner || !filters.repo ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  padding: '2px 4px',
                  borderRadius: '4px',
                }}
              >
                <RefreshCw size={11} className={isDetectingApps ? 'spinner' : ''} />
                <span>{isDetectingApps ? 'Scanning...' : 'Re-scan'}</span>
              </button>
            </div>

            <select
              className="form-input"
              value={filters.application || 'ALL'}
              onChange={(e) => onChange({ ...filters, application: e.target.value })}
              style={{
                borderColor: filters.application && filters.application !== 'ALL' ? 'rgba(96, 165, 250, 0.6)' : undefined,
                background: filters.application && filters.application !== 'ALL' ? 'rgba(59, 130, 246, 0.08)' : undefined,
              }}
            >
              {structureInfo ? (
                structureInfo.type === 'single-application' ? (
                  <option value="ALL">
                    📁 1 Application: {filters.repo || 'Root Application'} (Root Folder)
                  </option>
                ) : (
                  <>
                    <option value="ALL">
                      📂 All Applications ({structureInfo.applicationsCount} Sub-folders)
                    </option>
                    {structureInfo.applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name} {app.path !== '.' ? `[📁 ${app.path}]` : ''}
                      </option>
                    ))}
                  </>
                )
              ) : (
                LGU_APPLICATIONS.map((app) => (
                  <option key={app.code} value={app.code}>
                    {app.label}
                  </option>
                ))
              )}
            </select>

            {/* Application Detection Status Badge */}
            {isDetectingApps && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: '#93c5fd',
                  fontSize: '0.73rem',
                  marginTop: '0.4rem',
                }}
              >
                <Loader2 size={12} className="spinner" />
                <span>Automatically identifying applications in repository...</span>
              </div>
            )}

            {!isDetectingApps && structureInfo && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  background:
                    structureInfo.type === 'single-application'
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(99, 102, 241, 0.12)',
                  border: `1px solid ${
                    structureInfo.type === 'single-application'
                      ? 'rgba(16, 185, 129, 0.3)'
                      : 'rgba(99, 102, 241, 0.3)'
                  }`,
                  color:
                    structureInfo.type === 'single-application'
                      ? '#34d399'
                      : '#a5b4fc',
                  fontSize: '0.73rem',
                  marginTop: '0.4rem',
                  lineHeight: '1.3',
                }}
              >
                {structureInfo.type === 'single-application' ? (
                  <>
                    <FolderGit2 size={13} color="#34d399" style={{ flexShrink: 0 }} />
                    <span>
                      <strong>1 Application Identified</strong>: Root Folder (Single Application)
                    </span>
                  </>
                ) : (
                  <>
                    <Layers size={13} color="#a5b4fc" style={{ flexShrink: 0 }} />
                    <span>
                      <strong>{structureInfo.applicationsCount} Applications Identified</strong> across sub-folders ({structureInfo.applications.map((a) => a.code).slice(0, 5).join(', ')}{structureInfo.applications.length > 5 ? `, +${structureInfo.applications.length - 5} more` : ''})
                    </span>
                  </>
                )}
              </div>
            )}

            {filters.application && filters.application !== 'ALL' && (
              <span style={{ fontSize: '0.72rem', color: '#93c5fd', marginTop: '0.3rem', display: 'block' }}>
                Targeting: <strong>{currentAppTitle}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="grid-cols-4" style={{ marginBottom: '1.5rem' }}>
          {/* Branch */}
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <GitFork size={14} /> Branch (optional)
              </span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. main or master"
              value={filters.branch || ''}
              onChange={(e) => onChange({ ...filters, branch: e.target.value })}
            />
          </div>

          {/* Author */}
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} /> Author (optional)
              </span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="All or GitHub username"
              value={filters.author || ''}
              onChange={(e) => onChange({ ...filters, author: e.target.value })}
            />
          </div>

          {/* Date From */}
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} /> Date From (optional)
              </span>
            </label>
            <input
              type="date"
              className="form-input"
              value={filters.since || ''}
              onChange={(e) => onChange({ ...filters, since: e.target.value })}
            />
          </div>

          {/* Date To */}
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} /> Date To (optional)
              </span>
            </label>
            <input
              type="date"
              className="form-input"
              value={filters.until || ''}
              onChange={(e) => onChange({ ...filters, until: e.target.value })}
            />
          </div>
        </div>

        {/* GitHub Personal Access Token (Friend's Token / Custom PAT) */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <KeyRound size={14} color="#f59e0b" /> GitHub Token (Optional / Friend's Token)
                </span>
              </label>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  background: filters.githubToken?.trim() ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: filters.githubToken?.trim() ? '#fbbf24' : 'var(--text-dim)',
                  border: `1px solid ${filters.githubToken?.trim() ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)'}`,
                }}
              >
                {filters.githubToken?.trim() ? 'Using Custom/Friend Token' : 'Using Server .env Token'}
              </span>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showToken ? 'text' : 'password'}
                className="form-input"
                style={{
                  paddingRight: '5rem',
                  fontFamily: filters.githubToken ? 'var(--font-mono)' : 'inherit',
                  borderColor: filters.githubToken?.trim() ? 'rgba(245, 158, 11, 0.5)' : undefined,
                  background: filters.githubToken?.trim() ? 'rgba(245, 158, 11, 0.03)' : undefined,
                }}
                placeholder="Paste token (e.g. ghp_... or github_pat_...) to use instead of server default"
                value={filters.githubToken || ''}
                onChange={(e) => onChange({ ...filters, githubToken: e.target.value })}
                autoComplete="off"
                spellCheck="false"
              />
              <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {filters.githubToken && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...filters, githubToken: '' })}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px',
                    }}
                    title="Clear custom token"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.25rem',
                    borderRadius: '4px',
                  }}
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.35rem', display: 'block' }}>
              💡 Your friend can paste their token here to access their private repos or utilize their own API rate limits without modifying the server <code>.env</code>.
            </span>
          </div>
        </div>

        {/* Ollama AI Consolidation Bar */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.875rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontWeight: 500,
                color: '#ffffff',
                fontSize: '0.875rem',
              }}
            >
              <input
                type="checkbox"
                checked={filters.useOllama !== false}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    useOllama: e.target.checked,
                  })
                }
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: '#8b5cf6',
                  cursor: 'pointer',
                }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Bot size={16} color="#c084fc" />
                Consolidate Commits with Ollama AI
              </span>
            </label>

            {filters.useOllama !== false && ollamaStatus?.models && ollamaStatus.models.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Model:</span>
                <select
                  className="form-input"
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.8rem',
                    height: 'auto',
                    minWidth: '130px',
                    borderColor: 'rgba(139, 92, 246, 0.4)',
                  }}
                  value={filters.ollamaModel || ollamaStatus.defaultModel}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      ollamaModel: e.target.value,
                    })
                  }
                >
                  {ollamaStatus.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
            {checkingOllama ? (
              <span style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Loader2 size={12} className="spinner" /> Checking Ollama...
              </span>
            ) : ollamaStatus?.available ? (
              <span
                style={{
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <CheckCircle2 size={13} />
                Ollama Active ({ollamaStatus.models.length} model{ollamaStatus.models.length !== 1 ? 's' : ''})
              </span>
            ) : (
              <span
                style={{
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                }}
                title="Start Ollama locally with 'ollama serve' to enable LLM consolidation"
              >
                <AlertCircle size={13} />
                Ollama Offline (Deterministic Fallback)
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ minWidth: '170px' }}
            >
              {isLoading ? (
                <>
                  <div className="spinner" />
                  <span>{loadingStep || 'Generating Report...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate Report</span>
                </>
              )}
            </button>

            {isLoading && (
              <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                {loadingStep}
              </span>
            )}
          </div>

          {hasReportData && (() => {
            const isMulti = structureInfo
              ? structureInfo.type === 'multi-application' || structureInfo.applicationsCount > 1
              : (filters.repo?.toLowerCase().includes('42system') ?? false);
            const isAllApps = !filters.application || filters.application === 'ALL';
            const isZipDownload = isMulti && isAllApps;

            return (
              <button
                type="button"
                className="btn btn-success"
                onClick={onDownloadExcel}
                disabled={isDownloading || isLoading}
                title={
                  isZipDownload
                    ? 'Download compressed ZIP archive containing individual Excel workbooks for all programs'
                    : 'Download evaluated Excel workbook'
                }
              >
                {isDownloading ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>{isZipDownload ? 'Compressing Programs (.zip)...' : 'Generating Excel...'}</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>{isZipDownload ? 'Download All Programs (.zip)' : 'Download Excel (.xlsx)'}</span>
                  </>
                )}
              </button>
            );
          })()}
        </div>
      </form>
    </div>
  );
};
