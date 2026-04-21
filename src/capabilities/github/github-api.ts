import { tool } from 'ai';
import { z } from 'zod';
import { githubRequest } from '../../utils/github.js';
import type { PermissionManager } from '../permissions.js';

export function createGithubApiTool(permissions: PermissionManager) {
  return tool({
    description: 'Make a raw request to the GitHub API. Use this for any GitHub operation not covered by other tools. GET requests are auto-approved; write operations (POST, PUT, PATCH, DELETE) require approval.',
    parameters: z.object({
      path: z.string().describe('API path (e.g., /repos/owner/repo/releases)'),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).describe('HTTP method').default('GET'),
      body: z.string().describe('JSON body for write requests (as a JSON string)').optional(),
    }),
    execute: async ({ path, method, body }) => {
      const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      if (isWrite) {
        const check = await permissions.checkShellCommand(`github-api ${method} ${path}`);
        if (!check.allowed) {
          if (check.needsApproval) {
            return `This GitHub API write operation requires approval: ${method} ${path}\n\nTell the user what this does and ask for confirmation. If approved, try again.`;
          }
          return `Error: ${check.reason}`;
        }
      }

      try {
        let parsedBody: any;
        if (body) {
          try {
            parsedBody = JSON.parse(body);
          } catch {
            return 'Error: body must be valid JSON.';
          }
        }

        const result = await githubRequest(path, {
          method,
          body: parsedBody,
        });

        if (result === null) return 'Request completed (204 No Content).';

        if (typeof result === 'string') return result;

        return JSON.stringify(result, null, 2);
      } catch (err: any) {
        return `Error: ${err.message}`;
      }
    },
  });
}