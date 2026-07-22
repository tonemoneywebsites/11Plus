/*
# Add Non-Verbal Reasoning and English subjects

## Overview
Non-Verbal Reasoning and English are now fully populated with questions in the
question bank, matching Maths and Verbal Reasoning. This migration updates the
schema so the platform can track adaptive levels and validate topic/question
rows for these two additional subjects.

## Changes
1. **students** — add `nvr_level` and `english_level` columns (int, 1-10,
   default 3), mirroring `maths_level` / `vr_level`.
2. **topics** / **questions** — widen the `subject` CHECK constraint to allow
   'Non-Verbal Reasoning' and 'English' alongside the existing values.
*/

-- ============ STUDENTS: new level columns ============
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS nvr_level int NOT NULL DEFAULT 3 CHECK (nvr_level BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS english_level int NOT NULL DEFAULT 3 CHECK (english_level BETWEEN 1 AND 10);

-- ============ TOPICS: widen subject constraint ============
ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_subject_check;
ALTER TABLE topics ADD CONSTRAINT topics_subject_check
  CHECK (subject IN ('Maths', 'Verbal Reasoning', 'Non-Verbal Reasoning', 'English'));

-- ============ QUESTIONS: widen subject constraint ============
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_subject_check;
ALTER TABLE questions ADD CONSTRAINT questions_subject_check
  CHECK (subject IN ('Maths', 'Verbal Reasoning', 'Non-Verbal Reasoning', 'English'));
