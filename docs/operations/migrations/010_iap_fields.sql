-- 인앱결제(IAP) 지원을 위한 subscriptions 테이블 확장
-- Apple IAP / Google Play Billing 영수증 정보 저장

ALTER TABLE subscriptions
  ADD COLUMN source TEXT DEFAULT 'PORTONE'
    CHECK (source IN ('PORTONE', 'APPLE_IAP', 'GOOGLE_PLAY')),
  ADD COLUMN app_transaction_id TEXT,
  ADD COLUMN app_original_transaction_id TEXT;

COMMENT ON COLUMN subscriptions.source IS '결제 출처: PORTONE(웹), APPLE_IAP(iOS), GOOGLE_PLAY(Android)';
COMMENT ON COLUMN subscriptions.app_transaction_id IS '앱스토어 트랜잭션 ID (Apple transactionId / Google purchaseToken)';
COMMENT ON COLUMN subscriptions.app_original_transaction_id IS '최초 구독 트랜잭션 ID (갱신 추적용)';
