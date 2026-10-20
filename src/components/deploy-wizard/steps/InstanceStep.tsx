import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InstanceIcon } from "@/components/instance-icon";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Instance } from "../types";

const InstanceStep = ({
  instances,
  onSelect,
  onAddNew,
}: {
  instances: Instance[];
  onSelect: (instance: Instance) => void;
  onAddNew: () => void;
}) => {
  const [selected, setSelected] = useState<Instance | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Choose the Portainer instance where your stack lives.
      </p>

      <div className="grid gap-2">
        {instances.map((inst) => {
          const isSelected = selected?.id === inst.id;
          return (
            <button
              key={inst.id}
              type="button"
              onClick={() => setSelected(inst)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer active:scale-[0.98]",
                isSelected
                  ? "border-primary/50 bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/30 hover:bg-muted/50",
              )}
            >
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                <InstanceIcon id={inst.id} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{inst.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {inst.url}
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

        <button
          type="button"
          onClick={onAddNew}
          className="flex items-center gap-3 rounded-xl border border-dashed border-muted-foreground/25 p-3 text-left transition-all duration-150 cursor-pointer hover:border-primary/30 hover:bg-muted/50 active:scale-[0.98]"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/25">
            <Plus className="size-4 text-muted-foreground" />
          </div>
          <div className="text-sm text-muted-foreground">
            Connect a new instance
          </div>
        </button>
      </div>

      <div className="flex justify-end">
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

export { InstanceStep };