import { ChangeEvent, useRef } from "react";
import type { LocalDocumentReceipt } from "@/lib/imports/local-document";

export type RecordImportStage = "source" | "processing" | "review" | "complete";

export type RecordImportCandidate = {
  label: string;
  value: string;
  unit: string;
  reference: string;
};

export type RecordImportConceptProps = {
  stage: RecordImportStage;
  sourceName: string;
  observedAt: string;
  currentItem: number;
  totalItems: number;
  candidate: RecordImportCandidate;
  confirmedCount?: number;
  excludedCount?: number;
  documentReceipt?: LocalDocumentReceipt;
  sourceMessage?: string;
  sourceError?: string;
  isInspecting?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  onChooseSource?: (source: "device" | "camera" | "provider") => void;
  onFileSelect?: (file: File) => void;
  onBeginReview?: () => void;
  onConfirm?: () => void;
  onEdit?: () => void;
  onExclude?: () => void;
  onSave?: () => void;
  onReviewAgain?: () => void;
};

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5M10 13h5M10 17h5" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h3l1.5-2h5L16 7h3a2 2 0 0 1 2 2v9H3V9a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 14.5 14.5 9.5M7.5 17H6a4 4 0 0 1 0-8h3M16.5 7H18a4 4 0 1 1 0 8h-3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 12 4 4 8-8" />
    </svg>
  );
}

function StepProgress({ current, total }: { current: number; total: number }) {
  const percent = Math.round((current / total) * 100);
  return (
    <div className="gc-import__progress-wrap">
      <div className="gc-import__progress-copy">
        <span>결과지 가져오기</span>
        <span>{current} / {total}</span>
      </div>
      <div
        className="gc-import__progress"
        role="progressbar"
        aria-label="결과지 가져오기 진행률"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SourceStage({
  onChooseSource,
  onFileSelect,
  sourceMessage,
  sourceError,
  isInspecting,
}: Pick<RecordImportConceptProps, "onChooseSource" | "onFileSelect" | "sourceMessage" | "sourceError" | "isInspecting">) {
  const fileInput = useRef<HTMLInputElement>(null);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) onFileSelect?.(file);
    event.currentTarget.value = "";
  };

  return (
    <section className="gc-import__question" aria-labelledby="import-source-title">
      <p className="gc-import__eyebrow">첫 번째로 알려주세요</p>
      <h1 id="import-source-title">어떤 결과지를<br />가져올까요?</h1>
      <p className="gc-import__lead">
        파일을 올리거나 종이 결과지를 촬영해 주세요. 항목을 직접 확인하기 전에는 건강 기록에 반영되지 않아요.
      </p>

      <div className="gc-import__choices" aria-label="결과지 가져오기 방법">
        <button
          type="button"
          disabled={isInspecting}
          aria-busy={isInspecting}
          onClick={() => { onChooseSource?.("device"); fileInput.current?.click(); }}
        >
          <span className="gc-import__choice-icon"><FileIcon /></span>
          <span><strong>{isInspecting ? "파일을 확인하고 있어요" : "이 기기에 있어요"}</strong><small>PDF, PNG, JPEG · 최대 20MB</small></span>
          <span aria-hidden="true">›</span>
        </button>
        <input
          ref={fileInput}
          className="gc-import__file-input"
          type="file"
          accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
          aria-label="기기에서 결과지 선택"
          onChange={selectFile}
        />
        <button type="button" onClick={() => onChooseSource?.("camera")}>
          <span className="gc-import__choice-icon gc-import__choice-icon--camera"><CameraIcon /></span>
          <span><strong>종이로 가지고 있어요</strong><small>카메라로 한 장씩 촬영</small></span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" onClick={() => onChooseSource?.("provider")}>
          <span className="gc-import__choice-icon gc-import__choice-icon--link"><LinkIcon /></span>
          <span><strong>병원에서 바로 연결할게요</strong><small>연결 가능한 기관 확인</small></span>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {sourceError && <p className="gc-import__source-feedback gc-import__source-feedback--error" role="alert">{sourceError}</p>}
      {!sourceError && sourceMessage && <p className="gc-import__source-feedback" role="status">{sourceMessage}</p>}

      <p className="gc-import__privacy-note">
        이 프로토타입에서는 파일이 기기 밖으로 전송되지 않아요. 실제 클라우드 처리는 별도의 명시적 동의 뒤에만 연결합니다.
      </p>
    </section>
  );
}

function ProcessingStage({
  documentReceipt,
  totalItems,
  onBeginReview,
}: Pick<RecordImportConceptProps, "documentReceipt" | "totalItems" | "onBeginReview">) {
  if (!documentReceipt) return null;
  const digest = `${documentReceipt.sha256.slice(7, 19)}…${documentReceipt.sha256.slice(-8)}`;

  return (
    <section className="gc-import__processing" aria-labelledby="import-processing-title">
      <div className="gc-import__processing-mark" aria-hidden="true"><CheckIcon /></div>
      <p className="gc-import__eyebrow">기기 안에서 준비됐어요</p>
      <h1 id="import-processing-title">검토할 항목을<br />안전하게 나눴어요</h1>
      <p className="gc-import__lead">파일 형식과 지문을 이 브라우저 안에서 확인했습니다. 아직 건강 기록에는 아무것도 추가되지 않았어요.</p>

      <div className="gc-import__receipt" aria-label="로컬 파일 처리 영수증">
        <div className="gc-import__receipt-head">
          <span>LOCAL RECEIPT · SYNTHETIC</span>
          <strong>{documentReceipt.format}</strong>
        </div>
        <dl>
          <div><dt>파일 크기</dt><dd>{documentReceipt.sizeLabel}</dd></div>
          <div><dt>로컬 SHA-256</dt><dd><code title={documentReceipt.sha256}>{digest}</code></dd></div>
          <div><dt>검토할 항목</dt><dd>{totalItems}개</dd></div>
        </dl>
        <ol>
          <li><span aria-hidden="true">✓</span> 허용된 파일 형식과 크기 확인</li>
          <li><span aria-hidden="true">✓</span> 브라우저 내부 파일 지문 생성</li>
          <li><span aria-hidden="true">✓</span> 합성 분석 fixture 연결</li>
        </ol>
      </div>

      <div className="gc-import__demo-boundary">
        <strong>합성 데모예요</strong>
        <p>아래 수치는 업로드한 파일에서 읽은 실제 결과가 아닙니다. 실제 OCR·의료 데이터 처리는 아직 연결하지 않았어요.</p>
      </div>

      <button className="gc-import__action gc-import__action--primary gc-import__processing-cta" type="button" onClick={onBeginReview}>
        {totalItems}개 항목 검토 시작
      </button>
    </section>
  );
}

function ReviewStage({
  sourceName,
  observedAt,
  currentItem,
  totalItems,
  candidate,
  onConfirm,
  onEdit,
  onExclude,
}: Omit<RecordImportConceptProps, "stage">) {
  return (
    <section className="gc-import__review" aria-labelledby="import-review-title">
      <div className="gc-import__review-heading">
        <div>
          <p className="gc-import__eyebrow">항목 {currentItem} / {totalItems}</p>
          <h1 id="import-review-title">이 수치가 맞나요?</h1>
          <p className="gc-import__lead">원본의 한 항목씩 확인해요. 한 번에 모두 승인하지 않아요.</p>
        </div>
        <span className="gc-import__review-state">확인 필요</span>
      </div>

      <div className="gc-import__review-grid">
        <figure className="gc-import__source-preview">
          <div className="gc-import__paper" role="img" aria-label={`${sourceName}에서 찾은 ${candidate.label} 원본 영역`}>
            <div className="gc-import__paper-head">
              <span>건강검진 결과</span><span>LAB · 04</span>
            </div>
            <div className="gc-import__paper-row gc-import__paper-row--muted"><span>검사 항목</span><span>결과</span><span>단위</span></div>
            <div className="gc-import__paper-row gc-import__paper-row--focus">
              <span>{candidate.label}<small>HbA1c</small></span>
              <strong>{candidate.value}</strong>
              <span>{candidate.unit}</span>
            </div>
            <div className="gc-import__paper-rule" />
            <p>참고 범위 · {candidate.reference}</p>
          </div>
          <figcaption>원본에서 찾은 위치</figcaption>
        </figure>

        <article className="gc-import__candidate">
          <p className="gc-import__candidate-label">확인할 항목</p>
          <h2>{candidate.label}</h2>
          <p className="gc-import__candidate-value"><strong>{candidate.value}</strong><span>{candidate.unit}</span></p>
          <dl>
            <div><dt>검사일</dt><dd><time dateTime={observedAt}>{observedAt}</time></dd></div>
            <div><dt>출처</dt><dd>{sourceName}</dd></div>
            <div><dt>참고 범위</dt><dd>{candidate.reference}</dd></div>
          </dl>
          <p className="gc-import__meaning">수치의 의미는 확인 완료 뒤, 출처와 기준을 함께 보여드려요.</p>
        </article>
      </div>

      <div className="gc-import__review-actions">
        <button className="gc-import__action gc-import__action--primary" type="button" onClick={onConfirm}>맞아요</button>
        <button className="gc-import__action gc-import__action--secondary" type="button" onClick={onEdit}>수정할게요</button>
        <button className="gc-import__action gc-import__action--text" type="button" onClick={onExclude}>기록에서 제외</button>
      </div>
    </section>
  );
}

function CompleteStage({
  confirmedCount,
  excludedCount,
  sourceName,
  onSave,
  onReviewAgain,
}: Pick<RecordImportConceptProps, "confirmedCount" | "excludedCount" | "sourceName" | "onSave" | "onReviewAgain">) {
  return (
    <section className="gc-import__complete" aria-labelledby="import-complete-title">
      <div className="gc-import__complete-mark"><CheckIcon /></div>
      <p className="gc-import__eyebrow">확인이 끝났어요</p>
      <h1 id="import-complete-title">{confirmedCount}개 항목을<br />기록할 준비가 됐어요</h1>
      <p className="gc-import__lead">확인한 값과 원본 출처가 한 묶음으로 저장돼요.</p>

      <div className="gc-import__summary">
        <div><span>확인한 항목</span><strong>{confirmedCount}개</strong></div>
        <div><span>제외한 항목</span><strong>{excludedCount}개</strong></div>
        <div><span>출처</span><strong>{sourceName}</strong></div>
      </div>

      <div className="gc-import__complete-actions">
        <button className="gc-import__action gc-import__action--primary" type="button" onClick={onSave}>건강 기록에 추가</button>
        <button className="gc-import__action gc-import__action--secondary" type="button" onClick={onReviewAgain}>다시 확인</button>
      </div>
      <p className="gc-import__boundary">추가한 수치만으로 질환을 진단하지 않아요. 원본·검사 조건·의료진 설명을 함께 확인해 주세요.</p>
    </section>
  );
}

export function RecordImportConcept(props: RecordImportConceptProps) {
  const step = props.stage === "source" ? 1 : props.stage === "processing" ? 2 : props.stage === "review" ? 3 : 4;
  const confirmedCount = props.confirmedCount ?? props.totalItems;
  const excludedCount = props.excludedCount ?? 0;
  return (
    <main className="gc-import" data-stage={props.stage}>
      <header className="gc-import__appbar">
        <button type="button" aria-label="이전 화면" onClick={props.onBack}><BackIcon /></button>
        <a href="#import" aria-label="앎 건강 홈"><span aria-hidden="true">앎</span></a>
        <button type="button" onClick={props.onClose}>닫기</button>
      </header>
      <div className="gc-import__shell" id="import">
        <StepProgress current={step} total={4} />
        {props.stage === "source" && (
          <SourceStage
            onChooseSource={props.onChooseSource}
            onFileSelect={props.onFileSelect}
            sourceMessage={props.sourceMessage}
            sourceError={props.sourceError}
            isInspecting={props.isInspecting}
          />
        )}
        {props.stage === "processing" && (
          <ProcessingStage
            documentReceipt={props.documentReceipt}
            totalItems={props.totalItems}
            onBeginReview={props.onBeginReview}
          />
        )}
        {props.stage === "review" && <ReviewStage {...props} />}
        {props.stage === "complete" && (
          <CompleteStage
            confirmedCount={confirmedCount}
            excludedCount={excludedCount}
            sourceName={props.sourceName}
            onSave={props.onSave}
            onReviewAgain={props.onReviewAgain}
          />
        )}
      </div>
    </main>
  );
}
