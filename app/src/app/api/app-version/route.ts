import { NextResponse } from "next/server";
import {
  GIJILAI_APP_STORE_URL,
  GIJILAI_PLAY_STORE_URL,
} from "@/lib/install";

export const dynamic = "force-dynamic";

const DEFAULT_ANDROID_MIN_SUPPORTED_BUILD = 33;
const DEFAULT_ANDROID_LATEST_BUILD = 33;
const DEFAULT_IOS_MIN_SUPPORTED_BUILD = 0;
const DEFAULT_IOS_LATEST_BUILD = 0;

function parseBuildNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readString(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export async function GET() {
  const androidMinSupportedBuild = parseBuildNumber(
    process.env.GIJILAI_MIN_ANDROID_BUILD,
    DEFAULT_ANDROID_MIN_SUPPORTED_BUILD,
  );
  const androidLatestBuild = parseBuildNumber(
    process.env.GIJILAI_LATEST_ANDROID_BUILD,
    Math.max(DEFAULT_ANDROID_LATEST_BUILD, androidMinSupportedBuild),
  );
  const iosMinSupportedBuild = parseBuildNumber(
    process.env.GIJILAI_MIN_IOS_BUILD,
    DEFAULT_IOS_MIN_SUPPORTED_BUILD,
  );
  const iosLatestBuild = parseBuildNumber(
    process.env.GIJILAI_LATEST_IOS_BUILD,
    Math.max(DEFAULT_IOS_LATEST_BUILD, iosMinSupportedBuild),
  );

  return NextResponse.json(
    {
      android: {
        minSupportedBuild: androidMinSupportedBuild,
        latestBuild: Math.max(androidLatestBuild, androidMinSupportedBuild),
        storeUrl: readString(
          process.env.GIJILAI_ANDROID_STORE_URL,
          GIJILAI_PLAY_STORE_URL,
        ),
        title: readString(
          process.env.GIJILAI_ANDROID_UPDATE_TITLE,
          "앱 업데이트가 필요해요",
        ),
        message: readString(
          process.env.GIJILAI_ANDROID_UPDATE_MESSAGE,
          "안정적인 이용을 위해 최신 버전으로 업데이트해주세요.",
        ),
      },
      ios: {
        minSupportedBuild: iosMinSupportedBuild,
        latestBuild: Math.max(iosLatestBuild, iosMinSupportedBuild),
        storeUrl: readString(
          process.env.GIJILAI_IOS_STORE_URL,
          GIJILAI_APP_STORE_URL,
        ),
        title: readString(
          process.env.GIJILAI_IOS_UPDATE_TITLE,
          "앱 업데이트가 필요해요",
        ),
        message: readString(
          process.env.GIJILAI_IOS_UPDATE_MESSAGE,
          "안정적인 이용을 위해 최신 버전으로 업데이트해주세요.",
        ),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
