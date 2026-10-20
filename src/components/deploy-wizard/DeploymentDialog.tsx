"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InstanceStep } from "./steps/InstanceStep";
import { AddInstanceStep } from "./steps/AddInstanceStep";
import { StackStep } from "./steps/StackStep";
import { NameStep } from "./steps/NameStep";
import { SuccessStep } from "./steps/SuccessStep";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Instance, Stack, CreatedWebhook } from "@/lib/db/types";

// ── Step definitions ───────────────────────────────────────────────

const MAIN_STEPS = [
  { key: "instance", label: "Instance" },
  { key: "stack", label: "Stack" },
  { key: "name", label: "Name" },
  { key: "done", label: "Done" },
] as const;

type StepKey = (typeof MAIN_STEPS)[number]["key"] | "add-instance";

// Ordered list for determining slide direction
const STEP_ORDER: StepKey[] = [
  "instance",
  "add-instance",
  "stack",
  "name",
  "done",
];

// ── Props ──────────────────────────────────────────────────────────

interface DeploymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

// ── Component ──────────────────────────────────────────────────────

const DeploymentDialog = ({
  open,
  onOpenChange,
  onCreated,
}: DeploymentDialogProps) => {
  // State
  const [step, setStep] = useState<StepKey>("instance");
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(
    null,
  );
  const [selectedStack, setSelectedStack] = useState<Stack | null>(null);
  const [createdWebhook, setCreatedWebhook] = useState<CreatedWebhook | null>(
    null,
  );

  // Transition state
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [displayedStep, setDisplayedStep] = useState<StepKey>("instance");
  const [isSliding, setIsSliding] = useState(false);
  const [height, setHeight] = useState<number | "auto">("auto");
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Measure current content height
  const measure = useCallback(() => {
    if (containerRef.current) {
      return containerRef.current.scrollHeight;
    }
    return 0;
  }, []);

  // Navigate with slide + height transition
  const goTo = useCallback(
    (next: StepKey) => {
      // Lock current height
      const currentHeight = measure();
      setHeight(currentHeight);

      // Determine direction
      setStep((prev) => {
        const prevIdx = STEP_ORDER.indexOf(prev);
        const nextIdx = STEP_ORDER.indexOf(next);
        setDirection(nextIdx >= prevIdx ? "right" : "left");
        return next;
      });

      // Slide out
      setIsSliding(true);

      // After exit animation: swap content, measure new height, animate
      setTimeout(() => {
        setDisplayedStep(next);

        // Wait for DOM to paint the new content
        requestAnimationFrame(() => {
          const newHeight = measure();
          setHeight(newHeight);
          setIsSliding(false);

          // After height transition completes, switch to auto
          setTimeout(() => {
            if (!firstRender.current) {
              setHeight("auto");
            }
          }, 250);
        });
      }, 150);
    },
    [measure],
  );

  // Measure initial content on mount
  useEffect(() => {
    if (open && firstRender.current) {
      requestAnimationFrame(() => {
        const h = measure();
        if (h > 0) {
          setHeight(h);
          // Switch to auto after initial paint
          setTimeout(() => setHeight("auto"), 50);
        }
        firstRender.current = false;
      });
    }
  }, [open, measure]);

  // Fetch instances when dialog opens
  const loadInstances = useCallback(() => {
    fetch("/api/instances")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setInstances(data);
      });
  }, []);

  useEffect(() => {
    if (open) {
      loadInstances();
    }
  }, [open, loadInstances]);

  // Reset everything when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("instance");
      setDisplayedStep("instance");
      setSelectedInstance(null);
      setSelectedStack(null);
      setCreatedWebhook(null);
      setIsSliding(false);
      setHeight("auto");
      firstRender.current = true;
    }
  }, [open]);

  // Progress index (add-instance counts as being on instance step)
  const progressIndex =
    step === "add-instance"
      ? 0
      : MAIN_STEPS.findIndex((s) => s.key === step);

  // Handlers
  const handleSelectInstance = (instance: Instance) => {
    setSelectedInstance(instance);
    goTo("stack");
  };

  const handleAddNewInstance = () => {
    goTo("add-instance");
  };

  const handleInstanceCreated = (instance: Instance) => {
    setInstances((prev) => [instance, ...prev]);
    setSelectedInstance(instance);
    goTo("stack");
  };

  const handleSelectStack = (stack: Stack) => {
    setSelectedStack(stack);
    goTo("name");
  };

  const handleCreated = (webhook: CreatedWebhook) => {
    setCreatedWebhook(webhook);
    goTo("done");
  };

  const handleDone = () => {
    onOpenChange(false);
    onCreated?.();
  };

  // Render step content
  const renderStep = (s: StepKey) => {
    switch (s) {
      case "instance":
        return (
          <>
            <DialogHeader className="mb-4">
              <DialogTitle>Select an instance</DialogTitle>
            </DialogHeader>
            <InstanceStep
              instances={instances}
              onSelect={handleSelectInstance}
              onAddNew={handleAddNewInstance}
            />
          </>
        );
      case "add-instance":
        return (
          <>
            <DialogHeader className="mb-4">
              <DialogTitle>Connect a new instance</DialogTitle>
            </DialogHeader>
            <AddInstanceStep
              onDone={handleInstanceCreated}
              onBack={() => goTo("instance")}
            />
          </>
        );
      case "stack":
        return selectedInstance ? (
          <>
            <DialogHeader className="mb-4">
              <DialogTitle>Choose a stack</DialogTitle>
            </DialogHeader>
            <StackStep
              instanceId={selectedInstance.id}
              instanceName={selectedInstance.name}
              onSelect={handleSelectStack}
              onBack={() => goTo("instance")}
            />
          </>
        ) : null;
      case "name":
        return selectedStack && selectedInstance ? (
          <>
            <DialogHeader className="mb-4">
              <DialogTitle>Name your deployment hook</DialogTitle>
            </DialogHeader>
            <NameStep
              instanceId={selectedInstance.id}
              instanceName={selectedInstance.name}
              stack={selectedStack}
              onCreate={handleCreated}
              onBack={() => goTo("stack")}
            />
          </>
        ) : null;
      case "done":
        return createdWebhook ? (
          <>
            <DialogHeader className="mb-4">
              <DialogTitle>Your deployment hook is ready</DialogTitle>
            </DialogHeader>
            <SuccessStep
              webhookName={createdWebhook.name}
              token={createdWebhook.token}
              onDone={handleDone}
            />
          </>
        ) : null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={step !== "done"}
        className="sm:max-w-3xl overflow-hidden p-6"
      >
        <div className="flex gap-6 pt-2">
          {/* Sidebar roadmap */}
          <nav className="hidden w-40 shrink-0 flex-col gap-0.5 pt-1 sm:flex">
            {MAIN_STEPS.map((s, i) => {
              const isActive = s.key === step;
              const isCompleted = i < progressIndex;
              const isFuture = i > progressIndex;

              return (
                <div key={s.key} className="flex items-start gap-3">
                  {/* Connector + dot */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium transition-all duration-300",
                        isCompleted
                          ? "border-green-500 bg-green-500 text-white"
                          : isActive
                            ? "border-primary bg-primary text-primary-foreground shadow-[0_0_8px_oklch(from_var(--primary)_l_c_h_/_0.3)]"
                            : "border-muted-foreground/25 text-muted-foreground",
                      )}
                    >
                      {isCompleted ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : (
                        i + 1
                      )}
                    </div>
                    {i < MAIN_STEPS.length - 1 && (
                      <div
                        className={cn(
                          "w-px h-5 transition-colors duration-300",
                          isCompleted
                            ? "bg-green-500"
                            : "bg-muted-foreground/25",
                        )}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "pt-0.5 text-sm transition-colors duration-300",
                      isActive
                        ? "font-medium text-foreground"
                        : isCompleted
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </nav>

          {/* Content area with slide + height transitions */}
          <div
            className="min-w-0 flex-1 overflow-hidden p-1 transition-[height] duration-250 ease-out"
            style={{ height: height === "auto" ? undefined : `${height}px` }}
          >
            <div
              ref={containerRef}
              className={cn(
                "transition-all duration-150 ease-out",
                isSliding
                  ? direction === "right"
                    ? "-translate-x-4 opacity-0"
                    : "translate-x-4 opacity-0"
                  : "translate-x-0 opacity-100",
              )}
            >
              {renderStep(displayedStep)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { DeploymentDialog };