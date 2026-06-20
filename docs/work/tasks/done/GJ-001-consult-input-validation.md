<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `42ed4d5e3c01012a9599c8ac423810d3beb99831` (`claude/enable-phased-assessment`)
> - 최근 커밋: `42ed4d5e3c01` 차수화 신뢰도 캘리브레이션 인프라 + 미캘리 신뢰도 노출 게이트
> - 커밋 일시: `2026-06-17T08:17:20+09:00`
> - 워킹트리: `dirty (72 files)`
> - 문서 갱신: `2026-06-20 22:33:14 +0900`
<!-- COMMIT_STATUS END -->

# Task

ID: `GJ-001-consult-input-validation`

유형: `Build`

상태: `Done`

연결 Roadmap: `R-001-consult-report-conversion`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-04

## 목표

상담 질문 입력 검증을 명확하게 만들어 빈 입력, 너무 짧은 입력, 부적절한 입력이 상담 품질을 떨어뜨리지 않게 한다.

## 배경

이 작업은 상담 품질과 신뢰를 지키는 전환 전 단계다.

## 범위

포함:

- 상담 입력 검증 로직
- 검증 테스트
- 상담 페이지 안내 문구
- 관련 정책/유즈케이스 문서 업데이트

제외:

- 결제 플로우 변경
- 상담 모델 교체
- 리포트 구조 개편

## 완료 기준

- [x] 상담 입력 검증 성공/실패 케이스 테스트 통과
- [x] 상담 페이지가 실패 사유를 자연스럽게 안내
- [x] 테스트 또는 검증 완료
- [x] 관련 문서 업데이트
- [x] 남은 리스크 기록

## 결과

완료 내용:

- `consultInputValidation`의 빈 입력, 짧은 입력, 명백한 무의미 입력, 정상 입력 테스트를 표준 `npm test` 명령으로 실행할 수 있게 했다.
- 상담 시작 CTA를 로딩 중이 아닐 때 클릭 가능하게 맞춰, 빈 입력/짧은 입력도 `handleStartDiagnostic` 검증 후 입력창 아래 안내를 받게 했다.
- ESLint flat config에서 `react-hooks` 플러그인과 CJS 평가 스크립트 override를 명시해 표준 lint 검증을 복구했다.
- 상담 입력 검증 정책, 유즈케이스, 홈 상담 진입 정책 문서를 최신 동작과 맞췄다.

검증 결과:

- `npm test -- consultInputValidation --runInBand` 통과: 31 tests
- `npm run lint` 통과
- `npm run build` 통과
- Playwright smoke: `http://localhost:3000/consult` 비로그인 접근 시 `/login?redirect=%2Fconsult`로 이동, Next error overlay 없음, console error 없음

남은 리스크:

- 인증된 사용자 세션에서 CTA 클릭 후 빈 입력/짧은 입력/무의미 입력 메시지를 실제 WebView로 확인하지는 못했다. 핵심 분기 로직은 unit test와 코드 경로로 검증했다.
- `agent-browser` CLI가 현재 PATH에 없어 Playwright로 브라우저 smoke를 대체했다.

후속 task:

- 상담/리포트 문구 정리
- 리포트 CTA 이벤트 점검
