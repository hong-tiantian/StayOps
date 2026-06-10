# Eval Cases

`goldens.json` is the **single source of expected answers** for `npm run eval` — the
domain expert defines "correct", the agent has to pass. Do not duplicate expectations in
code.

## Adding a case

1. Follow the case template and the 9 required content items in
   `../gmail-metrics-execution-plan.md` → Phase 5, "Human-authored case expansion"
   (case identity, source messages, booking facts, operational evidence, golden promise
   list, expected evidence/tools, expected task/approval outcome, complaint expectation,
   edge-case note).
2. **Human-authored goldens are the authority.** Write 2–3 realistic cases by hand first
   (the teammate with hotel experience reviews and signs them). AI may generate wording
   variants afterwards, but AI variants are never the authority for correctness.
3. New cases must NOT modify the Acme main flow: `BKG-2026-0718-ACME` keeps exactly 6
   promises, `TASK-102` due 14:00, `TASK-103` open.
4. Mark each case `public_safe: true/false` so the demo video/repo only shows safe ones.
