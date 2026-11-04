// Decides whether the voice agent has really left a call. LiveKit's client emits a disconnect for every remote participant
// when it reconnects (a microphone that sends almost nothing, or a flaky link, is enough), so "the agent disconnected" is not
// "the agent is gone": wait for the reconnect to finish and for a short while after it, then look at the room (#95). An
// agent that is back in the room by then cancels the check.
export type WatchedRoom = { remoteParticipants: Map<string, { isAgent?: boolean }> };
type Timers = { set: (f: () => void, ms: number) => unknown; clear: (t: unknown) => void };
export const SETTLE_MS = 4000;

export function watchAgent(room: WatchedRoom, onLost: () => void, o: { settleMs?: number; timers?: Timers } = {}) {
  const t: Timers = o.timers ?? { set: (f, ms) => setTimeout(f, ms), clear: x => clearTimeout(x as ReturnType<typeof setTimeout>) };
  const settle = o.settleMs ?? SETTLE_MS;
  let timer: unknown;
  let reconnecting = false;
  let checkAfterReconnect = false;
  const agentHere = () => [...room.remoteParticipants.values()].some(p => p.isAgent);
  const cancel = () => { if (timer !== undefined) t.clear(timer); timer = undefined; checkAfterReconnect = false; };
  const arm = () => {
    if (timer !== undefined) t.clear(timer);
    timer = t.set(() => {
      timer = undefined;
      if (reconnecting) { checkAfterReconnect = true; return; } // still reconnecting: look again once it is done
      if (!agentHere()) onLost();
    }, settle);
  };
  return {
    agentLeft: arm,                 // ParticipantDisconnected for the agent
    agentJoined: cancel,            // ParticipantConnected for the agent
    reconnecting: () => { reconnecting = true; },
    reconnected: () => { reconnecting = false; if (checkAfterReconnect || timer !== undefined) { checkAfterReconnect = false; arm(); } },
    stop: cancel,
  };
}
