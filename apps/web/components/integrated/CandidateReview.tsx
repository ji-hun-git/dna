"use client";

import { useState } from "react";
import type { FoundationCandidate } from "@/lib/foundation/client";
import { formatKoreanDate } from "@/lib/format/korean-date";
import { labelCandidateStatus } from "@/lib/format/status-labels";
import { shortDigest } from "@/lib/format/short-digest";

type CandidateReviewProps = {
  candidate: FoundationCandidate;
  previewUrl?: string;
  busy: boolean;
  errorMessage: string;
  onConfirm: (value: string) => void;
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
  const [reviewedCandidateId, setReviewedCandidateId] = useState(candidate.candidateId);

  // Each candidate of the same document reuses this screen, so the draft value
  // and the correction form reset as soon as the server hands over the next one.
  if (reviewedCandidateId !== candidate.candidateId) {
    setReviewedCandidateId(candidate.candidateId);
    setDraftValue(candidate.value);
    setCorrectionMode(false);
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
              <h1 id="server-candidate-title">이 합성 후보가 맞나요?</h1>
              <p className="gc-import__lead">후보는 서버가 미리 정한 예시 값이에요. 실제 문자 인식 결과가 아닙니다.</p>
            </div>
            <span className="gc-import__review-state">{labelCandidateStatus(candidate.status)}</span>
          </div>
          <article className="gc-import__candidate">
            <p className="gc-import__candidate-label">확인할 항목</p>
            <h2>{candidate.label}</h2>
            <p className="gc-import__candidate-value"><strong>{candidate.value}</strong><span>{candidate.unit}</span></p>
            <dl>
              <div><dt>검사일</dt><dd>{formatKoreanDate(candidate.observedOn)}</dd></div>
              <div><dt>근거 쪽수</dt><dd>{candidate.evidencePage}쪽</dd></div>
              <div><dt>문서 확인값</dt><dd><code>{shortDigest(candidate.documentSha256)}</code></dd></div>
              <div><dt>후보 근거값</dt><dd><code>{shortDigest(candidate.sourceTextSha256)}</code></dd></div>
              <div><dt>생성 방식</dt><dd>서버가 미리 정한 예시 값</dd></div>
            </dl>
          </article>
          {previewUrl && (
            <figure className="gc-import__safe-preview">
              <img src={previewUrl} alt="승인된 합성 결과지의 첫 페이지 PNG 미리보기" loading="lazy" />
              <figcaption>검사를 통과한 바이트에서 격리 작업자가 만든 PNG예요. 업로드한 PDF를 브라우저에서 직접 열지 않습니다.</figcaption>
            </figure>
          )}
          {correctionMode ? (
            <form
              className="gc-integrated-correction"
              onSubmit={(event) => { event.preventDefault(); onConfirm(draftValue.trim()); }}
            >
              <label htmlFor="integrated-candidate-value">원문과 같은 값으로 수정</label>
              <input
                id="integrated-candidate-value"
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                inputMode="decimal"
                pattern="[0-9]{1,4}([.][0-9]{1,2})?"
                required
              />
              <div className="gc-integrated-actions">
                <button type="button" onClick={() => { setCorrectionMode(false); setDraftValue(candidate.value); }}>취소</button>
                <button type="submit" disabled={busy}>수정한 값 확인</button>
              </div>
            </form>
          ) : (
            <div className="gc-import__review-actions">
              <button className="gc-import__action gc-import__action--primary" type="button" onClick={() => onConfirm(candidate.value)} disabled={busy}>원문과 같아요</button>
              <button className="gc-import__action gc-import__action--secondary" type="button" onClick={() => setCorrectionMode(true)} disabled={busy}>값 수정</button>
              <button className="gc-import__action gc-import__action--text" type="button" onClick={onExclude} disabled={busy}>이 항목 빼기</button>
            </div>
          )}
          {errorMessage && <p className="gc-integrated-error" role="alert">{errorMessage}</p>}
        </section>
      </div>
    </main>
  );
}
