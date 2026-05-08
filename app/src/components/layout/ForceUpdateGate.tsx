"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getRuntimeAppInfo, type RuntimePlatform } from "@/lib/appInfo";

type PlatformUpdatePolicy = {
  minSupportedBuild?: number;
  latestBuild?: number;
  storeUrl?: string;
  title?: string;
  message?: string;
};

type AppUpdatePolicyResponse = Partial<
  Record<Extract<RuntimePlatform, "android" | "ios">, PlatformUpdatePolicy>
>;

type RequiredUpdate = {
  platform: Extract<RuntimePlatform, "android" | "ios">;
  storeUrl: string;
  title: string;
  message: string;
};

const ANDROID_PACKAGE_NAME = "com.devho.gijilai";
const ANDROID_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;
const IOS_APP_STORE_URL = "https://apps.apple.com/app/id6761619239";

function parseBuildNumber(value?: string) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getAndroidStoreIntent(storeUrl: string) {
  const fallbackUrl = encodeURIComponent(storeUrl || ANDROID_PLAY_STORE_URL);
  return `intent://details?id=${ANDROID_PACKAGE_NAME}#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=${fallbackUrl};end`;
}

export function ForceUpdateGate() {
  const [requiredUpdate, setRequiredUpdate] = useState<RequiredUpdate | null>(
    null,
  );

  useEffect(() => {
    let isCancelled = false;

    async function refreshUpdateRequirement() {
      const appInfo = getRuntimeAppInfo();
      if (
        !appInfo.isNativeApp ||
        (appInfo.platform !== "android" && appInfo.platform !== "ios")
      ) {
        if (!isCancelled) setRequiredUpdate(null);
        return;
      }

      const currentBuild = parseBuildNumber(appInfo.buildNumber);
      if (currentBuild === null) return;

      try {
        const response = await fetch("/api/app-version", {
          cache: "no-store",
        });
        if (!response.ok) return;

        const policy = (await response.json()) as AppUpdatePolicyResponse;
        const platformPolicy = policy[appInfo.platform];
        const minSupportedBuild = platformPolicy?.minSupportedBuild ?? 0;

        if (currentBuild >= minSupportedBuild) {
          if (!isCancelled) setRequiredUpdate(null);
          return;
        }

        if (!isCancelled) {
          const fallbackStoreUrl =
            appInfo.platform === "android"
              ? ANDROID_PLAY_STORE_URL
              : IOS_APP_STORE_URL;

          setRequiredUpdate({
            platform: appInfo.platform,
            storeUrl: platformPolicy?.storeUrl || fallbackStoreUrl,
            title: platformPolicy?.title || "앱 업데이트가 필요해요",
            message:
              platformPolicy?.message ||
              "안정적인 이용을 위해 최신 버전으로 업데이트해주세요.",
          });
        }
      } catch (error) {
        console.warn("Failed to check app update policy", error);
      }
    }

    void refreshUpdateRequirement();
    window.addEventListener(
      "gijilai:nativeContextReady",
      refreshUpdateRequirement,
    );
    window.addEventListener("focus", refreshUpdateRequirement);

    return () => {
      isCancelled = true;
      window.removeEventListener(
        "gijilai:nativeContextReady",
        refreshUpdateRequirement,
      );
      window.removeEventListener("focus", refreshUpdateRequirement);
    };
  }, []);

  if (!requiredUpdate) return null;

  const openStore = () => {
    const destination =
      requiredUpdate.platform === "android"
        ? getAndroidStoreIntent(requiredUpdate.storeUrl)
        : requiredUpdate.storeUrl;
    window.location.href = destination;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-[#F9F8F6] px-6 py-8 text-[#26382F]">
      <div className="flex w-full max-w-[360px] flex-col items-center text-center">
        <Image
          src="/gijilai_icon.png"
          alt="기질아이"
          width={96}
          height={96}
          priority
          className="rounded-[28px] shadow-[0_18px_34px_rgba(47,79,62,0.16)]"
        />
        <h1 className="mt-8 text-[24px] font-extrabold leading-tight tracking-normal text-[#2F4F3E]">
          {requiredUpdate.title}
        </h1>
        <p className="mt-3 text-[15px] font-medium leading-7 text-[#68756F]">
          {requiredUpdate.message}
        </p>
        <button
          type="button"
          onClick={openStore}
          className="mt-8 h-[52px] w-full rounded-[14px] bg-[#2F4F3E] px-5 text-[16px] font-bold text-white shadow-[0_12px_24px_rgba(47,79,62,0.18)]"
        >
          업데이트하기
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 h-11 w-full rounded-[14px] border border-[#D8D3C7] bg-white px-5 text-[14px] font-bold text-[#2F4F3E]"
        >
          다시 확인
        </button>
      </div>
    </div>
  );
}
