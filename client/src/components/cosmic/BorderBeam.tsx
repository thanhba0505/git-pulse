"use client";

import React from "react";

interface BorderBeamProps {
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
}

export function BorderBeam({
  duration = 4,
  colorFrom = "#06b6d4",
  colorTo = "#8b5cf6",
  className = "",
}: BorderBeamProps) {
  return (
    <div
      aria-hidden="true"
      style={
        {
          "--duration": `${duration}s`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as React.CSSProperties
      }
      className={`pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-0 rounded-[inherit] bg-[conic-gradient(from_var(--beam-angle),transparent_0deg,transparent_270deg,var(--color-from)_320deg,var(--color-to)_360deg)] animate-border-beam"
        style={{
          padding: "1px",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
    </div>
  );
}
