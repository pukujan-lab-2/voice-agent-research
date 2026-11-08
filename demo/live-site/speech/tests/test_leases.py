import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from leases import Leases  # noqa: E402


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class LeasesTest(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.leases = Leases(ttl_s=90, clock=self.clock)

    def test_each_call_counts_once_by_its_stack(self):
        self.leases.take('room-a', 'english-fast')
        self.leases.take('room-a', 'english-fast')
        self.leases.take('room-b', 'multilingual')
        self.assertEqual(self.leases.count(), 2)
        self.assertEqual(self.leases.by_stack(), {'english-fast': 1, 'multilingual': 1})

    def test_a_call_that_switches_language_moves_its_lease(self):
        self.leases.take('room-a', 'english-fast')
        self.leases.take('room-a', 'multilingual')
        self.assertEqual(self.leases.by_stack(), {'multilingual': 1})

    def test_a_kept_lease_lives_and_a_forgotten_one_runs_out(self):
        self.leases.take('room-a', 'english-fast')
        self.leases.take('room-b', 'english-fast')
        self.clock.t += 60
        self.assertTrue(self.leases.keep('room-a'))
        self.clock.t += 60
        self.assertEqual(self.leases.count(), 1, 'room-b was not kept for 120 s')
        self.assertFalse(self.leases.keep('room-b'), 'a run-out lease must be taken again')

    def test_release_frees_the_place(self):
        self.leases.take('room-a', 'english-fast')
        self.leases.release('room-a')
        self.leases.release('never-taken')
        self.assertEqual(self.leases.count(), 0)


if __name__ == '__main__':
    unittest.main()
