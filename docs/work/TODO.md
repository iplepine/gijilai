# TODO

마지막 갱신일: 2026-06-10

## 지금 닫아야 할 것

- [ ] **운영 DB 마이그레이션 적용** — 실측 결과 문서와 달리 018/019는 이미 적용, 대신 **011~016·021이 미적용**이라 실천 AI 피드백·알림 설정·사용 텔레메트리가 운영에서 깨져 있다. 신규 022(공유 토큰)·023(LLM 쿼터)·024(구독 unique)까지 011→024 순서로 전부 실행(전 파일 재실행 안전). 절차·검증 쿼리: `docs/operations/migrations/APPLY_2026-06-10.md`. **022는 웹 배포 전에 적용해야 공유가 안 깨진다.**
- [ ] 마이그레이션 적용 후 실기기 확인: 실천 AI 피드백(013/014), 알림 설정(012), GJ-009 co-parent 초대, GJ-010/011 self-parent 흐름, 공유 새 링크(생년월일 미노출), 구매 복원 버튼.
- [ ] `GJ-011-self-parent-practice-loop`: 코드 완료, 실기기 확인 남음 (DB는 019/020 적용 상태 — 020만 재확인).
- [ ] `GJ-010-self-parent-reflection-thinslice`: 코드 완료, 실기기 확인 남음. 정책: `docs/product/policies/self-parent.md`.
- [ ] `GJ-009-coparent-invite-thin-slice`: 코드 완료, 실기기 확인 남음 (018 적용 확인됨). 정책: `docs/product/policies/co-parent.md`.
- [ ] `GJ-007-manual-followup-test`: 상담 후 단발 후속 루프를 유료 사용자 ~10명에게 사람이 직접 발송해 검증. **전제 미충족 주의 — 기준선 측정 결과 실결제 사용자 0명** (`docs/work/BASELINE_METRICS.md`). 유입 확보가 선행되어야 한다. 기획: `docs/product/EPISODIC_FOLLOWUP_RETENTION.md`.
- [ ] `GJ-006-practice-loop-usability-qa`: 모바일 WebView 회귀 확인 (실천 AI 피드백이 마이그레이션 미적용으로 깨져 있었으므로, 적용 후 다시).
- [ ] `GJ-005-report-trust-baseline-qa`: 배포 환경 GA4 이벤트 수집 확인 + `docs/work/BASELINE_METRICS.md`에 GA4 퍼널 수치 기입.
- [x] 첫 주 기준선 기록 — DB 기반 1차 수집 완료: `docs/work/BASELINE_METRICS.md` (수집 스크립트 `app/scripts/collect-baseline-metrics.cjs`). GA4 수치만 남음(GJ-005와 함께).
- [ ] 앱 v1.0.10 릴리스: IAP 복구 개편(콜드 스타트 restore, 재시도, 구매 복원 버튼) 포함 빌드를 스토어에 올린다. Crashlytics 심볼 업로드 활성화됨.

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
