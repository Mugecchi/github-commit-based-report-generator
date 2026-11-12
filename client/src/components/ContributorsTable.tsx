import React from 'react';
import { Users, Award } from 'lucide-react';
import { ContributorStats } from '../types/report.js';

interface ContributorsTableProps {
  contributors: ContributorStats[];
  totalCommits: number;
}

export const ContributorsTable: React.FC<ContributorsTableProps> = ({ contributors, totalCommits }) => {
  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={18} color="#8b5cf6" />
          <span>Contributors Leaderboard ({contributors.length})</span>
        </h3>
      </div>

      <div className="table-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>#</th>
              <th>Contributor</th>
              <th>Email</th>
              <th style={{ textAlign: 'center' }}>Commits</th>
              <th style={{ width: '150px' }}>Contribution Share</th>
              <th style={{ textAlign: 'right' }}>Additions (+)</th>
              <th style={{ textAlign: 'right' }}>Deletions (-)</th>
              <th style={{ textAlign: 'center' }}>Files Changed</th>
            </tr>
          </thead>
          <tbody>
            {contributors.map((c, index) => {
              const pct = totalCommits > 0 ? Math.round((c.commits / totalCommits) * 100) : 0;
              return (
                <tr key={c.author}>
                  {/* Rank */}
                  <td>
                    {index === 0 ? (
                      <Award size={18} color="#fbbf24" />
                    ) : index === 1 ? (
                      <Award size={18} color="#94a3b8" />
                    ) : index === 2 ? (
                      <Award size={18} color="#d97706" />
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{index + 1}</span>
                    )}
                  </td>

                  {/* Name */}
                  <td style={{ fontWeight: 600, color: '#ffffff' }}>
                    {c.author}
                  </td>

                  {/* Email */}
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                    {c.authorEmail || '—'}
                  </td>

                  {/* Commits */}
                  <td style={{ textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {c.commits}
                  </td>

                  {/* Share Progress Bar */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          flex: 1,
                          height: '6px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '9999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', width: '30px' }}>
                        {pct}%
                      </span>
                    </div>
                  </td>

                  {/* Additions */}
                  <td style={{ textAlign: 'right' }}>
                    <span className="stat-add">+{c.additions.toLocaleString()}</span>
                  </td>

                  {/* Deletions */}
                  <td style={{ textAlign: 'right' }}>
                    <span className="stat-del">-{c.deletions.toLocaleString()}</span>
                  </td>

                  {/* Files Changed */}
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {c.filesChanged.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
