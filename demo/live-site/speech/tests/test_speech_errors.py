import asyncio, os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from speech_errors import as_retryable  # noqa: E402


class Slow(Exception):
    """Stands in for LiveKit's APITimeoutError."""


class Down(Exception):
    """Stands in for LiveKit's APIConnectionError."""


# aiohttp's classes, without importing it: only the module name matters.
ClientError = type('ClientError', (Exception,), {'__module__': 'aiohttp.client_exceptions'})
SocketTimeoutError = type('SocketTimeoutError', (ClientError, asyncio.TimeoutError), {'__module__': 'aiohttp.client_exceptions'})


def fix(error):
    return as_retryable(error, Slow, Down, 'speech-to-text')


class SpeechErrorsTest(unittest.TestCase):
    def test_a_timeout_becomes_the_retryable_timeout(self):
        # The one in the call that went deaf: a plain TimeoutError out of the recogniser's request.
        for error in (TimeoutError(), asyncio.TimeoutError(), SocketTimeoutError('Timeout on reading data from socket')):
            out = fix(error)
            self.assertIsInstance(out, Slow, type(error).__name__)
            self.assertIn('speech-to-text', str(out))

    def test_a_socket_or_client_error_becomes_the_retryable_connection_error(self):
        for error in (ConnectionResetError('reset'), ConnectionRefusedError(), OSError('no route'), ClientError('boom')):
            self.assertIsInstance(fix(error), Down, type(error).__name__)

    def test_anything_else_is_left_alone(self):
        for error in (ValueError('bad json'), KeyError('text'), RuntimeError('bug')):
            self.assertIs(fix(error), error)


if __name__ == '__main__':
    unittest.main()
