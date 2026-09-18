import { expect, it } from "vitest";
import { abstentionReasonLabels, describeAbstention, documentDateConflictLabel } from "@/lib/format/status-labels";
import { syntheticAbstentions } from "./fixtures/foundation";

it("names the document-level date conflict in Korean and keeps the reason map for every other row", () => {
  expect(documentDateConflictLabel).toBe("검사일이 둘 이상이라 확실하지 않음");
  expect(describeAbstention({ label: "문서 전체", reason: "ambiguous_value" })).toBe("검사일이 둘 이상이라 확실하지 않음");
  expect(describeAbstention({ label: "문서 전체", reason: "unreadable" })).toBe("글자 정보를 읽을 수 없음");
  expect(describeAbstention({ label: "LDL 콜레스테롤", reason: "ambiguous_value" })).toBe("값이 여러 개로 읽힘");
  expect(describeAbstention({ label: "AST", reason: "missing_evidence" })).toBe("검사일을 찾지 못함");
});

it("has one Korean sentence for each of the seven closed reasons", () => {
  expect(Object.keys(abstentionReasonLabels).sort()).toEqual([
    "ambiguous_unit", "ambiguous_value", "missing_evidence", "previous_column", "qualified_value", "qualitative", "unreadable",
  ]);
  expect(describeAbstention({ label: "hs-CRP (<0.3 mg/L)", reason: "qualified_value" })).toBe("부등호가 붙은 값이라 숫자로 확정하지 않음");
  expect(describeAbstention({ label: "요단백", reason: "qualitative" })).toBe("음성·양성 같은 판정 결과라 값으로 저장하지 않음");
  expect(describeAbstention({ label: "혈당", reason: "previous_column" })).toBe("이전 결과 칸의 값이라 이번 결과지 값으로 쓰지 않음");
  for (const abstention of syntheticAbstentions) expect(describeAbstention(abstention)).not.toBe(abstention.reason);
});
