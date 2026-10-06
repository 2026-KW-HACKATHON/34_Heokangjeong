import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "supabase/functions/_shared"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  // 화면 컴포넌트도 테스트에서 그려 볼 수 있게 (tsconfig 는 Next 용이라 jsx: preserve)
  esbuild: { jsx: "automatic" },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60_000 },
});
