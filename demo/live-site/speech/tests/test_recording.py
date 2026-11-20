import asyncio, os, sys, tempfile, unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from recording import KEEP_MAX_AGE_S, SENDING_STALE_S, STREAM, audio_signature, deliver, keep, publish_recording, resend_kept, room_business  # noqa: E402


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


ROOM, CALL, AWAY = 'call-0a1b2c3d.clinic-test', 'call-0001-abcdef', 'redis://127.0.0.1:1'


def site(*answers):
    """A stand-in for the post to the site: answers with each status in turn (an exception is raised), and notes each call."""
    left, seen = list(answers), []

    async def post(headers, audio):
        seen.append((headers['x-call-id'], audio))
        answer = left.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer
    return post, seen


def quiet(*_):
    pass


class DeliverTest(unittest.TestCase):
    """One recording: the queue first, then one post to the site."""

    def send(self, post, queue_url=AWAY):
        return asyncio.run(deliver(b'audio', ROOM, CALL, secret='s', queue_url=queue_url, post=post, log=quiet))

    def test_with_redis_away_the_site_is_posted_to_and_its_answer_decides(self):
        for answer, outcome in ((200, 'saved'), (403, 'refused'), (404, 'refused'), (429, 'failed'), (502, 'failed'), (503, 'failed'), (OSError('down'), 'failed')):
            post, seen = site(answer)
            self.assertEqual(self.send(post), outcome, str(answer))
            self.assertEqual(seen, [(CALL, b'audio')])

    def test_without_a_queue_it_is_posted_straight_away(self):
        post, seen = site(200)
        self.assertEqual(self.send(post, queue_url=''), 'saved')
        self.assertEqual(len(seen), 1)

    def test_a_queued_recording_is_not_posted_as_well(self):
        import fakeredis

        post, seen = site()
        with mock.patch('redis.asyncio.from_url', lambda url, **kw: fakeredis.FakeAsyncRedis(server=fakeredis.FakeServer())):
            self.assertEqual(self.send(post, queue_url='redis://queue:6379'), 'queued')
        self.assertEqual(seen, [])

    def test_the_post_carries_the_signature_the_site_checks(self):
        headers = {}

        async def post(h, audio):
            headers.update(h)
            return 200
        self.send(post)
        self.assertEqual(headers['x-call-sig'], audio_signature('s', ROOM, CALL, b'audio'))
        self.assertEqual(headers['x-call-room'], ROOM)


class KeepTest(unittest.TestCase):
    """A recording that reached neither the queue nor the site waits on disk and is sent again."""

    def setUp(self):
        self.folder = tempfile.mkdtemp()
        self.clock = 1_800_000_000.0

    def kept(self):
        return sorted(os.listdir(self.folder))

    def resend(self, post):
        return asyncio.run(resend_kept(self.folder, secret='s', queue_url=AWAY, post=post, log=quiet, now=lambda: self.clock))

    def keep(self, call=CALL, audio=b'audio', age=0.0):
        path = keep(self.folder, ROOM, call, audio)
        os.utime(path, (self.clock - age, self.clock - age))
        return path

    def test_names_that_could_leave_the_folder_are_not_kept(self):
        self.assertIsNone(keep(self.folder, 'call-0a1b2c3d.clinic/../x', CALL, b'a'))
        self.assertIsNone(keep(self.folder, ROOM, '../../etc/passwd', b'a'))
        self.assertEqual(self.kept(), [])

    def test_a_kept_recording_is_sent_and_deleted_once_the_site_is_back(self):
        self.keep()
        post, seen = site(503, 200)
        self.assertEqual(self.resend(post)['waiting'], 1)
        self.assertEqual(self.kept(), [f'{ROOM}__{CALL}.ogg'], 'still there, under its own name')
        self.assertEqual(self.resend(post)['sent'], 1)
        self.assertEqual(self.kept(), [])
        self.assertEqual(seen, [(CALL, b'audio'), (CALL, b'audio')])

    def test_a_refused_recording_is_deleted_and_not_tried_again(self):
        self.keep()
        post, seen = site(403)
        self.assertEqual(self.resend(post)['refused'], 1)
        self.assertEqual(self.kept(), [])
        self.assertEqual(len(seen), 1)

    def test_after_a_day_it_is_deleted_without_being_sent(self):
        self.keep(age=KEEP_MAX_AGE_S - 1)
        post, seen = site(503)
        self.assertEqual(self.resend(post)['waiting'], 1)
        self.clock += 2
        self.assertEqual(self.resend(post)['expired'], 1)
        self.assertEqual(self.kept(), [])
        self.assertEqual(len(seen), 1, 'the expired one was not posted')

    def test_a_recording_another_agent_is_sending_is_left_alone_until_that_agent_is_long_gone(self):
        path = self.keep()
        taken = f'{path}.sending.{int(self.clock)}'
        os.rename(path, taken)
        post, seen = site(200)
        self.assertEqual(self.resend(post), {'sent': 0, 'refused': 0, 'waiting': 0, 'expired': 0})
        self.clock += SENDING_STALE_S + 1
        self.assertEqual(self.resend(post)['sent'], 1)
        self.assertEqual(self.kept(), [])

    def test_two_agents_going_through_the_folder_at_once_send_each_recording_once(self):
        for i in range(5):
            self.keep(call=f'call-000{i}-abcdef', audio=bytes([i]))
        sent = []

        async def post(headers, audio):
            await asyncio.sleep(0)   # let the other agent run between the claim and the send
            sent.append(headers['x-call-id'])
            return 200

        async def both():
            return await asyncio.gather(*(resend_kept(self.folder, secret='s', queue_url='', post=post, log=quiet, now=lambda: self.clock) for _ in range(2)))

        counts = asyncio.run(both())
        self.assertEqual(sorted(sent), [f'call-000{i}-abcdef' for i in range(5)])
        self.assertEqual(sum(c['sent'] for c in counts), 5)
        self.assertEqual(self.kept(), [])

    def test_other_files_in_the_folder_are_not_touched(self):
        open(os.path.join(self.folder, 'notes.txt'), 'w').close()
        open(os.path.join(self.folder, f'{ROOM}__{CALL}.ogg.part'), 'w').close()
        post, seen = site()
        self.resend(post)
        self.assertEqual(len(self.kept()), 2)
        self.assertEqual(seen, [])


if __name__ == '__main__':
    unittest.main()
