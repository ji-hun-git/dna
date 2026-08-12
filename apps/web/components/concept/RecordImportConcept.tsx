import { ChangeEvent, useRef } from "react";
import type { LocalDocumentReceipt } from "@/lib/imports/local-document";
import { formatKoreanDate } from "@/lib/format/korean-date";

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
      <p className="gc-import__eyebrow">1. 결과지 선택</p>
      <h1 id="import-source-title">결과지가<br />어디에 있나요?</h1>
      <p className="gc-import__lead">
        지금은 기기에 있는 PDF나 사진을 선택할 수 있어요. 직접 확인한 항목만 화면에 반영합니다.
      </p>

      <div className="gc-import__choices" aria-label="결과지 가져오기 방법">
        <button
          type="button"
          disabled={isInspecting}
          aria-busy={isInspecting}
          onClick={() => { onChooseSource?.("device"); fileInput.current?.click(); }}
        >
          <span className="gc-import__choice-icon"><FileIcon /></span>
          <span><strong>{isInspecting ? "파일을 확인하고 있어요" : "기기에서 파일 선택"}</strong><small>PDF, PNG, JPEG · 최대 20MB</small></span>
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
          <span><strong>종이 결과지 촬영</strong><small>아직 준비 중이에요</small></span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" onClick={() => onChooseSource?.("provider")}>
          <span className="gc-import__choice-icon gc-import__choice-icon--link"><LinkIcon /></span>
          <span><strong>기관에서 가져오기</strong><small>아직 준비 중이에요</small></span>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {sourceError && <p className="gc-import__source-feedback gc-import__source-feedback--error" role="alert">{sourceError}</p>}
      {!sourceError && sourceMessage && <p className="gc-import__source-feedback" role="status">{sourceMessage}</p>}

      <p className="gc-import__privacy-note">
        이 예시에서는 선택한 파일을 서버로 보내지 않아요. 브라우저 안에서 파일 종류와 크기, 확인값만 살펴봅니다.
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
      <p className="gc-import__eyebrow">2. 파일 확인</p>
      <h1 id="import-processing-title">파일 확인을<br />마쳤어요</h1>
      <p className="gc-import__lead">이 기기에서 파일 종류와 크기, 확인값만 살펴봤어요. 파일 내용은 읽지 않았습니다.</p>

      <div className="gc-import__receipt" aria-label="파일 확인 결과">
        <div className="gc-import__receipt-head">
          <span>파일 확인 결과 · 예시</span>
          <strong>{documentReceipt.format}</strong>
        </div>
        <dl>
          <div><dt>파일 크기</dt><dd>{documentReceipt.sizeLabel}</dd></div>
          <div><dt>파일 확인값</dt><dd><code title={documentReceipt.sha256}>{digest}</code></dd></div>
          <div><dt>예시 항목</dt><dd>{totalItems}개</dd></div>
        </dl>
        <ol>
          <li><span aria-hidden="true">✓</span> 허용된 파일 형식과 크기 확인</li>
          <li><span aria-hidden="true">✓</span> 이 기기에서 파일 확인값 생성</li>
          <li><span aria-hidden="true">✓</span> 파일 내용과 무관한 예시 항목 준비</li>
        </ol>
      </div>

      <div className="gc-import__demo-boundary">
        <strong>예시 화면이에요</strong>
        <p>아래 값은 선택한 파일에서 읽은 결과가 아니에요. 파일에서 검사 수치를 읽는 기능은 아직 연결하지 않았습니다.</p>
      </div>

      <button className="gc-import__action gc-import__action--primary gc-import__processing-cta" type="button" onClick={onBeginReview}>
        예시 항목 {totalItems}개 확인하기
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
          <p className="gc-import__eyebrow">3. 항목 확인 · {currentItem} / {totalItems}</p>
          <h1 id="import-review-title">이 값이 맞나요?</h1>
          <p className="gc-import__lead">예시 항목을 하나씩 보여드려요. 선택한 파일에서 읽은 값은 아니에요.</p>
        </div>
        <span className="gc-import__review-state">확인 전</span>
      </div>

      <div className="gc-import__review-grid">
        <figure className="gc-import__source-preview">
          <div className="gc-import__paper" role="img" aria-label={`${sourceName} 형식으로 만든 ${candidate.label} 예시 영역`}>
            <div className="gc-import__paper-head">
              <span>건강검진 결과</span><span>예시 · 04</span>
            </div>
            <div className="gc-import__paper-row gc-import__paper-row--muted"><span>검사 항목</span><span>결과</span><span>단위</span></div>
            <div className="gc-import__paper-row gc-import__paper-row--focus">
              <span>{candidate.label}<small>HbA1c</small></span>
              <strong>{candidate.value}</strong>
              <span>{candidate.unit}</span>
            </div>
            <div className="gc-import__paper-rule" />
            <p>참고치 · {candidate.reference}</p>
          </div>
          <figcaption>예시 원문 위치</figcaption>
        </figure>

        <article className="gc-import__candidate">
          <p className="gc-import__candidate-label">확인할 예시 항목</p>
          <h2>{candidate.label}</h2>
          <p className="gc-import__candidate-value"><strong>{candidate.value}</strong><span>{candidate.unit}</span></p>
          <dl>
            <div><dt>검사일</dt><dd><time dateTime={observedAt}>{formatKoreanDate(observedAt)}</time></dd></div>
            <div><dt>출처</dt><dd>{sourceName}</dd></div>
            <div><dt>참고치</dt><dd>{candidate.reference}</dd></div>
          </dl>
          <p className="gc-import__meaning">참고치는 검사실과 검사 조건에 따라 달라질 수 있어요.</p>
        </article>
      </div>

      <div className="gc-import__review-actions">
        <button className="gc-import__action gc-import__action--primary" type="button" onClick={onConfirm}>원문과 같아요</button>
        <button className="gc-import__action gc-import__action--secondary" type="button" onClick={onEdit}>값 수정</button>
        <button className="gc-import__action gc-import__action--text" type="button" onClick={onExclude}>이 항목 빼기</button>
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
      <p className="gc-import__eyebrow">4. 화면에 반영</p>
      <h1 id="import-complete-title">예시 항목 {confirmedCount}개를<br />확인했어요</h1>
      <p className="gc-import__lead">추가하면 이 시연 화면에 값과 출처, 확인 과정이 함께 표시돼요.</p>

      <div className="gc-import__summary">
        <div><span>확인한 항목</span><strong>{confirmedCount}개</strong></div>
        <div><span>제외한 항목</span><strong>{excludedCount}개</strong></div>
        <div><span>출처</span><strong>{sourceName}</strong></div>
      </div>

      <div className="gc-import__complete-actions">
        <button className="gc-import__action gc-import__action--primary" type="button" onClick={onSave}>시연 화면에 추가</button>
        <button className="gc-import__action gc-import__action--secondary" type="button" onClick={onReviewAgain}>처음부터 다시 확인</button>
      </div>
      <p className="gc-import__boundary">이 값만으로 건강 상태나 질환을 판단할 수 없어요. 결과지와 의료진 설명을 함께 확인하세요.</p>
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
        <a href="#import" aria-label="결과지 가져오기"><span aria-hidden="true">앎</span></a>
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
