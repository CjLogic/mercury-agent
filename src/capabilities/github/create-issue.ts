import { tool } from 'ai';
import { z } from 'zod';
import { githubRequest, getCurrentRepo } from '../../utils/github.js';

export function createCreateIssueTool() {
  return tool({
    description: 'Create a new GitHub issue in the current repository. Requires GITHUB_TOKEN.',
    parameters: z.object({
      title: z.string().describe('Issue title'),
      body: z.string().describe('Issue description (markdown supported)').default(''),
      labels: z.array(z.string()).describe('Label names to apply').optional(),
    }),
    execute: async ({ title, body, labels }) => {
      try {
        const repo = await getCurrentRepo();
        if (!repo) return 'Error: Could not detect GitHub repository.';

        const payload: any = { title, body };
        if (labels && labels.length > 0) payload.labels = labels;

        const result = await githubRequest(`/repos/${repo.owner}/${repo.repo}/issues`, {
          method: 'POST',
          body: payload,
        });

        return `Issue created: ${result.html_url}\n#${result.number}: ${result.title}`;
      } catch (err: any) {
        return `Error creating issue: ${err.message}`;
      }
    },
  });
}