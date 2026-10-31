# copilot-engine

Step-by-step website copilot: asks one question at a time, reads back names and hard identifiers for a yes, goes
back to an earlier answer when told it is wrong, shows a confirm card, and only then acts. See `PLAN.md` for the plan and status.

    npm test                    # engine rules with a stand-in model (no server needed)
    npm run scenarios           # same scenarios, stand-in model, appends to ledger.jsonl
    npm run scenarios:llama     # real small model at LLAMA_URL (default http://127.0.0.1:11436)
    node tests/holdout.ts --llama   # untuned utterances

Code decides what can be decided (serial parsing, yes/no, choice matching, the submit gate). The model only reads one
free-form answer into one action. `src/flows/` holds the flows; `prototype/` holds the earlier experiments.
