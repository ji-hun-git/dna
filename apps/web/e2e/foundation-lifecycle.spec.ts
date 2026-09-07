import { createHash } from "node:crypto";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

type BrowserApiResult = {
  status: number;
  body: Record<string, unknown> | Array<Record<string, unknown>>;
};

const boundedDocumentProcessingTimeoutMs = 45_000;

const viewports = [[390, 844], [430, 932], [768, 1024], [1280, 720], [1440, 900], [1920, 1080]] as const;
async function captureMatrix(page: Page, info: TestInfo, state: string) {
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (state === "entry") {
      const button = await page.getByRole("button", {name: "체험 시작"}).boundingBox();
      expect(button!.height).toBeGreaterThanOrEqual(44);
      expect(button!.y + button!.height).toBeLessThanOrEqual(height);
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
  await expect(page.getByText("188", { exact: true })).toBeVisible();
  await captureMatrix(page, info, "review");

  await page.getByRole("button", { name: "값 수정" }).click();
  await page.getByLabel("원문과 같은 값으로 수정").fill("190");
  await page.screenshot({ path: info.outputPath("correction-390x844.png") });
  await page.getByRole("button", { name: "수정한 값 확인" }).click();

  await expect(page.getByLabel("검토 진행")).toHaveText("2 / 3");
  await expect(page.getByText("5.2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "확인: 원문과 같아요" }).click();

  await expect(page.getByLabel("검토 진행")).toHaveText("3 / 3");
  await expect(page.getByText("42", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "제외: 이 항목 빼기" }).click();

  await expect(page.getByRole("heading", { name: "이 결과지 확인을 마쳤어요" })).toBeVisible();
  await expect(page.getByText("저장 2개 · 제외 1개")).toBeVisible();
  await expect(page.getByText("값을 수정함", { exact: true })).toBeVisible();

  // The first document alone must feed both destinations; no second/static set can mask a gap.
  await page.goto("/records");
  await expect(page.getByTestId("durable-record")).toHaveCount(2);
  await expect(page.getByTestId("durable-record").filter({hasText: "비타민 D"})).toHaveCount(0);
  await page.goto("/prepare");
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByText("190", {exact:true})).toBeVisible();
  await page.goto("/");

  // The second allow-listed document is bound to the 2026-01 candidate set, so
  // the same three items come back with their own values and observation date.
  await expect(page.getByRole("heading", { name: /값보다 먼저\s*출처를 확인하세요/ })).toBeVisible();
  await page.getByRole("button", { name: "결과지 추가" }).click();
  await expect(page.getByRole("heading", { name: /허용된 합성 PDF를\s*선택해 주세요/ })).toBeVisible();
  await page.getByRole("button", {name: "1월 예시 결과지로 시작"}).click();
  await waitForServerReview(page);
  await expect(page.getByRole("heading", { name: "결과지에 이렇게 적혀 있나요?" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByLabel("검토 진행")).toHaveText("1 / 3");
  await expect(page.getByText("194", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "확인: 원문과 같아요" }).click();

  await expect(page.getByLabel("검토 진행")).toHaveText("2 / 3");
  await expect(page.getByText("5.4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "확인: 원문과 같아요" }).click();

  await expect(page.getByLabel("검토 진행")).toHaveText("3 / 3");
  await expect(page.getByText("45", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "확인: 원문과 같아요" }).click();

  await expect(page.getByRole("heading", { name: "이 결과지 확인을 마쳤어요" })).toBeVisible();
  await expect(page.getByText("저장 3개 · 제외 0개")).toBeVisible();

  await page.getByRole("link", { name: "저장된 기록 보기" }).click();
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByTestId("durable-record")).toHaveCount(5);
  const groupHeadings = page.locator(".gc-records-group h3");
  await expect(groupHeadings).toHaveCount(2);
  await expect(groupHeadings.nth(0)).toContainText("2026. 7. 28.");
  await expect(groupHeadings.nth(1)).toContainText("2026. 1. 15.");

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
    await expect(page.getByRole("navigation", {name:"주요 메뉴"}).getByRole("link")).toHaveCount(4);
    await captureMatrix(page, info, route.slice(1));
  }

  await page.goto("/data-control");
  await expect(page.getByText("동의함", { exact: true }).first()).toBeVisible();
  const consentId = await page.locator("body").evaluate(async () => {
    const response = await fetch("/api/foundation/consents/document-extraction", { credentials: "include", cache: "no-store" });
    return String((await response.json()).consentId);
  });
  await page.getByRole("button", { name: "동의 철회" }).click();
  await expect(page.getByText("철회함", { exact: true }).first()).toBeVisible();

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
  await page.getByRole("button", { name: "동의 철회" }).focus();
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
