// Cloudflare Pages Function: the same backend as server.ts, on the same origin as the static pages.
// Keys are Pages secrets (OPENROUTER_JEV_KEY, OCTO_KEY, OCTO_WORKSPACE, SIGNING_SECRET); they never reach the browser.
import { createApi, type ApiEnv } from '../../api.ts';

let api: ReturnType<typeof createApi> | undefined;
export const onRequest = (ctx: { request: Request; env: ApiEnv }) => {
  api ??= createApi(ctx.env);
  return api.handle(ctx.request, ctx.request.headers.get('cf-connecting-ip') ?? '');
};
