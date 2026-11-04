// Each outside business's own Octo workspace (decision 0021, #127). The registry's put creates it once, through Octo's
// POST /workspaces (an account-wide key only), and from then on every read and write for that business goes to it. The
// factory's demo businesses stay on the shared workspace, told apart by prefix.
// No Node imports: it also runs in a Cloudflare Pages Function.
import type { Sql } from './octo-store.ts';

export const WORKSPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const OCTO_BASE = 'https://octodb.design-bakery.com/api';

export type Octo = { base?: string; key: string };

async function call(octo: Octo, path: string, body?: unknown): Promise<{ status: number; json: Record<string, any> }> {
  const r = await fetch(`${(octo.base || OCTO_BASE).replace(/\/$/, '')}${path}`, { method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${octo.key}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json: Record<string, any> = {};
  try { json = await r.json() as Record<string, any>; } catch { /* no body */ }
  return { status: r.status, json };
}

// The workspace SQL surface (POST /workspaces/<id>/query) for one workspace, with the key that may reach it.
export function octoSql(octo: Octo, workspace: string): Sql {
  if (!WORKSPACE_ID.test(workspace) && !/^[\w-]{1,64}$/.test(workspace)) throw new Error('bad workspace id');
  return async (text, params = []) => {
    const r = await call(octo, `/workspaces/${workspace}/query`, { sql: text, ...(params.length ? { params } : {}) });
    if (r.status >= 300) throw new Error(`octo query ${r.status}: ${String(r.json.error ?? r.json.message ?? '').slice(0, 160)}`);
    return (r.json.rows ?? []) as Record<string, unknown>[];
  };
}

// One workspace per business, so its slug names it: a retried add finds the one already made.
export const workspaceSlug = (business: string) => `copilot-${business}`;

// Creates a business's own workspace and returns its id. A taken slug means an earlier add created it and failed before
// recording it, so that workspace is returned rather than a second one (Octo allows one new workspace a day). The
// workspace's own first key, shown once, is dropped unread: the factory reaches the workspace with its account-wide key
// until each business's keys live in a key store (#128).
export async function createWorkspace(octo: Octo, business: string): Promise<string> {
  const slug = workspaceSlug(business);
  const r = await call(octo, '/workspaces', { name: `Copilot: ${business}`, slug, description: `The website copilot's data for ${business} (decision 0021).` });
  if (r.status === 201 && WORKSPACE_ID.test(r.json.workspace?.id ?? '')) return r.json.workspace.id;
  if (r.status === 409) {
    const list = await call(octo, '/workspaces');
    const found = (list.json.workspaces ?? []).find((w: { slug?: string; id?: string }) => w.slug === slug);
    if (found && WORKSPACE_ID.test(found.id ?? '')) return found.id;
  }
  const why = r.status === 429 ? 'Octo allows one new workspace a day; try again tomorrow'
    : r.status === 403 ? 'the Octo key is not account-wide' : String(r.json.error ?? '').slice(0, 160);
  throw new Error(`could not create a workspace for ${business} (${r.status}): ${why}`);
}
