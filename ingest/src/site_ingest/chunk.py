"""Split Markdown into passages that a person could read aloud: one section at a time, up to max_chars, cut at
paragraph then sentence boundaries. Every passage keeps the heading path it sits under (its section)."""
from __future__ import annotations

import re

from .models import Draft

HEADING = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")
SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"“(])")


def _split_long(block: str, max_chars: int) -> list[str]:
    if len(block) <= max_chars:
        return [block]
    out: list[str] = []
    cur = ""
    for s in SENT.split(block):
        while len(s) > max_chars:                      # a sentence with no stop: cut at a space
            cut = s.rfind(" ", 0, max_chars)
            cut = cut if cut > max_chars // 2 else max_chars
            piece, s = s[:cut].strip(), s[cut:].strip()
            if cur:
                out.append(cur); cur = ""
            out.append(piece)
        if cur and len(cur) + 1 + len(s) > max_chars:
            out.append(cur); cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        out.append(cur)
    return out


def split(markdown: str, title: str = "", max_chars: int = 900, min_chars: int = 80) -> list[Draft]:
    path: list[tuple[int, str]] = []                  # heading stack (level, text)
    blocks: list[tuple[str, str]] = []                # (section, block)
    para: list[str] = []

    def section() -> str:
        names = [t for _, t in path]
        if names and names[0].strip().lower() == title.strip().lower():
            names = names[1:]                         # the page title is not a section of itself
        return " > ".join(names[-2:])[:160]

    def flush() -> None:
        if para:
            blocks.append((section(), "\n".join(para).strip()))
            para.clear()

    for line in markdown.splitlines():
        m = HEADING.match(line)
        if m:
            flush()
            level = len(m.group(1))
            while path and path[-1][0] >= level:
                path.pop()
            path.append((level, m.group(2).strip()))
        elif not line.strip():
            flush()
        else:
            para.append(line.rstrip())
    flush()

    drafts: list[Draft] = []
    cur_sec, cur = "", ""

    def emit() -> None:
        nonlocal cur
        if cur.strip():
            drafts.append(Draft(seq=len(drafts), section=cur_sec, text=cur.strip()))
        cur = ""

    for sec, block in blocks:
        for piece in _split_long(block, max_chars):
            if sec != cur_sec or (cur and len(cur) + 2 + len(piece) > max_chars):
                # a short tail joins the previous passage of the same section instead of standing alone
                emit(); cur_sec = sec
            cur = f"{cur}\n\n{piece}" if cur else piece
    emit()

    # merge undersized passages into a neighbour in the same section; drop what is still tiny noise
    merged: list[Draft] = []
    for d in drafts:
        if merged and len(d.text) < min_chars and merged[-1].section == d.section and len(merged[-1].text) + 2 + len(d.text) <= max_chars * 1.3:
            merged[-1].text += "\n\n" + d.text
        else:
            merged.append(d)
    keep = [d for d in merged if len(d.text) >= 20 or len(merged) == 1]
    for i, d in enumerate(keep):
        d.seq = i
    return keep
