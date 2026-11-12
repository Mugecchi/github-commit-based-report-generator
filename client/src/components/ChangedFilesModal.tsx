import React from 'react';
import { X, FileCode, ExternalLink } from 'lucide-react';
import { ReportCommit } from '../types/report.js';

interface ChangedFilesModalProps {
  commit: ReportCommit | null;
  onClose: () => void;
}

export const ChangedFilesModal: React.FC<ChangedFilesModalProps> = ({ commit, onClose }) => {
  if (!commit) return null;

  const files = commit.changedFiles || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <span className={`badge badge-${commit.type}`}>{commit.type}</span>
              {commit.scope && <span className="badge badge-scope">({commit.scope})</span>}
              <code style={{ fontSize: '0.85rem', color: '#60a5fa' }}>{commit.shortSha}</code>
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{commit.subject}</h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>
              <strong>{files.length}</strong> file{files.length !== 1 ? 's' : ''} changed
            </span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <span className="stat-add">+{commit.additions}</span>
              <span className="stat-del">-{commit.deletions}</span>
              <a
                href={commit.url}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#60a5fa' }}
              >
                GitHub <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {files.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No individual file diff details recorded for this commit.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {files.map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <FileCode size={15} color="var(--text-dim)" />
                    <span style={{ wordBreak: 'break-all', color: 'var(--text-main)' }}>{f.filename}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        background:
                          f.status === 'added'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : f.status === 'deleted'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(59, 130, 246, 0.2)',
                        color:
                          f.status === 'added'
                            ? '#34d399'
                            : f.status === 'deleted'
                            ? '#f87171'
                            : '#60a5fa',
                      }}
                    >
                      {f.status}
                    </span>
                    <span className="stat-add">+{f.additions}</span>
                    <span className="stat-del">-{f.deletions}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
