"use client";

import { useRef, useCallback, useEffect } from "react";

const CODE_LENGTH = 6;
const VALID_CHAR = /[^A-Za-z0-9]/g;

interface SetupCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
}

const CharBox = ({
  inputRef,
  char,
  onChange,
  onKeyDown,
  onPaste,
}: {
  inputRef: (el: HTMLInputElement | null) => void;
  char: string;
  onChange: (char: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
}) => {
  const elRef = useRef<HTMLInputElement | null>(null);

  // Replay pop animation on each character change
  useEffect(() => {
    const el = elRef.current;
    if (!el || !char) return;
    el.classList.remove("char-pop");
    void el.offsetWidth; // force reflow
    el.classList.add("char-pop");
  }, [char]);

  return (
    <input
      ref={(el) => {
        elRef.current = el;
        inputRef(el);
      }}
      type="text"
      inputMode="text"
      maxLength={1}
      autoComplete="off"
      spellCheck={false}
      value={char}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      className={`h-14 w-11 rounded-xl border bg-background text-center font-mono text-2xl font-semibold transition-colors focus:z-10 focus:border-primary focus:ring-2 focus:ring-primary/20 ${
        char
          ? "border-primary/30 text-foreground"
          : "border-input text-muted-foreground"
      }`}
    />
  );
};

export const SetupCodeInput = ({
  value,
  onChange,
  onComplete,
}: SetupCodeInputProps) => {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.split("");

  const focus = useCallback((i: number) => {
    inputs.current[i]?.focus();
    inputs.current[i]?.select();
  }, []);

  const handleChange = useCallback(
    (i: number, raw: string) => {
      const ch = raw.replace(VALID_CHAR, "").toUpperCase();
      if (!ch && raw !== "") return;

      const next = Object.assign(Array(CODE_LENGTH).fill(""), chars);
      next[i] = ch;
      const result = next.join("").slice(0, CODE_LENGTH);
      onChange(result);

      if (ch && i < CODE_LENGTH - 1) focus(i + 1);
      if (ch && i === CODE_LENGTH - 1 && !result.includes(""))
        onComplete?.(result);
    },
    [chars, onChange, focus, onComplete],
  );

  const handleKeyDown = useCallback(
    (i: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const next = [...chars];
        if (next[i]) {
          next[i] = "";
          onChange(next.join(""));
        } else if (i > 0) {
          next[i - 1] = "";
          onChange(next.join(""));
          focus(i - 1);
        }
      } else if (e.key === "ArrowLeft" && i > 0) {
        e.preventDefault();
        focus(i - 1);
      } else if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) {
        e.preventDefault();
        focus(i + 1);
      }
    },
    [chars, onChange, focus],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData("text")
        .replace(VALID_CHAR, "")
        .toUpperCase()
        .slice(0, CODE_LENGTH);
      const next = (pasted + "".repeat(CODE_LENGTH)).slice(0, CODE_LENGTH);
      onChange(next);
      focus(Math.min(pasted.length, CODE_LENGTH - 1));
      if (pasted.length >= CODE_LENGTH) onComplete?.(next);
    },
    [onChange, focus, onComplete],
  );

  const box = (i: number, paste?: boolean) => (
    <CharBox
      key={i}
      inputRef={(el) => { inputs.current[i] = el; }}
      char={chars[i] ?? ""}
      onChange={(ch) => handleChange(i, ch)}
      onKeyDown={(e) => handleKeyDown(i, e)}
      onPaste={paste ? handlePaste : undefined}
    />
  );

  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex gap-2">
        {box(0, true)}
        {box(1)}
        {box(2)}
      </div>
      <span className="select-none text-lg text-muted-foreground/40">–</span>
      <div className="flex gap-2">
        {box(3)}
        {box(4)}
        {box(5)}
      </div>
    </div>
  );
};