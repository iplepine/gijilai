# TODO

마지막 갱신일: 2026-06-03

## 지금 닫아야 할 것

- [ ] 운영 DB에 마이그레이션 018(co-parent)·019(self-parent type)·020(self-parent 프라이버시 RLS) **순서대로** 적용 + 적용 후 실기기 흐름 확인. (019 → 020 순서 중요: type 컬럼이 있어야 020 동작)
- [ ] `GJ-011-self-parent-practice-loop`: self-parent Phase 2(action 실천 저장 + 내 마음 기록 + 이번 주 후속 + 홈 카드). 코드 완료, 마이그레이션 적용·실기기 확인 남음.
- [ ] `GJ-010-self-parent-reflection-thinslice`: 양육자 자신을 위한 상담 Phase 1(입력→2질문→처방 + 위기 가드레일). 코드 완료, 마이그레이션 적용·실기기 확인 남음. 정책: `docs/product/policies/self-parent.md`.
- [ ] `GJ-009-coparent-invite-thin-slice`: 공동양육자 비대칭 초대(Option C) thin-slice. 코드 완료, 마이그레이션 018 적용·실기기 확인 남음. 정책: `docs/product/policies/co-parent.md`.
- [ ] `GJ-007-manual-followup-test`: 상담 후 단발 후속 루프(상담→실천→며칠 뒤 1회 후속→성공 저금/재상담)를 유료 사용자 ~10명에게 사람이 직접 발송해 검증한다. 후속 응답률·"해봤다"율·재상담 복귀로 episodic 가설을 판정한다. 기획: `docs/product/EPISODIC_FOLLOWUP_RETENTION.md`.
- [ ] `GJ-006-practice-loop-usability-qa`: 실천 마무리 선택 입력, 홈 대표 실천 `+N개 더`, 다자녀 실천 태그, 상담 아이 이름 강조, 음성 입력 첫 탭 동작을 모바일 WebView에서 한 번에 회귀 확인한다.
- [ ] `GJ-005-report-trust-baseline-qa`: 배포 환경에서 `report_viewed`, `pricing_viewed`, `payment_started`, `payment_completed` 이벤트가 문서 기준대로 수집되는지 확인한다.
- [ ] 첫 주 기준선 기록 위치를 확정하고 리포트 전환/가격 진입/결제 시작 수치를 기록한다.

## 다음 작업 후보

- [ ] `GJ-008-coparent-retention-test` (Ready, 관계형 주 베팅): GJ-009 thin-slice 완료 후 시작. 같은 아이에 두 번째 양육자를 초대하면 리텐션이 오르는지 "연결 아이 vs 솔로 아이" 비교로 검증한다. nodtry 부부 사용에서 관찰된 관계형 리텐션을 gijilai로 이식하는 가설. 기획: `docs/product/COPARENT_RELATIONAL_RETENTION.md`.
- [ ] 홈 대표 실천 카드에서 `DUE_FOR_REVIEW`, `STALE`, `NEEDS_RECONNECT` 상태별 문구가 실천 탭의 다음 행동과 충돌하지 않는지 실제 데이터로 점검한다.
- [ ] 다자녀 사용자가 홈, 실천, 상담, 기록 탭을 오갈 때 선택 아이와 아이 이름 태그가 일관되는지 QA 시나리오를 문서화한다.
- [ ] 실천 회고가 비어 있는 경우 다음 상담 프롬프트와 상담 상세 화면에서 어색한 빈 문구가 없는지 확인한다.
- [ ] 상담/실천 자유 텍스트 입력에서 음성 버튼 첫 탭이 키보드 포커스 없이 바로 음성 입력을 시작하는지 실제 기기로 확인한다.
- [ ] Android/iOS WebView에서 하단 탭 safe area, 중앙 상담 FAB, 기록 탭 아이콘 잘림 여부를 스크린샷으로 재확인한다.

## 운영 후속

- [ ] Google Play production/internal 최신 빌드에서 WebView 홈/실천 플로우 smoke 확인
- [ ] Vercel production 배포 후 홈/실천/상담 주요 라우트 smoke 확인
- [ ] 이벤트에 아이 이름, 상담 원문, 메모 원문 같은 개인식별 가능 정보가 포함되지 않는지 샘플 점검

## 최근 완료

- [x] 하단 탭 기록 아이콘 우측 잘림 수정
- [x] 다자녀 실천 목록에서 아이 이름 태그 표시
- [x] 상담 인사 문구의 아이 이름을 다자녀 상황에서 구분되게 강조
- [x] 홈 화면 스크롤 reveal 애니메이션 제거
- [x] `실천 정리하기` 계열 문구를 `실천 마무리하기`로 정리
- [x] 홈 대표 실천 카드가 2개만 미리 보일 때 남은 개수를 `+N개 더`로 표시
- [x] 실천 마무리 회고 내용을 선택 입력으로 변경
