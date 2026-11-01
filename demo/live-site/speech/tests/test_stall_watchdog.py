import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from stall_watchdog import StallWatchdog  # noqa: E402


class Clock:
    def __init__(self):
        self.t = 100.0

    def __call__(self):
        return self.t


class StallWatchdogTest(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.dog = StallWatchdog(speaking_s=30, silent_s=8, clock=self.clock)

    def test_a_normal_turn_never_stalls(self):
        self.dog.speech_started()
        self.clock.t += 4
        self.dog.speech_ended()
        self.clock.t += 0.2
        self.dog.recognising()
        self.clock.t += 120  # the recogniser and the reply can take as long as they like: they have their own timeouts
        self.assertIsNone(self.dog.check())

    def test_speech_that_ends_with_no_recogniser_request_is_a_stall(self):
        self.dog.speech_started()
        self.clock.t += 2
        self.dog.speech_ended()
        self.clock.t += 7
        self.assertIsNone(self.dog.check())
        self.clock.t += 2
        kind, seconds = self.dog.check()
        self.assertEqual(kind, 'speech-without-turn')
        self.assertAlmostEqual(seconds, 9)

    def test_a_blip_is_not_a_turn(self):
        self.dog.speech_started()
        self.clock.t += 0.2
        self.dog.speech_ended()
        self.clock.t += 60
        self.assertIsNone(self.dog.check())

    def test_a_detector_stuck_on_speech_is_a_stall(self):
        self.dog.speech_started()
        self.clock.t += 31
        self.assertEqual(self.dog.check()[0], 'speech-without-end')

    def test_a_stall_is_reported_once_and_the_watchdog_starts_over(self):
        self.dog.speech_started()
        self.clock.t += 2
        self.dog.speech_ended()
        self.clock.t += 20
        self.assertIsNotNone(self.dog.check())
        self.assertIsNone(self.dog.check())
        self.clock.t += 20
        self.assertIsNone(self.dog.check())  # nothing is owed until the caller speaks again

    def test_new_speech_while_a_turn_is_owed_clears_it(self):
        self.dog.speech_started()
        self.clock.t += 2
        self.dog.speech_ended()
        self.clock.t += 5
        self.dog.speech_started()
        self.clock.t += 5
        self.assertIsNone(self.dog.check())

    def test_a_quiet_call_never_stalls(self):
        self.clock.t += 3600
        self.assertIsNone(self.dog.check())


if __name__ == '__main__':
    unittest.main()
