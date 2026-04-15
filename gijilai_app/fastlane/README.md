fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## Android

### android build

```sh
[bundle exec] fastlane android build
```

Flutter 빌드 → AAB (App Bundle)

### android screenshots

```sh
[bundle exec] fastlane android screenshots
```

에뮬레이터에서 스크린샷 캡처

### android metadata

```sh
[bundle exec] fastlane android metadata
```

스토어 메타데이터 생성

### android deploy_internal

```sh
[bundle exec] fastlane android deploy_internal
```

Google Play 내부 테스트 트랙에 업로드

### android deploy_production

```sh
[bundle exec] fastlane android deploy_production
```

Google Play 프로덕션 배포

### android release

```sh
[bundle exec] fastlane android release
```

스크린샷 + 메타데이터 + 빌드 + 업로드 한번에

----


## iOS

### ios build

```sh
[bundle exec] fastlane ios build
```

Flutter 빌드 → IPA

### ios screenshots

```sh
[bundle exec] fastlane ios screenshots
```

iOS 시뮬레이터에서 스크린샷 캡처

### ios deploy_testflight

```sh
[bundle exec] fastlane ios deploy_testflight
```

App Store Connect에 업로드 (TestFlight)

### ios deploy_appstore

```sh
[bundle exec] fastlane ios deploy_appstore
```

App Store 프로덕션 제출

### ios release

```sh
[bundle exec] fastlane ios release
```

스크린샷 + 빌드 + TestFlight 한번에

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
