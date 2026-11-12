import React, { useState } from 'react';
import { ExternalLink, Files, Search } from 'lucide-react';
import { ConventionalCommitType, ReportCommit } from '../types/report.js';

interface CommitTableProps {
  commits: ReportCommit[];
  onSelectCommit: (commit: ReportCommit) => void;
}

export const CommitTable: React.FC<CommitTableProps> = ({ commits, onSelectCommit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const filteredCommits = commits.filter((c) => {
    const matchesSearch =
      c.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.shortSha.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.scope && c.scope.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = selectedType === 'ALL' || c.type === selectedType;

    return matchesSearch && matchesType;
  });

  const commitTypes: ConventionalCommitType[] = [
    'feat',
    'fix',
    'refactor',
    'docs',
    'test',
    'chore',
    'perf',
    'other',
  ];

  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          Commits ({filteredCommits.length} of {commits.length})
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', width: '240px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Search commits, authors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2rem', fontSize: '0.8125rem' }}
            />
          </div>

          {/* Type filter */}
          <select
            className="form-input"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ width: '130px', fontSize: '0.8125rem' }}
          >
            <option value="ALL">All Types</option>
            {commitTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Date (UTC)</th>
              <th>Author</th>
              <th>Type</th>
              <th>Scope</th>
              <th>Commit</th>
              <th style={{ textAlign: 'center' }}>Files</th>
              <th style={{ textAlign: 'right' }}>+ / -</th>
              <th style={{ textAlign: 'right' }}>SHA</th>
            </tr>
          </thead>
          <tbody>
            {filteredCommits.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                  No commits match the selected filters.
                </td>
              </tr>
            ) : (
              filteredCommits.map((c) => (
                <tr key={c.sha}>
                  {/* Date */}
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {c.date ? c.date.substring(0, 10) : ''}
                  </td>

                  {/* Author */}
                  <td style={{ fontWeight: 500, whiteSpace: 'nowrap', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.author}
                  </td>

                  {/* Type */}
                  <td>
                    <span className={`badge badge-${c.type}`}>
                      {c.type}
                    </span>
                  </td>

                  {/* Scope */}
                  <td>
                    {c.scope ? (
                      <span className="badge badge-scope">{c.scope}</span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>—</span>
                    )}
                  </td>

                  {/* Commit Subject */}
                  <td style={{ minWidth: '240px', maxWidth: '480px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      {c.isBreaking && <span className="badge badge-breaking" style={{ flexShrink: 0, marginTop: '2px' }}>BREAKING</span>}
                      <span
                        style={{
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          color: '#ffffff',
                          fontWeight: 500,
                          lineHeight: 1.45,
                        }}
                        title={c.message}
                      >
                        {c.subject || c.message.split('\n')[0]}
                      </span>
                    </div>
                  </td>

                  {/* Files Changed */}
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onSelectCommit(c)}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem' }}
                      title="View changed files list"
                    >
                      <Files size={12} />
                      <span>{c.filesChanged}</span>
                    </button>
                  </td>

                  {/* Additions / Deletions */}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span className="stat-add">+{c.additions}</span>
                    <span style={{ color: 'var(--text-dim)', margin: '0 3px' }}>/</span>
                    <span className="stat-del">-{c.deletions}</span>
                  </td>

                  {/* SHA link */}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary font-mono"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.3rem', color: '#60a5fa' }}
                    >
                      <span>{c.shortSha}</span>
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
