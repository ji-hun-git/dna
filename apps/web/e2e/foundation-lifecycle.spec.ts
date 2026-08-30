import { expect, test, type Page } from "@playwright/test";

type BrowserApiResult = {
  status: number;
  body: Record<string, unknown> | Array<Record<string, unknown>>;
};

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

test("visible Korean product persists reloads revokes and deletes the synthetic lifecycle", async ({ page }) => {
  const subjectId = process.env.GC_BROWSER_A11Y_SUBJECT!;
  const credential = process.env.GC_BROWSER_A11Y_CREDENTIAL!;
  const fixtureText = process.env.GC_BROWSER_FIXTURE_TEXT!;

  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute(
    "data-application-instance",
    "playwright-foundation-browser-e2e",
  );
  await expect(page.getByRole("heading", { name: "합성 사용자로 로그인" })).toBeVisible();

  await page.getByLabel("합성 사용자 ID").fill(subjectId);
  await page.getByLabel("합성 테스트 자격 증명").fill(credential);
  await page.getByRole("button", { name: "합성 환경 로그인" }).click();
  await expect(page.getByRole("heading", { name: /값보다 먼저\s*출처를 확인하세요/ })).toBeVisible();

  await page.getByRole("button", { name: "결과지 추가" }).click();
  await expect(page.getByRole("heading", { name: "결과지에서 항목을 확인해도 될까요?" })).toBeVisible();
  await page.getByRole("button", { name: "이 목적에 동의" }).click();
  await expect(page.getByRole("heading", { name: /허용된 합성 PDF를\s*선택해 주세요/ })).toBeVisible();

  await page.getByLabel("허용된 합성 PDF 선택").setInputFiles({
    name: "allowlisted-synthetic-result.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(fixtureText, "utf8"),
  });
  await expect(page.getByText("QUARANTINED", { exact: true })).toBeVisible();
  await expect(page.getByText("논리 개발 상태 · 보안 격리 아님")).toBeVisible();

  await page.getByRole("button", { name: "서버 검사 계속" }).click();
  await expect(page.getByText("INSPECTED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "합성 후보 만들기" }).click();
  await expect(page.getByRole("heading", { name: "이 합성 후보가 맞나요?" })).toBeVisible();
  await expect(page.getByText("188", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "값 수정" }).click();
  await page.getByLabel("원문과 같은 값으로 수정").fill("190");
  await page.getByRole("button", { name: "수정한 값 확인" }).click();
  await expect(page.getByRole("heading", { name: "건강 기록에 저장했어요" })).toBeVisible();
  await expect(page.getByText("CORRECTED", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "저장된 기록 보기" }).click();
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByTestId("durable-record")).toContainText("190");
  await page.reload();
  await expect(page.getByTestId("durable-record")).toContainText("190");
  await page.getByText("출처와 버전 보기").click();
  await expect(page.getByText("원래 후보", { exact: true }).locator("..")).toContainText("188 mg/dL");

  await page.goto("/data-control");
  await expect(page.getByText("ACTIVE", { exact: true }).first()).toBeVisible();
  const consentId = await page.locator("body").evaluate(async () => {
    const response = await fetch("/api/foundation/consents/document-extraction", { credentials: "include", cache: "no-store" });
    return String((await response.json()).consentId);
  });
  await page.getByRole("button", { name: "동의 철회" }).click();
  await expect(page.getByText("REVOKED", { exact: true }).first()).toBeVisible();

  const blockedAfterRevocation = await browserApi(page, "/api/foundation/documents", {
    method: "POST",
    idempotencyKey: `after-revoke-${process.pid}`,
    body: JSON.stringify({
      consentId,
      mediaType: "application/pdf",
      contentLength: Buffer.byteLength(fixtureText, "utf8"),
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
});

test("server states remain keyboard operable at a 200 percent equivalent viewport", async ({ page }) => {
  const subjectId = process.env.GC_BROWSER_SUBJECT!;
  const credential = process.env.GC_BROWSER_CREDENTIAL!;
  const fixtureText = process.env.GC_BROWSER_FIXTURE_TEXT!;

  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto("/");

  await page.getByLabel("합성 사용자 ID").focus();
  await page.keyboard.type(subjectId);
  await page.keyboard.press("Tab");
  await page.keyboard.type(credential);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /값보다 먼저\s*출처를 확인하세요/ })).toBeVisible();

  await page.getByRole("button", { name: "결과지 추가" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "이 목적에 동의" }).focus();
  await page.keyboard.press("Enter");

  await page.getByLabel("허용된 합성 PDF 선택").setInputFiles({
    name: "allowlisted-keyboard-synthetic-result.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(fixtureText, "utf8"),
  });
  const processingStatus = page.getByRole("status");
  await expect(processingStatus).toHaveText(/논리 격리 상태/);
  await expect(processingStatus).toHaveAttribute("aria-live", "polite");

  await page.getByRole("button", { name: "서버 검사 계속" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "합성 후보 만들기" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "이 합성 후보가 맞나요?" })).toBeVisible();

  await page.getByRole("button", { name: "값 수정" }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("원문과 같은 값으로 수정").focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("190");
  await page.getByRole("button", { name: "수정한 값 확인" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "건강 기록에 저장했어요" })).toBeVisible();

  await page.getByRole("link", { name: "저장된 기록 보기" }).focus();
  await page.keyboard.press("Enter");
  const provenance = page.getByText("출처와 버전 보기", { exact: true });
  await provenance.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("원래 후보", { exact: true }).locator("..")).toContainText("188 mg/dL");

  await page.goto("/data-control");
  await page.getByRole("button", { name: "동의 철회" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("REVOKED", { exact: true }).first()).toBeVisible();
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
