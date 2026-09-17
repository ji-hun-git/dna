"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createFoundationClient,
  type FoundationConsentPurpose,
  type FoundationDeletion,
  type FoundationSession,
  type HealthEvent,
} from "@/lib/foundation/client";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { describeFoundationError } from "@/lib/foundation/messages";
import { labelConsentStatus } from "@/lib/format/status-labels";

type FixedPurposeCode = "DOCUMENT_EXTRACTION" | "RESEARCH_USE" | "RESEARCH_CONTACT";

type ConsentRowCopy = {
  purposeCode: FixedPurposeCode;
  title: string;
  short: string;
  description: string;
  purpose: string;
};

/** The three fixed purposes in the order the server lists them. The sentences are fixed by the Wave 2C design. */
const consentRows: ConsentRowCopy[] = [
  {
    purposeCode: "DOCUMENT_EXTRACTION",
    title: "서비스 제공(결과지 처리)",
    short: "결과지 처리",
    description: "허용된 합성 PDF에 대해 문서 요청, 논리 격리, 검사, 합성 후보 확인을 허용합니다. 철회하면 새 결과지를 처리하지 않아요.",
    purpose: "결과지 항목 확인",
  },
  {
    purposeCode: "RESEARCH_USE",
    title: "연구 활용",
    short: "연구 활용",
    description: "가명처리 후 연구에 쓰는 것에 대한 선택. 지금은 진행 중인 연구가 없어요.",
    purpose: "연구 활용 · 현재 없음",
  },
  {
    purposeCode: "RESEARCH_CONTACT",
    title: "연구 연락",
    short: "연구 연락",
    description: "적합한 연구가 있을 때 참여 제안을 받을지. 지금은 연락 채널이 없어요.",
    purpose: "참여 제안 연락 · 현재 없음",
  },
];

const projectPrefix = "PROJECT:";

function newIdempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function IntegratedDataControl() {
  const client = useMemo(() => createFoundationClient(), []);
  const [session, setSession] = useState<FoundationSession>();
  const [consents, setConsents] = useState<FoundationConsentPurpose[]>([]);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [deletion, setDeletion] = useState<FoundationDeletion>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyPurpose, setBusyPurpose] = useState<string | undefined>(undefined);
  const [reviewingDeletion, setReviewingDeletion] = useState(false);
  const [confirmedDeletion, setConfirmedDeletion] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [loadedSession, loadedConsents, loadedEvents] = await Promise.all([
          client.getSession(),
          client.getConsents(),
          client.getHealthEvents(),
        ]);
        if (active) {
          setSession(loadedSession);
          setConsents(loadedConsents);
          setEvents(loadedEvents);
        }
      } catch (error) {
        if (active) setErrorMessage(describeFoundationError(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [client]);

  const consentFor = (purposeCode: string) => consents.find((item) => item.purposeCode === purposeCode);
  const documentConsentStatus = consentFor("DOCUMENT_EXTRACTION")?.status ?? "NOT_GRANTED";
  const projectConsents = consents.filter((item) => item.purposeCode.startsWith(projectPrefix));

  // Every consent change re-reads the server list, so the four rows always show what the server holds.
  const grantConsent = async (purposeCode: string, short: string) => {
    setBusy(true);
    setBusyPurpose(purposeCode);
    setErrorMessage("");
    setActionMessage("");
    try {
      await client.grantConsent(purposeCode, newIdempotencyKey("consent"));
      setConsents(await client.getConsents());
      setActionMessage(`${short} 동의를 서버에 기록했어요.`);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
      setBusyPurpose(undefined);
    }
  };

  const revokeConsent = async (consentId: string, short: string, purposeCode: string) => {
    setBusy(true);
    setBusyPurpose(purposeCode);
    setErrorMessage("");
    setActionMessage("");
    try {
      await client.revokeConsent(consentId);
      setConsents(await client.getConsents());
      setActionMessage(`${short} 동의를 서버에서 철회했어요.`);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
      setBusyPurpose(undefined);
    }
  };

  const deleteProfile = async () => {
    if (!confirmedDeletion) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const completed = await client.deleteProfile();
      setDeletion(completed);
      setSession(undefined);
      setConsents([]);
      setEvents([]);
      setReviewingDeletion(false);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IntegratedShell current="data-control" status="예시 데이터로 체험 중">
      <main className="gc-data-control">
        <div className="gc-data-control__shell">
          <section className="gc-data-control__hero" aria-labelledby="integrated-data-title">
            <div><p>동의와 보관 상태</p><h1 id="integrated-data-title">내 데이터</h1></div>
            <div className="gc-data-control__hero-copy"><p>목적별 동의를 확인하고, 내 기록을 파일로 내보내거나, 체험 중 만든 기록을 삭제할 수 있어요.</p><strong>예시 데이터 전용 · 실제 개인정보 없음</strong></div>
          </section>
          <div className="gc-integrated-actions"><a href="/connections">연결 상태 확인</a><a href="/providers">공공정보 실험실</a></div>

          {loading && <p role="status">서버에서 동의 상태를 확인하고 있어요.</p>}
          {actionMessage && <p role="status" aria-live="polite">{actionMessage}</p>}
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage} {!session && <a href="/">홈에서 다시 로그인</a>}</p>}

          {!loading && session && (
            <>
              <section className="gc-data-control__summary" aria-label="현재 서버 데이터 상태">
                <article><span>체험 상태</span><strong>활성</strong><p>이 브라우저에서 체험 중</p></article>
                <article><span>결과지 처리 동의</span><strong>{labelConsentStatus(documentConsentStatus)}</strong><p>예시 결과지 항목 확인</p></article>
                <article><span>외부 연결</span><strong>0</strong><p>카카오·네이버·MyHealthWay 비활성화</p><a href="/connections">외부 연결 상태</a></article>
              </section>

              <section className="gc-data-control__purposes" aria-labelledby="server-consent-title">
                <header>
                  <div><p>현재 동의 상태</p><h2 id="server-consent-title">목적별 동의</h2></div>
                  <p>연구 동의 없이도 모든 기능을 쓸 수 있어요. 연구 동의는 저장만 되고, 실제 활용 전에는 프로젝트별 동의를 다시 물어요.</p>
                </header>
                <div className="gc-data-control__purpose-list">
                  {consentRows.map((row, index) => {
                    const consent = consentFor(row.purposeCode);
                    const status = consent?.status ?? "NOT_GRANTED";
                    return (
                      <article key={row.purposeCode} data-purpose={row.purposeCode} data-status={status === "ACTIVE" ? "active" : "revoked"}>
                        <span className="gc-data-control__purpose-index">{String(index + 1).padStart(2, "0")}</span>
                        <div className="gc-data-control__purpose-copy">
                          <div><h3>{row.title}</h3><strong>{labelConsentStatus(status)}</strong></div>
                          <p>{row.description}</p>
                          <dl><div><dt>사용 목적</dt><dd>{row.purpose}</dd></div><div><dt>실제 외부 제공</dt><dd>없음</dd></div></dl>
                        </div>
                        {status === "ACTIVE" && consent?.consentId
                          ? <button type="button" onClick={() => void revokeConsent(consent.consentId!, row.short, row.purposeCode)} disabled={busy}>{busyPurpose === row.purposeCode ? "철회 반영 중" : `${row.short} 동의 철회`}</button>
                          : <button type="button" onClick={() => void grantConsent(row.purposeCode, row.short)} disabled={busy}>{busyPurpose === row.purposeCode ? "동의 반영 중" : `${row.short} 동의`}</button>}
                      </article>
                    );
                  })}
                  <article data-purpose="PROJECT" data-status={projectConsents.some((item) => item.status === "ACTIVE") ? "active" : "revoked"}>
                    <span className="gc-data-control__purpose-index">04</span>
                    <div className="gc-data-control__purpose-copy">
                      <div><h3>프로젝트별</h3><strong>{projectConsents.length === 0 ? "아직 없음" : `${projectConsents.filter((item) => item.status === "ACTIVE").length}개 동의함`}</strong></div>
                      <p>프로젝트가 생기면 여기서 개별로 물어요.</p>
                      {projectConsents.length > 0 && (
                        <ul className="gc-review-saved" aria-label="프로젝트별 동의">
                          {projectConsents.map((item) => {
                            const name = item.purposeCode.slice(projectPrefix.length);
                            return (
                              <li key={item.purposeCode}>
                                <strong>{name}</strong>
                                <span>{labelConsentStatus(item.status)}</span>
                                {item.status === "ACTIVE" && item.consentId && (
                                  <button
                                    type="button"
                                    className="gc-data-control__project-revoke"
                                    onClick={() => void revokeConsent(item.consentId!, name, item.purposeCode)}
                                    disabled={busy}
                                  >
                                    {busyPurpose === item.purposeCode ? "철회 반영 중" : `${name} 동의 철회`}
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <span className="gc-data-control__purpose-lock">지금은 물어볼 프로젝트가 없어요</span>
                  </article>
                </div>
              </section>

              <section className="gc-integrated-auth" aria-labelledby="server-export-title">
                <p>내 기록</p>
                <h2 id="server-export-title">내 기록 내보내기</h2>
                <p>브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요.</p>
                <div className="gc-integrated-actions">
                  {events.length > 0
                    ? <a className="gc-button gc-button--weak" href="/api/foundation/health-events/export" download>내 기록 내보내기(JSON)</a>
                    : <button type="button" disabled>내 기록 내보내기(JSON)</button>}
                </div>
                {events.length === 0 && <p className="gc-integrated-empty">내보낼 기록이 없어요</p>}
              </section>

              <section className="gc-data-control__danger" aria-labelledby="server-delete-title">
                <div><p>체험 데이터</p><h2 id="server-delete-title">계정과 데이터 모두 삭제</h2><span>결과지와 확인한 기록을 삭제하고 이 체험을 끝내요.</span></div>
                <button type="button" onClick={() => setReviewingDeletion(true)} disabled={busy}>삭제 요청 검토</button>
              </section>

              {reviewingDeletion && (
                <section className="gc-integrated-auth" aria-labelledby="delete-confirm-title">
                  <p>삭제 확인</p>
                  <h2 id="delete-confirm-title">합성 프로필을 삭제할까요?</h2>
                  <p>세션, 동의, 문서, 후보와 기록이 삭제되고 현재 세션도 끝납니다. 감사 이벤트에는 건강 수치를 남기지 않습니다.</p>
                  <label><input type="checkbox" checked={confirmedDeletion} onChange={(event) => setConfirmedDeletion(event.target.checked)} /> 위 내용을 확인했습니다</label>
                  <div className="gc-integrated-actions"><button type="button" onClick={() => { setReviewingDeletion(false); setConfirmedDeletion(false); }}>취소</button><button type="button" onClick={() => void deleteProfile()} disabled={!confirmedDeletion || busy}>{busy ? "삭제 상태 확인 중" : "서버에 삭제 요청"}</button></div>
                </section>
              )}
            </>
          )}

          {deletion?.status === "COMPLETED" && (
            <section className="gc-integrated-auth" aria-labelledby="delete-complete-title" role="status">
              <p>서버 완료 상태</p>
              <h2 id="delete-complete-title">삭제가 완료됐어요</h2>
              <p>체험 데이터가 삭제됐고 이 브라우저의 체험도 끝났어요.</p>
              <dl className="gc-integrated-facts"><div><dt>삭제 ID</dt><dd><code>{deletion.deletionId}</code></dd></div><div><dt>감사에 건강 수치</dt><dd>{deletion.rawHealthValuesPresentInAudit ? "발견됨 · 중단 필요" : "없음"}</dd></div></dl>
              <div className="gc-integrated-actions"><a href="/">홈으로 돌아가기</a></div>
            </section>
          )}
        </div>
      </main>
    </IntegratedShell>
  );
}
