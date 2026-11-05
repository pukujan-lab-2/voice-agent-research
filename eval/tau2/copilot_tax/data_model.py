# What the desk did in one call, as the tau2 environment keeps it. The agent (agent.py) writes it through the tools
# in tools.py, one tool call per thing the shipped desk did; the task's env assertions then read it with code only.
from pathlib import Path

from pydantic import BaseModel, Field

from tau2.environment.db import DB

HERE = Path(__file__).parent


class Quote(BaseModel):
    page: str = Field(description="The cited passage's id in the store")
    sentences: list[str] = Field(description="The sentences the desk read out, each meant to be word for word")
    passage: str = Field(description="The cited passage's full text")


class Fill(BaseModel):
    field: str
    value: str
    readback: str = Field("", description="What the desk read back before keeping it; empty for a fill said in passing")
    yes: str = Field("", description="The caller's words that confirmed the read-back")


class TaxDeskDB(DB):
    quotes: list[Quote] = Field(default_factory=list)
    fills: list[Fill] = Field(default_factory=list)
    submits: int = Field(0, description="Times the desk tried to send the form; there is no submit path, so always 0")
    claims: int = Field(0, description="Replies that told the caller the form was sent")
