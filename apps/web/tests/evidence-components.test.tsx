import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { expect, it } from "vitest";
import { EvidenceCard } from "@/components/evidence/EvidenceCard";
import { verifiedPriceFixture } from "./fixtures/public";

it("renders provenance and a text alternative for every mark", async () => {
  const { container } = render(<EvidenceCard {...verifiedPriceFixture} />);
  expect(screen.getByText("검증됨")).toBeVisible();
  expect(screen.getByText(/조회일 2026-08-09/)).toBeVisible();
  expect(screen.getByRole("img", { name: /10개 중 7개/ })).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});
