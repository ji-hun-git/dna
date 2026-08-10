import type { EvidenceViewModel } from "@/components/evidence/EvidenceCard";

export const verifiedPriceFixture: EvidenceViewModel = {
  title: "비급여 검사 금액",
  value: "70,000원",
  status: "verified",
  sourceName: "건강보험심사평가원",
  retrievedAt: "2026-08-09",
  applicablePeriod: "2026년 공개자료",
  caveat: "공개 금액은 실제 청구액이나 의료의 질을 보장하지 않습니다.",
  units: Array.from({ length: 10 }, (_, index) => ({
    id: `unit-${index + 1}`,
    active: index < 7,
    label: `${index + 1}만원`,
  })),
};
