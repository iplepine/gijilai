/// IAP 서버 검증의 일시 실패(네트워크 단절/5xx/타임아웃) 재시도 정책.
///
/// 영수증 원본은 스토어가 보관한다 — 미완료(uncompleted/unacknowledged) 거래는
/// iOS는 다음 실행 시 purchaseStream으로 자동 재전달되고, Android는 콜드 스타트
/// restorePurchases()로 되살린다. 따라서 세션 안에서는 지수 백오프로 재시도하고,
/// 한도를 넘으면 다음 실행의 스토어 재전달에 맡긴다.
class IapRetryPolicy {
  static const int maxAttempts = 5;

  /// attempt(1부터 시작) 차수의 재시도 대기 시간: 10s → 20s → 40s → 80s → 120s(cap)
  static Duration backoff(int attempt) {
    final exponent = attempt.clamp(1, 6);
    final seconds = 5 * (1 << exponent);
    return Duration(seconds: seconds > 120 ? 120 : seconds);
  }

  static bool shouldRetry(int attempt) => attempt < maxAttempts;
}
