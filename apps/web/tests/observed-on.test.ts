import { expect, it } from "vitest";
import { isCorrectableObservedOn, localIsoDate } from "@/lib/format/observed-on";

it("formats the local calendar date, not the UTC one", () => {
  expect(localIsoDate(new Date(2026, 8, 17, 0, 30))).toBe("2026-09-17");
  expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
});

it("accepts only a real calendar date between 1900-01-01 and today", () => {
  const today = "2026-09-17";
  expect(isCorrectableObservedOn("2026-07-27", today)).toBe(true);
  expect(isCorrectableObservedOn("1900-01-01", today)).toBe(true);
  expect(isCorrectableObservedOn(today, today)).toBe(true);
  expect(isCorrectableObservedOn("2026-09-18", today)).toBe(false);
  expect(isCorrectableObservedOn("1899-12-31", today)).toBe(false);
  expect(isCorrectableObservedOn("2026-02-30", today)).toBe(false);
  expect(isCorrectableObservedOn("27-07-2026", today)).toBe(false);
  expect(isCorrectableObservedOn("", today)).toBe(false);
});
