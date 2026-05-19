import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ZodError } from 'zod';

/**
 * Default validation hook used by every OpenAPIHono instance in the app.
 *
 * @hono/zod-openapi runs this when a request fails its declared Zod schema.
 * Without it, the response would be the raw `safeParse` result (`{ success,
 * error: { issues, name } }`), which differs from how AppError-based failures
 * look. The hook normalizes every validation failure into the canonical
 * `{ error, code, details }` envelope used elsewhere.
 *
 * It must be passed explicitly to every sub-OpenAPIHono (route group),
 * because OpenAPIHono options don't propagate through `.route()` mounts.
 */
export type ZodHookResult =
  | { success: true; data: unknown }
  | { success: false; error: ZodError };

export function defaultZodHook(result: ZodHookResult, c: Context): Response | undefined {
  if (!result.success) {
    return c.json(
      {
        error: 'Entrada inválida',
        code: 'VALIDATION_ERROR',
        details: {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.') || undefined,
            message: issue.message,
            code: issue.code,
          })),
        },
      },
      400 as ContentfulStatusCode,
    );
  }
  return undefined;
}
