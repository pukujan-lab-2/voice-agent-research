import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from recording import audio_signature, room_business  # noqa: E402


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


if __name__ == '__main__':
    unittest.main()
