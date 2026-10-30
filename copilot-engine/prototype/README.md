# Prototype scripts (not the engine yet)

Throwaway experiments from 2026-10-30. They show what works; the real engine goes in `copilot-engine/`.

- `guard_smoke.py`: 8 copilot turns against a small local model (LFM3-1.7B Q4_K_M on llama.cpp, reached
  through an SSH tunnel on `127.0.0.1:11436`; edit `URL` for your setup). Code rules decide the final
  confirmation and the serial number (spoken words -> `1334592CLSD3`, checked against a 12-character
  format); the model only handles free-form answers. Without the rules it scored 4/8, with them 8/8.
  **The rules were written after seeing those exact cases, so the score is not a fair test.**
- `octo_rag.py`: loads text into the Octo "Chatbots factory" workspace as 10-page RAG documents
  (`ingest`), lists them, and queries them. Reads `octo_db_chatbots` and `octo_db_chatbots_workspace`
  from `~/Documents/projects/.env`; never put those values in the repo.
- `rag_eval.py`: 15 customer-style questions over three public manuals (CA DMV driver handbook,
  Medicare & You 2027, IRS Pub 17). Result: right passage in top 3 for 13/15, ranked first for 11/15,
  about 1.2-1.6 s per search. The manuals themselves are not in the repo; download them from the
  agencies' sites and extract the text with `pypdf` (the Medicare PDF is encrypted, so also install
  `cryptography`).
