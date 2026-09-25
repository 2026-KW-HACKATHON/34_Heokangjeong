import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { SessionProvider } from "@/lib/session";
import BottomTab from "@/components/BottomTab";
import AuthGate from "@/components/AuthGate";
import { ChatAlertsProvider } from "@/lib/chat-alerts";

export const metadata: Metadata = { title: "월계 재능나눔", description: "월계1동 주민·상인과 광운대 학생을 잇는 재능 매칭" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <SessionProvider>
          <ChatAlertsProvider>
            {/* 모바일 앱 느낌의 480px 프레임. 데스크톱에서도 가운데에 폰 화면처럼 보인다. */}
            <div className="mx-auto min-h-screen max-w-[480px] bg-[var(--bg)] pb-24"><AuthGate>{children}</AuthGate></div>
            <BottomTab />
          </ChatAlertsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
