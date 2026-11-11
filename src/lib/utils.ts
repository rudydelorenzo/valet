import {
  DEPLOY_STEP,
  EVENT_STEPS,
  INFLIGHT_STATE,
  TERMINAL_STATE,
  type EventState,
  type EventStepName,
} from "@/lib/constants";

export { cn } from "cn";

// ── Step ↔ state mapping ──────────────────────────────────────────
//
// The map is the single source of the mapping (terminal steps map to
// themselves; the real information is how the in-flight steps split
// between queued and running). The two functions are the API.

const STEP_STATE: Record<EventStepName, EventState> = {
  [DEPLOY_STEP.CREATED]: INFLIGHT_STATE.QUEUED,
  [DEPLOY_STEP.QUEUED]: INFLIGHT_STATE.QUEUED,
  [DEPLOY_STEP.CLAIMED]: INFLIGHT_STATE.RUNNING,
  [DEPLOY_STEP.FETCHING]: INFLIGHT_STATE.RUNNING,
  [DEPLOY_STEP.DEPLOYING]: INFLIGHT_STATE.RUNNING,
  [DEPLOY_STEP.VERIFYING]: INFLIGHT_STATE.RUNNING,
  [TERMINAL_STATE.SUCCESS]: TERMINAL_STATE.SUCCESS,
  [TERMINAL_STATE.ERROR]: TERMINAL_STATE.ERROR,
};

/** The lifecycle state a step belongs to. */
export const stateOfStep = (step: EventStepName): EventState => STEP_STATE[step];

/** Which steps belong to a state — the inverse of stateOfStep. */
export const stepsOfState = (state: EventState): EventStepName[] =>
  Object.values(EVENT_STEPS).filter((step) => STEP_STATE[step] === state);
