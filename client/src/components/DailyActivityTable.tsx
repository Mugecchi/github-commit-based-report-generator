import React from 'react';
import { Activity } from 'lucide-react';
import { DailyActivityStats } from '../types/report.js';

interface DailyActivityTableProps {
  dailyActivity: DailyActivityStats[];
}

export const DailyActivityTable: React.FC<DailyActivityTableProps> = ({ dailyActivity }) => {
  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={18} color="#06b6d4" />
          <span>Daily Activity Timeline ({dailyActivity.length} Active Days)</span>
        </h3>
      </div>

      <div className="table-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th style={{ textAlign: 'center' }}>Commits</th>
              <th style={{ textAlign: 'center' }}>Files Changed</th>
              <th style={{ textAlign: 'right' }}>Additions (+)</th>
              <th style={{ textAlign: 'right' }}>Deletions (-)</th>
              <th style={{ textAlign: 'right' }}>Net Delta</th>
            </tr>
          </thead>
          <tbody>
            {dailyActivity.map((day) => {
              const delta = day.additions - day.deletions;
              return (
                <tr key={day.date}>
                  {/* Date */}
                  <td style={{ fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                    {day.date}
                  </td>

                  {/* Commits */}
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>
                    {day.commits}
                  </td>

                  {/* Files Changed */}
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {day.filesChanged}
                  </td>

                  {/* Additions */}
                  <td style={{ textAlign: 'right' }}>
                    <span className="stat-add">+{day.additions.toLocaleString()}</span>
                  </td>

                  {/* Deletions */}
                  <td style={{ textAlign: 'right' }}>
                    <span className="stat-del">-{day.deletions.toLocaleString()}</span>
                  </td>

                  {/* Net Delta */}
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    <span style={{ color: delta >= 0 ? '#34d399' : '#f87171' }}>
                      {delta >= 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()}
                    </span>
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
