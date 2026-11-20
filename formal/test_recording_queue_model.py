"""Runs TLC on formal/recording_queue.tla (#186).

Needs a TLC jar and Java: set TLA2TOOLS to the jar's path. JAVA names the java binary when it is not on the PATH.
Without both, the tests are skipped.
"""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

FORMAL = Path(__file__).resolve().parent
JAR = os.environ.get('TLA2TOOLS', '')
JAVA = os.environ.get('JAVA') or shutil.which('java') or ''


def runnable() -> bool:
    if not (JAR and Path(JAR).is_file() and JAVA):
        return False
    return subprocess.run([JAVA, '-version'], capture_output=True).returncode == 0


def tlc(cfg: str) -> tuple[int, str]:
    meta = tempfile.mkdtemp()
    try:
        out = subprocess.run([JAVA, '-XX:+UseSerialGC', '-cp', JAR, 'tlc2.TLC', '-metadir', meta, '-config', cfg, 'recording_queue.tla'],
                             cwd=FORMAL, capture_output=True, text=True, timeout=300)
        return out.returncode, out.stdout + out.stderr
    finally:
        shutil.rmtree(meta, ignore_errors=True)


@unittest.skipUnless(runnable(), 'set TLA2TOOLS and have Java')
class RecordingQueueModel(unittest.TestCase):
    def holds(self, cfg: str) -> str:
        code, out = tlc(cfg)
        self.assertEqual(code, 0, out)
        self.assertIn('No error has been found', out)
        return out

    def breaks(self, cfg: str, what: str) -> None:
        """TLC must find the violation: the model is able to see the failure it is there to catch."""
        code, out = tlc(cfg)
        self.assertNotEqual(code, 0, out)
        self.assertIn(what, out)

    def test_the_queue_loses_nothing_and_saves_everything_once_the_site_is_back(self):
        self.assertIn('Finished checking temporal properties', self.holds('recording_queue.cfg'))

    def test_nothing_is_lost_when_redis_goes_away_too_because_the_agent_keeps_the_file(self):
        self.assertIn('Finished checking temporal properties', self.holds('recording_queue_redis_down.cfg'))

    def test_without_keeping_the_file_redis_and_the_site_down_together_lose_a_recording(self):
        self.breaks('recording_queue_both_down.cfg', 'Invariant NothingLost is violated')

    def test_the_agent_before_the_queue_loses_a_recording(self):
        self.breaks('recording_direct.cfg', 'Invariant NothingLost is violated')

    def test_acknowledging_before_saving_loses_a_recording(self):
        self.breaks('recording_queue_ack_first.cfg', 'Invariant QueuedNeverLost is violated')

    def test_a_recording_can_be_saved_twice(self):
        self.breaks('recording_queue_once.cfg', 'Invariant SavedOnce is violated')

    def test_nothing_is_saved_while_the_site_stays_down(self):
        self.breaks('recording_queue_site_stays_down.cfg', 'Temporal properties were violated')


if __name__ == '__main__':
    unittest.main()
