import type { HealthEvent } from "@/lib/foundation/client";

function normalise(text: string) {
  return text.normalize("NFC").trim().toLocaleLowerCase("ko");
}

/**
 * Exact search only. A query is a concept name; it either names events or it
 * names none. There is no fuzzy match and no natural-language path in this wave.
 */
export function searchEvents(events: HealthEvent[], query: string) {
  const needle = normalise(query);
  if (!needle) return { matchedIds: null, count: events.length };
  const matchedIds = new Set(events.filter((event) => normalise(event.concept) === needle).map((event) => event.eventId));
  return { matchedIds, count: matchedIds.size };
}
