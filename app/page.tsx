"use client";

/* eslint-disable @next/next/no-html-link-for-pages */

import { copy } from "./lib/locales";
import { usePersistedLocale } from "./lib/use-persisted-locale";

export default function Home() {
  const [locale, setLocale] = usePersistedLocale();
  const t = copy[locale].landing;

  return (
    <div className="landing-shell">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="CorkWill Log home">
          <span className="landing-brand-mark">C</span>
          <span>CorkWill <strong>Log</strong></span>
        </a>
        <div className="landing-language" role="group" aria-label={t.language}>
          <button className={locale === "en" ? "is-active" : ""} aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
          <span aria-hidden="true">/</span>
          <button className={locale === "ja" ? "is-active" : ""} aria-pressed={locale === "ja"} onClick={() => setLocale("ja")}>日本語</button>
        </div>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">{t.eyebrow}</p>
            <h1 id="landing-title">{t.title}</h1>
            <p className="landing-intro">{t.intro}</p>
            <div className="landing-actions">
              <a className="landing-primary" href="/log/signin">{t.primary}<span aria-hidden="true">→</span></a>
              <a className="landing-secondary" href="/log">{t.secondary}</a>
            </div>
            <p className="landing-note"><span aria-hidden="true">✓</span>{t.note}</p>
          </div>

          <div className="landing-score-preview" aria-hidden="true">
            <div className="preview-topline"><span>{t.previewToday}</span><span>3 / 3</span></div>
            <strong>92</strong>
            <div className="preview-evaluation"><span />{t.previewEvaluation}</div>
            <div className="preview-rule"><span>{t.previewSleep}</span><b>+4</b></div>
            <div className="preview-rule"><span>{t.previewMovement}</span><b>+4</b></div>
            <div className="preview-rule"><span>{t.previewFocus}</span><b>+4</b></div>
          </div>
        </section>

        <section className="landing-how" aria-labelledby="how-title">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">{t.stepsEyebrow}</p>
            <h2 id="how-title">{t.stepsTitle}</h2>
            <p>{t.stepsIntro}</p>
          </div>
          <ol className="landing-steps">
            {t.steps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-reassurance">
          <div className="reassurance-score" aria-hidden="true"><strong>80</strong><span>/ 100</span></div>
          <div>
            <h2>{t.reassuranceTitle}</h2>
            <p>{t.reassuranceBody}</p>
          </div>
        </section>

        <section className="landing-final" aria-labelledby="final-title">
          <div>
            <h2 id="final-title">{t.finalTitle}</h2>
            <p>{t.finalBody}</p>
          </div>
          <div className="landing-actions">
            <a className="landing-primary" href="/log/signin">{t.primary}<span aria-hidden="true">→</span></a>
            <a className="landing-secondary" href="/log">{t.secondary}</a>
          </div>
        </section>
      </main>

      <footer className="landing-footer"><span>CorkWill Log</span><span>© 2026 CorkWill</span></footer>
    </div>
  );
}
