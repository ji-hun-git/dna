import { StatusLabel } from "@/components/evidence/StatusLabel";

export type EvidenceLensRecord = {
  id: string;
  label: string;
  value: string;
  originalValue: string;
  unit: string;
  reference: string;
  sourceName: string;
  observedAt: string;
  sourceLocation: string;
  sourceDigest: string;
  extractedAt: string;
  confirmedAt: string;
  automation?: {
    layoutModel: string;
    semanticModel: string;
    evaluationGate: string;
    disposition: string;
  };
};

export type EvidenceLensProps = {
  record: EvidenceLensRecord;
  onBack?: () => void;
};

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l4 4v14H7V3Z" />
      <path d="M14 3v5h5M10 12h5M10 16h5" />
    </svg>
  );
}

export function EvidenceLens({ record, onBack }: EvidenceLensProps) {
  const corrected = record.value !== record.originalValue;
  const marks = Array.from({ length: 40 }, (_, index) => index);

  return (
    <main className="gc-evidence-lens">
      <div className="gc-evidence-lens__shell">
        <header className="gc-evidence-lens__appbar">
          <button type="button" onClick={onBack} aria-label="이전 화면으로 돌아가기">
            <BackIcon />
          </button>
          <a href="#evidence" aria-label="앎 근거 렌즈 홈">
            <span aria-hidden="true">앎</span>
            <strong>근거 렌즈</strong>
          </a>
          <span>합성 시연 기록 · PHI 없음</span>
        </header>

        <section className="gc-evidence-lens__intro" aria-labelledby="evidence-title">
          <p>EVIDENCE LENS · VERIFIED RECORD</p>
          <h1 id="evidence-title">이 값은 어디에서<br aria-hidden="true" /> 왔을까요?</h1>
          <p>결론보다 먼저, 원문과 사람의 확인 이력을 보여드려요.</p>
        </section>

        <section className="gc-evidence-lens__stage" aria-label={`${record.label} 근거 기록`}>
          <article className="gc-evidence-lens__ledger">
            <header>
              <span>ALM · HEALTH RECORD</span>
              <span>{record.observedAt.replaceAll("-", " · ")}</span>
            </header>

            <div className="gc-evidence-lens__ledger-heading">
              <div>
                <p>검사 항목</p>
                <h2>{record.label}</h2>
              </div>
              <StatusLabel status="verified" />
            </div>

            <p className="gc-evidence-lens__value">
              <strong>{record.value}</strong>
              <span>{record.unit}</span>
            </p>

            <div
              className="gc-evidence-lens__matrix"
              role="img"
              aria-label="원문, 자동 추출 후보, 사용자 확인, 저장의 네 단계가 모두 연결됨"
            >
              {marks.map((mark) => <span key={mark} data-active={mark < 32 ? "true" : "false"} aria-hidden="true" />)}
            </div>

            <dl className="gc-evidence-lens__ledger-facts">
              <div><dt>REFERENCE</dt><dd>{record.reference}</dd></div>
              <div><dt>SOURCE</dt><dd>{record.sourceLocation}</dd></div>
              <div><dt>CHECK</dt><dd>{corrected ? "사용자 수정 후 확인" : "원문과 일치 확인"}</dd></div>
            </dl>

            <footer>
              <span>SOURCE · {record.sourceName}</span>
              <span>이 수치만으로 정상·비정상을 판정하지 않음</span>
            </footer>
          </article>

          <aside className="gc-evidence-lens__source" aria-labelledby="source-preview-title">
            <div className="gc-evidence-lens__source-heading">
              <span><DocumentIcon /></span>
              <div>
                <p>원문 위치</p>
                <h2 id="source-preview-title">결과지에서 직접 확인했어요</h2>
              </div>
            </div>

            <div className="gc-evidence-lens__paper" aria-label="합성 건강검진 결과지 원문 미리보기">
              <header>
                <span>2026 건강검진 결과 통보서</span>
                <span>DEMO · 02</span>
              </header>
              <div className="gc-evidence-lens__paper-grid" aria-hidden="true">
                <span>검사항목</span><span>결과</span><span>참고치</span>
                <span>공복혈당</span><span>96</span><span>70–99</span>
                <strong>{record.label}</strong><strong>{record.originalValue}</strong><strong>{record.reference.replace(` ${record.unit}`, "")}</strong>
                <span>비타민 D</span><span>31</span><span>30–100</span>
              </div>
              <p>{record.sourceLocation} · 원문의 해당 행을 표시한 합성 예시</p>
            </div>

            <dl className="gc-evidence-lens__source-meta">
              <div><dt>기관·문서</dt><dd>{record.sourceName}</dd></div>
              <div><dt>검사일</dt><dd><time dateTime={record.observedAt}>{record.observedAt}</time></dd></div>
              <div><dt>원문 지문</dt><dd>{record.sourceDigest}</dd></div>
            </dl>
          </aside>
        </section>

        <section className="gc-evidence-lens__history" aria-labelledby="history-title">
          <div>
            <p>PROVENANCE · FOUR CHECKS</p>
            <h2 id="history-title">값이 기록되기까지</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div><strong>원문 고정</strong><p>{record.sourceLocation}과 문서 지문을 함께 보관했어요.</p></div>
              <time dateTime={record.observedAt}>{record.observedAt}</time>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>자동 추출 후보</strong>
                <p>{record.originalValue} {record.unit}을 후보로 제시했어요. 아직 기록에는 넣지 않았어요.</p>
                {record.automation && (
                  <details className="gc-evidence-lens__automation">
                    <summary>자동 추출 방법 보기</summary>
                    <dl>
                      <div><dt>문서 구조 읽기</dt><dd>{record.automation.layoutModel}</dd></div>
                      <div><dt>의료 항목 후보</dt><dd>{record.automation.semanticModel}</dd></div>
                      <div><dt>배포 전 평가</dt><dd>{record.automation.evaluationGate}</dd></div>
                      <div><dt>저장 원칙</dt><dd>{record.automation.disposition}</dd></div>
                    </dl>
                  </details>
                )}
              </div>
              <time dateTime={record.extractedAt}>{record.extractedAt}</time>
            </li>
            <li data-emphasis="true">
              <span>03</span>
              <div>
                <strong>{corrected ? "사람이 수정하고 확인" : "사람이 원문과 일치 확인"}</strong>
                <p>{corrected ? `${record.originalValue} → ${record.value} ${record.unit}로 수정했어요.` : `${record.value} ${record.unit}, 원문과 같다고 확인했어요.`}</p>
              </div>
              <time dateTime={record.confirmedAt}>{record.confirmedAt}</time>
            </li>
            <li>
              <span>04</span>
              <div><strong>근거와 함께 저장</strong><p>값, 단위, 검사일, 원문 위치, 확인 이력을 하나로 묶었어요.</p></div>
              <span>VERIFIED</span>
            </li>
          </ol>
        </section>

        <aside className="gc-evidence-lens__boundary">
          <span aria-hidden="true">!</span>
          <div>
            <h2>이 화면은 진단 결과가 아니에요</h2>
            <p>참고치는 검사실과 검사 조건에 따라 달라질 수 있어요. 앎은 원문과 확인 이력을 설명하고, 정상·비정상 또는 질환을 판정하지 않습니다.</p>
          </div>
        </aside>

        <footer className="gc-evidence-lens__actions">
          <button type="button" className="gc-button gc-button--primary" onClick={onBack}>건강 기록으로 돌아가기</button>
        </footer>
      </div>
    </main>
  );
}
