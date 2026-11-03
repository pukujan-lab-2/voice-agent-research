// Wakes the voice agent on the VPS (#117). The VPS's one Sablier (server-management komodo/resources/platform.toml) stops the
// agent's container after 10 idle minutes. Nothing ever reaches the agent that could wake it: it connects out to LiveKit and keeps
// that connection open. So this server wakes it: without waiting when the widget loads, and waiting, before the room's token is
// handed out, when the call button is pressed. LiveKit gives a new room's job only to the workers registered when the room is
// created, so an agent that registers a moment later would never join that call. During a call the agent renews its own session
// (speech/agent.py keep_awake), so a long call is not cut.
// SABLIER_AGENT is the container of this release's agent (deploy/vps/autodeploy.sh puts it in deploy/.env); it is woken by name,
// because the group also holds the stopped agents of older releases. Without SABLIER_URL or SABLIER_AGENT (local runs, tests)
// nothing is called and the agent counts as ready.

// At most one start-without-waiting a minute, however many pages load.
const POKE_EVERY_MS = 60_000;
// An agent seen ready this recently is still up: its idle clock runs for 10 minutes.
const READY_FOR_MS = 30_000;

type Deps = { url?: string; name?: string; fetch?: typeof fetch; now?: () => number };

export function createWaker({ url = process.env.SABLIER_URL ?? '', name = process.env.SABLIER_AGENT ?? '', fetch: get = fetch, now = Date.now }: Deps = {}) {
  const base = name ? url.replace(/\/$/, '') : '';
  const names = `names=${encodeURIComponent(name)}`;
  let poked = -Infinity, seen = -Infinity;
  let waiting: Promise<boolean> | null = null;
  return {
    // Starts the agent if it sleeps, without waiting (the widget loaded). Never throws.
    poke(): void {
      if (!base || now() - poked < POKE_EVERY_MS) return;
      poked = now();
      void get(`${base}/api/strategies/poke?${names}`, { signal: AbortSignal.timeout(5000) }).catch(() => undefined);
    },
    // Starts the agent if it sleeps and waits until it has registered with LiveKit (its health check), up to timeoutS. True when it
    // is ready or there is no Sablier to ask; false when it did not get ready in time or Sablier could not be asked.
    ready(timeoutS: number): Promise<boolean> {
      if (!base || now() - seen < READY_FOR_MS) return Promise.resolve(true);
      waiting ??= get(`${base}/api/strategies/blocking?${names}&timeout=${timeoutS}s`, { signal: AbortSignal.timeout((timeoutS + 5) * 1000) })
        .then(res => {
          if (res.ok) seen = now();
          return res.ok;
        }, () => false)
        .finally(() => { waiting = null; });
      return waiting;
    },
  };
}
