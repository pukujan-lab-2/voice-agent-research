#!/bin/zsh
# after the main run: the weighted suites, garak, ranx, report
cd /Users/teresa/Documents/chatbots/.claude/worktrees/strange-morse-7b3efa
until grep -q "run done\|stopped:" eval/out/irs/run.log; do /bin/sleep 60; done
export OCTO_TIMEOUT_MS=150000
echo "== noise,clarify $(date)"; node --no-warnings eval/run.ts --corpus irs --suites noise,clarify >> eval/out/irs/run2.log 2>&1
echo "== grounding $(date)"; node --no-warnings eval/run.ts --corpus irs --suites grounding >> eval/out/irs/run2.log 2>&1
while pgrep -f "traps/promptfoo.ts" >/dev/null; do /bin/sleep 60; done
echo "== garak $(date)"; node --no-warnings eval/traps/garak.ts --corpus irs > eval/out/irs/garak.log 2>&1
echo "== ranx $(date)"; eval/.venv/bin/python eval/retrieval.py --corpus irs > eval/out/irs/ranx.log 2>&1
echo "== report $(date)"; node --no-warnings eval/report.ts --corpus irs > eval/out/irs/report.log 2>&1
tail -3 eval/out/irs/run2.log; tail -5 eval/out/irs/ranx.log; echo "chain done $(date)"
