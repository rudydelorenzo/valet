"use client";

import { useEffect, useState } from "react";

const LiveToggle = ({
  live: controlledLive,
  onToggle,
}: {
  live: boolean;
  onToggle: () => void;
}) => {
  const [prevLive, setPrevLive] = useState(controlledLive);
  const [ping, setPing] = useState(false);
  const [pingNonce, setPingNonce] = useState(0);

  // Detect the toggle and trigger the ping ring by adjusting state
  // during render (React's sanctioned pattern for prop-derived state).
  if (controlledLive !== prevLive) {
    setPrevLive(controlledLive);
    setPing(true);
    setPingNonce((n) => n + 1);
  }

  // Clear the ping ring after the animation; restarts on every toggle
  // because pingNonce changes.
  useEffect(() => {
    if (!ping) return;
    const timeout = setTimeout(() => setPing(false), 400);
    return () => clearTimeout(timeout);
  }, [ping, pingNonce]);

  return (
    <button
      type="button"
      onClick={onToggle}
      className="group/toggle flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
    >
      <span className="relative flex size-3 items-center justify-center">
        {/* Outer ping ring on toggle */}
        <span
          className={`absolute size-3 rounded-full transition-all duration-300 ${
            controlledLive
              ? "bg-green-500/30"
              : "bg-transparent"
          } ${ping ? "scale-[2.5] opacity-0" : "scale-100 opacity-100"}`}
          style={{ transition: ping ? "transform 400ms ease-out, opacity 400ms ease-out" : "transform 200ms, opacity 200ms" }}
        />
        {/* Dot */}
        <span
          className={`block size-1.5 rounded-full transition-colors duration-300 ${
            controlledLive ? "bg-green-500" : "bg-muted-foreground/40"
          }`}
        />
      </span>
      {/* Label with crossfade */}
      <span className="relative inline-flex h-4 w-12 items-center overflow-hidden">
        <span
          className={`absolute transition-all duration-200 ${
            controlledLive
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-3"
          }`}
        >
          Live
        </span>
        <span
          className={`absolute transition-all duration-200 ${
            controlledLive
              ? "opacity-0 translate-y-3"
              : "opacity-100 translate-y-0"
          }`}
        >
          Paused
        </span>
      </span>
    </button>
  );
};

export { LiveToggle };
