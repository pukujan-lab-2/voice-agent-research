import copy
import json
import tomllib
from pathlib import Path

import pytest

from common.manifest import LANES, ManifestError, load_lane, load_lanes

SMALL = json.loads((LANES / 'small' / 'manifest.json').read_text())


def lanes_at(tmp: Path, **manifests) -> Path:
    for name, m in manifests.items():
        (tmp / name).mkdir()
        (tmp / name / 'manifest.json').write_text(json.dumps(m))
    return tmp


def small(**changes) -> dict:
    m = copy.deepcopy(SMALL)
    for k, v in changes.items():
        if v is None: m.pop(k, None)
        else: m[k] = v
    return m


def other(name: str) -> dict:
    return small(lane=name, tables={k: f'{name}_{k}' for k in SMALL['tables']})


def test_the_shipped_lanes_load():
    lanes = load_lanes()
    assert sorted(lanes) == ['hybrid', 'small', 'strong']
    assert lanes['hybrid'].escalate.to == 'strong'
    assert lanes['strong'].reach == 'dev-or-owner'
    assert lanes['small'].answers.model == 'lfm3'


def test_every_lane_folder_is_in_the_import_check():
    # a new lane folder that the independence contract does not list could import another lane unchecked
    cfg = tomllib.loads((LANES.parent / 'pyproject.toml').read_text())
    listed = next(c['modules'] for c in cfg['tool']['importlinter']['contracts'] if c['type'] == 'independence')
    assert sorted(listed) == sorted(f'lanes.{d.name}' for d in LANES.iterdir() if d.is_dir() and not d.name.startswith(('_', '.')))


@pytest.mark.parametrize('model', ['claude-haiku-5-5', 'gemma-4-27b', 'openrouter/free'])
def test_a_banned_model_name_is_refused(tmp_path, model):
    with pytest.raises(ManifestError, match='not allowed'):
        load_lane('small', lanes_at(tmp_path, small=small(answers={**SMALL['answers'], 'model': model})))


def test_a_missing_or_unknown_field_is_refused(tmp_path):
    with pytest.raises(ManifestError, match='reach'):
        load_lane('small', lanes_at(tmp_path, small=small(reach=None)))
    with pytest.raises(ManifestError, match='extra'):
        load_lane('a', lanes_at(tmp_path, a={**other('a'), 'temperature': 0}))


def test_the_folder_and_the_name_must_agree(tmp_path):
    with pytest.raises(ManifestError, match='sits in the folder'):
        load_lane('fast', lanes_at(tmp_path, fast=small()))


def test_a_guard_or_fix_needs_its_file(tmp_path):
    root = lanes_at(tmp_path, small=small(fixes=['text_tool_calls']))
    with pytest.raises(ManifestError, match='without a file'):
        load_lane('small', root)
    (root / 'small' / 'fixes').mkdir()
    (root / 'small' / 'fixes' / 'text_tool_calls.py').write_text('')
    assert load_lane('small', root).fixes == ['text_tool_calls']


def test_tables_are_named_for_their_lane(tmp_path):
    with pytest.raises(ManifestError, match='must start with "small_"'):
        load_lane('small', lanes_at(tmp_path, small=small(tables={**SMALL['tables'], 'replay_cases': 'replay_cases'})))


def test_two_lanes_cannot_share_a_table(tmp_path):
    # "a" may name its tables "a_b_...", which are also the tables of the lane "a_b"
    with pytest.raises(ManifestError, match='both use'):
        load_lanes(lanes_at(tmp_path, a={**other('a'), 'tables': other('a_b')['tables']}, a_b=other('a_b')))


def test_a_turn_is_only_handed_to_a_lane_that_exists(tmp_path):
    with pytest.raises(ManifestError, match='has no folder'):
        load_lanes(lanes_at(tmp_path, small=small(escalate={'to': 'strong', 'when': 'hard turns'})))


def test_a_lane_cannot_hand_turns_to_itself(tmp_path):
    with pytest.raises(ManifestError, match='to itself'):
        load_lane('small', lanes_at(tmp_path, small=small(fallback='small')))
