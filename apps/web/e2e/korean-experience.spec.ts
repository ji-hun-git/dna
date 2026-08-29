import { expect, test, type Page } from "@playwright/test";

async function openHealthApplication(page: Page, path: string) {
  await page.goto(path);
  const body = page.locator("body");
  await expect(body).toHaveAttribute("data-application-id", "genome-companion-korea-web");
  await expect(body).toHaveAttribute("data-application-instance", "playwright-genome-companion-korea-web");
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasOverflow).toBe(false);
}

test("홈에서 미확인 예시 항목 검토를 이어간다", async ({ page }, testInfo) => {
  await openHealthApplication(page, "/");

  await expect(page.getByRole("heading", { name: /건강 기록을\s*한곳에서 확인하세요/ })).toBeVisible();
  await expect(page.getByText(/실제 기관 연결 0곳/)).toBeVisible();
  await expect(page.getByText(/이 화면의 값만으로 질환을 진단하거나/)).toBeVisible();

  await page.getByRole("button", { name: "이어서 확인" }).click();
  await expect(page.getByRole("heading", { name: "이 값이 맞나요?" })).toBeVisible();
  await expect(page.getByText(/선택한 파일에서 읽은 값은 아니에요/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("resume-review-desktop.png"), fullPage: true });
});

test("파일 내용이 형식과 맞을 때만 확인·수정·제외한 항목을 로컬 시연에 추가한다", async ({ page }, testInfo) => {
  await openHealthApplication(page, "/");
  await page.getByRole("button", { name: "결과지 추가" }).first().click();

  const input = page.getByLabel("기기에서 결과지 선택");
  await input.setInputFiles({
    name: "renamed.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("plain text renamed as pdf", "utf8"),
  });
  await expect(page.getByText(/파일 내용이 확장자와 맞지 않아요/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /파일 확인을\s*마쳤어요/ })).not.toBeVisible();

  await input.setInputFiles({
    name: "synthetic-result.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nsynthetic health result", "utf8"),
  });
  await expect(page.getByRole("heading", { name: /파일 확인을\s*마쳤어요/ })).toBeVisible();
  await expect(page.getByText("파일 내용은 읽지 않았습니다.", { exact: false })).toBeVisible();
  await expect(page.getByText("파일 확인 결과 · 예시")).toBeVisible();

  await page.getByRole("button", { name: "예시 항목 3개 확인하기" }).click();
  await expect(page.getByRole("heading", { name: "이 값이 맞나요?" })).toBeVisible();
  await page.getByRole("button", { name: "원문과 같아요" }).click();
  await expect(page.getByRole("heading", { name: "총콜레스테롤" })).toBeVisible();

  await page.getByRole("button", { name: "값 수정" }).click();
  await page.getByRole("textbox", { name: "총콜레스테롤 값" }).fill("190");
  await page.getByRole("button", { name: "수정한 값 저장" }).click();
  await expect(page.getByRole("heading", { name: "비타민 D" })).toBeVisible();

  await page.getByRole("button", { name: "이 항목 빼기" }).click();
  await expect(page.getByRole("heading", { name: /예시 항목 2개를\s*확인했어요/ })).toBeVisible();
  await page.getByRole("button", { name: "시연 화면에 추가" }).click();
  await expect(page.getByText("확인한 항목 2개를 추가했어요")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("local-review-complete-desktop.png"), fullPage: true });
});

test("모바일에서도 공개 의료정보의 한계와 출처를 바로 이해한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHealthApplication(page, "/providers");

  await expect(page.getByRole("heading", { name: /공개 의료정보를 출처와 함께 살펴봐요/ })).toBeVisible();
  await expect(page.getByText(/현재 기관·주소·항목·금액은 모두 화면 확인용 예시예요/)).toBeVisible();
  await page.getByRole("combobox", { name: "지역" }).selectOption("부산");
  await expect(page.getByRole("table", { name: "예시 의료기관 정보 비교" }).getByText("다온부산병원")).toBeVisible();
  await page.getByRole("button", { name: /비급여 항목·금액/ }).click();
  const priceTable = page.getByRole("table", { name: "예시 비급여 금액 비교" });
  await expect(priceTable.getByText("₩530,000")).toBeVisible();
  await priceTable.getByText("금액 안내").click();
  await expect(priceTable.getByText(/실제 가격이나 최종 청구액, 의료의 질을 뜻하지 않습니다/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("providers-mobile.png"), fullPage: true });
});

test("데이터 관리 화면은 실행되지 않는 삭제 기능을 명확히 표시한다", async ({ page }) => {
  await openHealthApplication(page, "/data-control");

  await expect(page.getByRole("heading", { name: "내 데이터는 내가 정해요" })).toBeVisible();
  await expect(page.getByText("예시 화면 · 서버에는 반영되지 않아요")).toBeVisible();
  await expect(page.getByRole("button", { name: "계정과 데이터 모두 삭제 아직 사용할 수 없음" })).toBeDisabled();
  await page.getByRole("button", { name: "결과지로 건강 기록 만들기 동의 철회" }).click();
  const dialog = page.getByRole("dialog", { name: "이 동의를 철회할까요?" });
  await expect(dialog.getByText(/이 예시 화면에서만 바뀌며/)).toBeVisible();
  await dialog.getByRole("button", { name: "동의 철회" }).click();
  await expect(page.getByText("철회됨")).toBeVisible();
  await expect(page.getByText("결과지 기록 동의를 철회함 · 예시")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("로그인과 건강정보 연결은 실제 연동 전 상태를 숨기지 않는다", async ({ page }) => {
  await openHealthApplication(page, "/connections");

  await expect(page.getByRole("heading", { name: "필요한 정보만 연결해요" })).toBeVisible();
  await expect(page.getByText("로그인은 건강정보 제공 동의가 아니에요")).toBeVisible();
  await expect(page.getByRole("button", { name: "카카오 로그인 준비 중" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "네이버 로그인 준비 중" })).toBeDisabled();
  await expect(page.getByText("건강정보고속도로")).toBeVisible();
  await expect(page.getByText("연결 준비 전")).toBeVisible();
  await expect(page.getByText("실제 건강정보 API 요청 0건")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("모바일 기록 화면에서 항목을 바꾸고 출처 이력을 확인한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHealthApplication(page, "/records");

  await expect(page.getByRole("heading", { name: /시간이 지나며\s*무엇이 바뀌었는지 확인하세요/ })).toBeVisible();
  await expect(page.getByText("실제 파일이나 기관 API에서 가져온 기록이 아니에요")).toBeVisible();
  await page.getByRole("button", { name: /총콜레스테롤.*188/ }).click();
  await expect(page.getByRole("img", { name: /총콜레스테롤 예시 기록/ })).toBeVisible();
  await page.getByText("출처와 확인 이력 보기").first().click();
  await expect(page.locator("details[open]").getByText("2쪽 · 검사결과 표 · 5행")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("records-mobile.png"), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect(page.getByRole("heading", { name: "이 화면은 진단 결과가 아니에요" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
