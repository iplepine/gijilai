import type { Metadata, Viewport } from "next";
import { Jua, Lexend, Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import { FirebaseAnalytics } from "@/components/analytics/FirebaseAnalytics";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { FcmTokenSync } from "@/components/notifications/FcmTokenSync";
import { ForceUpdateGate } from "@/components/layout/ForceUpdateGate";
import { KeyboardViewportTracker } from "@/components/layout/KeyboardViewportTracker";
import { ReferralHandler } from "@/components/layout/ReferralHandler";
import { SurveyRestoreProvider } from "@/components/layout/SurveyRestoreProvider";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import { StructuredData } from "@/components/seo/StructuredData";
import "./globals.css";

const displayFont = Jua({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-jua",
});

const bodyFont = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
});

const koreanFont = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-noto-kr",
  weight: ["300", "400", "500", "700"],
});

const SEO_TITLE = "기질아이 | 아이 기질검사·떼쓰기 맞춤 육아상담";
const OG_IMAGE = {
  url: "/gijilai_icon_kakao.png",
  width: 256,
  height: 256,
  alt: "기질아이",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://gijilai.com"),
  applicationName: "기질아이",
  title: {
    default: SEO_TITLE,
    template: "%s | 기질아이",
  },
  description: "아이 떼쓰기, 예민함, 등원 거부, 분리불안이 고민될 때 3분 아이 기질검사로 행동의 이유를 보고 맞춤 대화법과 육아상담을 받아보세요.",
  keywords: [
    "기질아이",
    "아이 기질검사",
    "아이 기질",
    "떼쓰기",
    "예민한 아이",
    "등원 거부",
    "분리불안",
    "형제갈등",
    "훈육",
    "대화법",
    "육아상담",
    "부모상담",
    "양육코칭",
    "감정조절",
  ],
  authors: [{ name: "기질아이" }],
  creator: "기질아이",
  publisher: "기질아이",
  category: "parenting",
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [{ url: "/gijilai_icon_kakao.png", type: "image/png" }],
    shortcut: ["/gijilai_icon_kakao.png"],
    apple: [{ url: "/gijilai_icon_kakao.png" }],
  },
  appleWebApp: {
    capable: true,
    title: "기질아이",
    statusBarStyle: "default",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://gijilai.com",
    siteName: "기질아이",
    title: SEO_TITLE,
    description: "3분 아이 기질검사로 떼쓰기와 예민함의 이유를 보고, 오늘 바로 쓸 맞춤 대화법을 받아보세요.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary",
    title: SEO_TITLE,
    description: "아이 떼쓰기와 예민함의 이유를 기질 리포트로 보고 맞춤 대화법을 받아보세요.",
    images: [OG_IMAGE.url],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F9F8F6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <StructuredData />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" />
        {/* Material Symbols */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <Script
          id="kakao-js-sdk"
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.0/kakao.min.js"
          strategy="afterInteractive"
        />
        {/* PortOne V2 SDK */}
        <script src="https://cdn.portone.io/v2/browser-sdk.js" async></script>
        {measurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
              strategy="afterInteractive"
            />
            <Script
              id="firebase-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  window.gtag = gtag;
                  gtag('js', new Date());
                  gtag('config', '${measurementId}', {
                    send_page_view: false
                  });
                `,
              }}
            />
          </>
        ) : null}
      </head>
      <body className={`${displayFont.variable} ${bodyFont.variable} ${koreanFont.variable} antialiased min-h-screen relative font-sans text-slate-800 dark:text-[#E8E2D6]`} suppressHydrationWarning>
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const root = document.documentElement;
                const markReady = () => root.classList.add('material-icons-ready');

                if (!document.fonts) {
                  markReady();
                  return;
                }

                window.addEventListener('load', function() {
                  Promise.all([
                    document.fonts.load('24px "Material Symbols Outlined"', 'child_care'),
                    document.fonts.load('24px "Material Icons Round"', 'face')
                  ]).then(function(results) {
                    const loaded = results.every(function(fonts) {
                      return Array.isArray(fonts) && fonts.length > 0;
                    });
                    if (loaded) markReady();
                  }).catch(function() {});
                }, { once: true });
              })();
            `,
          }}
        />
        <AuthProvider>
          <LocaleProvider>
            <ToastProvider>
              <ConfirmProvider>
                <div className="min-h-screen bg-background-light dark:bg-background-dark">
                  <FirebaseAnalytics />
                  <KeyboardViewportTracker />
                  <ReferralHandler />
                  <SurveyRestoreProvider />
                  <FcmTokenSync />
                  {children}
                  <ForceUpdateGate />
                </div>
              </ConfirmProvider>
            </ToastProvider>
          </LocaleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
