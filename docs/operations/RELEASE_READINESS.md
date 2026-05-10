# 출시 준비 체크리스트

마지막 갱신일: 2026-05-10

## 최근 배포

- 2026-05-08: Android Google Play internal/production `1.0.7+33` 배포 완료. 카카오톡 공유를 Flutter 네이티브 Kakao Share SDK 브리지로 전환했다.
- 2026-05-07: Web production `df173e6` Vercel 배포 완료. Deployment `dpl_2KBWLmpyEx6e4SmwyLQPmYFYDzoH` (`gijilai-oqjn5ixzr-gijilai.vercel.app`) READY 확인.
- 2026-05-07: iOS TestFlight `1.0.6+32` 업로드 완료. `1.0.5+32`는 App Store Connect에서 `1.0.5` pre-release train이 닫혀 거절되어 marketing version을 `1.0.6`으로 올려 재업로드했다.
- 2026-05-06: Android Google Play internal/production `1.0.5+31` 배포 완료. AAB: `gijilai_app/build/app/outputs/bundle/release/app-release.aab`. 카카오톡 앱 로그인 복귀와 Google 릴리스 로그인 동작을 확인했다.
- 2026-05-06: Android Google Play internal/production `1.0.3+29` 배포 완료. AAB: `gijilai_app/build/app/outputs/bundle/release/app-release.aab`.
- 2026-05-06: Android production Fastlane lane은 다음 배포부터 marketing patch version과 build number를 함께 올린 뒤 업로드하도록 변경했다.

## 앱 강제 업데이트 운영

- 앱 버전 정책은 Next.js `/api/app-version`에서 내려준다.
- Android 기본 최소 지원 build는 `33`이다. 운영 환경에서는 `GIJILAI_MIN_ANDROID_BUILD`, `GIJILAI_LATEST_ANDROID_BUILD`, `GIJILAI_ANDROID_STORE_URL`, `GIJILAI_ANDROID_UPDATE_TITLE`, `GIJILAI_ANDROID_UPDATE_MESSAGE`로 조정한다.
- iOS 기본 최소 지원 build는 `0`이다. iOS 강제 업데이트가 필요하면 `GIJILAI_MIN_IOS_BUILD`, `GIJILAI_LATEST_IOS_BUILD`, `GIJILAI_IOS_STORE_URL`, `GIJILAI_IOS_UPDATE_TITLE`, `GIJILAI_IOS_UPDATE_MESSAGE`를 설정한다.
- Flutter 앱은 WebView 로드 전에 정책을 확인해 지원 종료 버전이면 업데이트 화면만 표시한다.
- 기존 앱은 WebView가 주입한 `window.__nativeAppInfo.buildNumber`를 웹 전역 `ForceUpdateGate`가 확인해 업데이트 오버레이를 표시한다.

## 제품

- [ ] 핵심 흐름이 동작한다: 로그인 → 아이 등록 → 설문 → 리포트 → 상담 → 실천
- [ ] `child_only` 빠른 진단에서 전체 분석 확장 CTA가 보인다.
- [ ] 리포트 하단 CTA가 상담/실천/구독 루프를 명확히 설명한다.
- [ ] 상담 결과에서 기본 실천 항목이 선택되어 있다.
- [ ] 홈 대표 실천 카드가 3개 이상일 때 `+N개 더`로 남은 개수를 표시한다.
- [ ] 실천 마무리 회고는 비워도 저장되고, 저장 후 다음 행동 CTA가 보인다.
- [ ] 다자녀 계정에서 실천 카드 아이 태그와 상담 인사 아이 이름 강조가 보인다.
- [ ] 홈 화면은 스크롤 reveal 없이 주요 카드가 즉시 보인다.
- [ ] 상담/실천 음성 입력 버튼은 첫 탭에서 키보드 포커스 없이 바로 음성 입력을 시작한다.

## 신뢰/정책

- [ ] 리포트와 상담에 의학적·심리학적 진단이 아니라는 안내가 있다.
- [ ] 전문가 검토 문구는 실제 검토 범위가 있을 때만 사용한다.
- [ ] 개인정보, 환불, 구독 해지 안내가 사용자가 찾을 수 있는 위치에 있다.
- [ ] 이벤트에는 개인식별 가능 정보가 포함되지 않는다.

## 결제/구독

- [ ] 7일 체험 상태와 만료 상태가 홈/가격/상담 접근에서 일관된다.
- [ ] 구독 생성, 갱신, 해지 예약, 해지 철회, 만료 상태가 사용자 언어로 표시된다.
- [ ] 앱 IAP와 웹 결제 분기가 정책과 맞는다.
- [ ] 결제 실패와 웹훅 실패가 운영 로그로 확인된다.

## 분석

- [ ] Firebase Measurement ID가 운영 환경에 설정되어 있다.
- [ ] 리포트 전환 퍼널 A/B/C가 저장되어 있다.
- [ ] `report_kind`, `source`, `cta_type` 값이 문서와 일치한다.
- [ ] 첫 주 기준선 수치를 기록할 위치가 정해져 있다.

## 운영

- [ ] 환불 요청 수신 채널과 처리 기준이 준비되어 있다.
- [ ] CS에서 구독 상태를 사용자 언어로 설명할 수 있다.
- [ ] 출시 후 첫 주에는 기능 추가보다 이탈 구간 확인을 우선한다.
- [ ] Android/iOS WebView에서 하단 탭 기록 아이콘, 중앙 상담 FAB, 하단 safe area가 잘리지 않는다.
