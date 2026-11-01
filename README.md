# Support Expert Loop

Turn support experts' corrections into a measurably better AI support agent.

A company uploads past support tickets (CSV) and help docs (Markdown/text). The AI drafts an answer to each ticket from the docs, a support expert edits, approves, or rejects it, and every decision is stored as a structured example. Each new version of the agent is then tested on a locked set of held-out tickets it has never seen, rated blind, and compared case by case with the previous version.

```
Ticket → AI draft (cited sources) → expert correction → saved example → before/after on held-out cases → JSONL → fine-tune
```

| Screen | What it does |
| --- | --- |
| Cases | CSV import with validation preview; ticket list with split, status, and area filters |
| Review | Generate a draft, see the doc chunks and expert examples it used, edit/approve/reject |
| Evaluation | Lock a held-out set, run any version on it, rate answers blind (correct / incomplete / wrong) |
| Improvements | Approved corrections as diffs, version-vs-version matrix, KPIs, JSONL export |

## Quick start

Requires Node 22+ and Docker.

```bash
npm install
cp .env.example .env          # leave LLM_API_KEY empty to run fully offline
npm run db:up                 # Postgres 16 on localhost:5433
npm run db:migrate            # apply migrations
npm run db:seed               # demo product "Relay": 12 docs, 70 tickets, reviews, two rated runs
npm run dev
```

Open http://localhost:3000. The sidebar shows whether the model is **live** or **offline**.

**Model.** Any OpenAI-compatible endpoint serving an open-weight model works: Together, Fireworks, OpenRouter, or your own vLLM. Set `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY` in `.env`. Without a key, a deterministic extractive stub answers from the retrieved docs and examples. It is labelled everywhere in the UI, and it is enough to demonstrate the full loop with no account.

**Your own data.** On Cases, click **Import CSV**. The required columns are:

```
ticket_id,customer_question,expert_resolution,product_area
```

An optional `split` column (`train` or `eval`) pins cases; otherwise 30% of each product area is held out deterministically. `seed/sample-import.csv` is a small example. Upload docs on **Help docs**.

## Demo (about 2 minutes)

The seeded data tells one story: version A (docs only) gets **8/20** held-out tickets right, and version B (docs plus approved expert examples, same model and prompt) gets **15/20**. One held-out ticket, **T-1067** (Cloudflare 403 with a `cf-chl` challenge page), is still wrong for both versions, because the fix (Bot Fight Mode) is not in the docs and no expert has approved a correction for it yet.

1. **Overview.** Point at the loop counts and the A → B result.
2. **Cases.** 50 train and 20 held-out tickets. Held-out rows are locked, so the system can never learn from them.
3. **Review T-1018** (train, Cloudflare). Generate a draft with B. It cites the docs, but the docs never mention Bot Fight Mode, so the draft misses the real cause. Edit the draft with the real fix and approve it. The Diff toggle shows exactly what the expert taught.
4. **Evaluation.** Run **B** on *Held-out v1*. T-1067 now retrieves the T-1018 correction as an example and answers with the Bot Fight Mode fix. Rate the run blind; the version is hidden from the rater.
5. **Improvements.** Compare the new B run against A, with regressions listed first. Download the approved examples as JSONL for fine-tuning.

`npm run test:db` runs exactly this flow against the database as an integration test, then restores the demo data. **Load demo dataset** on the Overview page resets everything.

## How it works

```
app/            Next.js App Router pages and server actions (app/actions/*)
lib/engine.ts   build context (retrieve docs + examples, guard, prompt) and call the model
lib/retrieval/  heading-aware chunking, Postgres full-text search (tsvector + GIN)
lib/prompt/     versioned prompts (support-v1); prompt version is stored on every review and run
lib/llm/        ModelRunner interface: OpenAI-compatible runner + offline stub
lib/guards.ts   leakage guards (below)
lib/export/     approved-only JSONL in TRL chat format
prisma/         schema: Case, Document, Chunk, AgentConfig (version), Review, EvalSet, EvalRun, EvalResult
ml/             TRL + PEFT LoRA fine-tune, vLLM serving, add as version C
```

A **version** (`AgentConfig`) is a model endpoint, a prompt version, a retrieval strategy (whether to use approved expert examples, and how many), and a temperature. New versions, including a fine-tuned model behind vLLM, are added on Improvements and evaluated on the same locked set.

Every **review** stores the AI draft, the final answer, its status (approved, edited-then-approved, rejected with reason), the source and example references, the reviewer, the model name, the prompt version, latency, and the edit distance between draft and final answer.

### Leakage guarantees

Held-out scores only mean something if the held-out answers never reach the model. These are enforced in code and covered by tests (`tests/guards.test.ts`, `tests/integration/demo-loop.test.ts`):

- The prompt is built from an explicit allow-list of case fields (question, product area). The expert resolution is never one of them, and every prompt is checked at runtime to confirm it does not contain the case's own resolution.
- Examples are retrieved only from approved reviews of **train** cases, never the case being answered, and they are asserted again before each model call.
- Drafts and reviews cannot be created for held-out cases.
- Once an evaluation set is locked, CSV imports cannot move cases between train and held out.
- Export includes only approved reviews of train cases.
- Uploaded docs are checked for long overlaps with held-out resolutions (8-word shingles), and any overlap is flagged on Evaluation.
- Ratings are blind: answers are shuffled and citation markers hidden, so the rater cannot tell which version wrote them.

## Deploy (Vercel + Neon)

1. Create a Neon Postgres database and copy its pooled connection string.
2. Apply migrations and load the demo data from your machine:
   ```bash
   DATABASE_URL="postgres://..." npm run db:deploy
   DATABASE_URL="postgres://..." npm run db:seed
   ```
3. Import the repo into Vercel and set `DATABASE_URL`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`, and optionally `DEFAULT_REVIEWER` and `PRODUCT_NAME`. The build runs `prisma generate` automatically.
4. Evaluation runs execute in a server action with `maxDuration = 300`, which covers 20 cases at a concurrency of 4 on a hosted 8B model.

The `seed/` folder is bundled with the deployment (`outputFileTracingIncludes`), so **Load demo dataset** also works in production.

## Fine-tuning

See [`ml/README.md`](ml/README.md): export the approved examples, train a LoRA adapter with TRL `SFTTrainer` and PEFT, serve it with `vllm serve --enable-lora`, add it as version C, and compare C with A and B on the same locked set.

## Scripts

| Command | |
| --- | --- |
| `npm test` | unit tests (CSV parsing, splits, guards, prompt, retrieval, stub) |
| `npm run test:db` | end-to-end demo loop against the database |
| `npm run check:retrieval` | print the docs and examples retrieved for every held-out case |
| `npm run export:jsonl` | write `exports/approved-examples.jsonl` |
| `npm run db:reset` | drop, migrate, and reseed |

## Positioning

- **What you own is the loop, not the model.** Every expert decision becomes a versioned, attributable training example, and every new version is proven on unseen tickets before it ships. Model choice is a config row.
- **The metric a support leader trusts.** "15 of 20 unseen tickets correct, up from 8, with 1 regression you can read" is more convincing than a benchmark score, because each case is visible next to the number.
- **Open-weight by default.** Customers keep their data and can fine-tune on it, which matters most to companies whose support knowledge is their moat (dev tools, fintech, infrastructure).
- **What to measure in a pilot:** how far approval-without-edits rises over time, how far edit distance falls, the held-out score for each version, and the cost per resolved ticket compared with a closed model.
