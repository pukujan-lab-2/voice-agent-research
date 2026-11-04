import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from activity import Activity  # noqa: E402


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class ActivityTest(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.activity = Activity(clock=self.clock)

    def test_a_request_in_flight_is_counted_and_never_idle(self):
        with self.activity.request():
            self.clock.t += 50
            self.assertEqual(self.activity.snapshot(), {'inflight': 1, 'idle_s': 0.0})

    def test_idle_time_counts_from_the_end_of_the_last_request(self):
        with self.activity.request():
            self.clock.t += 5
        self.clock.t += 12
        self.assertEqual(self.activity.snapshot(), {'inflight': 0, 'idle_s': 12.0})

    def test_overlapping_requests_each_count(self):
        with self.activity.request(), self.activity.request():
            self.assertEqual(self.activity.snapshot()['inflight'], 2)
        self.assertEqual(self.activity.snapshot()['inflight'], 0)

    def test_a_request_that_fails_is_still_counted_out(self):
        with self.assertRaises(RuntimeError):
            with self.activity.request():
                raise RuntimeError('boom')
        self.assertEqual(self.activity.snapshot()['inflight'], 0)


if __name__ == '__main__':
    unittest.main()
