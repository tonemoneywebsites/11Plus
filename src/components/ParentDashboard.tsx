import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, type Student, type TopicProgress, type Subscription } from "../lib/supabase";
import { SUBJECTS, THEME_CLASSES, subjectLevel } from "../lib/subjects";
import {
  Plus, LogOut, GraduationCap, TrendingUp, BookOpen, CheckCircle2,
  Clock, ChevronRight, Sparkles, X, Loader2, CreditCard,
} from "lucide-react";

type StudentWithProgress = Student & {
  progress: TopicProgress[];
};

const AVATARS = ["🦊", "🐼", "🦉", "🦁", "🐸", "🦄", "🐙", "🦋", "🐝", "🦖"];

export default function ParentDashboard({ onSelectStudent }: { onSelectStudent: (student: Student) => void }) {
  const { profile, signOut } = useAuth();
  const [students, setStudents] = useState<StudentWithProgress[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile) return;
    const [studentsRes, subRes] = await Promise.all([
      supabase.from("students").select("*").eq("parent_id", profile.id).order("created_at"),
      supabase.from("subscriptions").select("*").eq("parent_id", profile.id).maybeSingle(),
    ]);

    const studentList = studentsRes.data as Student[] || [];
    let progressMap: Record<string, TopicProgress[]> = {};
    if (studentList.length > 0) {
      const { data: progressData } = await supabase
        .from("topic_progress")
        .select("*")
        .in("student_id", studentList.map((s) => s.id));
      (progressData as TopicProgress[] || []).forEach((p) => {
        if (!progressMap[p.student_id]) progressMap[p.student_id] = [];
        progressMap[p.student_id].push(p);
      });
    }

    setStudents(studentList.map((s) => ({ ...s, progress: progressMap[s.id] || [] })));
    setSubscription(subRes.data as Subscription | null);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddStudent(name: string, yearGroup: number, emoji: string) {
    if (!profile) return;
    const { data } = await supabase
      .from("students")
      .insert({ name, year_group: yearGroup, avatar_emoji: emoji, parent_id: profile.id })
      .select("*")
      .single();
    if (data) {
      setStudents((prev) => [...prev, { ...(data as Student), progress: [] }]);
    }
    setShowAddModal(false);
  }

  const trialDaysLeft = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 7;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">ElevenPlus Prep</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:block">
              Hi, {profile?.display_name}
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-8">
        {/* Subscription banner */}
        {subscription?.status === "trialing" && (
          <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-2xl p-5 mb-8 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-amber-900">
                  {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left in your free trial
                </p>
                <p className="text-sm text-amber-700">
                  Subscribe for £10/month to keep full access after the trial ends.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Subscribe now
            </button>
          </div>
        )}

        {subscription?.status === "active" && (
          <div className="bg-mint-50 border border-mint-200 rounded-2xl p-5 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-mint-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-mint-900">Subscription active</p>
              <p className="text-sm text-mint-700">
                {subscription.current_period_end
                  ? `Next billing: ${new Date(subscription.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                  : "£10/month"}
              </p>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-slate-900">Your children</h1>
            <p className="text-slate-500 mt-1">Manage profiles and track progress by topic.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add child
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-brand-500" />
            </div>
            <h3 className="font-semibold text-lg text-slate-900 mb-2">No children yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              Add your first child profile to get started with diagnostic assessments and adaptive practice.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add your first child
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                onClick={() => onSelectStudent(student)}
              />
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddStudentModal onClose={() => setShowAddModal(false)} onAdd={handleAddStudent} />
      )}
      {showSubscriptionModal && (
        <SubscriptionModal
          subscription={subscription}
          onClose={() => setShowSubscriptionModal(false)}
        />
      )}
    </div>
  );
}

function StudentCard({
  student,
  onClick,
}: {
  student: StudentWithProgress;
  onClick: () => void;
}) {
  const totalAttempts = student.progress.reduce((sum, p) => sum + p.total_attempts, 0);
  const totalCorrect = student.progress.reduce((sum, p) => sum + p.correct_attempts, 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-slate-200 p-6 text-left hover:shadow-lg hover:border-brand-300 transition-all group"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl">
            {student.avatar_emoji}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-900">{student.name}</h3>
            <p className="text-sm text-slate-500">Year {student.year_group}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition-colors" />
      </div>

      {!student.diagnostic_completed ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-700 font-medium">Diagnostic assessment ready</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {SUBJECTS.map((s) => {
            const subjectProgress = student.progress.filter((p) => p.subject === s.subject);
            const mastery = subjectProgress.length > 0
              ? Math.round(subjectProgress.reduce((sum, p) => sum + p.mastery_level, 0) / subjectProgress.length)
              : 0;
            const theme = THEME_CLASSES[s.theme];
            return (
              <div key={s.subject} className={`${theme.iconBg} rounded-xl px-4 py-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${theme.iconText}`} />
                  <span className={`text-xs font-medium ${theme.badgeText}`}>{s.label}</span>
                </div>
                <p className={`text-2xl font-bold ${theme.iconText}`}>{mastery}%</p>
                <p className={`text-xs ${theme.badgeText}`}>Level {subjectLevel(student, s.subject)}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-4 h-4" />
          {totalAttempts} {totalAttempts === 1 ? "question" : "questions"}
        </span>
        <span className="flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" />
          {accuracy}% accuracy
        </span>
      </div>
    </button>
  );
}

function AddStudentModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, yearGroup: number, emoji: string) => void;
}) {
  const [name, setName] = useState("");
  const [yearGroup, setYearGroup] = useState(5);
  const [emoji, setEmoji] = useState(AVATARS[0]);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 animate-pop">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-bold text-slate-900">Add a child</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Child's name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Emma"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">School year</label>
            <select
              value={yearGroup}
              onChange={(e) => setYearGroup(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition bg-white"
            >
              <option value={3}>Year 3</option>
              <option value={4}>Year 4</option>
              <option value={5}>Year 5</option>
              <option value={6}>Year 6</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Choose an avatar</label>
            <div className="grid grid-cols-5 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setEmoji(a)}
                  className={`text-3xl p-3 rounded-xl border-2 transition-all ${
                    emoji === a
                      ? "border-brand-500 bg-brand-50 scale-105"
                      : "border-slate-100 hover:border-slate-300"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => name.trim() && onAdd(name.trim(), yearGroup, emoji)}
            disabled={!name.trim()}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-50"
          >
            Create profile
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionModal({
  subscription,
  onClose,
}: {
  subscription: Subscription | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "create_checkout" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (!data.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setLoading(false);
    }
  }

  const trialDaysLeft = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 7;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 animate-pop">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-bold text-slate-900">Subscribe</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-gradient-to-br from-brand-50 to-mint-50 rounded-2xl p-6 mb-6 border border-slate-100">
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-4xl font-bold text-slate-900">£10</span>
            <span className="text-slate-500">/month</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Full access to all subject practice, adaptive difficulty, and progress tracking.
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-mint-500" />
              Unlimited practice questions
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-mint-500" />
              Adaptive difficulty system
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-mint-500" />
              Progressive hint system
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-mint-500" />
              Detailed progress by topic
            </li>
          </ul>
        </div>

        {subscription?.status === "trialing" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-700">
            You have <strong>{trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"}</strong> left in your free trial.
            Subscribe now to avoid interruption.
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
          Subscribe with Stripe
        </button>

        <p className="text-xs text-slate-400 text-center mt-4">
          Secure payment powered by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
