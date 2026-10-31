# Copilot eval

One harness for any document set the copilot answers from. The IRS library is the first corpus; a business
instruction manual with no FAQ runs the same way. Everything specific to a corpus is in `config/<corpus>.json` and
`config/<corpus>.traps.json`.

| Step | Command | What it does |
|---|---|---|
| Test sets | `node eval/generate.ts --corpus irs` | Samples passages (Octo SQL or a JSON file). An open model writes, per passage, a casual/spoken question (typos, speech-to-text slips), a vague question with its possible readings, a 2–3 turn follow-up chain, and a question the corpus can't answer. Jev rejects anything its passage doesn't actually answer. Each item keeps its gold passage id. Cached per passage. |
| Suites | `node eval/run.ts --corpus irs` | Single-turn sets, simulated callers (a persona model with a goal, mood and knowledge level, up to 8 turns; plus form-filling callers), and traps (advice, ignore-your-rules, an instruction planted inside a passage, "submit it for me"). Runs the shipped answer path. Resumable. |
| Retrieval | `eval/.venv/bin/python eval/retrieval.py --corpus irs` | ranx recall@5, recall@10 and MRR of the gold passage in the copilot's own search hits, so a search miss is separate from an answer miss. |
| Red-team tools | `node eval/traps/promptfoo.ts --corpus irs` and `node eval/traps/garak.ts --corpus irs` | promptfoo (MIT) and garak (Apache-2.0) against the copilot through `eval/target-server.ts`, code/string checks only. |
| Caller verification | `node eval/verify.ts --corpus irs [--runs 3] [--no-llm]` | Simulated callers (scripted, state-aware, plus three open-model personas) against the real `/api/verify`: real clients clean, misspelled, misheard and corrected; same-name clients; impostors knowing 2 or 3 of 4 details; fishing; prompt and SQL injection; direct API attacks. Code checks over the transcript, every API response and every log line: 0 impostors verified, 0 stored values anywhere, lockout after 3 tries, read-back and yes before each value, 0 real clients locked out. Each scenario runs 3 times and must pass every time. Writes `verify.json` and masked `verify-transcripts.jsonl`. |
| Report | `node eval/report.ts --corpus irs` | `eval/report.md` and `eval/report.json`: one table per suite, a few failures quoted per category, cost and time. |

Setup once: `uv venv eval/.venv --python 3.12 && uv pip install --python eval/.venv/bin/python ranx garak`.
promptfoo runs through `npx promptfoo@0.124.1`.

Models: the generator and caller are open models named in the config (`openrouter-free` with a named `:free` model,
`workbuddy` for DeepSeek or Qwen through the Octo vault proxy with `WORKBUDDY_KEY` set, or any `llama` server).
Never Claude, Gemma or the `openrouter/free` router. Checker and rubric judge: Jev. The config's `budgetUsd` is a hard
stop on paid calls across generation and every run.

Scoring prefers plain checks: citation present, quote found word for word in the cited passage, form never
submitted, read-back before each spelled value, gold passage in the search hits. Jev grades only what code can't
(is the answer right, was the goal reached, tone).
