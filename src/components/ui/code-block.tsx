"use client";

import { useState, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

const COPY_TEXT_LINGER_MS = 1500;

/**
 * Code block with syntax highlighting, language label, and copy button.
 */
const CodeBlock = ({ code, language, className }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    if (copied) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), COPY_TEXT_LINGER_MS);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-muted/50",
        className,
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b px-4 py-1.5">
        {language ? (
          <span className="text-xs font-medium text-muted-foreground">
            {language}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Highlighted code */}
      <SyntaxHighlighter
        language={language || "text"}
        style={oneLight}
        customStyle={{
          margin: 0,
          padding: "0.75rem 1rem",
          background: "transparent",
          fontSize: "0.875rem",
          lineHeight: "1.625",
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

export { CodeBlock };