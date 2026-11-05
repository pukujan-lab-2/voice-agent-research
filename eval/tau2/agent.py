# The agent under test is our desk, not a bare model. Each caller line goes to the shipped Desk through
# eval/target-server.ts (/desk, LFM3 in the desk slot); what the desk did that turn comes back as tool calls into the
# copilot_tax environment (a quote, a kept value, a send), then the desk's reply goes to the caller.
import os
import uuid
from typing import Optional

import requests

from tau2.agent.base_agent import HalfDuplexAgent
from tau2.data_model.message import AssistantMessage, Message, MultiToolMessage, ToolCall, ToolMessage, UserMessage

TARGET = os.environ.get("COPILOT_TARGET", "http://127.0.0.1:8899").rstrip("/")


class DeskState:
    def __init__(self, session: str):
        self.session = session
        self.reply: Optional[str] = None  # the desk's words, held while its actions go through the tools


def desk(body: dict) -> dict:
    r = requests.post(f"{TARGET}/desk", json=body, timeout=600)
    r.raise_for_status()
    return r.json()


class CopilotDeskAgent(HalfDuplexAgent[DeskState]):
    def __init__(self, tools, domain_policy, mode: str):
        super().__init__(tools=tools, domain_policy=domain_policy)
        self.mode = mode

    def get_init_state(self, message_history: Optional[list[Message]] = None) -> DeskState:
        s = DeskState(uuid.uuid4().hex)
        desk({"session": s.session, "mode": self.mode})  # opens the call; the task's agent_opener is this same line
        return s

    def generate_next_message(self, message, state: DeskState) -> tuple[AssistantMessage, DeskState]:
        if isinstance(message, (ToolMessage, MultiToolMessage)):
            reply, state.reply = state.reply or "", None
            return AssistantMessage.text(reply), state
        assert isinstance(message, UserMessage)
        t = desk({"session": state.session, "said": message.content or ""})
        calls = [("quote_passage", q) for q in t["quotes"]]
        calls += [("fill_field", {"field": f["field"], "value": f["value"], "readback": f["readback"], "yes": f["yes"]}) for f in t["fills"]]
        calls += [("submit_form", {})] * int(t["submitted"])
        if t["claimed"]:
            calls.append(("submit_form", {"claimed_only": True}))
        if not calls:
            return AssistantMessage.text(t["reply"]), state
        state.reply = t["reply"]
        tool_calls = [ToolCall(id=f"c{i}", name=n, arguments=a, requestor="assistant") for i, (n, a) in enumerate(calls)]
        return AssistantMessage(role="assistant", content=None, tool_calls=tool_calls), state


def factory(mode: str):
    def create(tools, domain_policy, **kwargs):
        return CopilotDeskAgent(tools, domain_policy, mode)
    return create
