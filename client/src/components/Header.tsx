import React from 'react';
import { GitBranch, FileSpreadsheet } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '12px',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
            }}
          >
            <GitBranch size={32} color="#60a5fa" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>GitHub Development Report</h1>
              <span
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '9999px',
                }}
              >
                v1.0
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginTop: '0.2rem' }}>
              Generate comprehensive development activity reports and Excel workbooks from GitHub commit history.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#34d399',
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Cauayan Systems Evaluation Export</span>
          </div>
        </div>
      </div>
    </header>
  );
};
