// Model calls for the eval: an open chat model (generator and simulated caller) and Jev (checker and rubric judge).
// Providers, all named in the corpus config:
//   openrouter-free  a named free model on the free-only OpenRouter key (never the openrouter/free router)
//   workbuddy        WorkBuddy (DeepSeek, Qwen) through the Octo vault proxy; key in WORKBUDDY_KEY (a lease, never minted here)
//   llama            any OpenAI-compatible server (llama.cpp), no key
//   litellm          the VPS gateway with the copilot's virtual key (LITELLM_COPILOT_KEY, LITELLM_URL); only through the `eval` slot
// The `eval` model slot (decision 0017, demo/live-site/model-slots.json) can replace the corpus config's model for the generator and
// the simulated callers; with the slot on `local` the config decides, as before. A model named claude, gemma or openrouter/free is refused.
// Every call is counted, timed and costed in `usage`, so the report can show spend per suite.
import fs from 'node:fs';
import { bannedModelReason, loadSlots, type Slot } from '../../copilot-engine/src/slots.ts';
import { key } from './env.ts';

export type ChatCfg = { provider: 'openrouter-free' | 'workbuddy' | 'llama' | 'litellm'; model: string; url?: string; temperature?: number };
export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

// The eval slot: the file next to the backend's (MODEL_SLOTS_FILE names another) with env overrides. Read once.
let evalSlotCache: Slot | undefined;
export function evalSlot(): Slot {
  if (!evalSlotCache) {
    const file = process.env.MODEL_SLOTS_FILE || new URL('../../demo/live-site/model-slots.json', import.meta.url).pathname;
    evalSlotCache = loadSlots(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined, process.env).eval;
  }
  return evalSlotCache;
}
// What a call really uses: the slot's smart model when the slot names one, else the config's own model.
export function viaSlot(cfg: ChatCfg, slot: Slot): ChatCfg {
  if (!slot.smart) return cfg;
  return { provider: slot.provider as ChatCfg['provider'], model: slot.model, url: slot.url, temperature: cfg.temperature };
}

export const usage: Record<string, { calls: number; cost: number; ms: number; failed: number }> = {};
const note = (what: string, ms: number, cost = 0, failed = false) => {
  const u = (usage[what] ??= { calls: 0, cost: 0, ms: 0, failed: 0 });
  u.calls++; u.cost += cost; u.ms += ms; if (failed) u.failed++;
};
export const totalCost = () => Object.values(usage).reduce((s, u) => s + u.cost, 0);

// Hard stop for spend: the run refuses any paid call once this is reached (set from the config).
export let budget = 3;
export const setBudget = (usd: number) => { budget = usd; };
class OverBudget extends Error {}
const guard = () => { if (totalCost() >= budget) throw new OverBudget(`model spend reached $${budget}`); };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function chat(cfg: ChatCfg, messages: Msg[], opts: { what: string; maxTokens?: number; json?: boolean }): Promise<string> {
  guard();
  cfg = viaSlot(cfg, evalSlot());
  const banned = bannedModelReason(cfg.model);
  if (banned) throw new Error(banned);
  if (cfg.provider === 'litellm' && !process.env.LITELLM_URL) throw new Error('litellm needs LITELLM_URL: the gateway listens on the VPS loopback (ssh -L 4001:127.0.0.1:4001 vps, then LITELLM_URL=http://127.0.0.1:4001/v1)');
  const wb = cfg.provider === 'workbuddy';
  const url = cfg.provider === 'llama' ? `${cfg.url}/v1/chat/completions`
    : cfg.provider === 'litellm' ? `${cfg.url}/chat/completions`
    : wb ? `${cfg.url ?? 'https://octodb.design-bakery.com/api/vault/proxy/https://www.workbuddy.ai/v2'}/chat/completions`
    : 'https://openrouter.ai/api/v1/chat/completions';
  const auth = cfg.provider === 'llama' ? undefined : cfg.provider === 'litellm' ? key('LITELLM_COPILOT_KEY') : wb ? key('WORKBUDDY_KEY') : key('openrouter_free_only', 'OPENROUTER_FREE_KEY');
  if (cfg.provider !== 'llama' && !auth) throw new Error(`no key for ${cfg.provider}`);
  if (cfg.provider === 'openrouter-free' && !cfg.model.endsWith(':free')) throw new Error('openrouter-free needs a named :free model');
  // WorkBuddy's proxy wants a system message first and a streamed reply.
  if (wb && messages[0]?.role !== 'system') messages = [{ role: 'system', content: 'You are a helpful assistant.' }, ...messages];
  for (let attempt = 0; attempt < 4; attempt++) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, {
        method: 'POST', signal: AbortSignal.timeout(120000),
        headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
        body: JSON.stringify({ model: cfg.model, messages, temperature: cfg.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 1200,
          ...(opts.json && !wb ? { response_format: { type: 'json_object' } } : {}), ...(wb ? { stream: true } : {}),
          // the open models think out loud by default and can spend the whole budget on it; these sets don't need it
          ...(cfg.provider === 'openrouter-free' ? { reasoning: { enabled: false } } : {}), ...(cfg.provider === 'llama' ? { chat_template_kwargs: { enable_thinking: false } } : {}) }),
      });
      if (!r.ok) {
        note(opts.what, Date.now() - t0, 0, true);
        if (r.status === 429 || r.status >= 500) { await sleep(4000 * (attempt + 1)); continue; }
        throw new Error(`${cfg.provider} ${r.status}: ${(await r.text()).slice(0, 200)}`);
      }
      let text = '', cost = 0;
      if (wb) {
        for (const line of (await r.text()).split('\n')) {
          if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
          try { const j = JSON.parse(line.slice(5)); text += j.choices?.[0]?.delta?.content ?? ''; cost = j.usage?.cost ?? cost; } catch { /* keep-alive */ }
        }
      } else {
        const j = await r.json();
        text = j.choices?.[0]?.message?.content ?? '';
        cost = j.usage?.cost ?? 0;
      }
      note(opts.what, Date.now() - t0, cost);
      return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    } catch (e) {
      if (e instanceof OverBudget) throw e;
      if (attempt === 3) throw e;
      await sleep(3000 * (attempt + 1));
    }
  }
  return '';
}

// The first JSON object in a model reply (models wrap it in prose or code fences).
export function firstJson<T = any>(text: string): T | null {
  const s = text.indexOf('{');
  if (s < 0) return null;
  for (let e = text.lastIndexOf('}'); e > s; e = text.lastIndexOf('}', e - 1)) {
    try { return JSON.parse(text.slice(s, e + 1)); } catch { /* shorter */ }
  }
  return null;
}

// Jev (typesafe decisions model): one or more choice questions about a state object. Returns each question's choice
// and its probability, or null when Jev never answers.
export type Choice = { choice: string; p: number };
export async function jev(state: Record<string, unknown>, questions: Record<string, { instructions: string; criteria: Record<string, string> }>, what: string): Promise<Record<string, Choice> | null> {
  guard();
  const k = key('OPENROUTER_JEV_KEY', 'openrouter_jev_only');
  for (let attempt = 0; attempt < 4; attempt++) {
    const t0 = Date.now();
    try {
      const r = await fetch(process.env.JEV_URL || 'https://openrouter.ai/api/alpha/decisions', {
        method: 'POST', signal: AbortSignal.timeout(40000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}`, 'User-Agent': 'copilot-eval/0.1' },
        body: JSON.stringify({ model: 'typesafe/jev-1.14', state,
          questions: Object.fromEntries(Object.entries(questions).map(([n, q]) => [n, { type: 'choice', ...q }])) }),
      });
      if (!r.ok) { note(what, Date.now() - t0, 0, true); await sleep(1500 * (attempt + 1)); continue; }
      const j = await r.json();
      note(what, Date.now() - t0, j.usage?.cost ?? 0);
      const out: Record<string, Choice> = {};
      for (const n of Object.keys(questions)) {
        const a = j.answers?.[n];
        out[n] = { choice: a?.choice ?? '', p: +(a?.probabilities?.[a?.choice] ?? 0).toFixed(2) };
      }
      return out;
    } catch { note(what, Date.now() - t0, 0, true); await sleep(1500 * (attempt + 1)); }
  }
  return null;
}
