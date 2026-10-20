/** Full URL to trigger a deploy. */
export function getDeployUrl(origin: string, token: string): string {
  return `${origin}/api/deploy/${token}`;
}

/** URL to poll the CLI-friendly status of a deploy event. */
export function getStatusUrl(
  origin: string,
  token: string,
  eventId: string,
): string {
  return `${origin}/api/deploy/${token}/status/${eventId}`;
}

/** URL to fetch the full event details. */
export function getEventUrl(
  origin: string,
  token: string,
  eventId: string,
): string {
  return `${origin}/api/deploy/${token}/events/${eventId}`;
}