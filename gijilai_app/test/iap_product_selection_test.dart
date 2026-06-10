import 'package:flutter_test/flutter_test.dart';
import 'package:gijilai_app/iap/iap_product_selection.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/billing_client_wrappers.dart';

ProductDetails _product(String id) => ProductDetails(
      id: id,
      title: 'title-$id',
      description: 'desc-$id',
      price: '₩12,000',
      rawPrice: 12000,
      currencyCode: 'KRW',
    );

PricingPhaseWrapper _phase({
  required int priceAmountMicros,
  required int billingCycleCount,
  String formattedPrice = '₩12,000',
}) =>
    PricingPhaseWrapper(
      billingCycleCount: billingCycleCount,
      billingPeriod: 'P1M',
      formattedPrice: formattedPrice,
      priceAmountMicros: priceAmountMicros,
      priceCurrencyCode: 'KRW',
      recurrenceMode: RecurrenceMode.infiniteRecurring,
    );

SubscriptionOfferDetailsWrapper _offer({
  String? offerId,
  required List<PricingPhaseWrapper> phases,
}) =>
    SubscriptionOfferDetailsWrapper(
      basePlanId: 'monthly',
      offerId: offerId,
      offerTags: const <String>[],
      offerIdToken: 'token',
      pricingPhases: phases,
    );

void main() {
  group('selectSubscriptionProduct', () {
    test('returns the first product on non-Android platforms', () {
      final products = [_product('a'), _product('b')];
      expect(
        selectSubscriptionProduct(products, isAndroid: false).id,
        'a',
      );
    });

    test('falls back to the first product when no Google products exist', () {
      final products = [_product('a'), _product('b')];
      expect(
        selectSubscriptionProduct(products, isAndroid: true).id,
        'a',
      );
    });
  });

  group('isAndroidIntroDiscountOffer', () {
    test('detects a single-cycle discounted first phase', () {
      final offer = _offer(
        offerId: 'first-month-discount',
        phases: [
          _phase(priceAmountMicros: 1_000_000_000, billingCycleCount: 1),
          _phase(priceAmountMicros: 12_000_000_000, billingCycleCount: 0),
        ],
      );
      expect(isAndroidIntroDiscountOffer(offer), isTrue);
    });

    test('rejects base offers without offerId', () {
      final offer = _offer(
        offerId: null,
        phases: [
          _phase(priceAmountMicros: 1_000_000_000, billingCycleCount: 1),
          _phase(priceAmountMicros: 12_000_000_000, billingCycleCount: 0),
        ],
      );
      expect(isAndroidIntroDiscountOffer(offer), isFalse);
    });

    test('rejects free-trial (zero price) first phases', () {
      final offer = _offer(
        offerId: 'free-trial',
        phases: [
          _phase(priceAmountMicros: 0, billingCycleCount: 1),
          _phase(priceAmountMicros: 12_000_000_000, billingCycleCount: 0),
        ],
      );
      expect(isAndroidIntroDiscountOffer(offer), isFalse);
    });

    test('rejects single-phase offers', () {
      final offer = _offer(
        offerId: 'single',
        phases: [
          _phase(priceAmountMicros: 12_000_000_000, billingCycleCount: 0),
        ],
      );
      expect(isAndroidIntroDiscountOffer(offer), isFalse);
    });
  });

  group('androidPricingPhaseSummary', () {
    test('joins phases in order', () {
      final summary = androidPricingPhaseSummary([
        _phase(
          priceAmountMicros: 1_000_000_000,
          billingCycleCount: 1,
          formattedPrice: '₩1,000',
        ),
        _phase(priceAmountMicros: 12_000_000_000, billingCycleCount: 0),
      ]);
      expect(summary, '₩1,000/P1Mx1 -> ₩12,000/P1Mx0');
    });
  });
}
