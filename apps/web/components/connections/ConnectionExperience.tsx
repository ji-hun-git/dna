const readinessGates = [
  "기관 등록",
  "테스트베드",
  "적합성 검증",
  "운영 전환",
  "개인정보·이용목적 심사",
] as const;

const protectionRules = [
  {
    index: "01",
    title: "비밀번호를 대신 받지 않아요",
    body: "카카오·네이버·건강보험 계정의 비밀번호는 앎에 입력하거나 저장하지 않아요.",
  },
  {
    index: "02",
    title: "이메일이 같다는 이유만으로 계정을 합치지 않아요",
    body: "최근 로그인과 사용자의 직접 확인이 있어야 다른 계정이나 기록을 연결해요.",
  },
  {
    index: "03",
    title: "의심스러운 연결은 바로 멈춰요",
    body: "로그인 정보가 만료됐거나 계정이 맞지 않으면 연결을 멈추고 다시 확인해요.",
  },
] as const;

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ConnectionExperience() {
  return (
    <main className="gc-connections">
      <div className="gc-connections__shell">
        <header className="gc-connections__appbar">
          <a className="gc-connections__brand" href="/" aria-label="앎 건강 홈으로 돌아가기">
            <span aria-hidden="true">앎</span>
            <strong>앎</strong>
          </a>
          <span>로그인 · 동의 · 관리</span>
          <a className="gc-connections__back" href="/">홈으로 <ArrowIcon /></a>
        </header>

        <section className="gc-connections__hero" aria-labelledby="connections-title">
          <p>데이터 연결</p>
          <h1 id="connections-title">필요한 정보만 연결해요</h1>
          <div className="gc-connections__hero-copy">
            <p>로그인과 건강정보 연결 동의는 서로 달라요. 연결할 기관과 항목, 기간을 따로 선택할 수 있게 준비하고 있어요.</p>
            <span><LockIcon /> 실제 계정이나 건강정보와 연결되지 않은 예시 화면이에요</span>
          </div>
        </section>

        <section className="gc-connections__identity" aria-labelledby="identity-title">
          <div className="gc-connections__section-heading">
            <p>1. 로그인</p>
            <div>
              <h2 id="identity-title">로그인 방법을 선택해요</h2>
              <p>로그인은 건강정보 제공 동의가 아니에요</p>
            </div>
          </div>

          <div className="gc-connections__provider-grid">
            <article className="gc-provider-card" data-provider="kakao">
              <div className="gc-provider-card__mark" aria-hidden="true">K</div>
              <div>
                <p>간편 로그인</p>
                <h3>카카오</h3>
                <span>아직 사용할 수 없어요 · 공식 심사 필요</span>
              </div>
              <button type="button" disabled aria-label="카카오 로그인 준비 중">준비 중</button>
            </article>

            <article className="gc-provider-card" data-provider="naver">
              <div className="gc-provider-card__mark" aria-hidden="true">N</div>
              <div>
                <p>간편 로그인</p>
                <h3>네이버</h3>
                <span>아직 사용할 수 없어요 · 공식 심사 필요</span>
              </div>
              <button type="button" disabled aria-label="네이버 로그인 준비 중">준비 중</button>
            </article>
          </div>

          <p className="gc-connections__identity-note">
            로그인할 때 이름·이메일·전화번호를 별도로 입력받지 않을 계획이에요. 로그인 제공자가 만든 식별자로 계정을 구분합니다.
          </p>
        </section>

        <section className="gc-connections__health" aria-labelledby="health-connection-title">
          <header>
            <span>건강정보 연결</span>
            <strong>연결 준비 전</strong>
          </header>

          <div className="gc-connections__health-grid">
            <div className="gc-connections__health-copy">
              <p>2. 건강정보 연결 동의</p>
              <h2 id="health-connection-title">건강정보고속도로</h2>
              <p>
                로그인한 뒤에도 별도의 동의가 있어야 건강정보를 가져올 수 있어요. 기관, 항목, 목적, 기간을 확인한 뒤 직접 선택해요.
              </p>
              <dl>
                <div><dt>직접 건강보험 비밀번호 입력</dt><dd>사용하지 않음</dd></div>
                <div><dt>포털 화면 수집·스크래핑</dt><dd>사용하지 않음</dd></div>
                <div><dt>의료정보 표준 형식</dt><dd>FHIR</dd></div>
              </dl>
            </div>

            <div className="gc-connections__readiness" aria-label="MyHealthWay 연결 준비 단계 5개 모두 대기 중">
              <p>연결 준비 0/5</p>
              <ol>
                {readinessGates.map((gate, index) => (
                  <li key={gate}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{gate}</strong>
                    <em>미완료</em>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <footer>
            <span>실제 건강정보 API 요청 0건</span>
            <span>예시 데이터만 표시</span>
          </footer>
        </section>

        <section className="gc-connections__protection" aria-labelledby="protection-title">
          <div className="gc-connections__section-heading">
            <p>연결 보호</p>
            <div>
              <h2 id="protection-title">연결이 수상하면 먼저 멈춰요</h2>
              <p>편리함보다 계정과 건강 기록의 경계를 우선해요.</p>
            </div>
          </div>
          <ol>
            {protectionRules.map((rule) => (
              <li key={rule.index}>
                <span>{rule.index}</span>
                <h3>{rule.title}</h3>
                <p>{rule.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="gc-connections__footer">
          <p>지금은 PDF, PNG, JPEG 파일 선택 흐름을 체험할 수 있어요.</p>
          <div>
            <a href="/data-control">동의와 보관 설정 보기 <ArrowIcon /></a>
            <a href="/">결과지 추가하기 <ArrowIcon /></a>
          </div>
        </footer>
      </div>
    </main>
  );
}
