import packageJson from "../../package.json";

export type RuntimePlatform = "ios" | "android" | "web" | "other";

export type NativeAppInfo = {
  platform?: RuntimePlatform;
  version?: string;
  buildNumber?: string;
  packageName?: string;
  appName?: string;
};

export type RuntimeAppInfo = {
  platform: RuntimePlatform;
  version: string;
  buildNumber?: string;
  packageName?: string;
  appName?: string;
  isNativeApp: boolean;
};

declare global {
  interface Window {
    __nativeAppInfo?: NativeAppInfo;
  }
}

const WEB_APP_VERSION = packageJson.version;

function normalizePlatform(value?: string): RuntimePlatform {
  if (value === "ios" || value === "android") return value;
  if (value === "web") return "web";
  return "other";
}

export function getRuntimeAppInfo(): RuntimeAppInfo {
  if (typeof window === "undefined") {
    return {
      platform: "web",
      version: WEB_APP_VERSION,
      isNativeApp: false,
    };
  }

  const nativeInfo = window.__nativeAppInfo;
  const dataset = document.documentElement.dataset;
  const platform = normalizePlatform(
    nativeInfo?.platform ?? dataset.nativePlatform,
  );
  const isNativeApp = platform === "ios" || platform === "android";

  return {
    platform: isNativeApp ? platform : "web",
    version: nativeInfo?.version ?? dataset.nativeAppVersion ?? WEB_APP_VERSION,
    buildNumber: nativeInfo?.buildNumber ?? dataset.nativeAppBuildNumber,
    packageName: nativeInfo?.packageName,
    appName: nativeInfo?.appName,
    isNativeApp,
  };
}
