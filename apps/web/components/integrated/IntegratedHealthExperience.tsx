"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RecordWorkspace } from "@/components/home/RecordWorkspace";
import { CandidateReview } from "@/components/integrated/CandidateReview";
import { IntegratedShell } from "@/components/integrated/IntegratedShell";
import { RecentChanges } from "@/components/integrated/RecentChanges";
import {
  createFoundationClient,
  FoundationClientError,
  sha256Blob,
  type ChangeSummary,
  type FoundationCandidate,
  type FoundationConsent,
  type FoundationDocument,
  type FoundationRecord,
  type FoundationSession,
} from "@/lib/foundation/client";
import { describeFoundationError, foundationShellState } from "@/lib/foundation/messages";
import { formatKoreanDate } from "@/lib/format/korean-date";
import {
  describeAbstention,
  labelConsentStatus,
  labelReviewOutcome,
} from "@/lib/format/status-labels";
import { shortDigest } from "@/lib/format/short-digest";
import { buildSyntheticResultPdf } from "@/lib/foundation/synthetic-document";
import { homeIdentityCounts } from "@/lib/home/alive-home-data";

type ShellState =
  | "INITIALIZING_SESSION"
  | "AUTHENTICATED"
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "RESTORE_FAILED"
  | "AUTHORIZATION_DENIED";

type View = "home" | "consent" | "source" | "upload-check" | "processing" | "review" | "complete";

type LocalProcessingState =
  | "IDLE"
  | "HASHING"
  | "REQUESTING_UPLOAD"
  | "UPLOADING"
  | "UPLOAD_FINALIZING";

type ProcessingState = LocalProcessingState | FoundationDocument["status"];

const processingCopy: Record<ProcessingState, string> = {
  IDLE: "대기 중",
  HASHING: "선택한 파일을 확인하고 있어요",
  REQUESTING_UPLOAD: "파일 전송을 준비하고 있어요",
  UPLOADING: "예시 PDF를 전송하고 있어요",
  UPLOAD_FINALIZING: "파일이 제대로 전송됐는지 확인하고 있어요",
  UPLOAD_PENDING: "업로드가 끝나기를 기다리고 있어요",
  UNTRUSTED_OBJECT: "파일을 받았어요. 보안 검사를 기다리고 있어요",
  SECURITY_INSPECTION: "파일을 검사하고 있어요",
  SECURITY_REJECTED: "보안 정책에 따라 이 파일을 처리하지 않았어요",
  SECURITY_APPROVED: "파일 검사를 마쳤어요",
  EXTRACTION_QUEUED: "파일에서 글자를 읽기 위해 대기 중이에요",
  EXTRACTION_RUNNING: "결과지에서 글자를 읽고 미리보기를 만들고 있어요",
  REVIEW_REQUIRED: "결과지에서 읽은 내용을 확인해 주세요",
  COMPLETED: "결과지 확인을 마쳤어요",
  DELETION_PENDING: "결과지와 관련 데이터를 삭제하고 있어요",
  DELETED: "결과지와 관련 데이터를 삭제했어요",
  FAILED_RETRYABLE: "일시적인 오류가 발생했어요. 다시 처리할 예정이에요",
  FAILED_TERMINAL: "파일 처리를 중단했어요. 다른 예시 PDF를 선택해 주세요",
  TERMINATED_BY_REVOCATION: "동의를 철회해서 결과지 처리를 종료했어요. 다시 동의한 뒤 새로 올려 주세요.",
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
  const uploadInFlight = useRef(false);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [shellState, setShellState] = useState<ShellState>("INITIALIZING_SESSION");
  const [session, setSession] = useState<FoundationSession>();
  const [consent, setConsent] = useState<FoundationConsent>();
  const [records, setRecords] = useState<FoundationRecord[]>([]);
  const [changes, setChanges] = useState<ChangeSummary>();
  const [view, setView] = useState<View>("home");
  const [processingState, setProcessingState] = useState<ProcessingState>("IDLE");
  const [documentReceipt, setDocumentReceipt] = useState<FoundationDocument>();
  const [candidates, setCandidates] = useState<FoundationCandidate[]>([]);
  const [savedRecords, setSavedRecords] = useState<FoundationRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pollingPaused, setPollingPaused] = useState(false);
  const [pollingNonce, setPollingNonce] = useState(0);

  // Only current, server-confirmed records feed the home ledger.
  const currentRecords = useMemo(() => records.filter((record) => record.status === "CURRENT"), [records]);
  const identityCounts = useMemo(() => homeIdentityCounts(currentRecords), [currentRecords]);
  // Exam-date descending (then confirmation time descending): the most recently examined result
  // first, never the server's own `changed_at` insertion order.
  const homeRows = useMemo(
    () =>
      [...currentRecords]
        .sort((a, b) => (b.observedOn === a.observedOn
          ? b.confirmedAt.localeCompare(a.confirmedAt)
          : b.observedOn.localeCompare(a.observedOn)))
        .map((record) => ({
          recordId: record.recordId,
          item: record.label,
          value: record.value,
          unit: record.unit,
          observedOn: record.observedOn,
          shape: "circle" as const,
          size: 0,
          phase: 0,
        })),
    [currentRecords],
  );

  const loadProductTruth = useCallback(async () => {
    // A failed or schema-rejected /changes read must not break the home
    // screen: its own .catch() isolates it from the core loads below, so a
    // rejected changes fetch still lets Promise.all resolve and simply hides
    // the "이전 검사값과 비교" section.
    const [loadedConsent, loadedRecords, activity, loadedChanges] = await Promise.all([
      client.getDocumentConsent(),
      client.getRecords(),
      client.getActiveDocument(),
      client.getChanges().catch(() => undefined),
    ]);
    setConsent(loadedConsent);
    setRecords(loadedRecords);
    setChanges(loadedChanges);
    if (activity.document) {
      setDocumentReceipt(activity.document);
      setProcessingState(activity.document.status);
      if (activity.document.status === "REVIEW_REQUIRED" || activity.document.status === "COMPLETED") {
        // A COMPLETED document reached this way (page load, or "홈으로") never
        // goes through the live poll() branch that shows the zero-candidate
        // screen, so re-derive the same view from the same candidates fetch
        // the REVIEW_REQUIRED path already uses.
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
        if (current.status === "COMPLETED") {
          // The document may have completed with zero readable items, or it may have
          // already been reviewed elsewhere with candidates now CONFIRMED/REJECTED.
          // Fetch and derive the view the same way the restore path (loadProductTruth)
          // does, instead of assuming zero candidates.
          const extracted = await client.getCandidatesForDocument(current.documentId);
          if (cancelled) return;
          setDocumentReceipt(current);
          setProcessingState(current.status);
          setPollingPaused(false);
          setErrorMessage("");
          setCandidates(extracted);
          setView("complete");
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
    setSelectedFile(undefined);
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

  const selectDocument = (file: File) => {
    setErrorMessage("");
    if (file.type !== "application/pdf") {
      setErrorMessage("체험용으로 등록된 예시 PDF만 선택할 수 있어요.");
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
    setSelectedFile(file);
    setView("upload-check");
  };

  const uploadSelectedDocument = async () => {
    const file = selectedFile;
    if (!file || uploadInFlight.current) return;
    if (!consent?.consentId || consent.status !== "ACTIVE") {
      setSelectedFile(undefined);
      setView("consent");
      return;
    }
    uploadInFlight.current = true;
    setSelectedFile(undefined);
    setErrorMessage("");
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
      uploadInFlight.current = false;
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

  const confirmCandidate = async (value: string, observedOn?: string) => {
    if (!activeCandidate) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const record = await client.confirmCandidate(activeCandidate.candidateId, value, newIdempotencyKey("confirm"), observedOn);
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
        <p role="status">로그인 상태를 확인하고 있어요.</p>
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
              <p>기존 체험 기록을 다시 불러와 주세요. 새 체험은 시작하지 않아요.</p>
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
        <RecordWorkspace preview>
        <section className="gc-integrated-auth" aria-labelledby="synthetic-login-title">
          <p className="gc-import__eyebrow">예시 결과지 체험</p>
          <h1 id="synthetic-login-title">검사 결과<br /><em>모아보기</em></h1>
          <p>결과지를 올리고 검사값을 확인한 뒤 저장할 수 있어요.
            예시 결과지로 사용해 보세요.</p>
          <p><strong>실제 건강정보는 사용하지 않습니다.</strong></p>
          {shellState === "SESSION_EXPIRED" && <strong role="status">로그인 시간이 끝났어요.</strong>}
          <button className="gc-button gc-button--primary" type="button" onClick={() => void signIn()} disabled={busy}>{busy ? "체험을 준비하고 있어요" : "체험 시작"}</button>
          <p className="gc-demo-entry__limit">이 브라우저의 체험 시간 동안 기록을 이어서 볼 수 있어요. 시간이 끝나거나 쿠키를 지우면 이전 체험에 다시 들어갈 수 없어요.</p>
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
        </section>
        </RecordWorkspace>
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
          <p>예시 PDF에서 항목과 검사값을 읽어 확인 화면에 표시해요. 직접 확인한 항목만 기록으로 저장해요.</p>
          <dl className="gc-integrated-facts">
            <div><dt>목적</dt><dd>결과지 항목 확인</dd></div>
            <div><dt>현재 상태</dt><dd>{labelConsentStatus(consent?.status ?? "NOT_GRANTED")}</dd></div>
            <div><dt>외부 제공</dt><dd>없음</dd></div>
          </dl>
          <div className="gc-integrated-actions">
            <button type="button" onClick={() => setView("home")}>취소</button>
            <button type="button" onClick={grantConsent} disabled={busy}>{busy ? "저장 중" : "이 목적에 동의"}</button>
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
            <p className="gc-import__eyebrow">1. 결과지 선택</p>
            <h1 id="integrated-source-title">예시 결과지를<br />선택해 주세요</h1>
            <p className="gc-import__lead">체험용으로 등록된 예시 PDF만 사용할 수 있어요. 실제 결과지는 올리지 마세요.</p>
            <div className="gc-integrated-actions">
              <button type="button" disabled={busy} onClick={() => void selectDocument(new File([buildSyntheticResultPdf("2026-07")], "gc-synthetic-2026-07.pdf", { type: "application/pdf" }))}>7월 예시 결과지로 시작</button>
              <button type="button" disabled={busy} onClick={() => void selectDocument(new File([buildSyntheticResultPdf("2026-01")], "gc-synthetic-2026-01.pdf", { type: "application/pdf" }))}>1월 예시 결과지로 시작</button>
            </div>
            <button className="gc-import__action gc-import__action--primary" type="button" onClick={() => fileInput.current?.click()}>예시 PDF 선택</button>
            <input
              ref={fileInput}
              className="gc-import__file-input"
              type="file"
              accept="application/pdf,.pdf"
              aria-label="등록된 예시 PDF 선택"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void selectDocument(file);
                event.currentTarget.value = "";
              }}
            />
            <p className="gc-import__privacy-note">파일을 선택하면 전송 전에 한 번 더 확인해요. 등록된 예시 파일과 내용이 다르면 전송하지 않아요.</p>
            {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
          </section>
        </div>
      </main>
    );
  }

  if (view === "upload-check" && selectedFile) {
    const cancelSelection = () => { setSelectedFile(undefined); setView("source"); };
    return (
      <main className="gc-import" data-stage="upload-check">
        <header className="gc-import__appbar"><button type="button" onClick={cancelSelection}>이전</button><span>앎</span><button type="button" onClick={() => { setSelectedFile(undefined); setView("home"); }}>닫기</button></header>
        <div className="gc-import__shell">
          <section className="gc-import__question" aria-labelledby="upload-check-title">
            <p className="gc-import__eyebrow">전송 전 확인</p>
            <h1 id="upload-check-title">전송할 파일을 확인해 주세요</h1>
            <p className="gc-import__lead">아직 파일을 전송하지 않았어요.</p>
            <dl className="gc-integrated-facts gc-upload-check__facts">
              <div><dt>선택한 파일</dt><dd>{selectedFile.name}</dd></div>
              <div><dt>파일 크기</dt><dd>{selectedFile.size.toLocaleString("ko-KR")}바이트</dd></div>
              <div><dt>처리 목적</dt><dd>결과지의 항목을 읽고 직접 확인하기</dd></div>
            </dl>
            <p>예시 파일만 전송해 주세요. 개인정보를 자동으로 지워주지 않으므로 실제 결과지는 올리지 마세요.</p>
            <ol className="gc-upload-check__steps"><li>파일 전송</li><li>문서에서 읽은 내용 확인</li><li>확인한 기록 저장</li></ol>
            <div className="gc-integrated-actions">
              <button type="button" onClick={cancelSelection}>선택 취소</button>
              <button className="gc-button gc-button--primary" type="button" disabled={busy} onClick={() => void uploadSelectedDocument()}>이 파일 전송하기</button>
            </div>
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
            <p className="gc-import__eyebrow">2. 파일 처리</p>
            <h1 id="server-processing-title">파일 처리 상태</h1>
            <p className="gc-import__lead" role="status" aria-live="polite">{processingCopy[processingState]}</p>
            {processingState === "FAILED_TERMINAL" && documentReceipt?.failureCode === "render_error" && (
              <p className="gc-import__lead">미리보기 처리 중 메모리 한도를 넘었어요. 다른 예시 PDF를 선택해 주세요.</p>
            )}
            {documentReceipt && (
              <dl className="gc-integrated-facts">
                <div><dt>문서 상태</dt><dd>{processingCopy[documentReceipt.status]} <code aria-label="서버 상태 코드">{documentReceipt.status}</code></dd></div>
                <div><dt>파일 확인값</dt><dd><code>{documentReceipt.sha256 ? shortDigest(documentReceipt.sha256) : "아직 없음"}</code></dd></div>
                <div><dt>파일 보관</dt><dd>검사용 임시 보관</dd></div>
                <div><dt>안전한 미리보기</dt><dd>{documentReceipt.previewAvailable ? "미리보기 준비됨" : "검사가 끝나기 전에는 표시하지 않아요"}</dd></div>
              </dl>
            )}
            <div className="gc-integrated-actions">
              {!busy && errorMessage && !documentReceipt && <button type="button" onClick={() => { setErrorMessage(""); setView("source"); }}>파일 선택으로 돌아가기</button>}
              {activeCandidate && <button type="button" onClick={() => setView("review")} disabled={busy}>이어서 확인</button>}
              {pollingPaused && <button type="button" onClick={() => { setErrorMessage(""); setPollingPaused(false); setPollingNonce((value) => value + 1); }}>상태 다시 확인</button>}
              {(processingState === "SECURITY_REJECTED" || processingState === "FAILED_TERMINAL" || processingState === "TERMINATED_BY_REVOCATION") && <button type="button" onClick={() => setView("source")}>다른 예시 PDF 선택</button>}
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
        onConfirm={(value, observedOn) => void confirmCandidate(value, observedOn)}
        onExclude={() => void excludeCandidate()}
        onBack={() => setView("processing")}
        onClose={() => setView("home")}
      />
    );
  }

  if (view === "complete" && candidates.length === 0) {
    const abstentions = documentReceipt?.abstentions ?? [];
    // The worker reports a file with no usable text layer (a scan/photo, or bytes it could not
    // open) as one document-level "문서 전체" unreadable abstention. Every other shape — the
    // "결과지" abstention for readable lines that matched no row, or ambiguous/unit-less rows —
    // means text was present, so the copy must say that instead of blaming a scan.
    const scanLikeDocument =
      abstentions.length === 0 ||
      abstentions.every((item) => item.reason === "unreadable" && item.label === "문서 전체");
    return (
      <main className="gc-integrated-shell gc-integrated-shell--center">
        <section className="gc-integrated-auth" aria-labelledby="integrated-empty-title" role="status" aria-live="polite">
          <p>처리 결과</p>
          <h1 id="integrated-empty-title">이 결과지에서 읽을 수 있는 항목이 없었어요</h1>
          <p>
            {scanLikeDocument
              ? "글자 정보가 없는 파일(사진·스캔)은 아직 읽지 못해요."
              : "읽은 글자는 있지만 항목·값·단위를 확실히 맞출 수 없었어요. 아래 사유를 확인해 주세요."}
          </p>
          {abstentions.length > 0 && (
            <ul className="gc-review-saved" aria-label="읽지 못한 항목">
              {abstentions.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <strong>{item.label}</strong>
                  <span>{describeAbstention(item)}</span>
                  {item.evidencePage ? <span>{item.evidencePage}쪽</span> : null}
                </li>
              ))}
            </ul>
          )}
          <div className="gc-integrated-actions">
            <button type="button" onClick={() => { setView("home"); void loadProductTruth(); }}>홈으로</button>
            <button type="button" onClick={() => setView("source")}>다른 예시 PDF 선택</button>
          </div>
        </section>
      </main>
    );
  }

  if (view === "complete") {
    const confirmedCount = candidates.filter((item) => item.status === "CONFIRMED").length;
    const excludedCount = candidates.filter((item) => item.status === "EXCLUDED").length;
    return (
      <main className="gc-integrated-shell gc-integrated-shell--center">
        <section className="gc-integrated-auth" aria-labelledby="integrated-complete-title" role="status" aria-live="polite">
          <p>처리 결과</p>
          <h1 id="integrated-complete-title">이 결과지 확인을 마쳤어요</h1>
          <p className="gc-review-summary">저장 {confirmedCount}개 · 제외 {excludedCount}개</p>
          <p>확인한 값과 결과지 출처를 저장했어요. 제외한 항목은 저장하지 않았어요.</p>
          {savedRecords.length > 0 && (
            <ul className="gc-review-saved">
              {savedRecords.map((record) => (
                <li key={record.recordVersionId}>
                  <strong>{record.label}</strong>
                  <span>예시 데이터</span>
                  <span>{record.value} {record.unit}</span>
                  <span>{labelReviewOutcome(record)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="gc-integrated-actions">
            <button type="button" onClick={() => { setView("home"); void loadProductTruth(); }}>홈으로</button>
            <a href="/records">저장된 기록 보기</a>
            <a href="/my-data">기록 한눈에 보기</a>
            <a href="/prepare">진료 준비 목록 보기</a>
          </div>
        </section>
      </main>
    );
  }

  const unfinished = !!activeCandidate || (!!documentReceipt && pollableStates.has(documentReceipt.status));

  return (
    <IntegratedShell current="home" status={session ? "예시 데이터로 체험 중" : undefined}>
      <main className="gc-integrated-shell gc-integrated-shell--center gc-demo-entry">
        <RecordWorkspace rows={homeRows} documentCount={identityCounts.resultSheetCount}
          belowRecords={changes ? <RecentChanges changes={changes} /> : null}>
          <section className="gc-integrated-auth" aria-label="빠른 실행">
            <p className="gc-import__eyebrow">예시 데이터로 체험</p>
            <h1>내 건강 기록<em>.</em></h1>
            <div className="gc-health-home__hero-actions">
              <button
                className="gc-button gc-button--primary"
                type="button"
                onClick={unfinished ? () => setView(activeCandidate ? "review" : "processing") : beginImport}
              >
                {unfinished ? "이어서 확인" : "결과지 추가"}
              </button>
            </div>
            {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
          </section>
        </RecordWorkspace>
      </main>
    </IntegratedShell>
  );
}
