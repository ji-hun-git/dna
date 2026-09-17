import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SourcePreview } from "@/components/integrated/SourcePreview";

afterEach(cleanup);

it("names the page the value came from and says the preview shows the first page", () => {
  const { container } = render(<SourcePreview documentId="e64ddaae-a326-4f23-88a9-05ac59a48625" page={2} />);
  expect(container.querySelector("figure")).toHaveAttribute("data-page", "2");
  expect(screen.getByRole("img", { name: "예시 결과지 첫 페이지 미리보기 (값은 2쪽)" })).toHaveAttribute(
    "src",
    "/api/foundation/documents/e64ddaae-a326-4f23-88a9-05ac59a48625/preview",
  );
  expect(screen.getByText(/값은 2쪽에 있어요\. 미리보기는 결과지의 첫 페이지만 보여드려요\./)).toBeVisible();
  cleanup();
  render(<SourcePreview documentId="e64ddaae-a326-4f23-88a9-05ac59a48625" page={1} />);
  expect(screen.getByRole("img", { name: "예시 결과지 1쪽 미리보기" })).toBeVisible();
  expect(screen.queryByText(/첫 페이지만 보여드려요/)).toBeNull();
});
