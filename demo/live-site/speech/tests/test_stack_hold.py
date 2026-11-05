import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from stack_hold import DEFAULT_HOLD_S, StackHold  # noqa: E402


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class StackHoldTest(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.hold = StackHold(hold_s=300, clock=self.clock)

    def test_nothing_resident_or_the_same_stack_is_never_held(self):
        self.assertIsNone(self.hold.holds(None, 'multilingual', False))
        self.hold.used('english-fast')
        self.assertIsNone(self.hold.holds('english-fast', 'english-fast', True))

    def test_a_stack_in_use_is_held_whatever_its_age(self):
        self.hold.used('english-fast')
        self.clock.t += 5000
        self.assertEqual(self.hold.holds('english-fast', 'multilingual', True), 'english-fast')

    def test_a_stack_used_lately_is_held_until_the_hold_runs_out(self):
        # The NYC map's keeper asks every 4 minutes: a call's last turn is never older than that during a call.
        self.hold.used('english-fast')
        self.clock.t += 240
        self.assertEqual(self.hold.holds('english-fast', 'multilingual', False), 'english-fast')
        self.clock.t += 61
        self.assertIsNone(self.hold.holds('english-fast', 'multilingual', False), 'an idle stack gives way')

    def test_a_new_request_extends_the_hold(self):
        self.hold.used('english-fast')
        self.clock.t += 290
        self.hold.used('english-fast')
        self.clock.t += 290
        self.assertEqual(self.hold.holds('english-fast', 'multilingual', False), 'english-fast')

    def test_the_default_hold_is_thirty_minutes(self):
        self.assertEqual(DEFAULT_HOLD_S, 1800)
        hold = StackHold(clock=self.clock)
        hold.used('english-fast')
        self.clock.t += 29 * 60
        self.assertEqual(hold.holds('english-fast', 'multilingual', False), 'english-fast')
        self.clock.t += 2 * 60
        self.assertIsNone(hold.holds('english-fast', 'multilingual', False))

    def test_a_stack_never_used_is_not_held(self):
        self.assertIsNone(self.hold.holds('english-fast', 'multilingual', False))


if __name__ == '__main__':
    unittest.main()
