// Signing a business's people in with Octo (#131): OAuth 2.1 with PKCE against Octo's own server, as a web app (octo-database
// docs/ARCHITECTURE.md, "Signing people in from a web app"). The person signs in with Google on Octo and picks one
// workspace; the token is bound to it. `me()` asks Octo who they are and their live role in that workspace, which is null
// once they are no longer a member. The copilot keeps no key of its own for this and no refresh token: an hour's token,
// then the person signs in again. No Node imports: Web Crypto and fetch only.

export type OctoMe = { principal: string; email: string; workspace: string | null; role: string | null };

// Where the copilot keeps its client registration (one per redirect address), so Octo isn't asked again on each sign-in.
export interface ClientStore { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }

const b64url = (b: Uint8Array) => { let s = ''; for (const c of b) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };

export class OctoSignIn {
  private octo: string; private redirect: string; private store: ClientStore; private timeoutMs: number;
  private resource?: string;
  constructor(o: { octo: string; redirect: string; store: ClientStore; timeoutMs?: number }) {
    this.octo = o.octo.replace(/\/(api\/?)?$/, ''); this.redirect = o.redirect; this.store = o.store; this.timeoutMs = o.timeoutMs ?? 8000;
  }

  private async req(path: string, init: RequestInit = {}): Promise<Record<string, any>> {
    const r = await fetch(`${this.octo}${path}`, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    const text = await r.text();
    if (!r.ok) throw new Error(`octo ${path.split('?')[0]}: ${r.status} ${text.slice(0, 120)}`);
    return text ? JSON.parse(text) : {};
  }

  private async target(): Promise<string> {
    this.resource ??= String((await this.req('/.well-known/oauth-protected-resource')).resource);
    return this.resource;
  }

  private async clientId(): Promise<string> {
    const key = `octo-oauth-client:${this.redirect}`, have = await this.store.get(key);
    if (typeof have === 'string') return have;
    const r = await this.req('/oauth/register', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'Copilot business access', redirect_uris: [this.redirect], token_endpoint_auth_method: 'none' }) });
    await this.store.set(key, String(r.client_id));
    return String(r.client_id);
  }

  // Where to send the person, and the secret half of PKCE the callback needs back.
  async start(state: string): Promise<{ url: string; verifier: string }> {
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const q = new URLSearchParams({ response_type: 'code', client_id: await this.clientId(), redirect_uri: this.redirect, scope: 'read', state,
      code_challenge: challenge, code_challenge_method: 'S256', resource: await this.target() });
    return { url: `${this.octo}/oauth/authorize?${q}`, verifier };
  }

  async finish(code: string, verifier: string): Promise<{ token: string; until: number }> {
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: await this.clientId(), redirect_uri: this.redirect });
    const r = await this.req('/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    return { token: String(r.access_token), until: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
  }

  async me(token: string): Promise<OctoMe> {
    const r = await this.req('/api/me', { headers: { authorization: `Bearer ${token}` } });
    return { principal: String(r.principal?.id ?? ''), email: String(r.principal?.email ?? '').toLowerCase(), workspace: r.workspace?.id ?? null, role: r.workspace?.role ?? null };
  }

  // The workspace's members, read with the person's own token (Octo allows the owner or an admin).
  async members(token: string, workspace: string): Promise<{ members: { email: string; role: string; displayName?: string }[]; pending: { email: string; role: string }[] }> {
    const r = await this.req(`/api/workspaces/${encodeURIComponent(workspace)}/members`, { headers: { authorization: `Bearer ${token}` } });
    return { members: r.members ?? [], pending: r.pending ?? [] };
  }
}
