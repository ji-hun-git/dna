import type { HealthEvent } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";
import styles from "@/components/my-data/MyData.module.css";

/** First-level detail only: item, date, value. Source and history live in the drawer. */
export function CellTooltip({ event, x, y }: { event: HealthEvent; x: number; y: number }) {
  return (
    <div role="tooltip" id={`cell-tip-${event.eventId}`} className={styles.tooltip} style={{ left: `${x}%`, top: y }}>
      <strong>{event.concept}</strong>
      <span>{event.value} {event.unit}</span>
      <span>{formatKoreanDate(event.observedOn)}</span>
    </div>
  );
}
