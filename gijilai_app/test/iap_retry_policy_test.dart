import 'package:flutter_test/flutter_test.dart';
import 'package:gijilai_app/iap/iap_retry_policy.dart';

void main() {
  group('IapRetryPolicy', () {
    test('backoff grows exponentially and is capped at 120s', () {
      expect(IapRetryPolicy.backoff(1), const Duration(seconds: 10));
      expect(IapRetryPolicy.backoff(2), const Duration(seconds: 20));
      expect(IapRetryPolicy.backoff(3), const Duration(seconds: 40));
      expect(IapRetryPolicy.backoff(4), const Duration(seconds: 80));
      expect(IapRetryPolicy.backoff(5), const Duration(seconds: 120));
      expect(IapRetryPolicy.backoff(10), const Duration(seconds: 120));
    });

    test('shouldRetry stops at maxAttempts', () {
      expect(IapRetryPolicy.shouldRetry(1), isTrue);
      expect(IapRetryPolicy.shouldRetry(IapRetryPolicy.maxAttempts - 1), isTrue);
      expect(IapRetryPolicy.shouldRetry(IapRetryPolicy.maxAttempts), isFalse);
    });
  });
}
