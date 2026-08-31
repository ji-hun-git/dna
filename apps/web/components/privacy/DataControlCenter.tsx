"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import {
  consentAuditViewSchema,
  initialConsentAuditViews,
  initialConsentPurposeViews,
  type ConsentAuditView,
  type ConsentPurposeId,
  type ConsentPurposeView,
} from "@/lib/consent/demo-consent";

const statusLabel = {
  active: "허용 중",
  "not-granted": "허용 안 함",
  revoked: "철회됨",
} as const;

const operationLabel = {
  COLLECT: "기록 수집",
  EXPLAIN: "기록 내용 보여주기",
  EXTRACT: "항목 추출",
  NORMALIZE: "형식 정리",
  RETAIN: "원본 보관",
} as const;

const categoryLabel = {
  LAB_REPORT: "검사 결과지",
  MEDICAL_RECORD: "진료 기록",
} as const;

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>;
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5.5 5.5v5.2c0 4.5 2.7 8.4 6.5 10.3 3.8-1.9 6.5-5.8 6.5-10.3V5.5L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function DataControlCenter() {
  const [purposes, setPurposes] = useState<readonly ConsentPurposeView[]>(initialConsentPurposeViews);
  const [auditEvents, setAuditEvents] = useState<readonly ConsentAuditView[]>(initialConsentAuditViews);
  const [revokeTarget, setRevokeTarget] = useState<ConsentPurposeId>();

  const activeCount = useMemo(() => purposes.filter((purpose) => purpose.status === "active").length, [purposes]);
  const target = purposes.find((purpose) => purpose.id === revokeTarget);

  const revokeLocalPurpose = () => {
    if (revokeTarget !== "build-personal-lab-timeline") return;
    setPurposes((current) => current.map((purpose) => purpose.id === revokeTarget
      ? { ...purpose, status: "revoked" as const }
      : purpose));
    setAuditEvents((current) => [
      consentAuditViewSchema.parse({
        schemaVersion: "consent-audit-view.v1",
        eventCode: "purpose-revoked",
        label: "결과지 기록 동의를 철회함 · 예시",
        occurredAt: "2026-08-12T03:00:00Z",
        disclosure: "synthetic-no-phi",
      }),
      ...current,
    ]);
    setRevokeTarget(undefined);
  };

  return (
    <main className="gc-data-control">
      <div className="gc-data-control__shell">
        <header className="gc-data-control__appbar">
          <a className="gc-data-control__brand" href="/" aria-label="앎 건강 홈으로 돌아가기">
            <span aria-hidden="true">앎</span><strong>앎</strong>
          </a>
          <span>동의 · 보관 · 변경 내역</span>
          <a href="/connections">연결 관리 <ArrowIcon /></a>
        </header>

        <section className="gc-data-control__hero" aria-labelledby="data-control-title">
          <div>
            <p>내 데이터 제어</p>
            <h1 id="data-control-title">내 데이터는 내가 정해요</h1>
          </div>
          <div className="gc-data-control__hero-copy">
            <p>정보를 쓰는 목적마다 따로 동의하고, 원본 보관 설정과 변경 내역을 확인할 수 있어요.</p>
            <strong><ShieldIcon /> 예시 화면 · 서버에는 반영되지 않아요</strong>
          </div>
        </section>

        <section className="gc-data-control__summary" aria-label="현재 데이터 제어 상태">
          <article><span>허용 중인 목적</span><strong>{String(activeCount).padStart(2, "0")}</strong><p>현재 동의한 목적</p></article>
          <article><span>연결된 기관</span><strong>00</strong><p>실제 외부 건강기관</p></article>
          <article><span>원본 보관</span><strong>안 함</strong><p>현재 보관 설정</p></article>
        </section>

        <section className="gc-data-control__purposes" aria-labelledby="purpose-title">
          <header>
            <div><p>정보를 쓰는 목적</p><h2 id="purpose-title">목적별 동의</h2></div>
            <p>한 번의 동의로 모든 처리를 묶지 않아요.</p>
          </header>
          <div className="gc-data-control__purpose-list">
            {purposes.map((purpose, index) => (
              <article key={purpose.id} data-status={purpose.status}>
                <span className="gc-data-control__purpose-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="gc-data-control__purpose-copy">
                  <div><h3>{purpose.title}</h3><strong>{statusLabel[purpose.status]}</strong></div>
                  <p>{purpose.description}</p>
                  <dl>
                    <div><dt>출처</dt><dd>내가 가져온 결과지</dd></div>
                    <div><dt>항목</dt><dd>{purpose.categories.map((category) => categoryLabel[category]).join(" · ")}</dd></div>
                    <div><dt>허용 작업</dt><dd>{purpose.operations.map((operation) => operationLabel[operation]).join(" · ")}</dd></div>
                  </dl>
                </div>
                {purpose.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => setRevokeTarget(purpose.id)}
                    aria-label={`${purpose.title} 동의 철회`}
                  >
                    동의 철회
                  </button>
                ) : <span className="gc-data-control__purpose-lock">아직 동의하지 않음</span>}
              </article>
            ))}
          </div>
        </section>

        <section className="gc-data-control__retention" aria-labelledby="retention-title">
          <header><span>원본 보관 기본 설정</span><strong>확인 후 바로 삭제</strong></header>
          <div>
            <section>
              <p>원본 보관 0일</p>
              <h2 id="retention-title">원본은 확인 후 바로 삭제하도록 설계하고 있어요</h2>
              <p>사용자가 확인한 기록과 파일 확인값만 남기고, 처리에 사용한 원본과 중간 파일은 삭제할 계획이에요.</p>
            </section>
            <div className="gc-data-control__retention-grid" role="img" aria-label="365일 중 원본 보관을 허용한 날은 0일이에요">
              {Array.from({ length: 50 }, (_, index) => <span key={index} aria-hidden="true" />)}
            </div>
          </div>
          <footer><span>현재 원본을 보관하지 않아요</span><span>별도 동의가 있을 때만 암호화 보관</span><span>최대 365일</span></footer>
        </section>

        <section className="gc-data-control__audit" aria-labelledby="audit-title">
          <header>
            <div><p>이 기기에 표시된 내역</p><h2 id="audit-title">동의 변경 이력</h2></div>
            <p>이 변경 내역에는 이름이나 건강 수치를 표시하지 않아요.</p>
          </header>
          <ol aria-live="polite">
            {auditEvents.map((event, index) => (
              <li key={`${event.eventCode}-${event.occurredAt}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{event.label}</strong>
                <time dateTime={event.occurredAt}>2026.08.12</time>
                <em>개인 건강정보 없음</em>
              </li>
            ))}
          </ol>
        </section>

        <section className="gc-data-control__danger" aria-labelledby="delete-title">
          <div><p>계정 데이터</p><h2 id="delete-title">계정과 데이터 모두 삭제</h2><span>실제 계정 삭제 기능을 연결한 뒤에 제공할 예정이에요.</span></div>
          <button type="button" disabled aria-label="계정과 데이터 모두 삭제 아직 사용할 수 없음">아직 사용할 수 없어요</button>
        </section>
      </div>

      <Dialog.Root open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(undefined)}>
        <Dialog.Portal>
          <Dialog.Overlay className="gc-consent-dialog__overlay" />
          <Dialog.Content className="gc-consent-dialog__content" aria-describedby="revoke-consent-description">
            <Dialog.Title>이 동의를 철회할까요?</Dialog.Title>
            <Dialog.Description id="revoke-consent-description">
              {target?.title} 상태가 ‘철회됨’으로 바뀌어요. 이 예시 화면에서만 바뀌며 실제 서버나 건강 기록에는 영향을 주지 않아요.
            </Dialog.Description>
            <div>
              <Dialog.Close asChild><button type="button">취소</button></Dialog.Close>
              <button type="button" onClick={revokeLocalPurpose}>동의 철회</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
