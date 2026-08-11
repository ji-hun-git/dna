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
    title: "이메일만으로 계정을 합치지 않아요",
    body: "최근 로그인과 직접 확인 없이는 다른 계정이나 건강 기록을 연결하지 않아요.",
  },
  {
    index: "03",
    title: "이상한 연결은 즉시 멈춰요",
    body: "재사용·위조·시간 초과·연결 충돌을 감지하면 세션을 끊고 다시 확인해요.",
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
          <span>IDENTITY · CONSENT · CONTROL</span>
          <a className="gc-connections__back" href="/">홈으로 <ArrowIcon /></a>
        </header>

        <section className="gc-connections__hero" aria-labelledby="connections-title">
          <p>내 데이터 연결</p>
          <h1 id="connections-title">연결은 내가 허용한 만큼만</h1>
          <div className="gc-connections__hero-copy">
            <p>로그인과 건강정보 연결을 분리하고, 무엇을 언제까지 허용했는지 다시 확인할 수 있게 만들었어요.</p>
            <span><LockIcon /> 현재는 안전한 제품 시연 환경이에요</span>
          </div>
        </section>

        <section className="gc-connections__identity" aria-labelledby="identity-title">
          <div className="gc-connections__section-heading">
            <p>STEP 01 · IDENTITY</p>
            <div>
              <h2 id="identity-title">먼저, 나를 확인해요</h2>
              <p>로그인은 건강정보 제공 동의가 아니에요</p>
            </div>
          </div>

          <div className="gc-connections__provider-grid">
            <article className="gc-provider-card" data-provider="kakao">
              <div className="gc-provider-card__mark" aria-hidden="true">K</div>
              <div>
                <p>간편 로그인</p>
                <h3>카카오</h3>
                <span>공식 앱 등록과 보안 심사 후 열려요</span>
              </div>
              <button type="button" disabled aria-label="카카오 로그인 준비 중">준비 중</button>
            </article>

            <article className="gc-provider-card" data-provider="naver">
              <div className="gc-provider-card__mark" aria-hidden="true">N</div>
              <div>
                <p>간편 로그인</p>
                <h3>네이버</h3>
                <span>공식 앱 등록과 서비스 검수 후 열려요</span>
              </div>
              <button type="button" disabled aria-label="네이버 로그인 준비 중">준비 중</button>
            </article>
          </div>

          <p className="gc-connections__identity-note">
            처음에는 이름·이메일·전화번호를 요구하지 않고, 제공자가 발급한 고유 식별자만 계정 확인에 사용해요.
          </p>
        </section>

        <section className="gc-connections__health" aria-labelledby="health-connection-title">
          <header>
            <span>HEALTH DATA CONNECTION · KOREA</span>
            <strong>기관 승인 대기</strong>
          </header>

          <div className="gc-connections__health-grid">
            <div className="gc-connections__health-copy">
              <p>STEP 02 · EXPLICIT CONSENT</p>
              <h2 id="health-connection-title">건강정보고속도로 · MyHealthWay</h2>
              <p>
                로그인한 뒤에도 별도의 동의가 있어야 건강정보를 가져올 수 있어요. 기관, 항목, 목적, 기간을 확인한 뒤 직접 선택해요.
              </p>
              <dl>
                <div><dt>직접 건강보험 비밀번호 입력</dt><dd>사용하지 않음</dd></div>
                <div><dt>포털 화면 수집·스크래핑</dt><dd>사용하지 않음</dd></div>
                <div><dt>교환 형식</dt><dd>FHIR 기반</dd></div>
              </dl>
            </div>

            <div className="gc-connections__readiness" aria-label="MyHealthWay 연결 준비 단계 5개 모두 대기 중">
              <p>PRODUCTION READINESS · 0/5</p>
              <ol>
                {readinessGates.map((gate, index) => (
                  <li key={gate}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{gate}</strong>
                    <em>대기</em>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <footer>
            <span>현재 실제 건강정보 API 호출 없음</span>
            <span>합성 데이터만 표시</span>
          </footer>
        </section>

        <section className="gc-connections__protection" aria-labelledby="protection-title">
          <div className="gc-connections__section-heading">
            <p>ANTI-HACK WORKFLOW</p>
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
          <p>연결하지 않아도 PDF·사진 결과지를 직접 가져와 사용할 수 있어요.</p>
          <a href="/">결과지로 시작하기 <ArrowIcon /></a>
        </footer>
      </div>
    </main>
  );
}
