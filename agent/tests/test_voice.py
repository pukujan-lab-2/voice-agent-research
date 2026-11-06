import json
import shutil
import tomllib
from pathlib import Path

import pytest

from common.voice import AGENT, VoiceError, load_voice


def copy_of_voice(tmp: Path) -> Path:
    for part in ('voice', 'languages'):
        shutil.copytree(AGENT / part, tmp / part)
    return tmp


def edit(path: Path, **changes) -> None:
    m = json.loads(path.read_text())
    for k, v in changes.items():
        if v is None: m.pop(k, None)
        else: m[k] = v
    path.write_text(json.dumps(m))


def test_the_shipped_stacks_and_languages_load():
    v = load_voice()
    assert v['default'] == 'english-fast'
    assert sorted(v['stacks']) == ['english-fast', 'lfm3-audio', 'multilingual', 'parakeet-kokoro', 'whisper-pocket']
    assert v['stacks']['multilingual']['languages'] == ['en', 'es', 'fr', 'it', 'pt', 'hi', 'zh']
    assert v['languages']['es']['kokoro'] == ['es', 'ef_dora']


def test_every_stack_folder_is_in_the_import_check():
    # a new stack folder that the independence contract does not list could import another stack unchecked
    cfg = tomllib.loads((AGENT / 'pyproject.toml').read_text())
    listed = next(c['modules'] for c in cfg['tool']['importlinter']['contracts'] if c['name'] == 'One voice stack never imports another')
    stacks = AGENT / 'voice' / 'stacks'
    assert sorted(listed) == sorted(f'voice.stacks.{d.name}' for d in stacks.iterdir() if d.is_dir() and not d.name.startswith(('_', '.')))


def test_a_missing_or_unknown_field_is_refused(tmp_path):
    root = copy_of_voice(tmp_path)
    edit(root / 'voice/stacks/english_fast/manifest.json', speaks=None)
    with pytest.raises(VoiceError, match="missing \\['speaks'\\]"):
        load_voice(root)
    root = copy_of_voice(tmp_path / 'b')
    edit(root / 'languages/fr/manifest.json', accent='paris')
    with pytest.raises(VoiceError, match="unknown \\['accent'\\]"):
        load_voice(root)


def test_the_folder_and_the_name_must_agree(tmp_path):
    root = copy_of_voice(tmp_path)
    edit(root / 'voice/stacks/english_fast/manifest.json', stack='english-slow')
    with pytest.raises(VoiceError, match='named after its stack'):
        load_voice(root)
    root = copy_of_voice(tmp_path / 'b')
    edit(root / 'languages/fr/manifest.json', language='es')
    with pytest.raises(VoiceError, match='named after its language'):
        load_voice(root)


def test_a_language_without_a_folder_is_refused(tmp_path):
    root = copy_of_voice(tmp_path)
    shutil.rmtree(root / 'languages/zh')
    with pytest.raises(VoiceError, match='every language needs a folder'):
        load_voice(root)


def test_the_default_must_be_a_stack(tmp_path):
    root = copy_of_voice(tmp_path)
    edit(root / 'voice/manifest.json', default='nope')
    with pytest.raises(VoiceError, match='default stack'):
        load_voice(root)


@pytest.mark.parametrize('model', ['claude-haiku-5-5', 'gemma-4-27b', 'openrouter/free'])
def test_a_banned_model_name_is_refused(tmp_path, model):
    root = copy_of_voice(tmp_path)
    edit(root / 'voice/stacks/english_fast/manifest.json', thinks=model)
    with pytest.raises(VoiceError, match='not allowed'):
        load_voice(root)


def test_an_unknown_turn_detector_is_refused(tmp_path):
    root = copy_of_voice(tmp_path)
    edit(root / 'voice/stacks/english_fast/manifest.json', turns='guess')
    with pytest.raises(VoiceError, match='turns is one of'):
        load_voice(root)
