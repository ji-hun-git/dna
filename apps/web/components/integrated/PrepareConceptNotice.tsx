/** Concept-mode visit-preparation screen shown before the integrated server flow is enabled. */
export function PrepareConceptNotice() {
  return (
    <main className="gc-prepare">
      <header className="gc-prepare__heading">
        <p>진료 전 준비</p>
        <h1>다음 진료에서 물어볼 것</h1>
        <p className="gc-prepare__note">아직 서버 기록과 연결되지 않은 화면이에요.</p>
      </header>
      <section className="gc-prepare__empty" aria-labelledby="prepare-concept-title">
        <h2 id="prepare-concept-title">확인한 기록이 있으면 여기에 모여요</h2>
        <p>이 목록은 질문을 준비하기 위한 것이에요. 값의 의미나 건강 상태를 판단하지 않아요.</p>
        <a href="/">홈으로</a>
      </section>
    </main>
  );
}
