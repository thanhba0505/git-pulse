"use client";

import React from "react";

interface PulsarWaveProps {
  activityCount: number; // commits count today
}

export function PulsarWave({ activityCount }: PulsarWaveProps) {
  // Activity level determines wave height and color intensity
  const isActive = activityCount > 0;
  const barCount = 18;

  return (
    <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-void-subtle/80 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)] backdrop-blur-md">
      <div className="flex items-center gap-0.5 h-4">
        {Array.from({ length: barCount }).map((_, i) => {
          // Calculate sinusoidal height variation
          const baseHeight = Math.sin((i / barCount) * Math.PI) * 100;
          const height = isActive
            ? Math.max(
                20,
                Math.min(
                  100,
                  baseHeight * (1 + Math.min(activityCount, 15) * 0.05),
                ),
              )
            : 20;

          const delay = `${(i * 0.08).toFixed(2)}s`;
          const duration = isActive
            ? `${Math.max(0.8, 2 - activityCount * 0.08)}s`
            : "2.5s";

          return (
            <span
              key={i}
              className={`w-0.5 rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-gradient-to-t from-pulsar-cyan to-pulsar-emerald shadow-[0_0_6px_rgba(6,182,212,0.8)] animate-pulse"
                  : "bg-slate-700"
              }`}
              style={{
                height: `${height}%`,
                animationDelay: delay,
                animationDuration: duration,
              }}
            />
          );
        })}
      </div>
      <span className="text-xs font-mono font-medium tracking-wider text-cyan-300 pl-1.5">
        {activityCount > 0 ? `${activityCount} PULSES` : "ORBIT IDLE"}
      </span>
    </div>
  );
}
