import { describe, it, expect } from "vitest";
import {
  EventStepDataSchema,
  EventStepSchema,
  type EventStep,
} from "../index";

const step = (over: Partial<EventStep>): EventStep => ({
  step: "claimed",
  createdAt: "2026-01-01T00:00:00.000Z",
  data: null,
  ...over,
});

describe("EventStepDataSchema", () => {
  it("accepts both payload shapes and null", () => {
    expect(
      EventStepDataSchema.safeParse({ at: 1, updateDate: 2, containers: [] }).success,
    ).toBe(true);
    expect(EventStepDataSchema.safeParse({ message: "boom" }).success).toBe(true);
    expect(EventStepDataSchema.safeParse(null).success).toBe(true);
  });

  it("rejects unknown shapes (the response gate must stay strict)", () => {
    expect(EventStepDataSchema.safeParse({ anything: true }).success).toBe(false);
  });
});

describe("EventStepSchema", () => {
  it("normalizes Date and ISO-string timestamps alike", () => {
    const from = EventStepSchema.parse(step({}));
    const fromString = EventStepSchema.parse({
      step: "claimed",
      createdAt: "2026-01-01T00:00:00.000Z",
      data: null,
    });
    expect(from.createdAt).toBe(fromString.createdAt);
  });
});
