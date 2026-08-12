import { z } from "zod";

export const consentPurposeIdSchema = z.enum([
  "build-personal-lab-timeline",
  "process-uploaded-document-in-kr-cloud",
  "retain-verified-source",
]);

export type ConsentPurposeId = z.infer<typeof consentPurposeIdSchema>;

export const consentPurposeViewSchema = z.strictObject({
  schemaVersion: z.literal("consent-purpose-view.v1"),
  id: consentPurposeIdSchema,
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(220),
  status: z.enum(["active", "not-granted", "revoked"]),
  dataSource: z.literal("USER_UPLOAD"),
  categories: z.tuple([z.literal("LAB_REPORT"), z.literal("MEDICAL_RECORD")]),
  operations: z.array(z.enum(["COLLECT", "EXPLAIN", "EXTRACT", "NORMALIZE", "RETAIN"])).min(1).max(3),
  retention: z.enum(["none", "workflow-only", "encrypted-365-days"]),
});

export type ConsentPurposeView = z.infer<typeof consentPurposeViewSchema>;

export const initialConsentPurposeViews: readonly ConsentPurposeView[] = [
  consentPurposeViewSchema.parse({
    schemaVersion: "consent-purpose-view.v1",
    id: "build-personal-lab-timeline",
    title: "결과지로 건강 기록 만들기",
    description: "내가 확인한 검사 결과를 출처와 함께 건강 기록으로 정리해요.",
    status: "active",
    dataSource: "USER_UPLOAD",
    categories: ["LAB_REPORT", "MEDICAL_RECORD"],
    operations: ["COLLECT", "EXPLAIN"],
    retention: "none",
  }),
  consentPurposeViewSchema.parse({
    schemaVersion: "consent-purpose-view.v1",
    id: "process-uploaded-document-in-kr-cloud",
    title: "한국 내 서버에서 결과지 읽기",
    description: "별도로 동의했을 때만 한국 내 서버에서 검사 항목 후보를 만들어요.",
    status: "not-granted",
    dataSource: "USER_UPLOAD",
    categories: ["LAB_REPORT", "MEDICAL_RECORD"],
    operations: ["COLLECT", "EXTRACT", "NORMALIZE"],
    retention: "workflow-only",
  }),
  consentPurposeViewSchema.parse({
    schemaVersion: "consent-purpose-view.v1",
    id: "retain-verified-source",
    title: "원본 결과지 암호화 보관",
    description: "기본값은 삭제예요. 별도 동의한 경우에만 최대 365일 보관해요.",
    status: "not-granted",
    dataSource: "USER_UPLOAD",
    categories: ["LAB_REPORT", "MEDICAL_RECORD"],
    operations: ["RETAIN"],
    retention: "encrypted-365-days",
  }),
] as const;

export const consentAuditViewSchema = z.strictObject({
  schemaVersion: z.literal("consent-audit-view.v1"),
  eventCode: z.enum(["purpose-confirmed", "retention-defaulted", "purpose-revoked"]),
  label: z.string().min(1).max(100),
  occurredAt: z.iso.datetime({ offset: false }),
  disclosure: z.literal("synthetic-no-phi"),
});

export type ConsentAuditView = z.infer<typeof consentAuditViewSchema>;

export const initialConsentAuditViews: readonly ConsentAuditView[] = [
  consentAuditViewSchema.parse({
    schemaVersion: "consent-audit-view.v1",
    eventCode: "purpose-confirmed",
    label: "결과지 기록에 동의함 · 예시",
    occurredAt: "2026-08-12T02:00:00Z",
    disclosure: "synthetic-no-phi",
  }),
  consentAuditViewSchema.parse({
    schemaVersion: "consent-audit-view.v1",
    eventCode: "retention-defaulted",
    label: "원본 바로 삭제를 선택함 · 예시",
    occurredAt: "2026-08-12T02:01:00Z",
    disclosure: "synthetic-no-phi",
  }),
] as const;
