"use client";

import React, { useState } from "react";
import { Button } from "./ui/Button";

interface GoalProgressWidgetProps {
  goal: number;
  booksCompletedThisMonth: number;
  percentage: number;
  isGoalSet: boolean;
  onGoalChange: (newGoal: number) => void;
}

export const GoalProgressWidget: React.FC<GoalProgressWidgetProps> = ({
  goal,
  booksCompletedThisMonth,
  percentage,
  isGoalSet,
  onGoalChange,
}) => {
  const [isEditing, setIsEditing] = useState(!isGoalSet);
  const [inputValue, setInputValue] = useState(goal || 1);

  const handleSave = () => {
    onGoalChange(inputValue);
    setIsEditing(false);
  };

  const handleRemove = () => {
    onGoalChange(0);
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
        {!isGoalSet && (
          <>
            <h3 className="font-medium text-gray-600 mb-2">Set a reading goal</h3>
            <p className="text-sm text-gray-400 mb-4">
              How many books do you want to read this month?
            </p>
          </>
        )}

        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <div className="flex flex-col text-left gap-1">
            <label className="text-sm font-medium text-gray-700">Books per month</label>
            <input
              type="number"
              min={1}
              max={100}
              value={inputValue}
              onChange={(e) => setInputValue(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={handleSave}>
              Save goal
            </Button>
            {isGoalSet && (
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
          
          {isGoalSet && (
            <button
              onClick={handleRemove}
              className="text-xs text-red-500 hover:text-red-700 mt-2 hover:underline"
            >
              Remove goal
            </button>
          )}
        </div>
      </div>
    );
  }

  const isAchieved = percentage >= 100;
  const barColorClass = isAchieved ? "bg-green-500" : "bg-blue-600";

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="font-medium text-gray-700">Monthly Goal</span>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
      </div>

      <div className="mb-2">
        <span className="font-bold text-xl text-blue-700">
          {booksCompletedThisMonth} / {goal} books
        </span>
      </div>

      <div className="w-full h-3 bg-blue-100 rounded-full mb-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-600 ease-out ${barColorClass}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-blue-600">{Math.round(percentage)}% complete</span>
        {isAchieved && (
          <span className="text-green-600 font-medium text-sm">🎉 Goal achieved!</span>
        )}
      </div>
    </div>
  );
};
