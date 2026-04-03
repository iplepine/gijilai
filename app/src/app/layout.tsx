import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ReferralHandler } from "@/components/layout/ReferralHandler";
import { SurveyRestoreProvider } from "@/components/layout/SurveyRestoreProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "마음 통역소 | 우리 아이 기질 맞춤 양육 가이드",
  description: "과학적 기질 분석(TCI) 기반. 10분 설문으로 양육자와 아이의 기질적 구조를 분석하고 우리 가족만의 맞춤 양육 가이드를 받아보세요.",
  keywords: ["기질 분석", "마음 통역소", "육아", "양육 가이드", "CBQ", "ATQ", "아동 발달", "육아 고민"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#11d4d4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
        <link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" />
        {/* Material Symbols */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {/* Kakao SDK */}
        <script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js" async></script>
        {/* PortOne V2 SDK */}
        <script src="https://cdn.portone.io/v2/browser-sdk.js" async></script>
      </head>
      <body className="antialiased min-h-screen relative font-sans text-slate-800 dark:text-[#E8E2D6]" suppressHydrationWarning>
        {/* Background handled by globals.css body style */}

        {/* 다크모드 초기화 스크립트 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        <AuthProvider>
          <div className="min-h-screen bg-background-light dark:bg-background-dark">
            <ReferralHandler />
            <SurveyRestoreProvider />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

