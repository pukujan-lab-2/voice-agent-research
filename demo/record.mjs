// Plays site/index.html in headless Chromium, captures it with the CDP screencast (timestamped
// frames), and encodes the frames plus build/audio.wav into out/copilot-demo.mp4.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const VERT = process.argv.includes('--vertical');
const MOBILE = process.argv.includes('--mobile');
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FRAMES = path.join(ROOT, 'build', VERT ? 'frames-vertical' : MOBILE ? 'frames-mobile' : 'frames');
const OUT = path.join(ROOT, 'out');
const FFMPEG = execFileSync(path.join(ROOT, '.venv/bin/python'), ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const TYPES = { '.html': 'text/html', '.json': 'application/json', '.webm': 'video/webm', '.wav': 'audio/wav' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: VERT ? { width: 720, height: 1280 } : { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
page.on('console', m => { if (m.type() === 'error') console.log('page error:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/site/index.html${VERT ? '?vertical' : MOBILE ? '?mobile' : ''}`);
await page.waitForFunction(() => window.__ready === true);
const total = await page.evaluate(() => window.__total);

const cdp = await page.context().newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const f = path.join(FRAMES, `${String(frames.length).padStart(6, '0')}.jpg`);
  fs.writeFileSync(f, Buffer.from(data, 'base64'));
  frames.push({ f, ts: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: VERT ? 1080 : 1920, maxHeight: VERT ? 1920 : 1080, everyNthFrame: 1 });
await page.waitForTimeout(800);

const startMs = await page.evaluate(() => window.__start());
const start = startMs / 1000;
console.log(`recording ${total.toFixed(1)}s ...`);
await page.waitForFunction(() => window.__done === true, null, { timeout: (total + 30) * 1000, polling: 500 });
await page.waitForTimeout(300);
await cdp.send('Page.stopScreencast');
await browser.close();
server.close();

// Concat list: each frame lasts until the next one; timeline starts at `start`.
let i = frames.findIndex(fr => fr.ts > start);
i = Math.max(0, i - 1);
const kept = frames.slice(i);
const lines = [];
for (let k = 0; k < kept.length; k++) {
  const from = Math.max(kept[k].ts, start);
  const to = k + 1 < kept.length ? kept[k + 1].ts : start + total;
  const d = Math.max(to - from, 0.001);
  lines.push(`file '${kept[k].f}'`, `duration ${d.toFixed(4)}`);
}
lines.push(`file '${kept[kept.length - 1].f}'`);
fs.writeFileSync(path.join(FRAMES + '.txt'), lines.join('\n'));
console.log(`${kept.length} frames captured`);

const out = path.join(OUT, VERT ? 'copilot-demo-vertical.mp4' : MOBILE ? 'copilot-demo-mobile.mp4' : 'copilot-demo.mp4');
execFileSync(FFMPEG, ['-loglevel', 'error', '-y',
  '-f', 'concat', '-safe', '0', '-i', path.join(FRAMES + '.txt'),
  '-i', path.join(ROOT, 'build', 'audio.wav'),
  '-vf', `fps=30,scale=${VERT ? '1080:1920' : '1920:1080'}:flags=lanczos,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
  '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log('wrote', out);
