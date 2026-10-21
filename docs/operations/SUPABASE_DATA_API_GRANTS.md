<!-- COMMIT_STATUS START -->
> **커밋 상태**
> - 기준 커밋: `9580053b56be8f72b654d8a98306c7d9c6d72cec` (`feat/luna-model`)
> - 최근 커밋: `9580053b56be` release(android): v1.0.12+38 to Play internal + production
> - 커밋 일시: `2026-10-18T17:22:44+09:00`
> - 워킹트리: `dirty (19 files)`
> - 문서 갱신: `2026-10-20 20:15:42 +0900`
<!-- COMMIT_STATUS END -->

# Supabase Data API 명시적 권한 대응

점검일: 2026-10-20 · 담당: 장영실 / 기술실장 · Project Lead: 기질아이

## 배경과 범위

[Supabase 공식 공지](https://github.com/orgs/supabase/discussions/45329)에 따라 2026-10-30부터 기존 프로젝트에서도 새 `public` 테이블의 자동 Data API 권한이 중단된다. 기존 테이블의 권한은 유지된다. 서비스 키의 RLS 우회도 테이블 GRANT를 대체하지 않는다.

요청 범위는 현재 접근 정책을 유지하는 호환성 수정이다. 운영 DB 권한 변경, RLS 정책 변경, 배포, 커밋·푸시는 수행하지 않았다. 기존 테이블은 이번 공지를 이유로 재생성하거나 전체 권한을 부여할 필요가 없다.

## 구현

- 저장소의 21개 `CREATE TABLE` 정의가 있는 11개 마이그레이션에 `service_role`의 SELECT/INSERT/UPDATE/DELETE를 명시했다.
- `authenticated`는 기존 RLS 정책에 대응하는 연산만 명시했다. `reports` DELETE는 해당 정책이 생기는 005에서 부여한다.
- `llm_usage_events`는 서버 역할만 허용한다. `notifications`에는 사용자 INSERT를 부여하지 않는다.
- `device_tokens`의 사용자 CRUD는 기존 RLS 허용 범위를 보존한 것이다. 현재 API 호출은 서버 역할을 사용한다.
- `anon` 권한은 추가하지 않는다. 추천코드는 로그인 후 처리하고 공유 리포트는 서버에서 조회한다.
- 현재 21개 정의는 UUID 키를 사용하므로 시퀀스 권한 추가는 필요 없다.
- AGENTS.md에 이후 테이블 생성 규칙과 검사 명령을 추가했다.

과거 마이그레이션을 편집한 이유는 신규 환경의 스키마 구성에도 같은 권한이 적용되어야 하기 때문이다. 이미 실행한 환경에서는 파일 수정이 자동으로 다시 적용되지 않는다. 기존 테이블은 기존 권한을 유지하므로 이를 위해 과거 마이그레이션 전체를 운영에서 재실행하지 않는다.

## 검증 결과

- `cd app && npm run check:db-grants`: 검사기 회귀 테스트 6개 및 21개 테이블 정의 통과.
- PostgreSQL 17의 일회용 로컬 DB: 실제 GRANT 문을 최소 테이블 fixture에 두 번 적용해 재실행 가능성을 확인. 21개 테이블 × 3개 역할 × 4개 연산 = 252개 권한 조합 검증 통과. 익명 접근 거부, 사용자 역할의 서버 전용 테이블 접근 거부, 합성 소유자 RLS의 타인 행 조회/삽입 차단, 서버 역할 접근을 확인했다. 전체 스키마/실제 RLS 정책 재현 테스트는 아니다.
- `app/.env.local`에 설정된 Supabase 프로젝트: 22개 테이블에 `service_role`로 `select('id', {head:true}).limit(0)`를 실행해 모두 HTTP 200/204, 오류 없음. 고객 행을 가져오거나 변경하지 않았다. 이 결과는 서버 SELECT 접근만 확인하며 사용자 JWT 쓰기 흐름·RLS·배포 환경과 동일한 프로젝트인지까지 증명하지 않는다.
- 독립 코드 검토: 테이블별 연산과 기존 RLS 정책 일치 확인.

정적 검사는 저장소의 따옴표 없는 테이블명·명시적 public GRANT 문법에 맞춘 누락 검사다. 과도한 권한, RLS 의미, 동적/임의 SQL 전체를 분석하는 보안 검사기는 아니다. SQL 수정이므로 앱 화면 빌드는 생략했다.

## 운영 확인 및 이후 테이블 생성

1. 배포 환경과 동일한 Supabase 프로젝트를 선택한다.
2. [읽기 전용 감사 SQL](migrations/AUDIT_DATA_API_GRANTS.sql)을 SQL Editor에서 실행하고 Data API 설정의 노출 상태와 대조한다. 실제 역할별 권한과 RLS를 확인한다.
3. 새 테이블 생성 시 같은 마이그레이션에 필요한 역할별 GRANT, RLS 활성화, 정책을 함께 작성한다. 시퀀스가 있다면 필요한 역할의 USAGE도 검토한다.
4. `npm run check:db-grants` 후 격리된 환경에서 SQL 실행 및 실제 사용자 JWT로 본인/타인 접근을 확인한다.
5. 기존에 만들어진 테이블에 42501 오류가 있다면 오류의 역할·연산을 확인하고 해당 테이블에만 좁게 보완한다. 일괄 GRANT나 자동 기본 권한 복구는 사용하지 않는다.

## 별도 발견 사항과 한계

- `observations`는 실제 프로젝트에 있고 앱/008·016·018에서 참조하지만 최초 CREATE TABLE 및 소유자 RLS 정의가 저장소에 없다. 전체 DB 재생성을 보장하려면 실제 스키마를 별도로 추출·검토해 정본으로 복구해야 한다. 임의의 테이블 구조를 만들어 추가하지 않았다.
- 추천코드 타인 조회 RLS, 쿠폰 INSERT의 `WITH CHECK(TRUE)`, reports UPDATE 및 surveys/consultations DELETE 호출과 정책 불일치는 기존 별개 문제다. 이번 권한 추가에서 이를 확대하거나 변경하지 않았다.
- 다른 로컬 프로젝트 점검: 사주라이프는 Supabase Auth + Redis, ORPG는 Sequelize 직접 PostgreSQL, fridge는 SQLite/Firebase를 사용한다. 현재 코드상 이번 Data API 테이블 권한 변경 대응 대상은 기질아이다. 로컬에 없는 프로젝트는 점검 범위 밖이다.

작업 연결: G-001-paid-conversion-trust / R-001-consult-report-conversion의 운영 안정성 후속. 완료 범위는 저장소 호환성 수정과 위 검증까지이며 원격 배포 완료를 뜻하지 않는다.
