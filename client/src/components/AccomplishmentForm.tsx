import React, { useState, useEffect } from 'react';
import {
  Calendar,
  User,
  FolderGit2,
  GitFork,
  KeyRound,
  Eye,
  EyeOff,
  Building2,
  FileCheck2,
  Clock,
  Sparkles,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchCalendarDaysApi } from '../api/client.js';
import {
  AccomplishmentDayItem,
  DayStatus,
  GenerateAccomplishmentParams,
} from '../types/accomplishment.js';

interface AccomplishmentFormProps {
  params: GenerateAccomplishmentParams;
  onChange: (params: GenerateAccomplishmentParams) => void;
  onSubmit: (daysOverride: AccomplishmentDayItem[]) => void;
  isLoading: boolean;
  loadingStep: string;
}

const SIGNATORY_PRESETS = [
  {
    name: 'JON CARLO MIGUEL C. RIVERA',
    office: 'MAYOR’S OFFICE',
    position: 'ADMINISTRATIVE AIDE I',
    notedByName: 'MARIA CRISTINE C. ORDOÑEZ',
    notedByPosition: 'COOP Asst. Head & GAD Focal Person',
  },
  {
    name: 'DEXTER JHON E. FRANCISCO',
    office: 'MAYOR’S OFFICE',
    position: 'ADMINISTRATIVE AIDE I',
    notedByName: 'MARIA CRISTINE C. ORDOÑEZ',
    notedByPosition: 'COOP Asst. Head & GAD Focal Person',
  },
];

export const AccomplishmentForm: React.FC<AccomplishmentFormProps> = ({
  params,
  onChange,
  onSubmit,
  isLoading,
  loadingStep,
}) => {
  const [calendarDays, setCalendarDays] = useState<AccomplishmentDayItem[]>([]);
  const [periodLabel, setPeriodLabel] = useState<string>('');
  const [isGeneratingDays, setIsGeneratingDays] = useState<boolean>(false);
  const [showToken, setShowToken] = useState<boolean>(false);
  const [showSignatorySettings, setShowSignatorySettings] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch or regenerate calendar days whenever date boundaries change
  useEffect(() => {
    if (!params.startDate || !params.endDate) return;

    if (new Date(params.endDate).getTime() < new Date(params.startDate).getTime()) {
      setValidationError('"Date To" cannot be earlier than "Date From"');
      return;
    }
    setValidationError(null);

    setIsGeneratingDays(true);
    fetchCalendarDaysApi({
      startDate: params.startDate,
      endDate: params.endDate,
      excludeFridays: params.excludeFridays !== false,
      excludeWeekends: params.excludeWeekends !== false,
      hoursPerDay: params.hoursPerDay || '10 hours',
    })
      .then((res) => {
        setPeriodLabel(res.periodLabel);
        // If we already had customized days in this range, preserve notes/statuses where dates match
        setCalendarDays((prevDays) => {
          if (!prevDays || prevDays.length === 0) return res.days;
          return res.days.map((newDay) => {
            const matched = prevDays.find((p) => p.date === newDay.date);
            return matched ? { ...newDay, status: matched.status, note: matched.note } : newDay;
          });
        });
      })
      .catch((err) => {
        console.error('Failed to generate calendar days:', err);
      })
      .finally(() => {
        setIsGeneratingDays(false);
      });
  }, [params.startDate, params.endDate, params.excludeFridays, params.excludeWeekends, params.hoursPerDay]);

  const handleDayStatusChange = (date: string, newStatus: DayStatus) => {
    setCalendarDays((prev) =>
      prev.map((day) => {
        if (day.date === date) {
          let timeSpent = day.timeSpent;
          if (newStatus === 'working') timeSpent = params.hoursPerDay || '10 hours';
          else if (newStatus === 'holiday') timeSpent = 'Holiday';
          else if (newStatus === 'leave') timeSpent = 'On Leave';
          else timeSpent = '';
          return { ...day, status: newStatus, timeSpent };
        }
        return day;
      })
    );
  };

  const handleExcludeFridaysAndWeekends = () => {
    setCalendarDays((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek === 'Friday' || day.dayOfWeek === 'Saturday' || day.dayOfWeek === 'Sunday') {
          return { ...day, status: 'excluded', timeSpent: '' };
        }
        return day.status === 'excluded' ? { ...day, status: 'working', timeSpent: params.hoursPerDay || '10 hours' } : day;
      })
    );
  };

  const handleIncludeAllWeekdays = () => {
    setCalendarDays((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== 'Saturday' && day.dayOfWeek !== 'Sunday') {
          return { ...day, status: 'working', timeSpent: params.hoursPerDay || '10 hours' };
        }
        return { ...day, status: 'excluded', timeSpent: '' };
      })
    );
  };

  const handleResetAllToWorking = () => {
    setCalendarDays((prev) =>
      prev.map((day) => ({
        ...day,
        status: 'working',
        timeSpent: params.hoursPerDay || '10 hours',
      }))
    );
  };

  const handleApplyPreset = (preset: typeof SIGNATORY_PRESETS[0]) => {
    onChange({
      ...params,
      name: preset.name,
      office: preset.office,
      position: preset.position,
      notedByName: preset.notedByName,
      notedByPosition: preset.notedByPosition,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.owner.trim()) {
      setValidationError('Owner is required (e.g. Mugecchi or organization name)');
      return;
    }
    if (!params.repo.trim()) {
      setValidationError('Repository name is required (e.g. 42System)');
      return;
    }
    if (!params.startDate || !params.endDate) {
      setValidationError('Start Date and End Date are required.');
      return;
    }
    setValidationError(null);
    onSubmit(calendarDays);
  };

  // Metrics
  const totalDays = calendarDays.length;
  const workingDays = calendarDays.filter((d) => d.status === 'working').length;
  const holidays = calendarDays.filter((d) => d.status === 'holiday').length;
  const leaves = calendarDays.filter((d) => d.status === 'leave').length;
  const excluded = calendarDays.filter((d) => d.status === 'excluded').length;

  return (
    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileCheck2 size={20} color="#34d399" />
          <span>Accomplishment Report Configuration (Word .docx)</span>
        </h2>

        {/* Quick Fill presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>Quick fill signatory:</span>
          {SIGNATORY_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
              onClick={() => handleApplyPreset(p)}
            >
              {p.name.split(' ')[0]} ({p.name.split(' ')[1] || ''})
            </button>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderColor: 'rgba(59, 130, 246, 0.4)' }}
            onClick={() => onChange({ ...params, owner: 'Mugecchi', repo: '42System', branch: 'main' })}
          >
            Mugecchi/42System
          </button>
        </div>
      </div>

      {validationError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 1rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
          }}
        >
          {validationError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Repo & Auth Information */}
        <div className="grid-cols-4" style={{ marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} /> Owner / Organization
              </span>
              <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Mugecchi"
              value={params.owner}
              onChange={(e) => onChange({ ...params, owner: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <FolderGit2 size={14} /> Repository
              </span>
              <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 42System"
              value={params.repo}
              onChange={(e) => onChange({ ...params, repo: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <GitFork size={14} /> Branch (optional)
              </span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. main"
              value={params.branch || ''}
              onChange={(e) => onChange({ ...params, branch: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} /> Git Author Filter (optional)
              </span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="All or GitHub username"
              value={params.author || ''}
              onChange={(e) => onChange({ ...params, author: e.target.value })}
            />
          </div>
        </div>

        {/* GitHub Token / Friend's Token */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <KeyRound size={14} color="#f59e0b" /> GitHub Token (Optional / Friend's Token)
                </span>
              </label>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  background: params.githubToken?.trim() ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: params.githubToken?.trim() ? '#fbbf24' : 'var(--text-dim)',
                  border: `1px solid ${params.githubToken?.trim() ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)'}`,
                }}
              >
                {params.githubToken?.trim() ? 'Using Custom/Friend Token' : 'Using Server .env Token'}
              </span>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showToken ? 'text' : 'password'}
                className="form-input"
                style={{
                  paddingRight: '5rem',
                  fontFamily: params.githubToken ? 'var(--font-mono)' : 'inherit',
                  borderColor: params.githubToken?.trim() ? 'rgba(245, 158, 11, 0.5)' : undefined,
                  background: params.githubToken?.trim() ? 'rgba(245, 158, 11, 0.03)' : undefined,
                }}
                placeholder="Paste token (e.g. ghp_... or github_pat_...) to access private repos or separate rate limits"
                value={params.githubToken || ''}
                onChange={(e) => onChange({ ...params, githubToken: e.target.value })}
                autoComplete="off"
                spellCheck="false"
              />
              <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {params.githubToken && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...params, githubToken: '' })}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px',
                    }}
                    title="Clear custom token"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.25rem',
                    borderRadius: '4px',
                  }}
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Date Boundaries & Hours */}
        <div className="grid-cols-3" style={{ marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} color="#60a5fa" /> Start Date
              </span>
              <span className="required">*</span>
            </label>
            <input
              type="date"
              className="form-input"
              value={params.startDate}
              onChange={(e) => onChange({ ...params, startDate: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} color="#60a5fa" /> End Date
              </span>
              <span className="required">*</span>
            </label>
            <input
              type="date"
              className="form-input"
              value={params.endDate}
              onChange={(e) => onChange({ ...params, endDate: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={14} color="#34d399" /> Working Hours / Day
              </span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 10 hours"
              value={params.hoursPerDay || '10 hours'}
              onChange={(e) => onChange({ ...params, hoursPerDay: e.target.value })}
            />
          </div>
        </div>

        {/* Collapsible Signatory & Designation Settings */}
        <div style={{ marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '1rem 1.25rem' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setShowSignatorySettings(!showSignatorySettings)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={16} color="#818cf8" />
              <strong style={{ fontSize: '0.9rem', color: '#ffffff' }}>Signatory & Employee Information (Appears in Word Document)</strong>
            </div>
            {showSignatorySettings ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
          </div>

          {showSignatorySettings && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div className="grid-cols-3" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Employee Name (Prepared by)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={params.name || ''}
                    onChange={(e) => onChange({ ...params, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Office / Department</label>
                  <input
                    type="text"
                    className="form-input"
                    value={params.office || ''}
                    onChange={(e) => onChange({ ...params, office: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Position / Designation</label>
                  <input
                    type="text"
                    className="form-input"
                    value={params.position || ''}
                    onChange={(e) => onChange({ ...params, position: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Noted By (Supervisor / Signatory)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={params.notedByName || ''}
                    onChange={(e) => onChange({ ...params, notedByName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Noted By Designation</label>
                  <input
                    type="text"
                    className="form-input"
                    value={params.notedByPosition || ''}
                    onChange={(e) => onChange({ ...params, notedByPosition: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Calendar Days & Inclusion/Exclusion Checklist */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SlidersHorizontal size={18} color="#60a5fa" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#ffffff' }}>Calendar Working Days & Exclusions Checklist</h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Define which calendar days are included or excluded. Working days will be populated sequentially from your commits.
              </p>
            </div>

            {/* Batch actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                onClick={handleExcludeFridaysAndWeekends}
                title="Exclude all Fridays, Saturdays, and Sundays"
              >
                🚫 Exclude Fridays & Weekends (Default)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                onClick={handleIncludeAllWeekdays}
                title="Include Monday through Friday"
              >
                💼 Include All Weekdays
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem' }}
                onClick={handleResetAllToWorking}
                title="Set all days in range to working"
              >
                🔄 Reset All to Working
              </button>
            </div>
          </div>

          {/* Metric Badges */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              fontSize: '0.825rem',
            }}
          >
            <span>
              Period: <strong style={{ color: '#ffffff' }}>{periodLabel || `${params.startDate} to ${params.endDate}`}</strong>
            </span>
            <span style={{ color: 'var(--text-dim)' }}>•</span>
            <span style={{ color: '#34d399', fontWeight: 600 }}>
              💼 {workingDays} Working Days
            </span>
            <span style={{ color: 'var(--text-dim)' }}>•</span>
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>
              🏖️ {holidays} Holiday{holidays !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--text-dim)' }}>•</span>
            <span style={{ color: '#a78bfa', fontWeight: 600 }}>
              🌴 {leaves} On Leave
            </span>
            <span style={{ color: 'var(--text-dim)' }}>•</span>
            <span style={{ color: 'var(--text-muted)' }}>
              ❌ {excluded} Excluded ({totalDays} Total Calendar Days)
            </span>
          </div>

          {/* Day list table */}
          {isGeneratingDays ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
              <Loader2 className="spinner" size={24} style={{ margin: '0 auto 0.5rem auto' }} />
              <p>Updating calendar schedule...</p>
            </div>
          ) : (
            <div
              style={{
                maxHeight: '380px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              <table className="custom-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>Date</th>
                    <th style={{ width: '110px' }}>Day of Week</th>
                    <th style={{ textAlign: 'center' }}>Report Status (Click to Toggle)</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Time Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {calendarDays.map((day) => {
                    const isWeekend = day.dayOfWeek === 'Saturday' || day.dayOfWeek === 'Sunday';
                    const isFriday = day.dayOfWeek === 'Friday';

                    return (
                      <tr
                        key={day.date}
                        style={{
                          opacity: day.status === 'excluded' ? 0.45 : 1,
                          background:
                            day.status === 'working'
                              ? 'rgba(52, 211, 153, 0.03)'
                              : day.status === 'holiday'
                              ? 'rgba(251, 191, 36, 0.05)'
                              : day.status === 'leave'
                              ? 'rgba(167, 139, 250, 0.05)'
                              : 'transparent',
                        }}
                      >
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap' }}>
                          {day.date}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span
                            className="badge"
                            style={{
                              background: isFriday
                                ? 'rgba(245, 158, 11, 0.15)'
                                : isWeekend
                                ? 'rgba(156, 163, 175, 0.15)'
                                : 'rgba(59, 130, 246, 0.15)',
                              color: isFriday ? '#fbbf24' : isWeekend ? '#9ca3af' : '#93c5fd',
                              border: `1px solid ${
                                isFriday
                                  ? 'rgba(245, 158, 11, 0.3)'
                                  : isWeekend
                                  ? 'rgba(156, 163, 175, 0.2)'
                                  : 'rgba(59, 130, 246, 0.3)'
                              }`,
                            }}
                          >
                            {day.dayOfWeek}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleDayStatusChange(day.date, 'working')}
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: day.status === 'working' ? 700 : 400,
                                background: day.status === 'working' ? '#10b981' : 'rgba(255, 255, 255, 0.05)',
                                color: day.status === 'working' ? '#000000' : 'var(--text-muted)',
                                border: `1px solid ${day.status === 'working' ? '#10b981' : 'var(--border-color)'}`,
                                cursor: 'pointer',
                              }}
                            >
                              💼 Working
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDayStatusChange(day.date, 'holiday')}
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: day.status === 'holiday' ? 700 : 400,
                                background: day.status === 'holiday' ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
                                color: day.status === 'holiday' ? '#000000' : 'var(--text-muted)',
                                border: `1px solid ${day.status === 'holiday' ? '#f59e0b' : 'var(--border-color)'}`,
                                cursor: 'pointer',
                              }}
                            >
                              🏖️ Holiday
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDayStatusChange(day.date, 'leave')}
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: day.status === 'leave' ? 700 : 400,
                                background: day.status === 'leave' ? '#8b5cf6' : 'rgba(255, 255, 255, 0.05)',
                                color: day.status === 'leave' ? '#ffffff' : 'var(--text-muted)',
                                border: `1px solid ${day.status === 'leave' ? '#8b5cf6' : 'var(--border-color)'}`,
                                cursor: 'pointer',
                              }}
                            >
                              🌴 On Leave
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDayStatusChange(day.date, 'excluded')}
                              style={{
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: day.status === 'excluded' ? 700 : 400,
                                background: day.status === 'excluded' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                color: day.status === 'excluded' ? '#fca5a5' : 'var(--text-dim)',
                                border: `1px solid ${day.status === 'excluded' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'}`,
                                cursor: 'pointer',
                              }}
                            >
                              ❌ Exclude
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: day.status === 'excluded' ? 'var(--text-dim)' : '#ffffff' }}>
                          {day.status === 'working' ? day.timeSpent || '10 hours' : day.status === 'holiday' ? 'Holiday' : day.status === 'leave' ? 'On Leave' : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Generate Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || isGeneratingDays}
              style={{ minWidth: '220px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              {isLoading ? (
                <>
                  <div className="spinner" />
                  <span>{loadingStep || 'Populating from Commits...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate Accomplishment Report</span>
                </>
              )}
            </button>

            {isLoading && (
              <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                {loadingStep}
              </span>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
