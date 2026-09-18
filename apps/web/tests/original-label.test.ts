import { expect, it } from "vitest";
import { ORIGINAL_LABEL_NOT_KEPT, originalLabelLine } from "@/lib/format/original-label";

it("prints the result-sheet label only when it differs from the shown name", () => {
  expect(originalLabelLine("Cholesterol", "총콜레스테롤")).toBe("결과지 표기: Cholesterol");
  expect(originalLabelLine("공복 혈당", "공복혈당")).toBe("결과지 표기: 공복 혈당");
  expect(originalLabelLine("혈당", "혈당")).toBeNull();
  expect(originalLabelLine(" 혈당 ", "혈당")).toBeNull();
  expect(originalLabelLine(undefined, "혈당")).toBeNull();
  expect(originalLabelLine(null, "혈당")).toBeNull();
  expect(ORIGINAL_LABEL_NOT_KEPT).toBe("이 기록은 결과지 표기를 보존하기 전에 저장됐어요.");
});
