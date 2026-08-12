import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasOverflow).toBe(false);
}

test("홈에서 미확인 예시 항목 검토를 이어간다", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /건강 기록을\s*한곳에서 확인하세요/ })).toBeVisible();
  await expect(page.getByText(/실제 기관 연결 0곳/)).toBeVisible();
  await expect(page.getByText(/이 화면의 값만으로 질환을 진단하거나/)).toBeVisible();

  await page.getByRole("button", { name: "이어서 확인" }).click();
  await expect(page.getByRole("heading", { name: "이 값이 맞나요?" })).toBeVisible();
  await expect(page.getByText(/선택한 파일에서 읽은 값은 아니에요/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("resume-review-desktop.png"), fullPage: true });
});

test("모바일에서도 공개 의료정보의 한계와 출처를 바로 이해한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/providers");

  await expect(page.getByRole("heading", { name: /공개 의료정보를 출처와 함께 살펴봐요/ })).toBeVisible();
  await expect(page.getByText(/현재 기관·주소·항목·금액은 모두 화면 확인용 예시예요/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("providers-mobile.png"), fullPage: true });
});

test("데이터 관리 화면은 실행되지 않는 삭제 기능을 명확히 표시한다", async ({ page }) => {
  await page.goto("/data-control");

  await expect(page.getByRole("heading", { name: "내 데이터는 내가 정해요" })).toBeVisible();
  await expect(page.getByText("예시 화면 · 서버에는 반영되지 않아요")).toBeVisible();
  await expect(page.getByRole("button", { name: "계정과 데이터 모두 삭제 아직 사용할 수 없음" })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});
