import { useState, useCallback, useEffect } from "react";

const GUEST_KEY = "copilot-guest";

/** Whether the current visitor is a guest. Persisted in the browser. */
export function useGuest() {
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(GUEST_KEY) === "1";
    } catch {
      return false;
    }
  });

  const enterGuest = useCallback(() => {
    try {
      sessionStorage.setItem(GUEST_KEY, "1");
    } catch {
      /* ignore */
    }
    setIsGuest(true);
  }, []);

  const leaveGuest = useCallback(() => {
    try {
      sessionStorage.removeItem(GUEST_KEY);
    } catch {
      /* ignore */
    }
    setIsGuest(false);
  }, []);

  // ?guest=1 enters as guest straight away.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("guest") === "1") {
      enterGuest();
    }
  }, [enterGuest]);

  return { isGuest, enterGuest, leaveGuest };
}
