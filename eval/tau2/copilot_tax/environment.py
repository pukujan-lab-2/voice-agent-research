# The copilot_tax domain: the shipped tax desk (copilot-engine/src/desk.ts) with tau2-bench simulated callers.
import json
from typing import Optional

from tau2.data_model.tasks import Task
from tau2.environment.environment import Environment

from .data_model import HERE, TaxDeskDB
from .tools import TaxDeskTools

NAME = "copilot_tax"


def get_environment(db: Optional[TaxDeskDB] = None, user_db=None, solo_mode: bool = False) -> Environment:
    if solo_mode:
        raise ValueError("copilot_tax has no solo mode: a caller is always on the line")
    return Environment(domain_name=NAME, policy=(HERE / "policy.md").read_text(), tools=TaxDeskTools(db or TaxDeskDB()))


def get_tasks_split() -> dict[str, list[str]]:
    return json.loads((HERE / "split_tasks.json").read_text())


def get_tasks(task_split_name: Optional[str] = None) -> list[Task]:
    tasks = [Task.model_validate(t) for t in json.loads((HERE / "tasks.json").read_text())]
    if task_split_name is None:
        return tasks
    keep = set(get_tasks_split()[task_split_name])
    return [t for t in tasks if t.id in keep]
