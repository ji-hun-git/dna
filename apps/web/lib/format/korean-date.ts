const datePattern = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/;

export function formatKoreanDate(value: string) {
  const match = datePattern.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  return `${year}. ${Number(month)}. ${Number(day)}.`;
}

const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

// Server instants (ISO 8601 with a zone) are shown as Korean local time. The
// zone is fixed so the same record reads the same on every device and in tests.
const seoulParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatKoreanDateTime(value: string) {
  if (instantPattern.test(value)) {
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) return value;
    const part = Object.fromEntries(seoulParts.formatToParts(instant).map((item) => [item.type, item.value]));
    return `${part.year}. ${Number(part.month)}. ${Number(part.day)}. ${part.hour}:${part.minute}`;
  }
  const match = datePattern.exec(value);
  if (!match) return value;

  const [, year, month, day, hour, minute] = match;
  const date = `${year}. ${Number(month)}. ${Number(day)}.`;
  return hour && minute ? `${date} ${hour}:${minute}` : date;
}
