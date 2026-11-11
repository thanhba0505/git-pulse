"use client";

import React from "react";

interface RadarSonarHUDProps {
  isScanning?: boolean;
  blipCount?: number;
  className?: string;
}

export function RadarSonarHUD({
  isScanning = false,
  blipCount = 0,
  className = "",
}: RadarSonarHUDProps) {
  return (
    <div
      className={`relative flex items-center justify-center p-6 ${className}`}
      aria-hidden="true"
    >
      {/* Outer Radar Bezel */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full border border-cyan-500/30 bg-void-subtle/80 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex items-center justify-center overflow-hidden">
        {/* Concentric Distance Rings */}
        <div className="absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full border border-cyan-500/20" />
        <div className="absolute w-32 h-32 sm:w-36 sm:h-36 rounded-full border border-cyan-500/25" />
        <div className="absolute w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-cyan-500/35" />

        {/* Crosshair Axes */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-500/20" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-500/20" />

        {/* 45-degree diagonal grid lines */}
        <div className="absolute inset-x-4 top-1/2 h-px bg-cyan-500/10 rotate-45" />
        <div className="absolute inset-x-4 top-1/2 h-px bg-cyan-500/10 -rotate-45" />

        {/* Rotating Sonar Sweep Cone */}
        <div
          className={`absolute inset-0 rounded-full ${
            isScanning
              ? "animate-radar-sweep"
              : "animate-radar-sweep opacity-75"
          }`}
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(6, 182, 212, 0.05) 310deg, rgba(34, 211, 238, 0.4) 360deg)",
          }}
        />

        {/* Center Pulsar Core */}
        <div className="relative z-10 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)] animate-ping" />
        <div className="absolute z-10 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />

        {/* Dynamic Blips (Orbits detected) */}
        {blipCount > 0 ? (
          <>
            <span
              className="absolute w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse"
              style={{ top: "35%", left: "68%" }}
            />
            <span
              className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse"
              style={{ top: "62%", left: "28%" }}
            />
            <span
              className="absolute w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_10px_#a78bfa] animate-pulse"
              style={{ top: "25%", left: "38%" }}
            />
          </>
        ) : (
          <span
            className="absolute w-2 h-2 rounded-full bg-cyan-400/60 shadow-[0_0_8px_rgba(6,182,212,0.5)] animate-pulse"
            style={{ top: "30%", left: "65%" }}
          />
        )}

        {/* Compass / Telemetry labels */}
        <span className="absolute top-2 text-xs font-mono font-bold text-cyan-400/70 select-none">
          000° N
        </span>
        <span className="absolute bottom-2 text-xs font-mono font-bold text-cyan-400/70 select-none">
          180° S
        </span>
        <span className="absolute left-2 text-xs font-mono font-bold text-cyan-400/70 select-none">
          270° W
        </span>
        <span className="absolute right-2 text-xs font-mono font-bold text-cyan-400/70 select-none">
          090° E
        </span>
      </div>
    </div>
  );
}
