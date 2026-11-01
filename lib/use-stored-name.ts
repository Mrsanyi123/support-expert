"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "reviewer";
const EVENT = "stored-name-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Reviewer name persisted in localStorage until real auth exists. */
export function useStoredName(fallback: string) {
  const stored = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(KEY),
    () => null,
  );
  const setName = useCallback((name: string) => {
    window.localStorage.setItem(KEY, name);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [stored ?? fallback, setName] as const;
}
