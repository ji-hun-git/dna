import { expect, it } from "vitest";
import { describeAbstention, documentDateConflictLabel } from "@/lib/format/status-labels";

it("names the document-level date conflict in Korean and keeps the reason map for every other row", () => {
  expect(documentDateConflictLabel).toBe("검사일이 둘 이상이라 확실하지 않음");
  expect(describeAbstention({ label: "문서 전체", reason: "ambiguous_value" })).toBe("검사일이 둘 이상이라 확실하지 않음");
  expect(describeAbstention({ label: "문서 전체", reason: "unreadable" })).toBe("글자 정보를 읽을 수 없음");
  expect(describeAbstention({ label: "LDL 콜레스테롤", reason: "ambiguous_value" })).toBe("값이 여러 개로 읽힘");
  expect(describeAbstention({ label: "AST", reason: "missing_evidence" })).toBe("검사일을 찾지 못함");
});
