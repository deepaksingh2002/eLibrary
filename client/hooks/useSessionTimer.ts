import { useState, useEffect, useRef } from "react";

export const useSessionTimer = () => {
  const startTime = useRef<Date>(new Date());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startTime.current = new Date();
    
    const interval = setInterval(() => {
      const diffMs = Date.now() - startTime.current.getTime();
      const diffMins = Math.floor(diffMs / 60_000);
      setElapsed(diffMins);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getSessionMinutes = (): number => {
    const diffMs = Date.now() - startTime.current.getTime();
    return Math.floor(diffMs / 60_000);
  };

  return { elapsedMinutes: elapsed, getSessionMinutes };
};
