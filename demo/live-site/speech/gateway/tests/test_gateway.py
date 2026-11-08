"""The speech gateway against fake speech servers: English on the Pro, overflow to the Windows PC, then no room; Spanish on
the Windows PC; a call pinned, moved when it changes stack, freed when it goes quiet; a bad routes file refused; the
listening WebSocket forwarded."""
import asyncio, contextlib, json, os, sys, tempfile, unittest

from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import gateway  # noqa: E402

ROUTES = """
idle_s = 90
[[host]]
name = "pro"
url = "{pro}"
stacks = ["english-fast", "multilingual"]
max_calls = 2
[[host]]
name = "windows"
url = "{win}"
stacks = ["multilingual"]
max_calls = 2
[route]
english-fast = ["pro", "windows:multilingual"]
multilingual = ["windows", "pro"]
[project.copilot]
when_full = "wait"
wait_s = 1
[project.riley]
when_full = "cloud"  # answers 503 at once: the tests that fill every server don't wait on the fake clock
"""


class Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


async def fake(name: str, got: list):
    """A speech server that records what reached it and answers like one."""
    async def tts(r):
        b = await r.json()
        got.append((name, '/tts', b['stack']))
        return web.Response(body=b'\x00\x01' * 8, content_type='audio/L16')

    async def stt(r):
        got.append((name, '/stt', r.query.get('stack')))
        return web.json_response({'text': f'heard on {name}'})

    async def load(r):
        got.append((name, '/load', r.query.get('stack')))
        return web.json_response({'ok': True})

    async def health(r):
        return web.json_response({'ok': True, 'rate': 24000, 'active': None, 'name': name})

    async def stream(r):
        ws = web.WebSocketResponse()
        await ws.prepare(r)
        got.append((name, '/stt/stream', r.query.get('stack')))
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:  # a decode or end message: say which stack it asked for
                await ws.send_str(json.dumps({'final': name, 'stack': json.loads(msg.data)['stack']}))
                continue
            await ws.send_str(json.dumps({'final': f'{name}:{len(msg.data)}'}))
        await ws.close()
        return ws
    app = web.Application()
    app.router.add_post('/tts', tts)
    app.router.add_post('/stt', stt)
    app.router.add_post('/load', load)
    app.router.add_get('/health', health)
    app.router.add_get('/stt/stream', stream)
    server = TestServer(app)
    await server.start_server()
    return server


class GatewayTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.got: list = []
        self.pro, self.win = await fake('pro', self.got), await fake('windows', self.got)
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, 'routes.toml')
        with open(self.path, 'w') as f:
            f.write(ROUTES.format(pro=str(self.pro.make_url('')).rstrip('/'), win=str(self.win.make_url('')).rstrip('/')))
        self.clock = Clock()
        self.gw = gateway.Gateway(gateway.Config(self.path), clock=self.clock)
        self.client = TestClient(TestServer(self.gw.app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        await self.pro.close()
        await self.win.close()
        self.dir.cleanup()

    async def say(self, call, stack, project='riley'):
        h = {'X-Speech-Project': project}
        if call:
            h['X-Speech-Call'] = call
        r = await self.client.post('/tts', json={'text': 'Hello.', 'stack': stack, 'lang': 'en'}, headers=h)
        await r.read()
        return r.status

    def hosts(self):
        return [(n, s) for n, p, s in self.got if p == '/tts']

    async def test_english_fills_the_pro_then_overflows_to_windows_then_no_room(self):
        for call in ('a', 'b', 'c', 'd'):
            self.assertEqual(await self.say(call, 'english-fast'), 200)
        self.assertEqual(await self.say('e', 'english-fast'), 503, 'four places, a fifth call gets no_room')
        self.assertEqual(self.hosts(), [('pro', 'english-fast')] * 2 + [('windows', 'multilingual')] * 2)

    async def test_spanish_goes_to_windows_first(self):
        self.assertEqual(await self.say('a', 'multilingual'), 200)
        self.assertEqual(self.hosts(), [('windows', 'multilingual')])

    async def test_a_call_stays_put_and_moves_when_it_picks_spanish(self):
        await self.say('a', 'english-fast')
        await self.say('a', 'english-fast')
        r = await self.client.post('/stt?stack=multilingual&lang=es', data=b'RIFF', headers={'X-Speech-Call': 'a'})
        self.assertEqual((await r.json())['text'], 'heard on windows')
        self.assertEqual(self.hosts(), [('pro', 'english-fast')] * 2)
        self.assertEqual({k: p.host for k, p in self.gw.pins.items()}, {'a': 'windows'})

    async def test_a_host_running_another_calls_stack_is_passed_over(self):
        await self.say('a', 'multilingual')
        await self.say('b', 'multilingual')
        await self.say('c', 'multilingual')  # Windows is full: the Pro takes it in multilingual
        self.assertEqual(self.hosts()[-1], ('pro', 'multilingual'))
        # The Pro has room, but swapping it to english-fast would cut call c off, and Windows is full
        self.assertEqual(await self.say('d', 'english-fast'), 503)

    async def test_a_quiet_call_gives_its_place_back_and_release_frees_it_at_once(self):
        await self.say('a', 'english-fast')
        await self.say('b', 'english-fast')
        self.clock.t += 91
        await self.say('c', 'english-fast')
        self.assertEqual(self.hosts()[-1], ('pro', 'english-fast'), 'a and b went quiet: the Pro has room again')
        await self.client.post('/release', headers={'X-Speech-Call': 'c'})
        self.assertNotIn('c', self.gw.pins)

    async def test_lease_keeps_a_call_alive_without_speech(self):
        await self.say('a', 'english-fast')
        self.clock.t += 60
        r = await self.client.post('/lease?id=a')
        self.assertTrue((await r.json())['ok'])
        self.clock.t += 60
        self.gw.prune(self.gw.config.current())
        self.assertIn('a', self.gw.pins)

    async def test_wait_holds_the_request_until_a_place_frees(self):
        for call in ('a', 'b', 'c', 'd'):
            await self.say(call, 'english-fast')
        waiting = asyncio.ensure_future(self.say('e', 'english-fast', project='copilot'))
        await asyncio.sleep(0.2)
        await self.client.post('/release', headers={'X-Speech-Call': 'a'})
        self.assertEqual(await waiting, 200)
        self.assertEqual(self.hosts()[-1], ('pro', 'english-fast'))

    async def test_a_request_without_a_call_id_is_not_pinned(self):
        r = await self.client.post('/stt', data=b'RIFF')
        self.assertEqual((await r.json())['text'], 'heard on pro')
        self.assertEqual(self.gw.pins, {})

    async def test_an_unreachable_host_is_passed_over(self):
        await self.win.close()
        await self.say('a', 'english-fast')
        await self.say('b', 'english-fast')
        self.assertEqual(await self.say('c', 'english-fast'), 503)
        self.assertEqual(await self.say('x', 'multilingual'), 503, 'Windows is down and the Pro is full')

    async def test_a_kept_alive_connection_the_server_closed_is_tried_again_not_marked_down(self):
        forward, dropped = self.gw.forward, []

        async def drop_once(*args):
            if not dropped:
                dropped.append(1)
                raise gateway.aiohttp.ServerDisconnectedError()
            return await forward(*args)
        self.gw.forward = drop_once
        self.assertEqual(await self.say('a', 'english-fast'), 200)
        self.assertEqual((self.hosts(), self.gw.down), ([('pro', 'english-fast')], {}), 'same server, not passed over')

    async def test_a_caller_who_hangs_up_mid_request_does_not_mark_the_server_down(self):
        async def hang_up(request, *args):
            request.transport.close()  # the agent closed its session as the call ended
            raise gateway.aiohttp.ClientConnectionResetError('Cannot write to closing transport')
        self.gw.forward = hang_up
        with contextlib.suppress(Exception):
            await self.say('a', 'english-fast')
        self.assertEqual(self.gw.down, {}, 'neither server is passed over')

    async def test_a_bad_routes_file_is_refused_and_the_last_good_one_kept(self):
        before = self.gw.config.current()
        with open(self.path, 'w') as f:
            f.write('[route]\nenglish-fast = ["nowhere"]\n')
        os.utime(self.path, (1, 1))
        self.assertIs(self.gw.config.current(), before)
        self.assertIn('no [[host]]', self.gw.config.error)
        r = await self.client.get('/routes')
        self.assertIn('no [[host]]', (await r.json())['refused'])

    async def test_a_project_without_a_block_waits_for_a_place(self):
        r = gateway.parse('[[host]]\nname="p"\nurl="http://p"\nstacks=["english-fast"]\n[route]\nenglish-fast=["p"]\n')
        self.assertEqual(r.project('nyc-map')['when_full'], 'wait', 'no one falls to the cloud unless its block says so')

    async def test_parse_refuses_a_route_to_a_stack_the_host_does_not_run(self):
        with self.assertRaises(ValueError):
            gateway.parse('[[host]]\nname="w"\nurl="http://w"\nstacks=["multilingual"]\n[route]\nenglish-fast=["w"]\n')

    async def test_health_is_the_servers_own_plus_the_gateways_view(self):
        await self.say('a', 'english-fast')
        r = await self.client.get('/health')
        h = await r.json()
        self.assertEqual((h['rate'], h['name']), (24000, 'pro'))
        self.assertEqual(h['gateway']['hosts']['pro']['calls'], [{'call': 'a', 'project': 'riley', 'stack': 'english-fast'}])

    async def test_warm_loads_the_projects_stacks(self):
        r = await self.client.post('/warm?project=riley')
        self.assertEqual(r.status, 202)
        for _ in range(20):
            if self.got:
                break
            await asyncio.sleep(0.05)
        self.assertEqual(self.got, [('pro', '/load', 'english-fast')])

    async def test_the_listening_websocket_is_forwarded(self):
        async with self.client.ws_connect('/stt/stream?stack=multilingual&lang=es&sr=16000',
                                          headers={'X-Speech-Call': 'a'}) as ws:
            await ws.send_bytes(b'\x00' * 640)
            msg = await ws.receive()
            self.assertEqual(json.loads(msg.data), {'final': 'windows:640'})
        self.assertIn(('windows', '/stt/stream', 'multilingual'), self.got)

    async def test_place_takes_a_place_without_loading(self):
        r = await self.client.post('/place?stack=multilingual', headers={'X-Speech-Call': 'a'})
        self.assertEqual(await r.json(), {'ok': True, 'host': 'windows', 'stack': 'multilingual'})
        self.assertEqual(self.got, [])
        self.assertEqual(self.gw.pins['a'].host, 'windows')

    async def test_the_stack_inside_listening_messages_is_the_one_it_runs_there(self):
        await self.say('a', 'english-fast')
        await self.say('b', 'english-fast')  # the Pro is full: call c overflows to Windows' multilingual stack
        async with self.client.ws_connect('/stt/stream?stack=english-fast&lang=en&sr=16000',
                                          headers={'X-Speech-Call': 'c'}) as ws:
            await ws.send_str(json.dumps({'type': 'end', 'speech_end': 0, 'stack': 'english-fast', 'lang': 'en'}))
            self.assertEqual(json.loads((await ws.receive()).data), {'final': 'windows', 'stack': 'multilingual'})

    async def test_a_listening_stream_closes_when_its_call_moves(self):
        async with self.client.ws_connect('/stt/stream?stack=english-fast&lang=en&sr=16000',
                                          headers={'X-Speech-Call': 'a'}) as ws:
            await ws.send_str(json.dumps({'type': 'decode', 'stack': 'multilingual', 'lang': 'es'}))
            msg = await ws.receive()
            self.assertIn(msg.type, (web.WSMsgType.CLOSE, web.WSMsgType.CLOSED, web.WSMsgType.CLOSING))
        self.assertEqual(self.gw.pins['a'].host, 'windows', 'the next stream opens on the Windows PC')


if __name__ == '__main__':
    unittest.main()
