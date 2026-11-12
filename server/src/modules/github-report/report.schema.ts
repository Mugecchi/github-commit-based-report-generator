import { z } from 'zod';

// GitHub username/org regex: alphanumeric, single hyphens, 1-39 chars
const GITHUB_OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
// GitHub repository name regex: alphanumeric, hyphens, underscores, dots, 1-100 chars
const GITHUB_REPO_REGEX = /^[a-zA-Z0-9._-]{1,100}$/;

export const gitHubReportQuerySchema = z
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
    since: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => !val || !isNaN(Date.parse(val)),
        'Invalid "since" date format. Use ISO date (e.g. 2026-09-01 or 2026-09-01T00:00:00Z)'
      ),
    until: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => !val || !isNaN(Date.parse(val)),
        'Invalid "until" date format. Use ISO date (e.g. 2026-09-22 or 2026-09-22T23:59:59Z)'
      ),
    useOllama: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((val) => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
        return undefined;
      }),
    ollamaModel: z.string().trim().optional(),
    application: z.string().trim().optional(),
    githubToken: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.since && data.until) {
      const sinceTime = new Date(data.since).getTime();
      const untilTime = new Date(data.until).getTime();
      if (untilTime < sinceTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '"until" date cannot be earlier than "since" date',
          path: ['until'],
        });
      }
    }
  });

export type GitHubReportQueryParams = z.infer<typeof gitHubReportQuerySchema>;
