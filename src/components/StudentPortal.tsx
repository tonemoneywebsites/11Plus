import { useState, useEffect, useCallback } from "react";
import { supabase, type Student, type Question, type Topic, type Attempt, type Subject } from "../lib/supabase";
import { SUBJECTS, THEME_CLASSES, getSubjectConfig, subjectLevel, type SubjectTheme } from "../lib/subjects";
import {
  ArrowLeft, CheckCircle2, XCircle, Lightbulb,
  ChevronRight, Loader2, Sparkles, Trophy, Target, TrendingUp, BookOpen,
} from "lucide-react";

const DIAGNOSTIC_QUESTIONS_PER_SUBJECT = 5;

type View = "menu" | "diagnostic" | "practice" | "progress";

export default function StudentPortal({
  student,
  onBack,
}: {
  student: Student;
  onBack: () => void;
}) {
  const [view, setView] = useState<View>("menu");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [progress, setProgress] = useState<Record<string, { total: number; correct: number; mastery: number }>>({});
  const [recentAttempts, setRecentAttempts] = useState<Attempt[]>([]);

  const loadData = useCallback(async () => {
    const [topicsRes, progressRes, attemptsRes] = await Promise.all([
      supabase.from("topics").select("*").order("order_index"),
      supabase.from("topic_progress").select("*").eq("student_id", student.id),
      supabase
        .from("attempts")
        .select("*")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setTopics(topicsRes.data as Topic[] || []);
    const progMap: Record<string, { total: number; correct: number; mastery: number }> = {};
    (progressRes.data || []).forEach((p: any) => {
      progMap[p.topic_id] = {
        total: p.total_attempts,
        correct: p.correct_attempts,
        mastery: p.mastery_level,
      };
    });
    setProgress(progMap);
    setRecentAttempts(attemptsRes.data as Attempt[] || []);
  }, [student.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:block">Parent dashboard</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{student.avatar_emoji}</span>
            <span className="font-semibold text-slate-900">{student.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 lg:px-8 py-8">
        {view === "menu" && (
          <StudentMenu
            student={student}
            progress={progress}
            onView={setView}
          />
        )}
        {view === "diagnostic" && (
          <Diagnostic
            student={student}
            onComplete={async () => {
              await loadData();
              setView("menu");
            }}
          />
        )}
        {view === "practice" && (
          <PracticePicker
            student={student}
            topics={topics}
            progress={progress}
            onBack={() => setView("menu")}
          />
        )}
        {view === "progress" && (
          <ProgressView
            topics={topics}
            progress={progress}
            recentAttempts={recentAttempts}
            onBack={() => setView("menu")}
          />
        )}
      </main>
    </div>
  );
}

function StudentMenu({
  student,
  progress,
  onView,
}: {
  student: Student;
  progress: Record<string, { total: number; correct: number; mastery: number }>;
  onView: (v: View) => void;
}) {
  const totalAttempts = Object.values(progress).reduce((s, p) => s + p.total, 0);
  const totalCorrect = Object.values(progress).reduce((s, p) => s + p.correct, 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <p className="text-brand-100 text-sm mb-1">Welcome back,</p>
          <h1 className="font-serif text-3xl font-bold mb-6">{student.name}! 👋</h1>
          <div className="flex gap-6 flex-wrap">
            <div>
              <p className="text-brand-100 text-xs">Questions answered</p>
              <p className="text-2xl font-bold">{totalAttempts}</p>
            </div>
            <div>
              <p className="text-brand-100 text-xs">Accuracy</p>
              <p className="text-2xl font-bold">{accuracy}%</p>
            </div>
            {SUBJECTS.map((s) => (
              <div key={s.subject}>
                <p className="text-brand-100 text-xs">{s.label} level</p>
                <p className="text-2xl font-bold">{subjectLevel(student, s.subject)}/10</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!student.diagnostic_completed ? (
        <button
          onClick={() => onView("diagnostic")}
          className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 rounded-2xl p-6 mb-6 text-left transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/30 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-lg">Start diagnostic assessment</h3>
              <p className="text-amber-50 text-sm">
                Let's find your starting level with a quick assessment across all subjects.
              </p>
            </div>
            <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => onView("practice")}
          disabled={!student.diagnostic_completed}
          className="bg-white rounded-2xl border border-slate-200 p-6 text-left hover:shadow-lg hover:border-brand-300 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center mb-4">
            <Target className="w-6 h-6 text-brand-600" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1">Practice questions</h3>
          <p className="text-sm text-slate-500">
            {student.diagnostic_completed
              ? "Adaptive practice that adjusts to your level."
              : "Complete the diagnostic first to unlock practice."}
          </p>
        </button>

        <button
          onClick={() => onView("progress")}
          className="bg-white rounded-2xl border border-slate-200 p-6 text-left hover:shadow-lg hover:border-brand-300 transition-all group"
        >
          <div className="w-12 h-12 bg-mint-50 rounded-xl flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 text-mint-600" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1">My progress</h3>
          <p className="text-sm text-slate-500">
            See how you're doing across all topics.
          </p>
        </button>
      </div>
    </div>
  );
}

// ============ DIAGNOSTIC ============
function Diagnostic({
  student,
  onComplete,
}: {
  student: Student;
  onComplete: () => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<{ question: Question; correct: boolean; hintsUsed: number }[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [hintsShown, setHintsShown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    (async () => {
      // Fetch questions spanning difficulties 1-10 for each subject
      const results = await Promise.all(
        SUBJECTS.map((s) =>
          supabase.from("questions").select("*").eq("subject", s.subject).order("difficulty").limit(20)
        )
      );
      const selected = results.flatMap(
        (res) =>
          ((res.data as Question[]) || [])
            .filter((_, i) => i % 2 === 0)
            .slice(0, DIAGNOSTIC_QUESTIONS_PER_SUBJECT)
      );
      setQuestions(selected);
      setLoading(false);
    })();
  }, []);

  const current = questions[currentIdx];

  function handleAnswer(answer: string) {
    if (showResult) return;
    setSelectedAnswer(answer);
    const correct = answer === current.correct_answer;
    setShowResult(true);

    setAnswers((prev) => [
      ...prev,
      { question: current, correct, hintsUsed: hintsShown },
    ]);

    // Save attempt
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    supabase.from("attempts").insert({
      student_id: student.id,
      question_id: current.id,
      subject: current.subject,
      topic_id: current.topic_id,
      difficulty: current.difficulty,
      is_correct: correct,
      hints_used: hintsShown,
      time_spent_seconds: timeSpent,
      is_diagnostic: true,
    }).then(() => {});
  }

  function handleNext() {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setHintsShown(0);
      setStartTime(Date.now());
    } else {
      finishDiagnostic();
    }
  }

  async function finishDiagnostic() {
    // Calculate starting levels based on diagnostic performance.
    // Base level on accuracy: 0-1 correct = level 2, 2 = level 4, 3 = level 5, 4 = level 7, 5 = level 8
    const levelUpdates: Record<string, number> = {};
    for (const s of SUBJECTS) {
      const subjectCorrect = answers.filter((a) => a.question.subject === s.subject && a.correct).length;
      levelUpdates[s.levelField] = Math.max(
        1,
        Math.min(10, Math.round((subjectCorrect / DIAGNOSTIC_QUESTIONS_PER_SUBJECT) * 8) + 1)
      );
    }

    // Update topic progress
    const topicStats: Record<string, { total: number; correct: number; subject: string; topicId: string }> = {};
    answers.forEach((a) => {
      const key = a.question.topic_id;
      if (!topicStats[key]) {
        topicStats[key] = { total: 0, correct: 0, subject: a.question.subject, topicId: a.question.topic_id };
      }
      topicStats[key].total++;
      if (a.correct) topicStats[key].correct++;
    });

    for (const stats of Object.values(topicStats)) {
      const mastery = Math.round((stats.correct / stats.total) * 100);
      const existing = await supabase
        .from("topic_progress")
        .select("id")
        .eq("student_id", student.id)
        .eq("topic_id", stats.topicId)
        .maybeSingle();

      if (existing.data) {
        await supabase
          .from("topic_progress")
          .update({
            total_attempts: stats.total,
            correct_attempts: stats.correct,
            mastery_level: mastery,
            last_attempted_at: new Date().toISOString(),
          })
          .eq("id", existing.data.id);
      } else {
        await supabase.from("topic_progress").insert({
          student_id: student.id,
          topic_id: stats.topicId,
          subject: stats.subject,
          total_attempts: stats.total,
          correct_attempts: stats.correct,
          mastery_level: mastery,
        });
      }
    }

    // Update student with diagnostic completed and calculated levels
    await supabase
      .from("students")
      .update({
        diagnostic_completed: true,
        ...levelUpdates,
      })
      .eq("id", student.id);

    onComplete();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (currentIdx >= questions.length) return null;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-2xl font-bold text-slate-900">Diagnostic Assessment</h2>
          <span className="text-sm font-medium text-slate-500">
            {currentIdx + 1} of {questions.length}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${((currentIdx) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <QuestionCard
        question={current}
        selectedAnswer={selectedAnswer}
        showResult={showResult}
        hintsShown={hintsShown}
        onAnswer={handleAnswer}
        onShowHint={() => setHintsShown((h) => Math.min(h + 1, 3))}
      />

      {showResult && (
        <button
          onClick={handleNext}
          className="mt-6 w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 animate-slide-up"
        >
          {currentIdx + 1 < questions.length ? "Next question" : "Finish assessment"}
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ============ PRACTICE PICKER ============
function PracticePicker({
  student,
  topics,
  progress,
  onBack,
}: {
  student: Student;
  topics: Topic[];
  progress: Record<string, { total: number; correct: number; mastery: number }>;
  onBack: () => void;
}) {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);

  if (activeTopic) {
    return (
      <PracticeSession
        student={student}
        topic={activeTopic}
        level={subjectLevel(student, activeTopic.subject)}
        onExit={() => {
          setActiveTopic(null);
          onBack();
        }}
        onBack={() => setActiveTopic(null)}
      />
    );
  }

  if (selectedSubject) {
    const config = getSubjectConfig(selectedSubject);
    const theme = THEME_CLASSES[config.theme];
    const subjectTopics = topics.filter((t) => t.subject === selectedSubject);
    const level = subjectLevel(student, selectedSubject);
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setSelectedSubject(null)}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to subjects</span>
        </button>

        <div className="flex items-center gap-3 mb-6">
          <config.icon className={`w-7 h-7 ${theme.iconText}`} />
          <div>
            <h2 className="font-serif text-2xl font-bold text-slate-900">{selectedSubject}</h2>
            <p className="text-sm text-slate-500">
              Current level: {level}/10 — questions will adapt to your performance
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {subjectTopics.map((topic) => {
            const prog = progress[topic.id];
            const mastery = prog?.mastery ?? 0;
            return (
              <button
                key={topic.id}
                onClick={() => setActiveTopic(topic)}
                className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:shadow-lg hover:border-brand-300 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{topic.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{topic.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        mastery >= 80 ? "bg-mint-500" : mastery >= 50 ? "bg-amber-400" : "bg-rose-400"
                      }`}
                      style={{ width: `${mastery}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    {prog ? `${prog.total} done` : "New"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back to menu</span>
      </button>

      <h2 className="font-serif text-2xl font-bold text-slate-900 mb-2">Choose a subject</h2>
      <p className="text-slate-500 mb-6">Pick a subject to start practising. Difficulty adapts to your level!</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {SUBJECTS.map((s) => {
          const theme = THEME_CLASSES[s.theme];
          return (
            <button
              key={s.subject}
              onClick={() => setSelectedSubject(s.subject)}
              className={`bg-white rounded-2xl border border-slate-200 p-6 text-left hover:shadow-lg ${theme.hoverBorder} transition-all group`}
            >
              <div className={`w-14 h-14 ${theme.iconBg} rounded-2xl flex items-center justify-center mb-4`}>
                <s.icon className={`w-7 h-7 ${theme.iconText}`} />
              </div>
              <h3 className="font-serif text-xl font-bold text-slate-900 mb-1">{s.label}</h3>
              <p className="text-sm text-slate-500 mb-3">{s.description}</p>
              <div className="flex items-center gap-2 text-sm">
                <span className={`${theme.badgeBg} ${theme.badgeText} px-2.5 py-1 rounded-lg font-medium`}>
                  Level {subjectLevel(student, s.subject)}/10
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ PRACTICE SESSION ============
function PracticeSession({
  student,
  topic,
  level,
  onExit,
  onBack,
}: {
  student: Student;
  topic: Topic;
  level: number;
  onExit: () => void;
  onBack: () => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [hintsShown, setHintsShown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [adaptiveLevel, setAdaptiveLevel] = useState(level);
  const [finished, setFinished] = useState(false);

  const fetchQuestions = useCallback(async (diffLevel: number) => {
    // Fetch questions near the current difficulty level
    const minDiff = Math.max(1, diffLevel - 2);
    const maxDiff = Math.min(10, diffLevel + 2);
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("topic_id", topic.id)
      .gte("difficulty", minDiff)
      .lte("difficulty", maxDiff)
      .limit(10);

    // Shuffle and pick 5
    const shuffled = ((data as Question[]) || []).sort(() => Math.random() - 0.5).slice(0, 5);
    return shuffled;
  }, [topic.id]);

  useEffect(() => {
    (async () => {
      const qs = await fetchQuestions(level);
      setQuestions(qs);
      setLoading(false);
    })();
    // Only fetch once per session (on mount / topic change). Adaptive difficulty
    // should affect the *next* session's starting level, not reshuffle the
    // in-progress question set out from under the current index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchQuestions]);

  const current = questions[currentIdx];

  async function handleAnswer(answer: string) {
    if (showResult) return;
    setSelectedAnswer(answer);
    const correct = answer === current.correct_answer;
    setShowResult(true);

    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const newStats = {
      correct: sessionStats.correct + (correct ? 1 : 0),
      total: sessionStats.total + 1,
    };
    setSessionStats(newStats);

    // Save attempt
    await supabase.from("attempts").insert({
      student_id: student.id,
      question_id: current.id,
      subject: current.subject,
      topic_id: current.topic_id,
      difficulty: current.difficulty,
      is_correct: correct,
      hints_used: hintsShown,
      time_spent_seconds: timeSpent,
      is_diagnostic: false,
    });

    // Update topic progress
    const { data: existing } = await supabase
      .from("topic_progress")
      .select("*")
      .eq("student_id", student.id)
      .eq("topic_id", topic.id)
      .maybeSingle();

    if (existing) {
      const newTotal = (existing as any).total_attempts + 1;
      const newCorrect = (existing as any).correct_attempts + (correct ? 1 : 0);
      const newMastery = Math.round((newCorrect / newTotal) * 100);
      await supabase
        .from("topic_progress")
        .update({
          total_attempts: newTotal,
          correct_attempts: newCorrect,
          mastery_level: newMastery,
          last_attempted_at: new Date().toISOString(),
        })
        .eq("id", (existing as any).id);
    } else {
      await supabase.from("topic_progress").insert({
        student_id: student.id,
        topic_id: topic.id,
        subject: topic.subject,
        total_attempts: 1,
        correct_attempts: correct ? 1 : 0,
        mastery_level: correct ? 100 : 0,
      });
    }

    // Adaptive difficulty: adjust level based on recent performance
    const newAdaptiveLevel = correct
      ? Math.min(10, adaptiveLevel + (hintsShown === 0 ? 1 : 0))
      : Math.max(1, adaptiveLevel - 1);
    setAdaptiveLevel(newAdaptiveLevel);
  }

  async function handleNext() {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setHintsShown(0);
      setStartTime(Date.now());
    } else {
      // Update student's level for this subject
      const field = getSubjectConfig(topic.subject).levelField;
      await supabase.from("students").update({ [field]: adaptiveLevel }).eq("id", student.id);
      setFinished(true);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (finished) {
    return (
      <div className="animate-fade-in text-center py-12">
        <div className="w-20 h-20 bg-mint-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-10 h-10 text-mint-600" />
        </div>
        <h2 className="font-serif text-3xl font-bold text-slate-900 mb-2">Great work!</h2>
        <p className="text-slate-500 mb-8">
          You answered {sessionStats.correct} out of {sessionStats.total} questions correctly.
        </p>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm mx-auto mb-6">
          <p className="text-sm text-slate-500 mb-1">Your new level in {topic.name}</p>
          <p className="text-4xl font-bold text-brand-600">{adaptiveLevel}/10</p>
          {adaptiveLevel > level && (
            <p className="text-mint-600 text-sm font-medium mt-2">Level up! You're improving!</p>
          )}
          {adaptiveLevel < level && (
            <p className="text-amber-600 text-sm font-medium mt-2">
              We've adjusted the difficulty to help you build confidence.
            </p>
          )}
        </div>
        <button
          onClick={onExit}
          className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors"
        >
          Back to menu
        </button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-4">No questions available for this topic at the current level.</p>
        <button onClick={onBack} className="text-brand-600 font-semibold">Back to topics</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Exit practice</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="bg-brand-50 text-brand-700 text-sm font-medium px-3 py-1.5 rounded-lg">
            Level {adaptiveLevel}/10
          </span>
          <span className="text-sm text-slate-500">
            {currentIdx + 1}/{questions.length}
          </span>
        </div>
      </div>

      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-300"
          style={{ width: `${(currentIdx / questions.length) * 100}%` }}
        />
      </div>

      <QuestionCard
        question={current}
        selectedAnswer={selectedAnswer}
        showResult={showResult}
        hintsShown={hintsShown}
        onAnswer={handleAnswer}
        onShowHint={() => setHintsShown((h) => Math.min(h + 1, 3))}
      />

      {showResult && (
        <button
          onClick={handleNext}
          className="mt-6 w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 animate-slide-up"
        >
          {currentIdx + 1 < questions.length ? "Next question" : "Finish session"}
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ============ PROGRESS VIEW ============
function ProgressView({
  topics,
  progress,
  recentAttempts,
  onBack,
}: {
  topics: Topic[];
  progress: Record<string, { total: number; correct: number; mastery: number }>;
  recentAttempts: Attempt[];
  onBack: () => void;
}) {
  const totalAttempts = Object.values(progress).reduce((s, p) => s + p.total, 0);
  const totalCorrect = Object.values(progress).reduce((s, p) => s + p.correct, 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back to menu</span>
      </button>

      <h2 className="font-serif text-2xl font-bold text-slate-900 mb-6">My Progress</h2>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
          <BookOpen className="w-6 h-6 text-brand-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900">{totalAttempts}</p>
          <p className="text-xs text-slate-500">Questions answered</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
          <Target className="w-6 h-6 text-mint-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900">{accuracy}%</p>
          <p className="text-xs text-slate-500">Accuracy</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
          <Trophy className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-900">{totalCorrect}</p>
          <p className="text-xs text-slate-500">Correct answers</p>
        </div>
      </div>

      {SUBJECTS.map((s) => (
        <ProgressSection
          key={s.subject}
          title={s.label}
          topics={topics.filter((t) => t.subject === s.subject)}
          progress={progress}
          theme={s.theme}
        />
      ))}

      {recentAttempts.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold text-slate-900 mb-4">Recent activity</h3>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {recentAttempts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                {a.is_correct ? (
                  <CheckCircle2 className="w-5 h-5 text-mint-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">
                    {a.subject} — Difficulty {a.difficulty}
                  </p>
                  <p className="text-xs text-slate-400">
                    {a.hints_used > 0 ? `${a.hints_used} hint${a.hints_used > 1 ? "s" : ""} used` : "No hints"} ·{" "}
                    {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
                {a.is_diagnostic && (
                  <span className="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-md font-medium">
                    Diagnostic
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressSection({
  title,
  topics,
  progress,
  theme,
}: {
  title: string;
  topics: Topic[];
  progress: Record<string, { total: number; correct: number; mastery: number }>;
  theme: SubjectTheme;
}) {
  const c = THEME_CLASSES[theme];

  return (
    <div className="mb-6">
      <h3 className="font-semibold text-slate-900 mb-3">{title}</h3>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        {topics.map((topic) => {
          const prog = progress[topic.id];
          const mastery = prog?.mastery ?? 0;
          return (
            <div key={topic.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-slate-700">{topic.name}</span>
                <span className={`text-xs font-medium ${c.badgeText}`}>
                  {mastery}% {prog ? `(${prog.total} done)` : ""}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${c.barBg} rounded-full transition-all duration-500`}
                  style={{ width: `${mastery}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ SHARED QUESTION CARD ============
function QuestionCard({
  question,
  selectedAnswer,
  showResult,
  hintsShown,
  onAnswer,
  onShowHint,
}: {
  question: Question;
  selectedAnswer: string | null;
  showResult: boolean;
  hintsShown: number;
  onAnswer: (answer: string) => void;
  onShowHint: () => void;
}) {
  const isCorrect = selectedAnswer === question.correct_answer;
  const allHintsShown = hintsShown >= 3;
  const subjectConfig = getSubjectConfig(question.subject);
  const theme = THEME_CLASSES[subjectConfig.theme];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 animate-pop">
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${theme.badgeBg} ${theme.badgeText}`}>
          <subjectConfig.icon className="w-4 h-4" />
          {question.subject}
        </span>
        <span className="text-xs text-slate-400">Difficulty {question.difficulty}/10</span>
      </div>

      <h3 className="text-lg lg:text-xl font-semibold text-slate-900 mb-6 leading-snug">
        {question.question_text}
      </h3>

      <div className="space-y-3 mb-4">
        {question.options.map((option) => {
          const isSelected = selectedAnswer === option;
          const isCorrectOption = option === question.correct_answer;
          let className = "border-slate-200 hover:border-brand-300 hover:bg-brand-50/50";

          if (showResult) {
            if (isCorrectOption) {
              className = "border-mint-500 bg-mint-50";
            } else if (isSelected) {
              className = "border-rose-400 bg-rose-50";
            } else {
              className = "border-slate-200 opacity-50";
            }
          }

          return (
            <button
              key={option}
              onClick={() => !showResult && onAnswer(option)}
              disabled={showResult}
              className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all flex items-center justify-between ${className}`}
            >
              <span className="text-slate-800 font-medium">{option}</span>
              {showResult && isCorrectOption && <CheckCircle2 className="w-5 h-5 text-mint-600 flex-shrink-0" />}
              {showResult && isSelected && !isCorrectOption && <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Hints */}
      {question.hints && question.hints.length > 0 && !showResult && (
        <div className="border-t border-slate-100 pt-4">
          {hintsShown > 0 && (
            <div className="space-y-2 mb-3 animate-slide-up">
              {question.hints.slice(0, hintsShown).map((hint, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-50 rounded-xl px-4 py-3">
                  <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-0.5">Hint {i + 1}</p>
                    <p className="text-sm text-amber-900">{hint}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!allHintsShown && (
            <button
              onClick={onShowHint}
              className="flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
            >
              <Lightbulb className="w-4 h-4" />
              {hintsShown === 0 ? "Show a hint" : `Show hint ${hintsShown + 1} of 3`}
            </button>
          )}

          {allHintsShown && (
            <p className="text-sm text-slate-400">
              All hints shown. Make your best guess!
            </p>
          )}
        </div>
      )}

      {/* Result + Explanation */}
      {showResult && (
        <div className="animate-slide-up">
          <div className={`rounded-xl px-4 py-3 mb-3 flex items-center gap-2 ${
            isCorrect ? "bg-mint-50 text-mint-700" : "bg-rose-50 text-rose-700"
          }`}>
            {isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span className="font-semibold">{isCorrect ? "Correct!" : "Not quite right"}</span>
            {hintsShown > 0 && !isCorrect && (
              <span className="text-sm ml-auto">You used {hintsShown} hint{hintsShown > 1 ? "s" : ""}</span>
            )}
          </div>
          {question.explanation && (
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-700">Explanation: </span>
                {question.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
