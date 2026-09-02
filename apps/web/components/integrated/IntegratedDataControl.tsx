"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createFoundationClient,
  type FoundationConsent,
  type FoundationDeletion,
  type FoundationSession,
} from "@/lib/foundation/client";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { describeFoundationError } from "@/lib/foundation/messages";

export function IntegratedDataControl() {
  const client = useMemo(() => createFoundationClient(), []);
  const [session, setSession] = useState<FoundationSession>();
  const [consent, setConsent] = useState<FoundationConsent>();
  const [deletion, setDeletion] = useState<FoundationDeletion>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviewingDeletion, setReviewingDeletion] = useState(false);
  const [confirmedDeletion, setConfirmedDeletion] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [loadedSession, loadedConsent] = await Promise.all([
          client.getSession(),
          client.getDocumentConsent(),
        ]);
        if (active) {
          setSession(loadedSession);
          setConsent(loadedConsent);
        }
      } catch (error) {
        if (active) setErrorMessage(describeFoundationError(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [client]);

  const revokeConsent = async () => {
    if (!consent?.consentId) return;
    setBusy(true);
    setErrorMessage("");
    setActionMessage("");
    try {
      const revoked = await client.revokeConsent(consent.consentId);
      setConsent(revoked);
      setActionMessage("결과지 처리 동의를 서버에서 철회했어요.");
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
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
      setConsent(undefined);
      setReviewingDeletion(false);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IntegratedShell current="data-control" status="서버 동의 · 삭제 상태">
      <main className="gc-data-control">
        <div className="gc-data-control__shell">
          <section className="gc-data-control__hero" aria-labelledby="integrated-data-title">
            <div><p>내 데이터 제어</p><h1 id="integrated-data-title">서버에 기록된 상태만 보여드려요</h1></div>
            <div className="gc-data-control__hero-copy"><p>동의 철회와 삭제는 Spring이 승인하고 PostgreSQL에 반영한 결과로만 표시합니다.</p><strong>합성 데이터 전용 · 실제 개인정보 없음</strong></div>
          </section>

          {loading && <p role="status">서버에서 동의 상태를 확인하고 있어요.</p>}
          {actionMessage && <p role="status" aria-live="polite">{actionMessage}</p>}
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage} {!session && <a href="/">홈에서 다시 로그인</a>}</p>}

          {!loading && session && (
            <>
              <section className="gc-data-control__summary" aria-label="현재 서버 데이터 상태">
                <article><span>합성 세션</span><strong>활성</strong><p>{session.subjectId}</p></article>
                <article><span>결과지 처리 동의</span><strong>{consent?.status ?? "NOT_GRANTED"}</strong><p>DOCUMENT_EXTRACTION</p></article>
                <article><span>외부 연결</span><strong>0</strong><p>카카오·네이버·MyHealthWay 비활성화</p><a href="/connections">외부 연결 상태</a></article>
              </section>

              <section className="gc-data-control__purposes" aria-labelledby="server-consent-title">
                <header><div><p>Spring 권한 상태</p><h2 id="server-consent-title">결과지 처리 동의</h2></div><p>화면이 과거 성공 결과로 권한을 추측하지 않아요.</p></header>
                <div className="gc-data-control__purpose-list">
                  <article data-status={consent?.status === "ACTIVE" ? "active" : "revoked"}>
                    <span className="gc-data-control__purpose-index">01</span>
                    <div className="gc-data-control__purpose-copy">
                      <div><h3>합성 결과지 후보 확인</h3><strong>{consent?.status ?? "NOT_GRANTED"}</strong></div>
                      <p>허용된 합성 PDF에 대해 문서 요청, 논리 격리, 검사, 합성 후보 확인을 허용합니다.</p>
                      <dl><div><dt>목적 코드</dt><dd>DOCUMENT_EXTRACTION</dd></div><div><dt>실제 외부 제공</dt><dd>없음</dd></div></dl>
                    </div>
                    {consent?.status === "ACTIVE" ? <button type="button" onClick={() => void revokeConsent()} disabled={busy}>{busy ? "철회 반영 중" : "동의 철회"}</button> : <span className="gc-data-control__purpose-lock">현재 허용되지 않음</span>}
                  </article>
                </div>
              </section>

              <section className="gc-data-control__danger" aria-labelledby="server-delete-title">
                <div><p>합성 프로필 데이터</p><h2 id="server-delete-title">계정과 데이터 모두 삭제</h2><span>서버가 COMPLETED를 반환하기 전에는 삭제 완료라고 표시하지 않아요.</span></div>
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
              <p>Spring이 COMPLETED를 반환했고 이전 세션 쿠키도 만료했습니다.</p>
              <dl className="gc-integrated-facts"><div><dt>삭제 ID</dt><dd><code>{deletion.deletionId}</code></dd></div><div><dt>감사에 건강 수치</dt><dd>{deletion.rawHealthValuesPresentInAudit ? "발견됨 · 중단 필요" : "없음"}</dd></div></dl>
              <div className="gc-integrated-actions"><a href="/">홈으로 돌아가기</a></div>
            </section>
          )}
        </div>
      </main>
    </IntegratedShell>
  );
}
