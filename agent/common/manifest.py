"""A lane's manifest (docs/decisions/0022): what answers, who may reach the lane, its guards and fixes, its evals and judge,
its search and its own Octo tables. load_lane() reads one lane's agent/lanes/<lane>/manifest.json and refuses a bad one;
load_lanes() also checks what lanes must not share."""

import json
import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

LANES = Path(__file__).resolve().parents[1] / 'lanes'
# A model in the product is open-weight (decision 0001): the same names copilot-engine/src/slots.ts rejects.
BANNED = ('claude', 'gemma', 'openrouter/free')
NAME = re.compile(r'^[a-z][a-z0-9_]{0,40}$')


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', frozen=True)


class Answers(Strict):
    provider: Literal['local', 'inferhub', 'openrouter-free', 'workbuddy']
    model: str = Field(min_length=1)
    timeout_ms: int = Field(gt=0)
    daily_cap: int | None = Field(default=None, gt=0)  # calls per UTC day; None for our own server

    @field_validator('model')
    @classmethod
    def open_weight(cls, v: str) -> str:
        hit = next((b for b in BANNED if b in v.lower()), None)
        if hit: raise ValueError(f'a model named "{v}" is not allowed (names containing "{hit}" are rejected)')
        return v


class Escalate(Strict):
    to: str  # the lane a hard turn goes to; that lane's own guards and fixes then run
    when: str = Field(min_length=1)


class Evals(Strict):
    sets: list[str]
    judge: str = Field(min_length=1)
    pass_bar: float | None = Field(default=None, ge=0, le=1)  # share of the lane's eval items that must pass; None until set


class Search(Strict):
    service: Literal['octo']
    embedder: str = Field(min_length=1)  # "workspace": the embedding setup of the business's Octo workspace
    rerank: bool


class Tables(Strict):
    flagged_turns: str
    replay_cases: str
    eval_sets: str
    judge_settings: str


class Lane(Strict):
    lane: str
    version: int = Field(ge=1)
    description: str = Field(min_length=1)
    # Who a session can be put on this lane for. dev-or-owner: a development host or the owner's token (decision 0017). A hybrid
    # lane's hard turns still reach its escalation lane for every visitor (0017's 2026-11-02 amendment).
    reach: Literal['everyone', 'dev-or-owner']
    answers: Answers
    escalate: Escalate | None = None
    fallback: str | None = None  # the lane whose answer stands when this lane's model cannot answer
    tools: list[str]
    guards: list[str]
    fixes: list[str]
    evals: Evals
    search: Search
    tables: Tables

    @field_validator('lane', 'tools', 'guards', 'fixes')
    @classmethod
    def names(cls, v):
        bad = [n for n in ([v] if isinstance(v, str) else v) if not NAME.match(n)]
        if bad: raise ValueError(f'not a lowercase name: {", ".join(bad)}')
        if isinstance(v, list) and len(set(v)) != len(v): raise ValueError('listed twice')
        return v


class ManifestError(ValueError):
    pass


def load_lane(name: str, root: Path = LANES) -> Lane:
    """One lane's manifest, checked on its own: the folder and the name agree, each guard and fix has its file in the lane's
    guards/ or fixes/ folder, and every table name starts with the lane's name."""
    path = root / name / 'manifest.json'
    if not path.is_file(): raise ManifestError(f'no manifest at {path}')
    try: lane = Lane.model_validate(json.loads(path.read_text()))
    except (ValueError, json.JSONDecodeError) as e: raise ManifestError(f'{path}: {e}') from e
    if lane.lane != name: raise ManifestError(f'{path}: says lane "{lane.lane}" but sits in the folder "{name}"')
    for kind in ('guards', 'fixes'):
        missing = [n for n in getattr(lane, kind) if not (root / name / kind / f'{n}.py').is_file()]
        if missing: raise ManifestError(f'{path}: {kind} without a file in {kind}/: {", ".join(missing)}')
    wrong = [t for t in lane.tables.model_dump().values() if not t.startswith(f'{name}_')]
    if wrong: raise ManifestError(f'{path}: table names must start with "{name}_": {", ".join(wrong)}')
    if name in (lane.escalate.to if lane.escalate else None, lane.fallback): raise ManifestError(f'{path}: a lane cannot hand turns to itself')
    return lane


def load_lanes(root: Path = LANES) -> dict[str, Lane]:
    """Every lane folder's manifest, plus what lanes must not share: a turn is only handed to a lane that exists, and no two
    lanes write to the same Octo table."""
    lanes = {d.name: load_lane(d.name, root) for d in sorted(root.iterdir()) if d.is_dir() and not d.name.startswith(('_', '.'))}
    for lane in lanes.values():
        for to in (lane.escalate.to if lane.escalate else None, lane.fallback):
            if to and to not in lanes: raise ManifestError(f'lane "{lane.lane}" hands turns to "{to}", which has no folder')
    seen: dict[str, str] = {}
    for lane in lanes.values():
        for t in lane.tables.model_dump().values():
            if t in seen: raise ManifestError(f'lanes "{seen[t]}" and "{lane.lane}" both use the table "{t}"')
            seen[t] = lane.lane
    return lanes
