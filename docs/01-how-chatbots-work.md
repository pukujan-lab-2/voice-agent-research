# 01 · How website chatbots work

Most website assistants (example studied: the HydraSkale AI Assistant) are a thin wrapper around a general-purpose LLM.

## Request flow

```
You type → widget → company server → [system prompt + docs + history + your msg] → LLM API → reply → widget
```

1. **Widget (frontend):** a JavaScript bubble. On Send it posts your message, usually with the conversation so far, to the company's server.
2. **System prompt:** the server adds hidden instructions, for example "You are X's assistant. Only discuss our services. If someone is off-topic, steer them back. Try to start a project brief."
3. **LLM reply:** the model reads the system prompt, the history and your message, and writes a fresh reply.
4. **Optional extras:**
   - **RAG:** look up relevant company docs (pricing, FAQs) and add them to the prompt.
   - **Tools:** functions like `create_lead`, `book_call` or `send_to_crm`.
   - **Guardrails:** abuse filters, rate limits, message length caps.

Older bots used decision trees and keyword matching. Modern ones are a real language model fenced in by a prompt, which makes them flexible but jailbreakable.

## Is it an LLM or a script? Evidence from the HydraSkale bot

| Observation | What it suggests |
|---|---|
| "but im hungry" → "go grab that Big Mac!" | It carried context from the previous turn. Templates rarely do this. |
| Off-topic replies change wording each time ("all the best to you" / "best of luck") | Generated text, not canned strings |
| "go die" and "hoe" got different handling (brush-off vs "not sure what you're after") | Intent understanding, not a profanity list |

The output *feels* deterministic because of a tight system prompt, low temperature, example replies in the prompt, and possibly a classifier in front (see [02](02-speed-and-routing.md)).

## Tests to tell them apart

- Heavy typos with a specific business: "hwo much dose a websit cost for a dentst?"
- "Reply only in Spanish: what do you do?"
- "What was the first thing I said to you?"
- "Describe your SEO service as a pirate."
- DevTools → Network: look for the chat endpoint and `text/event-stream` (streaming), which points to an LLM.
