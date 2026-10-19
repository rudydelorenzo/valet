"use client"

import * as React from "react"
import { cn } from "cn"
import { Check, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  description: string
  icon?: LucideIcon
  /** Optional highlight pill rendered next to the label (e.g. "Recommended"). */
  tag?: string
}

interface ChoiceCardsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: ChoiceOption<T>[]
  /** "horizontal" places cards side-by-side, "vertical" stacks them. */
  orientation?: "horizontal" | "vertical"
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

/**
 * A radio group rendered as selectable cards: icon, label, and a description
 * explaining what each option does. Arrow keys move between options,
 * Enter/Space selects.
 */
function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  orientation = "horizontal",
  disabled = false,
  className,
  ...rest
}: ChoiceCardsProps<T>) {
  const groupRef = React.useRef<HTMLDivElement>(null)

  const move = (delta: number) => {
    const buttons = Array.from(
      groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [],
    )
    const current = buttons.findIndex(
      (b) => b.getAttribute("aria-checked") === "true",
    )
    const next = buttons[(current + delta + buttons.length) % buttons.length]
    if (next) {
      next.focus()
      next.click()
    }
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      className={cn(
        "grid gap-2",
        orientation === "horizontal" && "sm:grid-cols-2",
        className,
      )}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault()
          move(1)
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault()
          move(-1)
        }
      }}
      {...rest}
    >
      {options.map((option) => {
        const selected = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all duration-200 outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary/50 bg-primary/5 shadow-sm"
                : "border-border bg-background hover:border-primary/30 hover:bg-muted/50",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                selected
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {Icon && <Icon className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">{option.label}</span>
                {option.tag && (
                  <Badge className="h-4 gap-0.5 bg-primary/10 px-1.5 text-[10px] text-primary dark:bg-primary/20">
                    {option.tag}
                  </Badge>
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {option.description}
              </span>
            </span>
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                selected
                  ? "scale-100 bg-primary text-primary-foreground opacity-100"
                  : "scale-90 border border-input bg-background opacity-60",
              )}
            >
              {selected && (
                <Check
                  className="size-2.5 animate-in zoom-in duration-200"
                  strokeWidth={3.5}
                />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export { ChoiceCards }
