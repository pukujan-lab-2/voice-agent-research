"""Print how many calls are open: rooms that hold a caller (anything but the agent). Run inside copilot-agent, which has
LiveKit's address and keys: `docker exec -i copilot-agent python - < open-calls.py`. autodeploy.sh waits on it before it
replaces the agent, because a new agent never joins a room that already exists (#67)."""
import asyncio
import os

from livekit import api
from livekit.protocol.models import ParticipantInfo


async def main() -> None:
    lk = api.LiveKitAPI(os.environ['LIVEKIT_URL'].replace('ws', 'http', 1), os.environ['LIVEKIT_API_KEY'], os.environ['LIVEKIT_API_SECRET'])
    try:
        open_calls = 0
        for room in (await lk.room.list_rooms(api.ListRoomsRequest())).rooms:
            people = (await lk.room.list_participants(api.ListParticipantsRequest(room=room.name))).participants
            open_calls += any(p.kind != ParticipantInfo.Kind.AGENT for p in people)
        print(open_calls)
    finally:
        await lk.aclose()


asyncio.run(main())
