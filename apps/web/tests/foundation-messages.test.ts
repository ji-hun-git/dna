import { expect, it } from "vitest";
import { FoundationClientError } from "@/lib/foundation/client";
import { describeFoundationError } from "@/lib/foundation/messages";

it("distinguishes a closed or full demo from a temporary request rate limit", () => {
  expect(describeFoundationError(new FoundationClientError("forbidden", 403, "demo_bootstrap_disabled")))
    .toBe("현재 체험을 시작할 수 없어요.");
  expect(describeFoundationError(new FoundationClientError("forbidden", 403, "demo_capacity_exhausted")))
    .toBe("체험 이용 한도에 도달했어요. 운영자에게 문의해 주세요.");
  expect(describeFoundationError(new FoundationClientError("rate_limited", 429, "rate_limited")))
    .toBe("요청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.");
});
