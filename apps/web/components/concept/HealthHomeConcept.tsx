import { StatusLabel } from "@/components/evidence/StatusLabel";

export type HealthHomeRecord = {
  id: string;
  label: string;
  value: string;
  source: string;
  observedAt: string;
};

export type HealthHomeConceptProps = {
  userName: string;
  updatedAt: string;
  sourceCount: number;
  recordCount: number;
  pendingReviewCount: number;
  metric: {
    name: string;
    value: string;
    unit: string;
    observedAt: string;
    delta: string;
    source: string;
    status: "verified";
  };
  recentRecords: readonly HealthHomeRecord[];
  savedRecordCount?: number;
  onStartImport?: () => void;
  onOpenRecord?: (recordId: string) => void;
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5.5 5.5v5.2c0 4.5 2.7 8.4 6.5 10.3 3.8-1.9 6.5-5.8 6.5-10.3V5.5L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function HealthHomeConcept({
  userName,
  updatedAt,
  sourceCount,
  recordCount,
  pendingReviewCount,
  metric,
  recentRecords,
  savedRecordCount = 0,
  onStartImport,
  onOpenRecord,
}: HealthHomeConceptProps) {
  const timeline = Array.from({ length: 12 }, (_, index) => index);

  return (
    <main className="gc-health-home">
      <div className="gc-health-home__shell">
        <header className="gc-health-home__appbar">
          <a className="gc-health-home__brand" href="#home" aria-label="앎 건강 홈">
            <span aria-hidden="true">앎</span>
            <strong>앎</strong>
          </a>
          <nav aria-label="주요 메뉴">
            <a href="#home" aria-current="page">홈</a>
            <a href="#records">기록</a>
            <a href="#privacy">내 데이터</a>
          </nav>
          <button className="gc-health-home__profile" type="button" aria-label={`${userName}님의 계정`}>
            {userName.slice(0, 1)}
          </button>
        </header>

        <section className="gc-health-home__hero" id="home" aria-labelledby="home-title">
          <div>
            <p className="gc-health-home__greeting">안녕하세요, {userName}님</p>
            <h1 id="home-title">흩어진 건강 기록을 <br aria-hidden="true" />한눈에 모았어요</h1>
            <p className="gc-health-home__hero-copy">
              병원, 건강검진센터, 검사기관의 결과를 출처와 함께 안전하게 확인하세요.
            </p>
            <div className="gc-health-home__hero-actions">
              <button className="gc-button gc-button--primary" type="button" onClick={onStartImport}>
                <UploadIcon /> 새 결과지 가져오기
              </button>
              <a className="gc-button gc-button--weak" href="#records">내 기록 보기</a>
            </div>
          </div>

          <aside className="gc-health-home__connection" aria-label={`${sourceCount}개 기관에서 ${recordCount}개 기록 연결됨`}>
            <div className="gc-health-home__connection-orbit" aria-hidden="true">
              <span>병원</span>
              <span>검진</span>
              <span>DNA</span>
              <span>보건소</span>
              <strong>앎</strong>
            </div>
            <p><strong>{sourceCount}곳</strong>의 기록이 연결되어 있어요</p>
            <span>검증한 기록 {recordCount}개 · 업데이트 <time dateTime={updatedAt}>{updatedAt}</time></span>
            <a href="/connections">연결 관리 <ArrowIcon /></a>
          </aside>
        </section>

        {savedRecordCount > 0 && (
          <section className="gc-health-home__saved" aria-live="polite">
            <span aria-hidden="true">✓</span>
            <div>
              <h2>{savedRecordCount}개 항목을 건강 기록에 추가했어요</h2>
              <p>원본 출처와 확인 이력이 함께 저장됐어요.</p>
            </div>
          </section>
        )}

        {pendingReviewCount > 0 && (
          <section className="gc-health-home__review" aria-labelledby="review-title">
            <div className="gc-health-home__review-icon" aria-hidden="true">{pendingReviewCount}</div>
            <div>
              <h2 id="review-title">확인을 기다리는 항목이 {pendingReviewCount}개 있어요</h2>
              <p>확인하기 전에는 내 건강 기록에 들어가지 않아요.</p>
            </div>
            <button className="gc-button gc-button--compact" type="button">이어서 확인</button>
          </section>
        )}

        <section className="gc-health-home__overview" aria-labelledby="overview-title">
          <div className="gc-health-home__section-heading">
            <div>
              <p>최근 확인된 기록</p>
              <h2 id="overview-title">내 건강 한눈에 보기</h2>
            </div>
            <button className="gc-text-button" type="button">전체 변화 보기 <ArrowIcon /></button>
          </div>

          <article className="gc-health-home__metric-card">
            <div className="gc-health-home__metric-copy">
              <div className="gc-health-home__metric-topline">
                <span>{metric.name}</span>
                <StatusLabel status={metric.status} />
              </div>
              <p className="gc-health-home__metric-value">
                <strong>{metric.value}</strong><span>{metric.unit}</span>
              </p>
              <p className="gc-health-home__metric-delta">{metric.delta}</p>
              <p className="gc-health-home__metric-source">
                {metric.source} · <time dateTime={metric.observedAt}>{metric.observedAt}</time>
              </p>
            </div>
            <div className="gc-health-home__trend">
              <div
                className="gc-health-home__trend-bars"
                role="img"
                aria-label="최근 12개월 중 4개월에 출처가 확인된 측정 기록이 있어요"
              >
                {timeline.map((month) => (
                  <span
                    key={month}
                    data-active={[1, 4, 8, 11].includes(month) ? "true" : "false"}
                    style={{ height: `${26 + ((month * 13) % 48)}%` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="gc-health-home__trend-labels" aria-hidden="true">
                <span>2025.08</span><span>2026.07</span>
              </div>
              <button className="gc-health-home__metric-link" type="button" onClick={() => recentRecords[0] && onOpenRecord?.(recentRecords[0].id)}>
                출처와 변화 자세히 보기 <ArrowIcon />
              </button>
            </div>
          </article>
        </section>

        <section className="gc-health-home__tasks" aria-labelledby="task-title">
          <div className="gc-health-home__section-heading">
            <div><p>바로 할 수 있어요</p><h2 id="task-title">무엇을 할까요?</h2></div>
          </div>
          <div className="gc-health-home__task-grid">
            <button type="button" onClick={onStartImport}>
              <span className="gc-health-home__task-icon"><UploadIcon /></span>
              <strong>검사 결과 가져오기</strong>
              <span>PDF나 사진 한 장으로 시작해요</span>
              <ArrowIcon />
            </button>
            <button type="button">
              <span className="gc-health-home__task-icon gc-health-home__task-icon--teal">↗</span>
              <strong>시간에 따른 변화 보기</strong>
              <span>좋고 나쁨 없이 사실만 비교해요</span>
              <ArrowIcon />
            </button>
            <a href="/providers">
              <span className="gc-health-home__task-icon gc-health-home__task-icon--gray">₩</span>
              <strong>비급여 금액 비교하기</strong>
              <span>공개 자료만 사용해 확인해요</span>
              <ArrowIcon />
            </a>
          </div>
        </section>

        <section className="gc-health-home__records" id="records" aria-labelledby="records-title">
          <div className="gc-health-home__section-heading">
            <div><p>출처가 연결된 기록</p><h2 id="records-title">최근 기록</h2></div>
            <button className="gc-text-button" type="button">모두 보기 <ArrowIcon /></button>
          </div>
          <ol>
            {recentRecords.map((record) => (
              <li key={record.id}>
                <button type="button" aria-label={`${record.label} ${record.value} 자세히 보기`} onClick={() => onOpenRecord?.(record.id)}>
                  <span className="gc-health-home__record-symbol" aria-hidden="true">{record.label.slice(0, 1)}</span>
                  <span className="gc-health-home__record-copy">
                    <strong>{record.label}</strong>
                    <span>{record.source} · <time dateTime={record.observedAt}>{record.observedAt}</time></span>
                  </span>
                  <span className="gc-health-home__record-value">{record.value}</span>
                  <ArrowIcon />
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="gc-health-home__privacy" id="privacy" aria-labelledby="privacy-title">
          <div className="gc-health-home__privacy-icon"><ShieldIcon /></div>
          <div>
            <p>내 건강 데이터는 내가 정해요</p>
            <h2 id="privacy-title">연결하고, 내려받고, 삭제하는 모든 선택을 직접 관리하세요.</h2>
            <ul>
              <li>기관별 연결 해제</li>
              <li>원본 보관 방식 변경</li>
              <li>처리 동의와 삭제 내역 확인</li>
            </ul>
          </div>
          <a className="gc-button gc-button--weak" href="/data-control">내 데이터 관리</a>
        </section>

        <p className="gc-health-home__boundary">
          표시된 측정값과 변화만으로 질환을 진단할 수 없습니다. 검사 조건과 검사실 기준이 다를 수 있어요.
        </p>
      </div>

      <nav className="gc-health-home__bottom-nav" aria-label="모바일 주요 메뉴">
        <a href="#home" aria-current="page"><span aria-hidden="true">●</span>홈</a>
        <a href="#records"><span aria-hidden="true">▤</span>기록</a>
        <button type="button" onClick={onStartImport}><span aria-hidden="true">＋</span>결과지 추가</button>
        <a href="/data-control"><span aria-hidden="true">◈</span>내 데이터</a>
      </nav>
    </main>
  );
}
