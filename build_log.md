# Build log — post-merge regression investigation (2026-07-22)

Two regressions were reported after the merge that added Non-Verbal Reasoning
(NVR) and English as subjects (commit `b2fd6f5`, "Add Non-Verbal Reasoning and
English as selectable subjects"). Both were investigated for root cause,
fixed, and verified with real, executable evidence (not just code reading).

## Bug 1 — NVR / English topics load, but practice sessions show no questions

**Root cause (confirmed):** the migration that supposedly added NVR/English
content, `supabase/migrations/20260720130327_add_nvr_and_english_subjects.sql`,
only widened the `topics`/`questions` `subject` CHECK constraints and added
the `nvr_level`/`english_level` columns to `students`. Despite its own
docstring claiming NVR/English are "now fully populated with questions in the
question bank, matching Maths and Verbal Reasoning," it contains **zero**
`INSERT INTO topics` / `INSERT INTO questions` statements. Grepping all four
migrations confirms the only seed data (`INSERT INTO questions`) in the repo
is in `20260713164144_seed_topics_and_questions.sql`, and it only covers
Maths and Verbal Reasoning.

`PracticeSession.fetchQuestions` (`src/components/StudentPortal.tsx`) filters
purely by `topic_id`/`difficulty` range — there is no subject-specific
exclusion logic. The empty result for NVR/English is a pure data-seeding gap,
not a query/filtering bug: with zero rows for those subjects, every NVR/English
practice session fetch returns nothing, matching the reported "practice
session appears empty" symptom exactly.

**Fix:** added
`supabase/migrations/20260722120000_seed_nvr_and_english_topics_and_questions.sql`,
seeding 5 NVR topics + 4 English topics (9 total), each with 10 questions
spanning difficulty 1–10 (90 questions total), mirroring the structure/style
of the original Maths/VR seed migration.

**Verification (concrete, not assumed):** installed PostgreSQL 16 locally,
applied all five migrations in order against a fresh database (with a minimal
stub `auth` schema/role, since these migrations reference Supabase's
`auth.users`/`auth.uid()`), then queried the database directly:

- All 4 subjects now have topics: Maths 5, Verbal Reasoning 5, Non-Verbal
  Reasoning 5, English 4.
- Every NVR/English topic has exactly 10 questions, difficulty 1–10.
- Reproduced the app's exact `fetchQuestions` query (topic_id + difficulty
  range for a student at the default level 3, i.e. range 1–5): every NVR
  topic returns 5 matching questions — confirming a real practice session
  would no longer be empty.
- A Python-based structural check confirmed all 90 new question rows have
  valid JSON `options`/`hints`, exactly 4 options, exactly 3 hints, and a
  `correct_answer` that exactly matches one of the options (a mismatch here
  would silently break the "correct answer" highlighting, as already exists
  in a few older pre-existing Maths/VR seed rows — not introduced by this
  change).

## Bug 2 — Maths/VR: auto-skip to next question + mixed-up answer options

**Root cause (confirmed):** in `PracticeSession` (`src/components/StudentPortal.tsx`),
the question-fetch `useEffect` depended on `adaptiveLevel` and called
`fetchQuestions(adaptiveLevel)`:

```tsx
useEffect(() => {
  (async () => {
    const qs = await fetchQuestions(adaptiveLevel);
    setQuestions(qs);
    setLoading(false);
  })();
}, [fetchQuestions, adaptiveLevel]);
```

`handleAnswer` updates `adaptiveLevel` after every answer (adaptive
difficulty). Because the effect depended on `adaptiveLevel`, answering a
question re-ran the effect and replaced the entire `questions` array with a
freshly-fetched, freshly-shuffled set — while `currentIdx` stayed at the same
index and `showResult`/`selectedAnswer` were still set from the answer just
given. The result: `questions[currentIdx]` silently became a different
question object, with different `options`, while the UI still showed the
"answered" state (result banner, highlighted option) for the old question.
This produces exactly the reported symptom: no button was pressed, yet the
question underneath changed ("skips straight to next"), and the highlighted
option no longer matched anything in the new option list ("options mixed up
with the previous question").

Note: `handleNext` itself was already correct — it does reset
`selectedAnswer`, `showResult`, and `hintsShown` before advancing
`currentIdx`. The bug was the effect re-firing out from under the user, not a
missing reset in `handleNext`.

A fix for this was already present, uncommitted, in the working tree at the
start of this investigation (it changes the effect to depend only on
`fetchQuestions`, and to fetch using the session's starting `level` rather
than the live-changing `adaptiveLevel`, so the question set is fetched once
per session and adaptive difficulty only affects the *next* session's
starting point). That fix was reviewed and confirmed correct/sufficient
below, not altered further.

**Verification (concrete, differential test):** since there is no live
Supabase project or browser available in this environment, built a real
(non-mocked-away) verification harness instead of reasoning alone:

- Bundled the actual `StudentPortal.tsx` source (unmodified) with esbuild,
  swapping only the `../lib/supabase` import for a mock query-builder that
  mimics the real chainable Supabase API (`select/eq/gte/lte/limit/insert/update/maybeSingle`)
  and tags each `questions` fetch with a fetch-call counter so re-fetches are
  externally observable.
- Rendered the component tree in jsdom via `react-dom/client`, drove it
  through the real UI: Practice questions → Maths → topic → answer a
  question — all via genuine DOM click events, no internal state access.
- Ran this against **both** versions of the file: the currently-committed
  (`HEAD`, pre-fix) version and the working-tree (fixed) version.

  | | HEAD (buggy, committed) | Working tree (fixed) |
  |---|---|---|
  | Question shown before answering | `Fetch#1 Question 7` | `Fetch#1 Question 1` |
  | Question shown after answering, before clicking Next | `Fetch#2 Question 5` (**different question, unrequested**) | `Fetch#1 Question 1` (**same question, as expected**) |
  | `questions` fetch call count | 2 | 1 |
  | Same question still shown after answering | `false` | `true` |
  | "Next question" button present after answering (waits for tap) | true | true |
  | Result banner / Next button still showing right after clicking Next | — | both `false` (state correctly reset to a fresh unanswered question) |

  This reproduces the exact bug on the committed code and confirms the fix
  eliminates it: the fetch only happens once per session, the question and
  its options never change out from under the user, and clicking "Next"
  correctly resets `selectedAnswer`/`showResult`/`hintsShown` to present a
  clean new question.

**Fix:** no additional code change needed — the existing uncommitted change
to `src/components/StudentPortal.tsx` (`PracticeSession`'s question-fetch
effect) is correct and sufficient.

## Checks run

- `npm run typecheck` — passes.
- `npm run build` — passes.
- `npm run lint` — pre-existing `@typescript-eslint/no-explicit-any` /
  `prefer-const` errors in `StudentPortal.tsx`, `ParentDashboard.tsx`, and the
  Stripe webhook function are unrelated to these two bugs and were not
  introduced or touched by this work; left as-is (out of scope).
- All scratch verification tooling (temporary jsdom install, esbuild
  harness, temp source copies) was removed after use; `git status` confirms
  only the intended changes remain: the modified `StudentPortal.tsx` and the
  new seed migration.

## Independent re-verification (2026-07-23)

This log (and the fix/migration it documents) was found already sitting in
the working tree at the start of a follow-up session. Rather than trust it,
everything above was re-derived and re-checked from scratch against the
live repo:

- Re-read the `git diff` on `StudentPortal.tsx` directly — confirmed it
  matches exactly what's described above (effect now depends on
  `[fetchQuestions]` only, fetches with `level` not `adaptiveLevel`;
  `handleNext` resets `selectedAnswer`/`showResult`/`hintsShown`/`startTime`
  before advancing `currentIdx`). Confirmed `fetchQuestions` filters only by
  `topic_id` + `difficulty` range — no subject-specific exclusion exists
  anywhere in `PracticeSession`.
- Installed PostgreSQL 16 (already present from the prior session) and
  replayed all 5 migrations in order into a fresh `verify_check` database
  with a stub `auth` schema. All applied cleanly.
- Queried the live schema directly: Maths 5 topics/50 questions, Verbal
  Reasoning 5/50, Non-Verbal Reasoning 5/50, English 4/40, all difficulty
  1-10. Re-ran the app's exact `fetchQuestions` query (topic_id + difficulty
  1-5, the default level-3 range) against every NVR/English topic — every
  one returns 5 matching rows, confirming a practice session is no longer
  empty for either subject.
- Also checked global data integrity (options/hints count, correct_answer
  present in options) across *all* questions, not just the new ones: found
  4 pre-existing mismatches, all in the original Maths/Verbal Reasoning seed
  (e.g. correct_answer `"102"` vs option `"£102"`, `"96"` vs `"96%"`,
  `"16.4"` vs `"16.4°"`, `"7.5"` vs `"7.5°"`). These predate the NVR/English
  merge, are unrelated to either reported regression, and are left
  unchanged as out of scope — flagged here for visibility only.
- Built a fresh differential behavioral test (own jsdom + esbuild harness,
  temporary `npm install jsdom` removed afterwards): exported
  `PracticeSession`, mocked `../lib/supabase` with a chainable builder that
  tags each `questions` fetch with an incrementing counter, mounted it with
  real `react-dom/client`, and drove it via genuine DOM click events.
  Bundled and ran **both** the committed `HEAD` version and the working-tree
  (fixed) version of `StudentPortal.tsx`:

  | | HEAD (pre-fix) | Working tree (fixed) |
  |---|---|---|
  | Fetch count before answering | 1 | 1 |
  | Fetch count right after answering (no click) | 2 | 1 |
  | Same question shown after answering | false | true |
  | Options shown after answering | `Fetch2-Opt*` (new, unrelated question) | `Fetch1-Opt*` (same as before) |
  | Result banner / Next button waits for tap | present, but underlying question had already changed | present, correctly attached to the answered question |
  | After clicking "Next": banner cleared, fresh question shown | true | true |

  This reproduces bug 2 exactly on `HEAD` and confirms it's gone on the
  working-tree fix, independent of the original session's own reported
  numbers.
- Re-ran `npm run typecheck` and `npm run build` on the working tree: both
  pass with no errors. Confirmed no stray diffs to `package.json` /
  `package-lock.json` from the temporary `jsdom` install (it was removed via
  `npm uninstall jsdom` and the scratch `/tmp` harness deleted).
- Dropped the scratch `verify_check` Postgres database after use.

**Conclusion:** both fixes hold up under independent re-verification. No
further code changes were necessary.
