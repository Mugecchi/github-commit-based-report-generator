import { Octokit } from '@octokit/rest';
import { env } from '../../config/env.js';

export function createGitHubClient(customToken?: string): Octokit {
  const token = customToken || env.GITHUB_TOKEN;

  return new Octokit({
    auth: token || undefined,
    userAgent: 'github-development-report-generator/1.0.0',
  });
}
