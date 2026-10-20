"use client";

import { useState, lazy, Suspense } from "react";
import Mustache from "mustache";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { getDeployUrl } from "@/lib/webhook-urls";
import { Terminal, GitBranch, Workflow, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Lazy-load the markdown renderer — only fetched when the dialog opens
const MarkdownContent = lazy(() => import("./MarkdownContent"));

// ── Raw markdown imports ───────────────────────────────────────────

import bashMd from "./templates/bash.md";
import githubActionsMd from "./templates/github-actions.md";
import circleciMd from "./templates/circleci.md";

// ── Template registry ──────────────────────────────────────────────

interface IntegrationTemplate {
  id: string;
  label: string;
  icon: LucideIcon;
  markdown: string;
}

const TEMPLATES: IntegrationTemplate[] = [
  { id: "bash", label: "Bash", icon: Terminal, markdown: bashMd },
  { id: "github-actions", label: "GitHub Actions", icon: GitBranch, markdown: githubActionsMd },
  { id: "circleci", label: "CircleCI", icon: Workflow, markdown: circleciMd },
];

// ── Props ──────────────────────────────────────────────────────────

interface DeployIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: { id: string; token: string; name: string };
  origin: string;
}

// ── Component ──────────────────────────────────────────────────────

const DeployIntegrationDialog = ({
  open,
  onOpenChange,
  webhook,
  origin,
}: DeployIntegrationDialogProps) => {
  const [activeId, setActiveId] = useState(TEMPLATES[0].id);
  const activeTemplate = TEMPLATES.find((t) => t.id === activeId) ?? TEMPLATES[0];

  const deployUrl = getDeployUrl(origin, webhook.token);
  const rendered = Mustache.render(activeTemplate.markdown, {
    deployUrl,
    webhookName: webhook.name,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-4xl max-h-[85vh] overflow-hidden p-0">
        {/* Inner scroll container — clips scrollbar to rounded corners */}
        <div className="max-h-[85vh] overflow-y-auto px-10 pt-8 pb-24">
          {/* Rendered markdown content (lazy loaded) */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Loading…
              </div>
            }
          >
            <MarkdownContent content={rendered} />
          </Suspense>
        </div>

        {/* Floating footer bar — template selector + close */}
        <div className="pointer-events-none absolute bottom-7 left-0 right-0 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border/50 bg-gradient-to-b from-popover to-popover/90 px-3.5 py-2.5 shadow-[0_4px_12px_oklch(0_0_0/0.1),0_1px_3px_oklch(0_0_0/0.08)] backdrop-blur-sm">
          <div className="flex gap-0.5 rounded-full bg-muted p-0.5">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              const isActive = t.id === activeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="h-4 w-px bg-border" />
          <DialogClose
            render={
              <Button variant="ghost" size="icon-xs" className="rounded-full" />
            }
          >
            ✕
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { DeployIntegrationDialog };
export type { IntegrationTemplate };