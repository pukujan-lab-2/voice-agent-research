// The site's wake call for the sleeping voice agent (sablier.ts, #117), against a stand-in fetch and clock.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWaker } from '../sablier.ts';

function stand(answer: () => Promise<Response> = async () => new Response('ok')) {
  const urls: string[] = [];
  let t = 1_000_000;
  const fetch = (async (u: string | URL | Request) => { urls.push(String(u)); return answer(); }) as typeof globalThis.fetch;
  return { urls, fetch, now: () => t, later: (ms: number) => { t += ms; } };
}

test('without a Sablier or an agent name nothing is called and the agent counts as ready', async () => {
  for (const deps of [{ url: '', name: 'copilot-agent-abc' }, { url: 'http://sablier:10000', name: '' }]) {
    const s = stand();
    const w = createWaker({ ...deps, fetch: s.fetch, now: s.now });
    w.poke();
    assert.equal(await w.ready(30), true);
    assert.deepEqual(s.urls, []);
  }
});

test('the widget loading starts the agent without waiting, at most once a minute', () => {
  const s = stand();
  const w = createWaker({ url: 'http://sablier:10000/', name: 'copilot-agent-abc', fetch: s.fetch, now: s.now });
  w.poke(); w.poke();
  s.later(59_000); w.poke();
  s.later(2_000); w.poke();
  assert.deepEqual(s.urls, ['http://sablier:10000/api/strategies/poke?names=copilot-agent-abc', 'http://sablier:10000/api/strategies/poke?names=copilot-agent-abc']);
});

test('the call button waits for the agent by name, and two callers at once share one wait', async () => {
  const s = stand();
  const w = createWaker({ url: 'http://sablier:10000', name: 'copilot-agent-abc', fetch: s.fetch, now: s.now });
  assert.deepEqual(await Promise.all([w.ready(30), w.ready(30)]), [true, true]);
  assert.deepEqual(s.urls, ['http://sablier:10000/api/strategies/blocking?names=copilot-agent-abc&timeout=30s']);
});

test('an agent seen ready in the last 30 seconds is not asked about again', async () => {
  const s = stand();
  const w = createWaker({ url: 'http://sablier:10000', name: 'copilot-agent-abc', fetch: s.fetch, now: s.now });
  await w.ready(30);
  s.later(29_000); await w.ready(30);
  assert.equal(s.urls.length, 1);
  s.later(2_000); await w.ready(30);
  assert.equal(s.urls.length, 2);
});

test('an agent that did not get ready, or a Sablier that is down, gives false and is asked again next time', async () => {
  const late = stand(async () => new Response('timeout', { status: 504 }));
  const w = createWaker({ url: 'http://sablier:10000', name: 'copilot-agent-abc', fetch: late.fetch, now: late.now });
  assert.equal(await w.ready(30), false);
  assert.equal(await w.ready(30), false);
  assert.equal(late.urls.length, 2);
  const down = stand(async () => { throw new TypeError('fetch failed'); });
  assert.equal(await createWaker({ url: 'http://sablier:10000', name: 'copilot-agent-abc', fetch: down.fetch, now: down.now }).ready(30), false);
});
