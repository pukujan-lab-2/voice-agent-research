"""One speech gateway for every live call: our speech servers are hosted once and serve every project (docs/speech-gateway.md,
docs/decisions/0023).

A project points its speech URL here instead of at one speech server. The gateway speaks the speech server's own API
(POST /stt, GET /stt/stream, POST /tts, POST /load, GET /health, ...) and forwards each request to the server that
routes.toml picks:

  project ──► gateway ──► the Pro       (english-fast, lfm3-audio)
                      └─► the Windows PC (multilingual: Whisper large-v3-turbo + Kokoro on its RTX 4060)
                      └─► 503 no_room   (after waiting for a place, when_full = "wait"; the project's own error path)

The stack a request names already says the language (english-fast is English, multilingual is every other), so the stack
picks the route. A request with X-Speech-Call stays on one server for the whole call (a pin); the gateway counts each
server's pinned calls against its max_calls, passes over a full one and one whose models another call is using, and
moves the call when it asks for another stack (the caller picked Spanish). A pin nobody uses for idle_s is freed.
A request without a call id goes to the first server for its stack with room, unpinned.

routes.toml is read again when it changes; a file that doesn't parse is refused and the last good one stays (GET /routes
shows the live one).

Run: python gateway.py [--routes routes.toml]      Tests: speech/gateway/tests (fake speech servers)
"""
import argparse, asyncio, contextlib, json, os, sys, time, tomllib
from dataclasses import dataclass, field

import aiohttp
from aiohttp import web

HERE = os.path.dirname(os.path.abspath(__file__))
FORWARDED = {'/stt', '/tts', '/load', '/log', '/stt/stream'}
HOP = {'host', 'content-length', 'transfer-encoding', 'connection', 'x-speech-call', 'x-speech-project'}
DOWN_S = 20  # a server that refused a connection is passed over this long before it is tried again


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


@dataclass(frozen=True)
class Host:
    name: str
    url: str
    stacks: tuple[str, ...]
    max_calls: int


@dataclass(frozen=True)
class Routes:
    hosts: dict
    route: dict          # stack -> [(host name, the stack it runs there)]
    projects: dict
    defaults: dict
    listen: tuple[str, ...]
    idle_s: float

    def project(self, name: str) -> dict:
        return {**self.defaults, **self.projects.get(name or '', {})}


def parse(text: str) -> Routes:
    """routes.toml as Routes; raises ValueError on anything that would send a call nowhere."""
    try:
        raw = tomllib.loads(text)
    except tomllib.TOMLDecodeError as e:
        raise ValueError(f'not TOML: {e}') from e
    hosts = {}
    for h in raw.get('host', []):
        if not h.get('name') or not h.get('url'):
            raise ValueError(f'a host needs a name and a url: {h}')
        hosts[h['name']] = Host(h['name'], h['url'].rstrip('/'), tuple(h.get('stacks', [])), int(h.get('max_calls', 2)))
    if not hosts:
        raise ValueError('no [[host]]')
    route = {}
    for stack, entries in raw.get('route', {}).items():
        out = []
        for e in entries:
            name, _, there = e.partition(':')
            there = there or stack
            if name not in hosts:
                raise ValueError(f'route {stack}: no host named {name!r}')
            if there not in hosts[name].stacks:
                raise ValueError(f'route {stack}: {name} does not run {there!r}')
            out.append((name, there))
        route[stack] = out
    defaults = {'when_full': 'wait', 'wait_s': 8, 'warm': ['english-fast'], 'stack': 'english-fast', **raw.get('defaults', {})}
    projects = raw.get('project', {})
    for name, p in [('defaults', defaults), *projects.items()]:
        if p.get('when_full', 'wait') not in ('cloud', 'wait'):
            raise ValueError(f'{name}: when_full is "cloud" or "wait"')
        for s in p.get('warm', []):
            if s not in route:
                raise ValueError(f'{name}: warms {s!r}, which has no route')
    return Routes(hosts, route, projects, defaults, tuple(raw.get('listen', {}).get('addresses', ['127.0.0.1:18800'])),
                  float(raw.get('idle_s', 90)))


class Config:
    """routes.toml, read again whenever its modification time changes."""

    def __init__(self, path: str):
        self.path, self.mtime, self.routes, self.error = path, None, None, None
        self.current()
        if self.routes is None:
            raise SystemExit(f'routes: {self.error}')

    def current(self) -> Routes:
        try:
            mtime = os.stat(self.path).st_mtime
        except OSError as e:
            self.error = str(e)
            return self.routes
        if mtime != self.mtime:
            self.mtime = mtime
            try:
                with open(self.path) as f:
                    self.routes, self.error = parse(f.read()), None
                log('routes loaded:', {s: [f'{h}:{t}' for h, t in r] for s, r in self.routes.route.items()})
            except ValueError as e:
                self.error = str(e)
                log('routes refused, keeping the last good ones:', e)
        return self.routes


@dataclass
class Pin:
    host: str
    stack: str        # the stack the call asked for
    there: str        # the stack it runs on that host
    project: str
    last: float = field(default_factory=time.monotonic)


class Gateway:
    def __init__(self, config: Config, clock=time.monotonic):
        self.config, self.clock = config, clock
        self.pins: dict[str, Pin] = {}
        self.down: dict[str, float] = {}
        self.http: aiohttp.ClientSession | None = None
        self.changed = asyncio.Event()  # a place freed up: a waiting request looks again

    async def session(self) -> aiohttp.ClientSession:
        if self.http is None:
            self.http = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=None, sock_connect=3, sock_read=90))
        return self.http

    # --- who goes where

    def prune(self, routes: Routes) -> None:
        now = self.clock()
        for k in [k for k, p in self.pins.items() if now - p.last > routes.idle_s]:
            log(f'call {k} quiet for {routes.idle_s:.0f} s: freed on {self.pins[k].host}')
            del self.pins[k]

    def calls_on(self, host: str, but: str | None = None) -> list[Pin]:
        return [p for k, p in self.pins.items() if p.host == host and k != but]

    def pick(self, routes: Routes, stack: str, call: str | None) -> tuple[str, str] | None:
        """The first (host, stack there) on the stack's route that is up, has room and isn't running another stack for
        another call. A call's own place counts as free, so a call that changes stack can stay or move."""
        now = self.clock()
        for name, there in routes.route.get(stack, []):
            if self.down.get(name, 0) > now:
                continue
            others = self.calls_on(name, but=call)
            if len(others) >= routes.hosts[name].max_calls:
                continue
            if any(p.there != there for p in others):
                continue  # one stack is resident at a time: ours would swap theirs out mid-call
            return name, there
        return None

    def place(self, routes: Routes, stack: str, call: str | None, project: str) -> tuple[str, str] | None:
        if call and call in self.pins:
            pin = self.pins[call]
            pin.last = self.clock()
            if pin.stack == stack and self.down.get(pin.host, 0) <= self.clock():
                return pin.host, pin.there
        got = self.pick(routes, stack, call)
        if call:
            old = self.pins.pop(call, None)
            if got:
                self.pins[call] = Pin(got[0], stack, got[1], project, self.clock())
                if not old or old.host != got[0]:
                    log(f'call {call} ({project or "?"}) {stack} -> {got[0]}' + (f' (was {old.host})' if old else ''))
            if old and (not got or old.host != got[0]):
                self.changed.set()
        return got

    async def place_or_wait(self, routes: Routes, stack: str, call: str | None, project: str) -> tuple[str, str] | None:
        got = self.place(routes, stack, call, project)
        p = routes.project(project)
        if got or p['when_full'] != 'wait':
            return got
        end = self.clock() + float(p['wait_s'])
        while not got and self.clock() < end:
            self.changed.clear()
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self.changed.wait(), timeout=0.5)
            self.prune(routes)
            got = self.place(routes, stack, call, project)
        return got

    def release(self, call: str) -> None:
        if self.pins.pop(call, None):
            self.changed.set()

    # --- requests

    @staticmethod
    def ids(request: web.Request) -> tuple[str | None, str]:
        return request.headers.get('X-Speech-Call') or None, request.headers.get('X-Speech-Project', '')

    async def handle(self, request: web.Request) -> web.StreamResponse:
        routes = self.config.current()
        self.prune(routes)
        call, project = self.ids(request)
        path = request.path
        if path == '/health':
            return await self.health(routes, call)
        if path == '/routes':
            return web.json_response({'routes': {s: [f'{h}:{t}' for h, t in r] for s, r in routes.route.items()},
                                      'hosts': {n: vars(h) for n, h in routes.hosts.items()}, 'projects': routes.projects,
                                      'defaults': routes.defaults, 'refused': self.config.error})
        if path == '/warm':
            asyncio.ensure_future(self.warm(routes, request.query.get('project', project)))
            return web.json_response({'ok': True}, status=202)
        if path == '/place':  # where the call would go, taken now without loading anything (the client's room check)
            got = await self.place_or_wait(routes, request.query.get('stack') or routes.project(project)['stack'], call, project)
            if not got:
                return web.json_response({'error': 'no_room'}, status=503)
            return web.json_response({'ok': True, 'host': got[0], 'stack': got[1]})
        if path == '/lease':  # the call's place is the gateway's: keep it here
            k = request.query.get('id') or call
            if k in self.pins:
                self.pins[k].last = self.clock()
            return web.json_response({'ok': k in self.pins, 'calls': len(self.pins)})
        if path == '/release':
            self.release(request.query.get('id') or call or '')
            return web.json_response({'ok': True, 'calls': len(self.pins)})
        if path not in FORWARDED:
            return web.json_response({'error': 'not found'}, status=404)

        body = b'' if path == '/stt/stream' else await request.read()
        payload = None
        if path == '/tts':
            try:
                payload = json.loads(body or b'{}')
            except ValueError:
                return web.json_response({'error': 'bad json'}, status=400)
        stack = (payload or {}).get('stack') or request.query.get('stack') or (self.pins[call].stack if call in self.pins else '') \
            or routes.project(project)['stack']
        stale = False
        for _ in range(3):  # a server that refuses the connection is marked down and the call placed again
            got = await self.place_or_wait(routes, stack, call, project)
            if not got:
                return web.json_response({'error': 'no_room', 'stack': stack}, status=503)
            host, there = got
            query = {k: v for k, v in request.query.items() if k != 'lease'}
            if 'stack' in query or there != stack:
                query['stack'] = there
            data = body
            if payload is not None:
                data = json.dumps({**payload, 'stack': there}).encode()
            url = routes.hosts[host].url + path
            try:
                if path == '/stt/stream':
                    return await self.websocket(request, url, query, routes, (stack, call, project), host, there)
                return await self.forward(request, url, query, data)
            except (aiohttp.ClientConnectionError, TimeoutError) as e:
                if request.transport is None or request.transport.is_closing():
                    # The caller hung up mid-request (a call ending): writing to it failed, the server is fine. Marking
                    # it down here passed the Pro and then the Windows PC over for every other call (2026-11-08).
                    return web.Response(status=499)
                if isinstance(e, (aiohttp.ServerDisconnectedError, aiohttp.ClientConnectionResetError)) and not stale:
                    stale = True  # the pool reused a connection the server had closed: try it once more
                    continue
                self.mark_down(host, e)  # refused, timed out, or dropped twice in a row: it is the server
        return web.json_response({'error': 'no_room', 'stack': stack}, status=503)

    def mark_down(self, host: str, e: Exception) -> None:
        log(f'{host} unreachable ({type(e).__name__}): passed over for {DOWN_S} s')
        self.down[host] = self.clock() + DOWN_S

    async def forward(self, request: web.Request, url: str, query: dict, data: bytes) -> web.StreamResponse:
        http = await self.session()
        headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP}
        async with http.request(request.method, url, params=query, data=data, headers=headers) as up:
            out = web.StreamResponse(status=up.status, headers={k: v for k, v in up.headers.items() if k.lower() not in HOP})
            await out.prepare(request)
            # Past this point the reply has started, so it can't be sent again elsewhere: a caller who talked over it
            # dropped the audio, or the server broke off mid-reply and the caller hears it cut short
            with contextlib.suppress(ConnectionResetError, aiohttp.ClientError, TimeoutError):
                async for chunk in up.content.iter_any():
                    await out.write(chunk)
                await out.write_eof()
            return out

    async def websocket(self, request: web.Request, url: str, query: dict, routes: Routes, who: tuple, host: str,
                        there: str) -> web.WebSocketResponse:
        """The listening stream, both ways. The client names the stack in its decode and end messages too: those are
        rewritten to the stack it runs on this host, and a new stack (the caller picked Spanish) places the call again.
        If that moves it to another host the stream is closed, and the client opens a new one, which lands there."""
        stack, call, project = who
        http = await self.session()
        up = await http.ws_connect(url.replace('http', 'ws', 1), params=query, heartbeat=20)
        down = web.WebSocketResponse(heartbeat=20)
        await down.prepare(request)

        async def outbound():
            nonlocal stack, there
            async for msg in down:
                if msg.type == aiohttp.WSMsgType.BINARY:
                    await up.send_bytes(msg.data)
                elif msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        m = json.loads(msg.data)
                    except ValueError:
                        m = None
                    if isinstance(m, dict) and m.get('stack'):
                        if m['stack'] != stack:
                            got = self.place(routes, m['stack'], call, project)
                            if not got or got[0] != host:
                                break  # the call moved: close, and the client's next stream goes to its new host
                            stack, there = m['stack'], got[1]
                        await up.send_str(json.dumps({**m, 'stack': there}))
                    else:
                        await up.send_str(msg.data)
                else:
                    break
            await up.close()

        async def inbound():
            async for msg in up:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    await down.send_str(msg.data)
                elif msg.type == aiohttp.WSMsgType.BINARY:
                    await down.send_bytes(msg.data)
                else:
                    break
            await down.close()
        await asyncio.gather(outbound(), inbound(), return_exceptions=True)
        await down.close()
        return down

    async def health(self, routes: Routes, call: str | None) -> web.Response:
        """The pinned (or first) server's own health, so a client reading its sample rates gets them, plus every server's
        state under `gateway`."""
        http = await self.session()

        async def one(h: Host):
            try:
                async with http.get(h.url + '/health', timeout=aiohttp.ClientTimeout(total=2)) as r:
                    return await r.json() if r.status == 200 else None
            except (aiohttp.ClientError, TimeoutError, ValueError):
                return None
        names = list(routes.hosts)
        got = dict(zip(names, await asyncio.gather(*(one(routes.hosts[n]) for n in names)), strict=True))
        first = (self.pins[call].host if call in self.pins else None) or next((n for n in names if got[n]), None)
        state = {n: {'up': got[n] is not None, 'active': (got[n] or {}).get('active'), 'max_calls': routes.hosts[n].max_calls,
                     'calls': [{'call': k, 'project': p.project, 'stack': p.stack} for k, p in self.pins.items() if p.host == n]}
                 for n in names}
        base = got.get(first) or {'ok': False}
        return web.json_response({**base, 'calls': len(self.pins), 'gateway': {'hosts': state, 'refused': self.config.error}},
                                 status=200 if base.get('ok') else 503)

    async def warm(self, routes: Routes, project: str) -> None:
        """Load the project's stacks on the first server of each route ahead of a call (a visit, a call starting). A plain
        load: the speech server never swaps out a stack a call is using for it (stack_hold.py)."""
        http = await self.session()
        for stack in routes.project(project)['warm']:
            got = self.pick(routes, stack, None)
            if not got:
                continue
            with contextlib.suppress(aiohttp.ClientError, TimeoutError):
                async with http.post(routes.hosts[got[0]].url + '/load', params={'stack': got[1]},
                                     timeout=aiohttp.ClientTimeout(total=60)) as r:
                    log(f'warm {project or "?"} {stack} on {got[0]}: {r.status}')

    def app(self) -> web.Application:
        a = web.Application(client_max_size=64 * 1024 * 1024)
        a.router.add_route('*', '/{tail:.*}', self.handle)

        async def close(_):
            if self.http:
                await self.http.close()
        a.on_cleanup.append(close)
        return a


async def serve(routes_path: str, listen: list[str] | None = None) -> None:
    gw = Gateway(Config(routes_path))
    runner = web.AppRunner(gw.app())
    await runner.setup()
    for addr in listen or gw.config.routes.listen:
        host, _, port = addr.rpartition(':')
        try:
            await web.TCPSite(runner, host, int(port)).start()
            log('listening on', addr)
        except OSError as e:  # a docker bridge that isn't up yet on this machine: the others still serve
            log('cannot listen on', addr, e)
    # A deploy moves the checkout this file is mounted from: new routes are read on the next request, new code needs a fresh
    # process, so the gateway exits and Docker starts it again (restart: unless-stopped). Calls are pinned again on their
    # next request, to the same server while it has room.
    own = os.stat(__file__).st_mtime
    while os.stat(__file__).st_mtime == own:
        await asyncio.sleep(10)
    log('gateway.py changed: restarting')
    await runner.cleanup()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--routes', default=os.environ.get('SPEECH_ROUTES', os.path.join(HERE, 'routes.toml')))
    ap.add_argument('--listen', action='append', help='host:port, instead of routes.toml [listen]')
    a = ap.parse_args()
    asyncio.run(serve(a.routes, a.listen))


if __name__ == '__main__':
    sys.exit(main())
