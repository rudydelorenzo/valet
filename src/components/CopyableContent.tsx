"use client";

import { useState, useRef } from "react";
import { Copy } from "lucide-react";

interface CopyableContentProps {
  label: string;
  value: string;
}

const COPY_TEXT_LINGER_SECONDS = 1.5

export const CopyableContent = ({ label, value }: CopyableContentProps) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    if (copied) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), COPY_TEXT_LINGER_SECONDS * 1000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group mb-4 flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted/80"
    >
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {label}
        </p>
        <div className="relative">
          <code
            className={`text-sm break-all transition-opacity duration-300 ${
              copied ? "opacity-0" : "opacity-100"
            }`}
          >
            {value}
          </code>
          <code
            className={`absolute inset-0 text-sm transition-opacity duration-300 ${
              copied ? "opacity-75" : "opacity-0"
            }`}
          >
            Copied!
          </code>
        </div>
      </div>
      <Copy className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
    </button>
  );
}