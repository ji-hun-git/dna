import type { JestAxeMatchers } from "jest-axe";

declare module "vitest" {
  interface Assertion<T = any> extends JestAxeMatchers {}
}
