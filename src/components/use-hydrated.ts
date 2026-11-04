"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** İstemcide hidrasyon tamamlandı mı? (localStorage tabanlı durumda SSR uyuşmazlığını önler) */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
