import type {
  Answers,
  Criterion,
  EvaluationLevel,
  Rubric,
} from "./types";

export type RubricValidationIssue = {
  path: string;
  message: string;
};

export type RubricValidation = {
  valid: boolean;
  issues: RubricValidationIssue[];
  minimumPossible: number;
  maximumPossible: number;
};

const outcome = (id: string, label: string, points: number, description?: string) => ({
  id,
  label,
  points,
  ...(description ? { description } : {}),
});

export function createStarterRubric(): Rubric {
  return {
    id: "starter-rubric",
    version: 1,
    minimumScore: 0,
    baseScore: 80,
    sections: [
      {
        id: "body",
        label: "Body",
        criteria: [
          {
            id: "sleep",
            label: "Sleep enough to feel steady",
            required: true,
            outcomes: [
              outcome("sleep-low", "Not enough", -16),
              outcome("sleep-mid", "Somewhat", 0),
              outcome("sleep-high", "Yes", 4),
            ],
          },
          {
            id: "movement",
            label: "Move with ease",
            required: true,
            outcomes: [
              outcome("movement-low", "Not today", -16),
              outcome("movement-mid", "A little", 0),
              outcome("movement-high", "Yes", 4),
            ],
          },
        ],
      },
      {
        id: "attention",
        label: "Attention",
        criteria: [
          {
            id: "focus",
            label: "Give one meaningful thing my attention",
            required: true,
            outcomes: [
              outcome("focus-low", "Not yet", -16),
              outcome("focus-mid", "In part", 0),
              outcome("focus-high", "Yes", 4),
            ],
          },
          {
            id: "noise",
            label: "Keep the noise low",
            required: true,
            outcomes: [
              outcome("noise-low", "It was loud", -16),
              outcome("noise-mid", "Mixed", 0),
              outcome("noise-high", "Mostly", 4),
            ],
          },
        ],
      },
      {
        id: "connection",
        label: "Connection",
        criteria: [
          {
            id: "connection",
            label: "Reach out or receive care",
            required: true,
            outcomes: [
              outcome("connection-low", "Not today", -16),
              outcome("connection-mid", "A little", 0),
              outcome("connection-high", "Yes", 4),
            ],
          },
        ],
      },
    ],
    levels: [
      { id: "reset", label: "Reset", min: 0 },
      { id: "steady", label: "Steady", min: 60 },
      { id: "good", label: "Good", min: 80 },
      { id: "strong", label: "Strong", min: 90 },
      { id: "perfect", label: "Perfect!", min: 100 },
    ],
  };
}

export function allCriteria(rubric: Rubric): Criterion[] {
  return rubric.sections.flatMap((section) => section.criteria);
}

export function scoreAnswers(rubric: Rubric, answers: Answers): number {
  const baseScore: number = rubric.baseScore;
  return allCriteria(rubric).reduce((score, criterion) => {
    const selected = criterion.outcomes.find((item) => item.id === answers[criterion.id]);
    return score + (selected?.points ?? 0);
  }, baseScore);
}

export function answeredCount(rubric: Rubric, answers: Answers): number {
  return allCriteria(rubric).filter((criterion) => Boolean(answers[criterion.id])).length;
}

export function requiredCount(rubric: Rubric): number {
  return allCriteria(rubric).filter((criterion) => criterion.required).length;
}

export function isComplete(rubric: Rubric, answers: Answers): boolean {
  return allCriteria(rubric).every((criterion) => !criterion.required || Boolean(answers[criterion.id]));
}

export function evaluationForScore(rubric: Rubric, score: number): EvaluationLevel {
  const levels = [...rubric.levels].sort((a, b) => b.min - a.min);
  return levels.find((level) => score >= level.min) ?? rubric.levels[0];
}

export function evaluationRange(levels: EvaluationLevel[], index: number): { min: number; max: number } {
  const current = levels[index];
  const next = levels[index + 1];
  return { min: current.min, max: next ? next.min - 1 : 100 };
}

export function formatSignedPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

export function validateRubric(rubric: Rubric): RubricValidation {
  const issues: RubricValidationIssue[] = [];
  const minimumPossible = rubric.baseScore + allCriteria(rubric).reduce((total, criterion) => {
    const points = criterion.outcomes.map((item) => item.points);
    return total + (points.length ? Math.min(...points) : 0);
  }, 0);
  const maximumPossible = rubric.baseScore + allCriteria(rubric).reduce((total, criterion) => {
    const points = criterion.outcomes.map((item) => item.points);
    return total + (points.length ? Math.max(...points) : 0);
  }, 0);

  if (!Number.isInteger(rubric.minimumScore) || rubric.minimumScore < 0 || rubric.minimumScore > 80) {
    issues.push({ path: "minimumScore", message: "Minimum score must be a whole number from 0 to 80." });
  }
  if (!rubric.sections.length) {
    issues.push({ path: "sections", message: "Add at least one section." });
  }
  if (!allCriteria(rubric).length) {
    issues.push({ path: "sections", message: "Add at least one required criterion." });
  }

  rubric.sections.forEach((section, sectionIndex) => {
    if (!section.label.trim()) {
      issues.push({ path: `sections.${sectionIndex}.label`, message: "Section names cannot be empty." });
    }
    if (!section.criteria.length) {
      issues.push({ path: `sections.${sectionIndex}.criteria`, message: "Add a criterion to this section or remove it." });
    }
    section.criteria.forEach((criterion, criterionIndex) => {
      if (!criterion.label.trim()) {
        issues.push({ path: `sections.${sectionIndex}.criteria.${criterionIndex}.label`, message: "Criterion labels cannot be empty." });
      }
      if (criterion.outcomes.length < 2) {
        issues.push({ path: `sections.${sectionIndex}.criteria.${criterionIndex}.outcomes`, message: "Each criterion needs at least two outcomes." });
      }
      criterion.outcomes.forEach((item, outcomeIndex) => {
        if (!item.label.trim()) {
          issues.push({ path: `sections.${sectionIndex}.criteria.${criterionIndex}.outcomes.${outcomeIndex}.label`, message: "Outcome labels cannot be empty." });
        }
        if (!Number.isInteger(item.points)) {
          issues.push({ path: `sections.${sectionIndex}.criteria.${criterionIndex}.outcomes.${outcomeIndex}.points`, message: "Point values must be whole numbers." });
        }
      });
    });
  });

  if (minimumPossible !== rubric.minimumScore) {
    issues.push({
      path: "minimumScore",
      message: `Worst case is ${minimumPossible}. Change the minimum or outcome points so the range starts at ${rubric.minimumScore}.`,
    });
  }
  if (maximumPossible !== 100) {
    issues.push({
      path: "maximumScore",
      message: `Best case is ${maximumPossible}. Add ${100 - maximumPossible} points across the positive outcomes to reach 100.`,
    });
  }

  const levels = [...rubric.levels].sort((a, b) => a.min - b.min);
  if (!levels.length) {
    issues.push({ path: "levels", message: "Add at least one evaluation level." });
  } else {
    if (levels[0].min !== rubric.minimumScore) {
      issues.push({ path: "levels.0.min", message: `The first level must start at ${rubric.minimumScore}.` });
    }
    levels.forEach((level, index) => {
      if (!level.label.trim()) {
        issues.push({ path: `levels.${index}.label`, message: "Evaluation labels cannot be empty." });
      }
      if (!Number.isInteger(level.min) || level.min < rubric.minimumScore || level.min > 100) {
        issues.push({ path: `levels.${index}.min`, message: "Thresholds must be whole numbers within the configured range." });
      }
      if (index > 0 && level.min <= levels[index - 1].min) {
        issues.push({ path: `levels.${index}.min`, message: "Evaluation ranges must be ordered without overlap." });
      }
    });
    if (levels.at(-1)?.min !== 100) {
      issues.push({ path: "levels", message: "The final evaluation level must end at 100." });
    }
  }

  return { valid: issues.length === 0, issues, minimumPossible, maximumPossible };
}

export function cloneRubric(rubric: Rubric): Rubric {
  return JSON.parse(JSON.stringify(rubric)) as Rubric;
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
