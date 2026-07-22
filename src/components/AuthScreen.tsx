import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { GraduationCap, Mail, Lock, User, Loader2, Sparkles } from "lucide-react";

export default function AuthScreen() {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result =
      mode === "signup"
        ? await signUp(email, password, displayName)
        : await signIn(email, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - branding */}
      <div className="lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-mint-400/10 rounded-full blur-3xl translate-y-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center">
              <GraduationCap className="w-7 h-7" />
            </div>
            <span className="text-xl font-bold tracking-tight">ElevenPlus Prep</span>
          </div>

          <h1 className="font-serif text-4xl lg:text-5xl font-bold leading-tight mb-6">
            Give your child the edge they need for the 11+.
          </h1>
          <p className="text-brand-100 text-lg leading-relaxed max-w-md">
            Adaptive practice in Maths, English, Verbal Reasoning and Non-Verbal Reasoning. Diagnostic assessments,
            progressive hints, and real progress tracking — all in one place.
          </p>
        </div>

        <div className="relative z-10 hidden lg:flex gap-6 mt-12">
          <div className="flex items-center gap-2 text-brand-100">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">7-day free trial</span>
          </div>
          <div className="flex items-center gap-2 text-brand-100">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">£10/month after trial</span>
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-slate-50">
        <div className="w-full max-w-md animate-fade-in">
          <h2 className="font-serif text-3xl font-bold text-slate-900 mb-2">
            {mode === "signup" ? "Create your parent account" : "Welcome back"}
          </h2>
          <p className="text-slate-500 mb-8">
            {mode === "signup"
              ? "Start your 7-day free trial. No card required."
              : "Sign in to manage your children's prep."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Your name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 animate-shake">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {mode === "signup" ? "Create account & start trial" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-slate-500 mt-6 text-sm">
            {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
            <button
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError(null);
              }}
              className="text-brand-600 font-semibold hover:text-brand-700 transition-colors"
            >
              {mode === "signup" ? "Sign in" : "Start free trial"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
