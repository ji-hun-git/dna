"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EvidenceLens } from "@/components/records/EvidenceLens";
import {
  createFoundationClient,
  sha256Blob,
  type FoundationCandidate,
  type FoundationConsent,
  type FoundationDocument,
  type FoundationRecord,
  type FoundationSession,
} from "@/lib/foundation/client";
import { describeFoundationError, foundationShellState } from "@/lib/foundation/messages";
import { formatKoreanDate } from "@/lib/format/korean-date";

type ShellState =
  | "INITIALIZING_SESSION"
  | "AUTHENTICATED"
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "AUTHORIZATION_DENIED";

type View = "home" | "consent" | "source" | "processing" | "review" | "complete" | "evidence";

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

function shortDigest(value: string) {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
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
  const [candidate, setCandidate] = useState<FoundationCandidate>();
  const [savedRecord, setSavedRecord] = useState<FoundationRecord>();
  const [selectedRecord, setSelectedRecord] = useState<FoundationRecord>();
  const [subjectId, setSubjectId] = useState("");
  const [credential, setCredential] = useState("");
  const [draftValue, setDraftValue] = useState("");
  const [correctionMode, setCorrectionMode] = useState(false);
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
        const restoredCandidate = await client.getCandidateForDocument(activity.document.documentId);
        setCandidate(restoredCandidate);
        setDraftValue(restoredCandidate.value);
        setView("review");
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
      setSession(undefined);
      setShellState(foundationShellState(error));
      if (foundationShellState(error) !== "UNAUTHENTICATED") setErrorMessage(describeFoundationError(error));
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
        setDocumentReceipt(current);
        setProcessingState(current.status);
        setPollingPaused(false);
        setErrorMessage("");
        if (current.status === "REVIEW_REQUIRED") {
          const extracted = await client.getCandidateForDocument(current.documentId);
          if (cancelled) return;
          setCandidate(extracted);
          setDraftValue(extracted.value);
          setView("review");
          return;
        }
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

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    try {
      const issued = await client.createSession(subjectId.trim(), credential);
      setCredential("");
      setSession(issued);
      await loadProductTruth();
      setShellState("AUTHENTICATED");
      setView("home");
    } catch (error) {
      setShellState("AUTHORIZATION_DENIED");
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  const beginImport = () => {
    setErrorMessage("");
    setDocumentReceipt(undefined);
    setCandidate(undefined);
    setSavedRecord(undefined);
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

  const confirmCandidate = async (value: string) => {
    if (!candidate) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const record = await client.confirmCandidate(candidate.candidateId, value, newIdempotencyKey("confirm"));
      setSavedRecord(record);
      setRecords((current) => [...current.filter((item) => item.recordId !== record.recordId), record]);
      setCandidate({ ...candidate, status: "CONFIRMED" });
      setCorrectionMode(false);
      setView("complete");
    } catch (error) {
      setErrorMessage(describeFoundationError(error));
    } finally {
      setBusy(false);
    }
  };

  const excludeCandidate = async () => {
    if (!candidate) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const excluded = await client.excludeCandidate(candidate.candidateId, newIdempotencyKey("exclude"));
      setCandidate(excluded);
      setView("complete");
    } catch (error) {
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
    return (
      <main className="gc-integrated-shell gc-integrated-shell--center">
        <section className="gc-integrated-auth" aria-labelledby="synthetic-login-title">
          <p>통합 합성 제품</p>
          <h1 id="synthetic-login-title">합성 사용자로 로그인</h1>
          <p>실제 카카오·네이버 로그인은 아직 연결하지 않았어요. 이 화면은 명시적으로 허용된 합성 계정만 사용합니다.</p>
          {shellState === "SESSION_EXPIRED" && <strong role="status">로그인 시간이 끝났어요.</strong>}
          <form onSubmit={signIn}>
            <label htmlFor="synthetic-subject">합성 사용자 ID</label>
            <input
              id="synthetic-subject"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              pattern="synthetic-[a-z0-9-]+"
              autoComplete="username"
              required
            />
            <label htmlFor="synthetic-credential">합성 테스트 자격 증명</label>
            <input
              id="synthetic-credential"
              type="password"
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              minLength={32}
              maxLength={256}
              autoComplete="current-password"
              required
            />
            <button type="submit" disabled={busy}>{busy ? "확인하고 있어요" : "합성 환경 로그인"}</button>
          </form>
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
        </section>
      </main>
    );
  }

  if (view === "evidence" && selectedRecord) {
    return (
      <EvidenceLens
        record={{
          id: selectedRecord.recordId,
          label: selectedRecord.label,
          value: selectedRecord.value,
          originalValue: selectedRecord.originalValue,
          unit: selectedRecord.unit,
          reference: "기관 참고치 미제공",
          sourceName: "허용된 합성 PDF",
          observedAt: selectedRecord.observedOn,
          sourceLocation: `${selectedRecord.evidencePage}쪽 · 합성 검증 fixture`,
          sourceDigest: `sha256:${selectedRecord.documentSha256}`,
          extractedAt: selectedRecord.confirmedAt,
          confirmedAt: selectedRecord.confirmedAt,
        }}
        onBack={() => setView("home")}
      />
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
            <div><dt>목적</dt><dd>DOCUMENT_EXTRACTION</dd></div>
            <div><dt>현재 상태</dt><dd>{consent?.status ?? "NOT_GRANTED"}</dd></div>
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
            <p className="gc-import__lead">이 통합 단계에서는 서버가 미리 허용한 합성 fixture만 처리합니다.</p>
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
        <header className="gc-import__appbar"><button type="button" onClick={() => setView("source")}>이전</button><span>앎</span><button type="button" onClick={() => setView("home")}>닫기</button></header>
        <div className="gc-import__shell">
          <section className="gc-import__processing" aria-labelledby="server-processing-title">
            <p className="gc-import__eyebrow">2. 서버 처리 상태</p>
            <h1 id="server-processing-title">서버가 알려준 상태를<br />그대로 보여드려요</h1>
            <p className="gc-import__lead" role="status" aria-live="polite">{processingCopy[processingState]}</p>
            {documentReceipt && (
              <dl className="gc-integrated-facts">
                <div><dt>문서 상태</dt><dd>{documentReceipt.status}</dd></div>
                <div><dt>파일 확인값</dt><dd><code>{documentReceipt.sha256 ? shortDigest(documentReceipt.sha256) : "아직 없음"}</code></dd></div>
                <div><dt>신뢰 경계</dt><dd>적대적 문서 격리 구역</dd></div>
                <div><dt>안전한 미리보기</dt><dd>{documentReceipt.previewAvailable ? "승인된 PNG 준비됨" : "승인 전에는 표시하지 않음"}</dd></div>
              </dl>
            )}
            <div className="gc-integrated-actions">
              {pollingPaused && <button type="button" onClick={() => { setErrorMessage(""); setPollingPaused(false); setPollingNonce((value) => value + 1); }}>상태 다시 확인</button>}
              {(processingState === "SECURITY_REJECTED" || processingState === "FAILED_TERMINAL") && <button type="button" onClick={() => setView("source")}>다른 합성 PDF 선택</button>}
            </div>
            {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
          </section>
        </div>
      </main>
    );
  }

  if (view === "review" && candidate) {
    return (
      <main className="gc-import" data-stage="review">
        <header className="gc-import__appbar"><button type="button" onClick={() => setView("processing")}>이전</button><span>앎</span><button type="button" onClick={() => setView("home")}>닫기</button></header>
        <div className="gc-import__shell">
          <section className="gc-import__review" aria-labelledby="server-candidate-title">
            <div className="gc-import__review-heading">
              <div><p className="gc-import__eyebrow">3. 출처부터 확인</p><h1 id="server-candidate-title">이 합성 후보가 맞나요?</h1><p className="gc-import__lead">후보는 서버가 만든 결정적 fixture예요. 실제 OCR 결과가 아닙니다.</p></div>
              <span className="gc-import__review-state">{candidate.status}</span>
            </div>
            <article className="gc-import__candidate">
              <p className="gc-import__candidate-label">확인할 합성 항목</p>
              <h2>{candidate.label}</h2>
              <p className="gc-import__candidate-value"><strong>{candidate.value}</strong><span>{candidate.unit}</span></p>
              <dl>
                <div><dt>검사일</dt><dd>{formatKoreanDate(candidate.observedOn)}</dd></div>
                <div><dt>문서 확인값</dt><dd><code>{shortDigest(candidate.documentSha256)}</code></dd></div>
                <div><dt>후보 근거값</dt><dd><code>{shortDigest(candidate.sourceTextSha256)}</code></dd></div>
                <div><dt>생성 방식</dt><dd>결정적 합성 fixture</dd></div>
              </dl>
            </article>
            {documentReceipt?.previewAvailable && (
              <figure className="gc-import__safe-preview">
                <img
                  src={`/api/foundation/documents/${documentReceipt.documentId}/preview`}
                  alt="승인된 합성 결과지의 첫 페이지 PNG 미리보기"
                  loading="lazy"
                />
                <figcaption>검사를 통과한 바이트에서 격리 작업자가 만든 PNG예요. 업로드한 PDF를 브라우저에서 직접 열지 않습니다.</figcaption>
              </figure>
            )}
            {correctionMode ? (
              <form className="gc-integrated-correction" onSubmit={(event) => { event.preventDefault(); void confirmCandidate(draftValue.trim()); }}>
                <label htmlFor="integrated-candidate-value">원문과 같은 값으로 수정</label>
                <input id="integrated-candidate-value" value={draftValue} onChange={(event) => setDraftValue(event.target.value)} inputMode="decimal" pattern="[0-9]{1,4}([.][0-9]{1,2})?" required />
                <div className="gc-integrated-actions"><button type="button" onClick={() => setCorrectionMode(false)}>취소</button><button type="submit" disabled={busy}>수정한 값 확인</button></div>
              </form>
            ) : (
              <div className="gc-import__review-actions">
                <button className="gc-import__action gc-import__action--primary" type="button" onClick={() => void confirmCandidate(candidate.value)} disabled={busy}>원문과 같아요</button>
                <button className="gc-import__action gc-import__action--secondary" type="button" onClick={() => setCorrectionMode(true)} disabled={busy}>값 수정</button>
                <button className="gc-import__action gc-import__action--text" type="button" onClick={() => void excludeCandidate()} disabled={busy}>이 항목 빼기</button>
              </div>
            )}
            {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
          </section>
        </div>
      </main>
    );
  }

  if (view === "complete") {
    return (
      <main className="gc-integrated-shell gc-integrated-shell--center">
        <section className="gc-integrated-auth" aria-labelledby="integrated-complete-title" role="status" aria-live="polite">
          <p>서버 처리 완료</p>
          <h1 id="integrated-complete-title">{savedRecord ? "건강 기록에 저장했어요" : "이 후보를 제외했어요"}</h1>
          <p>{savedRecord ? "Spring이 PostgreSQL에 값과 출처, 확인 버전을 함께 저장했습니다." : "서버가 후보 상태를 EXCLUDED로 기록했고 건강 기록은 만들지 않았습니다."}</p>
          {savedRecord && (
            <dl className="gc-integrated-facts">
              <div><dt>항목</dt><dd>{savedRecord.label}</dd></div>
              <div><dt>확인한 값</dt><dd>{savedRecord.value} {savedRecord.unit}</dd></div>
              <div><dt>확인 방식</dt><dd>{savedRecord.reviewDecision}</dd></div>
              <div><dt>기록 버전</dt><dd><code>{savedRecord.recordVersionId}</code></dd></div>
            </dl>
          )}
          <div className="gc-integrated-actions">
            <button type="button" onClick={() => { setView("home"); void loadProductTruth(); }}>홈으로</button>
            {savedRecord && <a href="/records">저장된 기록 보기</a>}
          </div>
        </section>
      </main>
    );
  }

  const latest = records.at(-1);
  return (
    <main className="gc-health-home">
      <div className="gc-health-home__shell">
        <header className="gc-health-home__appbar">
          <a className="gc-health-home__brand" href="#home" aria-label="앎 건강 홈"><span aria-hidden="true">앎</span><strong>앎</strong></a>
          <nav aria-label="주요 메뉴"><a href="#home" aria-current="page">홈</a><a href="/records">기록</a><a href="/data-control">데이터 관리</a></nav>
          <span className="gc-integrated-session">합성 세션 · {session?.subjectId}</span>
        </header>
        <section className="gc-health-home__hero" id="home" aria-labelledby="integrated-home-title">
          <div>
            <p className="gc-health-home__greeting">서버와 연결된 합성 건강 기록</p>
            <h1 id="integrated-home-title">값보다 먼저<br />출처를 확인하세요</h1>
            <p className="gc-health-home__hero-copy">화면의 기록은 Spring과 PostgreSQL이 소유하며, 새로고침해도 같은 합성 상태를 불러옵니다.</p>
            <div className="gc-health-home__hero-actions"><button className="gc-button gc-button--primary" type="button" onClick={beginImport}>결과지 추가</button><a className="gc-button gc-button--weak" href="/records">전체 기록 보기</a></div>
          </div>
          <aside className="gc-health-home__connection" aria-label="통합 합성 제품 상태">
            <p><strong>INTEGRATED SYNTHETIC</strong></p>
            <span>실제 개인정보 0건 · 외부 기관 연결 0곳 · 저장된 합성 기록 {records.length}개</span>
            <a href="/data-control">동의와 삭제 상태 보기</a>
          </aside>
        </section>
        <section className="gc-health-home__overview" aria-labelledby="integrated-records-title">
          <div className="gc-health-home__section-heading"><div><p>PostgreSQL에서 불러온 기록</p><h2 id="integrated-records-title">{latest ? "가장 최근에 확인한 값" : "아직 저장된 기록이 없어요"}</h2></div><span>{records.length}개</span></div>
          {latest ? (
            <article className="gc-health-home__metric-card">
              <div className="gc-health-home__metric-copy"><div className="gc-health-home__metric-topline"><span>{latest.label}</span><strong>{latest.status}</strong></div><p className="gc-health-home__metric-value"><strong>{latest.value}</strong><span>{latest.unit}</span></p><p className="gc-health-home__metric-source">허용된 합성 PDF · {formatKoreanDate(latest.observedOn)}</p></div>
              <button className="gc-button gc-button--weak" type="button" onClick={() => { setSelectedRecord(latest); setView("evidence"); }}>이 값의 근거 보기</button>
            </article>
          ) : <p className="gc-integrated-empty">허용된 합성 PDF를 추가하고 후보를 직접 확인하면 여기에 기록됩니다.</p>}
        </section>
        <section className="gc-health-home__privacy" aria-labelledby="integrated-boundary-title"><div><p>현재 허용 범위</p><h2 id="integrated-boundary-title">합성 데이터만 처리해요</h2><ul><li>실제 카카오·네이버·MyHealthWay 비활성화</li><li>OCR·의료 AI 비활성화</li><li>문서는 승인 전까지 적대적 입력으로 격리</li></ul></div><a className="gc-button gc-button--weak" href="/data-control">데이터 관리</a></section>
        {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
      </div>
    </main>
  );
}
