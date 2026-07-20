import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  display_name: string;
  created_at: string;
};

export type Student = {
  id: string;
  parent_id: string;
  name: string;
  year_group: number;
  avatar_emoji: string;
  diagnostic_completed: boolean;
  maths_level: number;
  vr_level: number;
  created_at: string;
};

export type Topic = {
  id: string;
  subject: "Maths" | "Verbal Reasoning";
  name: string;
  description: string;
  order_index: number;
};

export type Question = {
  id: string;
  topic_id: string;
  subject: "Maths" | "Verbal Reasoning";
  difficulty: number;
  question_text: string;
  question_type: "multiple_choice" | "text_input";
  options: string[];
  correct_answer: string;
  hints: string[];
  explanation: string;
};

export type Attempt = {
  id: string;
  student_id: string;
  question_id: string;
  subject: string;
  topic_id: string;
  difficulty: number;
  is_correct: boolean;
  hints_used: number;
  time_spent_seconds: number;
  is_diagnostic: boolean;
  created_at: string;
};

export type TopicProgress = {
  id: string;
  student_id: string;
  topic_id: string;
  subject: string;
  total_attempts: number;
  correct_attempts: number;
  mastery_level: number;
  last_attempted_at: string;
};

export type Subscription = {
  id: string;
  parent_id: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "inactive";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_start: string;
  trial_end: string;
  current_period_end: string | null;
  created_at: string;
};
