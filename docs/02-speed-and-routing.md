# 02 · Speed and routing

## Why replies arrive in under a second

1. **Streaming:** tokens are sent to the browser as they're generated. The first words appear in about 0.3–1 s.
2. **Fast hardware:** providers run models on GPU/accelerator clusters at roughly 50–200+ tokens/s. A 60–80 token reply finishes in under a second.
3. **Small models:** sales and support bots use fast tiers (Haiku-class, mini-class). Staying on topic doesn't need much reasoning.
4. **Short prompts and answers:** less input to read, and a `max_tokens` cap on output.
5. **Prompt caching:** the system prompt is identical for every visitor, so its processed form is cached.

```
Network to server ............ ~50 ms
Server → LLM API ............. ~50 ms
Model reads prompt ........... ~100–400 ms  (less with caching)
First token appears .......... ~0.3–1 s total
Rest of reply streams in ..... ~0.5–3 s
```

## Routing (triage) pattern

A cheap, fast classifier decides where each message goes, so junk never reaches the expensive path.

```
User message
   │
   ▼
[1] Pre-checks (no AI): rate limit, length cap, spam regex
   │
   ▼
[2] Router (tiny LLM call, temperature 0, max_tokens ≈ 5)
    → abusive | off_topic | greeting | sales_question | ready_to_buy
   │
   ├─ abusive / off_topic ──► short reply (template or tiny model)   ~300 ms
   ├─ greeting ─────────────► friendly reply + "what brings you here?"
   ├─ sales_question ───────► main agent + company knowledge
   └─ ready_to_buy ─────────► main agent + tools (create_brief, book_call, save_lead)
```

Benefits: speed, cost, safety (the agent with tools never sees abuse), and consistent off-topic replies.

Router prompt example:

```python
ROUTER_PROMPT = """Classify the user's latest message for a web agency's sales chatbot.
Return only one label:
abusive | off_topic | greeting | sales_question | ready_to_buy
Typos and slang are fine; judge intent. Consider the previous turns."""
```

Many simple bots skip the router and use **one fast model with a strict system prompt**. Add the router once traffic or tools justify it.

## Main agent

- **System prompt:** identity, services, tone, "stay on topic", "2–3 sentences", goal (start a brief).
- **Knowledge:** inline in the prompt if short, RAG if large. Turn on prompt caching.
- **Tools:** `start_brief(...)`, `book_call(...)`.
- **Memory:** the last N messages, keyed by session ID.

## Simplest stack

- JS widget embedded with one `<script>` tag
- One `/chat` endpoint (Next.js route, FastAPI or Cloudflare Worker) holding the API key
- SQLite or Supabase for conversations and leads
