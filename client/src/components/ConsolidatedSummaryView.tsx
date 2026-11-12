import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Cpu,
  Layers,
  Bug,
  Wrench,
  FileCode2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ConsolidatedCommitReport,
  ConsolidatedFeature,
  ConsolidatedIssue,
  ConsolidatedMaintenance,
  ConsolidatedRefactor,
  ReportCommit,
} from '../types/report.js';

interface ConsolidatedSummaryViewProps {
  consolidated: ConsolidatedCommitReport;
  commits: ReportCommit[];
  onSelectCommit?: (commit: ReportCommit) => void;
}

export const ConsolidatedSummaryView: React.FC<ConsolidatedSummaryViewProps> = ({
  consolidated,
  commits,
  onSelectCommit,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'features' | 'issues' | 'refactors' | 'maintenance'>('features');
  const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({});

  const toggleIssue = (id: string) => {
    setExpandedIssues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'badge-breaking';
      case 'high':
        return 'badge-fix';
      case 'low':
        return 'badge-docs';
      default:
        return 'badge-chore';
    }
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low':
        return '#10b981';
      case 'high':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  };

  const findCommitBySha = (sha: string) => {
    return commits.find(
      (c) =>
        c.shortSha.toLowerCase() === sha.toLowerCase() ||
        c.sha.toLowerCase().startsWith(sha.toLowerCase())
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
      {/* Engine & Status Bar */}
      <div
        className="glass-card"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(17, 24, 39, 0.85) 100%)',
          borderLeft: '4px solid #8b5cf6',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc',
            }}
          >
            {consolidated.generatedBy === 'ollama' ? <Sparkles size={20} /> : <Cpu size={20} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
                Consolidated Commit Intelligence
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.6rem',
                  borderRadius: '12px',
                  background:
                    consolidated.generatedBy === 'ollama'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(156, 163, 175, 0.2)',
                  color: consolidated.generatedBy === 'ollama' ? '#34d399' : '#d1d5db',
                  border: `1px solid ${
                    consolidated.generatedBy === 'ollama' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(156, 163, 175, 0.3)'
                  }`,
                  fontWeight: 500,
                }}
              >
                {consolidated.generatedBy === 'ollama'
                  ? `Ollama AI: ${consolidated.modelUsed || 'qwen2.5:7B'}`
                  : 'Deterministic Engine'}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Synthesized and consolidated across {commits.length} commit message(s)
            </p>
          </div>
        </div>

        {/* Quality pill badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
            }}
          >
            <ShieldCheck size={16} color="#34d399" />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score:</span>
            <strong style={{ fontSize: '0.85rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
              {consolidated.qualityAssessment.score}
            </strong>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
            }}
          >
            <AlertTriangle size={16} color={getRiskBadgeColor(consolidated.qualityAssessment.risk)} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Risk:</span>
            <strong
              style={{
                fontSize: '0.85rem',
                color: getRiskBadgeColor(consolidated.qualityAssessment.risk),
              }}
            >
              {consolidated.qualityAssessment.risk}
            </strong>
          </div>
        </div>
      </div>

      {/* Executive Summary Card */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h4
          style={{
            fontSize: '0.95rem',
            color: '#93c5fd',
            marginBottom: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Sparkles size={16} /> Executive Summary
        </h4>
        <p
          style={{
            fontSize: '0.95rem',
            lineHeight: 1.7,
            color: '#e5e7eb',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid #3b82f6',
          }}
        >
          {consolidated.executiveSummary}
        </p>

        {/* Key Achievements & Recommendations */}
        <div className="grid-cols-2" style={{ marginTop: '1.25rem', gap: '1rem' }}>
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.04)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
            }}
          >
            <h5
              style={{
                fontSize: '0.85rem',
                color: '#34d399',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <CheckCircle2 size={15} /> Key Delivery Milestones
            </h5>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#d1d5db', lineHeight: 1.6 }}>
              {consolidated.qualityAssessment.keyAchievements.map((ach, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>
                  {ach}
                </li>
              ))}
            </ul>
          </div>

          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.04)',
              border: '1px solid rgba(245, 158, 11, 0.15)',
            }}
          >
            <h5
              style={{
                fontSize: '0.85rem',
                color: '#fbbf24',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Lightbulb size={15} /> Audit & Operational Guidance
            </h5>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#d1d5db', lineHeight: 1.6 }}>
              {consolidated.qualityAssessment.recommendations.map((rec, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Sub-tabs for Categorized Deliverables */}
      <div className="tabs-nav" style={{ margin: '0' }}>
        <button
          className={`tab-btn ${activeSubTab === 'features' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('features')}
        >
          <Layers size={16} />
          <span>Consolidated Features ({consolidated.features.length})</span>
        </button>
        <button
          className={`tab-btn ${activeSubTab === 'issues' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('issues')}
        >
          <Bug size={16} />
          <span>Resolved Issues & Actions ({consolidated.issues.length})</span>
        </button>
        <button
          className={`tab-btn ${activeSubTab === 'refactors' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('refactors')}
        >
          <FileCode2 size={16} />
          <span>Refactoring ({consolidated.refactors.length})</span>
        </button>
        <button
          className={`tab-btn ${activeSubTab === 'maintenance' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('maintenance')}
        >
          <Wrench size={16} />
          <span>Maintenance & CI ({consolidated.maintenance.length})</span>
        </button>
      </div>

      {/* Features Tab */}
      {activeSubTab === 'features' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {consolidated.features.length === 0 ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              No features identified in this commit range.
            </div>
          ) : (
            consolidated.features.map((feat: ConsolidatedFeature, idx: number) => (
              <div
                key={idx}
                className="glass-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderLeft: '4px solid #3b82f6',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span className="badge badge-feat">FEATURE</span>
                    <span className="badge badge-scope">{feat.module}</span>
                    <h4 style={{ fontSize: '1.05rem', color: '#ffffff' }}>{feat.title}</h4>
                  </div>

                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Consolidates <strong>{feat.commitsCount}</strong> commit{feat.commitsCount !== 1 ? 's' : ''}
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', color: '#d1d5db', lineHeight: 1.6 }}>
                  {feat.description}
                </p>

                {feat.commitShas.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Linked Commits:</span>
                    {feat.commitShas.map((sha, sIdx) => {
                      const commitObj = findCommitBySha(sha);
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => commitObj && onSelectCommit?.(commitObj)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            padding: '0.15rem 0.5rem',
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-mono)',
                            color: '#93c5fd',
                            cursor: commitObj ? 'pointer' : 'default',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                          title={commitObj ? `View files for ${sha}` : sha}
                        >
                          <span>{sha}</span>
                          {commitObj && <ExternalLink size={10} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Issues & Actions Tab */}
      {activeSubTab === 'issues' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {consolidated.issues.length === 0 ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              No defects or fix commits recorded in this period.
            </div>
          ) : (
            consolidated.issues.map((iss: ConsolidatedIssue) => {
              const isExpanded = Boolean(expandedIssues[iss.issueId]);
              return (
                <div
                  key={iss.issueId}
                  className="glass-card"
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderLeft: `4px solid ${iss.priority === 'Critical' ? '#ef4444' : '#f59e0b'}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleIssue(iss.issueId)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#ffffff',
                          fontWeight: 700,
                        }}
                      >
                        {iss.issueId}
                      </span>
                      <span className={`badge ${getPriorityBadgeClass(iss.priority)}`}>
                        {iss.priority}
                      </span>
                      <span className="badge badge-scope">{iss.module}</span>
                      <h4 style={{ fontSize: '1rem', color: '#ffffff' }}>
                        {iss.title || iss.issueImpact}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="badge badge-test">Verified: {iss.retestResult || 'Passed'}</span>
                      {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                    </div>
                  </div>

                  {/* Always visible quick summary */}
                  <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#d1d5db' }}>
                    <strong>Action Taken:</strong> {iss.actionTaken}
                  </div>

                  {/* Expandable details */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border-color)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '1rem',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '0.25rem' }}>
                          Root Cause / Underlying Basis:
                        </span>
                        <p style={{ color: '#f3f4f6' }}>{iss.rootCause}</p>
                      </div>

                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <span style={{ color: 'var(--text-dim)', display: 'block', marginBottom: '0.25rem' }}>
                          Follow-up & Verification Required:
                        </span>
                        <p style={{ color: '#f3f4f6' }}>{iss.needsToBeDone}</p>
                      </div>
                    </div>
                  )}

                  {/* Linked Commits */}
                  {iss.commitShas.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Patch Commits:</span>
                      {iss.commitShas.map((sha, sIdx) => {
                        const commitObj = findCommitBySha(sha);
                        return (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => commitObj && onSelectCommit?.(commitObj)}
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              padding: '0.15rem 0.5rem',
                              fontSize: '0.75rem',
                              fontFamily: 'var(--font-mono)',
                              color: '#f87171',
                              cursor: commitObj ? 'pointer' : 'default',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                            title={commitObj ? `View files for ${sha}` : sha}
                          >
                            <span>{sha}</span>
                            {commitObj && <ExternalLink size={10} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Refactorings Tab */}
      {activeSubTab === 'refactors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {consolidated.refactors.length === 0 ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              No major refactorings recorded in this commit period.
            </div>
          ) : (
            consolidated.refactors.map((refactor: ConsolidatedRefactor, idx: number) => (
              <div
                key={idx}
                className="glass-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderLeft: '4px solid #8b5cf6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                  <span className="badge badge-refactor">REFACTOR</span>
                  <span className="badge badge-scope">{refactor.module}</span>
                  <h4 style={{ fontSize: '1rem', color: '#ffffff' }}>{refactor.title}</h4>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#d1d5db', lineHeight: 1.6 }}>
                  {refactor.description}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Maintenance & CI Tab */}
      {activeSubTab === 'maintenance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {consolidated.maintenance.length === 0 ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              No maintenance or CI changes recorded in this period.
            </div>
          ) : (
            consolidated.maintenance.map((maint: ConsolidatedMaintenance, idx: number) => (
              <div
                key={idx}
                className="glass-card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderLeft: '4px solid #f59e0b',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                  <span className="badge badge-chore">MAINTENANCE</span>
                  <h4 style={{ fontSize: '1rem', color: '#ffffff' }}>{maint.title}</h4>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#d1d5db', lineHeight: 1.6 }}>
                  {maint.description}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
