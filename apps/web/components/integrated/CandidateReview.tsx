"use client";

import { useEffect, useRef, useState } from "react";
import type { FoundationCandidate } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { earliestCorrectableObservedOn, isCorrectableObservedOn, localIsoDate } from "@/lib/format/observed-on";
import { labelCandidateStatus } from "@/lib/format/status-labels";
import { shortDigest } from "@/lib/format/short-digest";

function percent(fraction: number) {
  return `${Math.round(fraction * 100)}%`;
}

/** The line's place on the page in plain words; a position, never a meaning. */
function describeEvidenceBox(box: NonNullable<FoundationCandidate["evidenceBox"]>) {
  return `왼쪽 ${percent(box.x)} · 위 ${percent(box.y)} · 너비 ${percent(box.width)} · 높이 ${percent(box.height)}`;
}

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when the string is a real calendar date (rejects e.g. 2026-02-30). */
function isRealCalendarDate(value: string) {
  const match = isoDatePattern.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toISOString().slice(0, 10) === value;
}

/** The reason a drafted exam date cannot be confirmed, in Korean, or "" when it is valid. */
function describeInvalidObservedOn(value: string, today: string) {
  if (!isRealCalendarDate(value)) return "날짜를 YYYY-MM-DD 형식으로 입력해 주세요.";
  if (value < earliestCorrectableObservedOn) return "1900년 이전 날짜는 쓸 수 없어요.";
  if (value > today) return "오늘 이후 날짜는 쓸 수 없어요.";
  return "";
}

type CandidateReviewProps = {
  candidate: FoundationCandidate;
  previewUrl?: string;
  busy: boolean;
  errorMessage: string;
  onConfirm: (value: string, observedOn?: string) => void;
  onExclude: () => void;
  onBack: () => void;
  onClose: () => void;
};

export function CandidateReview({
  candidate,
  previewUrl,
  busy,
  errorMessage,
  onConfirm,
  onExclude,
  onBack,
  onClose,
}: CandidateReviewProps) {
  const [correctionMode, setCorrectionMode] = useState(false);
  const [draftValue, setDraftValue] = useState(candidate.value);
  const [dateCorrectionMode, setDateCorrectionMode] = useState(false);
  const [draftObservedOn, setDraftObservedOn] = useState(candidate.observedOn);
  const today = localIsoDate();
  const draftDateValid = isCorrectableObservedOn(draftObservedOn, today);
  const [reviewedCandidateId, setReviewedCandidateId] = useState(candidate.candidateId);
  const heading = useRef<HTMLHeadingElement>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewSource, setPreviewSource] = useState(previewUrl);
  if (previewSource !== previewUrl) {
    setPreviewSource(previewUrl);
    setPreviewLoaded(false);
    setPreviewFailed(false);
  }
  const previewReady = !!previewUrl && previewLoaded && !previewFailed && previewSource === previewUrl;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [candidate.candidateId]);

  // Each candidate of the same document reuses this screen, so the draft value
  // and the correction form reset as soon as the server hands over the next one.
  if (reviewedCandidateId !== candidate.candidateId) {
    setReviewedCandidateId(candidate.candidateId);
    setDraftValue(candidate.value);
    setDraftObservedOn(candidate.observedOn);
    setCorrectionMode(false);
    setDateCorrectionMode(false);
  }

  return (
    <main className="gc-import" data-stage="review">
      <header className="gc-import__appbar">
        <button type="button" onClick={onBack}>이전</button>
        <span>앎</span>
        <button type="button" onClick={onClose}>닫기</button>
      </header>
      <div className="gc-import__shell">
        <section className="gc-import__review" aria-labelledby="server-candidate-title">
          <div className="gc-import__review-heading">
            <div>
              <p className="gc-import__eyebrow">
                3. 출처부터 확인 ·{" "}
                <span className="gc-review-progress" role="status" aria-label="검토 진행">
                  {candidate.ordinal} / {candidate.totalCandidates}
                </span>
              </p>
              <h1 id="server-candidate-title" ref={heading} tabIndex={-1}>결과지에 이렇게 적혀 있나요?</h1>
              <p className="gc-import__lead">결과지의 글자 정보에서 읽은 값이에요. 이미지를 판독한 결과가 아니며, 확인하기 전까지 기록이 아니에요.</p>
            </div>
            <span className="gc-import__review-state">{labelCandidateStatus(candidate.status)}</span>
          </div>
          <article className="gc-import__candidate">
            <p className="gc-import__candidate-label">확인할 항목 · 예시 데이터</p>
            <h2>{candidate.label}</h2>
            <p className="gc-import__candidate-value"><strong>{candidate.value}</strong><span>{candidate.unit}</span></p>
            <p className="gc-import__candidate-source">결과지 텍스트에서 읽은 값 · 문자 인식 아님</p>
            <dl>
              <div>
                <dt>검사일</dt>
                <dd>
                  {formatKoreanDate(candidate.observedOn)}
                  {!correctionMode && !dateCorrectionMode && (
                    <button type="button" className="gc-import__action gc-import__action--text" onClick={() => setDateCorrectionMode(true)} disabled={busy || !previewReady}>검사일 수정</button>
                  )}
                </dd>
              </div>
              <div><dt>근거 쪽수</dt><dd>{candidate.evidencePage}쪽</dd></div>
              {candidate.evidenceBox && <div><dt>근거 위치</dt><dd>{describeEvidenceBox(candidate.evidenceBox)}</dd></div>}
            </dl>
            <details className="gc-review-evidence"><summary>출처 정보 자세히</summary><dl>
              <div><dt>문서 확인값</dt><dd><code>{shortDigest(candidate.documentSha256)}</code></dd></div>
              <div><dt>후보 근거값</dt><dd><code>{shortDigest(candidate.sourceTextSha256)}</code></dd></div>
              <div><dt>생성 방식</dt><dd>결과지 텍스트에서 읽은 값 · 문자 인식 아님</dd></div>
            </dl></details>
          </article>
          {previewUrl && !previewFailed ? (
            <details className="gc-review-source" open>
            <summary>결과지 원문 보기 · 예시 데이터</summary>
            <figure className="gc-import__safe-preview">
              <img key={previewUrl} src={previewUrl} alt="승인된 합성 결과지의 첫 페이지 PNG 미리보기" onLoad={() => setPreviewLoaded(true)} onError={() => { setPreviewLoaded(false); setPreviewFailed(true); }} />
              <figcaption>결과지 첫 페이지예요. 값의 의미나 건강 상태를 판단하지 않아요.</figcaption>
              <a href={previewUrl} target="_blank" rel="noreferrer">원문 크게 보기</a>
            </figure>
            </details>
          ) : <p role="status">원문 미리보기를 확인할 수 없어요. 확인을 잠시 멈추고 다시 불러와 주세요. {previewUrl && <button type="button" onClick={() => setPreviewFailed(false)}>다시 불러오기</button>}</p>}
          {correctionMode ? (
            <form
              className="gc-integrated-correction gc-review-decision-bar"
              onSubmit={(event) => { event.preventDefault(); if (!busy && previewReady) onConfirm(draftValue.trim()); }}
            >
              <label htmlFor="integrated-candidate-value">원문과 같은 값으로 수정</label>
              <input
                id="integrated-candidate-value"
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                inputMode="decimal"
                autoFocus
                disabled={busy}
                pattern="[0-9]{1,4}([.][0-9]{1,2})?"
                required
              />
              <div className="gc-integrated-actions">
                <button type="button" onClick={() => { setCorrectionMode(false); setDraftValue(candidate.value); }}>취소</button>
                <button type="submit" disabled={busy || !previewReady}>{busy ? "저장 중" : "수정한 값 확인"}</button>
              </div>
            </form>
          ) : dateCorrectionMode ? (
            <form
              className="gc-integrated-correction gc-review-decision-bar"
              onSubmit={(event) => {
                event.preventDefault();
                if (busy || !previewReady || !draftDateValid) return;
                if (draftObservedOn !== candidate.observedOn) onConfirm(candidate.value, draftObservedOn);
                else onConfirm(candidate.value);
              }}
            >
              <label htmlFor="integrated-candidate-observed-on">검사일 수정</label>
              <p id="integrated-candidate-observed-on-help">결과지에 적힌 검사일과 다르면 고쳐 주세요. 값의 의미는 판단하지 않아요.</p>
              <input
                id="integrated-candidate-observed-on"
                type="date"
                value={draftObservedOn}
                min="1900-01-01"
                max={today}
                onChange={(event) => setDraftObservedOn(event.target.value)}
                aria-describedby={
                  draftDateValid
                    ? "integrated-candidate-observed-on-help"
                    : "integrated-candidate-observed-on-help integrated-candidate-observed-on-error"
                }
                aria-invalid={draftDateValid ? undefined : "true"}
                autoFocus
                disabled={busy}
                required
              />
              {!draftDateValid && (
                <p id="integrated-candidate-observed-on-error" role="alert">
                  {describeInvalidObservedOn(draftObservedOn, today)}
                </p>
              )}
              <div className="gc-integrated-actions">
                <button type="button" onClick={() => { setDateCorrectionMode(false); setDraftObservedOn(candidate.observedOn); }}>취소</button>
                <button type="submit" disabled={busy || !previewReady || !draftDateValid}>{busy ? "저장 중" : "수정한 검사일 확인"}</button>
              </div>
            </form>
          ) : (
            <div className="gc-import__review-actions gc-review-decision-bar" aria-label="항목 확인">
              <button className="gc-import__action gc-import__action--text" type="button" aria-label="제외: 이 항목 빼기" onClick={onExclude} disabled={busy}>제외</button>
              <button className="gc-import__action gc-import__action--secondary" type="button" aria-label="값 수정" onClick={() => setCorrectionMode(true)} disabled={busy || !previewReady}>수정</button>
              <button className="gc-import__action gc-import__action--primary" type="button" aria-label="확인: 원문과 같아요" onClick={() => onConfirm(candidate.value)} disabled={busy || !previewReady}>{busy ? "저장 중" : "확인"}</button>
            </div>
          )}
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
        </section>
      </div>
    </main>
  );
}
