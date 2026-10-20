import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Layers, Loader, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStacks } from "@/hooks/use-stacks";
import type { Stack } from "../types";

const StackStep = ({
  instanceId,
  instanceName,
  onSelect,
  onBack,
}: {
  instanceId: string;
  instanceName: string;
  onSelect: (stack: Stack) => void;
  onBack: () => void;
}) => {
  const { stacks, loading, error } = useStacks(instanceId);
  const [selected, setSelected] = useState<Stack | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Select a stack on{" "}
        <span className="font-medium text-foreground">{instanceName}</span>.
      </p>

      <div className="grid h-[340px] gap-2 overflow-y-auto pr-1">
        {loading && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader className="size-4 animate-spin" />
            Loading stacks…
          </div>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && stacks.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            No stacks found on this instance.
          </p>
        )}

        {!loading &&
          stacks.length > 0 &&
          stacks.map((stack) => {
            const isSelected = selected?.Id === stack.Id;
            return (
              <button
                key={stack.Id}
                type="button"
                onClick={() => setSelected(stack)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer",
                  "active:scale-[0.98]",
                  isSelected
                    ? "border-primary/50 bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/30 hover:bg-muted/50",
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Layers className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{stack.Name}</div>
                  <div className="text-xs text-muted-foreground">
                    Stack #{stack.Id}
                    {stack.environmentName
                      ? ` · ${stack.environmentName}`
                      : ` · Environment #${stack.EndpointId}`}
                  </div>
                </div>
                {isSelected && (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          Next →
        </Button>
      </div>
    </div>
  );
};

export { StackStep };