import { logger } from './logger.js';

const GITHUB_API = 'https://api.github.com';

let cachedToken: string | null = null;

export function setGitHubToken(token: string): void {
  cachedToken = token;
}

export function getGitHubToken(): string | null {
  if (cachedToken) return cachedToken;
  return process.env.GITHUB_TOKEN || null;
}

export function isGitHubConfigured(): boolean {
  return !!getGitHubToken();
}

interface GitHubRequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function githubRequest(path: string, options: GitHubRequestOptions = {}): Promise<any> {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('GITHUB_TOKEN not configured. Run mercury doctor to set it up.');
  }

  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Mercury-Agent',
    ...options.headers,
  };

  const fetchOptions: any = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }

  logger.info({ method: fetchOptions.method, path }, 'GitHub API request');

  const response = await fetch(url, fetchOptions);

  const remaining = response.headers.get('x-ratelimit-remaining');
  if (remaining && parseInt(remaining, 10) < 100) {
    logger.warn({ remaining }, 'GitHub API rate limit running low');
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`);
  }

  if (response.status === 204) return null;

  return response.json();
}

export function parseRepo(remoteUrl: string): { owner: string; repo: string } | null {
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/([^.\s]+)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^/]+)\/([^.\s]+)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  return null;
}

export async function getCurrentRepo(): Promise<{ owner: string; repo: string } | null> {
  try {
    const { execSync } = await import('node:child_process');
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8', timeout: 5000 }).trim();
    return parseRepo(remoteUrl);
  } catch {
    return null;
  }
}