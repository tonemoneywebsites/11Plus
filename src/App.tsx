import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthScreen from "./components/AuthScreen";
import ParentDashboard from "./components/ParentDashboard";
import StudentPortal from "./components/StudentPortal";
import { Loader2, GraduationCap } from "lucide-react";
import type { Student } from "./lib/supabase";

function AppContent() {
  const { session, loading } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center">
          <GraduationCap className="w-9 h-9 text-white" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (selectedStudent) {
    return (
      <StudentPortal
        student={selectedStudent}
        onBack={() => setSelectedStudent(null)}
      />
    );
  }

  return <ParentDashboard onSelectStudent={setSelectedStudent} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
