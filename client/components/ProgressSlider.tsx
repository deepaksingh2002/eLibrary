"use client";

import React, { useState, useEffect, useRef } from "react";
import { useReadingProgress } from "../hooks/useReadingProgress";
import { useSessionTimer } from "../hooks/useSessionTimer";
import { useAuthStore } from "../store/authStore";
import { Badge } from "./ui/Badge";

interface ProgressSliderProps {
  bookId: string;
  initialProgress: number;
  onProgressChange?: (value: number) => void;
}

export const ProgressSlider: React.FC<ProgressSliderProps> = ({
  bookId,
  initialProgress,
  onProgressChange,
}) => {
  const { user, isAuthenticated } = useAuthStore();
  const { currentValue, updateProgress, isUpdating } = useReadingProgress(bookId);
  const { elapsedMinutes, getSessionMinutes } = useSessionTimer();

  const [sliderValue, setSliderValue] = useState(initialProgress);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevValue = useRef(initialProgress);

  useEffect(() => {
    setSliderValue(initialProgress);
  }, [initialProgress]);

  useEffect(() => {
    setSliderValue(currentValue);
    prevValue.current = currentValue;
  }, [currentValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setSliderValue(value);
    onProgressChange?.(value);
  };

  const handleRelease = () => {
    const sessionMins = getSessionMinutes();

    if (sliderValue === 100 && prevValue.current < 100) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 4000);
    }

    prevValue.current = sliderValue;
    updateProgress(sliderValue, sessionMins);
  };

  if (!user || !isAuthenticated) {
    return (
      <div className="w-full py-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium text-gray-700">Reading Progress</span>
          <span className="font-bold text-blue-600">{sliderValue}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-blue-600 rounded-full"
            style={{ width: `${sliderValue}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">Log in to track your progress</p>
      </div>
    );
  }

  const getStatusBadge = () => {
    if (sliderValue === 0) return <Badge variant="default">Not started</Badge>;
    if (sliderValue === 100) return <Badge variant="success">Completed</Badge>;
    return <Badge variant="info">In progress</Badge>;
  };

  return (
    <div className="w-full py-4">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-gray-700">Reading Progress</span>
        <span className="font-bold text-blue-600">{sliderValue}%</span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={sliderValue}
        onChange={handleChange}
        onMouseUp={handleRelease}
        onTouchEnd={handleRelease}
        disabled={isUpdating}
        className="w-full accent-blue-600 h-2 cursor-pointer"
      />

      <div className="flex justify-between items-center mt-2">
        <div>{getStatusBadge()}</div>
        {isUpdating ? (
          <span className="text-xs text-gray-400 animate-pulse">Saving...</span>
        ) : elapsedMinutes > 0 ? (
          <span className="text-xs text-gray-400">
            Reading for {elapsedMinutes} min
          </span>
        ) : null}
      </div>

      {showCelebration && sliderValue === 100 && (
        <div className="mt-2 animate-fade-in transition-opacity duration-500">
          <span className="text-green-600 font-medium">
            You finished this book!
          </span>
        </div>
      )}
    </div>
  );
};

export default ProgressSlider;
