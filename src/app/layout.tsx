import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { SessionProvider } from "@/lib/session";
import BottomTab from "@/components/BottomTab";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = { title: "WOLINK — 재능 나눔", description: "동네의 요청과 대학생의 재능을 연결하고, 함께한 경험을 포트폴리오로 남깁니다." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <SessionProvider>
          {/* 모바일 앱 느낌의 480px 프레임. 데스크톱에서도 가운데에 폰 화면처럼 보인다. */}
          <div className="mx-auto min-h-screen max-w-[480px] pb-24"><AuthGate>{children}</AuthGate></div>
          <BottomTab />
        </SessionProvider>
      </body>
    </html>
  );
}
