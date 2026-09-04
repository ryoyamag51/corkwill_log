"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import type { Locale } from "./types";

const localeStorageKey = "zenlenz-log-locale";
const localeChangeEvent = "corkwill-locale-change";

function localeSnapshot(): Locale {
  const saved = window.localStorage.getItem(localeStorageKey);
  return saved === "ja" ? "ja" : "en";
}

function subscribeToLocale(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(localeChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(localeChangeEvent, callback);
  };
}

export function usePersistedLocale(): [Locale, (locale: Locale) => void] {
  const locale = useSyncExternalStore(subscribeToLocale, localeSnapshot, (): Locale => "en");
  const setLocale = useCallback((next: Locale) => {
    window.localStorage.setItem(localeStorageKey, next);
    window.dispatchEvent(new Event(localeChangeEvent));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return [locale, setLocale];
}
