"use client";

import React from "react";
import type { ReviewDistribution } from "../types";

interface RatingDistributionChartProps {
  distribution: ReviewDistribution;
}

export const RatingDistributionChart: React.FC<RatingDistributionChartProps> = ({ distribution }) => {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-3">
        {distribution.distribution
          .slice()
          .reverse()
          .map(({ star, count }) => {
            const pct = distribution.total > 0 ? (count / distribution.total) * 100 : 0;

            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-8 text-right text-sm font-medium text-yellow-400">{star} ★</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded bg-gray-100">
                  <div
                    className="h-full rounded bg-yellow-400 transition-all duration-500 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-gray-500">{count}</span>
              </div>
            );
          })}
      </div>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <p className="text-3xl font-bold text-gray-900">{distribution.average} out of 5</p>
        <p className="mt-1 text-sm text-gray-500">{distribution.total} reviews</p>
      </div>
    </div>
  );
};
