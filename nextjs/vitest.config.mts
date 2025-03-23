import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const testTimeout = process.env.VSCODE_INSPECTOR_OPTIONS
  ? 999_999_999
  : undefined;

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    testTimeout,
    fileParallelism: false,
    poolOptions: {
      threads: {
        maxThreads: 1,
      },
    },
  },
  setupFiles: ["./src/server/testing/matchers.ts"],
});
