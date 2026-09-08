import { expect, it } from "vitest";
import { FoundationClientError } from "@/lib/foundation/client";
import { describeFoundationError } from "@/lib/foundation/messages";

it("distinguishes a closed or full demo from a temporary request rate limit", () => {
  expect(describeFoundationError(new FoundationClientError("forbidden", 403, "demo_bootstrap_disabled")))
    .toBe("이 환경에서는 체험 시작이 열려 있지 않아요.");
  expect(describeFoundationError(new FoundationClientError("forbidden", 403, "demo_capacity_exhausted")))
    .toBe("체험 공간이 가득 찼어요. 운영자가 확인한 뒤 다시 시작할 수 있어요.");
  expect(describeFoundationError(new FoundationClientError("rate_limited", 429, "rate_limited")))
    .toBe("요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.");
});
