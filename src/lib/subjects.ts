import { Calculator, Brain, Shapes, BookText, type LucideIcon } from "lucide-react";
import type { Student, Subject } from "./supabase";

export type SubjectTheme = "brand" | "mint" | "purple" | "orange";

export type SubjectConfig = {
  subject: Subject;
  label: string;
  description: string;
  icon: LucideIcon;
  levelField: "maths_level" | "vr_level" | "nvr_level" | "english_level";
  theme: SubjectTheme;
};

export const SUBJECTS: SubjectConfig[] = [
  {
    subject: "Maths",
    label: "Maths",
    description: "Number, fractions, algebra, geometry and more.",
    icon: Calculator,
    levelField: "maths_level",
    theme: "brand",
  },
  {
    subject: "Verbal Reasoning",
    label: "Verbal Reasoning",
    description: "Codes, sequences, word relationships and logic.",
    icon: Brain,
    levelField: "vr_level",
    theme: "mint",
  },
  {
    subject: "Non-Verbal Reasoning",
    label: "Non-Verbal Reasoning",
    description: "Shape patterns, rotations, sequences and spatial puzzles.",
    icon: Shapes,
    levelField: "nvr_level",
    theme: "purple",
  },
  {
    subject: "English",
    label: "English",
    description: "Comprehension, grammar, vocabulary and spelling.",
    icon: BookText,
    levelField: "english_level",
    theme: "orange",
  },
];

export function getSubjectConfig(subject: Subject): SubjectConfig {
  const config = SUBJECTS.find((s) => s.subject === subject);
  if (!config) throw new Error(`Unknown subject: ${subject}`);
  return config;
}

export function subjectLevel(student: Student, subject: Subject): number {
  return student[getSubjectConfig(subject).levelField];
}

export const THEME_CLASSES: Record<
  SubjectTheme,
  { iconBg: string; iconText: string; badgeBg: string; badgeText: string; hoverBorder: string; barBg: string }
> = {
  brand: {
    iconBg: "bg-brand-50",
    iconText: "text-brand-600",
    badgeBg: "bg-brand-50",
    badgeText: "text-brand-700",
    hoverBorder: "hover:border-brand-300",
    barBg: "bg-brand-500",
  },
  mint: {
    iconBg: "bg-mint-50",
    iconText: "text-mint-600",
    badgeBg: "bg-mint-50",
    badgeText: "text-mint-700",
    hoverBorder: "hover:border-mint-300",
    barBg: "bg-mint-500",
  },
  purple: {
    iconBg: "bg-purple-50",
    iconText: "text-purple-600",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    hoverBorder: "hover:border-purple-300",
    barBg: "bg-purple-500",
  },
  orange: {
    iconBg: "bg-orange-50",
    iconText: "text-orange-600",
    badgeBg: "bg-orange-50",
    badgeText: "text-orange-700",
    hoverBorder: "hover:border-orange-300",
    barBg: "bg-orange-500",
  },
};
