"""A stand-in voice agent for tests/deploy-sequence.ts: the real LiveKit Agents 1.8.8 worker (drain on SIGTERM, drain_timeout as in
speech/agent.py), with a job that only counts the audio it hears and reports it on its participant attributes. Not shipped in the
agent image; the test builds its own image from it."""
import asyncio
import os

from livekit import rtc
from livekit.agents import AgentServer, JobContext, cli

RELEASE = open('/agent/release.txt').read().strip()
server = AgentServer(num_idle_processes=1, load_fnc=lambda: 0.0, load_threshold=1.0, drain_timeout=int(os.environ.get('AGENT_DRAIN_S', 1200)))
server.on('worker_registered', lambda *_: open('/run/agent/registered', 'w').close())  # the compose file's health check, as in speech/agent.py


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    heard, started, tasks = 0, set(), []

    async def listen(track: rtc.Track):
        nonlocal heard
        async for ev in rtc.AudioStream(track):
            heard += ev.frame.samples_per_channel

    def hear(track: rtc.Track):
        if track.kind == rtc.TrackKind.KIND_AUDIO and track.sid not in started:
            started.add(track.sid)
            tasks.append(asyncio.ensure_future(listen(track)))

    ctx.room.on('track_subscribed', lambda track, pub, p: hear(track))
    await ctx.connect()
    caller = await ctx.wait_for_participant()
    for pub in caller.track_publications.values():
        if pub.track:
            hear(pub.track)
    while caller.identity in ctx.room.remote_participants:
        await ctx.room.local_participant.set_attributes({'release': RELEASE, 'heard': str(heard)})
        await asyncio.sleep(0.5)
    ctx.shutdown()


if __name__ == '__main__':
    cli.run_app(server)
