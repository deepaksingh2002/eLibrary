"use client";

import { useEffect, useState } from "react";

/**
 * Custom hook to manage hydration state
 * Ensures client-side code doesn't run during SSR
 */
export function useHydration() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}
