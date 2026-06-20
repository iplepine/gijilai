<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `425ffe550f386bbd28c1035ed096ef4c513e3e51` (`claude/enable-phased-assessment`)
> - 최근 커밋: `425ffe550f38` docs: refresh project documentation status
> - 커밋 일시: `2026-06-20T22:38:59+09:00`
> - 워킹트리: `clean`
> - 문서 갱신: `2026-06-20 22:39:28 +0900`
<!-- COMMIT_STATUS END -->

# Task

ID: `GJ-010-self-parent-reflection-thinslice`

유형: `Build`

상태: `Active`

연결 Roadmap: `R-004-self-parent-care`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-05-31

## 목표

양육자 자신을 위한 상담(self-parent) Phase 1 one-shot reflection을 구현한다. 아이 상담 결과에서 진입해 입력→2질문→처방까지 가는 thin slice. 임상 경계 가드레일을 함께 박는다.

## 배경

ADR(2026-05-31)에서 self-parent 상담 도입과 캐치프라이즈 톤 약속, 임상 경계를 확정했다. 발달심리상 부모 자기 작업이 아이 발달의 베이스이므로 아이 행동만 다루는 상담은 절반짜리다. 정책: `docs/product/policies/self-parent.md`.

## 범위

포함:
- 마이그레이션 019: consultation_sessions/consultations/practice_items.type + self_reflection_safety_events
- 위기 가드레일 lib + unit test (자해/폭력/지속 디스트레스)
- self-parent 프롬프트 빌더(2질문 + 처방) + 처방 타입/파싱
- API: /api/consult/self/questions, /api/consult/self/prescription
- 화면: /consult/self (입력→2질문→결과 + 위기 안내 뷰)
- 아이 상담 결과 → self CTA
- 캐치프라이즈 노출 (pricing, 아이 상담 결과 footer, 양육자 탭 footer, self 결과)
- CHILD 흐름 분리 (기록·실천·활성 카운트 type='CHILD' 필터)
- 측정 이벤트

제외:
- Phase 2 실천 루프·후속 상담·홈 카드
- 어린 시절·트라우마 작업, 부부 상담
- 별도 "내 마음 기록" 이력 화면

## 완료 기준

- [x] 마이그레이션 019 작성
- [x] 위기 가드레일 + unit test 통과
- [x] 프롬프트 빌더 + 처방 타입
- [x] API 2개
- [x] /consult/self 화면 + 위기 안내 뷰
- [x] 아이 상담 결과 CTA
- [x] 캐치프라이즈 노출 (pricing/아이 결과/양육자 탭/self 결과)
- [x] CHILD 흐름 분리 (type 필터)
- [x] 측정 이벤트
- [x] lint/build/test 통과
- [ ] 마이그레이션 019 운영 DB 적용
- [ ] 실기기 흐름 확인 (입력→질문→처방, 위기 키워드 분기)
- [ ] 남은 리스크 기록

## 검증 계획

명령:
- `cd app && npm run lint`
- `cd app && npm run build`
- `cd app && npm test -- --runInBand`

수동 확인:
- 아이 상담 완료 후 self CTA 노출·진입
- 일반 입력 → 2질문 → 처방 정상
- 위기 키워드("사라지고 싶다" 등) 입력 → 전문기관 안내 분기
- self 상담이 아이 상담 기록/실천/활성 카운트에 섞이지 않는지

## 문서 업데이트 대상

- `docs/decisions/ADR.md` (완료)
- `docs/product/policies/self-parent.md` (완료)
- `docs/product/policies/index.md` (완료)
- `SPEC.md` §8-3 (완료)
- `docs/work/roadmaps/active/R-004-self-parent-care.md` (완료)
- `docs/work/README.md`, `docs/work/TODO.md`

## 결과

완료 내용:
- 마이그레이션 019(type 컬럼 + safety events), `lib/selfReflectionGuardrail.ts`(+test 8개), `lib/selfParentPrescription.ts`, `lib/selfParentPromptBuilders.ts`, API 2개, `/consult/self` 화면, 아이 상담 결과 CTA, 캐치프라이즈 4곳, CHILD 흐름 type 분리, 측정 이벤트 6개.
- supabase 타입에 type 컬럼 + safety events 테이블 반영.

검증 결과:
- lint 0, build 통과, test 18 suites + guardrail 8 tests 통과.

남은 리스크:
- 마이그레이션 019 미적용 환경에서는 type 컬럼 부재로 런타임 오류 → 배포 전 적용 필수.
- 위기 키워드는 키워드 기반 1차 안전망 — LLM 기반 분류는 미구현. false negative 가능. 운영 데이터로 튜닝 필요.
- self-parent 처방 품질(위로만 vs 작은 행동 연결)은 사람 리뷰 필요. evals 케이스 미작성.
- Phase 1은 기록만 저장하고 사용자가 다시 볼 화면이 없음 — Phase 2 "내 마음 기록" 전까지 self 상담 이력은 사용자에게 안 보임.

후속 task:
- 마이그레이션 적용 + 실기기 확인
- Phase 2 self practice loop
