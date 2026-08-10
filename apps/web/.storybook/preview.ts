import "@gc/design-tokens/tokens.css";
import "../app/globals.css";
import type { Preview } from "@storybook/nextjs-vite";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "midnight",
      values: [{ name: "midnight", value: "#08090A" }],
    },
    a11y: {
      test: "error",
      options: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa"],
        },
      },
    },
  },
};

export default preview;
