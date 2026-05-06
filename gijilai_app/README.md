# gijilai_app

Flutter WebView shell for Gijilai.

## Local Android QA

The app's default WebView URL is `https://gijilai.com/`. To install the Android
debug app with that default URL, start an emulator or connect a device and run:

```bash
./scripts/install_android_default.sh
```

This intentionally does not pass `GIJILAI_WEB_URL`, so
`lib/main.dart` falls back to the app default.

Google native login validates both package name and the APK signing
certificate. The checked-in `google-services.json` Android client currently
matches the upload/release key, so debug APK Google login only works after the
local debug SHA is also registered in Firebase/Google Cloud. For a production
auth smoke test on a connected device, install the release-signed APK:

```bash
ANDROID_SERIAL=<device-id> ANDROID_BUILD_MODE=release ANDROID_FORCE_REINSTALL=1 ./scripts/install_android_default.sh
```

`ANDROID_FORCE_REINSTALL=1` is needed when switching between debug and release
signing variants for the same package name.

For local web QA, pass the host dev server URL through the Android emulator's
host alias.

From the web app directory, start the local Next.js server:

```bash
cd ../app
npm run dev -- --port 3000
```

Then run the Android app against that local server:

```bash
./scripts/run_android_local.sh
```

The script starts `small_phone` as:

```bash
emulator @small_phone -no-window -no-audio -no-snapshot -gpu swiftshader -port 5554
```

It also passes `GIJILAI_WEB_URL=http://10.0.2.2:3000/` to Flutter so the
Android WebView loads the host machine's local web app. Google native login
uses the same default `GOOGLE_WEB_CLIENT_ID` dart define as the release lane,
unless overridden in the environment.

To only start the emulator:

```bash
./scripts/start_stable_android_emulator.sh
```

Useful overrides:

```bash
AVD_NAME=small_phone ANDROID_DEVICE_LOCALE=ko-KR ./scripts/start_stable_android_emulator.sh
GIJILAI_WEB_PORT=3001 ./scripts/run_android_local.sh
ANDROID_BUILD_MODE=debug ./scripts/install_android_default.sh
```
