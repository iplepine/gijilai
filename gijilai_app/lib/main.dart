import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:app_links/app_links.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'firebase_options.dart';

Future<void> main() async {
  await runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      KakaoSdk.init(nativeAppKey: '8d63a45bb147379940cda43c72e841d6');
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

      FlutterError.onError =
          FirebaseCrashlytics.instance.recordFlutterFatalError;
      PlatformDispatcher.instance.onError = (error, stack) {
        FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
        return true;
      };

      runApp(const GijilaiApp());
    },
    (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    },
  );
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

class _MainWebViewState extends State<MainWebView> with WidgetsBindingObserver {
  static const _supabaseUrl = 'https://gqpedxovfesbusjpjryl.supabase.co';
  static const _subscriptionProductId = 'monthly_premium';
  static const _practiceReminderNotificationId = 1001;
  static const _practiceReminderEnabledKey = 'practice_reminder_enabled';
  static const _practiceReminderTimeKey = 'practice_reminder_time';

  WebViewController? _controller;
  StreamSubscription<List<PurchaseDetails>>? _purchaseSubscription;
  StreamSubscription<Uri>? _appLinkSubscription;
  final InAppPurchase _iap = InAppPurchase.instance;
  final AppLinks _appLinks = AppLinks();
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  Uri? _pendingAuthCallbackUri;
  DateTime? _lastBackPressedAt;
  bool _showNativeLogin = false;
  bool _authInProgress = false;
  bool _externalAuthInProgress = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initAppLinks();
    _initIAP();
    _initLocalNotifications();
    _initWebView();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || !_externalAuthInProgress) {
      return;
    }

    unawaited(_resetAuthLoadingAfterCancelledHandoff());
  }

  Future<void> _initAppLinks() async {
    try {
      final initialUri = await _appLinks.getInitialLink();
      if (initialUri != null) {
        _handleIncomingAuthUri(initialUri);
      }

      _appLinkSubscription = _appLinks.uriLinkStream.listen(
        (uri) => unawaited(_handleIncomingAuthUri(uri)),
        onError: (error) {
          debugPrint('App link stream error: $error');
          unawaited(
            FirebaseCrashlytics.instance.recordError(
              error,
              StackTrace.current,
              reason: 'App link stream error',
            ),
          );
        },
      );
    } catch (e) {
      debugPrint('App links init error: $e');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'App links init error',
        ),
      );
    }
  }

  Future<void> _initLocalNotifications() async {
    try {
      tz.initializeTimeZones();
      final timeZoneName =
          (await FlutterTimezone.getLocalTimezone()).identifier;
      tz.setLocalLocation(tz.getLocation(timeZoneName));

      const android = AndroidInitializationSettings('@mipmap/ic_launcher');
      const ios = DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      );
      const settings = InitializationSettings(android: android, iOS: ios);

      await _localNotifications.initialize(settings);
      await _restorePracticeReminder();
    } catch (e) {
      debugPrint('Local notifications init error: $e');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'Local notifications init error',
        ),
      );
    }
  }

  Future<void> _initWebView() async {
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000));

    // 기본 UA를 유지하면서 gijilai_app 식별자 추가 (navigator.language 등 보존)
    final defaultUA = await controller.getUserAgent() ?? '';
    await controller.setUserAgent('$defaultUA gijilai_app');
    await controller.setOnJavaScriptAlertDialog(_showJavaScriptAlertDialog);
    await controller.setOnJavaScriptConfirmDialog(_showJavaScriptConfirmDialog);
    await controller.setOnJavaScriptTextInputDialog(
      _showJavaScriptTextInputDialog,
    );

    controller
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: _handleNavigationRequest,
          onPageFinished: _handlePageFinished,
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
      ..addJavaScriptChannel(
        'ReminderBridge',
        onMessageReceived: _onReminderMessage,
      )
      ..addJavaScriptChannel('AuthBridge', onMessageReceived: _onAuthMessage)
      ..addJavaScriptChannel('ShareBridge', onMessageReceived: _onShareMessage)
      ..loadRequest(Uri.parse(MainWebView.targetUrl));

    setState(() {
      _controller = controller;
    });
    await _consumePendingAuthCallback();
  }

  Future<void> _showJavaScriptAlertDialog(
    JavaScriptAlertDialogRequest request,
  ) async {
    if (!mounted) return;
    await _showAppAlertDialog(message: request.message);
  }

  Future<bool> _showJavaScriptConfirmDialog(
    JavaScriptConfirmDialogRequest request,
  ) async {
    if (!mounted) return false;
    return await _showAppConfirmDialog(message: request.message);
  }

  Future<String> _showJavaScriptTextInputDialog(
    JavaScriptTextInputDialogRequest request,
  ) async {
    if (!mounted) return request.defaultText ?? '';
    return await _showAppTextInputDialog(
      message: request.message,
      defaultText: request.defaultText,
    );
  }

  Future<void> _showAppAlertDialog({required String message}) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => _AppWebDialog(
        message: message,
        actions: [
          _AppDialogButton(
            label: '확인',
            isPrimary: true,
            onPressed: () => Navigator.of(dialogContext).pop(),
          ),
        ],
      ),
    );
  }

  Future<bool> _showAppConfirmDialog({required String message}) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => _AppWebDialog(
        message: message,
        actions: [
          _AppDialogButton(
            label: '취소',
            onPressed: () => Navigator.of(dialogContext).pop(false),
          ),
          _AppDialogButton(
            label: '확인',
            isPrimary: true,
            onPressed: () => Navigator.of(dialogContext).pop(true),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  Future<String> _showAppTextInputDialog({
    required String message,
    required String? defaultText,
  }) async {
    final inputController = TextEditingController(text: defaultText ?? '');
    try {
      final result = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => _AppWebDialog(
          message: message,
          content: TextField(
            controller: inputController,
            autofocus: true,
            minLines: 1,
            maxLines: 3,
            decoration: InputDecoration(
              filled: true,
              fillColor: const Color(0xFFF5F3EF),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFE1DDD2)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFE1DDD2)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Color(0xFF2F4F3E),
                  width: 1.4,
                ),
              ),
            ),
          ),
          actions: [
            _AppDialogButton(
              label: '취소',
              onPressed: () => Navigator.of(dialogContext).pop(''),
            ),
            _AppDialogButton(
              label: '확인',
              isPrimary: true,
              onPressed: () =>
                  Navigator.of(dialogContext).pop(inputController.text),
            ),
          ],
        ),
      );
      return result ?? '';
    } finally {
      inputController.dispose();
    }
  }

  NavigationDecision _handleNavigationRequest(NavigationRequest request) {
    final uri = Uri.tryParse(request.url);
    if (uri == null) return NavigationDecision.navigate;

    if (_isAuthCallbackUri(uri)) {
      _handleIncomingAuthUri(uri);
      return NavigationDecision.prevent;
    }

    if (_shouldOpenExternally(uri)) {
      unawaited(_launchExternalUrl(uri));
      return NavigationDecision.prevent;
    }

    return NavigationDecision.navigate;
  }

  void _handlePageFinished(String url) {
    final uri = Uri.tryParse(url);
    final shouldShowLogin =
        uri != null &&
        uri.host == Uri.parse(MainWebView.targetUrl).host &&
        uri.path == '/login';

    if (shouldShowLogin != _showNativeLogin && mounted) {
      setState(() {
        _showNativeLogin = shouldShowLogin;
      });
    }
  }

  bool _shouldOpenExternally(Uri uri) {
    final scheme = uri.scheme.toLowerCase();
    if (scheme == 'http' || scheme == 'https') {
      return _isOAuthNavigationUri(uri);
    }
    if (scheme == 'about') {
      return false;
    }
    return true;
  }

  bool _isOAuthNavigationUri(Uri uri) {
    final host = uri.host.toLowerCase();
    final path = uri.path.toLowerCase();

    if (host == 'accounts.google.com' ||
        host == 'oauth2.googleapis.com' ||
        host.endsWith('.googleusercontent.com')) {
      return true;
    }

    if (host == 'kauth.kakao.com' ||
        host == 'accounts.kakao.com' ||
        host.endsWith('.kakao.com')) {
      return true;
    }

    return host.contains('supabase.co') &&
        path.startsWith('/auth/v1/authorize');
  }

  bool _isAuthCallbackUri(Uri uri) {
    return uri.scheme == 'gijilai' &&
        uri.host == 'auth' &&
        uri.path.startsWith('/callback');
  }

  Future<void> _handleIncomingAuthUri(Uri uri) async {
    if (!_isAuthCallbackUri(uri)) return;

    _pendingAuthCallbackUri = uri;
    await _consumePendingAuthCallback();
  }

  Future<void> _consumePendingAuthCallback() async {
    final uri = _pendingAuthCallbackUri;
    final controller = _controller;
    if (uri == null || controller == null) return;

    _pendingAuthCallbackUri = null;
    _externalAuthInProgress = false;
    final webCallback = Uri.https(
      'gijilai.com',
      '/auth/callback',
      uri.queryParameters,
    );
    await controller.loadRequest(webCallback);
    if (mounted) {
      setState(() {
        _showNativeLogin = false;
        _authInProgress = false;
      });
    }
  }

  void _onAuthMessage(JavaScriptMessage message) {
    try {
      final data = jsonDecode(message.message);
      if (data['type'] == 'OAUTH_URL' && data['url'] is String) {
        final uri = Uri.parse(data['url'] as String);
        _externalAuthInProgress = true;
        unawaited(_launchAuthUrlFromBridge(uri));
      }
    } catch (e) {
      debugPrint('AuthBridge parse error: $e');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'AuthBridge parse error',
        ),
      );
    }
  }

  Future<void> _launchAuthUrlFromBridge(Uri uri) async {
    final launched = await _launchExternalUrl(uri);
    if (!launched) {
      await _finishCancelledAuthHandoff(showMessage: true);
    }
  }

  Future<bool> _launchExternalUrl(Uri uri) async {
    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        throw Exception('Unable to launch external URL: $uri');
      }
      return true;
    } catch (e) {
      debugPrint('External URL launch error: $e');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'External URL launch error',
        ),
      );
      return false;
    }
  }

  Future<void> _startNativeOAuth(String provider) async {
    if (_authInProgress) return;
    setState(() {
      _authInProgress = true;
    });

    if (await _startOAuthThroughWebAuth(provider)) {
      _externalAuthInProgress = true;
      return;
    }

    _externalAuthInProgress = true;

    try {
      final authorizeUri = Uri.parse('$_supabaseUrl/auth/v1/authorize').replace(
        queryParameters: {
          'provider': provider,
          'redirect_to': 'gijilai://auth/callback',
          if (provider == 'kakao') 'scopes': 'profile_nickname',
        },
      );

      final launched = await _launchExternalUrl(authorizeUri);
      if (!launched) {
        await _finishCancelledAuthHandoff(showMessage: true);
      }
    } catch (e) {
      debugPrint('Native OAuth start error: $e');
      _externalAuthInProgress = false;
      if (mounted) {
        setState(() {
          _authInProgress = false;
        });
      }
      _showSnackBar('로그인을 시작할 수 없습니다', isError: true);
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'Native OAuth start error',
        ),
      );
    }
  }

  Future<bool> _startOAuthThroughWebAuth(String provider) async {
    final controller = _controller;
    if (controller == null) return false;

    try {
      final raw = await controller.runJavaScriptReturningResult('''
        (() => {
          if (window.__startNativeOAuthProvider) {
            window.__startNativeOAuthProvider('${_escapeForJs(provider)}');
            return 'started';
          }
          return '';
        })();
      ''');
      final result = raw.toString().replaceAll('"', '');
      return result == 'started';
    } catch (e) {
      debugPrint('Web OAuth handoff unavailable: $e');
      return false;
    }
  }

  Future<void> _startKakaoNativeLogin() async {
    if (_authInProgress) return;
    setState(() {
      _authInProgress = true;
    });

    try {
      OAuthToken token;
      if (await isKakaoTalkInstalled()) {
        try {
          token = await UserApi.instance.loginWithKakaoTalk();
        } catch (e) {
          debugPrint('KakaoTalk login failed, fallback to account: $e');
          token = await UserApi.instance.loginWithKakaoAccount();
        }
      } else {
        token = await UserApi.instance.loginWithKakaoAccount();
      }

      if (token.idToken == null || token.idToken!.isEmpty) {
        debugPrint('Kakao ID token was not returned. Falling back to OAuth.');
        if (mounted) {
          setState(() {
            _authInProgress = false;
          });
        }
        _externalAuthInProgress = false;
        await _startNativeOAuth('kakao');
        return;
      }

      await _completeNativeSession(
        provider: 'kakao',
        idToken: token.idToken!,
        accessToken: token.accessToken,
      );
    } catch (e) {
      debugPrint('Kakao native login error: $e');
      _externalAuthInProgress = false;
      if (mounted) {
        setState(() {
          _authInProgress = false;
        });
      }
      _showSnackBar('카카오 로그인을 완료할 수 없습니다', isError: true);
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'Kakao native login error',
        ),
      );
    }
  }

  Future<void> _completeNativeSession({
    required String provider,
    required String idToken,
    String? accessToken,
  }) async {
    final payload = jsonEncode({
      'provider': provider,
      'idToken': idToken,
      if (accessToken != null && accessToken.isNotEmpty)
        'accessToken': accessToken,
    });

    final jsCode =
        '''
      (async () => {
        try {
          const r = await fetch('/auth/native-session', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: ${_escapeForJsStringLiteral(payload)}
          });
          const data = await r.json().catch(() => ({}));
          window.__nativeAuthResult = JSON.stringify({ ok: r.ok, ...data });
        } catch (e) {
          window.__nativeAuthResult = JSON.stringify({ ok: false, error: e.message });
        }
      })();
    ''';

    await _controller!.runJavaScript(jsCode);

    Map<String, dynamic>? result;
    for (var i = 0; i < 30; i++) {
      await Future.delayed(const Duration(milliseconds: 300));
      final raw = await _controller!.runJavaScriptReturningResult(
        'window.__nativeAuthResult || ""',
      );
      if (raw.toString().isNotEmpty && raw.toString() != '""') {
        var jsonStr = raw.toString();
        if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
          jsonStr = jsonDecode(jsonStr) as String;
        }
        result = jsonDecode(jsonStr) as Map<String, dynamic>;
        await _controller!.runJavaScript('delete window.__nativeAuthResult;');
        break;
      }
    }

    if (result == null || result['ok'] != true) {
      throw Exception(result?['error']?.toString() ?? 'Native session failed');
    }

    if (mounted) {
      setState(() {
        _showNativeLogin = false;
        _authInProgress = false;
      });
    }
    _externalAuthInProgress = false;
    await _controller!.loadRequest(Uri.parse(MainWebView.targetUrl));
  }

  Future<void> _resetAuthLoadingAfterCancelledHandoff() async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!_externalAuthInProgress || _pendingAuthCallbackUri != null) return;

    await _finishCancelledAuthHandoff();
  }

  Future<void> _finishCancelledAuthHandoff({bool showMessage = false}) async {
    _externalAuthInProgress = false;
    if (mounted) {
      setState(() {
        _authInProgress = false;
      });
    }
    await _notifyWebAuthLoadingDone();
    if (showMessage) {
      _showSnackBar('로그인을 시작할 수 없습니다', isError: true);
    }
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

  Future<void> _onReminderMessage(JavaScriptMessage message) async {
    try {
      final data = jsonDecode(message.message) as Map<String, dynamic>;
      if (data['type'] != 'PRACTICE_REMINDER_SETTINGS') return;

      final enabled = data['enabled'] == true;
      final time = data['time']?.toString() ?? '20:00';
      await _schedulePracticeReminder(enabled: enabled, time: time);
    } catch (e) {
      debugPrint('ReminderBridge parse error: $e');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'ReminderBridge parse error',
        ),
      );
    }
  }

  Future<void> _onShareMessage(JavaScriptMessage message) async {
    try {
      final data = jsonDecode(message.message) as Map<String, dynamic>;
      if (data['type'] != 'SHARE_REQUEST') return;

      final title = data['title']?.toString() ?? '기질아이';
      final text = data['text']?.toString() ?? '';
      final url = data['url']?.toString() ?? '';
      final content = [
        text,
        url,
      ].where((value) => value.isNotEmpty).join('\n\n');

      await SharePlus.instance.share(
        ShareParams(title: title, text: content.isNotEmpty ? content : title),
      );
    } catch (e) {
      debugPrint('ShareBridge error: $e');
      _showSnackBar('공유를 열 수 없습니다', isError: true);
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'ShareBridge error',
        ),
      );
    }
  }

  Future<void> _schedulePracticeReminder({
    required bool enabled,
    required String time,
    bool persist = true,
    bool requestPermission = true,
    bool showFeedback = true,
  }) async {
    if (persist) {
      await _savePracticeReminderSettings(enabled: enabled, time: time);
    }

    await _localNotifications.cancel(_practiceReminderNotificationId);

    if (!enabled) {
      if (showFeedback) {
        _showSnackBar('실천 리마인더가 꺼졌습니다');
      }
      return;
    }

    final permissionGranted = requestPermission
        ? await _requestLocalNotificationPermission()
        : await _areLocalNotificationsEnabled();
    if (!permissionGranted) {
      if (showFeedback) {
        _showSnackBar('알림 권한이 필요합니다', isError: true);
      }
      return;
    }

    final parts = time.split(':');
    final hour = int.tryParse(parts.first) ?? 20;
    final minute = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;

    const androidDetails = AndroidNotificationDetails(
      'practice_reminders',
      '실천 리마인더',
      channelDescription: '진행 중인 실천 항목을 매일 떠올릴 수 있도록 알려줍니다.',
      importance: Importance.defaultImportance,
      priority: Priority.defaultPriority,
    );
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    await _localNotifications.zonedSchedule(
      _practiceReminderNotificationId,
      '오늘의 실천을 떠올려볼 시간이에요',
      '짧게 체크하고 다음 상담에 쓸 변화를 남겨보세요.',
      _nextInstanceOfTime(hour, minute),
      const NotificationDetails(android: androidDetails, iOS: iosDetails),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      matchDateTimeComponents: DateTimeComponents.time,
    );

    if (showFeedback) {
      _showSnackBar('실천 리마인더가 설정되었습니다');
    }
  }

  Future<void> _savePracticeReminderSettings({
    required bool enabled,
    required String time,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_practiceReminderEnabledKey, enabled);
    await prefs.setString(_practiceReminderTimeKey, time);
  }

  Future<void> _restorePracticeReminder() async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool(_practiceReminderEnabledKey) ?? false;
    final time = prefs.getString(_practiceReminderTimeKey) ?? '20:00';

    if (!enabled) return;

    final pending = await _localNotifications.pendingNotificationRequests();
    final alreadyScheduled = pending.any(
      (notification) => notification.id == _practiceReminderNotificationId,
    );
    if (alreadyScheduled) return;

    await _schedulePracticeReminder(
      enabled: true,
      time: time,
      persist: false,
      requestPermission: false,
      showFeedback: false,
    );
  }

  Future<bool> _areLocalNotificationsEnabled() async {
    if (Platform.isAndroid) {
      return await _localNotifications
              .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin
              >()
              ?.areNotificationsEnabled() ??
          true;
    }

    return true;
  }

  Future<bool> _requestLocalNotificationPermission() async {
    if (Platform.isIOS) {
      return await _localNotifications
              .resolvePlatformSpecificImplementation<
                IOSFlutterLocalNotificationsPlugin
              >()
              ?.requestPermissions(alert: true, badge: true, sound: true) ??
          false;
    }

    if (Platform.isAndroid) {
      return await _localNotifications
              .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin
              >()
              ?.requestNotificationsPermission() ??
          true;
    }

    return true;
  }

  tz.TZDateTime _nextInstanceOfTime(int hour, int minute) {
    final now = tz.TZDateTime.now(tz.local);
    var scheduled = tz.TZDateTime(
      tz.local,
      now.year,
      now.month,
      now.day,
      hour.clamp(0, 23),
      minute.clamp(0, 59),
    );
    if (scheduled.isBefore(now)) {
      scheduled = scheduled.add(const Duration(days: 1));
    }
    return scheduled;
  }

  Future<void> _startPurchase() async {
    final available = await _iap.isAvailable();
    if (!available) {
      debugPrint('IAP purchase blocked: store is not available');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          Exception('IAP store is not available'),
          StackTrace.current,
          reason: 'IAP purchase blocked before product query',
        ),
      );
      _showSnackBar('인앱결제를 사용할 수 없습니다', isError: true);
      _notifyWebLoadingDone();
      return;
    }

    final response = await _iap.queryProductDetails({_subscriptionProductId});
    if (response.error != null) {
      debugPrint(
        'IAP product query failed before purchase: '
        'code=${response.error!.code}, '
        'message=${response.error!.message}, '
        'details=${response.error!.details}',
      );
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          response.error!,
          StackTrace.current,
          reason: 'IAP product query failed before purchase',
        ),
      );
    }

    if (response.productDetails.isEmpty) {
      debugPrint(
        'IAP product details empty: productId=$_subscriptionProductId, '
        'notFoundIDs=${response.notFoundIDs.join(",")}',
      );
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          Exception(
            'IAP product not found: $_subscriptionProductId '
            '(notFoundIDs=${response.notFoundIDs.join(",")})',
          ),
          StackTrace.current,
          reason: 'IAP product details empty before purchase',
        ),
      );
      _showSnackBar('상품 정보를 찾을 수 없습니다', isError: true);
      _notifyWebLoadingDone();
      return;
    }

    // Android 구독: queryProductDetails가 offer별로 별도 ProductDetails 반환
    // 첫 번째 항목 사용 (Google Play가 적격 offer를 우선 반환)
    final product = response.productDetails.first;
    debugPrint(
      'IAP launching purchase: productId=${product.id}, '
      'title=${product.title}, price=${product.price}',
    );

    try {
      if (Platform.isAndroid && product is GooglePlayProductDetails) {
        debugPrint('IAP Android offerToken=${product.offerToken}');
        final purchaseParam = GooglePlayPurchaseParam(
          productDetails: product,
          offerToken: product.offerToken,
        );
        await _iap.buyNonConsumable(purchaseParam: purchaseParam);
      } else {
        final purchaseParam = PurchaseParam(productDetails: product);
        await _iap.buyNonConsumable(purchaseParam: purchaseParam);
      }
    } catch (e) {
      debugPrint('IAP purchase launch threw: $e');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'IAP purchase launch threw',
        ),
      );
      _showSnackBar('결제창을 열 수 없습니다', isError: true);
      _notifyWebLoadingDone();
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
          debugPrint(
            'IAP purchase error: '
            'productId=${purchase.productID}, '
            'purchaseId=${purchase.purchaseID}, '
            'code=${purchase.error?.code}, '
            'message=${purchase.error?.message}, '
            'details=${purchase.error?.details}',
          );
          unawaited(
            FirebaseCrashlytics.instance.recordError(
              purchase.error ?? Exception('Unknown IAP purchase error'),
              StackTrace.current,
              reason: 'IAP purchase status error',
            ),
          );
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
      final jsCode =
          '''
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
          resultJson =
              await _controller!.runJavaScriptReturningResult(
                    'window.__iapResult',
                  )
                  as String?;
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
        final errorCode = data['error']?.toString();
        final errorMessage = errorCode == 'IAP_SERVER_MISCONFIGURED'
            ? '결제 검증 설정에 문제가 있습니다. 잠시 후 다시 시도해주세요.'
            : errorCode ?? '검증 실패';
        _showSnackBar(errorMessage, isError: true);
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
        backgroundColor: isError
            ? Colors.red.shade700
            : const Color(0xFF2F4F3E),
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

  Future<void> _notifyWebAuthLoadingDone() async {
    try {
      await _controller?.runJavaScript('''
        if (window.__authLoadingDone) {
          window.__authLoadingDone();
        } else if (window.location.pathname === '/login') {
          window.location.reload();
        }
        ''');
    } catch (e) {
      debugPrint('Auth loading reset script error: $e');
    }
  }

  String _escapeForJs(String input) {
    return input
        .replaceAll('\\', '\\\\')
        .replaceAll("'", "\\'")
        .replaceAll('\n', '\\n');
  }

  String _escapeForJsStringLiteral(String input) {
    return jsonEncode(input);
  }

  Future<void> _handleBackPressed(WebViewController controller) async {
    final currentUrl = await controller.currentUrl();

    if (!_isHomeUrl(currentUrl) && await controller.canGoBack()) {
      controller.goBack();
      return;
    }

    final now = DateTime.now();
    final shouldExit =
        _lastBackPressedAt != null &&
        now.difference(_lastBackPressedAt!) <= const Duration(seconds: 3);

    if (shouldExit) {
      await SystemNavigator.pop();
      return;
    }

    _lastBackPressedAt = now;
    _showSnackBar('한번 더 누르면 종료됩니다');
  }

  bool _isHomeUrl(String? url) {
    final uri = url == null ? null : Uri.tryParse(url);
    if (uri == null) return false;

    final targetUri = Uri.parse(MainWebView.targetUrl);
    final isSameHost = uri.host == targetUri.host;
    final isHomePath = uri.path.isEmpty || uri.path == '/';
    return isSameHost && isHomePath;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _purchaseSubscription?.cancel();
    _appLinkSubscription?.cancel();
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
        await _handleBackPressed(controller);
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Stack(
          children: [
            Positioned.fill(child: WebViewWidget(controller: controller)),
            if (_showNativeLogin)
              NativeLoginScreen(
                isLoading: _authInProgress,
                onKakaoPressed: _startKakaoNativeLogin,
                onGooglePressed: () => _startNativeOAuth('google'),
                onEmailPressed: () {
                  setState(() {
                    _showNativeLogin = false;
                  });
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _AppWebDialog extends StatelessWidget {
  const _AppWebDialog({
    required this.message,
    required this.actions,
    this.content,
  });

  final String message;
  final Widget? content;
  final List<Widget> actions;

  static const _primary = Color(0xFF2F4F3E);
  static const _textMain = Color(0xFF26382F);

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 28),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFFFBFAF6),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.14),
              blurRadius: 32,
              offset: const Offset(0, 18),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: _primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.info_outline_rounded,
                    color: _primary,
                    size: 24,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                message,
                style: const TextStyle(
                  color: _textMain,
                  fontSize: 16,
                  height: 1.55,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0,
                ),
              ),
              if (content != null) ...[const SizedBox(height: 16), content!],
              const SizedBox(height: 22),
              Row(
                children: [
                  for (int index = 0; index < actions.length; index++) ...[
                    if (index > 0) const SizedBox(width: 10),
                    Expanded(child: actions[index]),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AppDialogButton extends StatelessWidget {
  const _AppDialogButton({
    required this.label,
    required this.onPressed,
    this.isPrimary = false,
  });

  final String label;
  final VoidCallback onPressed;
  final bool isPrimary;

  static const _primary = Color(0xFF2F4F3E);
  static const _textSub = Color(0xFF6E7A75);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: isPrimary ? _primary : const Color(0xFFF0EDE5),
          foregroundColor: isPrimary ? Colors.white : _textSub,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            letterSpacing: 0,
          ),
        ),
        child: Text(label),
      ),
    );
  }
}

class NativeLoginScreen extends StatelessWidget {
  const NativeLoginScreen({
    super.key,
    required this.isLoading,
    required this.onKakaoPressed,
    required this.onGooglePressed,
    required this.onEmailPressed,
  });

  final bool isLoading;
  final VoidCallback onKakaoPressed;
  final VoidCallback onGooglePressed;
  final VoidCallback onEmailPressed;

  static const _primary = Color(0xFF2F4F3E);
  static const _textMain = Color(0xFF26382F);
  static const _textSub = Color(0xFF7B847E);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFFBFAF6),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: _primary,
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: _primary.withValues(alpha: 0.18),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.favorite_border_rounded,
                  color: Color(0xFFEFE5BE),
                  size: 38,
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                '기질아이',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: _textMain,
                  fontSize: 30,
                  height: 1.15,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                '아이의 타고난 기질을 이해하고\n우리 가족에게 맞는 대화를 찾아보세요.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: _textSub,
                  fontSize: 15,
                  height: 1.55,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0,
                ),
              ),
              const Spacer(),
              _LoginButton(
                label: '카카오로 계속하기',
                backgroundColor: const Color(0xFFFEE500),
                foregroundColor: const Color(0xFF191919),
                enabled: !isLoading,
                icon: const _KakaoLoginSymbol(size: 20),
                onPressed: onKakaoPressed,
              ),
              const SizedBox(height: 12),
              _LoginButton(
                label: '구글로 계속하기',
                backgroundColor: Colors.white,
                foregroundColor: _textMain,
                borderColor: const Color(0xFFE6E2D8),
                enabled: !isLoading,
                icon: const _GoogleLoginSymbol(size: 20),
                onPressed: onGooglePressed,
              ),
              if (isLoading) ...[
                const SizedBox(height: 18),
                const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: _primary,
                  ),
                ),
              ],
              const SizedBox(height: 28),
              TextButton(
                onPressed: isLoading ? null : onEmailPressed,
                child: const Text(
                  '이메일로 로그인',
                  style: TextStyle(
                    color: _textSub,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '로그인하면 이용약관과 개인정보처리방침에 동의하게 됩니다.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFF9A9F99),
                  fontSize: 12,
                  height: 1.4,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _KakaoLoginSymbol extends StatelessWidget {
  const _KakaoLoginSymbol({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _KakaoLoginSymbolPainter(),
    );
  }
}

class _KakaoLoginSymbolPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 256, size.height / 256);

    final paint = Paint()
      ..color = const Color(0xFF000000)
      ..style = PaintingStyle.fill;

    final path = Path()
      ..moveTo(128, 36)
      ..cubicTo(70.6, 36, 24, 72.4, 24, 116.8)
      ..cubicTo(24, 145.7, 43.2, 171, 72.1, 185.4)
      ..lineTo(62.3, 221.6)
      ..cubicTo(61.5, 224.5, 64.9, 226.8, 67.4, 225.1)
      ..lineTo(109.9, 196.7)
      ..cubicTo(115.8, 197.5, 121.9, 198, 128, 198)
      ..cubicTo(185.4, 198, 232, 161.6, 232, 117.2)
      ..cubicTo(232, 72.8, 185.4, 36, 128, 36)
      ..close();

    canvas.drawPath(path, paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _GoogleLoginSymbol extends StatelessWidget {
  const _GoogleLoginSymbol({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _GoogleLoginSymbolPainter(),
    );
  }
}

class _GoogleLoginSymbolPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 20, size.height / 20);

    void drawPath(Path path, Color color) {
      canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..style = PaintingStyle.fill,
      );
    }

    drawPath(
      Path()
        ..moveTo(18.48, 10.2)
        ..cubicTo(18.48, 9.56, 18.42, 8.95, 18.32, 8.36)
        ..lineTo(10, 8.36)
        ..lineTo(10, 11.84)
        ..lineTo(14.76, 11.84)
        ..cubicTo(14.55, 12.96, 13.93, 13.91, 13, 14.55)
        ..lineTo(13, 16.81)
        ..lineTo(15.84, 16.81)
        ..cubicTo(17.5, 15.28, 18.48, 13.03, 18.48, 10.2)
        ..close(),
      const Color(0xFF4285F4),
    );

    drawPath(
      Path()
        ..moveTo(10, 19)
        ..cubicTo(12.38, 19, 14.38, 18.21, 15.84, 16.86)
        ..lineTo(13, 14.6)
        ..cubicTo(12.21, 15.13, 11.2, 15.44, 10, 15.44)
        ..cubicTo(7.7, 15.44, 5.75, 13.89, 5.05, 11.8)
        ..lineTo(2.1, 11.8)
        ..lineTo(2.1, 14.13)
        ..cubicTo(3.55, 17.01, 6.53, 19, 10, 19)
        ..close(),
      const Color(0xFF34A853),
    );

    drawPath(
      Path()
        ..moveTo(5.05, 11.8)
        ..cubicTo(4.87, 11.27, 4.77, 10.7, 4.77, 10.11)
        ..cubicTo(4.77, 9.52, 4.87, 8.95, 5.05, 8.42)
        ..lineTo(5.05, 6.09)
        ..lineTo(2.1, 6.09)
        ..cubicTo(1.5, 7.28, 1.16, 8.62, 1.16, 10.11)
        ..cubicTo(1.16, 11.6, 1.5, 12.94, 2.1, 14.13)
        ..lineTo(5.05, 11.8)
        ..close(),
      const Color(0xFFFBBC05),
    );

    drawPath(
      Path()
        ..moveTo(10, 4.77)
        ..cubicTo(11.29, 4.77, 12.45, 5.21, 13.36, 6.08)
        ..lineTo(15.88, 3.56)
        ..cubicTo(14.37, 2.15, 12.37, 1.29, 10, 1.29)
        ..cubicTo(6.53, 1.29, 3.55, 3.28, 2.1, 6.16)
        ..lineTo(5.05, 8.49)
        ..cubicTo(5.75, 6.32, 7.7, 4.77, 10, 4.77)
        ..close(),
      const Color(0xFFEA4335),
    );

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _LoginButton extends StatelessWidget {
  const _LoginButton({
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
    required this.icon,
    required this.onPressed,
    this.borderColor,
    this.enabled = true,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;
  final Color? borderColor;
  final Widget icon;
  final VoidCallback onPressed;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: FilledButton(
        onPressed: enabled ? onPressed : null,
        style: FilledButton.styleFrom(
          backgroundColor: backgroundColor,
          foregroundColor: foregroundColor,
          disabledBackgroundColor: backgroundColor.withValues(alpha: 0.55),
          disabledForegroundColor: foregroundColor.withValues(alpha: 0.55),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: borderColor ?? Colors.transparent),
          ),
          elevation: 0,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(width: 24, height: 24, child: Center(child: icon)),
            const SizedBox(width: 10),
            Text(
              label,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                letterSpacing: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
