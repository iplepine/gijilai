# Task

ID: `GJ-001-consult-input-validation`

유형: `Build`

상태: `Active`

연결 Roadmap: `R-001-consult-report-conversion`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-03

## 목표

상담 질문 입력 검증을 명확하게 만들어 빈 입력, 너무 짧은 입력, 부적절한 입력이 상담 품질을 떨어뜨리지 않게 한다.

## 배경

현재 변경 파일에 상담 입력 검증 코드와 상담 정책 문서가 포함되어 있다. 이 작업은 상담 품질과 신뢰를 지키는 전환 전 단계다.

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

- [ ] 상담 입력 검증 성공/실패 케이스 테스트 통과
- [ ] 상담 페이지가 실패 사유를 자연스럽게 안내
- [ ] 테스트 또는 검증 완료
- [ ] 관련 문서 업데이트
- [ ] 남은 리스크 기록

## 작업 계획

1. 현재 `consultInputValidation` 구현과 테스트를 확인한다.
2. 상담 페이지와 API route의 실패 처리를 맞춘다.
3. 정책/유즈케이스 문서를 최신 동작과 맞춘다.

## 검증 계획

명령:

- `npm test -- consultInputValidation`
- 프로젝트 표준 웹 검증 명령

수동 확인:

- 빈 입력
- 짧은 입력
- 정상 입력

## 문서 업데이트 대상

- `docs/product/USE_CASES.md`
- `docs/product/policies/consultation.md`
- `docs/product/policies/home.md`

## 사용자 확인

필요 여부: `no`

확인할 질문:

결정: 기존 상담 품질 개선 범위 안의 구현으로 진행한다.

## 결과

완료 내용:

검증 결과:

남은 리스크:

후속 task:
