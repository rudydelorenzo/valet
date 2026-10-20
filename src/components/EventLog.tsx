"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { LiveToggle } from "@/components/LiveToggle";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Event } from "@/types";

interface EventLogProps {
  /** URL to GET events from. Must return a JSON array. */
  fetchUrl: string;
  /** Max rows to display. */
  limit?: number;
  /** Whether to enable live polling by default. */
  live?: boolean;
}

const EventLog = ({ fetchUrl, limit = 100, live: initialLive = false }: EventLogProps) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [live, setLive] = useState(initialLive);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch(fetchUrl)
      .then((r) => (r.ok ? r.json() : []))
      .then((ev) => {
        if (Array.isArray(ev)) setEvents(ev.slice(0, limit));
      });
  }, [fetchUrl, limit]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll when live mode is on and there are active events
  useEffect(() => {
    if (!live) return;

    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [live, events, refresh]);

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </div>
        <LiveToggle live={live} onToggle={() => setLive(!live)} />
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {events.map((evt) => {
            const isOpen = expanded === evt.id;

            return (
              <div key={evt.id}>
                {/* Collapsed row */}
                <button
                  type="button"
                  onClick={() => toggle(evt.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 cursor-pointer"
                >
                  <ChevronRight
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-90",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium capitalize">
                      {evt.type}
                    </span>
                    {evt.webhookName && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {evt.webhookName}
                      </span>
                    )}
                    {evt.instanceName && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        on {evt.instanceName}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={evt.status} />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(evt.createdAt).toLocaleString()}
                  </span>
                </button>

                {/* Expanded details */}
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t bg-muted/30 px-3 py-3">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                        <dt className="text-muted-foreground">ID</dt>
                        <dd className="font-mono text-xs">{evt.id}</dd>

                        <dt className="text-muted-foreground">Source</dt>
                        <dd>{evt.triggerSource}</dd>

                        {evt.message && (
                          <>
                            <dt className="text-muted-foreground">Message</dt>
                            <dd className="break-all">{evt.message}</dd>
                          </>
                        )}

                        <dt className="text-muted-foreground">Time</dt>
                        <dd>{new Date(evt.createdAt).toLocaleString()}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export { EventLog };