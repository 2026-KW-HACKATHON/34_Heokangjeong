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
  // 마이그레이션이 많아 DB 테스트의 준비(beforeEach)에 10초 이상 걸린다
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 60_000 },
});
