import { z } from 'zod';

export const sourceCodeScanQuerySchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  branch: z.string().optional(),
  githubToken: z.string().optional(),
  srcOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() !== 'false';
      return true;
    }),
  sourceType: z.enum(['github', 'local']).optional().default('github'),
  localPath: z.string().optional(),
});

export const sourceCodeDownloadQuerySchema = sourceCodeScanQuerySchema.extend({
  application: z.string().optional().default('ALL'),
  includeLineNumbers: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() !== 'false';
      return true;
    }),
  selectedFiles: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim()) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          return val.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      return undefined;
    }),
});

export type SourceCodeScanQuery = z.infer<typeof sourceCodeScanQuerySchema>;
export type SourceCodeDownloadQuery = z.infer<typeof sourceCodeDownloadQuerySchema>;
