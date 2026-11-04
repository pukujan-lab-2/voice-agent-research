// A reconnect is not the voice agent leaving (#95). A fake room and fake timers stand in for LiveKit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { watchAgent } from '../widget/agent-watch.ts';

function rig(settleMs = 4000) {
  const room = { remoteParticipants: new Map<string, { isAgent?: boolean }>([['agent-1', { isAgent: true }]]) };
  let now = 0, lost = 0;
  const pending = new Map<number, { at: number; f: () => void }>();
  let id = 0;
  const timers = { set: (f: () => void, ms: number) => { pending.set(++id, { at: now + ms, f }); return id; }, clear: (x: unknown) => { pending.delete(x as number); } };
  const w = watchAgent(room, () => { lost++; }, { settleMs, timers });
  const advance = (ms: number) => { now += ms; for (const [k, p] of [...pending]) if (p.at <= now) { pending.delete(k); p.f(); } };
  return { room, w, advance, lost: () => lost };
}

test('a reconnect that emits a disconnect for the agent, with the agent still in the room, does not end the call', () => {
  const r = rig();
  r.w.reconnecting();
  r.w.agentLeft();           // livekit-client: "local connection quality lost… triggering full reconnect"
  r.advance(10_000);         // the reconnect takes longer than the wait
  assert.equal(r.lost(), 0, 'still reconnecting: no verdict');
  r.w.reconnected();
  r.advance(3_999);
  assert.equal(r.lost(), 0);
  r.advance(1);              // the agent is in the room after the reconnect
  assert.equal(r.lost(), 0, 'the agent is there, so the call goes on');
});

test('a disconnect with the agent back in the room before the wait is over is ignored', () => {
  const r = rig();
  r.room.remoteParticipants.delete('agent-1');
  r.w.agentLeft();
  r.advance(2_000);
  r.room.remoteParticipants.set('agent-1', { isAgent: true });
  r.w.agentJoined();
  r.advance(10_000);
  assert.equal(r.lost(), 0);
});

test('an agent that is really gone is lost once the wait is over, once', () => {
  const r = rig();
  r.room.remoteParticipants.delete('agent-1');
  r.w.agentLeft();
  r.advance(3_999);
  assert.equal(r.lost(), 0, 'not before the wait');
  r.advance(1);
  assert.equal(r.lost(), 1);
  r.advance(60_000);
  assert.equal(r.lost(), 1);
});

test('an agent that is gone after the reconnect finishes is lost after the wait that follows the reconnect', () => {
  const r = rig();
  r.w.reconnecting();
  r.room.remoteParticipants.delete('agent-1');
  r.w.agentLeft();
  r.advance(5_000);
  r.w.reconnected();
  r.advance(3_999);
  assert.equal(r.lost(), 0);
  r.advance(1);
  assert.equal(r.lost(), 1);
});

test('stopping the watch drops a pending check', () => {
  const r = rig();
  r.room.remoteParticipants.delete('agent-1');
  r.w.agentLeft();
  r.w.stop();
  r.advance(60_000);
  assert.equal(r.lost(), 0);
});
