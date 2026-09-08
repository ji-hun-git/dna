"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CandidateReview } from "@/components/integrated/CandidateReview";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import {
  createFoundationClient,
  FoundationClientError,
  sha256Blob,
  type FoundationCandidate,
  type FoundationConsent,
  type FoundationDocument,
  type FoundationRecord,
  type FoundationSession,
} from "@/lib/foundation/client";
import { describeFoundationError, foundationShellState } from "@/lib/foundation/messages";
import { formatKoreanDate } from "@/lib/format/korean-date";
import {
  labelConsentStatus,
  labelRecordStatus,
  labelReviewDecision,
} from "@/lib/format/status-labels";
import { shortDigest } from "@/lib/format/short-digest";
import { buildSyntheticResultPdf } from "@/lib/foundation/synthetic-document";

type ShellState =
  | "INITIALIZING_SESSION"
  | "AUTHENTICATED"
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "RESTORE_FAILED"
  | "AUTHORIZATION_DENIED";

type View = "home" | "consent" | "source" | "processing" | "review" | "complete";

type LocalProcessingState =
  | "IDLE"
  | "HASHING"
  | "REQUESTING_UPLOAD"
  | "UPLOADING"
  | "UPLOAD_FINALIZING";

type ProcessingState = LocalProcessingState | FoundationDocument["status"];

const processingCopy: Record<ProcessingState, string> = {
  IDLE: "대기 중",
  HASHING: "브라우저에서 파일 확인값을 계산하고 있어요",
  REQUESTING_UPLOAD: "서버에 업로드 요청을 만들고 있어요",
  UPLOADING: "허용된 합성 PDF를 전송하고 있어요",
  UPLOAD_FINALIZING: "서버가 받은 바이트와 요청 정보를 다시 맞추고 있어요",
  UPLOAD_PENDING: "업로드가 끝나기를 기다리고 있어요",
  UNTRUSTED_OBJECT: "파일을 신뢰하지 않는 보안 구역에 보관했어요",
  SECURITY_INSPECTION: "격리된 작업자가 문서를 안전하게 확인하고 있어요",
  SECURITY_REJECTED: "보안 정책에 따라 이 파일을 처리하지 않았어요",
  SECURITY_APPROVED: "검사한 바이트가 승인됐어요",
  EXTRACTION_QUEUED: "승인된 바이트의 합성 후보 생성을 기다리고 있어요",
  EXTRACTION_RUNNING: "격리된 작업자가 안전한 미리보기를 만들고 있어요",
  REVIEW_REQUIRED: "직접 확인할 합성 후보가 준비됐어요",
  COMPLETED: "이 문서의 사용자 확인이 끝났어요",
  DELETION_PENDING: "문서와 파생물을 지우고 있어요",
  DELETED: "문서와 파생물을 삭제했어요",
  FAILED_RETRYABLE: "일시적인 문제로 서버가 안전하게 다시 시도할 준비를 하고 있어요",
  FAILED_TERMINAL: "안전하게 계속할 수 없어 처리를 중단했어요",
};

const pollableStates = new Set<FoundationDocument["status"]>([
  "UNTRUSTED_OBJECT",
  "SECURITY_INSPECTION",
  "SECURITY_APPROVED",
  "EXTRACTION_QUEUED",
  "EXTRACTION_RUNNING",
  "FAILED_RETRYABLE",
]);

function newIdempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function IntegratedHealthExperience() {
  const client = useMemo(() => createFoundationClient(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [shellState, setShellState] = useState<ShellState>("INITIALIZING_SESSION");
  const [session, setSession] = useState<FoundationSession>();
  const [consent, setConsent] = useState<FoundationConsent>();
  const [records, setRecords] = useState<FoundationRecord[]>([]);
  const [view, setView] = useState<View>("home");
  const [processingState, setProcessingState] = useState<ProcessingState>("IDLE");
  const [documentReceipt, setDocumentReceipt] = useState<FoundationDocument>();
  const [candidates, setCandidates] = useState<FoundationCandidate[]>([]);
  const [savedRecords, setSavedRecords] = useState<FoundationRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pollingPaused, setPollingPaused] = useState(false);
  const [pollingNonce, setPollingNonce] = useState(0);

  const loadProductTruth = useCallback(async () => {
    const [loadedConsent, loadedRecords, activity] = await Promise.all([
      client.getDocumentConsent(),
      client.getRecords(),
      client.getActiveDocument(),
    ]);
    setConsent(loadedConsent);
    setRecords(loadedRecords);
    if (activity.document) {
      setDocumentReceipt(activity.document);
      setProcessingState(activity.document.status);
      if (activity.document.status === "REVIEW_REQUIRED") {
        const restored = await client.getCandidatesForDocument(activity.document.documentId);
        setCandidates(restored);
        setView(restored.some((item) => item.status === "PENDING") ? "review" : "complete");
      } else {
        setView("processing");
      }
    }
  }, [client]);

  const initialize = useCallback(async () => {
    setShellState("INITIALIZING_SESSION");
    setErrorMessage("");
    try {
      const restored = await client.getSession();
      setSession(restored);
      await loadProductTruth();
      setShellState("AUTHENTICATED");
    } catch (error) {
      const state = foundationShellState(error);
      if (state === "UNAUTHENTICATED" || state === "SESSION_EXPIRED") {
        setSession(undefined);
        setShellState(state);
      } else {
        // A failed read is not proof that the session is gone. In particular,
        // never replace restoration with a new demo-bootstrap POST.
        setShellState("RESTORE_FAILED");
      }
      if (state !== "UNAUTHENTICATED") setErrorMessage(describeFoundationError(error));
    }
  }, [client, loadProductTruth]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const documentId = documentReceipt?.documentId;
    const documentStatus = documentReceipt?.status;
    if (!documentId || !documentStatus || view !== "processing" || !pollableStates.has(documentStatus)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const poll = async () => {
      try {
        const current = await client.getDocument(documentId);
        if (cancelled) return;
        if (current.status === "REVIEW_REQUIRED") {
          // Fetch the candidates before publishing the terminal polling status.
          // Otherwise the status dependency cleans up this effect while the
          // candidate request is in flight, leaving the UI stuck in processing.
          const extracted = await client.getCandidatesForDocument(current.documentId);
          if (cancelled) return;
          setDocumentReceipt(current);
          setProcessingState(current.status);
          setPollingPaused(false);
          setErrorMessage("");
          setCandidates(extracted);
          setView(extracted.some((item) => item.status === "PENDING") ? "review" : "complete");
          return;
        }
        setDocumentReceipt(current);
        setProcessingState(current.status);
        setPollingPaused(false);
        setErrorMessage("");
        if (!pollableStates.has(current.status)) return;
        attempt += 1;
        timer = setTimeout(poll, Math.min(8_000, 750 * (2 ** Math.min(attempt, 4))));
      } catch (error) {
        if (cancelled) return;
        setPollingPaused(true);
        setErrorMessage(describeFoundationError(error));
        const nextShell = foundationShellState(error);
        if (nextShell === "SESSION_EXPIRED" || nextShell === "UNAUTHENTICATED") setShellState(nextShell);
      }
    };

    timer = setTimeout(poll, 600);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [client, documentReceipt?.documentId, documentReceipt?.status, pollingNonce, view]);

  const signIn = async () => {
    setBusy(true);
    setErrorMessage("");
    try {
      const issued = await client.bootstrapDemo();
      setSession(issued);
      await loadProductTruth();
      setShellState("AUTHENTICATED");
      setView("home");
    } catch (error) {
      // A bootstrap response may have set cookies before a later read failed.
      // Re-read the current session before offering another bootstrap attempt.
      setShellState("RESTORE_FAILED");
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  const beginImport = () => {
    setErrorMessage("");
    setDocumentReceipt(undefined);
    setCandidates([]);
    setSavedRecords([]);
    setProcessingState("IDLE");
    setPollingPaused(false);
    setView(consent?.status === "ACTIVE" ? "source" : "consent");
  };

  const grantConsent = async () => {
    setBusy(true);
    setErrorMessage("");
    try {
      const granted = await client.grantDocumentConsent();
      setConsent(granted);
      setView("source");
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
      setShellState(foundationShellState(error));
    } finally {
      setBusy(false);
    }
  };

  const selectDocument = async (file: File) => {
    setErrorMessage("");
    if (file.type !== "application/pdf") {
      setErrorMessage("이 통합 단계에서는 허용된 합성 PDF만 선택할 수 있어요.");
      return;
    }
    if (file.size < 64 || file.size > 10_485_760) {
      setErrorMessage("PDF 크기는 64바이트 이상 10MB 이하여야 해요.");
      return;
    }
    if (!consent?.consentId || consent.status !== "ACTIVE") {
      setView("consent");
      setErrorMessage("결과지 처리 동의를 먼저 확인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      setProcessingState("HASHING");
      setView("processing");
      const digest = await sha256Blob(file);
      setProcessingState("REQUESTING_UPLOAD");
      const ticket = await client.requestDocument(
        consent.consentId,
        file.size,
        digest,
        newIdempotencyKey("document"),
      );
      setDocumentReceipt(ticket.document);
      setProcessingState("UPLOADING");
      const uploaded = await client.uploadDocument(ticket.uploadCapability, file);
      setDocumentReceipt(uploaded);
      setProcessingState("UPLOAD_FINALIZING");
      const finalized = await client.finalizeDocument(ticket.document.documentId);
      setDocumentReceipt(finalized);
      setProcessingState(finalized.status);
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  // The server decides a document is finished only when no candidate is left
  // pending, so the review screen stays until this list runs out of decisions.
  const activeCandidate = candidates.find((item) => item.status === "PENDING");

  // Both setters run from the same event handler: the next list is computed from the current
  // `candidates` value so the view change never happens inside a state updater.
  const applyDecision = (decided: FoundationCandidate) => {
    const remaining = candidates.map((item) => item.candidateId === decided.candidateId ? decided : item);
    setCandidates(remaining);
    if (!remaining.some((item) => item.status === "PENDING")) setView("complete");
  };

  // The server rejects a decision on a candidate it no longer holds as PENDING. Re-read its list
  // so the review loop resumes from the server's truth instead of this browser's stale copy.
  const resyncAfterConflict = async (error: unknown) => {
    const stale = error instanceof FoundationClientError && error.problemCode === "candidate_not_pending";
    if (!stale || !documentReceipt) return;
    try {
      const refreshed = await client.getCandidatesForDocument(documentReceipt.documentId);
      setCandidates(refreshed);
      if (!refreshed.some((item) => item.status === "PENDING")) setView("complete");
    } catch {
      // Keep the original message; the person can retry from the same screen.
    }
  };

  const confirmCandidate = async (value: string) => {
    if (!activeCandidate) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const record = await client.confirmCandidate(activeCandidate.candidateId, value, newIdempotencyKey("confirm"));
      setSavedRecords((current) => [...current, record]);
      setRecords((current) => [...current.filter((item) => item.recordId !== record.recordId), record]);
      applyDecision({ ...activeCandidate, status: "CONFIRMED" });
    } catch (error) {
      await resyncAfterConflict(error);
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  const excludeCandidate = async () => {
    if (!activeCandidate) return;
    setBusy(true);
    setErrorMessage("");
    try {
      applyDecision(await client.excludeCandidate(activeCandidate.candidateId, newIdempotencyKey("exclude")));
    } catch (error) {
      await resyncAfterConflict(error);
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  if (shellState === "INITIALIZING_SESSION") {
    return (
      <main className="gc-integrated-shell gc-integrated-shell--center" aria-busy="true">
        <p role="status">서버에서 로그인 상태를 확인하고 있어요.</p>
      </main>
    );
  }

  if (shellState !== "AUTHENTICATED") {
    if (shellState === "RESTORE_FAILED") {
      return (
        <IntegratedShell current="home" status="체험 상태 확인 필요">
          <main className="gc-integrated-shell gc-integrated-shell--center">
            <section className="gc-integrated-auth" aria-labelledby="restore-failed-title">
              <p>예시 데이터 체험</p>
              <h1 id="restore-failed-title">체험 상태를 불러오지 못했어요</h1>
              <p>새 체험을 만들지 않고, 현재 로그인과 기록을 다시 확인해요.</p>
              {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
              <div className="gc-integrated-actions">
                <button type="button" disabled={busy} onClick={() => void initialize()}>체험 상태 다시 확인</button>
              </div>
            </section>
          </main>
        </IntegratedShell>
      );
    }
    return (
      <IntegratedShell current="home" status="예시 데이터로 체험">
      <main className="gc-integrated-shell gc-integrated-shell--center gc-demo-entry">
        <section className="gc-integrated-auth" aria-labelledby="synthetic-login-title">
          <p className="gc-import__eyebrow">체험 데이터로 시작하기</p>
          <h1 id="synthetic-login-title">흩어진 결과지를,<br />출처가 보이는<br />내 건강 기록으로.</h1>
          <p>결과지에 적힌 값을 직접 확인하고, 기록을 모아 다음 진료에서 물어볼 내용을 준비해 보세요.</p>
          <p><strong>실제 건강정보는 사용하지 않습니다.</strong></p>
          {shellState === "SESSION_EXPIRED" && <strong role="status">로그인 시간이 끝났어요.</strong>}
          <button className="gc-button gc-button--primary" type="button" onClick={() => void signIn()} disabled={busy}>{busy ? "체험을 준비하고 있어요" : "체험 시작"}</button>
          <p className="gc-demo-entry__limit">이 브라우저의 체험 시간 동안 기록을 이어서 볼 수 있어요. 시간이 끝나거나 쿠키를 지우면 이전 체험에 다시 들어갈 수 없어요.</p>
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
        </section>
      </main>
      </IntegratedShell>
    );
  }

  if (view === "consent") {
    return (
      <main className="gc-integrated-shell gc-integrated-shell--center">
        <section className="gc-integrated-auth" aria-labelledby="integrated-consent-title">
          <p>목적별 동의</p>
          <h1 id="integrated-consent-title">결과지에서 항목을 확인해도 될까요?</h1>
          <p>허용된 합성 PDF의 파일 확인값을 검사하고, 합성 후보를 만들어 직접 확인하는 목적에만 사용해요.</p>
          <dl className="gc-integrated-facts">
            <div><dt>목적</dt><dd>결과지 항목 확인</dd></div>
            <div><dt>현재 상태</dt><dd>{labelConsentStatus(consent?.status ?? "NOT_GRANTED")}</dd></div>
            <div><dt>외부 제공</dt><dd>없음</dd></div>
          </dl>
          <div className="gc-integrated-actions">
            <button type="button" onClick={() => setView("home")}>취소</button>
            <button type="button" onClick={grantConsent} disabled={busy}>{busy ? "서버에 반영 중" : "이 목적에 동의"}</button>
          </div>
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
        </section>
      </main>
    );
  }

  if (view === "source") {
    return (
      <main className="gc-import" data-stage="source">
        <header className="gc-import__appbar"><button type="button" onClick={() => setView("home")}>이전</button><span>앎</span><button type="button" onClick={() => setView("home")}>닫기</button></header>
        <div className="gc-import__shell">
          <section className="gc-import__question" aria-labelledby="integrated-source-title">
            <p className="gc-import__eyebrow">1. 합성 결과지 선택</p>
            <h1 id="integrated-source-title">허용된 합성 PDF를<br />선택해 주세요</h1>
            <p className="gc-import__lead">이 단계에서는 서버가 미리 허용한 합성 PDF만 처리합니다.</p>
            <div className="gc-integrated-actions">
              <button type="button" disabled={busy} onClick={() => void selectDocument(new File([buildSyntheticResultPdf("2026-07")], "gc-synthetic-2026-07.pdf", { type: "application/pdf" }))}>7월 예시 결과지로 시작</button>
              <button type="button" disabled={busy} onClick={() => void selectDocument(new File([buildSyntheticResultPdf("2026-01")], "gc-synthetic-2026-01.pdf", { type: "application/pdf" }))}>1월 예시 결과지로 시작</button>
            </div>
            <button className="gc-import__action gc-import__action--primary" type="button" onClick={() => fileInput.current?.click()}>합성 PDF 선택</button>
            <input
              ref={fileInput}
              className="gc-import__file-input"
              type="file"
              accept="application/pdf,.pdf"
              aria-label="허용된 합성 PDF 선택"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void selectDocument(file);
                event.currentTarget.value = "";
              }}
            />
            <p className="gc-import__privacy-note">선택한 파일은 신뢰하지 않는 보안 구역으로만 전송됩니다. 서버가 허용한 합성 PDF 확인값과 일치하지 않으면 업로드 요청 자체를 만들지 않아요.</p>
            {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
          </section>
        </div>
      </main>
    );
  }

  if (view === "processing") {
    return (
      <main className="gc-import" data-stage="processing">
        <header className="gc-import__appbar"><button type="button" onClick={() => setView("home")}>이전</button><span>앎</span><button type="button" onClick={() => setView("home")}>닫기</button></header>
        <div className="gc-import__shell">
          <section className="gc-import__processing" aria-labelledby="server-processing-title">
            <p className="gc-import__eyebrow">2. 서버 처리 상태</p>
            <h1 id="server-processing-title">서버가 알려준 상태를<br />그대로 보여드려요</h1>
            <p className="gc-import__lead" role="status" aria-live="polite">{processingCopy[processingState]}</p>
            {documentReceipt && (
              <dl className="gc-integrated-facts">
                <div><dt>문서 상태</dt><dd>{processingCopy[documentReceipt.status]} <code aria-label="서버 상태 코드">{documentReceipt.status}</code></dd></div>
                <div><dt>파일 확인값</dt><dd><code>{documentReceipt.sha256 ? shortDigest(documentReceipt.sha256) : "아직 없음"}</code></dd></div>
                <div><dt>신뢰 경계</dt><dd>적대적 문서 격리 구역</dd></div>
                <div><dt>안전한 미리보기</dt><dd>{documentReceipt.previewAvailable ? "승인된 PNG 준비됨" : "승인 전에는 표시하지 않음"}</dd></div>
              </dl>
            )}
            <div className="gc-integrated-actions">
              {activeCandidate && <button type="button" onClick={() => setView("review")} disabled={busy}>이어서 확인</button>}
              {pollingPaused && <button type="button" onClick={() => { setErrorMessage(""); setPollingPaused(false); setPollingNonce((value) => value + 1); }}>상태 다시 확인</button>}
              {(processingState === "SECURITY_REJECTED" || processingState === "FAILED_TERMINAL") && <button type="button" onClick={() => setView("source")}>다른 합성 PDF 선택</button>}
            </div>
            {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
          </section>
        </div>
      </main>
    );
  }

  if (view === "review" && activeCandidate) {
    return (
      <CandidateReview
        candidate={activeCandidate}
        previewUrl={documentReceipt?.previewAvailable
          ? `/api/foundation/documents/${documentReceipt.documentId}/preview`
          : undefined}
        busy={busy}
        errorMessage={errorMessage}
        onConfirm={(value) => void confirmCandidate(value)}
        onExclude={() => void excludeCandidate()}
        onBack={() => setView("processing")}
        onClose={() => setView("home")}
      />
    );
  }

  if (view === "complete") {
    const confirmedCount = candidates.filter((item) => item.status === "CONFIRMED").length;
    const excludedCount = candidates.filter((item) => item.status === "EXCLUDED").length;
    return (
      <main className="gc-integrated-shell gc-integrated-shell--center">
        <section className="gc-integrated-auth" aria-labelledby="integrated-complete-title" role="status" aria-live="polite">
          <p>서버 처리 완료</p>
          <h1 id="integrated-complete-title">이 결과지 확인을 마쳤어요</h1>
          <p className="gc-review-summary">저장 {confirmedCount}개 · 제외 {excludedCount}개</p>
          <p>저장한 값은 출처와 확인 버전을 함께 남겼어요. 제외한 항목은 건강 기록으로 만들지 않았습니다.</p>
          {savedRecords.length > 0 && (
            <ul className="gc-review-saved">
              {savedRecords.map((record) => (
                <li key={record.recordVersionId}>
                  <strong>{record.label}</strong>
                  <span>예시 데이터</span>
                  <span>{record.value} {record.unit}</span>
                  <span>{labelReviewDecision(record.reviewDecision)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="gc-integrated-actions">
            <button type="button" onClick={() => { setView("home"); void loadProductTruth(); }}>홈으로</button>
            <a href="/records">저장된 기록 보기</a>
            <a href="/prepare">진료 준비 목록 보기</a>
          </div>
        </section>
      </main>
    );
  }

  const latest = records.at(-1);
  const unfinished = !!activeCandidate || (!!documentReceipt && pollableStates.has(documentReceipt.status));
  return (
    <IntegratedShell
      current="home"
      status={session ? "예시 데이터로 체험 중" : undefined}
    >
      <main className="gc-health-home">
        <div className="gc-health-home__shell">
          <section className="gc-health-home__hero" id="home" aria-labelledby="integrated-home-title">
            <div>
              <p className="gc-health-home__greeting">내가 확인한 값과 출처</p>
              <h1 id="integrated-home-title">값보다 먼저<br />출처를 확인하세요</h1>
              <p className="gc-health-home__hero-copy">결과지에 적힌 값을 직접 확인해 주세요. 확인한 기록은 날짜별로 모아 진료 준비에 함께 사용해요.</p>
              <div className="gc-health-home__hero-actions"><button className="gc-button gc-button--primary" type="button" onClick={unfinished ? () => setView(activeCandidate ? "review" : "processing") : beginImport}>{unfinished ? "이어서 확인" : "결과지 추가"}</button><a className="gc-button gc-button--weak" href="/records">전체 기록 보기</a></div>
            </div>
            <aside className="gc-health-home__connection" aria-label="통합 합성 제품 상태">
              <p><strong>예시 데이터로 체험 중이에요</strong></p>
              <span>외부 기관 연결 0곳 · 직접 확인한 예시 기록 {records.length}개</span>
              <a href="/data-control">동의와 삭제 상태 보기</a>
              <a href="/prepare">진료 때 물어볼 내용 준비</a>
            </aside>
          </section>
          <section className="gc-health-home__overview" aria-labelledby="integrated-records-title">
            <div className="gc-health-home__section-heading"><div><p>직접 확인한 기록</p><h2 id="integrated-records-title">{latest ? "가장 최근에 확인한 값" : "아직 저장된 기록이 없어요"}</h2></div><span>{records.length}개</span></div>
            {latest ? (
              <article className="gc-health-home__metric-card">
                <div className="gc-health-home__metric-copy"><div className="gc-health-home__metric-topline"><span>{latest.label} · 예시 데이터</span><strong>{labelRecordStatus(latest.status)}</strong></div><p className="gc-health-home__metric-value"><strong>{latest.value}</strong><span>{latest.unit}</span></p><p className="gc-health-home__metric-source">예시 결과지 · {formatKoreanDate(latest.observedOn)}</p></div>
                <a className="gc-button gc-button--weak" href={`/records#record-${latest.recordId}`}>이 값의 근거 보기</a>
              </article>
            ) : <p className="gc-integrated-empty">허용된 합성 PDF를 추가하고 후보를 직접 확인하면 여기에 기록됩니다.</p>}
          </section>
          <section className="gc-health-home__privacy" aria-labelledby="integrated-boundary-title"><div><p>현재 허용 범위</p><h2 id="integrated-boundary-title">합성 데이터만 처리해요</h2><ul><li>실제 카카오·네이버·MyHealthWay 비활성화</li><li>OCR·의료 AI 비활성화</li><li>문서는 승인 전까지 적대적 입력으로 격리</li></ul></div><a className="gc-button gc-button--weak" href="/data-control">데이터 관리</a></section>
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
        </div>
      </main>
    </IntegratedShell>
  );
}
