<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `425ffe550f386bbd28c1035ed096ef4c513e3e51` (`claude/enable-phased-assessment`)
> - 최근 커밋: `425ffe550f38` docs: refresh project documentation status
> - 커밋 일시: `2026-06-20T22:38:59+09:00`
> - 워킹트리: `clean`
> - 문서 갱신: `2026-06-20 22:39:28 +0900`
<!-- COMMIT_STATUS END -->

# TODO

> 보존용 레거시 TODO입니다. 현재 작업 목록은 `docs/work/TODO.md`를 기준으로 관리합니다.

## 실천 시스템 구현

상담 처방전의 액션 아이템을 반복 실천하고 기록하는 시스템. 기존 관찰일지를 대체.

### 구현 항목

- [x] 처방전 JSON 구조 변경: `actionItem` (단수) → `actionItems` (배열, title/description/duration/encouragement)
- [x] 처방전 생성 프롬프트 업데이트 (액션 아이템 1~3개 + 기간 + 응원 메시지)
- [x] 실천 탭 UI (`/practices`)
- [x] 일일 실천 체크 + 한줄 메모
- [x] 기간 완료 시 종합 회고
- [x] 실천 데이터 → 다음 상담 LLM 컨텍스트 주입
- [x] 홈 카드: 진행 중인 실천 넛지
- [x] 실천 탭 다음 상담용 기록 요약 패널
- [x] 실천 리마인더 설정 + Flutter 앱 로컬 알림 예약
- [x] DB 스키마: `practice_items`, `practice_logs`, `practice_reviews` 테이블 설계 (`docs/operations/migrations/006_consultation_sessions_practices.sql`)

### 열린 질문

- 현재 없음

## 수익화 구조 변경 시 스토어 정보 동기화

구독 중심 구조를 단품 유료 리포트, 상담 1회권, 체험권 등으로 변경하거나 가격/혜택 문구를 바꾸는 경우 스토어 등록정보도 함께 갱신해야 한다.

### 체크 항목

- [ ] `docs/product/policies/payment.md`의 가격, 티어, 환불, 구독 라이프사이클 정책 업데이트
- [ ] `docs/STORE_LISTING.md`의 Google Play / App Store 소개 문구 업데이트
- [ ] `gijilai_app/fastlane/Fastfile`의 메타데이터 생성 템플릿 업데이트
- [ ] `gijilai_app/fastlane/metadata/android/*/full_description.txt` 업데이트
- [ ] `gijilai_app/fastlane/metadata/ios/*/description.txt` 업데이트
- [ ] 앱 내 `/pricing`, `/settings/subscription`, 환불/해지 안내 문구와 스토어 문구가 서로 충돌하지 않는지 확인
- [ ] `docs/go-to-market/REVENUE_TRUST_CONVERSION_DESIGN.md`의 상품 구조와 실험 조건 업데이트
