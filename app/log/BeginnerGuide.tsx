"use client";

import { useEffect, useRef, useState } from "react";

import { copy } from "../lib/locales";
import type { Locale } from "../lib/types";

export const tutorialStorageKey = "corkwill-log-tutorial-v1";

export default function BeginnerGuide({ locale, onDismiss }: { locale: Locale; onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const t = (copy[locale] as typeof copy.en).tutorial;
  const current = t.steps[step];
  const isLast = step === t.steps.length - 1;

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button")?.focus();
    return () => previousFocus.current?.focus();
  }, []);

  function complete() {
    window.localStorage.setItem(tutorialStorageKey, "complete");
    onDismiss();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      complete();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="tutorial-backdrop" role="presentation">
      <div ref={dialogRef} className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-body" onKeyDown={handleKeyDown}>
        <div className="tutorial-heading">
          <div>
            <p className="eyebrow">{t.stepLabel} {step + 1} / {t.steps.length}</p>
            <h2 id="tutorial-title">{t.title}</h2>
          </div>
          <button className="tutorial-close" onClick={complete} aria-label={t.close}>×</button>
        </div>

        <div className="tutorial-content" aria-live="polite">
          <span className="tutorial-number" aria-hidden="true">0{step + 1}</span>
          <h3>{current.title}</h3>
          <p id="tutorial-body">{current.body}</p>
        </div>

        <div className="tutorial-progress" aria-hidden="true">
          {t.steps.map((item, index) => <span key={item.title} className={index === step ? "is-active" : index < step ? "is-complete" : ""} />)}
        </div>

        <div className="tutorial-actions">
          <button className="tutorial-skip" onClick={complete}>{t.skip}</button>
          <div>
            <button className="outline-button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>{t.back}</button>
            <button className="primary-button" onClick={() => isLast ? complete() : setStep((value) => value + 1)}>{isLast ? t.finish : t.next}<span aria-hidden="true">→</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}
