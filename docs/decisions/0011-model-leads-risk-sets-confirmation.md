# 0011. The model leads; a risk score sets how it confirms

**Status:** Accepted · **Date:** 2026-11-01 · **Replaces:** [0003](0003-one-small-decision-per-turn.md)

## Decision

The model leads the conversation. It decides what to ask, what to read back, and when to confirm. It does this from a prompt that gives every field and action a risk score from 1 to 100, and the score sets how it confirms:

| Score | What the agent does | Example |
|---|---|---|
| 1–10 | Just does it | Looking up a guide, showing a map |
| 11–30 | Mentions it in passing: "Booking you for Tuesday at 3…" | Choosing a time slot |
| 31–55 | Reads it back and waits for a yes | Name, phone number, email |
| 56–75 | Summarises and needs a clear yes; "I guess" or "sure, whatever" doesn't count | Submitting a booking request |
| 76–90 | Summarises, gets a yes, then asks "are you sure?" | Agreeing to terms, skipping a required step |
| 91–100 | A person approves before it runs | Payments, cancelling an order, anything that can't be undone |

Each business sets its own scores, so a company with its own policy levels maps them onto the scale.

Five rules apply on top of the table:

1. **Mishearings raise the stakes.** After the user corrects a misheard value, each remaining step in that conversation scores 15 higher.
2. **Code locks 56 and up.** From 56 up, code refuses to run the action until it has a recorded yes from the user (and, from 91, from a person). The prompt asks for confirmation; the lock makes sure it happened.
3. **Long text gets a summary.** For terms and similar text, the agent reads a short summary plus the key clauses word for word, then asks "do you agree?". It never reads the whole document aloud and never takes silence as agreement.
4. **Skips and submits at 76 and up are asked twice.** When the user wants to skip a step or submit, the agent confirms, then asks once more.
5. **Spell out what matters.** Numbers, phone numbers and email addresses are read back spelled out, one question at a time.

The NYC map agent only looks things up and plans or shows trips. All of its actions score 30 or below, so it never stops to confirm. At most, it repeats the route or place in its answer.

## Why

The owner chose a model-led conversation and the 1 to 100 scale on 2026-10-31 (#52). Each part comes from published guidance:

- **Implicit or explicit confirmation by consequence.** Mycroft's voice design guide says to state back without asking in most cases. It keeps a yes/no prompt for multi-step input and for changes with significant consequences, because constant prompts are tedious ([Mycroft, Confirmations](https://mycroft-ai.gitbook.io/docs/skill-development/voice-user-interface-design-guidelines/interactions-and-guidelines/confirmations)). That gives the bands up to 55.
- **Risk ratings drive safeguards.** OpenAI's guide rates each tool low, medium or high by write access, reversibility, permissions and financial impact. The ratings trigger checks before high-risk actions run ([OpenAI, A practical guide to building agents](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf), "Guardrails"). Our scale is a finer version of those three levels.
- **Hand off risky actions to a person.** The same guide sends sensitive, irreversible or high-stakes actions to a person, citing order cancellations, large refunds and payments. It also escalates when the agent fails to understand after several tries ("Plan for human intervention"). That gives the 91–100 band and the mishearing rule.
- **Layered guardrails.** The guide calls guardrails "a layered defense mechanism" and pairs model checks with rules-based ones. The prompt guides the model and the code lock enforces the result.
- **Voice output.** LiveKit's prompting guide says to spell out numbers, phone numbers and email addresses, keep replies brief and ask one question at a time ([LiveKit, Prompting guide](https://docs.livekit.io/agents/start/prompting)).

The 0003 concern still holds: small open models are less reliable at open tool use. That is why the lock is in code and not left to the prompt.

## Consequences

The engine moves from one JSON decision per turn to a model-led loop with tools; #16 carries that work. Each business config gains a risk score per field and action, and the default bands live in one place so the code lock and the prompt read the same numbers. The confirmations each turn asked for and received go to Phoenix, so evals can check that every action from 56 up had its yes. The band limits are a starting point: changing them needs a new decision.
