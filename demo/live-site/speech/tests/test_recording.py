import asyncio, os, sys, unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from recording import STREAM, audio_signature, publish_recording, room_business  # noqa: E402


class RecordingTest(unittest.TestCase):
    def test_only_rooms_the_site_named_for_a_business_are_recorded(self):
        self.assertEqual(room_business('call-0a1b2c3d.clinic-test'), 'clinic-test')
        self.assertEqual(room_business('call-0a1b2c3d'), '')
        self.assertEqual(room_business('call-0a1b2c3d.Clinic'), '')
        self.assertEqual(room_business('call-0a1b2c3d.clinic/../x'), '')

    def test_the_signature_matches_the_site(self):
        # The same value demo/live-site/tests/own-workspace.test.ts checks against api.ts audioSignature.
        self.assertEqual(audio_signature('s', 'call-0a1b2c3d.clinic-test', 'call-0001-abcdef', b'OggS fake audio'),
                         '5e364d6973d7e9e0413de5f9d1155b4212a86a758a68a07bc1aa6d46bbdaf130')


class PublishTest(unittest.TestCase):
    """publish_recording against fakeredis, a stand-in Redis that runs in this process and speaks the real client's commands."""

    def test_the_recording_goes_on_the_stream_as_one_message_with_its_bytes_unchanged(self):
        import fakeredis

        server = fakeredis.FakeServer()
        audio = b'OggS\x00\xff\xfe not text'

        async def run():
            with mock.patch('redis.asyncio.from_url', lambda url, **kw: fakeredis.FakeAsyncRedis(server=server)):
                added = await publish_recording('redis://queue:6379', 'call-0a1b2c3d.clinic-test', 'call-0001-abcdef', 'sig', audio)
            reader = fakeredis.FakeAsyncRedis(server=server)
            try:
                return added, await reader.xrange(STREAM)
            finally:
                await reader.aclose()

        added, messages = asyncio.run(run())
        self.assertEqual(len(messages), 1)
        message_id, fields = messages[0]
        self.assertEqual(message_id.decode(), added)
        self.assertEqual(fields, {b'room': b'call-0a1b2c3d.clinic-test', b'call': b'call-0001-abcdef', b'sig': b'sig',
                                  b'type': b'audio/ogg', b'audio': audio})

    def test_a_redis_that_is_away_raises_so_the_agent_can_post_the_recording_instead(self):
        import redis

        with self.assertRaises(redis.exceptions.ConnectionError):
            asyncio.run(publish_recording('redis://127.0.0.1:1', 'call-0a1b2c3d.clinic-test', 'call-0001-abcdef', 'sig', b'audio'))

    @unittest.skipUnless(os.environ.get('RECORDING_QUEUE_TEST_URL'), 'RECORDING_QUEUE_TEST_URL is not set')
    def test_on_a_real_redis_a_3_mb_recording_is_read_back_unchanged(self):
        import redis

        url = os.environ['RECORDING_QUEUE_TEST_URL']
        audio = bytes(range(256)) * (3 * 4096)
        reader = redis.Redis.from_url(url)
        try:
            reader.delete(STREAM)
            added = asyncio.run(publish_recording(url, 'call-0a1b2c3d.clinic-test', 'call-0001-abcdef', 'sig', audio))
            [(message_id, fields)] = reader.xrange(STREAM)
            self.assertEqual(message_id.decode(), added)
            self.assertEqual(fields[b'audio'], audio)
            reader.delete(STREAM)
        finally:
            reader.close()


if __name__ == '__main__':
    unittest.main()
