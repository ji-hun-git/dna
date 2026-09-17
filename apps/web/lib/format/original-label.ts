/** The sentence the evidence drawer shows for a record stored before the result-sheet label was kept. */
export const ORIGINAL_LABEL_NOT_KEPT = "이 기록은 결과지 표기를 보존하기 전에 저장됐어요.";

/**
 * "결과지 표기: <원문>" when the result sheet printed the item under another name than the one shown,
 * otherwise null. Document text only: no comparison of values, no meaning.
 */
export function originalLabelLine(originalLabel: string | null | undefined, shownLabel: string): string | null {
  if (!originalLabel) return null;
  return originalLabel.trim() === shownLabel.trim() ? null : `결과지 표기: ${originalLabel}`;
}
