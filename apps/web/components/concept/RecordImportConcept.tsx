export type RecordImportStage = "source" | "review" | "complete";

export type RecordImportConceptProps = {
  stage: RecordImportStage;
  sourceName: string;
  observedAt: string;
  currentItem: number;
  totalItems: number;
  candidate: {
    label: string;
    value: string;
    unit: string;
    reference: string;
  };
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

function SourceStage() {
  return (
    <section className="gc-import__question" aria-labelledby="import-source-title">
      <p className="gc-import__eyebrow">첫 번째로 알려주세요</p>
      <h1 id="import-source-title">어떤 결과지를<br />가져올까요?</h1>
      <p className="gc-import__lead">
        파일을 올리거나 종이 결과지를 촬영해 주세요. 항목을 직접 확인하기 전에는 건강 기록에 반영되지 않아요.
      </p>

      <div className="gc-import__choices" aria-label="결과지 가져오기 방법">
        <button type="button">
          <span className="gc-import__choice-icon"><FileIcon /></span>
          <span><strong>이 기기에 있어요</strong><small>PDF, DICOM, CSV, 이미지</small></span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button">
          <span className="gc-import__choice-icon gc-import__choice-icon--camera"><CameraIcon /></span>
          <span><strong>종이로 가지고 있어요</strong><small>카메라로 한 장씩 촬영</small></span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button">
          <span className="gc-import__choice-icon gc-import__choice-icon--link"><LinkIcon /></span>
          <span><strong>병원에서 바로 연결할게요</strong><small>연결 가능한 기관 확인</small></span>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <p className="gc-import__privacy-note">
        원본은 암호화해 처리하고, 저장 방식은 확인 단계에서 직접 선택할 수 있어요.
      </p>
    </section>
  );
}

function ReviewStage({
  sourceName,
  observedAt,
  currentItem,
  totalItems,
  candidate,
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
        <button className="gc-import__action gc-import__action--primary" type="button">맞아요</button>
        <button className="gc-import__action gc-import__action--secondary" type="button">수정할게요</button>
        <button className="gc-import__action gc-import__action--text" type="button">기록에서 제외</button>
      </div>
    </section>
  );
}

function CompleteStage({ totalItems, sourceName }: Pick<RecordImportConceptProps, "totalItems" | "sourceName">) {
  return (
    <section className="gc-import__complete" aria-labelledby="import-complete-title">
      <div className="gc-import__complete-mark"><CheckIcon /></div>
      <p className="gc-import__eyebrow">확인이 끝났어요</p>
      <h1 id="import-complete-title">{totalItems}개 항목을<br />기록할 준비가 됐어요</h1>
      <p className="gc-import__lead">확인한 값과 원본 출처가 한 묶음으로 저장돼요.</p>

      <div className="gc-import__summary">
        <div><span>확인한 항목</span><strong>{totalItems}개</strong></div>
        <div><span>제외한 항목</span><strong>1개</strong></div>
        <div><span>출처</span><strong>{sourceName}</strong></div>
      </div>

      <div className="gc-import__complete-actions">
        <button className="gc-import__action gc-import__action--primary" type="button">건강 기록에 추가</button>
        <button className="gc-import__action gc-import__action--secondary" type="button">다시 확인</button>
      </div>
      <p className="gc-import__boundary">추가한 수치만으로 질환을 진단하지 않아요. 원본·검사 조건·의료진 설명을 함께 확인해 주세요.</p>
    </section>
  );
}

export function RecordImportConcept(props: RecordImportConceptProps) {
  const step = props.stage === "source" ? 1 : props.stage === "review" ? 2 : 3;
  return (
    <main className="gc-import" data-stage={props.stage}>
      <header className="gc-import__appbar">
        <button type="button" aria-label="이전 화면"><BackIcon /></button>
        <a href="#import" aria-label="앎 건강 홈"><span aria-hidden="true">앎</span></a>
        <button type="button">닫기</button>
      </header>
      <div className="gc-import__shell" id="import">
        <StepProgress current={step} total={3} />
        {props.stage === "source" && <SourceStage />}
        {props.stage === "review" && <ReviewStage {...props} />}
        {props.stage === "complete" && <CompleteStage totalItems={props.totalItems} sourceName={props.sourceName} />}
      </div>
    </main>
  );
}
