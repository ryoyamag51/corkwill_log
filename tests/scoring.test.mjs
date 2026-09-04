import assert from "node:assert/strict";
import test from "node:test";

const { createStarterRubric, scoreAnswers, validateRubric, evaluationForScore } = await import("../app/lib/scoring.ts");

test("starter rubric reaches the configured minimum and 100", () => {
  const rubric = createStarterRubric();
  const validation = validateRubric(rubric);
  assert.equal(validation.valid, true);
  assert.equal(validation.minimumPossible, rubric.minimumScore);
  assert.equal(validation.maximumPossible, 100);
  assert.equal(scoreAnswers(rubric, {}), 80);
});

test("rubric validation identifies a broken maximum boundary", () => {
  const rubric = createStarterRubric();
  rubric.sections[0].criteria[0].outcomes[2].points = 3;
  const validation = validateRubric(rubric);
  assert.equal(validation.valid, false);
  assert.match(validation.issues.find((issue) => issue.path === "maximumScore")?.message ?? "", /reach 100/);
});

test("evaluation levels stay editable while score lookup remains ordered", () => {
  const rubric = createStarterRubric();
  rubric.levels = [
    { id: "low", label: "Low", min: 0 },
    { id: "middle", label: "Middle", min: 50 },
    { id: "high", label: "High", min: 100 },
  ];
  assert.equal(evaluationForScore(rubric, 68).label, "Middle");
  assert.equal(validateRubric(rubric).valid, true);
});

test("an evaluation rubric must end at 100", () => {
  const rubric = createStarterRubric();
  rubric.levels[rubric.levels.length - 1].min = 99;
  const validation = validateRubric(rubric);
  assert.equal(validation.valid, false);
  assert.match(validation.issues.map((issue) => issue.message).join(" "), /end at 100/);
});
