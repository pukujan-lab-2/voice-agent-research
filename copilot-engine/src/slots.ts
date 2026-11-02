// Model slots: one place that names, per task, which provider and model answers (decision 0017). LFM3 on our own
// server (`local`) is the default of every slot and the only thing production uses; a smart hosted model is an opt-in
// for development, and only a request that is in scope gets one (demo/live-site/api.ts decides that, not this file).
//   desk     the desk's tool and form decisions (a hard turn the local model got wrong)
//   reply    the spoken reply
//   rewrite  question rewrite and clarifying questions
//   judge2   a second opinion only where Jev is tied
//   eval     test generation and simulated callers (offline, never the product path)
// The file (demo/live-site/model-slots.json) is validated when the server starts; SLOT_<NAME>_PROVIDER / _MODEL /
// _TIMEOUT_MS / _DAILY_CAP override it. Keys are never here: a slot only names the env variable that holds its key.
// Pure code with no Node-only globals, so the eval and the backend share it.

export const SLOT_NAMES = ['desk', 'reply', 'rewrite', 'judge2', 'eval'] as const;
export type SlotName = (typeof SLOT_NAMES)[number];
export const PROVIDERS = ['local', 'inferhub', 'openrouter-free', 'workbuddy'] as const;
export type Provider = (typeof PROVIDERS)[number];

export type Slot = {
  name: SlotName; provider: Provider; model: string;
  smart: boolean; // a hosted model, not the local one
  url?: string; keyName?: string; stream: boolean; // where a hosted model is reached and the env variable holding its key
  routes: string[]; // the model ids tried in order, one per vendor route for inferhub (see ROUTES); the first is `model`
  timeoutMs: number; dailyCap: number;
};
export type Slots = Record<SlotName, Slot>;
type Env = Record<string, string | undefined>;

// A model in the product is open-weight (decision 0001): never a Claude or Gemma model, and never OpenRouter's router,
// which picks a model for us. Any model name containing one of these is rejected, whatever the provider or alias.
const BANNED = ['claude', 'gemma', 'openrouter/free'] as const;
export function bannedModelReason(model: string): string | null {
  const m = model.toLowerCase();
  const hit = BANNED.find(b => m.includes(b));
  return hit ? `a model named "${model}" is not allowed (names containing "${hit}" are rejected)` : null;
}

// Where each hosted provider is reached. The URL can be overridden by the env variable named here; the key is only named.
// InferHub's key is a 30-day lease of the Octo vault item `inferhub`, which works only through the vault proxy, so that is the default
// address (INFERHUB_BASE_URL set to https://api.inferhub.dev/v1 is for a real InferHub key).
const ENDPOINTS: Record<Exclude<Provider, 'local'>, { url: string; urlEnv: string; keyName: string; stream: boolean }> = {
  inferhub: { url: 'https://octodb.design-bakery.com/api/vault/proxy/https://api.inferhub.dev/v1', urlEnv: 'INFERHUB_BASE_URL', keyName: 'INFERHUB_API_KEY', stream: false },
  'openrouter-free': { url: 'https://openrouter.ai/api/v1', urlEnv: 'OPENROUTER_FREE_URL', keyName: 'OPENROUTER_FREE_KEY', stream: false },
  // the Octo vault proxy to WorkBuddy wants a system message first and a streamed reply
  workbuddy: { url: 'https://octodb.design-bakery.com/api/vault/proxy/https://www.workbuddy.ai/v2', urlEnv: 'WORKBUDDY_URL', keyName: 'WORKBUDDY_KEY', stream: true },
};

// The one InferHub model the product may use (owner decision, 2026-11-02) and the vendor routes InferHub serves it through. A slot
// names the bare id (InferHub picks a vendor itself) or one route; a failed call (402, 429, 5xx, a timeout) moves on to the next route,
// in the order the old LiteLLM gateway tried them (its router_settings.fallbacks), and then the local model answers.
const INFERHUB_MODEL = 'deepseek-v4.1-flash';
const VENDORS = ['cb', 'cbcn', 'ali', 'cp/cline-pass', 'ocg'] as const;
const inferhubRoutes = (model: string): string[] | null => {
  if (model === INFERHUB_MODEL) return [model, ...VENDORS.map(v => `${v}/${INFERHUB_MODEL}`)];
  const v = VENDORS.find(x => model === `${x}/${INFERHUB_MODEL}`);
  return v ? [model, ...VENDORS.filter(x => x !== v).map(x => `${x}/${INFERHUB_MODEL}`)] : null;
};

const DEFAULT_LOCAL_MODEL = 'lfm3';
const DEFAULT_TIMEOUT_MS = 8000; // a hosted model that is slower than this loses the turn to the local model
const DEFAULT_DAILY_CAP = 300;

export class SlotsError extends Error {}

type Raw = { provider?: unknown; model?: unknown; timeoutMs?: unknown; dailyCap?: unknown };
const fail = (slot: string, why: string): never => { throw new SlotsError(`model slot "${slot}": ${why}`); };
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

// The slots the file and env describe. No file and no env: every slot is the local model.
export function loadSlots(file: unknown, env: Env = {}): Slots {
  let slots: Record<string, Raw> = {};
  if (file !== undefined && file !== null) {
    const f = file as { version?: unknown; slots?: unknown };
    if (typeof f !== 'object' || Array.isArray(f) || f.version !== 1) throw new SlotsError('model slots file: expected {"version": 1, "slots": {...}}');
    if (!f.slots || typeof f.slots !== 'object' || Array.isArray(f.slots)) throw new SlotsError('model slots file: "slots" must be an object');
    for (const k of Object.keys(f)) if (k !== 'version' && k !== 'slots') throw new SlotsError(`model slots file: unknown key "${k}"`);
    slots = f.slots as Record<string, Raw>;
    for (const k of Object.keys(slots)) if (!(SLOT_NAMES as readonly string[]).includes(k)) fail(k, `unknown slot (known: ${SLOT_NAMES.join(', ')})`);
  }
  const out = {} as Slots;
  for (const name of SLOT_NAMES) {
    const raw = slots[name] ?? {};
    if (typeof raw !== 'object' || Array.isArray(raw)) fail(name, 'must be an object');
    for (const k of Object.keys(raw)) if (!['provider', 'model', 'timeoutMs', 'dailyCap'].includes(k)) fail(name, `unknown key "${k}"`);
    const up = `SLOT_${name.toUpperCase()}`;
    const fileProvider = text(raw.provider) ?? 'local';
    const provider = text(env[`${up}_PROVIDER`]) ?? fileProvider;
    // a model written for another provider is not carried over when the provider is switched by env
    const model = text(env[`${up}_MODEL`]) ?? (provider === fileProvider ? text(raw.model) : undefined);
    const timeoutMs = Number(text(env[`${up}_TIMEOUT_MS`]) ?? raw.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const dailyCap = Number(text(env[`${up}_DAILY_CAP`]) ?? raw.dailyCap ?? env.SMART_DAILY_CAP ?? DEFAULT_DAILY_CAP);
    if (!(PROVIDERS as readonly string[]).includes(provider)) fail(name, `unknown provider "${provider}" (known: ${PROVIDERS.join(', ')})`);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 60_000) fail(name, 'timeoutMs must be a whole number from 500 to 60000');
    if (!Number.isInteger(dailyCap) || dailyCap < 0 || dailyCap > 1_000_000) fail(name, 'dailyCap must be a whole number from 0 to 1000000');
    const p = provider as Provider;
    if (model) { const why = bannedModelReason(model); if (why) fail(name, why); }
    if (p === 'local') { const m = model ?? DEFAULT_LOCAL_MODEL; out[name] = { name, provider: p, model: m, smart: false, stream: false, routes: [m], timeoutMs, dailyCap }; continue; }
    if (!model) fail(name, `provider "${p}" needs a model`);
    if (p === 'openrouter-free' && !model!.endsWith(':free')) fail(name, `openrouter-free needs a named model ending in ":free", not "${model}"`);
    const routes = p === 'inferhub' ? inferhubRoutes(model!) : [model!];
    if (!routes) fail(name, `inferhub takes only ${INFERHUB_MODEL} (or one of its vendor routes, such as "cb/${INFERHUB_MODEL}"), not "${model}"`);
    const e = ENDPOINTS[p];
    out[name] = { name, provider: p, model: model!, smart: true, url: (text(env[e.urlEnv]) ?? e.url).replace(/\/$/, ''), keyName: e.keyName, stream: e.stream, routes: routes!, timeoutMs, dailyCap };
  }
  return out;
}

// The model name a hosted provider says it used. A gateway can map a name to another model, so the answer is checked
// too: a banned name there means the answer is dropped and the local model answers instead.
export const reportedModelOk = (reported: string): boolean => !bannedModelReason(reported);
