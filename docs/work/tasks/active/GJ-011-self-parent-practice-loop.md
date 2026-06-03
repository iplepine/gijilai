# Task

ID: `GJ-011-self-parent-practice-loop`

유형: `Build`

상태: `Active`

연결 Roadmap: `R-004-self-parent-care`

연결 Goal: `G-001-paid-conversion-trust`

마지막 갱신일: 2026-06-03

## 목표

양육자 자신을 위한 상담(self-parent)을 일회성 처방에서 **돌볼 수 있는 루프**로 확장한다(Phase 2). self-care action을 실천으로 저장하고, 다시 볼 수 있는 "내 마음 기록" 화면과 평가 아닌 안부 톤의 "이번 주 어떠셨어요?" 후속, 홈 "오늘의 나" 카드를 만든다. Phase 1의 남은 리스크(기록이 저장만 되고 볼 곳이 없음)를 닫는다.

## 배경

Phase 1(GJ-010)은 입력→2질문→처방 + 위기 가드레일까지 구현했지만, 처방을 받은 뒤 그 마음을 다시 볼 화면이 없었고 실천 루프도 없었다. self-parent의 가치는 일회성 위로가 아니라 "기록이 쌓이고 며칠 뒤 돌아보는" episodic 루프에 있다. 정책: `docs/product/policies/self-parent.md`.

## 범위

포함:
- self 결과 화면 "마음에 담기" → `practice_items`(type='SELF_PARENT') 저장 후 내 마음 기록으로
- `/consult/self/records` "내 마음 기록" 화면: 진행 중 자기 돌봄 + 지난 마음 기록 목록
- "이번 주 어떠셨어요?" 부드러운 후속(도움됐어요/잘모르겠어요/못했지만괜찮아요 + 선택 메모) → 1회 마무리(데일리 강요 X)
- 홈 "오늘의 나" 카드 — 진행 중 자기 돌봄 있으면 노출, 없으면 self-hide
- db 헬퍼: getActiveSelfParentPractices, getSelfParentConsultations
- i18n(ko/en), 측정 이벤트

제외:
- 데일리 체크인·연속 streak (의도적으로 안 함 — 숙제화 방지)
- Phase 3 cross-context (자기 상태→아이 상담 톤)
- Phase 4 co-parent 공유

## 완료 기준

- [x] db 헬퍼 2개
- [x] 결과 화면 action 실천 저장
- [x] /consult/self/records 화면 (진행 중 + 이력)
- [x] 이번 주 후속 체크인 (3선택 + 메모 → COMPLETED + 회고 저장)
- [x] 홈 "오늘의 나" 카드 (self-hide)
- [x] i18n ko/en
- [x] 측정 이벤트
- [x] lint/build/test 통과
- [ ] 마이그레이션 019/020 운영 DB 적용
- [ ] 실기기 흐름 확인 (저장→기록→체크인→완료, 홈 카드 노출)
- [ ] 남은 리스크 기록

## 검증 계획

명령:
- `cd app && npm run lint`
- `cd app && npm run build`
- `cd app && npm test -- --runInBand`

수동 확인:
- self 상담 → "마음에 담기" → 내 마음 기록에 진행 중 자기 돌봄 노출
- "이번 주 어떠셨어요?" → 선택+메모 → 마무리 + 지난 마음으로 이동
- 진행 중 자기 돌봄 있으면 홈 "오늘의 나" 카드 노출, 완료 후 사라짐
- self-parent 실천이 아이 실천 목록/활성 카운트에 섞이지 않음 (type 분리)

## 문서 업데이트 대상

- `docs/product/policies/self-parent.md` (Phase 2 흐름 반영)
- `SPEC.md` §8-3 (실천 루프 추가)
- `docs/work/roadmaps/active/R-004-self-parent-care.md` (완료)
- `docs/work/README.md`, `docs/work/TODO.md`

## 결과

완료 내용:
- db: `getActiveSelfParentPractices`, `getSelfParentConsultations`.
- `/consult/self` 결과 "마음에 담기" → SELF_PARENT practice 저장.
- `/consult/self/records` 화면(진행 중 자기 돌봄 + 이번 주 후속 체크인 + 지난 마음 목록).
- `components/home/SelfCareHomeCard` — 홈 "오늘의 나" (self-hide).
- i18n ko/en + 이벤트(self_parent_practice_saved, _checkin_opened/_done, _home_card_click).

검증 결과:
- lint 0, build 통과, test 19 suites / 117 tests.

남은 리스크:
- 후속 체크인은 1회 마무리(COMPLETED) 모델 — 반복 루프는 아직 없음(의도). 장기 self-care 추적은 Phase 3+에서.
- self practice는 도구 코드(tool)를 practice_items에 저장하지 않아 기록 화면에서 도구 라벨을 표시하지 않음. 필요 시 별도 컬럼/메타로 보강.
- 홈 카드는 진행 중 항목이 있을 때만 노출(빈 상태 적극 유도 X) — 발견성은 아이 상담 결과 CTA에 의존.
- 마이그레이션 019/020 미적용 시 type 컬럼 부재로 런타임 오류 → 배포 전 적용 필수.

후속 task:
- 운영 적용 + 실기기 확인
- Phase 3 cross-context
