import { createHash } from "node:crypto";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

type BrowserApiResult = {
  status: number;
  body: Record<string, unknown> | Array<Record<string, unknown>>;
};

const boundedDocumentProcessingTimeoutMs = 45_000;

const viewports = [[320, 720], [390, 844], [430, 932], [768, 1024], [1280, 720], [1440, 900], [1920, 1080]] as const;
async function captureMatrix(page: Page, info: TestInfo, state: string) {
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.evaluate(() => window.scrollTo(0, 0));
    // Name the offending elements when a viewport overflows, so a CI-only font
    // metric difference is diagnosable from the failure message alone.
    const overflow = await page.evaluate(() => new Promise<string[]>((resolve) => {
      const started = Date.now();
      const check = () => {
        if (document.documentElement.scrollWidth <= window.innerWidth) return resolve([]);
        if (Date.now() - started < 5_000) return void setTimeout(check, 100);
        const offenders = [...document.querySelectorAll("body *")]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .slice(0, 12)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const name = typeof element.className === "string" ? element.className : element.getAttribute("class") ?? "";
            return `${element.tagName.toLowerCase()}.${name.split(" ")[0]} right=${Math.round(rect.right)} width=${Math.round(rect.width)}`;
          });
        resolve([`scrollWidth=${document.documentElement.scrollWidth} innerWidth=${window.innerWidth}`, ...offenders]);
      };
      check();
    }));
    expect(overflow, `${state} at ${width}x${height} overflows horizontally`).toEqual([]);
    const nav = page.getByRole("navigation", { name: "주요 메뉴" });
    if (await nav.count()) {
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(state === "home" || state === "entry" ? 0 : 1);
      for (const label of ["나의 데이터", "데이터 관리"]) {
        const link = nav.getByRole("link", { name: label, exact: true });
        const target = await link.boundingBox();
        const icon = await link.locator("svg").boundingBox();
        const text = await link.locator("span").boundingBox();
        expect(target).not.toBeNull();
        expect(icon).not.toBeNull();
        expect(text).not.toBeNull();
        expect(target!.height).toBeGreaterThanOrEqual(width <= 672 ? 56 : 48);
        expect(target!.width).toBeGreaterThanOrEqual(48);
        expect(target!.y).toBeGreaterThanOrEqual(0);
        expect(target!.y + target!.height).toBeLessThanOrEqual(height);
        expect(icon!.width).toBeGreaterThanOrEqual(20);
        expect(text!.x).toBeGreaterThanOrEqual(target!.x);
        expect(text!.x + text!.width).toBeLessThanOrEqual(target!.x + target!.width + 1);
        if (width <= 672) expect(text!.y).toBeGreaterThanOrEqual(icon!.y + icon!.height);
      }
    }
    if (state === "entry") {
      const button = await page.getByRole("button", {name: "체험 시작"}).boundingBox();
      expect(button!.height).toBeGreaterThanOrEqual(44);
      expect(button!.y + button!.height).toBeLessThanOrEqual(height);
    }
    if (state === "my-data") {
      const search = await page.getByRole("searchbox", { name: "내 데이터에서 항목 찾기" }).boundingBox();
      expect(search).not.toBeNull();
      expect(search!.height).toBeGreaterThanOrEqual(44);
      const closeButton = page.getByRole("button", { name: "근거 닫기" });
      if (await closeButton.count()) {
        const box = await closeButton.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
      const evidenceButton = page.getByRole("button", { name: "근거 보기" }).first();
      if (await evidenceButton.count()) {
        const box = await evidenceButton.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
    }
    if (state === "review") {
      for (const name of ["확인: 원문과 같아요", "값 수정", "제외: 이 항목 빼기"]) {
        const button = await page.getByRole("button", { name }).boundingBox();
        expect(button).not.toBeNull();
        expect(button!.height).toBeGreaterThanOrEqual(44);
        expect(button!.width).toBeGreaterThanOrEqual(44);
        expect(button!.y).toBeGreaterThanOrEqual(0);
        expect(button!.y + button!.height).toBeLessThanOrEqual(height);
      }
    }
    await page.screenshot({ path: info.outputPath(`${state}-${width}x${height}.png`) });
  }
  await page.setViewportSize({width: 390, height: 844});
}

async function waitForServerReview(page: Page) {
  await expect.poll(
    async () => browserApi(page, "/api/foundation/documents/active"),
    {
      message: "the bounded worker lifecycle must reach REVIEW_REQUIRED",
      timeout: boundedDocumentProcessingTimeoutMs,
      intervals: [500, 1_000, 2_000],
    },
  ).toMatchObject({
    status: 200,
    body: { document: { status: "REVIEW_REQUIRED" } },
  });
}

async function browserApi(
  page: Page,
  path: string,
  options: { method?: string; idempotencyKey?: string; body?: string } = {},
): Promise<BrowserApiResult> {
  return page.evaluate(async ({ path: target, options: requestOptions }) => {
    const csrf = document.cookie
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith("GC_CSRF="))
      ?.slice("GC_CSRF=".length);
    const headers = new Headers({ "Content-Type": "application/json" });
    if (csrf) headers.set("X-GC-CSRF", decodeURIComponent(csrf));
    if (requestOptions.idempotencyKey) headers.set("Idempotency-Key", requestOptions.idempotencyKey);
    const response = await fetch(target, {
      method: requestOptions.method ?? "GET",
      headers,
      body: requestOptions.body,
      credentials: "include",
      cache: "no-store",
    });
    return { status: response.status, body: await response.json() };
  }, { path, options });
}

test("visible Korean product persists reloads revokes and deletes the synthetic lifecycle", async ({ page }, info) => {
  // Two documents run through the bounded worker lifecycle in this test, and the
  // worker fails the first extraction attempt of each job on purpose.
  test.setTimeout(240_000);
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const fixtureBytes = Buffer.from(process.env.GC_BROWSER_FIXTURE_BASE64!, "base64");

  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute(
    "data-application-instance",
    "playwright-foundation-browser-e2e",
  );
  await expect(page.getByRole("button", { name: "체험 시작" })).toBeVisible();
  await captureMatrix(page, info, "entry");

  await page.getByRole("button", { name: "체험 시작" }).click();
  await expect(page.getByRole("heading", { name: /값보다 먼저\s*출처를 확인하세요/ })).toBeVisible();
  await captureMatrix(page, info, "home");

  // Written labels stay keyboard-operable links, not icon-only controls.
  for (const [label, path] of [["나의 데이터", "/my-data"], ["데이터 관리", "/data-control"]]) {
    const link = page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: label, exact: true });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new URL(path, page.url()).href);
    await expect(page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: label, exact: true }))
      .toHaveAttribute("aria-current", "page");
  }

  // These routes are still reachable, but no longer have their own top-level
  // nav entry: 기록/진료 준비 live under 나의 데이터, and 홈 is the brand link.
  for (const path of ["/records", "/prepare", "/"]) {
    await page.goto(path);
    if (path === "/records") {
      await expect(page.getByRole("heading", { name: "내 기록" })).toBeVisible();
    } else if (path === "/prepare") {
      await expect(page.getByRole("heading", { name: "다음 진료에서 물어볼 것" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
    }
  }

  await page.getByRole("button", { name: "결과지 추가" }).click();
  await expect(page.getByRole("heading", { name: "결과지에서 항목을 확인해도 될까요?" })).toBeVisible();
  await page.getByRole("button", { name: "이 목적에 동의" }).click();
  await expect(page.getByRole("heading", { name: /허용된 합성 PDF를\s*선택해 주세요/ })).toBeVisible();

  await page.getByRole("button", {name: "7월 예시 결과지로 시작"}).click();
  await expect(page.getByText("적대적 문서 격리 구역", { exact: true })).toBeVisible();
  await waitForServerReview(page);
  await expect(page.getByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByAltText("승인된 합성 결과지의 첫 페이지 PNG 미리보기")).toBeVisible();
  await expect.poll(() => page.getByAltText("승인된 합성 결과지의 첫 페이지 PNG 미리보기")
    .evaluate((node) => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await expect(page.getByLabel("검토 진행")).toHaveText("1 / 3");
  await expect(page.getByTestId("original-label")).toHaveText("결과지 표기: Cholesterol");
  await expect(page.getByText("188", { exact: true })).toBeVisible();
  // Wave 2A: the value came from the PDF text layer, not from a server fixture and not from OCR.
  await expect(page.getByText("서버가 미리 정한 예시 값")).toHaveCount(0);
  await expect(page.getByText("결과지의 글자 정보에서 읽은 값이에요. 이미지를 판독한 결과가 아니며, 확인하기 전까지 기록이 아니에요.")).toBeVisible();
  await expect(page.getByText("결과지 텍스트에서 읽은 값 · 문자 인식 아님").first()).toBeVisible();
  await expect(page.getByText("근거 쪽수", { exact: true }).locator("..")).toContainText("1쪽");
  await expect(page.getByText("근거 위치", { exact: true }).locator("..")).toContainText(/왼쪽 \d{1,2}% · 위 \d{1,2}% · 너비 \d{1,3}% · 높이 \d{1,2}%/);
  await captureMatrix(page, info, "review");

  await page.getByRole("button", { name: "값 수정" }).click();
  await page.getByLabel("원문과 같은 값으로 수정").fill("190");
  await page.screenshot({ path: info.outputPath("correction-390x844.png") });
  await page.getByRole("button", { name: "수정한 값 확인" }).click();

  await expect(page.getByLabel("검토 진행")).toHaveText("2 / 3");
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await expect(page.getByLabel("서버 상태 코드")).toHaveText("REVIEW_REQUIRED");
  await page.getByRole("button", { name: "이어서 확인", exact: true }).click();
  await expect(page.getByLabel("검토 진행")).toHaveText("2 / 3");
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await page.getByRole("button", { name: "이전", exact: true }).click();
  await expect(page.getByRole("button", { name: "결과지 추가", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "이어서 확인", exact: true }).click();
  await expect(page.getByLabel("검토 진행")).toHaveText("2 / 3");
  await expect(page.getByText("5.2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "검사일 수정" }).click();
  await expect(page.getByText("결과지에 적힌 검사일과 다르면 고쳐 주세요. 값의 의미는 판단하지 않아요.")).toBeVisible();
  await page.getByLabel("검사일 수정").fill("2026-07-27");
  await page.getByRole("button", { name: "수정한 검사일 확인" }).click();

  await expect(page.getByLabel("검토 진행")).toHaveText("3 / 3");
  await expect(page.getByText("42", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "제외: 이 항목 빼기" }).click();

  await expect(page.getByRole("heading", { name: "이 결과지 확인을 마쳤어요" })).toBeVisible();
  await expect(page.getByText("저장 2개 · 제외 1개")).toBeVisible();
  await expect(page.getByText("값을 수정함", { exact: true })).toBeVisible();
  await expect(page.getByText("검사일을 수정함", { exact: true })).toBeVisible();

  // Wave 3 (a): the printed range is stored, never shown. Not on the review screen, not on the summary.
  await expect(page.getByText("120-199")).toHaveCount(0);
  expect(await page.content()).not.toContain("120-199");

  // The first document alone must feed both destinations; no second/static set can mask a gap.
  // Keep the outage active until recovery: development StrictMode may issue
  // more than one initial read, so a one-shot failure can hit a discarded effect.
  await page.route("**/api/foundation/records", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ code: "retryable_dependency_failure" }),
  }));
  await page.goto("/records");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("잠시 응답하지 않아요");
  await expect(page.getByRole("link", { name: "홈에서 다시 로그인" })).toHaveCount(0);
  await page.unroute("**/api/foundation/records");
  await page.getByRole("button", { name: "기록 다시 불러오기" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("durable-record")).toHaveCount(2);
  await expect(page.getByTestId("durable-record").filter({hasText: "비타민 D"})).toHaveCount(0);
  await expect(page.getByTestId("durable-record").filter({ hasText: "당화혈색소" }))
    .toContainText("사용자가 검사일을 수정함 · 원래 2026. 7. 28.");
  await expect(page.locator(".gc-records-group").filter({ hasText: "2026. 7. 27." })).toHaveCount(1);
  await page.route("**/api/foundation/records", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ code: "retryable_dependency_failure" }),
  }));
  await page.goto("/prepare");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("잠시 응답하지 않아요");
  await expect(page.getByRole("button", { name: "인쇄하기" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "홈에서 다시 로그인" })).toHaveCount(0);
  await page.unroute("**/api/foundation/records");
  await page.getByRole("button", { name: "질문 목록 다시 불러오기" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "인쇄하기" })).toBeEnabled();
  await expect(page.getByText("190", {exact:true})).toBeVisible();
  const sessionBeforeRecovery = await browserApi(page, "/api/foundation/session");
  expect(sessionBeforeRecovery.status).toBe(200);
  await page.route("**/api/foundation/records", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ code: "retryable_dependency_failure" }),
  }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "체험 상태를 불러오지 못했어요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "체험 시작" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("home-restore-error-390x844.png") });
  await page.unroute("**/api/foundation/records");
  await page.getByRole("button", { name: "체험 상태 다시 확인" }).click();
  await expect(page.getByRole("heading", { name: /값보다 먼저\s*출처를 확인하세요/ })).toBeVisible();
  expect(await browserApi(page, "/api/foundation/session")).toEqual(sessionBeforeRecovery);

  // Research consent is stored only: granting and revoking it changes nothing else. This
  // runs before the second document below, so that document's import-and-confirm flow is
  // exercised after the research revoke, not only the records that already existed.
  await page.goto("/data-control");
  const documentRow = page.locator("article[data-purpose='DOCUMENT_EXTRACTION']");
  const researchRow = page.locator("article[data-purpose='RESEARCH_USE']");
  await expect(documentRow).toContainText("동의함");
  await expect(researchRow).toContainText("동의 전");
  await page.getByRole("button", { name: "연구 활용 동의", exact: true }).click();
  await expect(researchRow).toContainText("동의함");
  await expect(documentRow).toContainText("동의함");
  const consentsAfterGrant = await browserApi(page, "/api/foundation/consents");
  expect(consentsAfterGrant.status).toBe(200);
  expect(consentsAfterGrant.body).toMatchObject([
    { purposeCode: "DOCUMENT_EXTRACTION", status: "ACTIVE" },
    { purposeCode: "RESEARCH_USE", status: "ACTIVE", policyVersion: "research-consent-policy.v1" },
    { purposeCode: "RESEARCH_CONTACT", status: "NOT_GRANTED" },
  ]);
  await page.getByRole("button", { name: "연구 활용 동의 철회", exact: true }).click();
  await expect(researchRow).toContainText("철회함");
  await expect(documentRow).toContainText("동의함");
  const eventsAfterResearchRevoke = await browserApi(page, "/api/foundation/health-events");
  expect(eventsAfterResearchRevoke.status).toBe(200);
  expect(eventsAfterResearchRevoke.body).toHaveLength(2);
  await page.goto("/");

  // The second allow-listed document carries the 2026-01 date in its text layer, so the
  // same three items come back with their own values and observation date.
  await expect(page.getByRole("heading", { name: /값보다 먼저\s*출처를 확인하세요/ })).toBeVisible();
  await page.getByRole("button", { name: "결과지 추가" }).click();
  await expect(page.getByRole("heading", { name: /허용된 합성 PDF를\s*선택해 주세요/ })).toBeVisible();
  await page.getByRole("button", {name: "1월 예시 결과지로 시작"}).click();
  await waitForServerReview(page);
  await expect(page.getByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByLabel("검토 진행")).toHaveText("1 / 4");
  await expect(page.getByText("194", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "확인: 원문과 같아요" }).click();

  await expect(page.getByLabel("검토 진행")).toHaveText("2 / 4");
  await expect(page.getByText("5.4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "확인: 원문과 같아요" }).click();

  await expect(page.getByLabel("검토 진행")).toHaveText("3 / 4");
  await expect(page.getByText("45", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "확인: 원문과 같아요" }).click();

  // Wave 5: a broad label ("Bilirubin") goes to the generic concept, and the sheet's own
  // word stays visible. This candidate is then excluded so every later count (records 5,
  // cells 5, FHIR entries 5, changes 3, questions) stays unchanged from before this task.
  await expect(page.getByLabel("검토 진행")).toHaveText("4 / 4");
  await expect(page.getByRole("heading", { level: 2, name: "빌리루빈", exact: true })).toBeVisible();
  await expect(page.getByTestId("original-label")).toHaveText("결과지 표기: Bilirubin");
  await expect(page.getByRole("heading", { level: 2, name: "총빌리루빈" })).toHaveCount(0);
  await page.getByRole("button", { name: "제외: 이 항목 빼기" }).click();

  await expect(page.getByRole("heading", { name: "이 결과지 확인을 마쳤어요" })).toBeVisible();
  await expect(page.getByText("저장 3개 · 제외 1개")).toBeVisible();

  // Wave 2C: the home lists the latest 결과지's values beside the previous value of the same item.
  // The January document completed last, so it is "이번"; July is "이전". No arrow, no judgement.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "최근 변화" })).toBeVisible();
  await expect(page.getByText("새 결과지 · 2026. 1. 15.")).toBeVisible();
  await expect(page.getByText("새 기록 3개")).toBeVisible();
  await expect(page.getByText("새 결과지에서 확인한 값과 같은 항목의 이전 값이에요. 변화의 의미는 판단하지 않아요.")).toBeVisible();
  await expect(page.getByTestId("change-item")).toHaveCount(3);
  await expect(page.getByTestId("change-item").filter({ hasText: "총콜레스테롤" }))
    .toHaveText("총콜레스테롤 · 이번 2026. 1. 15. 194 mg/dL · 이전 2026. 7. 28. 190 mg/dL");
  await expect(page.getByTestId("change-item").filter({ hasText: "당화혈색소" }))
    .toHaveText("당화혈색소 · 이번 2026. 1. 15. 5.4 % · 이전 2026. 7. 27. 5.2 %");
  await expect(page.getByTestId("change-item").filter({ hasText: "비타민 D" }))
    .toHaveText("비타민 D · 이번 2026. 1. 15. 45 ng/mL · 이전 값 없음");
  await expect(page.getByText("이전 값이 없는 항목: 비타민 D")).toBeVisible();
  // Wave 3 (b): the arithmetic difference as a signed number; nothing else. But the January
  // document here completed last while its own exam date (2026-01-15) is earlier than July's
  // (previous), so a signed difference would run against chronology — F5 omits delta for both
  // items with a previous value, leaving only the two values and their dates.
  await expect(page.getByTestId("change-delta")).toHaveCount(0);
  await expect(page.getByText("120-199")).toHaveCount(0);
  expect(await page.content()).not.toContain("120-199");
  expect(await page.locator("main").innerText()).not.toMatch(/→|↑|↓|증가|감소|상승|하락/);
  const changes = await browserApi(page, "/api/foundation/changes");
  expect(changes.status).toBe(200);
  expect(JSON.stringify(changes.body).toLowerCase()).not.toMatch(/reference|direction|trend/);
  const changeItems = (changes.body as { items: Array<{ concept: string; delta?: unknown }> }).items;
  expect(changeItems.map((item) => item.concept)).toEqual(
    expect.arrayContaining(["총콜레스테롤", "당화혈색소", "비타민 D"]),
  );
  expect(changeItems.every((item) => !("delta" in item))).toBe(true);

  await page.goto("/records");
  await expect(page.getByTestId("durable-record")).toHaveCount(5);
  await expect(page.getByText("120-199")).toHaveCount(0);
  expect(await page.content()).not.toContain("120-199");

  await page.goto("/my-data");
  const figure = page.getByRole("figure", { name: "나의 데이터: 한 칸이 하나의 기록" });
  await expect(figure).toBeVisible();
  const cells = figure.getByRole("button");
  await expect(cells).toHaveCount(5);
  await expect(page.getByRole("table", { name: "기록 목록" }).getByRole("row")).toHaveCount(5 + 1);
  await cells.first().click();
  const drawer = page.getByRole("region", { name: /근거$/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("img")).toBeVisible();
  await expect(page.getByText("120-199")).toHaveCount(0);
  expect(await page.content()).not.toContain("120-199");
  // The July 총콜레스테롤 was corrected at review (188 → 190): the drawer lists the original value only.
  await page.getByRole("button", { name: "근거 닫기" }).click();
  await figure.getByRole("button", { name: "총콜레스테롤 190 mg/dL, 2026. 7. 28." }).click();
  const correctedDrawer = page.getByRole("region", { name: "총콜레스테롤 근거" });
  await expect(correctedDrawer).toContainText("수정 이력");
  await expect(correctedDrawer).toContainText("원래 값 188 mg/dL");
  await expect(correctedDrawer.getByTestId("original-label")).toHaveText("결과지 표기: Cholesterol");
  await expect(correctedDrawer).not.toContainText("120-199");
  expect(await page.content()).not.toContain("120-199");
  await page.getByRole("button", { name: "근거 닫기" }).click();
  // The date-corrected 당화혈색소 lists the parser's date only.
  await figure.getByRole("button", { name: "당화혈색소 5.2 %, 2026. 7. 27." }).click();
  await expect(page.getByRole("region", { name: "당화혈색소 근거" })).toContainText("원래 검사일 2026. 7. 28.");
  await page.getByRole("button", { name: "근거 닫기" }).click();
  // An untouched record says so.
  await figure.getByRole("button", { name: "비타민 D 45 ng/mL, 2026. 1. 15." }).click();
  await expect(page.getByRole("region", { name: "비타민 D 근거" })).toContainText("수정 없음");
  await page.getByRole("button", { name: "근거 닫기" }).click();
  await page.getByRole("searchbox", { name: "내 데이터에서 항목 찾기" }).fill("총콜레스테롤");
  await expect(page.getByRole("status", { name: "검색 결과" })).toContainText("총콜레스테롤 기록");
  await captureMatrix(page, info, "my-data");

  // Wave 4: 측정 이력. /changes omits delta here because the upload order runs against the exam
  // dates, but /series is always in time order, so its lastDifference IS present.
  const seriesResponse = await browserApi(page, "/api/foundation/series");
  expect(seriesResponse.status).toBe(200);
  expect(JSON.stringify(seriesResponse.body).toLowerCase()).not.toMatch(/reference|120-199|direction|trend|slope|forecast/);
  const seriesList = (seriesResponse.body as unknown as {
    series: Array<{ concept: string; unit: string; points: Array<{ value: string; observedOn: string }>; derived: { lastDifference?: { absolute: string; percent?: string }; per30Days?: string; meanOfLast3?: string } }>;
  }).series;
  expect(seriesList.map((item) => item.concept)).toEqual(["당화혈색소", "비타민 D", "총콜레스테롤"]);
  expect(seriesList[2].points.map((point) => `${point.observedOn} ${point.value}`)).toEqual(["2026-01-15 194", "2026-07-28 190"]);
  // 194 days: 190 − 194 = -4; -4 / 194 = -2.1 %; -4 / 194 × 30 = -0.6.
  expect(seriesList[2].derived).toEqual({ lastDifference: { absolute: "-4", percent: "-2.1" }, per30Days: "-0.6" });
  // 193 days (07-27): -0.2; no percent for a % unit; -0.2 / 193 × 30 = -0.03.
  expect(seriesList[0].points.map((point) => `${point.observedOn} ${point.value}`)).toEqual(["2026-01-15 5.4", "2026-07-27 5.2"]);
  expect(seriesList[0].derived).toEqual({ lastDifference: { absolute: "-0.2" }, per30Days: "-0.03" });
  expect(seriesList[1].points).toHaveLength(1);
  expect(seriesList[1].derived).toEqual({});

  // 측정 이력 screen assertions are added with the screen task (parked pending mockup approval).
  await page.getByRole("link", { name: "측정 이력" }).click();
  await expect(page).toHaveURL(/\/my-data\/history$/);
  const historySections = page.getByTestId("history-series");
  await expect(historySections).toHaveCount(3);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["당화혈색소", "비타민 D", "총콜레스테롤"]);

  const cholesterolHistory = historySections.nth(2);
  await expect(cholesterolHistory.getByRole("heading", { level: 2 })).toHaveText("총콜레스테롤");
  // Matches seriesList[2].derived above: -4 mg/dL (-2.1%); -4/194×30 = -0.6; only 2 points so no 3-point mean.
  await expect(cholesterolHistory.getByTestId("derived-last-difference")).toHaveText("-4 mg/dL (-2.1%)");
  await expect(cholesterolHistory.getByTestId("derived-per-30-days")).toHaveText("-0.6 mg/dL");
  await expect(cholesterolHistory.getByTestId("derived-mean-of-last-3")).toHaveText("측정 3회부터 계산해요");
  const cholesterolTable = cholesterolHistory.getByRole("table", { name: "총콜레스테롤 측정 이력" });
  await expect(cholesterolTable.getByRole("columnheader", { name: "결과지 표기" })).toBeVisible();
  const cholesterolRows = cholesterolTable.getByRole("row");
  await expect(cholesterolRows).toHaveCount(3);
  await expect(cholesterolRows.nth(1)).toContainText("2026. 1. 15.");
  await expect(cholesterolRows.nth(2)).toContainText("2026. 7. 28.");
  expect(await page.content()).not.toContain("120-199");

  // Anchor accessible name is "검사일 값 단위" (wave4-mockup-decision.md), e.g. "2026.07.28 190 mg/dL" —
  // no series name, since the nearest heading already names the series.
  const cholesterolAnchor = cholesterolHistory.getByRole("button", { name: "2026.07.28 190 mg/dL" });
  await expect(cholesterolAnchor).toBeVisible();
  await cholesterolAnchor.click();
  const annotationCard = cholesterolHistory.getByRole("group", { name: "선택한 측정값" });
  // First line "YYYY.MM.DD 확인한 값" (wave4-mockup-decision.md), then the value.
  await expect(annotationCard).toContainText("2026.07.28 확인한 값");
  await expect(annotationCard).toContainText("190 mg/dL");

  // The card's 출처 보기 round-trips to 내 데이터's evidence drawer, which links back here.
  // The real event id is server-assigned, so the round trip is checked against itself rather
  // than a hard-coded uuid.
  await annotationCard.getByRole("link", { name: "출처 보기" }).click();
  await expect(page).toHaveURL(/\/my-data#event-([0-9a-f-]{36})$/);
  const eventId = new URL(page.url()).hash.replace("#event-", "");
  const historyDrawer = page.getByRole("region", { name: "총콜레스테롤 근거" });
  await expect(historyDrawer).toBeVisible();
  await expect(historyDrawer.getByRole("link", { name: "이 항목의 측정 이력 보기" })).toHaveAttribute("href", `/my-data/history#event-${eventId}`);
  await historyDrawer.getByRole("link", { name: "이 항목의 측정 이력 보기" }).click();
  await expect(page).toHaveURL(`/my-data/history#event-${eventId}`);
  await expect(page.getByRole("heading", { level: 2, name: "총콜레스테롤" })).toBeFocused();
  expect(await page.content()).not.toContain("120-199");

  await captureMatrix(page, info, "history");

  await page.goto("/records");
  const groupHeadings = page.locator(".gc-records-group h3");
  await expect(groupHeadings).toHaveCount(3);
  await expect(groupHeadings.nth(0)).toContainText("2026. 7. 28.");
  await expect(groupHeadings.nth(1)).toContainText("2026. 7. 27.");
  await expect(groupHeadings.nth(2)).toContainText("2026. 1. 15.");

  await expect(page.getByRole("heading", { name: "날짜별로 본 내 기록" })).toBeVisible();
  await expect(page.getByText(
    "같은 항목의 두 날짜 값을 그대로 나란히 둔 목록이에요. 변화의 의미는 판단하지 않아요.",
  )).toBeVisible();
  await expect(page.getByTestId("record-comparison-item")).toHaveCount(2);
  await expect(page.getByTestId("record-comparison-item").filter({ hasText: "총콜레스테롤" }))
    .toHaveText("총콜레스테롤 · 2026. 1. 15. 194 mg/dL → 2026. 7. 28. 190 mg/dL");

  const julyGroup = page.locator(".gc-records-group").filter({ hasText: "2026. 7. 28." });
  const correctedRecord = julyGroup.getByTestId("durable-record").filter({ hasText: "총콜레스테롤" });
  await expect(correctedRecord).toBeVisible();
  await expect(page.getByTestId("durable-record").filter({ hasText: "총콜레스테롤" }).first().getByTestId("original-label")).toHaveText("결과지 표기: Cholesterol");
  await page.reload();
  await expect(correctedRecord).toBeVisible();
  await correctedRecord.getByText("출처와 버전 보기").click();
  await expect(correctedRecord.getByText("원래 후보", { exact: true }).locator("..")).toContainText("188 mg/dL");
  await expect(correctedRecord.getByText("현재 상태", { exact: true }).locator("..")).toContainText("현재 값");
  await expect(correctedRecord.getByAltText("예시 결과지 1쪽 미리보기")).toBeVisible();
  await captureMatrix(page, info, "records");

  await page.goto("/prepare");
  await expect(page.getByRole("heading", { name: "다음 진료에서 물어볼 것" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "이 질문의 출처 보기" })).toHaveCount(5);
  await expect(page.getByText(
    "이 목록은 질문을 준비하기 위한 것이에요. 값의 의미나 건강 상태를 판단하지 않아요.",
  )).toBeVisible();

  await captureMatrix(page, info, "prepare");
  for (const route of ["/connections", "/providers", "/data-control"]) {
    await page.goto(route);
    await expect(page.getByRole("navigation", {name:"주요 메뉴"}).getByRole("link")).toHaveCount(2);
    await captureMatrix(page, info, route.slice(1));
  }

  await page.goto("/data-control");
  await expect(page.getByRole("heading", { name: "서비스 제공(결과지 처리)" })).toBeVisible();
  await expect(page.getByText("연구 동의 없이도 모든 기능을 쓸 수 있어요.", { exact: false })).toBeVisible();
  // The research consent above was granted and revoked before the second document, and
  // the second document's own import-and-confirm flow ran after that revoke — this is the
  // state left behind: research revoked, document-extraction still active, all 5 events present.
  await expect(documentRow).toContainText("동의함");
  await expect(researchRow).toContainText("철회함");
  const eventsAfterBothDocuments = await browserApi(page, "/api/foundation/health-events");
  expect(eventsAfterBothDocuments.status).toBe(200);
  expect(eventsAfterBothDocuments.body).toHaveLength(5);

  // Export: the browser opens the core URL directly; the core's headers name the file.
  await expect(page.getByText("브라우저가 파일을 저장해요. 서버에 사본이 남지 않아요.")).toBeVisible();
  const exportResponse = await page.request.get("/api/foundation/health-events/export");
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["content-type"]).toMatch(/^application\/json/);
  expect(exportResponse.headers()["content-disposition"]).toMatch(/^attachment; filename="alm-health-events-\d{8}\.json"$/);
  expect(exportResponse.headers()["cache-control"]).toBe("no-store");
  const exported = await exportResponse.json() as {
    schemaVersion: string;
    subjectKind: string;
    events: Array<{ value: string; originalValue: string; referenceRangeText?: string; originalObservedOn?: string; originalLabel?: string }>;
    documents: Array<{ documentId: string; status: string; eventCount: number }>;
  };
  expect(exported.schemaVersion).toBe("alm-health-events-export.v3");
  expect(exported.subjectKind).toBe("synthetic");
  expect(exported.events).toHaveLength(5);
  expect(exported.documents).toHaveLength(2);
  expect(exported.documents.map((document) => document.eventCount).sort()).toEqual([2, 3]);
  expect(exported.documents.map((document) => document.documentId)).toEqual([...exported.documents.map((document) => document.documentId)].sort());
  // Wave 3 (a): the export — and only the export — carries the document's own range text verbatim.
  const ranged = exported.events.filter((event) => event.referenceRangeText);
  expect(ranged).toHaveLength(1);
  expect(ranged[0]).toMatchObject({ value: "190", originalValue: "188", referenceRangeText: "120-199" });
  expect(exported.events.filter((event) => event.originalObservedOn)).toHaveLength(1);
  expect(exported.events.map((event) => event.originalLabel).sort()).toEqual(["Cholesterol", "Cholesterol", "HbA1c", "HbA1c", "Vitamin D"]);
  expect(JSON.stringify(eventsAfterBothDocuments.body).toLowerCase()).not.toContain("reference");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "내 기록 내보내기(JSON)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^alm-health-events-\d{8}\.json$/);

  // Wave 4: the same records as a FHIR R4 Bundle. The JSON export above is unchanged.
  await expect(page.getByText("다른 건강기록 도구가 읽을 수 있는 형식이에요.")).toBeVisible();
  const fhirResponse = await page.request.get("/api/foundation/health-events/export/fhir");
  expect(fhirResponse.status()).toBe(200);
  expect(fhirResponse.headers()["content-type"]).toMatch(/^application\/fhir\+json/);
  expect(fhirResponse.headers()["content-disposition"]).toMatch(/^attachment; filename="alm-health-events-\d{8}\.fhir\.json"$/);
  expect(fhirResponse.headers()["cache-control"]).toBe("no-store");
  expect(fhirResponse.headers()["x-content-type-options"]).toBe("nosniff");
  const fhirText = await fhirResponse.text();
  expect(fhirText).not.toMatch(/interpretation|"subject"|"performer"|"low"|"high"/);
  const fhirBundle = JSON.parse(fhirText) as {
    resourceType: string; type: string; meta: { tag: Array<{ system: string; code: string }> };
    entry: Array<{ resource: {
      resourceType: string; id: string; status: string; effectiveDateTime: string;
      code: { coding?: Array<{ system: string; code: string }>; text: string };
      valueQuantity?: { value: number; unit: string }; referenceRange?: Array<{ text: string }>; note?: Array<{ text: string }>;
    } }>;
  };
  expect(fhirBundle.resourceType).toBe("Bundle");
  expect(fhirBundle.type).toBe("collection");
  expect(fhirBundle.meta.tag).toEqual([{ system: "https://alm.example/fhir/tag", code: "synthetic" }]);
  expect(fhirBundle.entry).toHaveLength(5);
  expect(fhirBundle.entry.every((entry) => entry.resource.resourceType === "Observation" && entry.resource.status === "final")).toBe(true);
  const fhirRanged = fhirBundle.entry.filter((entry) => entry.resource.referenceRange);
  expect(fhirRanged).toHaveLength(1);
  expect(fhirRanged[0].resource).toMatchObject({
    code: { coding: [{ system: "http://loinc.org", code: "2093-3" }], text: "Cholesterol" },
    effectiveDateTime: "2026-07-28",
    valueQuantity: { value: 190, unit: "mg/dL" },
    referenceRange: [{ text: "120-199" }],
    note: [{ text: "본인이 값을 수정함" }],
  });
  // The date-only correction (당화혈색소) carries no value note.
  expect(fhirBundle.entry.filter((entry) => entry.resource.note)).toHaveLength(1);
  expect(fhirBundle.entry.map((entry) => entry.resource.code.text).sort()).toEqual(["Cholesterol", "Cholesterol", "HbA1c", "HbA1c", "Vitamin D"]);
  const [fhirDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "내 기록 내보내기(FHIR)" }).click(),
  ]);
  expect(fhirDownload.suggestedFilename()).toMatch(/^alm-health-events-\d{8}\.fhir\.json$/);

  const consentId = await page.locator("body").evaluate(async () => {
    const response = await fetch("/api/foundation/consents/document-extraction", { credentials: "include", cache: "no-store" });
    return String((await response.json()).consentId);
  });
  await page.getByRole("button", { name: "결과지 처리 동의 철회", exact: true }).click();
  await expect(documentRow).toContainText("철회함");

  const blockedAfterRevocation = await browserApi(page, "/api/foundation/documents", {
    method: "POST",
    idempotencyKey: `after-revoke-${process.pid}`,
    body: JSON.stringify({
      consentId,
      mediaType: "application/pdf",
      contentLength: fixtureBytes.length,
      sha256: createHash("sha256").update(fixtureBytes).digest("hex"),
    }),
  });
  expect(blockedAfterRevocation.status).toBe(403);
  expect(blockedAfterRevocation.body).toMatchObject({ code: "consent_revoked" });

  await page.getByRole("button", { name: "삭제 요청 검토" }).click();
  await page.getByLabel("위 내용을 확인했습니다").check();
  await page.getByRole("button", { name: "서버에 삭제 요청" }).click();
  await expect(page.getByRole("heading", { name: "삭제가 완료됐어요" })).toBeVisible();
  await expect(page.getByText("없음", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("로그인이 필요해요. 다시 로그인해 주세요.")).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

for (const [zoom, width] of [[200, 640], [400, 320]] as const) {
test(`server states remain keyboard operable at a ${zoom} percent equivalent viewport`, async ({ page }) => {
  test.setTimeout(90_000);
  const fixtureBytes = Buffer.from(process.env.GC_BROWSER_FIXTURE_BASE64!, "base64");

  await page.setViewportSize({ width, height: 720 });
  await page.goto("/");

  await page.getByRole("button", {name: "체험 시작"}).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /값보다 먼저\s*출처를 확인하세요/ })).toBeVisible();

  await page.getByRole("button", { name: "결과지 추가" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "이 목적에 동의" }).focus();
  await page.keyboard.press("Enter");

  await page.getByLabel("허용된 합성 PDF 선택").setInputFiles({
    name: "allowlisted-keyboard-synthetic-result.pdf",
    mimeType: "application/pdf",
    buffer: fixtureBytes,
  });
  const processingStatus = page.locator("main[data-stage='processing'] [role='status']");
  await expect(processingStatus).toHaveText(/보안 구역|안전하게 확인|다시 시도|미리보기/);
  await expect(processingStatus).toHaveAttribute("aria-live", "polite");
  await waitForServerReview(page);
  await expect(page.getByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible({
    timeout: 10_000,
  });

  await expect(page.getByLabel("검토 진행")).toHaveText("1 / 3");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "값 수정" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("원문과 같은 값으로 수정").focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("190");
  await page.getByRole("button", { name: "수정한 값 확인" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByLabel("검토 진행")).toHaveText("2 / 3");
  await page.getByRole("button", { name: "확인: 원문과 같아요" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByLabel("검토 진행")).toHaveText("3 / 3");
  await page.getByRole("button", { name: "제외: 이 항목 빼기" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "이 결과지 확인을 마쳤어요" })).toBeVisible();
  await expect(page.getByText("저장 2개 · 제외 1개")).toBeVisible();

  await page.getByRole("link", { name: "저장된 기록 보기" }).focus();
  await page.keyboard.press("Enter");
  const correctedRecord = page.getByTestId("durable-record").filter({ hasText: "총콜레스테롤" });
  const provenance = correctedRecord.getByText("출처와 버전 보기", { exact: true });
  await provenance.focus();
  await page.keyboard.press("Enter");
  await expect(correctedRecord.getByText("원래 후보", { exact: true }).locator("..")).toContainText("188 mg/dL");

  await page.goto("/prepare");
  await page.getByRole("button", { name: "인쇄하기" }).focus();
  await expect(page.getByRole("button", { name: "인쇄하기" })).toBeFocused();

  await page.goto("/data-control");
  await page.getByRole("button", { name: "결과지 처리 동의 철회", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("철회함", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "삭제 요청 검토" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("위 내용을 확인했습니다").focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "서버에 삭제 요청" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "삭제가 완료됐어요" })).toBeVisible();

  await expect.poll(() => page.locator("main").evaluate((node) => node.scrollWidth <= node.clientWidth + 2))
    .toBe(true);
});
}
