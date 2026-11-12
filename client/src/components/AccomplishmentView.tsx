import React, { useState } from 'react';
import {
  Download,
  FileText,
  Edit3,
  Loader2,
} from 'lucide-react';
import {
  AccomplishmentDayItem,
  AccomplishmentReportData,
} from '../types/accomplishment.js';
import { downloadAccomplishmentDocxApi } from '../api/client.js';

interface AccomplishmentViewProps {
  reportData: AccomplishmentReportData;
  onUpdateDays: (updatedDays: AccomplishmentDayItem[]) => void;
  onBackToConfig: () => void;
}

export const AccomplishmentView: React.FC<AccomplishmentViewProps> = ({
  reportData,
  onUpdateDays,
  onBackToConfig,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { metadata, days } = reportData;
  const visibleDays = days.filter((d) => d.status !== 'excluded');

  const handleAccomplishmentChange = (date: string, newText: string) => {
    const updated = days.map((d) => (d.date === date ? { ...d, accomplishment: newText } : d));
    onUpdateDays(updated);
  };

  const handleRemarksChange = (date: string, newRemarks: string) => {
    const updated = days.map((d) => (d.date === date ? { ...d, remarks: newRemarks } : d));
    onUpdateDays(updated);
  };

  const handleTimeSpentChange = (date: string, newTime: string) => {
    const updated = days.map((d) => (d.date === date ? { ...d, timeSpent: newTime } : d));
    onUpdateDays(updated);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadAccomplishmentDocxApi(reportData);
    } catch (err: any) {
      console.error('Failed to download DOCX:', err);
      setDownloadError(err.message || 'Failed to download Word document.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div style={{ marginBottom: '2.5rem' }}>
      {/* Top Banner & Action Controls */}
      <div
        className="glass-card"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderLeft: '4px solid #10b981',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
            }}
          >
            <FileText size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                Accomplishment Report Ready
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  fontWeight: 600,
                }}
              >
                Word Format (.docx)
              </span>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Populated {metadata.totalWorkingDays} working day(s) from commits. You can edit cells directly below before downloading.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onBackToConfig}
            style={{ fontSize: '0.85rem' }}
          >
            <Edit3 size={15} />
            <span>Reconfigure Dates / Signatories</span>
          </button>

          <button
            type="button"
            className="btn btn-success"
            onClick={handleDownload}
            disabled={isDownloading}
            style={{
              fontSize: '0.875rem',
              padding: '0.6rem 1.25rem',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              borderColor: '#3b82f6',
              boxShadow: '0 4px 15px rgba(37, 99, 235, 0.35)',
            }}
          >
            {isDownloading ? (
              <>
                <Loader2 size={16} className="spinner" />
                <span>Exporting Word Document...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Download Word (.docx)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {downloadError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
          }}
        >
          {downloadError}
        </div>
      )}

      {/* Document Sheet Preview */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '2.5rem',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          fontFamily: '"Century Gothic", "Segoe UI", sans-serif',
        }}
      >
        {/* Document Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em', margin: 0 }}>
            Accomplishment Report for the Month of
          </h2>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#93c5fd', margin: '0.25rem 0 0 0' }}>
            {metadata.periodLabel}
          </h3>
        </div>

        {/* Employee Info Block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            marginBottom: '1.75rem',
            fontSize: '0.95rem',
            lineHeight: 1.5,
          }}
        >
          <div>
            <strong style={{ color: '#ffffff' }}>Name: </strong>
            <span style={{ color: '#e5e7eb' }}>{metadata.name}</span>
          </div>
          <div>
            <strong style={{ color: '#ffffff' }}>Office: </strong>
            <span style={{ color: '#e5e7eb' }}>{metadata.office}</span>
          </div>
          <div>
            <strong style={{ color: '#ffffff' }}>Position/Designation: </strong>
            <span style={{ color: '#e5e7eb' }}>{metadata.position}</span>
          </div>
        </div>

        {/* Table Notice */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          <span>💡 Cells in the table below are editable. Updates are preserved when exporting to Word.</span>
          <span>{visibleDays.length} Rows Included</span>
        </div>

        {/* Document Table */}
        <div className="table-wrapper" style={{ marginBottom: '2rem', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px' }}>
          <table
            className="custom-table"
            style={{
              margin: 0,
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: '"Century Gothic", sans-serif',
            }}
          >
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
                <th style={{ width: '18%', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '0.75rem' }}>
                  Date
                </th>
                <th style={{ width: '48%', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '0.75rem' }}>
                  Accomplishment/Outputs
                </th>
                <th style={{ width: '16%', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '0.75rem' }}>
                  Time Spent
                </th>
                <th style={{ width: '18%', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '0.75rem' }}>
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleDays.map((day) => {
                const isWorking = day.status === 'working';
                const isHoliday = day.status === 'holiday';
                const isLeave = day.status === 'leave';

                return (
                  <tr
                    key={day.date}
                    style={{
                      background: isHoliday
                        ? 'rgba(245, 158, 11, 0.04)'
                        : isLeave
                        ? 'rgba(139, 92, 246, 0.04)'
                        : 'transparent',
                    }}
                  >
                    {/* Date */}
                    <td
                      style={{
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        fontWeight: 600,
                        color: '#ffffff',
                        fontSize: '0.9rem',
                        whiteSpace: 'nowrap',
                        padding: '0.65rem 0.5rem',
                      }}
                    >
                      {day.formattedDate}
                    </td>

                    {/* Accomplishment / Outputs */}
                    <td
                      style={{
                        verticalAlign: 'middle',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        padding: '0.5rem 0.75rem',
                      }}
                    >
                      {isWorking ? (
                        <textarea
                          rows={2}
                          className="form-input"
                          style={{
                            width: '100%',
                            fontFamily: '"Century Gothic", sans-serif',
                            fontSize: '0.85rem',
                            lineHeight: 1.45,
                            resize: 'vertical',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderColor: 'transparent',
                            padding: '0.35rem 0.5rem',
                          }}
                          value={day.accomplishment}
                          onChange={(e) => handleAccomplishmentChange(day.date, e.target.value)}
                        />
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>

                    {/* Time Spent */}
                    <td
                      style={{
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        padding: '0.5rem',
                      }}
                    >
                      {isWorking ? (
                        <input
                          type="text"
                          className="form-input"
                          style={{
                            textAlign: 'center',
                            fontFamily: '"Century Gothic", sans-serif',
                            fontSize: '0.85rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderColor: 'transparent',
                            padding: '0.25rem',
                          }}
                          value={day.timeSpent}
                          onChange={(e) => handleTimeSpentChange(day.date, e.target.value)}
                        />
                      ) : (
                        <span
                          style={{
                            fontWeight: 700,
                            color: isHoliday ? '#fbbf24' : '#c084fc',
                            fontSize: '0.85rem',
                          }}
                        >
                          {isHoliday ? 'Holiday' : 'On Leave'}
                        </span>
                      )}
                    </td>

                    {/* Remarks */}
                    <td
                      style={{
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        padding: '0.5rem',
                      }}
                    >
                      {isWorking ? (
                        <input
                          type="text"
                          className="form-input"
                          style={{
                            textAlign: 'center',
                            fontFamily: '"Century Gothic", sans-serif',
                            fontSize: '0.85rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderColor: 'transparent',
                            padding: '0.25rem',
                          }}
                          value={day.remarks}
                          onChange={(e) => handleRemarksChange(day.date, e.target.value)}
                        />
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Signature Section */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            marginTop: '2.5rem',
            paddingTop: '1rem',
          }}
        >
          {/* Prepared by */}
          <div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Prepared by:</span>
            <div style={{ marginTop: '2.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff', textTransform: 'uppercase' }}>
                {metadata.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#93c5fd', marginTop: '0.15rem' }}>
                {metadata.position}
              </div>
            </div>
          </div>

          {/* Noted by */}
          <div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Noted by:</span>
            <div style={{ marginTop: '2.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff', textTransform: 'uppercase' }}>
                {metadata.notedByName}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#93c5fd', marginTop: '0.15rem' }}>
                {metadata.notedByPosition}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
