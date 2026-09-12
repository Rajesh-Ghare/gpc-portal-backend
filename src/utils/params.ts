import type { Request } from 'express';

/**
 * Express 5 types route params as `string | string[] | undefined` to
 * account for repeating wildcard segments. None of our routes use those —
 * every `:id`-style param is always a single string when its route matches.
 */
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string') {
    throw new Error(`Expected route param "${name}" to be present`);
  }
  return value;
}
