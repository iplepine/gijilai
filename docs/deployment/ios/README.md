# iOS 배포 설정 재사용

기질아이 iOS TestFlight/App Store 업로드는 App Store Connect API Key를 사용한다. API Key는 Apple Developer 계정/조직 단위 키이므로, 같은 팀의 다른 프로젝트에서 쓰는 키를 재사용할 수 있다.

## 원칙

- `.p8` 키 파일과 키 본문이 포함된 JSON은 저장소에 커밋하지 않는다.
- 저장소에는 키 위치, 생성 절차, 업로드 명령만 문서화한다.
- 임시 업로드용 JSON은 `/tmp`에 만들고 업로드 후 삭제한다.
- APNs 푸시 키와 App Store Connect API Key를 혼동하지 않는다. TestFlight 업로드에는 App Store Connect API Key가 필요하다.

## 현재 재사용 가능한 로컬 키

`nodtry` 프로젝트의 App Store Connect API Key를 같은 Apple Developer 팀에서 재사용한다.

```text
/Users/basil/Projects/flutter/nodtry/ios/fastlane/api_key.json
/Users/basil/Projects/flutter/nodtry/ios/fastlane/AuthKey_*.p8
```

`api_key.json`은 `key_id`, `issuer_id`, `key_filepath`만 담고 있다. `fastlane run upload_to_testflight api_key_path:`는 키 본문 필드(`key`)가 있는 JSON을 요구하므로, 업로드 전에 아래 방식으로 임시 JSON을 생성한다.

## TestFlight 업로드 절차

현재 `fastlane ios deploy_testflight` / `fastlane ios deploy_appstore` lane은 아래 순서로 App Store Connect API Key를 찾는다.

1. `APP_STORE_CONNECT_API_KEY_PATH` 환경변수
2. `/tmp/gijilai_app_store_connect_api_key.json`
3. `nodtry` 프로젝트의 `/Users/basil/Projects/flutter/nodtry/ios/fastlane/api_key.json` + `.p8` 키를 읽어 임시 JSON 자동 생성

즉, 같은 머신에서 `nodtry` 키가 이미 있으면 별도 Fastlane 수정 없이 lane 자체로 업로드를 시도할 수 있다.

1. IPA를 먼저 만든다.

```sh
cd /Users/basil/Projects/gijilai/gijilai_app
flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
```

2. `nodtry` 키 설정에서 fastlane 업로드용 임시 JSON을 만든다.

```sh
ruby -rjson -e '
ios_dir = "/Users/basil/Projects/flutter/nodtry/ios"
src = File.join(ios_dir, "fastlane/api_key.json")
cfg = JSON.parse(File.read(src))
key_path = File.expand_path(cfg.fetch("key_filepath"), ios_dir)
out = {
  "key_id" => cfg.fetch("key_id"),
  "issuer_id" => cfg.fetch("issuer_id"),
  "key" => File.read(key_path)
}
File.write("/tmp/gijilai_app_store_connect_api_key.json", JSON.generate(out))
File.chmod(0600, "/tmp/gijilai_app_store_connect_api_key.json")
'
```

3. 생성된 IPA를 TestFlight에 업로드한다.

```sh
fastlane run upload_to_testflight \
  ipa:build/ios/ipa/gijilai.ipa \
  api_key_path:/tmp/gijilai_app_store_connect_api_key.json \
  skip_waiting_for_build_processing:true
```

4. 임시 JSON을 삭제한다.

```sh
rm -f /tmp/gijilai_app_store_connect_api_key.json
```

## 참고

- 현재 iOS 릴리스는 `TARGETED_DEVICE_FAMILY = 1`인 iPhone only 타깃으로 제출한다. App Store Connect에 iPad 탭이 보였다면, iPad 지원 제거 후 새 빌드를 다시 업로드해야 반영된다.
- `fastlane ios deploy_testflight` lane은 App Store Connect API Key를 자동 탐색해서 `upload_to_testflight`에 전달한다. 키를 못 찾으면 명확한 에러로 중단된다.
- `fastlane ios deploy_appstore` lane은 `fastlane/screenshots/ios`에 스크린샷이 없으면 스크린샷 업로드를 건너뛴다. 첫 제출이거나 App Store Connect에 스크린샷이 아직 없다면 별도로 준비해야 한다.
- `fastlane ios deploy_testflight` lane에서 내부 빌드 단계의 CocoaPods/Xcode 환경 문제가 나면 위 절차처럼 `flutter build ipa`를 직접 실행한 뒤 `upload_to_testflight`만 호출한다.
- 업로드 성공 후 App Store Connect에서 빌드 처리가 완료되기까지 몇 분 걸릴 수 있다.
- 새 빌드를 올릴 때는 `gijilai_app/pubspec.yaml`의 build number를 이전 TestFlight 빌드보다 높여야 한다.
