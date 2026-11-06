"""The voice stacks and languages (docs/decisions/0012, 0022), read from their folders: agent/voice/manifest.json names the
default, agent/voice/stacks/<stack>/manifest.json is one stack, agent/languages/<code>/manifest.json is one language.
load_voice() gives what speech/stacks.json used to hold ({default, stacks, languages}) and refuses a bad folder.

Standard library only: the voice agent's image and the Pro's speech server load this file without the lane packages.
A stack's folder is its name with '-' written '_', since each stack folder is a Python package (one never imports
another)."""

import json
from pathlib import Path

AGENT = Path(__file__).resolve().parents[1]
STACK_FIELDS = {'stack', 'label', 'listens', 'turns', 'thinks', 'speaks', 'languages'}
LANGUAGE_FIELDS = {'language', 'name', 'native', 'kokoro'}
TURNS = {'english', 'multilingual', 'vad'}  # which end-of-turn detector the agent runs (speech/agent.py)
# A model in the product is open-weight (decision 0001): the names common/manifest.py and copilot-engine/src/slots.ts reject.
BANNED = ('claude', 'gemma', 'openrouter/free')


class VoiceError(ValueError):
    pass


def _read(path: Path, fields: set[str]) -> dict:
    try:
        m = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as e:
        raise VoiceError(f'{path}: {e}') from None
    if not isinstance(m, dict) or set(m) != fields:
        got = set(m) if isinstance(m, dict) else set()
        raise VoiceError(f'{path}: missing {sorted(fields - got)}, unknown {sorted(got - fields)}')
    return m


def _folders(root: Path) -> list[Path]:
    return sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith(('_', '.')))


def load_voice(root: Path = AGENT) -> dict:
    root = Path(root)
    languages = {}
    for d in _folders(root / 'languages'):
        m = _read(d / 'manifest.json', LANGUAGE_FIELDS)
        if m.pop('language') != d.name:
            raise VoiceError(f'{d}: the folder must be named after its language')
        k = m['kokoro']
        if not (isinstance(k, list) and len(k) == 2 and all(isinstance(x, str) and x for x in k)):
            raise VoiceError(f'{d}: kokoro is [espeak code, voice]')
        languages[d.name] = m
    stacks = {}
    for d in _folders(root / 'voice' / 'stacks'):
        m = _read(d / 'manifest.json', STACK_FIELDS)
        name = m.pop('stack')
        if not isinstance(name, str) or name.replace('-', '_') != d.name:
            raise VoiceError(f'{d}: the folder must be named after its stack ({name!r}, with "-" written "_")')
        for part in ('listens', 'thinks', 'speaks'):
            if not isinstance(m[part], str) or not m[part] or any(b in m[part].lower() for b in BANNED):
                raise VoiceError(f'{d}: {part} names a model that is not allowed ({m[part]!r})')
        if m['turns'] not in TURNS:
            raise VoiceError(f'{d}: turns is one of {sorted(TURNS)}')
        if not m['languages'] or any(code not in languages for code in m['languages']):
            raise VoiceError(f'{d}: every language needs a folder in agent/languages ({m["languages"]})')
        stacks[name] = m
    top = _read(root / 'voice' / 'manifest.json', {'description', 'default'})
    if top['default'] not in stacks:
        raise VoiceError(f'the default stack {top["default"]!r} has no folder in agent/voice/stacks')
    return {'default': top['default'], 'stacks': stacks, 'languages': languages}


if __name__ == '__main__':  # the TypeScript loader's test compares its result with this one
    print(json.dumps(load_voice(), ensure_ascii=False))
