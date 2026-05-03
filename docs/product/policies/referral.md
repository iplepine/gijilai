# 추천 및 쿠폰 정책

## 추천 코드

- 형식: `GIJILAI-{사용자ID 앞 8자리 대문자}`
- `referrals` 테이블에 저장, 최초 조회 시 자동 생성
- 자기 자신 추천 불가

## 추천 플로우

1. 공유 URL에 `?ref=CODE` 파라미터 포함 (`/share` 페이지에서 생성)
2. `ReferralHandler` 컴포넌트가 URL의 `ref` 값을 `sessionStorage`에 저장
3. 로그인 후 `db.applyReferralCode()`로 자동 적용 (세션당 1회)
4. 매칭 성공 시 referral 상태를 `COMPLETED`로 변경, 양쪽에 쿠폰 발급

## 공유 버튼 노출

- 카카오톡 공유와 링크 복사는 모든 환경에서 노출한다.
- `다른 앱` 공유는 모바일 브라우저 또는 기질아이 앱 WebView에서만 노출한다.
- 앱 WebView에서는 `ShareBridge` JavaScript channel로 Flutter에 공유 요청을 전달하고, Flutter가 OS 공유 시트를 연다.
- 모바일 브라우저에서는 `navigator.share`가 지원될 때 Web Share API를 사용한다.

## 쿠폰

- 할인 금액: 1,980원 (월 구독료와 동일 → 실질적 구독 첫 달 무료)
- 유효기간: 발급일로부터 30일
- 결제 페이지에서 쿠폰 적용 시 `finalAmount = max(0, 1980 - discount_amount)`
- 금액이 0원이면 "쿠폰으로 무료 이용하기" 버튼 표시

## 관련 코드

- `app/src/lib/db.ts` — `getReferralCode`, `applyReferralCode`, `getAvailableCoupons`, `useCoupon`
- `app/src/components/layout/ReferralHandler.tsx` — URL 파라미터 감지 및 자동 적용
- `app/src/app/share/page.tsx` — 공유 URL 생성 (카카오, 링크 복사, 네이티브 공유)
- `app/src/app/payment/page.tsx` — 쿠폰 적용 및 결제 금액 계산
- 별도 referral API 라우트 없음 (클라이언트에서 Supabase 직접 호출)
