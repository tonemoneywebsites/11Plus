/*
# Create 11+ Exam Prep Platform Schema

## Overview
This migration creates the full database schema for a UK 11+ exam preparation platform.
Parent accounts sign up, create student profiles, and each student gets an adaptive
practice system for Maths and Verbal Reasoning with diagnostic assessment, difficulty
adjustment, and a 3-hint progressive system.

## New Tables

1. **profiles** — Extends auth.users with display name for the parent account.
   - `id` (uuid, PK, references auth.users)
   - `display_name` (text, parent's name)
   - `created_at` (timestamp)

2. **students** — Child profiles created by a parent.
   - `id` (uuid, PK)
   - `parent_id` (uuid, FK to profiles, defaults to auth.uid())
   - `name` (text, child's name)
   - `year_group` (int, school year e.g. 4, 5, 6)
   - `avatar_emoji` (text, emoji for the child profile)
   - `diagnostic_completed` (bool, whether diagnostic is done)
   - `maths_level` (int, adaptive difficulty level 1-10 for maths)
   - `vr_level` (int, adaptive difficulty level 1-10 for verbal reasoning)
   - `created_at` (timestamp)

3. **topics** — Subject topics for organising questions.
   - `id` (uuid, PK)
   - `subject` (text, 'Maths' or 'Verbal Reasoning')
   - `name` (text, e.g. 'Fractions', 'Code Letters')
   - `description` (text)
   - `order_index` (int, display ordering)

4. **questions** — The question bank.
   - `id` (uuid, PK)
   - `topic_id` (uuid, FK to topics)
   - `subject` (text, denormalised for easy filtering)
   - `difficulty` (int, 1-10)
   - `question_text` (text)
   - `question_type` (text, 'multiple_choice' or 'text_input')
   - `options` (jsonb, array of options for multiple_choice)
   - `correct_answer` (text)
   - `hints` (jsonb, array of 3 progressive hint strings)
   - `explanation` (text, shown after answering)

5. **attempts** — Records every question attempt by a student.
   - `id` (uuid, PK)
   - `student_id` (uuid, FK to students)
   - `question_id` (uuid, FK to questions)
   - `subject` (text)
   - `topic_id` (uuid)
   - `difficulty` (int)
   - `is_correct` (bool)
   - `hints_used` (int, 0-3)
   - `time_spent_seconds` (int)
   - `is_diagnostic` (bool, whether this was part of the diagnostic)
   - `created_at` (timestamp)

6. **topic_progress** — Aggregated progress per student per topic.
   - `id` (uuid, PK)
   - `student_id` (uuid, FK to students)
   - `topic_id` (uuid, FK to topics)
   - `subject` (text)
   - `total_attempts` (int)
   - `correct_attempts` (int)
   - `mastery_level` (int, 0-100 percentage)
   - `last_attempted_at` (timestamp)
   - Unique constraint on (student_id, topic_id)

7. **subscriptions** — Stripe subscription / trial tracking.
   - `id` (uuid, PK)
   - `parent_id` (uuid, FK to profiles, defaults to auth.uid())
   - `status` (text, 'trialing', 'active', 'past_due', 'canceled', 'inactive')
   - `stripe_customer_id` (text, nullable)
   - `stripe_subscription_id` (text, nullable)
   - `trial_start` (timestamp)
   - `trial_end` (timestamp, when 7-day trial ends)
   - `current_period_end` (timestamp, nullable)
   - `created_at` (timestamp)

## Security (RLS)
- All tables have RLS enabled.
- profiles: owner can read/update own row.
- students: parent can CRUD their own children.
- topics: anyone authenticated can read (reference data).
- questions: anyone authenticated can read (reference data).
- attempts: parent can read/insert/update attempts for their children.
- topic_progress: parent can read/insert/update for their children.
- subscriptions: parent can read/update own subscription.
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ STUDENTS ============
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  year_group int NOT NULL DEFAULT 5 CHECK (year_group BETWEEN 1 AND 8),
  avatar_emoji text NOT NULL DEFAULT '🦊',
  diagnostic_completed boolean NOT NULL DEFAULT false,
  maths_level int NOT NULL DEFAULT 3 CHECK (maths_level BETWEEN 1 AND 10),
  vr_level int NOT NULL DEFAULT 3 CHECK (vr_level BETWEEN 1 AND 10),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_students" ON students;
CREATE POLICY "select_own_students" ON students FOR SELECT
  TO authenticated USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS "insert_own_students" ON students;
CREATE POLICY "insert_own_students" ON students FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = parent_id);

DROP POLICY IF EXISTS "update_own_students" ON students;
CREATE POLICY "update_own_students" ON students FOR UPDATE
  TO authenticated USING (auth.uid() = parent_id) WITH CHECK (auth.uid() = parent_id);

DROP POLICY IF EXISTS "delete_own_students" ON students;
CREATE POLICY "delete_own_students" ON students FOR DELETE
  TO authenticated USING (auth.uid() = parent_id);

-- ============ TOPICS ============
CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL CHECK (subject IN ('Maths', 'Verbal Reasoning')),
  name text NOT NULL,
  description text DEFAULT '',
  order_index int NOT NULL DEFAULT 0
);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_topics" ON topics;
CREATE POLICY "read_topics" ON topics FOR SELECT
  TO authenticated USING (true);

-- ============ QUESTIONS ============
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (subject IN ('Maths', 'Verbal Reasoning')),
  difficulty int NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 10),
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'text_input')),
  options jsonb DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL,
  hints jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text DEFAULT ''
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_questions" ON questions;
CREATE POLICY "read_questions" ON questions FOR SELECT
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- ============ ATTEMPTS ============
CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  subject text NOT NULL,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  difficulty int NOT NULL,
  is_correct boolean NOT NULL,
  hints_used int NOT NULL DEFAULT 0,
  time_spent_seconds int NOT NULL DEFAULT 0,
  is_diagnostic boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_attempts" ON attempts;
CREATE POLICY "select_own_attempts" ON attempts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = attempts.student_id AND students.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_attempts" ON attempts;
CREATE POLICY "insert_own_attempts" ON attempts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = attempts.student_id AND students.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_attempts" ON attempts;
CREATE POLICY "update_own_attempts" ON attempts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = attempts.student_id AND students.parent_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = attempts.student_id AND students.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_attempts" ON attempts;
CREATE POLICY "delete_own_attempts" ON attempts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = attempts.student_id AND students.parent_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student_subject ON attempts(student_id, subject);

-- ============ TOPIC PROGRESS ============
CREATE TABLE IF NOT EXISTS topic_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  subject text NOT NULL,
  total_attempts int NOT NULL DEFAULT 0,
  correct_attempts int NOT NULL DEFAULT 0,
  mastery_level int NOT NULL DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 100),
  last_attempted_at timestamptz DEFAULT now(),
  UNIQUE(student_id, topic_id)
);

ALTER TABLE topic_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_progress" ON topic_progress;
CREATE POLICY "select_own_progress" ON topic_progress FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = topic_progress.student_id AND students.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_progress" ON topic_progress;
CREATE POLICY "insert_own_progress" ON topic_progress FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = topic_progress.student_id AND students.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_progress" ON topic_progress;
CREATE POLICY "update_own_progress" ON topic_progress FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = topic_progress.student_id AND students.parent_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.id = topic_progress.student_id AND students.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_progress" ON topic_progress;
CREATE POLICY "delete_own_progress" ON topic_progress FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM students WHERE students.id = topic_progress.student_id AND students.parent_id = auth.uid())
  );

-- ============ SUBSCRIPTIONS ============
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'inactive')),
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_start timestamptz NOT NULL DEFAULT now(),
  trial_end timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subscription" ON subscriptions;
CREATE POLICY "select_own_subscription" ON subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS "insert_own_subscription" ON subscriptions;
CREATE POLICY "insert_own_subscription" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = parent_id);

DROP POLICY IF EXISTS "update_own_subscription" ON subscriptions;
CREATE POLICY "update_own_subscription" ON subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = parent_id) WITH CHECK (auth.uid() = parent_id);

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();