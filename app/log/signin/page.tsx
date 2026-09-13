"use client";

import ReleaseVersion from "../ReleaseVersion";

/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useState } from "react";

import { copy } from "../../lib/locales";
import { usePersistedLocale } from "../../lib/use-persisted-locale";

type Step = "email" | "code";

export default function SignInPage() {
  const [locale, setLocale] = usePersistedLocale();
  const [providers, setProviders] = useState<{ google: boolean; email: boolean } | null>(null);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const t = copy[locale] as typeof copy.en;

  useEffect(() => {
    void fetch("/api/auth/providers").then((response) => response.json() as Promise<{ google: boolean; email: boolean }>).then((options) => { setProviders(options); if (new URLSearchParams(window.location.search).has("error")) setError(locale === "ja" ? "ログインを完了できませんでした。もう一度お試しください。" : "Sign-in could not be completed. Please try again."); }).catch(() => setProviders({ google: false, email: false }));
  }, [locale]);

  function signInWithGoogle() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    window.location.assign(`/api/auth/google?${new URLSearchParams({ locale, timezone })}`);
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError(t.emailInvalid);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, locale }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? t.rateLimited : response.status === 503 ? t.deliveryUnavailable : t.requestFailed);
        return;
      }
      setEmail(normalized);
      setStep("code");
    } catch {
      setError(t.requestFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError(t.codeInvalid);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!response.ok) {
        setError(t.codeInvalid);
        return;
      }
      window.location.assign("/log");
    } catch {
      setError(t.codeInvalid);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-frame">
      <header className="auth-header">
        <a className="brand-button auth-brand-link" href="/" aria-label="CorkWill Log home">
          <span className="brand-mark">C</span>
          <span className="brand-name"><span>CorkWill</span> <strong>Log</strong></span>
        </a>
        <LanguageSwitch locale={locale} setLanguage={setLocale} />
      </header>
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-mark">C</div>
          <p className="eyebrow">CorkWill Log</p>
          <h1>{step === "email" ? t.signInTitle : t.codeTitle}</h1>
          <p className="auth-intro">{step === "email" ? (locale === "ja" ? "自分だけの記録を保存し、端末間で同期できます。" : "Save your personal records and sync them across devices.") : `${t.codeIntro} ${email}`}</p>

          {providers?.google && step === "email" && <button className="primary-button full-width" onClick={signInWithGoogle}>{locale === "ja" ? "Google で続ける" : "Continue with Google"}</button>}
          {providers && !providers.google && !providers.email && <p className="auth-help" role="status">{locale === "ja" ? "アカウント登録の準備中です。まもなく Google アカウントでご利用いただけます。" : "Account registration is being configured. Google sign-in will be available soon."}</p>}
          {!providers && <p role="status">{locale === "ja" ? "読み込み中…" : "Loading sign-in options…"}</p>}
          {providers?.email && (step === "email" ? (
            <form onSubmit={(event) => void requestCode(event)} noValidate>
              <label className="visually-hidden" htmlFor="email">{locale === "ja" ? "メールアドレス" : "Email"}</label>
              <input id="email" type="email" inputMode="email" autoComplete="email" placeholder={t.emailPlaceholder} value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} autoFocus />
              <button className="primary-button full-width" type="submit" disabled={submitting}>{submitting ? t.sendingCode : t.sendCode}<span aria-hidden="true">→</span></button>
            </form>
          ) : (
            <form onSubmit={(event) => void verifyCode(event)}>
              <label className="visually-hidden" htmlFor="code">{locale === "ja" ? "6桁のコード" : "Six-digit code"}</label>
              <input id="code" className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={submitting} autoFocus />
              <button className="primary-button full-width" type="submit" disabled={submitting}>{submitting ? t.checkingCode : t.verifyCode}<span aria-hidden="true">→</span></button>
              <button type="button" className="link-button auth-back" disabled={submitting} onClick={() => { setStep("email"); setCode(""); setError(""); }}>{t.changeEmail}</button>
            </form>
          ))}

          {step === "code" && <p className="auth-help">{t.codeExpiry}<br />{t.checkSpam}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div className="auth-alternatives">
            <a href="/privacy">{locale === "ja" ? "プライバシー" : "Privacy"}</a>
            <a href="/">{t.returnHome}</a>
          </div>
        </div>
      </main>
      <footer className="auth-release-footer"><ReleaseVersion /></footer>
    </div>
  );
}

function LanguageSwitch({ locale, setLanguage }: { locale: "en" | "ja"; setLanguage: (locale: "en" | "ja") => void }) {
  return <div className="language-switch" role="group" aria-label={locale === "ja" ? "言語" : "Language"}><button aria-pressed={locale === "en"} className={locale === "en" ? "selected" : ""} onClick={() => setLanguage("en")}>EN</button><span aria-hidden="true">|</span><button aria-pressed={locale === "ja"} className={locale === "ja" ? "selected" : ""} onClick={() => setLanguage("ja")}>日本語</button></div>;
}
