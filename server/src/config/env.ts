import { config } from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from workspace/server root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });
config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GITHUB_TOKEN: z.string().trim().optional(),
  OLLAMA_BASE_URL: z.string().trim().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().trim().default('qwen2.5:7B'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
