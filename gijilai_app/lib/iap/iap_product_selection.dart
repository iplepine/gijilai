import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/billing_client_wrappers.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

/// 구독 상품/오퍼 선택 로직 — main.dart에서 분리해 단위 테스트가 가능하게 유지한다.
///
/// Android는 같은 상품이 base plan/offer 조합별로 여러 ProductDetails로 내려오므로
/// 첫 달 할인(intro discount) 오퍼가 있으면 우선 선택하고, 없으면 기본 오퍼를 쓴다.
ProductDetails selectSubscriptionProduct(
  List<ProductDetails> products, {
  bool? isAndroid,
}) {
  final android = isAndroid ?? Platform.isAndroid;
  if (!android) return products.first;

  final googleProducts = products
      .whereType<GooglePlayProductDetails>()
      .toList(growable: false);
  if (googleProducts.isEmpty) return products.first;

  GooglePlayProductDetails? regularProduct;
  GooglePlayProductDetails? discountedProduct;

  for (final product in googleProducts) {
    final offer = androidSubscriptionOffer(product);
    if (offer == null) continue;

    debugPrint(
      'IAP Android offer candidate: '
      'basePlanId=${offer.basePlanId}, '
      'offerId=${offer.offerId ?? "none"}, '
      'tags=${offer.offerTags.join(",")}, '
      'phases=${androidPricingPhaseSummary(offer.pricingPhases)}, '
      'token=${product.offerToken}',
    );

    if (isAndroidIntroDiscountOffer(offer)) {
      discountedProduct ??= product;
    } else if (offer.offerId == null) {
      regularProduct ??= product;
    }
  }

  final selected = discountedProduct ?? regularProduct ?? googleProducts.first;
  final selectedOffer = androidSubscriptionOffer(selected);
  debugPrint(
    'IAP Android selected offer: '
    'basePlanId=${selectedOffer?.basePlanId ?? "unknown"}, '
    'offerId=${selectedOffer?.offerId ?? "none"}, '
    'price=${selected.price}',
  );
  return selected;
}

SubscriptionOfferDetailsWrapper? androidSubscriptionOffer(
  GooglePlayProductDetails product,
) {
  final index = product.subscriptionIndex;
  final offers = product.productDetails.subscriptionOfferDetails;
  if (index == null || offers == null || index >= offers.length) return null;
  return offers[index];
}

bool isAndroidIntroDiscountOffer(SubscriptionOfferDetailsWrapper offer) {
  if (offer.offerId == null || offer.pricingPhases.length < 2) return false;

  final firstPhase = offer.pricingPhases.first;
  final recurringPrice = offer.pricingPhases
      .skip(1)
      .map((phase) => phase.priceAmountMicros)
      .reduce(max);

  return firstPhase.billingCycleCount == 1 &&
      firstPhase.priceAmountMicros > 0 &&
      firstPhase.priceAmountMicros < recurringPrice;
}

String androidPricingPhaseSummary(List<PricingPhaseWrapper> phases) {
  return phases
      .map(
        (phase) =>
            '${phase.formattedPrice}/${phase.billingPeriod}'
            'x${phase.billingCycleCount}',
      )
      .join(' -> ');
}
