import React from 'react';
import { GitCommit, Users, FileCode2, PlusCircle, MinusCircle } from 'lucide-react';
import { ReportSummary } from '../types/report.js';

interface SummaryCardsProps {
  summary: ReportSummary;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {


  const cards = [
    {
      label: 'Total Commits',
      value: summary.totalCommits.toLocaleString(),
      icon: GitCommit,
      color: '#3b82f6',
      bgGlow: 'rgba(59, 130, 246, 0.15)',
    },
    {
      label: 'Contributors',
      value: summary.contributors.toLocaleString(),
      icon: Users,
      color: '#8b5cf6',
      bgGlow: 'rgba(139, 92, 246, 0.15)',
    },
    {
      label: 'Files Changed',
      value: summary.totalFilesChanged.toLocaleString(),
      icon: FileCode2,
      color: '#06b6d4',
      bgGlow: 'rgba(6, 182, 212, 0.15)',
    },
    {
      label: 'Lines Added',
      value: `+${summary.totalAdditions.toLocaleString()}`,
      icon: PlusCircle,
      color: '#10b981',
      bgGlow: 'rgba(16, 185, 129, 0.15)',
    },
    {
      label: 'Lines Deleted',
      value: `-${summary.totalDeletions.toLocaleString()}`,
      icon: MinusCircle,
      color: '#ef4444',
      bgGlow: 'rgba(239, 68, 68, 0.15)',
    },
  ];

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div className="grid-cols-5">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="glass-card"
              style={{
                padding: '1.25rem',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-20px',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: card.bgGlow,
                  filter: 'blur(20px)',
                  pointerEvents: 'none',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {card.label}
                </span>
                <div
                  style={{
                    background: card.bgGlow,
                    borderRadius: '8px',
                    padding: '0.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={18} color={card.color} />
                </div>
              </div>

              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  fontFamily: card.label.includes('Lines') ? 'var(--font-mono)' : 'var(--font-sans)',
                }}
              >
                {card.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
