import { describe, expect, it } from 'vitest';
import { AccomplishmentService } from '../accomplishment.service.js';
import { generateAccomplishmentDocx } from '../accomplishment.docx.js';

describe('AccomplishmentService & Docx Generation', () => {
  const service = new AccomplishmentService();

  describe('generateCalendarDays', () => {
    it('should generate all days in range with Fridays and weekends excluded by default', () => {
      // August 29 (Sat) to September 13 (Sun), 2026
      const days = service.generateCalendarDays('2026-08-29', '2026-09-13', {
        excludeFridays: true,
        excludeWeekends: true,
      });

      expect(days.length).toBe(16); // 16 calendar days total

      // Sat Aug 29 -> excluded
      expect(days[0].date).toBe('2026-08-29');
      expect(days[0].dayOfWeek).toBe('Saturday');
      expect(days[0].status).toBe('excluded');

      // Mon Aug 31 -> working
      expect(days[2].date).toBe('2026-08-31');
      expect(days[2].dayOfWeek).toBe('Monday');
      expect(days[2].status).toBe('working');

      // Fri Sep 4 -> excluded
      const friSep4 = days.find((d) => d.date === '2026-09-04');
      expect(friSep4).toBeDefined();
      expect(friSep4?.dayOfWeek).toBe('Friday');
      expect(friSep4?.status).toBe('excluded');

      // Working days count: Mon-Thu Aug 31-Sep 3 (4 days) + Mon-Thu Sep 7-Sep 10 (4 days) = 8 days
      const workingDays = days.filter((d) => d.status === 'working');
      expect(workingDays.length).toBe(8);
    });

    it('should include Fridays when excludeFridays is false', () => {
      const days = service.generateCalendarDays('2026-09-01', '2026-09-07', {
        excludeFridays: false,
        excludeWeekends: true,
      });

      const fri = days.find((d) => d.date === '2026-09-04');
      expect(fri?.status).toBe('working');
    });
  });

  describe('formatPeriodLabel', () => {
    it('should format cross-month period label correctly', () => {
      const label = service.formatPeriodLabel('2026-08-29', '2026-09-13');
      expect(label).toBe('August 29 to September 13, 2026');
    });

    it('should format same-month period label correctly', () => {
      const label = service.formatPeriodLabel('2026-09-01', '2026-09-15');
      expect(label).toBe('September 1 to 15, 2026');
    });
  });

  describe('generateAccomplishmentDocx', () => {
    it('should generate a valid binary buffer for the docx report', async () => {
      const mockData = {
        metadata: {
          owner: 'Mugecchi',
          repo: '42System',
          branch: 'main',
          startDate: '2026-08-29',
          endDate: '2026-09-13',
          periodLabel: 'August 29 to September 13, 2026',
          name: 'JON CARLO MIGUEL C. RIVERA',
          office: 'MAYOR’S OFFICE',
          position: 'ADMINISTRATIVE AIDE I',
          notedByName: 'MARIA CRISTINE C. ORDOÑEZ',
          notedByPosition: 'COOP Asst. Head & GAD Focal Person',
          totalCalendarDays: 16,
          totalWorkingDays: 4,
          totalHolidays: 1,
          totalLeaves: 3,
          totalExcludedDays: 8,
          hoursPerDay: '10 hours',
          generatedAt: new Date().toISOString(),
        },
        days: [
          {
            date: '2026-08-31',
            formattedDate: 'August 31, 2026',
            dayOfWeek: 'Monday',
            status: 'holiday' as const,
            timeSpent: 'Holiday',
            accomplishment: '',
            remarks: '',
          },
          {
            date: '2026-09-01',
            formattedDate: 'September 1, 2026',
            dayOfWeek: 'Tuesday',
            status: 'leave' as const,
            timeSpent: 'On Leave',
            accomplishment: '',
            remarks: '',
          },
          {
            date: '2026-09-07',
            formattedDate: 'September 7, 2026',
            dayOfWeek: 'Monday',
            status: 'working' as const,
            timeSpent: '10 hours',
            accomplishment:
              'Centralized State Providers & CRUD Controllers: Engineered global React context providers and standardized generic CRUD backend controllers across multi-department workflows.',
            remarks: 'Full-Stack Development',
          },
        ],
      };

      const buffer = await generateAccomplishmentDocx(mockData);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
      // Valid docx starts with ZIP magic bytes PK\x03\x04
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);
      expect(buffer[2]).toBe(0x03);
      expect(buffer[3]).toBe(0x04);
    });
  });
});
