import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() {
  runApp(const GijilaiApp());
}

class GijilaiApp extends StatelessWidget {
  const GijilaiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '기질아이',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2F4F3E)),
        useMaterial3: true,
      ),
      home: const MainWebView(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class MainWebView extends StatefulWidget {
  const MainWebView({super.key});

  @override
  State<MainWebView> createState() => _MainWebViewState();
}

class _MainWebViewState extends State<MainWebView> {
  static const _targetUrl = 'https://gijilai.com/';
  static const _subscriptionProductId = 'monthly_premium';

  late final WebViewController _controller;
  late final StreamSubscription<List<PurchaseDetails>> _purchaseSubscription;
  final InAppPurchase _iap = InAppPurchase.instance;

  @override
  void initState() {
    super.initState();
    _initIAP();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setUserAgent('gijilai_app')
      ..setNavigationDelegate(
        NavigationDelegate(
          onWebResourceError: (WebResourceError error) {
            debugPrint('WebView error: ${error.description}');
          },
        ),
      )
      ..addJavaScriptChannel(
        'PaymentBridge',
        onMessageReceived: _onPaymentMessage,
      )
      ..loadRequest(Uri.parse(_targetUrl));
  }

  Future<void> _initIAP() async {
    final available = await _iap.isAvailable();
    if (!available) {
      debugPrint('IAP not available');
      return;
    }

    // 구매 상태 스트림 구독
    _purchaseSubscription = _iap.purchaseStream.listen(
      _onPurchaseUpdated,
      onError: (error) {
        debugPrint('IAP stream error: $error');
      },
    );

    // 상품 정보 로드
    final response = await _iap.queryProductDetails({_subscriptionProductId});
    if (response.error != null) {
      debugPrint('IAP product query error: ${response.error}');
    }
    if (response.notFoundIDs.isNotEmpty) {
      debugPrint('IAP products not found: ${response.notFoundIDs}');
    }
  }

  void _onPaymentMessage(JavaScriptMessage message) {
    try {
      final data = jsonDecode(message.message);
      if (data['type'] == 'PAYMENT_REQUEST') {
        _startPurchase();
      }
    } catch (e) {
      debugPrint('PaymentBridge parse error: $e');
    }
  }

  Future<void> _startPurchase() async {
    final available = await _iap.isAvailable();
    if (!available) {
      _sendPaymentResult('error', '인앱결제를 사용할 수 없습니다');
      return;
    }

    final response = await _iap.queryProductDetails({_subscriptionProductId});
    if (response.productDetails.isEmpty) {
      _sendPaymentResult('error', '상품 정보를 찾을 수 없습니다');
      return;
    }

    final product = response.productDetails.first;
    final purchaseParam = PurchaseParam(productDetails: product);
    await _iap.buyNonConsumable(purchaseParam: purchaseParam);
  }

  void _onPurchaseUpdated(List<PurchaseDetails> purchases) {
    for (final purchase in purchases) {
      switch (purchase.status) {
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          _verifyAndDeliver(purchase);
          break;
        case PurchaseStatus.error:
          _sendPaymentResult('error', purchase.error?.message ?? '결제 실패');
          if (purchase.pendingCompletePurchase) {
            _iap.completePurchase(purchase);
          }
          break;
        case PurchaseStatus.canceled:
          _sendPaymentResult('cancelled', '결제가 취소되었습니다');
          break;
        case PurchaseStatus.pending:
          debugPrint('IAP purchase pending...');
          break;
      }
    }
  }

  Future<void> _verifyAndDeliver(PurchaseDetails purchase) async {
    try {
      final platform = Platform.isIOS ? 'APPLE_IAP' : 'GOOGLE_PLAY';

      // 서버에 영수증 전송하여 검증
      // WebView의 쿠키/세션을 활용하기 위해 JavaScript로 fetch 호출
      final receiptToken = Platform.isIOS
          ? purchase.purchaseID ?? ''
          : purchase.verificationData.serverVerificationData;

      final jsCode = '''
        fetch('/api/payment/iap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: '$platform',
            receiptToken: '${_escapeForJs(receiptToken)}',
            productId: '${purchase.productID}',
            originalTransactionId: '${_escapeForJs(purchase.purchaseID ?? '')}'
          })
        })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            window.onPaymentComplete && window.onPaymentComplete({ status: 'success', data: data });
          } else {
            window.onPaymentComplete && window.onPaymentComplete({ status: 'error', message: data.error });
          }
        })
        .catch(e => {
          window.onPaymentComplete && window.onPaymentComplete({ status: 'error', message: e.message });
        });
      ''';

      await _controller.runJavaScript(jsCode);
    } catch (e) {
      debugPrint('IAP verify error: $e');
      _sendPaymentResult('error', '영수증 검증 실패');
    } finally {
      if (purchase.pendingCompletePurchase) {
        await _iap.completePurchase(purchase);
      }
    }
  }

  void _sendPaymentResult(String status, [String? message]) {
    final payload = jsonEncode({
      'status': status,
      if (message != null) 'message': message,
    });
    _controller.runJavaScript(
      'window.onPaymentComplete && window.onPaymentComplete($payload);',
    );
  }

  String _escapeForJs(String input) {
    return input
        .replaceAll('\\', '\\\\')
        .replaceAll("'", "\\'")
        .replaceAll('\n', '\\n');
  }

  @override
  void dispose() {
    _purchaseSubscription.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, dynamic result) async {
        if (didPop) return;
        if (await _controller.canGoBack()) {
          _controller.goBack();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: WebViewWidget(controller: _controller),
        ),
      ),
    );
  }
}
