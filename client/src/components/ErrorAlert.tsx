import React from 'react';
import { AlertTriangle, ShieldAlert, KeyRound, Clock, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  statusCode?: number;
  onDismiss?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, statusCode, onDismiss }) => {
  let Icon = AlertTriangle;
  let title = 'Report Generation Error';

  if (statusCode === 404) {
    Icon = ShieldAlert;
    title = 'Repository Not Found';
  } else if (statusCode === 401) {
    Icon = KeyRound;
    title = 'Authentication Required';
  } else if (statusCode === 429 || message.toLowerCase().includes('rate limit')) {
    Icon = Clock;
    title = 'GitHub API Rate Limit Reached';
  }

  return (
    <div
      style={{
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)',
      }}
    >
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.2)',
          borderRadius: '10px',
          padding: '0.6rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={22} color="#f87171" />
      </div>

      <div style={{ flex: 1 }}>
        <h4 style={{ color: '#fca5a5', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          {title}
        </h4>
        <p style={{ color: '#fecaca', fontSize: '0.875rem', lineHeight: 1.5 }}>
          {message}
        </p>

        {statusCode === 429 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            💡 Tip: Paste your friend's GitHub token into the form above, or add a <code>GITHUB_TOKEN</code> to your server's <code>.env</code> file to increase your GitHub API rate limit from 60 requests/hr to 5,000 requests/hr.
          </p>
        )}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#f87171',
            cursor: 'pointer',
            padding: '0.25rem',
          }}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};
