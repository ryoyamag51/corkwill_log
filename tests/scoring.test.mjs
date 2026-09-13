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

const { effectiveDate, timezoneLabel, timezoneOptions, validTimezone } = await import('../app/lib/timezone.ts');
test('local cutoff follows wall time at DST changes and across date boundaries', () => {
  assert.equal(effectiveDate('America/New_York', 5, new Date('2026-03-08T09:00:00Z')), '2026-03-08');
  assert.equal(effectiveDate('America/New_York', 5, new Date('2026-03-08T08:59:00Z')), '2026-03-07');
  assert.equal(effectiveDate('America/New_York', 5, new Date('2026-11-01T09:59:00Z')), '2026-10-31');
  assert.equal(effectiveDate('Asia/Tokyo', 5, new Date('2026-01-01T19:59:00Z')), '2026-01-01');
  assert.equal(effectiveDate('Asia/Tokyo', 5, new Date('2026-01-01T20:00:00Z')), '2026-01-02');
});
test('timezone choices include fractional UTC offsets and seasonal offsets', () => {
  assert.match(timezoneLabel('Asia/Kathmandu'), /UTC\+05:45/);
  assert.match(timezoneLabel('America/New_York', new Date('2026-01-01')), /UTC-05:00/);
  assert.match(timezoneLabel('America/New_York', new Date('2026-07-01')), /UTC-04:00/);
  assert.ok(timezoneOptions('UTC').length > 30);
  assert.equal(validTimezone('Imaginary/Place'), false);
});
