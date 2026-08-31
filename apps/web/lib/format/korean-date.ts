const datePattern = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/;

export function formatKoreanDate(value: string) {
  const match = datePattern.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  return `${year}. ${Number(month)}. ${Number(day)}.`;
}

export function formatKoreanDateTime(value: string) {
  const match = datePattern.exec(value);
  if (!match) return value;

  const [, year, month, day, hour, minute] = match;
  const date = `${year}. ${Number(month)}. ${Number(day)}.`;
  return hour && minute ? `${date} ${hour}:${minute}` : date;
}
