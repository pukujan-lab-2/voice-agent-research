"""A caller for tests/deploy-sequence.ts: joins a LiveKit room, plays /agent/say.wav (24 kHz mono, made with macOS `say`) into it
in real time for SECONDS or until SIGTERM, and prints one JSON line a second: the release and heard-count the agent reports."""
import asyncio
import json
import os
import signal
import time
import wave

from livekit import rtc


async def main():
    stop = asyncio.Event()
    asyncio.get_running_loop().add_signal_handler(signal.SIGTERM, stop.set)
    room = rtc.Room()
    await room.connect(os.environ['URL'], os.environ['TOKEN'])
    source = rtc.AudioSource(24000, 1)
    await room.local_participant.publish_track(rtc.LocalAudioTrack.create_audio_track('mic', source), rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE))
    with wave.open('/agent/say.wav') as w:
        pcm = w.readframes(w.getnframes())
    end = time.time() + float(os.environ['SECONDS'])

    async def talk():
        step = 480 * 2  # 20 ms of 16-bit samples
        while not stop.is_set() and time.time() < end:
            for i in range(0, len(pcm) - step, step):
                if stop.is_set() or time.time() >= end:
                    return
                await source.capture_frame(rtc.AudioFrame(pcm[i:i + step], 24000, 1, 480))
                await asyncio.sleep(0.015)

    talking = asyncio.ensure_future(talk())
    t = 0
    while not stop.is_set() and time.time() < end:
        agent = next((p.attributes for p in room.remote_participants.values() if 'release' in p.attributes), {})
        print(json.dumps({'t': t, 'release': agent.get('release'), 'heard': int(agent.get('heard', 0))}), flush=True)
        t += 1
        try:
            await asyncio.wait_for(stop.wait(), 1)
        except asyncio.TimeoutError:
            pass
    talking.cancel()
    await room.disconnect()


asyncio.run(main())
