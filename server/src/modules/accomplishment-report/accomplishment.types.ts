export type DayStatus = 'working' | 'holiday' | 'leave' | 'excluded';

export interface AccomplishmentDayItem {
  date: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "August 31, 2026"
  dayOfWeek: string; // e.g. "Monday"
  status: DayStatus;
  note?: string; // e.g. "Holiday", "On Leave"
  timeSpent: string; // e.g. "10 hours", "Holiday", "On Leave"
  accomplishment: string; // narrative accomplishment text
  remarks: string; // category, e.g. "Full-Stack Development"
}

export interface AccomplishmentSignatory {
  name: string;
  office: string;
  position: string;
  notedByName: string;
  notedByPosition: string;
}

export interface AccomplishmentReportMetadata extends AccomplishmentSignatory {
  owner: string;
  repo: string;
  branch: string;
  authorFilter?: string;
  startDate: string;
  endDate: string;
  periodLabel: string; // e.g. "August 29 to September 13, 2026"
  totalCalendarDays: number;
  totalWorkingDays: number;
  totalHolidays: number;
  totalLeaves: number;
  totalExcludedDays: number;
  hoursPerDay: string;
  generatedAt: string;
}

export interface AccomplishmentReportData {
  metadata: AccomplishmentReportMetadata;
  days: AccomplishmentDayItem[];
}

export interface GenerateAccomplishmentParams {
  owner: string;
  repo: string;
  branch?: string;
  author?: string;
  githubToken?: string;
  startDate: string;
  endDate: string;
  name?: string;
  office?: string;
  position?: string;
  notedByName?: string;
  notedByPosition?: string;
  hoursPerDay?: string;
  excludeFridays?: boolean;
  excludeWeekends?: boolean;
  daysOverride?: AccomplishmentDayItem[];
  useOllama?: boolean;
  ollamaModel?: string;
}
