import "../font-bundle";
import "@gc/design-tokens/tokens.css";
import "../app/globals.css";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "daylight",
      values: [
        { name: "daylight", value: "#F5F7FA" },
        { name: "evidence", value: "#0B0D10" },
      ],
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
