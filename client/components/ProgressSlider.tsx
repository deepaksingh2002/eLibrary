"use client";

import React, { useState, useEffect } from "react";
import { useReadingProgress } from "../hooks/useReadingProgress";
import { useSessionTimer } from "../hooks/useSessionTimer";
import { useAuthStore } from "../store/authStore";
import { Badge } from "./ui/Badge";
import { Spinner } from "./ui/Spinner";

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
  const { progress, updateProgress } = useReadingProgress(bookId);
  const { elapsedMinutes, getSessionMinutes } = useSessionTimer();

  const [sliderValue, setSliderValue] = useState(initialProgress);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    console.log("[ProgressSlider] Progress data updated:", progress);
    if (progress && progress.progress !== sliderValue) {
      console.log("[ProgressSlider] Updating slider from", sliderValue, "to", progress.progress);
      setSliderValue(progress.progress);
    }
  }, [progress?.progress]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSliderValue(val);
    if (onProgressChange) onProgressChange(val);
  };

  const handleRelease = () => {
    console.log("[ProgressSlider] Progress changed to:", sliderValue);
    updateProgress(sliderValue, getSessionMinutes());
    if (sliderValue === 100 && progress?.status !== "completed") {
      setShowConfetti(true);
    }
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

  if (progress === undefined || progress === null) {
    return (
      <div className="w-full py-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium text-gray-700">Reading Progress</span>
          <Spinner size="sm" />
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full animate-pulse">
          <div
            className="h-2 bg-blue-600 rounded-full"
            style={{ width: `${sliderValue}%` }}
          />
        </div>
      </div>
    );
  }

  const getStatusBadge = () => {
    if (sliderValue === 0) return <Badge variant="default">Not started</Badge>;
    if (sliderValue === 100) return <Badge variant="success">Completed ✓</Badge>;
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
        className="w-full accent-blue-600 h-2 cursor-pointer"
      />

      <div className="flex justify-between items-center mt-2">
        <div>{getStatusBadge()}</div>
        {elapsedMinutes > 0 && (
          <span className="text-xs text-gray-400">
            Reading for {elapsedMinutes} min
          </span>
        )}
      </div>

      {showConfetti && sliderValue === 100 && (
        <div className="mt-2 animate-fade-in transition-opacity duration-500">
          <span className="text-green-600 font-medium">
            🎉 You&apos;ve finished this book!
          </span>
        </div>
      )}
    </div>
  );
};
