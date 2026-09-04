export type Locale = "en" | "ja";

export type RecordStatus = "draft" | "completed" | "missed";

export type SaveState = "saved" | "saving" | "offline" | "error";

export type Outcome = {
  id: string;
  label: string;
  points: number;
  description?: string;
};

export type Criterion = {
  id: string;
  label: string;
  required: boolean;
  outcomes: Outcome[];
};

export type RubricSection = {
  id: string;
  label: string;
  criteria: Criterion[];
};

export type EvaluationLevel = {
  id: string;
  label: string;
  min: number;
};

export type Rubric = {
  id: string;
  version: number;
  minimumScore: number;
  baseScore: 80;
  sections: RubricSection[];
  levels: EvaluationLevel[];
};

export type Answers = Record<string, string>;

export type DailyRecord = {
  id: string;
  date: string;
  status: RecordStatus;
  score: number;
  answers: Answers;
  rubricVersion: number;
  evaluationLabel: string;
  note?: string;
  updatedAt: string;
};

export type HistoryPoint = {
  date: string;
  score: number;
  status: RecordStatus;
  rubricVersion: number;
};

export type UserProfile = {
  email: string;
  locale: Locale;
  timezone: string;
  cutoffHour: number;
};
