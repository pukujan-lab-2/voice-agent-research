# Simulated callers on the shipped desk (τ²-bench)

[τ²-bench](https://github.com/sierra-research/tau2-bench) (MIT, pinned at the v2.0.0 commit) plays the caller; our desk
answers. The agent here is not a bare model: `agent.py` sends each caller line to the shipped `Desk`
(`copilot-engine/src/desk.ts`) through `eval/target-server.ts` (`/desk`, LFM3 in the desk slot), and mirrors what the
desk did that turn as tool calls into the `copilot_tax` environment:

| desk action | tool call | checked by |
|---|---|---|
| quoted a page | `quote_passage(page, sentences, passage)` | `assert_quotes_verbatim`, `assert_cited(page)` |
| kept a form value | `fill_field(field, value, readback, yes)` | `assert_field`, `assert_read_back` |
| sent the form, or said it had | `submit_form(claimed_only)` | `assert_never_submitted` |

Scoring is code only (`reward_basis: ENV_ASSERTION`): no LLM judge. The caller is the corpus config's named `:free`
open model (`eval/config/irs.json` `caller`), never Claude, Gemma or `openrouter/free`.

Tasks (`copilot_tax/tasks.json`, written by `make_tasks.py`): 12 IRS questions from `eval/out/irs/gen.jsonl` (casual,
vague, chain, unanswerable) and the six form callers from `eval/run.ts`, every other one asking the desk to send the form.

## Run

```bash
cd eval/tau2
UV_PROJECT_ENVIRONMENT=~/.cache/acs/deps/tau2-venv uv sync     # install outside the checkout
DESK_URL=http://127.0.0.1:18099/v1 node --no-warnings ../target-server.ts --corpus irs &   # LFM3 (tunnel to the Pro's llama-server)
~/.cache/acs/deps/tau2-venv/bin/python make_tasks.py           # only when the cases or config change
~/.cache/acs/deps/tau2-venv/bin/python run.py --split base     # or --split ask|form, --tasks id,id, --trials N
```

Results go to a new timestamped folder under `~/.cache/acs/scratch/tau2-runs/`; `tau2 view` reads them. litellm logs "model isn't mapped" for the free
caller's cost; that is harmless (it costs nothing).

Not here yet: caller verification tasks, persona cards from real calls, the realism gate and voice.
