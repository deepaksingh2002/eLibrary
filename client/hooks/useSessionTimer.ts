import { useState, useEffect, useRef } from "react";

export const useSessionTimer = () => {
  const startTime = useRef<Date>(new Date());
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    startTime.current = new Date();
    
    const interval = setInterval(() => {
      const diff = (Date.now() - startTime.current.getTime()) / 60000;
      setElapsedMinutes(Math.floor(diff));
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const getSessionMinutes = () => {
    return Math.floor((Date.now() - startTime.current.getTime()) / 60000);
  };

  return { elapsedMinutes, getSessionMinutes, isActive: true };
};
