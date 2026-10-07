import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Isolated build/preview directories keep verification from corrupting the running dev server.
  // 안드로이드 앱(Capacitor)에 넣기 위해 정적 HTML 로 내보낸다 → out/
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default (phase) => ({
  ...nextConfig,
  distDir: process.env.NEXT_BUILD_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
});
