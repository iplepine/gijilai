# TODO

## 실천 시스템 구현

상담 처방전의 액션 아이템을 반복 실천하고 기록하는 시스템. 기존 관찰일지를 대체.

### 구현 항목

- 처방전 JSON 구조 변경: `actionItem` (단수) → `actionItems` (배열, title/description/duration/encouragement)
- 처방전 생성 프롬프트 업데이트 (액션 아이템 1~3개 + 기간 + 응원 메시지)
- [x] 실천 탭 UI (`/practices`)
- [x] 일일 실천 체크 + 한줄 메모
- [x] 기간 완료 시 종합 회고
- [x] 실천 데이터 → 다음 상담 LLM 컨텍스트 주입
- [x] 홈 카드: 진행 중인 실천 넛지
- [x] 실천 탭 다음 상담용 기록 요약 패널
- [x] 실천 리마인더 설정 + Flutter 앱 로컬 알림 예약
- DB 스키마: practices 테이블 설계 (observations 테이블 대체)

### 열린 질문

- 리마인더 알림 문구를 아이/실천 항목별로 개인화할지
