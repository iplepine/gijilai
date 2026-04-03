# 앱 스토어 출시 준비 가이드

Google Play Store / App Store 출시에 필요한 모든 항목을 정리한 문서.
Fastlane으로 대부분 자동화되어 있다.

---

## 앱 기본 정보

| 항목 | 값 |
|------|-----|
| 앱 이름 | 기질아이 |
| 패키지명 | com.devho.gijilai |
| 개인정보 처리방침 | https://gijilai.com/legal/privacy |
| 이용약관 | https://gijilai.com/legal/terms |
| 환불 정책 | https://gijilai.com/legal/refund |
| 고객센터 | https://gijilai.com/legal/support |
| 연락처 | devhohouse@gmail.com / 010-3830-8960 |

---

## Fastlane 사용법

### 초기 설정

```bash
cd gijilai_app
bundle install
```

### 명령어 목록

| 명령어 | 설명 |
|--------|------|
| `bundle exec fastlane android screenshots` | 에뮬레이터에서 스크린샷 캡처 |
| `bundle exec fastlane android metadata` | 스토어 메타데이터 생성 |
| `bundle exec fastlane android build` | AAB 빌드 |
| `bundle exec fastlane android deploy_internal` | 내부 테스트 트랙 업로드 |
| `bundle exec fastlane android deploy_production` | 프로덕션 배포 |
| `bundle exec fastlane android release` | 스크린샷+메타데이터+빌드+업로드 한번에 |
| `bundle exec fastlane ios screenshots` | 시뮬레이터에서 스크린샷 캡처 |
| `bundle exec fastlane ios build` | IPA 빌드 |
| `bundle exec fastlane ios deploy_testflight` | TestFlight 업로드 |
| `bundle exec fastlane ios deploy_appstore` | App Store 제출 |
| `bundle exec fastlane ios release` | 스크린샷+빌드+TestFlight 한번에 |

### 환경변수

| 변수 | 용도 |
|------|------|
| `GOOGLE_PLAY_JSON_KEY_PATH` | Google Play 서비스 계정 JSON 키 파일 경로 |
| `GOOGLE_PLAY_CREDENTIALS` | IAP 영수증 검증용 (서버) |
| `APPLE_IAP_JWT` | Apple IAP 영수증 검증용 (서버) |

---

## 파일 구조

```
gijilai_app/fastlane/
├── Fastfile                          # Fastlane 자동화 스크립트
├── Appfile                           # 앱 식별자 설정
├── metadata/
│   ├── android/
│   │   ├── ko/
│   │   │   ├── title.txt             # 앱 이름 (30자)
│   │   │   ├── short_description.txt # 간단한 설명 (80자)
│   │   │   └── full_description.txt  # 자세한 설명 (4000자)
│   │   └── en-US/
│   │       ├── title.txt
│   │       ├── short_description.txt
│   │       └── full_description.txt
│   └── ios/
│       └── ko/
│           ├── name.txt              # 앱 이름
│           ├── subtitle.txt          # 부제
│           ├── description.txt       # 설명
│           ├── keywords.txt          # 검색 키워드
│           ├── promotional_text.txt  # 프로모션 텍스트
│           ├── privacy_url.txt
│           ├── support_url.txt
│           └── marketing_url.txt
└── screenshots/
    ├── android/                      # Android 스크린샷
    └── ios/                          # iOS 스크린샷
```

---

## 스크린샷 캡처 화면

| # | 화면 | 설명 |
|---|------|------|
| 1 | 홈 | 메인 대시보드 |
| 2 | 리포트 | 기질 분석 결과 |
| 3 | AI 상담 | 마음통역기 대화 |
| 4 | 요금제 | 프리미엄 구독 안내 |
| 5 | 설정 | 프로필/설정 |

> WebView 앱이라 로그인 필요한 화면은 수동 이동 후 Enter로 캡처.

### 스크린샷 규격

| 플랫폼 | 해상도 |
|--------|--------|
| Google Play | 16:9 또는 9:16, 320~3840px |
| App Store 6.7" | 1290 x 2796 |
| App Store 6.1" | 1179 x 2556 |
| App Store 5.5" | 1242 x 2208 |

---

## 그래픽 에셋 (수동 준비)

| 에셋 | 규격 | 용도 |
|------|------|------|
| 앱 아이콘 | 512x512 (Google), 1024x1024 (Apple) | 스토어 아이콘 |
| 그래픽 이미지 | 1024x500 (Google만) | 스토어 배너 |

---

## 콘텐츠 등급 (수동 설문)

| 질문 | 답변 |
|------|------|
| 폭력/공포/성적/욕설/약물/도박 | 모두 없음 |
| 사용자 간 상호작용 | 없음 |
| 개인정보 수집 | 있음 (이메일, 자녀 정보) |
| 광고 | 없음 |
| 인앱 구매 | 있음 |

예상 등급: **전체 이용가 / 4+**

---

## 데이터 안전 (수동 신고)

### 수집 데이터

| 데이터 | 수집 목적 | 공유 여부 |
|--------|----------|----------|
| 이메일, 이름 | 계정, 프로필 | 비공유 |
| 자녀 이름/생년월일/검사결과 | 기질 분석, AI 상담 | 비공유 |
| 구매 내역 | 구독 관리 | Google/Apple 위임 |
| 앱 활동 | 서비스 개선 | Firebase Analytics |
| 크래시 로그 | 안정성 개선 | Firebase Crashlytics |
| FCM 토큰 | 푸시 알림 | Firebase |

### 공통 답변

- 데이터 수집: 예
- 제3자 판매: 아니요
- 암호화 전송: 예 (HTTPS)
- 사용자 삭제 요청: 가능
- 아동 대상 앱: 아니요 (부모 대상)

---

## 체크리스트

### Google Play Store

- [x] 개인정보 처리방침 URL
- [x] 이용약관 URL
- [x] IAP 구독 상품 (monthly_premium)
- [x] 릴리스 서명 설정
- [x] 스토어 메타데이터 (fastlane/metadata)
- [ ] 앱 아이콘 512x512
- [ ] 그래픽 이미지 1024x500
- [ ] 스크린샷 (fastlane android screenshots)
- [ ] 콘텐츠 등급 (IARC 설문)
- [ ] 데이터 안전 신고
- [ ] 타겟 연령층 선언
- [ ] `GOOGLE_PLAY_JSON_KEY_PATH` 환경변수
- [ ] 테스트 계정 준비
- [ ] 내부 테스트 업로드 (fastlane android deploy_internal)

### App Store

- [x] 개인정보 처리방침 URL
- [x] 이용약관 URL
- [x] 스토어 메타데이터 (fastlane/metadata/ios)
- [ ] App Store Connect 앱 등록
- [ ] 앱 아이콘 1024x1024
- [ ] 스크린샷 (fastlane ios screenshots)
- [ ] 연령 등급 설문
- [ ] 앱 개인정보 보호 선언
- [ ] iOS 구독 상품 생성
- [ ] `APPLE_IAP_JWT` 환경변수
- [ ] Appfile에 apple_id, team_id 설정
- [ ] IDFA / ATT 설정
- [ ] TestFlight 업로드 (fastlane ios deploy_testflight)
