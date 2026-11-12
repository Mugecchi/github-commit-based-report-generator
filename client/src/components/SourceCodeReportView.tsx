import React, { useState, useEffect, useRef } from 'react';
import {
  Code2,
  FolderGit2,
  GitFork,
  KeyRound,
  Eye,
  EyeOff,
  Search,
  Download,
  Loader2,
  Archive,
  FileCode,
  Layers,
  ChevronDown,
  ChevronUp,
  Folder,
  HardDrive,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  SourceCodeDownloadParams,
  SourceCodeScanResult,
} from '../types/source-code.js';
import {
  scanSourceCodeRepositoryApi,
  downloadSourceCodeReportApi,
} from '../api/client.js';

interface SourceCodeReportViewProps {
  initialToken?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const SourceCodeReportView: React.FC<SourceCodeReportViewProps> = ({
  initialToken = '',
}) => {
  const [params, setParams] = useState<SourceCodeDownloadParams>(() => {
    const savedToken =
      initialToken ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('github_custom_token') || ''
        : '');
    return {
      owner: 'Mugecchi',
      repo: '42System',
      branch: 'main',
      githubToken: savedToken,
      srcOnly: true,
      includeLineNumbers: true,
      sourceType: 'github',
      localPath: '',
    };
  });

  const [showToken, setShowToken] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<SourceCodeScanResult | null>(null);
  const [downloadingTarget, setDownloadingTarget] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Dynamic progress bar state
  const [progress, setProgress] = useState<{
    active: boolean;
    type: 'scan' | 'download';
    title: string;
    stage: string;
    percent: number;
    stepIndex: number;
    elapsedSeconds: number;
    targetName?: string;
  }>({
    active: false,
    type: 'scan',
    title: '',
    stage: '',
    percent: 0,
    stepIndex: 0,
    elapsedSeconds: 0,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSourceTypeToggle = (type: 'github' | 'local') => {
    setParams((prev) => ({
      ...prev,
      sourceType: type,
      owner: type === 'local' ? 'local' : prev.owner === 'local' ? 'Mugecchi' : prev.owner,
      repo: type === 'local' ? 'commitreport_generator' : prev.repo === 'commitreport_generator' ? '42System' : prev.repo,
    }));
    setScanResult(null);
    setErrorMessage(null);
  };

  const handleQuickPreset = (preset: '42system' | 'local') => {
    if (preset === '42system') {
      setParams((prev) => ({
        ...prev,
        sourceType: 'github',
        owner: 'Mugecchi',
        repo: '42System',
        branch: 'main',
      }));
    } else {
      setParams((prev) => ({
        ...prev,
        sourceType: 'local',
        owner: 'local',
        repo: 'commitreport_generator',
        localPath: '',
      }));
    }
    setScanResult(null);
    setErrorMessage(null);
  };

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!params.owner?.trim() || !params.repo?.trim()) {
      setErrorMessage('Please specify repository owner and name.');
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    // Start progress animation
    let elapsed = 0;
    setProgress({
      active: true,
      type: 'scan',
      title: `Scanning ${params.owner}/${params.repo}...`,
      stage: 'Connecting to repository & inspecting git tree...',
      percent: 15,
      stepIndex: 0,
      elapsedSeconds: 0,
    });

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setProgress((prev) => {
        if (!prev.active) return prev;
        let nextPercent = prev.percent;
        let nextStage = prev.stage;
        let nextStep = prev.stepIndex;

        if (elapsed === 1) {
          nextPercent = 35;
          nextStep = 1;
          nextStage = 'Analyzing repository branches and detecting applications...';
        } else if (elapsed === 2) {
          nextPercent = 60;
          nextStep = 2;
          nextStage = 'Filtering source code files & mapping language extensions...';
        } else if (elapsed >= 4) {
          nextPercent = Math.min(92, prev.percent + 4);
          nextStep = 3;
          nextStage = 'Computing code metrics and organizing application structure...';
        }

        return {
          ...prev,
          percent: nextPercent,
          stage: nextStage,
          stepIndex: nextStep,
          elapsedSeconds: elapsed,
        };
      });
    }, 1000);

    try {
      if (params.githubToken) {
        localStorage.setItem('github_custom_token', params.githubToken.trim());
      }
      const result = await scanSourceCodeRepositoryApi(params);
      setScanResult(result);
      if (result.applications.length > 0) {
        setExpandedApp(result.applications[0].code);
      }

      // Complete progress bar
      setProgress((prev) => ({
        ...prev,
        percent: 100,
        stage: `Successfully scanned ${result.totalApplications} applications (${result.totalFiles} files)!`,
        stepIndex: 3,
      }));

      setTimeout(() => {
        setProgress((prev) => ({ ...prev, active: false }));
      }, 700);
    } catch (err: any) {
      console.error('Scan failed:', err);
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress((prev) => ({ ...prev, active: false }));

      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to scan repository. Please verify credentials and repository existence.';
      setErrorMessage(msg);
    } finally {
      setIsScanning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleDownload = async (appCode: string) => {
    setDownloadingTarget(appCode);
    setErrorMessage(null);
    setSuccessNotice(null);

    const isAll = appCode === 'ALL';
    const targetTitle = isAll
      ? 'All Applications (Compressed .ZIP)'
      : `${appCode} Word Document (.docx)`;

    let elapsed = 0;
    setProgress({
      active: true,
      type: 'download',
      title: `Compiling ${targetTitle}...`,
      stage: 'Ingesting repository files and preparing cache...',
      percent: 12,
      stepIndex: 0,
      elapsedSeconds: 0,
      targetName: targetTitle,
    });

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setProgress((prev) => {
        if (!prev.active) return prev;
        let nextPercent = prev.percent;
        let nextStage = prev.stage;
        let nextStep = prev.stepIndex;

        if (elapsed === 1) {
          nextPercent = 28;
          nextStep = 1;
          nextStage = 'Extracting code contents and analyzing syntax...';
        } else if (elapsed === 3) {
          nextPercent = 52;
          nextStep = 2;
          nextStage = 'Formatting Word (.docx) document with Consolas code styling & line numbers...';
        } else if (elapsed === 5) {
          nextPercent = 74;
          nextStep = 2;
          nextStage = 'Generating executive title page, metrics table & file index...';
        } else if (elapsed >= 7) {
          nextPercent = Math.min(94, prev.percent + 3);
          nextStep = 3;
          nextStage = isAll
            ? 'Packaging Word documents into compressed ZIP archive...'
            : 'Assembling document stream for download...';
        }

        return {
          ...prev,
          percent: nextPercent,
          stage: nextStage,
          stepIndex: nextStep,
          elapsedSeconds: elapsed,
        };
      });
    }, 1000);

    try {
      await downloadSourceCodeReportApi(
        {
          ...params,
          application: appCode,
        },
        (downloadPct) => {
          // If server streams content-length, track download transfer
          if (downloadPct > 0) {
            setProgress((prev) => ({
              ...prev,
              percent: Math.max(prev.percent, downloadPct),
              stage: `Streaming document download (${downloadPct}%)...`,
            }));
          }
        }
      );

      // Finish progress bar
      setProgress((prev) => ({
        ...prev,
        percent: 100,
        stage: 'Download started successfully!',
        stepIndex: 3,
      }));

      setSuccessNotice(
        `Successfully downloaded ${targetTitle}! Your document has been saved to your downloads folder.`
      );

      setTimeout(() => {
        setProgress((prev) => ({ ...prev, active: false }));
      }, 1000);
    } catch (err: any) {
      console.error('Download failed:', err);
      if (timerRef.current) clearInterval(timerRef.current);
      setProgress((prev) => ({ ...prev, active: false }));

      const msg =
        err.response?.data?.message ||
        err.message ||
        'Failed to generate and download source code document.';
      setErrorMessage(msg);
    } finally {
      setDownloadingTarget(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const scanSteps = [
    'Connect & Auth',
    'Application Discovery',
    'Source Filtering',
    'Metrics Analysis',
  ];

  const compileSteps = [
    'Fetch Source Cache',
    'Syntax Extraction',
    'Word (.docx) Formatting',
    'ZIP Packaging & Download',
  ];

  const currentSteps = progress.type === 'scan' ? scanSteps : compileSteps;

  return (
    <div style={{ marginBottom: '3rem' }}>
      {/* Top Banner Card */}
      <div
        className="glass-card"
        style={{
          padding: '1.75rem',
          marginBottom: '1.75rem',
          background:
            'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)',
          borderColor: 'rgba(139, 92, 246, 0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
                }}
              >
                <Code2 size={22} color="#ffffff" />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Application Source Code Compilation
              </h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '720px', lineHeight: 1.5 }}>
              Compiles source code into formatted Microsoft Word documents (<code style={{ color: '#c084fc' }}>.docx</code>)
              for each application within your repository. Automatically bundles multi-application
              repositories into a compressed <code style={{ color: '#c084fc' }}>.ZIP</code> archive containing one Word document per program.
            </p>
          </div>

          {/* Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Presets:</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', borderRadius: '6px' }}
              onClick={() => handleQuickPreset('42system')}
            >
              42System (GitHub)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', borderRadius: '6px' }}
              onClick={() => handleQuickPreset('local')}
            >
              Current Workspace (Local)
            </button>
          </div>
        </div>
      </div>

      {/* DYNAMIC PROGRESS BAR CARD */}
      {progress.active && (
        <div
          className="glass-card"
          style={{
            padding: '1.5rem',
            marginBottom: '1.75rem',
            background:
              'linear-gradient(135deg, rgba(139, 92, 246, 0.16) 0%, rgba(59, 130, 246, 0.12) 100%)',
            borderColor: 'rgba(139, 92, 246, 0.45)',
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.25)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Header row: title + elapsed time */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Loader2 size={18} className="animate-spin" color="#c084fc" />
              <strong style={{ fontSize: '1rem', color: '#ffffff' }}>
                {progress.title}
              </strong>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '0.25rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <Clock size={13} color="#60a5fa" />
              <span>Elapsed: {formatSeconds(progress.elapsedSeconds)}</span>
            </div>
          </div>

          {/* VISUAL PROGRESS BAR TRACK */}
          <div
            style={{
              position: 'relative',
              height: '14px',
              width: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '7px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              marginBottom: '0.75rem',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(5, progress.percent))}%`,
                background:
                  'linear-gradient(90deg, #8b5cf6 0%, #3b82f6 50%, #10b981 100%)',
                borderRadius: '7px',
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 14px rgba(139, 92, 246, 0.7)',
                position: 'relative',
              }}
            />
          </div>

          {/* Progress percent + stage description */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              gap: '1rem',
            }}
          >
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={14} color="#c084fc" />
              <span>{progress.stage}</span>
            </span>

            <span
              style={{
                fontWeight: 700,
                color: '#ffffff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
              }}
            >
              {progress.percent}%
            </span>
          </div>

          {/* Step indicators */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${currentSteps.length}, 1fr)`,
              gap: '0.5rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {currentSteps.map((step, idx) => {
              const isDone = progress.stepIndex > idx || progress.percent >= 100;
              const isCurrent = progress.stepIndex === idx && progress.percent < 100;

              return (
                <div
                  key={step}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.75rem',
                    color: isDone ? '#34d399' : isCurrent ? '#c084fc' : 'var(--text-dim)',
                    fontWeight: isCurrent || isDone ? 600 : 400,
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 size={13} color="#34d399" />
                  ) : isCurrent ? (
                    <Loader2 size={13} className="animate-spin" color="#c084fc" />
                  ) : (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--text-dim)',
                        opacity: 0.5,
                      }}
                    />
                  )}
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successNotice && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1.25rem',
            color: '#6ee7b7',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={18} color="#10b981" />
            <span>{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6ee7b7',
              cursor: 'pointer',
              fontSize: '0.8rem',
              textDecoration: 'underline',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1.25rem',
            color: '#fca5a5',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={18} color="#ef4444" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fca5a5',
              cursor: 'pointer',
              fontSize: '0.8rem',
              textDecoration: 'underline',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Configuration Form Card */}
      <div className="glass-card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
        <form onSubmit={handleScan}>
          {/* Source Type Toggle */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Repository Source
            </label>
            <div
              style={{
                display: 'inline-flex',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '0.3rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                gap: '0.25rem',
              }}
            >
              <button
                type="button"
                id="source-type-github-btn"
                onClick={() => handleSourceTypeToggle('github')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background:
                    params.sourceType === 'github'
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
                      : 'transparent',
                  color: params.sourceType === 'github' ? '#ffffff' : 'var(--text-muted)',
                  boxShadow:
                    params.sourceType === 'github' ? '0 2px 8px rgba(139, 92, 246, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <FolderGit2 size={15} />
                <span>GitHub Repository</span>
              </button>

              <button
                type="button"
                id="source-type-local-btn"
                onClick={() => handleSourceTypeToggle('local')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background:
                    params.sourceType === 'local'
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
                      : 'transparent',
                  color: params.sourceType === 'local' ? '#ffffff' : 'var(--text-muted)',
                  boxShadow:
                    params.sourceType === 'local' ? '0 2px 8px rgba(139, 92, 246, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <HardDrive size={15} />
                <span>Local Workspace</span>
              </button>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                params.sourceType === 'github' ? 'repeat(auto-fit, minmax(210px, 1fr))' : '1fr 1fr',
              gap: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            {params.sourceType === 'github' ? (
              <>
                {/* Owner */}
                <div>
                  <label
                    htmlFor="source-owner-input"
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Owner / Organization *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <FolderGit2
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-dim)',
                      }}
                    />
                    <input
                      id="source-owner-input"
                      type="text"
                      className="input-field"
                      style={{ paddingLeft: '2.5rem' }}
                      value={params.owner}
                      onChange={(e) => setParams({ ...params, owner: e.target.value })}
                      placeholder="e.g. Mugecchi"
                      required
                    />
                  </div>
                </div>

                {/* Repo */}
                <div>
                  <label
                    htmlFor="source-repo-input"
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Repository Name *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <FolderGit2
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-dim)',
                      }}
                    />
                    <input
                      id="source-repo-input"
                      type="text"
                      className="input-field"
                      style={{ paddingLeft: '2.5rem' }}
                      value={params.repo}
                      onChange={(e) => setParams({ ...params, repo: e.target.value })}
                      placeholder="e.g. 42System"
                      required
                    />
                  </div>
                </div>

                {/* Branch */}
                <div>
                  <label
                    htmlFor="source-branch-input"
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Branch / Ref
                  </label>
                  <div style={{ position: 'relative' }}>
                    <GitFork
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-dim)',
                      }}
                    />
                    <input
                      id="source-branch-input"
                      type="text"
                      className="input-field"
                      style={{ paddingLeft: '2.5rem' }}
                      value={params.branch || ''}
                      onChange={(e) => setParams({ ...params, branch: e.target.value })}
                      placeholder="main"
                    />
                  </div>
                </div>

                {/* GitHub Token */}
                <div>
                  <label
                    htmlFor="source-token-input"
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    GitHub PAT (Optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-dim)',
                      }}
                    />
                    <input
                      id="source-token-input"
                      type={showToken ? 'text' : 'password'}
                      className="input-field"
                      style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                      value={params.githubToken || ''}
                      onChange={(e) => setParams({ ...params, githubToken: e.target.value })}
                      placeholder="ghp_xxxx..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Local Repo Label */}
                <div>
                  <label
                    htmlFor="local-repo-label-input"
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Project Identifier / Folder Name *
                  </label>
                  <input
                    id="local-repo-label-input"
                    type="text"
                    className="input-field"
                    value={params.repo}
                    onChange={(e) => setParams({ ...params, repo: e.target.value })}
                    placeholder="e.g. commitreport_generator"
                    required
                  />
                </div>

                {/* Local Workspace Path (Optional override) */}
                <div>
                  <label
                    htmlFor="local-path-override-input"
                    style={{
                      display: 'block',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Custom Directory Path (Leave blank for current workspace)
                  </label>
                  <input
                    id="local-path-override-input"
                    type="text"
                    className="input-field"
                    value={params.localPath || ''}
                    onChange={(e) => setParams({ ...params, localPath: e.target.value })}
                    placeholder="e.g. /home/muge/Desktop/commitreport generator"
                  />
                </div>
              </>
            )}
          </div>

          {/* Configuration Toggles */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2rem',
              flexWrap: 'wrap',
              marginBottom: '1.75rem',
              padding: '0.75rem 1rem',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--text-main)',
              }}
            >
              <input
                id="source-src-only-checkbox"
                type="checkbox"
                checked={params.srcOnly !== false}
                onChange={(e) => setParams({ ...params, srcOnly: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#8b5cf6' }}
              />
              <span>
                <strong>Only <code style={{ color: '#c084fc' }}>src/</code> source files</strong>
                <span style={{ color: 'var(--text-dim)', marginLeft: '0.4rem', fontSize: '0.8rem' }}>
                  (Excludes lockfiles, bundles, build artifacts, and root docs)
                </span>
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--text-main)',
              }}
            >
              <input
                id="source-line-numbers-checkbox"
                type="checkbox"
                checked={params.includeLineNumbers !== false}
                onChange={(e) => setParams({ ...params, includeLineNumbers: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#8b5cf6' }}
              />
              <span>
                <strong>Include Line Numbers</strong>
                <span style={{ color: 'var(--text-dim)', marginLeft: '0.4rem', fontSize: '0.8rem' }}>
                  (Numbered code blocks in Word doc)
                </span>
              </span>
            </label>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              id="scan-source-repo-btn"
              type="submit"
              disabled={isScanning || downloadingTarget !== null}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
                padding: '0.75rem 1.5rem',
                fontSize: '0.9rem',
              }}
            >
              {isScanning ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Scanning Repository Structure...</span>
                </>
              ) : (
                <>
                  <Search size={18} />
                  <span>Scan Applications & Files</span>
                </>
              )}
            </button>

            {/* Direct Quick Download All button */}
            <button
              id="quick-download-all-zip-btn"
              type="button"
              disabled={isScanning || downloadingTarget !== null}
              onClick={() => handleDownload('ALL')}
              className="btn btn-secondary"
              style={{
                borderColor: 'rgba(139, 92, 246, 0.4)',
                padding: '0.75rem 1.25rem',
                fontSize: '0.9rem',
              }}
            >
              {downloadingTarget === 'ALL' ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Compiling All Documents (.ZIP)...</span>
                </>
              ) : (
                <>
                  <Archive size={18} color="#a855f7" />
                  <span>Download All Applications (.ZIP)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Scanned Results & Applications Explorer */}
      {scanResult && (
        <div>
          {/* Summary Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.75rem',
            }}
          >
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c084fc', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                <Layers size={18} />
                <span>Applications Found</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff' }}>
                {scanResult.totalApplications}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                {scanResult.structureType === 'multi-application' ? 'Multi-Application Monorepo' : 'Single Application'}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                <FileCode size={18} />
                <span>Total Source Files</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff' }}>
                {scanResult.totalFiles}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                Matching source code extensions
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                <Code2 size={18} />
                <span>Estimated Lines</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff' }}>
                {scanResult.totalEstimatedLines.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                Lines of code to compile
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                <HardDrive size={18} />
                <span>Source Code Size</span>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffffff' }}>
                {formatBytes(scanResult.totalSize)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                Raw source byte total
              </div>
            </div>
          </div>

          {/* Master Download Action Banner */}
          <div
            className="glass-card"
            style={{
              padding: '1.5rem',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.25rem',
              flexWrap: 'wrap',
              background:
                'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)',
              borderColor: 'rgba(139, 92, 246, 0.35)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Archive size={20} color="#c084fc" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                  Download Complete Multi-Application Compilation (.ZIP)
                </h3>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Generates a distinct Microsoft Word document (<code style={{ color: '#c084fc' }}>.docx</code>) for
                each of the <strong>{scanResult.totalApplications} detected applications</strong> and bundles them into a single compressed ZIP archive.
              </p>
            </div>

            <button
              id="download-master-zip-btn"
              type="button"
              disabled={downloadingTarget !== null}
              onClick={() => handleDownload('ALL')}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 16px rgba(139, 92, 246, 0.45)',
                padding: '0.8rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 700,
              }}
            >
              {downloadingTarget === 'ALL' ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Packaging & Compiling Documents...</span>
                </>
              ) : (
                <>
                  <Download size={20} />
                  <span>Download All as .ZIP Archive</span>
                </>
              )}
            </button>
          </div>

          {/* Application Breakdown List */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Layers size={18} color="#c084fc" />
              <span>Applications ({scanResult.applications.length})</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {scanResult.applications.map((app) => {
                const isExpanded = expandedApp === app.code;
                const isDownloadingThis = downloadingTarget === app.code;

                return (
                  <div
                    key={app.code}
                    className="glass-card"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderColor: isExpanded ? 'rgba(139, 92, 246, 0.4)' : 'var(--border-color)',
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* App Title & Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div
                          style={{
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#c084fc',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {app.code}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '1rem' }}>
                            {app.name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                            {app.fullName} {app.path && app.path !== '.' ? `• Directory: ${app.path}` : ''}
                          </div>
                        </div>
                      </div>

                      {/* App Stats & Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <div>
                            <strong style={{ color: '#ffffff' }}>{app.fileCount}</strong> files
                          </div>
                          <div>
                            <strong style={{ color: '#ffffff' }}>{app.estimatedLines.toLocaleString()}</strong> lines
                          </div>
                          <div>
                            <strong style={{ color: '#ffffff' }}>{formatBytes(app.totalSize)}</strong>
                          </div>
                        </div>

                        {/* Language Badges */}
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {Object.entries(app.languageStats)
                            .slice(0, 3)
                            .map(([lang, count]) => (
                              <span
                                key={lang}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  color: 'var(--text-muted)',
                                  border: '1px solid var(--border-color)',
                                }}
                              >
                                {lang} ({count})
                              </span>
                            ))}
                        </div>

                        {/* Download Single App Button */}
                        <button
                          type="button"
                          id={`download-app-${app.code}-docx-btn`}
                          disabled={downloadingTarget !== null}
                          onClick={() => handleDownload(app.code)}
                          className="btn btn-secondary"
                          style={{
                            padding: '0.45rem 0.9rem',
                            fontSize: '0.82rem',
                            gap: '0.4rem',
                          }}
                        >
                          {isDownloadingThis ? (
                            <>
                              <Loader2 size={15} className="animate-spin" />
                              <span>Compiling...</span>
                            </>
                          ) : (
                            <>
                              <FileText size={15} color="#60a5fa" />
                              <span>Download .docx</span>
                            </>
                          )}
                        </button>

                        {/* Expand / Collapse Button */}
                        <button
                          type="button"
                          onClick={() => setExpandedApp(isExpanded ? null : app.code)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0.2rem',
                          }}
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable File List */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: '1.25rem',
                          paddingTop: '1rem',
                          borderTop: '1px solid var(--border-color)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            marginBottom: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          <Folder size={14} color="#c084fc" />
                          <span>Compiled Files for {app.code} ({app.files.length} items):</span>
                        </div>

                        <div
                          style={{
                            maxHeight: '220px',
                            overflowY: 'auto',
                            background: 'rgba(0, 0, 0, 0.25)',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            padding: '0.5rem',
                          }}
                        >
                          {app.files.map((file, idx) => (
                            <div
                              key={file.path || idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.35rem 0.6rem',
                                fontSize: '0.8rem',
                                borderRadius: '4px',
                                background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                                <FileCode size={13} color="var(--text-dim)" />
                                <span style={{ color: 'var(--text-main)' }}>{file.path}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                <span>{file.language}</span>
                                <span>{formatBytes(file.size)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
