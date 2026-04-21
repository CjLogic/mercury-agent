import { tool } from 'ai';
import { z } from 'zod';
import { githubRequest, getCurrentRepo } from '../../utils/github.js';

export function createListIssuesTool() {
  return tool({
    description: 'List open GitHub issues for the current repository. Requires GITHUB_TOKEN.',
    parameters: z.object({
      state: z.enum(['open', 'closed', 'all']).describe('Filter by issue state').default('open'),
      labels: z.string().describe('Comma-separated label names to filter by (optional)').optional(),
      limit: z.number().describe('Maximum number of issues to return').default(10),
    }),
    execute: async ({ state, labels, limit }) => {
      try {
        const repo = await getCurrentRepo();
        if (!repo) return 'Error: Could not detect GitHub repository.';

        const params = new URLSearchParams();
        params.set('state', state);
        params.set('per_page', String(Math.min(limit, 100)));
        params.set('sort', 'updated');
        params.set('direction', 'desc');
        if (labels) params.set('labels', labels);

        const issues = await githubRequest(`/repos/${repo.owner}/${repo.repo}/issues?${params}`);

        if (!Array.isArray(issues) || issues.length === 0) {
          return `No ${state} issues found.`;
        }

        const lines = issues.map((issue: any) => {
          const labelStr = issue.labels?.map((l: any) => `[${l.name}]`).join(' ') || '';
          return `#${issue.number} ${issue.title} ${labelStr} (${issue.state}, by ${issue.user?.login})`;
        });

        return `Issues in ${repo.owner}/${repo.repo} (${state}):\n${lines.join('\n')}`;
      } catch (err: any) {
        return `Error listing issues: ${err.message}`;
      }
    },
  });
}