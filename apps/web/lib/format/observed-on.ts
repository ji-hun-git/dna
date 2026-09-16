const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;

export const earliestCorrectableObservedOn = "1900-01-01";

/** The calendar date where the person is (device clock), as YYYY-MM-DD. */
export function localIsoDate(now: Date = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** A real calendar date the person may confirm as the exam date: 1900-01-01 .. today. */
export function isCorrectableObservedOn(value: string, today: string) {
  const match = isoDate.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const roundTrips = date.toISOString().slice(0, 10) === value;
  return roundTrips && value >= earliestCorrectableObservedOn && value <= today;
}
