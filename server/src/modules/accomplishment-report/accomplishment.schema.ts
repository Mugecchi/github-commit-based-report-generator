import { z } from 'zod';

const GITHUB_OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9._-]{1,100}$/;

export const accomplishmentDayItemSchema = z.object({
  date: z.string().trim(),
  formattedDate: z.string().trim(),
  dayOfWeek: z.string().trim(),
  status: z.enum(['working', 'holiday', 'leave', 'excluded']),
  note: z.string().trim().optional(),
  timeSpent: z.string().trim(),
  accomplishment: z.string().trim(),
  remarks: z.string().trim(),
});

export const generateAccomplishmentSchema = z
  .object({
    owner: z
      .string()
      .trim()
      .min(1, 'Owner is required')
      .regex(GITHUB_OWNER_REGEX, 'Invalid GitHub owner/organization name'),
    repo: z
      .string()
      .trim()
      .min(1, 'Repository is required')
      .regex(GITHUB_REPO_REGEX, 'Invalid GitHub repository name'),
    branch: z.string().trim().optional(),
    author: z.string().trim().optional(),
    githubToken: z.string().trim().optional(),
    startDate: z
      .string()
      .trim()
      .min(1, 'Start date is required')
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid start date format'),
    endDate: z
      .string()
      .trim()
      .min(1, 'End date is required')
      .refine((val) => !isNaN(Date.parse(val)), 'Invalid end date format'),
    name: z.string().trim().optional().default('JON CARLO MIGUEL C. RIVERA'),
    office: z.string().trim().optional().default('MAYOR’S OFFICE'),
    position: z.string().trim().optional().default('ADMINISTRATIVE AIDE I'),
    notedByName: z.string().trim().optional().default('MARIA CRISTINE C. ORDOÑEZ'),
    notedByPosition: z.string().trim().optional().default('COOP Asst. Head & GAD Focal Person'),
    hoursPerDay: z.string().trim().optional().default('10 hours'),
    excludeFridays: z.boolean().optional().default(true),
    excludeWeekends: z.boolean().optional().default(true),
    daysOverride: z.array(accomplishmentDayItemSchema).optional(),
    useOllama: z.boolean().optional(),
    ollamaModel: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const start = new Date(data.startDate).getTime();
    const end = new Date(data.endDate).getTime();
    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '"endDate" cannot be earlier than "startDate"',
        path: ['endDate'],
      });
    }
  });

export const downloadAccomplishmentDocxSchema = z.object({
  reportData: z.object({
    metadata: z.object({
      owner: z.string(),
      repo: z.string(),
      branch: z.string(),
      authorFilter: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
      periodLabel: z.string(),
      name: z.string(),
      office: z.string(),
      position: z.string(),
      notedByName: z.string(),
      notedByPosition: z.string(),
      totalCalendarDays: z.number().optional(),
      totalWorkingDays: z.number().optional(),
      totalHolidays: z.number().optional(),
      totalLeaves: z.number().optional(),
      totalExcludedDays: z.number().optional(),
      hoursPerDay: z.string().optional(),
      generatedAt: z.string().optional(),
    }),
    days: z.array(accomplishmentDayItemSchema),
  }),
});
