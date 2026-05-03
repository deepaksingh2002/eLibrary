"use client";

import React from "react";

type StarSize = "sm" | "md" | "lg";

interface DisplayStarRatingProps {
  rating: number;
  size?: StarSize;
  readOnly: true;
}

interface InputStarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  size?: StarSize;
  readOnly?: false;
}

type StarRatingProps = DisplayStarRatingProps | InputStarRatingProps;

const sizeMap: Record<StarSize, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
};

const labels: Record<number, string> = {
  1: "1 – Poor",
  2: "2 – Fair",
  3: "3 – Good",
  4: "4 – Very Good",
  5: "5 – Excellent",
};

export const StarRating: React.FC<StarRatingProps> = (props) => {
  const size = props.size ?? "md";
  const starClassName = sizeMap[size];
  const [hoverValue, setHoverValue] = React.useState(0);

  if (props.readOnly) {
    const roundedRating = Math.max(0, Math.min(5, Math.round(props.rating)));

    return (
      <div className={`inline-flex items-center gap-0.5 ${starClassName}`} aria-label={`${roundedRating} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => {
          const filled = index < roundedRating;
          return (
            <span key={index} className={filled ? "text-yellow-400" : "text-gray-300"}>
              {filled ? "★" : "☆"}
            </span>
          );
        })}
      </div>
    );
  }

  const activeValue = hoverValue || props.value;

  return (
    <div onMouseLeave={() => setHoverValue(0)}>
      <div className={`inline-flex items-center gap-1 ${starClassName}`}>
        {Array.from({ length: 5 }, (_, index) => {
          const starValue = index + 1;
          const filled = starValue <= activeValue;
          return (
            <button
              key={starValue}
              type="button"
              className={`transition-transform hover:scale-110 ${filled ? "text-yellow-400" : "text-gray-300"} cursor-pointer`}
              onMouseEnter={() => setHoverValue(starValue)}
              onClick={() => props.onChange(starValue)}
              aria-label={`Rate ${starValue} star${starValue > 1 ? "s" : ""}`}
            >
              {filled ? "★" : "☆"}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-gray-600">{labels[activeValue] ?? "Select a rating"}</p>
    </div>
  );
};
