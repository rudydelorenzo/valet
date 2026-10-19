"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Event {
  id: string;
  status: string;
  message: string | null;
  triggerSource: string;
  createdAt: string;
}

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

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </div>
        <button
          type="button"
          onClick={() => setLive(!live)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
        >
          <span
            className={`inline-block size-1.5 rounded-full ${live ? "bg-green-500" : "bg-muted-foreground/40"}`}
          />
          {live ? "Live" : "Paused"}
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((evt) => (
              <TableRow key={evt.id}>
                <TableCell className="font-mono text-xs">{evt.id}</TableCell>
                <TableCell>{evt.triggerSource}</TableCell>
                <TableCell>
                  <StatusBadge status={evt.status} />
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {evt.message ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(evt.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
};

export { EventLog };
export type { Event };