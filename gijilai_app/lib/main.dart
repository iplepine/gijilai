import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'firebase_options.dart';

Future<void> main() async {
  await runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(
      !kDebugMode,
    );
    await FirebaseCrashlytics.instance.setCustomKey(
      'app_platform',
      defaultTargetPlatform.name,
    );
    await FirebaseCrashlytics.instance.setCustomKey(
      'webview_target',
      MainWebView.targetUrl,
    );

    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission();

    runApp(const GijilaiApp());
  }, (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
  });
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

  static const targetUrl = 'https://gijilai.com/';

  @override
  State<MainWebView> createState() => _MainWebViewState();
}

class _MainWebViewState extends State<MainWebView> {
  static const _subscriptionProductId = 'monthly_premium';

  WebViewController? _controller;
  StreamSubscription<List<PurchaseDetails>>? _purchaseSubscription;
  final InAppPurchase _iap = InAppPurchase.instance;

  @override
  void initState() {
    super.initState();
    _initIAP();
    _initWebView();
  }

  Future<void> _initWebView() async {
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000));

    // 기본 UA를 유지하면서 gijilai_app 식별자 추가 (navigator.language 등 보존)
    final defaultUA = await controller.getUserAgent() ?? '';
    await controller.setUserAgent('$defaultUA gijilai_app');

    controller
      ..setNavigationDelegate(
        NavigationDelegate(
          onWebResourceError: (WebResourceError error) {
            debugPrint('WebView error: ${error.description}');
            unawaited(
              FirebaseCrashlytics.instance.recordError(
                Exception('WebView error: ${error.description}'),
                StackTrace.current,
                reason:
                    'WebView failed to load ${error.url ?? MainWebView.targetUrl}',
              ),
            );
          },
        ),
      )
      ..addJavaScriptChannel(
        'PaymentBridge',
        onMessageReceived: _onPaymentMessage,
      )
      ..loadRequest(Uri.parse(MainWebView.targetUrl));

    setState(() {
      _controller = controller;
    });
  }

  Future<void> _initIAP() async {
    final available = await _iap.isAvailable();
    if (!available) {
      debugPrint('IAP not available');
      FirebaseCrashlytics.instance.log('IAP not available on current device');
      return;
    }

    // 구매 상태 스트림 구독
    _purchaseSubscription = _iap.purchaseStream.listen(
      _onPurchaseUpdated,
      onError: (error) {
        debugPrint('IAP stream error: $error');
        unawaited(
          FirebaseCrashlytics.instance.recordError(
            error,
            StackTrace.current,
            reason: 'IAP purchase stream error',
          ),
        );
      },
    );

    // 상품 정보 로드
    final response = await _iap.queryProductDetails({_subscriptionProductId});
    if (response.error != null) {
      debugPrint('IAP product query error: ${response.error}');
      await FirebaseCrashlytics.instance.recordError(
        response.error!,
        StackTrace.current,
        reason: 'IAP product query error',
      );
    }
    if (response.notFoundIDs.isNotEmpty) {
      debugPrint('IAP products not found: ${response.notFoundIDs}');
      await FirebaseCrashlytics.instance.recordError(
        Exception('IAP products not found: ${response.notFoundIDs.join(",")}'),
        StackTrace.current,
      );
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
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'PaymentBridge parse error',
        ),
      );
    }
  }

  Future<void> _startPurchase() async {
    final available = await _iap.isAvailable();
    if (!available) {
      _showSnackBar('인앱결제를 사용할 수 없습니다', isError: true);
      _notifyWebLoadingDone();
      return;
    }

    final response = await _iap.queryProductDetails({_subscriptionProductId});
    if (response.productDetails.isEmpty) {
      _showSnackBar('상품 정보를 찾을 수 없습니다', isError: true);
      _notifyWebLoadingDone();
      return;
    }

    // Android 구독: queryProductDetails가 offer별로 별도 ProductDetails 반환
    // 첫 번째 항목 사용 (Google Play가 적격 offer를 우선 반환)
    final product = response.productDetails.first;

    if (Platform.isAndroid && product is GooglePlayProductDetails) {
      final purchaseParam = GooglePlayPurchaseParam(
        productDetails: product,
        offerToken: product.offerToken,
      );
      await _iap.buyNonConsumable(purchaseParam: purchaseParam);
    } else {
      final purchaseParam = PurchaseParam(productDetails: product);
      await _iap.buyNonConsumable(purchaseParam: purchaseParam);
    }
  }

  void _onPurchaseUpdated(List<PurchaseDetails> purchases) {
    for (final purchase in purchases) {
      switch (purchase.status) {
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          _verifyAndDeliver(purchase);
          break;
        case PurchaseStatus.error:
          _showSnackBar('결제에 실패했습니다', isError: true);
          _notifyWebLoadingDone();
          if (purchase.pendingCompletePurchase) {
            _iap.completePurchase(purchase);
          }
          break;
        case PurchaseStatus.canceled:
          _notifyWebLoadingDone();
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

      final receiptToken = Platform.isIOS
          ? purchase.purchaseID ?? ''
          : purchase.verificationData.serverVerificationData;

      // WebView 쿠키/세션을 활용하기 위해 JavaScript fetch로 서버 검증
      // 결과를 window.__iapResult에 저장하여 Flutter에서 읽음
      final jsCode = '''
        (async () => {
          try {
            const r = await fetch('/api/payment/iap', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                platform: '$platform',
                receiptToken: '${_escapeForJs(receiptToken)}',
                productId: '${purchase.productID}',
                originalTransactionId: '${_escapeForJs(purchase.purchaseID ?? '')}'
              })
            });
            const data = await r.json();
            window.__iapResult = JSON.stringify(data);
          } catch (e) {
            window.__iapResult = JSON.stringify({ error: e.message });
          }
        })();
      ''';

      await _controller!.runJavaScript(jsCode);

      // 결과 폴링 (fetch 완료 대기)
      String? resultJson;
      for (int i = 0; i < 30; i++) {
        await Future.delayed(const Duration(milliseconds: 500));
        final raw = await _controller!.runJavaScriptReturningResult(
          'window.__iapResult || ""',
        );
        final cleaned = raw.toString().replaceAll('"', '').replaceAll("'", '');
        if (cleaned.isNotEmpty && cleaned != 'null') {
          // runJavaScriptReturningResult는 JSON 문자열을 이스케이프해서 반환하므로 복원
          resultJson = await _controller!.runJavaScriptReturningResult(
            'window.__iapResult',
          ) as String?;
          await _controller!.runJavaScript('delete window.__iapResult;');
          break;
        }
      }

      if (resultJson == null || resultJson.isEmpty) {
        _showSnackBar('서버 응답 시간이 초과되었습니다', isError: true);
        _notifyWebLoadingDone();
        return;
      }

      // JSON 파싱 — runJavaScriptReturningResult가 문자열을 따옴표로 감싸서 반환
      String jsonStr = resultJson;
      if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
        jsonStr = jsonDecode(jsonStr) as String;
      }
      final data = jsonDecode(jsonStr) as Map<String, dynamic>;

      if (data['success'] == true) {
        _showSnackBar('구독이 시작되었습니다!');
        // WebView 새로고침으로 구독 상태 반영
        await _controller!.loadRequest(Uri.parse(MainWebView.targetUrl));
      } else {
        _showSnackBar(data['error']?.toString() ?? '검증 실패', isError: true);
        _notifyWebLoadingDone();
        await FirebaseCrashlytics.instance.recordError(
          Exception('IAP verification failed: ${data['error'] ?? 'unknown'}'),
          StackTrace.current,
        );
      }
    } catch (e) {
      debugPrint('IAP verify error: $e');
      await FirebaseCrashlytics.instance.recordError(
        e,
        StackTrace.current,
        reason: 'IAP receipt verification error',
      );
      _showSnackBar('영수증 검증에 실패했습니다', isError: true);
      _notifyWebLoadingDone();
    } finally {
      if (purchase.pendingCompletePurchase) {
        await _iap.completePurchase(purchase);
      }
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    final ctx = context;
    if (!mounted) return;
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red.shade700 : const Color(0xFF2F4F3E),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: Duration(seconds: isError ? 4 : 3),
      ),
    );
  }

  /// 웹의 loading 상태를 해제
  void _notifyWebLoadingDone() {
    _controller?.runJavaScript(
      'window.__iapLoadingDone && window.__iapLoadingDone();',
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
    _purchaseSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null) {
      return const Scaffold(
        backgroundColor: Colors.white,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, dynamic result) async {
        if (didPop) return;
        if (await controller.canGoBack()) {
          controller.goBack();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: WebViewWidget(controller: controller),
        ),
      ),
    );
  }
}
