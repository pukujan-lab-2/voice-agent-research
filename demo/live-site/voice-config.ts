// The voice stacks and languages, read from their folders (docs/decisions/0012, 0022): agent/voice/manifest.json names
// the default, agent/voice/stacks/<stack>/manifest.json is one stack, agent/languages/<code>/manifest.json is one
// language. agent/common/voice.py checks the folders (npm run test:agent); tests/voice-config.test.ts checks that this
// reads them the same way. COPILOT_AGENT_DIR points at the agent folder when it is not next to demo/ (the site image).
import fs from 'node:fs';
import path from 'node:path';

export type Stack = { label: string; listens: string; turns: string; thinks: string; speaks: string; languages: string[] };
export type Language = { name: string; native: string; kokoro: [string, string] };
export type Voice = { default: string; stacks: Record<string, Stack>; languages: Record<string, Language> };

const here = path.dirname(new URL(import.meta.url).pathname);
export const AGENT_DIR = process.env.COPILOT_AGENT_DIR || path.join(here, '../../agent');

const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
const folders = (dir: string) => fs.readdirSync(dir, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.')).map(d => d.name).sort();

export function loadVoice(root = AGENT_DIR): Voice {
  const languages: Voice['languages'] = {};
  for (const code of folders(path.join(root, 'languages'))) {
    const { language: _, ...l } = read(path.join(root, 'languages', code, 'manifest.json'));
    languages[code] = l;
  }
  const stacks: Voice['stacks'] = {};
  for (const dir of folders(path.join(root, 'voice/stacks'))) {
    const { stack, ...s } = read(path.join(root, 'voice/stacks', dir, 'manifest.json'));
    stacks[stack] = s;
  }
  return { default: read(path.join(root, 'voice/manifest.json')).default, stacks, languages };
}
