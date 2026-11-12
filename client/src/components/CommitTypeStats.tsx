import React from 'react';
import { Tag } from 'lucide-react';
import { ReportCommitTypeBreakdown } from '../types/report.js';

interface CommitTypeStatsProps {
  types: ReportCommitTypeBreakdown;
  totalCommits: number;
}

export const CommitTypeStats: React.FC<CommitTypeStatsProps> = ({ types, totalCommits }) => {
  const getPercentage = (count: number) => {
    if (totalCommits === 0) return 0;
    return Math.round((count / totalCommits) * 100);
  };

  const categories = [
    { label: 'Features', key: 'features', count: types.features, color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', badgeClass: 'badge-feat' },
    { label: 'Bug Fixes', key: 'fixes', count: types.fixes, color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', badgeClass: 'badge-fix' },
    { label: 'Refactors', key: 'refactors', count: types.refactors, color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.15)', badgeClass: 'badge-refactor' },
    { label: 'Documentation', key: 'documentation', count: types.documentation, color: '#22d3ee', bg: 'rgba(6, 182, 212, 0.15)', badgeClass: 'badge-docs' },
    { label: 'Tests', key: 'tests', count: types.tests, color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', badgeClass: 'badge-test' },
    { label: 'Chores', key: 'chores', count: types.chores, color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', badgeClass: 'badge-chore' },
    { label: 'Performance', key: 'perf', count: types.perf, color: '#f472b6', bg: 'rgba(236, 72, 153, 0.15)', badgeClass: 'badge-perf' },
    { label: 'Other', key: 'other', count: types.other, color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', badgeClass: 'badge-other' },
  ];

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag size={18} color="#8b5cf6" />
          <span>Conventional Commit Distribution</span>
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {totalCommits} Total Commits Classified
        </span>
      </div>

      {/* Multi-segment progress bar */}
      <div
        style={{
          display: 'flex',
          height: '10px',
          borderRadius: '9999px',
          overflow: 'hidden',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          marginBottom: '1.25rem',
        }}
      >
        {categories.map((cat) => {
          const pct = getPercentage(cat.count);
          if (pct === 0) return null;
          return (
            <div
              key={cat.key}
              style={{
                width: `${pct}%`,
                backgroundColor: cat.color,
                transition: 'width 0.4s ease',
              }}
              title={`${cat.label}: ${cat.count} (${pct}%)`}
            />
          );
        })}
      </div>

      {/* Grid of category chips */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {categories.map((cat) => {
          const pct = getPercentage(cat.count);
          return (
            <div
              key={cat.key}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`badge ${cat.badgeClass}`}>{cat.label}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{pct}%</span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {cat.count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
