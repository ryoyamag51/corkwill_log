"use client";

import { useEffect, useMemo, useState } from "react";

import { copy } from "../lib/locales";
import { enqueueMutation, readLocalDraft, readMutationQueue, removeMutation, saveLocalDraft } from "../lib/offline";
import type { MutationPayload } from "../lib/offline";
import {
  answeredCount,
  cloneRubric,
  createStarterRubric,
  evaluationForScore,
  evaluationRange,
  formatSignedPoints,
  isComplete,
  newId,
  requiredCount,
  scoreAnswers,
  validateRubric,
} from "../lib/scoring";
import type {
  Answers,
  Criterion,
  DailyRecord,
  EvaluationLevel,
  Locale,
  Outcome,
  Rubric,
  RubricSection,
  SaveState,
} from "../lib/types";
import { usePersistedLocale } from "../lib/use-persisted-locale";
import BeginnerGuide, { tutorialStorageKey } from "./BeginnerGuide";

type View = "today" | "history" | "settings";
type SettingsTab = "scoring" | "levels" | "profile" | "data";
type AuthMode = "loading" | "signed-in";

const starter = createStarterRubric();

function displayDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00`));
}

function displayLongDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function effectiveDate(timezone: string, cutoffHour: number, now = new Date()): string {
  const shifted = new Date(now.getTime() - cutoffHour * 60 * 60 * 1000);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(shifted);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return shifted.toISOString().slice(0, 10);
  }
}

async function flushPendingMutations(accountId: string): Promise<"saved" | "offline" | "needs-attention"> {
  if (!navigator.onLine) return "offline";
  const mutations = (await readMutationQueue(accountId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 50);
  if (mutations.length === 0) return "saved";
  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutations }),
    });
    if (!response.ok) return "needs-attention";
    const payload = await response.json() as {
      applied?: Array<{ mutationId?: string }>;
      conflicts?: Array<{ mutationId?: string }>;
    };
    await Promise.all((payload.applied ?? []).flatMap((item) => item.mutationId ? [removeMutation(accountId, item.mutationId)] : []));
    if ((payload.conflicts?.length ?? 0) > 0 || (payload.applied?.length ?? 0) < mutations.length) return "needs-attention";
    return (await readMutationQueue(accountId)).length > 0 ? flushPendingMutations(accountId) : "saved";
  } catch {
    return navigator.onLine ? "needs-attention" : "offline";
  }
}

// Serialize uploads so successive answer snapshots cannot overtake each other.
let syncTail: Promise<"saved" | "offline" | "needs-attention"> = Promise.resolve("saved");
function syncPendingMutations(accountId: string): Promise<"saved" | "offline" | "needs-attention"> {
  const result = syncTail.then(() => flushPendingMutations(accountId));
  syncTail = result.catch(() => "needs-attention");
  return syncTail;
}

function icon(name: "today" | "history" | "settings" | "check" | "arrow") {
  return <span aria-hidden="true" className={`nav-icon nav-icon-${name}`}>{name === "today" ? "●" : name === "history" ? "↗" : name === "settings" ? "⚙" : name === "check" ? "✓" : "→"}</span>;
}

export default function CorkWillLogPage() {
  const [locale, setLocale] = usePersistedLocale();
  const [view, setView] = useState<View>("today");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("scoring");
  const [authMode, setAuthMode] = useState<AuthMode>("loading");
  const [accountId, setAccountId] = useState("");
  const [loadedDate, setLoadedDate] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [rubric, setRubric] = useState<Rubric>(starter);
  const [draftRubric, setDraftRubric] = useState<Rubric>(cloneRubric(starter));
  const [answers, setAnswers] = useState<Answers>({});
  const [recordStatus, setRecordStatus] = useState<"draft" | "completed">("draft");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [history, setHistory] = useState<DailyRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<DailyRecord | null>(null);
  const [rangeDays, setRangeDays] = useState<30 | 90>(30);
  const [timezone, setTimezone] = useState("Asia/Tokyo");
  const [cutoffHour, setCutoffHour] = useState(5);
  const [toast, setToast] = useState("");

  const t = copy[locale] as typeof copy.en;
  const currentDate = useMemo(() => effectiveDate(timezone, cutoffHour), [timezone, cutoffHour]);
  const currentScore = Math.max(rubric.minimumScore, Math.min(100, scoreAnswers(rubric, answers)));
  const currentEvaluation = evaluationForScore(rubric, currentScore);
  const answered = answeredCount(rubric, answers);
  const complete = isComplete(rubric, answers);
  const validation = useMemo(() => validateRubric(draftRubric), [draftRubric]);

  useEffect(() => {
    void fetch("/api/me").then(async (response) => {
      if (!response.ok) { window.location.replace("/log/signin"); return; }
      const payload = await response.json() as { user?: { id: string; email?: string; locale?: Locale; timezone?: string; cutoffHour?: number } };
      if (!payload.user) { window.location.replace("/log/signin"); return; }
      setAccountId(payload.user.id);
      setAuthMode("signed-in");
      if (payload.user.email) setAccountEmail(payload.user.email);
      if (payload.user.locale) setLocale(payload.user.locale);
      if (payload.user.timezone) setTimezone(payload.user.timezone);
      if (typeof payload.user.cutoffHour === "number") setCutoffHour(payload.user.cutoffHour);
    }).catch(() => setSaveState("needs-attention"));
  }, [setLocale]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (window.localStorage.getItem(tutorialStorageKey) !== "complete") setTutorialOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (authMode !== "signed-in" || !accountId) return;
    let cancelled = false;
    void syncPendingMutations(accountId).then(setSaveState).then(() => Promise.all([fetch("/api/rubric"), fetch(`/api/today?date=${currentDate}`), fetch("/api/history?days=90")])).then(async ([rubricResponse, todayResponse, historyResponse]) => {
      if (cancelled) return;
      if (![rubricResponse, todayResponse, historyResponse].every((response) => response.ok)) throw new Error("Unable to load records.");
      if (rubricResponse.ok) {
        const payload = await rubricResponse.json() as { rubric?: Rubric };
        if (payload.rubric) {
          setRubric(payload.rubric);
          setDraftRubric(cloneRubric(payload.rubric));
        }
      }
      if (todayResponse.ok) {
        const payload = await todayResponse.json() as { record?: DailyRecord | null };
        const local = await readLocalDraft(accountId, currentDate);
        if (cancelled) return;
        setAnswers(local && (!payload.record || local.updatedAt > payload.record.updatedAt) ? local.answers : payload.record?.answers ?? {});
        setRecordStatus(payload.record?.status === "completed" ? "completed" : "draft");
      }
      if (historyResponse.ok) {
        const payload = await historyResponse.json() as { records?: DailyRecord[] };
        setHistory(payload.records ?? []);
      }
      setLoadedDate(currentDate);
    }).catch(() => { if (!cancelled) setSaveState("needs-attention"); });
    return () => { cancelled = true; };
  }, [authMode, accountId, currentDate]);

  useEffect(() => {
    if (authMode !== "signed-in" || !accountId) return;
    const sync = () => { void syncPendingMutations(accountId).then(setSaveState); };
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [authMode, accountId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function setLanguage(next: Locale) {
    setLocale(next);
    void fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: next }) }).catch(() => undefined);
  }

  async function chooseOutcome(criterion: Criterion, outcome: Outcome) {
    const nextAnswers = { ...answers, [criterion.id]: outcome.id };
    setAnswers(nextAnswers);
    setSaveState("saving");
    const updatedAt = new Date().toISOString();
    try {
      await saveLocalDraft(accountId, { date: currentDate, answers: nextAnswers, rubric, updatedAt });
      const mutation: MutationPayload = { id: `draft-${currentDate}-${criterion.id}-${Date.now()}`, type: recordStatus === "completed" ? "complete-record" : "save-draft", payload: { date: currentDate, answers: nextAnswers, baseUpdatedAt: updatedAt }, createdAt: updatedAt };
      await enqueueMutation(accountId, mutation);
      setSaveState(authMode === "signed-in" ? await syncPendingMutations(accountId) : navigator.onLine ? "saved" : "offline");
    } catch {
      setSaveState("offline");
    }
  }

  async function finishToday() {
    if (!complete) return;
    setRecordStatus("completed");
    setSaveState("saving");
    const nextRecord: DailyRecord = {
      id: `record-${currentDate}`,
      date: currentDate,
      status: "completed",
      score: currentScore,
      answers,
      rubricVersion: rubric.version,
      evaluationLabel: currentEvaluation.label,
      updatedAt: new Date().toISOString(),
    };
    setHistory((items) => [nextRecord, ...items.filter((item) => item.date !== currentDate)]);
    const updatedAt = new Date().toISOString();
    await enqueueMutation(accountId, { id: `complete-${currentDate}-${Date.now()}`, type: "complete-record", payload: { date: currentDate, answers, baseUpdatedAt: updatedAt }, createdAt: updatedAt });
    setSaveState(authMode === "signed-in" ? await syncPendingMutations(accountId) : navigator.onLine ? "saved" : "offline");
    setToast(locale === "ja" ? "今日の記録を保存しました。" : "Today’s record is saved.");
  }

  async function clearAnswers() {
    setAnswers({});
    setRecordStatus("draft");
    const updatedAt = new Date().toISOString();
    await saveLocalDraft(accountId, { date: currentDate, answers: {}, rubric, updatedAt });
    await enqueueMutation(accountId, { id: `clear-${currentDate}-${Date.now()}`, type: "save-draft", payload: { date: currentDate, answers: {}, baseUpdatedAt: updatedAt }, createdAt: updatedAt });
    setSaveState(authMode === "signed-in" ? await syncPendingMutations(accountId) : navigator.onLine ? "saved" : "offline");
    setToast(locale === "ja" ? "回答をクリアしました。" : "Answers cleared.");
  }

  async function saveRubric() {
    if (!validation.valid) return;
    let next = { ...cloneRubric(draftRubric), version: rubric.version + 1, id: `local-rubric-${rubric.version + 1}` };
    if (authMode === "signed-in") {
      const response = await fetch("/api/rubric", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubric: draftRubric }),
      }).catch(() => null);
      if (!response?.ok) {
        setSaveState("needs-attention");
        setToast(locale === "ja" ? "変更を保存できませんでした。" : "Changes could not be saved.");
        return;
      }
      const payload = await response.json() as { rubric?: Rubric };
      if (payload.rubric) next = payload.rubric;
    }
    setRubric(next);
    setDraftRubric(cloneRubric(next));
    setToast(locale === "ja" ? "ルールを保存し、今から適用しました。" : "Rules saved and applied.");
  }

  function openSettings(tab: SettingsTab) {
    setView("settings");
    setSettingsTab(tab);
  }

  function exportData(format: "json" | "csv") {
    window.location.assign(`/api/export?format=${format}`);
  }

  async function deleteAccount() {
    if (!window.confirm(t.deleteConfirm)) return;
    const response = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { setToast(locale === "ja" ? "削除できませんでした。もう一度お試しください。" : "Deletion failed. Please try again."); return; }
    window.location.assign("/log/signin");
  }

  async function accountAction() {
    if (authMode === "signed-in") {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      window.location.assign("/log/signin");
      return;
    }
    window.location.assign("/log/signin");
  }

  if (authMode !== "signed-in" || loadedDate !== currentDate) return <div className="app-frame"><main className="auth-main"><div className="auth-card" role="status"><h1>CorkWill Log</h1><p>{saveState === "needs-attention" ? (locale === "ja" ? "読み込めませんでした。接続を確認して再読み込みしてください。" : "Could not load your records. Check your connection and reload.") : (locale === "ja" ? "記録を読み込んでいます…" : "Loading your records…")}</p><a href="/log/signin">{t.signIn}</a></div></main></div>;

  return (
    <div className="app-frame">
      <header className="app-header">
        <button className="brand-button" onClick={() => { setView("today"); setSelectedRecord(null); }} aria-label={t.nav.today}>
          <span className="brand-mark">C</span>
          <span className="brand-name"><span>CorkWill</span> <strong>Log</strong></span>
        </button>
        <nav className="desktop-nav" aria-label={locale === "ja" ? "メインナビゲーション" : "Primary navigation"}>
          <NavButton active={view === "today"} onClick={() => setView("today")} label={t.nav.today} iconName="today" />
          <NavButton active={view === "history"} onClick={() => setView("history")} label={t.nav.history} iconName="history" />
          <NavButton active={view === "settings"} onClick={() => setView("settings")} label={t.nav.settings} iconName="settings" />
        </nav>
        <div className="header-actions">
          <button className="help-button" onClick={() => setTutorialOpen(true)}>{t.tutorial.help}</button>
          <LanguageSwitch locale={locale} setLanguage={setLanguage} />
          <button className="account-chip" onClick={() => void accountAction()} aria-label={authMode !== "signed-in" ? t.signInToSync : t.signOut}>
            <span className="account-dot" />
            <span>{authMode !== "signed-in" ? t.signIn : accountEmail || t.signOut}</span>
          </button>
        </div>
      </header>

      <main className={`main-content main-${view}`}>
        {view === "today" && <TodayView t={t} locale={locale} currentDate={currentDate} rubric={rubric} answers={answers} answered={answered} complete={complete} currentScore={currentScore} currentEvaluation={currentEvaluation} recordStatus={recordStatus} saveState={saveState} chooseOutcome={chooseOutcome} finishToday={finishToday} clearAnswers={clearAnswers} openSettings={openSettings} />}
        {view === "history" && <HistoryView t={t} locale={locale} history={history} rangeDays={rangeDays} setRangeDays={setRangeDays} selectedRecord={selectedRecord} setSelectedRecord={setSelectedRecord} />}
        {view === "settings" && <SettingsView t={t} locale={locale} tab={settingsTab} setTab={setSettingsTab} draftRubric={draftRubric} setDraftRubric={setDraftRubric} validation={validation} saveRubric={saveRubric} rubric={rubric} setLanguage={setLanguage} timezone={timezone} setTimezone={setTimezone} cutoffHour={cutoffHour} setCutoffHour={setCutoffHour} setToast={setToast} exportData={exportData} deleteAccount={deleteAccount} />}
      </main>

      <nav className="mobile-tabs" aria-label={locale === "ja" ? "メインナビゲーション" : "Primary navigation"}>
        <NavButton active={view === "today"} onClick={() => setView("today")} label={t.nav.today} iconName="today" />
        <NavButton active={view === "history"} onClick={() => setView("history")} label={t.nav.history} iconName="history" />
        <NavButton active={view === "settings"} onClick={() => setView("settings")} label={t.nav.settings} iconName="settings" />
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
      {tutorialOpen && <BeginnerGuide locale={locale} onDismiss={() => setTutorialOpen(false)} />}
    </div>
  );
}

function NavButton({ active, onClick, label, iconName }: { active: boolean; onClick: () => void; label: string; iconName: "today" | "history" | "settings" }) {
  return <button className={`nav-button ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>{icon(iconName)}<span>{label}</span></button>;
}

function LanguageSwitch({ locale, setLanguage }: { locale: Locale; setLanguage: (locale: Locale) => void }) {
  return <div className="language-switch" role="group" aria-label={locale === "ja" ? "言語" : "Language"}><button aria-pressed={locale === "en"} className={locale === "en" ? "selected" : ""} onClick={() => setLanguage("en")}>EN</button><span aria-hidden="true">|</span><button aria-pressed={locale === "ja"} className={locale === "ja" ? "selected" : ""} onClick={() => setLanguage("ja")}>日本語</button></div>;
}

function StatusLabel({ state, t }: { state: SaveState; t: typeof copy.en }) {
  const label = state === "saved" ? t.saved : state === "saving" ? t.syncing : state === "offline" ? t.offline : t.needsAttention;
  return <span className={`save-status save-${state}`}><span className="status-dot" />{label}</span>;
}

function ScoreSummary({ t, score, evaluation, evaluationMax, answered, total, status, saveState }: { t: typeof copy.en; score: number; evaluation: EvaluationLevel; evaluationMax: number; answered: number; total: number; status: "draft" | "completed" | "missed"; saveState: SaveState }) {
  return <section className="score-summary" aria-label={`${t.score} ${score}`}>
    <div className="score-main"><span className="score-kicker">{t.score}</span><strong>{score}</strong><span className="score-range">{t.possibleRange} 0–100</span></div>
    <div className="score-meta"><div><span className="evaluation-marker" /> <strong>{evaluation.label}</strong><span className="evaluation-range">{evaluation.min}–{evaluationMax}</span></div><div className="answer-progress"><span>{answered} {t.of} {total} {t.answered}</span><span className={`record-state state-${status}`}>{status === "draft" ? t.draft : status === "completed" ? t.completed : t.missed}</span></div><StatusLabel state={saveState} t={t} /></div>
  </section>;
}

function TodayView({ t, locale, currentDate, rubric, answers, answered, complete, currentScore, currentEvaluation, recordStatus, saveState, chooseOutcome, finishToday, clearAnswers, openSettings }: { t: typeof copy.en; locale: Locale; currentDate: string; rubric: Rubric; answers: Answers; answered: number; complete: boolean; currentScore: number; currentEvaluation: EvaluationLevel; recordStatus: "draft" | "completed"; saveState: SaveState; chooseOutcome: (criterion: Criterion, outcome: Outcome) => Promise<void>; finishToday: () => Promise<void>; clearAnswers: () => Promise<void>; openSettings: (tab: SettingsTab) => void }) {
  const orderedLevels = [...rubric.levels].sort((a, b) => a.min - b.min);
  const evaluationIndex = Math.max(0, orderedLevels.findIndex((level) => level.id === currentEvaluation.id));
  return <div className="page today-page">
    <div className="page-heading today-heading"><div><p className="eyebrow">{t.today} · {displayLongDate(currentDate, locale)}</p><h1>{t.dayPrompt}</h1></div><button className="text-button" onClick={() => void clearAnswers()}>{t.startOver}</button></div>
    <ScoreSummary t={t} score={currentScore} evaluation={currentEvaluation} evaluationMax={evaluationRange(orderedLevels, evaluationIndex).max} answered={answered} total={requiredCount(rubric)} status={recordStatus} saveState={saveState} />
    <div className="today-sections">{rubric.sections.map((section, index) => <SectionCard key={section.id} section={section} sectionIndex={index} t={t} answers={answers} chooseOutcome={chooseOutcome} />)}</div>
    <section className="finish-panel"><div><span className="finish-kicker">{complete ? t.finishedHint : `${requiredCount(rubric) - answered} ${locale === "ja" ? "項目が未回答" : "required criteria left"}`}</span><h2>{complete ? t.completed : t.finish}</h2><p>{complete ? t.finishedHint : t.finishHint}</p></div><button className="primary-button" disabled={!complete} onClick={() => void finishToday()}>{t.finish} {icon("arrow")}</button></section>
    <div className="today-footer"><span>{locale === "ja" ? "ルールを変えたいですか？" : "Want to shape the rules?"}</span><button className="link-button" onClick={() => openSettings("scoring")}>{t.settingsTitle} {icon("arrow")}</button></div>
  </div>;
}

function SectionCard({ section, sectionIndex, t, answers, chooseOutcome }: { section: RubricSection; sectionIndex: number; t: typeof copy.en; answers: Answers; chooseOutcome: (criterion: Criterion, outcome: Outcome) => Promise<void> }) {
  const [open, setOpen] = useState(sectionIndex === 0);
  const sectionAnswered = section.criteria.filter((criterion) => Boolean(answers[criterion.id])).length;
  return <section className={`section-card ${open ? "is-open" : ""}`}>
    <button className="section-header" onClick={() => setOpen((value) => !value)} aria-expanded={open}><span><span className="section-number">0{sectionIndex + 1}</span><strong>{section.label}</strong></span><span className="section-header-meta">{sectionAnswered}/{section.criteria.length}<span className="chevron">{open ? "⌃" : "⌄"}</span></span></button>
    {open && <div className="criteria-list">{section.criteria.map((criterion) => <div className="criterion" key={criterion.id}><div className="criterion-label"><span>{criterion.label}</span>{criterion.required && <em>{answers[criterion.id] ? t.answered : t.unanswered}</em>}</div><div className="outcome-list" role="group" aria-label={criterion.label}>{criterion.outcomes.map((outcome) => { const selected = answers[criterion.id] === outcome.id; return <button key={outcome.id} className={`choice-row ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => void chooseOutcome(criterion, outcome)}><span className="choice-copy"><span className="choice-indicator">{selected ? icon("check") : ""}</span><span><strong>{outcome.label}</strong>{outcome.description && <small>{outcome.description}</small>}</span></span><span className={`points points-${outcome.points > 0 ? "positive" : outcome.points < 0 ? "negative" : "zero"}`}>{formatSignedPoints(outcome.points)}</span></button>; })}</div></div>)}</div>}
  </section>;
}

function HistoryView({ t, locale, history, rangeDays, setRangeDays, selectedRecord, setSelectedRecord }: { t: typeof copy.en; locale: Locale; history: DailyRecord[]; rangeDays: 30 | 90; setRangeDays: (value: 30 | 90) => void; selectedRecord: DailyRecord | null; setSelectedRecord: (record: DailyRecord | null) => void }) {
  const visible = history.slice(0, rangeDays === 30 ? 11 : history.length);
  const average = Math.round(visible.filter((record) => record.status !== "missed").reduce((total, record) => total + record.score, 0) / Math.max(1, visible.filter((record) => record.status !== "missed").length));
  return <div className="page history-page wide-page">
    <div className="page-heading"><div><p className="eyebrow">{t.nav.history}</p><h1>{t.historyTitle}</h1><p>{t.historyIntro}</p></div><select className="range-select" value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value) as 30 | 90)} aria-label="History range"><option value="30">{t.last30}</option><option value="90">{t.last90}</option></select></div>
    <div className="history-overview"><div><span className="stat-label">{t.average}</span><strong>{average}</strong><span className="stat-suffix">/ 100</span></div><div><span className="stat-label">{t.records}</span><strong>{visible.length}</strong><span className="stat-suffix">{locale === "ja" ? "日" : "days"}</span></div><div className="history-note"><span className="status-dot status-dot-accent" />{t.trendSummary}</div></div>
    <section className="chart-card"><div className="card-heading"><div><span className="eyebrow">{t.trend}</span><h2>{t.trend}</h2></div><div className="chart-legend"><span><i className="legend-line" />{t.score}</span><span><i className="legend-marker" />{t.rubricMarker}</span></div></div><ScoreChart records={visible} t={t} locale={locale} /><details className="exact-values"><summary>{locale === "ja" ? "正確な値を表示" : "Show exact values"}</summary><ul>{visible.map((record) => <li key={record.id}><span>{displayDate(record.date, locale)}</span><strong>{record.status === "missed" ? t.missed : record.score}</strong><em>v{record.rubricVersion}</em></li>)}</ul></details></section>
    <section className="records-section"><div className="card-heading"><div><span className="eyebrow">{t.records}</span><h2>{t.records}</h2></div><span className="muted-label">{visible.length} {locale === "ja" ? "件" : "records"}</span></div><div className="record-list">{visible.map((record) => <button className={`record-row ${selectedRecord?.id === record.id ? "is-selected" : ""}`} key={record.id} onClick={() => setSelectedRecord(record)}><span className="record-date"><strong>{displayDate(record.date, locale)}</strong><small>{displayLongDate(record.date, locale)}</small></span><span className={`record-badge badge-${record.status}`}>{record.status === "missed" ? t.missed : record.evaluationLabel}</span><span className="record-score">{record.status === "missed" ? "—" : record.score}</span><span className="record-version">v{record.rubricVersion}</span>{icon("arrow")}</button>)}</div></section>
    {selectedRecord && <section className="day-detail" aria-live="polite"><div className="card-heading"><div><span className="eyebrow">{displayLongDate(selectedRecord.date, locale)}</span><h2>{selectedRecord.status === "missed" ? t.missed : `${t.score} ${selectedRecord.score}`}</h2></div><button className="icon-button" onClick={() => setSelectedRecord(null)} aria-label={t.close}>×</button></div><div className="detail-grid"><div><span className="stat-label">{t.possibleRange}</span><strong>0–100</strong></div><div><span className="stat-label">{t.evaluationLevels}</span><strong>{selectedRecord.evaluationLabel}</strong></div><div><span className="stat-label">{t.rubricMarker}</span><strong>v{selectedRecord.rubricVersion}</strong></div></div><p className="detail-note">{locale === "ja" ? "この日の記録は、当時保存されたルーブリックのスナップショットを使っています。" : "This record keeps the rubric snapshot that was active on this day."}</p></section>}
  </div>;
}

function ScoreChart({ records, t, locale }: { records: DailyRecord[]; t: typeof copy.en; locale: Locale }) {
  const points = [...records].reverse();
  const width = 760;
  const height = 250;
  const left = 42;
  const right = 18;
  const top = 18;
  const bottom = 36;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const xFor = (index: number) => left + (points.length <= 1 ? innerWidth / 2 : index * (innerWidth / (points.length - 1)));
  const yFor = (score: number) => top + innerHeight - (score / 100) * innerHeight;
  const line = points.map((record, index) => `${xFor(index)},${yFor(record.score)}`).join(" ");
  return <div className="chart-wrap"><svg className="score-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.trend}>
    {[0, 25, 50, 75, 100].map((value) => <g key={value}><line x1={left} x2={width - right} y1={yFor(value)} y2={yFor(value)} className="chart-grid" /><text x={left - 10} y={yFor(value) + 4} textAnchor="end" className="chart-axis">{value}</text></g>)}
    {points.map((record, index) => index > 0 && record.rubricVersion !== points[index - 1].rubricVersion ? <g key={`marker-${record.id}`}><line x1={xFor(index) - 8} x2={xFor(index) - 8} y1={top} y2={height - bottom} className="rubric-change-line" /><text x={xFor(index) - 8} y={top - 3} textAnchor="middle" className="rubric-change-label">v{record.rubricVersion}</text></g> : null)}
    <polyline points={line} className="chart-line" />
    {points.map((record, index) => <g key={record.id}><circle cx={xFor(index)} cy={yFor(record.score)} r={record.status === "missed" ? 6 : 5} className={`chart-point chart-point-${record.status}`} /><text x={xFor(index)} y={height - 13} textAnchor="middle" className="chart-date">{displayDate(record.date, locale).split(" ")[0]}</text><title>{`${displayLongDate(record.date, locale)}: ${record.status === "missed" ? t.missed : record.score}`}</title></g>)}
  </svg></div>;
}

function SettingsView({ t, locale, tab, setTab, draftRubric, setDraftRubric, validation, saveRubric, rubric, setLanguage, timezone, setTimezone, cutoffHour, setCutoffHour, setToast, exportData, deleteAccount }: { t: typeof copy.en; locale: Locale; tab: SettingsTab; setTab: (tab: SettingsTab) => void; draftRubric: Rubric; setDraftRubric: (rubric: Rubric) => void; validation: ReturnType<typeof validateRubric>; saveRubric: () => void; rubric: Rubric; setLanguage: (locale: Locale) => void; timezone: string; setTimezone: (timezone: string) => void; cutoffHour: number; setCutoffHour: (hour: number) => void; setToast: (value: string) => void; exportData: (format: "json" | "csv") => void; deleteAccount: () => Promise<void> }) {
  const tabs: Array<[SettingsTab, string]> = [["scoring", t.dailyScoring], ["levels", t.evaluationLevels], ["profile", t.profile], ["data", t.data]];
  return <div className="page settings-page"><div className="page-heading"><div><p className="eyebrow">{t.nav.settings}</p><h1>{t.settingsTitle}</h1><p>{t.settingsIntro}</p></div><span className="version-chip">v{rubric.version}</span></div><div className="settings-layout"><aside className="settings-nav" aria-label={t.nav.settings}>{tabs.map(([value, label]) => <button key={value} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{label}<span>→</span></button>)}</aside><div className="settings-panel">{tab === "scoring" && <RubricEditor t={t} draftRubric={draftRubric} setDraftRubric={setDraftRubric} validation={validation} saveRubric={saveRubric} />}{tab === "levels" && <LevelEditor t={t} draftRubric={draftRubric} setDraftRubric={setDraftRubric} validation={validation} saveRubric={saveRubric} />}{tab === "profile" && <ProfileEditor t={t} locale={locale} setLanguage={setLanguage} timezone={timezone} setTimezone={setTimezone} cutoffHour={cutoffHour} setCutoffHour={setCutoffHour} setToast={setToast} />}{tab === "data" && <DataEditor t={t} exportData={exportData} deleteAccount={deleteAccount} />}</div></div></div>;
}

function RubricEditor({ t, draftRubric, setDraftRubric, validation, saveRubric }: { t: typeof copy.en; draftRubric: Rubric; setDraftRubric: (rubric: Rubric) => void; validation: ReturnType<typeof validateRubric>; saveRubric: () => void }) {
  function updateSection(index: number, patch: Partial<RubricSection>) { const sections = draftRubric.sections.map((section, itemIndex) => itemIndex === index ? { ...section, ...patch } : section); setDraftRubric({ ...draftRubric, sections }); }
  function updateCriterion(sectionIndex: number, criterionIndex: number, patch: Partial<Criterion>) { const sections = draftRubric.sections.map((section, index) => index !== sectionIndex ? section : { ...section, criteria: section.criteria.map((criterion, itemIndex) => itemIndex === criterionIndex ? { ...criterion, ...patch } : criterion) }); setDraftRubric({ ...draftRubric, sections }); }
  function updateOutcome(sectionIndex: number, criterionIndex: number, outcomeIndex: number, patch: Partial<Outcome>) { const sections = draftRubric.sections.map((section, index) => index !== sectionIndex ? section : { ...section, criteria: section.criteria.map((criterion, itemIndex) => itemIndex !== criterionIndex ? criterion : { ...criterion, outcomes: criterion.outcomes.map((item, valueIndex) => valueIndex === outcomeIndex ? { ...item, ...patch } : item) }) }); setDraftRubric({ ...draftRubric, sections }); }
  function moveSection(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= draftRubric.sections.length) return; const sections = [...draftRubric.sections]; [sections[index], sections[target]] = [sections[target], sections[index]]; setDraftRubric({ ...draftRubric, sections }); }
  function addSection() { setDraftRubric({ ...draftRubric, sections: [...draftRubric.sections, { id: newId("section"), label: "New section", criteria: [{ id: newId("criterion"), label: "New criterion", required: true, outcomes: [{ id: newId("outcome"), label: "Not today", points: 0 }, { id: newId("outcome"), label: "Yes", points: 0 }] }] }] }); }
  function addCriterion(sectionIndex: number) { const sections = draftRubric.sections.map((section, index) => index === sectionIndex ? { ...section, criteria: [...section.criteria, { id: newId("criterion"), label: "New criterion", required: true, outcomes: [{ id: newId("outcome"), label: "Not today", points: 0 }, { id: newId("outcome"), label: "Yes", points: 0 }] }] } : section); setDraftRubric({ ...draftRubric, sections }); }
  function removeCriterion(sectionIndex: number, criterionIndex: number) { const sections = draftRubric.sections.map((section, index) => index === sectionIndex ? { ...section, criteria: section.criteria.filter((_, itemIndex) => itemIndex !== criterionIndex) } : section); setDraftRubric({ ...draftRubric, sections }); }
  function addOutcome(sectionIndex: number, criterionIndex: number) { const sections = draftRubric.sections.map((section, index) => index !== sectionIndex ? section : { ...section, criteria: section.criteria.map((criterion, itemIndex) => itemIndex !== criterionIndex ? criterion : { ...criterion, outcomes: [...criterion.outcomes, { id: newId("outcome"), label: "New outcome", points: 0 }] }) }); setDraftRubric({ ...draftRubric, sections }); }
  function removeOutcome(sectionIndex: number, criterionIndex: number, outcomeIndex: number) { const sections = draftRubric.sections.map((section, index) => index !== sectionIndex ? section : { ...section, criteria: section.criteria.map((criterion, itemIndex) => itemIndex !== criterionIndex ? criterion : { ...criterion, outcomes: criterion.outcomes.filter((_, valueIndex) => valueIndex !== outcomeIndex) }) }); setDraftRubric({ ...draftRubric, sections }); }
  return <div className="editor-stack"><div className="panel-heading"><div><span className="eyebrow">{t.dailyScoring}</span><h2>{t.dailyScoring}</h2><p>{t.minimumHint}</p></div><button className="secondary-button" onClick={saveRubric} disabled={!validation.valid}>{t.saveChanges}</button></div><div className="field-row minimum-field"><label>{t.minimumScore}<input type="number" min="0" max="80" value={draftRubric.minimumScore} onChange={(event) => setDraftRubric({ ...draftRubric, minimumScore: Number(event.target.value) })} /></label><span className="field-hint">{t.base}</span></div><RangePreview t={t} validation={validation} />{validation.issues.length > 0 && <div className="validation-box" role="alert"><strong>{t.invalid}</strong><ul>{validation.issues.slice(0, 3).map((issue) => <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>)}</ul></div>}{draftRubric.sections.map((section, sectionIndex) => <section className="editor-section" key={section.id}><div className="editor-section-heading"><label className="grow-label">{t.section}<input value={section.label} onChange={(event) => updateSection(sectionIndex, { label: event.target.value })} /></label><div className="row-actions"><button className="small-button" onClick={() => moveSection(sectionIndex, -1)} disabled={sectionIndex === 0}>{t.moveUp}</button><button className="small-button" onClick={() => moveSection(sectionIndex, 1)} disabled={sectionIndex === draftRubric.sections.length - 1}>{t.moveDown}</button></div></div>{section.criteria.map((criterion, criterionIndex) => <div className="criterion-editor" key={criterion.id}><div className="criterion-editor-heading"><label className="grow-label">{t.criterion}<input value={criterion.label} onChange={(event) => updateCriterion(sectionIndex, criterionIndex, { label: event.target.value })} /></label><label className="required-toggle"><input type="checkbox" checked={criterion.required} onChange={(event) => updateCriterion(sectionIndex, criterionIndex, { required: event.target.checked })} /> {localeLabel(t, "Required", "必須")}</label><button className="small-button danger-text" onClick={() => removeCriterion(sectionIndex, criterionIndex)}>{t.remove}</button></div><div className="outcome-editor-heading"><span>{t.outcome}</span><span>{t.points}</span></div>{criterion.outcomes.map((item, outcomeIndex) => <div className="outcome-editor-row" key={item.id}><input aria-label={`${t.outcome} ${outcomeIndex + 1}`} value={item.label} onChange={(event) => updateOutcome(sectionIndex, criterionIndex, outcomeIndex, { label: event.target.value })} /><input aria-label={t.points} className="points-input" type="number" step="1" value={item.points} onChange={(event) => updateOutcome(sectionIndex, criterionIndex, outcomeIndex, { points: Number(event.target.value) })} /><button className="icon-button small-icon" onClick={() => removeOutcome(sectionIndex, criterionIndex, outcomeIndex)} aria-label={t.remove}>×</button></div>)}<button className="add-button" onClick={() => addOutcome(sectionIndex, criterionIndex)}>+ {t.addOutcome}</button></div>)}<button className="add-button" onClick={() => addCriterion(sectionIndex)}>+ {t.addCriterion}</button></section>)}<button className="outline-button" onClick={addSection}>+ {t.addSection}</button><p className="future-note">{t.futureDays}</p></div>;
}

function LevelEditor({ t, draftRubric, setDraftRubric, validation, saveRubric }: { t: typeof copy.en; draftRubric: Rubric; setDraftRubric: (rubric: Rubric) => void; validation: ReturnType<typeof validateRubric>; saveRubric: () => void }) {
  function update(index: number, patch: Partial<EvaluationLevel>) { setDraftRubric({ ...draftRubric, levels: draftRubric.levels.map((level, itemIndex) => itemIndex === index ? { ...level, ...patch } : level) }); }
  function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= draftRubric.levels.length) return; const levels = [...draftRubric.levels]; [levels[index], levels[target]] = [levels[target], levels[index]]; setDraftRubric({ ...draftRubric, levels }); }
  function add() { setDraftRubric({ ...draftRubric, levels: [...draftRubric.levels, { id: newId("level"), label: "New level", min: 100 }] }); }
  function remove(index: number) { if (draftRubric.levels.length <= 1) return; setDraftRubric({ ...draftRubric, levels: draftRubric.levels.filter((_, itemIndex) => itemIndex !== index) }); }
  return <div className="editor-stack"><div className="panel-heading"><div><span className="eyebrow">{t.evaluationLevels}</span><h2>{t.evaluationLevels}</h2><p>{t.rangeRules}</p></div><button className="secondary-button" onClick={saveRubric} disabled={!validation.valid}>{t.saveChanges}</button></div><div className="level-preview">{draftRubric.levels.map((level, index) => { const range = evaluationRange(draftRubric.levels, index); return <div className="level-preview-item" key={level.id} style={{ flex: Math.max(1, range.max - range.min + 1) }}><span className={`level-marker marker-${index % 5}`} /> <strong>{level.label || "—"}</strong><small>{range.min}–{range.max}</small></div>; })}</div>{validation.issues.filter((issue) => issue.path.startsWith("levels")).length > 0 && <div className="validation-box" role="alert"><strong>{t.invalid}</strong><ul>{validation.issues.filter((issue) => issue.path.startsWith("levels")).slice(0, 4).map((issue) => <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>)}</ul></div>}<div className="level-editor-list">{draftRubric.levels.map((level, index) => { const range = evaluationRange(draftRubric.levels, index); return <div className="level-editor-row" key={level.id}><span className={`level-marker marker-${index % 5}`} /><label>{t.outcome}<input value={level.label} onChange={(event) => update(index, { label: event.target.value })} /></label><label>{localeLabel(t, "Starts at", "開始値")}<input type="number" min={draftRubric.minimumScore} max="100" value={level.min} onChange={(event) => update(index, { min: Number(event.target.value) })} /></label><span className="generated-range"><small>{localeLabel(t, "Range", "範囲")}</small><strong>{range.min}–{range.max}</strong></span><div className="row-actions"><button className="small-button" onClick={() => move(index, -1)} disabled={index === 0}>{t.moveUp}</button><button className="small-button" onClick={() => move(index, 1)} disabled={index === draftRubric.levels.length - 1}>{t.moveDown}</button><button className="small-button danger-text" onClick={() => remove(index)} disabled={draftRubric.levels.length <= 1}>{t.remove}</button></div></div>; })}</div><button className="outline-button" onClick={add}>+ {localeLabel(t, "Add level", "レベルを追加")}</button><p className="future-note">{t.futureDays}</p></div>;
}

function RangePreview({ t, validation }: { t: typeof copy.en; validation: ReturnType<typeof validateRubric> }) {
  return <section className="range-preview"><div className="card-heading"><div><span className="eyebrow">{t.rangePreview}</span><h3>{t.rangePreview}</h3></div><span className={validation.valid ? "valid-chip" : "warning-chip"}>{validation.valid ? t.valid : t.invalid}</span></div><div className="range-scale"><span>{validation.minimumPossible}</span><div className="range-track"><span className="range-fill" style={{ left: `${(validation.minimumPossible / 100) * 100}%`, right: `${100 - validation.maximumPossible}%` }} /><i className="base-marker" style={{ left: "80%" }}><b>80</b></i></div><span>100</span></div><div className="range-values"><span>{t.worstCase} <strong>{validation.minimumPossible}</strong></span><span>{t.base}</span><span>{t.bestCase} <strong>{validation.maximumPossible}</strong></span></div><p className="range-footnote">{localeLabel(t, "Every criterion contributes its selected point value.", "各基準は選択したポイントを加算します。")}</p></section>;
}

function ProfileEditor({ t, locale, setLanguage, timezone, setTimezone, cutoffHour, setCutoffHour, setToast }: { t: typeof copy.en; locale: Locale; setLanguage: (locale: Locale) => void; timezone: string; setTimezone: (timezone: string) => void; cutoffHour: number; setCutoffHour: (hour: number) => void; setToast: (value: string) => void }) {
  function save() { void fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale, timezone, cutoffHour }) }).catch(() => undefined); setToast(locale === "ja" ? "プロフィールを保存しました。" : "Profile saved."); }
  return <div className="editor-stack"><div className="panel-heading"><div><span className="eyebrow">{t.profile}</span><h2>{t.profile}</h2><p>{localeLabel(t, "These preferences travel with your account.", "これらの設定はアカウントに保存されます。")}</p></div><button className="secondary-button" onClick={save}>{t.saveChanges}</button></div><div className="profile-form"><fieldset><legend>{t.language}</legend><div className="language-options"><button className={locale === "en" ? "is-selected" : ""} onClick={() => setLanguage("en")} aria-pressed={locale === "en"}>English</button><button className={locale === "ja" ? "is-selected" : ""} onClick={() => setLanguage("ja")} aria-pressed={locale === "ja"}>日本語</button></div></fieldset><label>{t.timezone}<select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option>Asia/Tokyo</option><option>America/Los_Angeles</option><option>America/New_York</option><option>Europe/London</option><option>UTC</option></select></label><label>{t.cutoff}<select value={cutoffHour} onChange={(event) => setCutoffHour(Number(event.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option value={hour} key={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select><small>{t.cutoffHint}</small></label></div></div>;
}

function DataEditor({ t, exportData, deleteAccount }: { t: typeof copy.en; exportData: (format: "json" | "csv") => void; deleteAccount: () => Promise<void> }) {
  return <div className="editor-stack"><div className="panel-heading"><div><span className="eyebrow">{t.data}</span><h2>{t.data}</h2><p>{t.exportHint}</p></div></div><section className="data-action"><div><h3>{t.exportData}</h3><p>{t.exportHint}</p></div><div className="button-pair"><button className="outline-button" onClick={() => exportData("json")}>{t.exportJson}</button><button className="outline-button" onClick={() => exportData("csv")}>{t.exportCsv}</button></div></section><section className="data-action danger-panel"><div><h3>{t.deleteAccount}</h3><p>{t.deleteHint}</p></div><button className="danger-button" onClick={() => void deleteAccount()}>{t.deleteAccount}</button></section></div>;
}

function localeLabel(t: typeof copy.en, en: string, ja: string): string {
  return (t.nav.today as string) === "今日" ? ja : en;
}
