# How big a form, a call and a site can get

Our principle: code owns the state, the model never does. The model is shown a small window of it each turn; the rest lives in code. This page says where the limits are and why. Numbers were measured in this repository with `copilot-engine/tests/scale-report.ts`; they are not real traffic.

## The model's prompt (issue #101)

| What | Limit | Why |
|---|---|---|
| Fields listed to the model in full | 24 | A form up to this size is shown to the model exactly as before: every field in the system prompt, every value in each message. |
| Fields shown on a bigger form | 14 at most | The open field, the read-back waiting (and its group), the field to return to, queued answers, up to 3 fields the caller just named, the next 4 empty fields, and the last 3 filled. The rest is counted ("212 other fields are not shown"). |
| Options shown for a choice | 12, then a count | Code checks the answer against all of them. |
| Tool schema | no field list on a big form | The model names a field from the list in the message; code resolves it (`field()`), and ignores a name it doesn't know. |
| History sent to the model | last 6 user turns | Unchanged. Code restates the form state every turn. |
| History kept in memory | 12 user turns (twice the setting) | Older turns are dropped. |
| Call log kept in memory | first entry + latest 40 (up to 80) | `turns`, `events` and `fills` are small append-only records (about 200 bytes a turn) and are not capped. |

Measured: the largest request while filling a whole synthetic form (half the fields are 40-option choices) is about 9,000 characters (about 2,300 tokens) at 10, 100 and 300 fields. Before this change it was 9,572, 37,133 and 101,072.

Test: `copilot-engine/tests/desk-scale.test.ts` fills 300 fields over 600 turns and checks every value, runs a 100-turn call, and checks that a field the caller names is shown to the model and filled in its own place.

Known limit: a field the caller never names and that isn't in the window can't be filled by the model that turn. The visitor says it when that field comes up, or names it ("my favourite colour is teal").
