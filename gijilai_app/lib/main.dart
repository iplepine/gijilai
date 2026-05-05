import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:ui';

import 'package:app_links/app_links.dart';
import 'package:crypto/crypto.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'firebase_options.dart';

class _AndroidIntentUri {
  const _AndroidIntentUri({
    required this.launchUri,
    required this.browserFallbackUri,
    required this.packageName,
  });

  final Uri? launchUri;
  final Uri? browserFallbackUri;
  final String? packageName;
}

class NativeCapabilityRegistry {
  const NativeCapabilityRegistry();

  static const int contractVersion = 1;
  static const bool supportsHaptics = true;

  static const Map<String, bool> supportedScreens = {
    'login': true,
    'payment': false,
    'subscription': false,
    'notifications': false,
    'profile': false,
  };

  bool supportsScreen(String screenKey) {
    return supportedScreens[screenKey] ?? false;
  }

  String toJavaScriptObjectLiteral() {
    final screens = supportedScreens.entries
        .map((entry) => "'${entry.key}': ${entry.value}")
        .join(', ');
    return '''
      {
        contractVersion: $contractVersion,
        haptics: $supportsHaptics,
        supportedScreens: { $screens }
      }
    ''';
  }
}

const String _googleWebClientId = String.fromEnvironment(
  'GOOGLE_WEB_CLIENT_ID',
);
const String _googleIosClientId = String.fromEnvironment(
  'GOOGLE_IOS_CLIENT_ID',
);

Future<void> main() async {
  await runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      KakaoSdk.init(
        nativeAppKey: '8d63a45bb147379940cda43c72e841d6',
        customScheme: 'kakao8d63a45bb147379940cda43c72e841d6',
      );
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
    const overlayStyle = SystemUiOverlayStyle(
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
      systemNavigationBarIconBrightness: Brightness.dark,
      systemNavigationBarContrastEnforced: false,
    );

    return MaterialApp(
      title: '기질아이',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2F4F3E)),
        useMaterial3: true,
      ),
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: overlayStyle,
        child: ColoredBox(
          color: const Color(0xFFF9F8F6),
          child: child ?? const SizedBox.shrink(),
        ),
      ),
      home: const MainWebView(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class MainWebView extends StatefulWidget {
  const MainWebView({super.key});

  static const targetUrl = String.fromEnvironment(
    'GIJILAI_WEB_URL',
    defaultValue: 'https://gijilai.com/',
  );

  @override
  State<MainWebView> createState() => _MainWebViewState();
}

class _MainWebViewState extends State<MainWebView> with WidgetsBindingObserver {
  static const _permissionsChannel = MethodChannel(
    'com.devho.gijilai/permissions',
  );
  static const _iosSubscriptionProductId = 'gijilai_premium_monthly';
  static const _androidSubscriptionProductId = 'monthly_premium';
  static const _practiceReminderNotificationId = 1001;
  static const _practiceReminderEnabledKey = 'practice_reminder_enabled';
  static const _practiceReminderTimeKey = 'practice_reminder_time';
  static const _practiceReminderTitleKey = 'practice_reminder_title';
  static const _practiceReminderBodyKey = 'practice_reminder_body';
  static const _nativeCapabilities = NativeCapabilityRegistry();

  WebViewController? _controller;
  PackageInfo? _packageInfo;
  StreamSubscription<List<PurchaseDetails>>? _purchaseSubscription;
  StreamSubscription<Uri>? _appLinkSubscription;
  final InAppPurchase _iap = InAppPurchase.instance;
  final AppLinks _appLinks = AppLinks();
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  Uri? _pendingAuthCallbackUri;
  Uri? _pendingAppOpenUri;
  DateTime? _lastBackPressedAt;
  bool _showNativeLogin = false;
  bool _isNativeDialogVisible = false;
  bool _authInProgress = false;
  bool _externalAuthInProgress = false;
  bool _hasRenderedFirstPage = false;
  bool _isWebPageLoading = false;
  bool _iapLaunchInProgress = false;
  int _webPageLoadProgress = 0;

  String get _subscriptionProductId => Platform.isIOS
      ? _iosSubscriptionProductId
      : _androidSubscriptionProductId;
  bool get _useIosDebugPurchaseFallback => Platform.isIOS && !kReleaseMode;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_initAppLinks());
    unawaited(_initIAP());
    unawaited(_initLocalNotifications());
    unawaited(_initWebView());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || !_externalAuthInProgress) {
      return;
    }

    unawaited(_resetAuthLoadingAfterCancelledHandoff());
  }

  @override
  void didChangeMetrics() {
    super.didChangeMetrics();
    unawaited(_syncWebAppContext());
  }

  Future<void> _initAppLinks() async {
    try {
      final initialUri = await _appLinks.getInitialLink();
      if (initialUri != null) {
        _handleIncomingAppUri(initialUri);
      }

      _appLinkSubscription = _appLinks.uriLinkStream.listen(
        (uri) => unawaited(_handleIncomingAppUri(uri)),
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
    final controller =
        WebViewController(
            onPermissionRequest: (request) =>
                unawaited(_handleWebViewPermissionRequest(request)),
          )
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
          onPageStarted: _handlePageStarted,
          onProgress: _handleLoadProgress,
          onPageFinished: _handlePageFinished,
          onWebResourceError: (WebResourceError error) {
            debugPrint('WebView error: ${error.description}');
            if (mounted) {
              setState(() {
                _isWebPageLoading = false;
                _webPageLoadProgress = 0;
              });
            }
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
      ..addJavaScriptChannel(
        'HapticBridge',
        onMessageReceived: _onHapticMessage,
      )
      ..addJavaScriptChannel('AuthBridge', onMessageReceived: _onAuthMessage)
      ..addJavaScriptChannel('ShareBridge', onMessageReceived: _onShareMessage)
      ..loadRequest(Uri.parse(MainWebView.targetUrl));

    setState(() {
      _controller = controller;
    });
    await _consumePendingAuthCallback();
    await _consumePendingAppOpenUri();
  }

  Future<void> _handleWebViewPermissionRequest(
    WebViewPermissionRequest request,
  ) async {
    try {
      final isMicrophoneOnly =
          request.types.length == 1 &&
          request.types.contains(WebViewPermissionResourceType.microphone);

      if (!isMicrophoneOnly) {
        await request.deny();
        return;
      }

      final isGranted = await _requestMicrophonePermission();
      if (!isGranted) {
        await request.deny();
        return;
      }

      await request.grant();
    } catch (e, stack) {
      debugPrint('WebView permission request error: $e');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          stack,
          reason: 'WebView permission request error',
        ),
      );
      try {
        await request.deny();
      } catch (_) {
        // The platform permission request may already be completed.
      }
    }
  }

  Future<bool> _requestMicrophonePermission() async {
    if (!Platform.isAndroid) return true;

    try {
      return await _permissionsChannel.invokeMethod<bool>(
            'requestMicrophone',
          ) ??
          false;
    } on PlatformException catch (e, stack) {
      debugPrint('Microphone permission request error: ${e.message}');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          stack,
          reason: 'Microphone permission request error',
        ),
      );
      return false;
    }
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
    await _withWebInputBlocked(
      () => showDialog<void>(
        context: context,
        barrierColor: Colors.black.withValues(alpha: 0.42),
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
      ),
    );
  }

  Future<bool> _showAppConfirmDialog({required String message}) async {
    final result = await _withWebInputBlocked(
      () => showDialog<bool>(
        context: context,
        barrierColor: Colors.black.withValues(alpha: 0.42),
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
      final result = await _withWebInputBlocked(
        () => showDialog<String>(
          context: context,
          barrierColor: Colors.black.withValues(alpha: 0.42),
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
        ),
      );
      return result ?? '';
    } finally {
      inputController.dispose();
    }
  }

  Future<T?> _withWebInputBlocked<T>(Future<T?> Function() action) async {
    if (mounted) {
      setState(() {
        _isNativeDialogVisible = true;
      });
    }

    try {
      return await action();
    } finally {
      await Future<void>.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        setState(() {
          _isNativeDialogVisible = false;
        });
      }
    }
  }

  NavigationDecision _handleNavigationRequest(NavigationRequest request) {
    final uri = Uri.tryParse(request.url);
    if (uri == null) return NavigationDecision.navigate;

    if (_isAuthCallbackUri(uri)) {
      _handleIncomingAppUri(uri);
      return NavigationDecision.prevent;
    }

    if (_isAppOpenUri(uri)) {
      _handleIncomingAppUri(uri);
      return NavigationDecision.prevent;
    }

    if (_shouldOpenExternally(uri)) {
      unawaited(_launchExternalUrl(uri));
      return NavigationDecision.prevent;
    }

    return NavigationDecision.navigate;
  }

  void _handlePageStarted(String url) {
    if (!mounted) return;

    setState(() {
      _isWebPageLoading = true;
      _webPageLoadProgress = 0;
    });
  }

  void _handleLoadProgress(int progress) {
    if (!mounted) return;

    setState(() {
      _isWebPageLoading = progress < 100;
      _webPageLoadProgress = progress.clamp(0, 100);
    });
  }

  void _handlePageFinished(String url) {
    unawaited(_syncWebAppContext());

    final uri = Uri.tryParse(url);
    final shouldShowLogin =
        uri != null &&
        uri.host == Uri.parse(MainWebView.targetUrl).host &&
        uri.path == '/login' &&
        _nativeCapabilities.supportsScreen('login');

    if (mounted) {
      setState(() {
        _isWebPageLoading = false;
        _webPageLoadProgress = 100;
        _showNativeLogin = shouldShowLogin;
        _hasRenderedFirstPage = true;
      });
    }
  }

  Future<void> _syncWebAppContext() async {
    final controller = _controller;
    if (controller == null || !mounted) return;

    final padding = MediaQuery.viewPaddingOf(context);
    final topInset = padding.top.toStringAsFixed(1);
    final bottomInset = padding.bottom.toStringAsFixed(1);
    final platform = Platform.isIOS
        ? 'ios'
        : Platform.isAndroid
        ? 'android'
        : 'other';
    final packageInfo = _packageInfo ??= await PackageInfo.fromPlatform();
    final nativeAppInfoJs = jsonEncode({
      'platform': platform,
      'version': packageInfo.version,
      'buildNumber': packageInfo.buildNumber,
      'packageName': packageInfo.packageName,
      'appName': packageInfo.appName,
    });

    final nativeCapabilitiesJs = _nativeCapabilities
        .toJavaScriptObjectLiteral();

    await controller.runJavaScript('''
      (function() {
        const root = document.documentElement;
        if (!root) return;
        root.dataset.nativePlatform = '$platform';
        root.dataset.nativeAppVersion = '${packageInfo.version}';
        root.dataset.nativeAppBuildNumber = '${packageInfo.buildNumber}';
        root.style.setProperty('--native-safe-area-top', '${topInset}px');
        root.style.setProperty('--native-safe-area-bottom', '${bottomInset}px');
        window.__nativeCapabilities = $nativeCapabilitiesJs;
        window.__nativeAppInfo = $nativeAppInfoJs;

        if (!window.__nativeDialogTapGuard) {
          const guard = {
            activeUntil: 0,
            block(ms) {
              this.activeUntil = Math.max(this.activeUntil, Date.now() + ms);
            },
            isActive() {
              return Date.now() <= this.activeUntil;
            }
          };
          window.__nativeDialogTapGuard = guard;

          ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click'].forEach((eventName) => {
            document.addEventListener(eventName, (event) => {
              if (!guard.isActive()) return;
              event.preventDefault();
              event.stopImmediatePropagation();
            }, true);
          });

          ['alert', 'confirm', 'prompt'].forEach((name) => {
            const original = window[name];
            if (typeof original !== 'function' || original.__nativeGuardWrapped) return;
            const wrapped = function(...args) {
              guard.block(2500);
              try {
                return original.apply(this, args);
              } finally {
                guard.block(900);
              }
            };
            wrapped.__nativeGuardWrapped = true;
            window[name] = wrapped;
          });
        }
      })();
    ''');
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

    if (host == 'appleid.apple.com') {
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

  bool _isAppOpenUri(Uri uri) {
    return uri.scheme == 'gijilai' && uri.host == 'open';
  }

  Future<void> _handleIncomingAppUri(Uri uri) async {
    if (_isAuthCallbackUri(uri)) {
      _pendingAuthCallbackUri = uri;
      await _consumePendingAuthCallback();
      return;
    }

    if (_isAppOpenUri(uri)) {
      _pendingAppOpenUri = uri;
      await _consumePendingAppOpenUri();
    }
  }

  Future<void> _consumePendingAuthCallback() async {
    final uri = _pendingAuthCallbackUri;
    final controller = _controller;
    if (uri == null || controller == null) return;

    _pendingAuthCallbackUri = null;
    _externalAuthInProgress = false;
    final targetUri = Uri.parse(MainWebView.targetUrl);
    final webCallback = targetUri.replace(
      path: '/auth/callback',
      queryParameters: uri.queryParameters,
      fragment: null,
    );
    await controller.loadRequest(webCallback);
    if (mounted) {
      setState(() {
        _showNativeLogin = false;
        _authInProgress = false;
      });
    }
  }

  Future<void> _consumePendingAppOpenUri() async {
    final uri = _pendingAppOpenUri;
    final controller = _controller;
    if (uri == null || controller == null) return;

    _pendingAppOpenUri = null;
    final targetUri = Uri.parse(MainWebView.targetUrl);
    final rawPath = uri.queryParameters['path'] ?? '/';
    final pathUri = Uri.tryParse(rawPath);
    final safePath =
        pathUri != null &&
            pathUri.path.startsWith('/') &&
            !pathUri.path.startsWith('//')
        ? pathUri.path
        : '/';
    final webUri = targetUri.replace(
      path: safePath,
      queryParameters: pathUri != null && pathUri.queryParameters.isNotEmpty
          ? pathUri.queryParameters
          : null,
      fragment: null,
    );

    await controller.loadRequest(webUri);
    if (mounted) {
      setState(() {
        _showNativeLogin = false;
        _isWebPageLoading = true;
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

  _AndroidIntentUri _parseAndroidIntentUri(Uri uri) {
    final rawUri = uri.toString();
    const intentPrefix = 'intent://';
    const intentMarker = '#Intent;';
    final markerIndex = rawUri.indexOf(intentMarker);

    if (!rawUri.startsWith(intentPrefix) || markerIndex < 0) {
      return const _AndroidIntentUri(
        launchUri: null,
        browserFallbackUri: null,
        packageName: null,
      );
    }

    final dataPart = rawUri.substring(intentPrefix.length, markerIndex);
    final intentPart = rawUri.substring(markerIndex + intentMarker.length);
    String? scheme;
    String? browserFallbackUrl;
    String? packageName;

    for (final entry in intentPart.split(';')) {
      final separatorIndex = entry.indexOf('=');
      if (separatorIndex <= 0) continue;

      final key = entry.substring(0, separatorIndex);
      final value = entry.substring(separatorIndex + 1);
      if (key == 'scheme') {
        scheme = value;
      } else if (key == 'S.browser_fallback_url') {
        browserFallbackUrl = value;
      } else if (key == 'package') {
        packageName = value;
      }
    }

    final launchUri = scheme == null || scheme.isEmpty
        ? null
        : Uri.tryParse('$scheme://$dataPart');
    final browserFallbackUri =
        browserFallbackUrl == null || browserFallbackUrl.isEmpty
        ? null
        : Uri.tryParse(Uri.decodeComponent(browserFallbackUrl));

    return _AndroidIntentUri(
      launchUri: launchUri,
      browserFallbackUri: browserFallbackUri,
      packageName: packageName,
    );
  }

  Future<bool> _tryLaunchExternalUri(Uri uri) async {
    try {
      final browserMode = uri.scheme == 'http' || uri.scheme == 'https'
          ? LaunchMode.inAppBrowserView
          : LaunchMode.externalApplication;
      var launched = await launchUrl(uri, mode: browserMode);
      if (!launched && browserMode != LaunchMode.externalApplication) {
        launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      return launched;
    } catch (e) {
      debugPrint('External URL candidate launch failed: $e');
      return false;
    }
  }

  Future<bool> _launchAndroidIntentUri(Uri uri) async {
    final intentUri = _parseAndroidIntentUri(uri);

    final launchUri = intentUri.launchUri;
    if (launchUri != null && await _tryLaunchExternalUri(launchUri)) {
      return true;
    }

    final browserFallbackUri = intentUri.browserFallbackUri;
    if (browserFallbackUri != null &&
        await _tryLaunchExternalUri(browserFallbackUri)) {
      return true;
    }

    final packageName = intentUri.packageName;
    if (packageName != null && packageName.isNotEmpty) {
      final marketUri = Uri.parse('market://details?id=$packageName');
      if (await _tryLaunchExternalUri(marketUri)) return true;

      final playStoreUri = Uri.https('play.google.com', '/store/apps/details', {
        'id': packageName,
      });
      if (await _tryLaunchExternalUri(playStoreUri)) return true;
    }

    return false;
  }

  Future<bool> _launchExternalUrl(Uri uri) async {
    try {
      final scheme = uri.scheme.toLowerCase();
      final launched = Platform.isAndroid && scheme == 'intent'
          ? await _launchAndroidIntentUri(uri)
          : await _tryLaunchExternalUri(uri);
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

    if (await _startOAuthThroughWebAuth(provider, attempts: 8)) {
      _externalAuthInProgress = true;
      return;
    }

    debugPrint('Web OAuth handoff hook was not ready.');
    await _finishCancelledAuthHandoff(showMessage: true);
  }

  Future<bool> _startOAuthThroughWebAuth(
    String provider, {
    int attempts = 1,
  }) async {
    final controller = _controller;
    if (controller == null) return false;

    for (var attempt = 0; attempt < attempts; attempt += 1) {
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
        if (result == 'started') return true;
      } catch (e) {
        debugPrint('Web OAuth handoff unavailable: $e');
      }

      if (attempt < attempts - 1) {
        await Future<void>.delayed(const Duration(milliseconds: 250));
      }
    }

    return false;
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

  Future<void> _startAppleNativeLogin() async {
    if (_authInProgress) return;

    if (!Platform.isIOS) {
      await _startNativeOAuth('apple');
      return;
    }

    setState(() {
      _authInProgress = true;
    });

    try {
      final rawNonce = _generateNonce();
      final hashedNonce = sha256.convert(utf8.encode(rawNonce)).toString();

      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: hashedNonce,
      );

      final identityToken = credential.identityToken;
      if (identityToken == null || identityToken.isEmpty) {
        debugPrint('Apple identity token missing. Falling back to OAuth.');
        if (mounted) {
          setState(() {
            _authInProgress = false;
          });
        }
        _externalAuthInProgress = false;
        await _startNativeOAuth('apple');
        return;
      }

      await _completeNativeSession(
        provider: 'apple',
        idToken: identityToken,
        nonce: rawNonce,
      );
    } catch (e) {
      debugPrint('Apple native login error: $e');
      _externalAuthInProgress = false;
      if (mounted) {
        setState(() {
          _authInProgress = false;
        });
      }
      _showSnackBar('Apple 로그인을 완료할 수 없습니다', isError: true);
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'Apple native login error',
        ),
      );
    }
  }

  Future<void> _startGoogleNativeLogin() async {
    if (_authInProgress) return;
    setState(() {
      _authInProgress = true;
    });

    try {
      if (Platform.isAndroid && _googleWebClientId.isEmpty) {
        debugPrint(
          'Google native login skipped: GOOGLE_WEB_CLIENT_ID is not configured.',
        );
        FirebaseCrashlytics.instance.log(
          'Google native login skipped: GOOGLE_WEB_CLIENT_ID is not configured.',
        );
        if (mounted) {
          setState(() {
            _authInProgress = false;
          });
        }
        _externalAuthInProgress = false;
        await _startNativeOAuth('google');
        return;
      }

      final googleSignIn = GoogleSignIn(
        scopes: const ['email', 'profile', 'openid'],
        clientId: Platform.isIOS && _googleIosClientId.isNotEmpty
            ? _googleIosClientId
            : null,
        serverClientId: _googleWebClientId.isEmpty ? null : _googleWebClientId,
      );

      final account = await googleSignIn.signIn();
      if (account == null) {
        await _finishCancelledAuthHandoff();
        return;
      }

      final authentication = await account.authentication;
      final idToken = authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        debugPrint('Google ID token missing. Falling back to OAuth.');
        try {
          await googleSignIn.signOut();
        } catch (_) {}
        if (mounted) {
          setState(() {
            _authInProgress = false;
          });
        }
        _externalAuthInProgress = false;
        await _startNativeOAuth('google');
        return;
      }

      await _completeNativeSession(
        provider: 'google',
        idToken: idToken,
        accessToken: authentication.accessToken,
      );
    } catch (e) {
      debugPrint('Google native login error: $e');
      if (mounted) {
        setState(() {
          _authInProgress = false;
        });
      }
      _externalAuthInProgress = false;
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'Google native login error',
        ),
      );
      await _startNativeOAuth('google');
    }
  }

  Future<void> _completeNativeSession({
    required String provider,
    required String idToken,
    String? accessToken,
    String? nonce,
  }) async {
    final payload = jsonEncode({
      'provider': provider,
      'idToken': idToken,
      if (accessToken != null && accessToken.isNotEmpty)
        'accessToken': accessToken,
      if (nonce != null && nonce.isNotEmpty) 'nonce': nonce,
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

  String _generateNonce({int length = 32}) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(
      length,
      (_) => charset[random.nextInt(charset.length)],
    ).join();
  }

  Future<void> _resetAuthLoadingAfterCancelledHandoff() async {
    await Future<void>.delayed(const Duration(seconds: 2));
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
    try {
      // 구매 결과를 놓치지 않도록 store availability 확인 전에 stream을 먼저 연결한다.
      _purchaseSubscription ??= _iap.purchaseStream.listen(
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

      final available = await _iap.isAvailable();
      debugPrint(
        'IAP init: storeAvailable=$available, platform=${Platform.operatingSystem}',
      );
      if (!available) {
        debugPrint('IAP not available');
        FirebaseCrashlytics.instance.log('IAP not available on current device');
        return;
      }

      // 상품 정보 로드
      final response = await _iap.queryProductDetails({_subscriptionProductId});
      debugPrint(
        'IAP init product query: '
        'productId=$_subscriptionProductId, '
        'count=${response.productDetails.length}, '
        'notFoundIDs=${response.notFoundIDs.join(",")}, '
        'error=${response.error?.code ?? "none"}:${response.error?.message ?? "none"}',
      );
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
          Exception(
            'IAP products not found: ${response.notFoundIDs.join(",")}',
          ),
          StackTrace.current,
        );
      }
    } catch (e) {
      debugPrint('IAP init error: $e');
      await FirebaseCrashlytics.instance.recordError(
        e,
        StackTrace.current,
        reason: 'IAP init error',
      );
    }
  }

  void _onPaymentMessage(JavaScriptMessage message) {
    try {
      final data = jsonDecode(message.message);
      if (data['type'] == 'PAYMENT_REQUEST') {
        unawaited(_startPurchase());
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

  void _onHapticMessage(JavaScriptMessage message) {
    try {
      final data = jsonDecode(message.message) as Map<String, dynamic>;
      final type = data['type']?.toString() ?? 'impact';
      final style = data['style']?.toString();
      unawaited(_performHapticFeedback(type: type, style: style));
    } catch (e) {
      debugPrint('HapticBridge parse error: $e');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'HapticBridge parse error',
        ),
      );
    }
  }

  Future<void> _performHapticFeedback({
    required String type,
    String? style,
  }) async {
    try {
      switch (type) {
        case 'selection':
          await HapticFeedback.selectionClick();
          return;
        case 'vibrate':
          await HapticFeedback.vibrate();
          return;
        case 'impact':
        default:
          switch (style) {
            case 'heavy':
              await HapticFeedback.heavyImpact();
              return;
            case 'medium':
              await HapticFeedback.mediumImpact();
              return;
            case 'light':
            default:
              await HapticFeedback.lightImpact();
              return;
          }
      }
    } catch (e) {
      debugPrint('Haptic feedback error: $e');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'Haptic feedback error',
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
      final activePracticeCount = (data['activePracticeCount'] as num?)
          ?.toInt();
      final title = data['title']?.toString();
      final body = data['body']?.toString();
      final userInitiated = data['userInitiated'] == true;
      final shouldSchedule =
          enabled && (activePracticeCount == null || activePracticeCount > 0);

      await _schedulePracticeReminder(
        enabled: shouldSchedule,
        time: time,
        title: title,
        body: body,
        storedEnabled: enabled,
        showFeedback: userInitiated,
      );
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
    String? title,
    String? body,
    bool? storedEnabled,
    bool persist = true,
    bool requestPermission = true,
    bool showFeedback = true,
  }) async {
    if (persist) {
      await _savePracticeReminderSettings(
        enabled: storedEnabled ?? enabled,
        time: time,
        title: title,
        body: body,
      );
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

    final notificationTitle = title?.trim().isNotEmpty == true
        ? title!.trim()
        : '오늘의 실천을 떠올려볼 시간이에요';
    final notificationBody = body?.trim().isNotEmpty == true
        ? body!.trim()
        : '짧게 체크하고 다음 상담에 쓸 변화를 남겨보세요.';

    await _localNotifications.zonedSchedule(
      _practiceReminderNotificationId,
      notificationTitle,
      notificationBody,
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
    String? title,
    String? body,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_practiceReminderEnabledKey, enabled);
    await prefs.setString(_practiceReminderTimeKey, time);
    if (title != null) {
      await prefs.setString(_practiceReminderTitleKey, title);
    }
    if (body != null) {
      await prefs.setString(_practiceReminderBodyKey, body);
    }
  }

  Future<void> _restorePracticeReminder() async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool(_practiceReminderEnabledKey) ?? false;
    final time = prefs.getString(_practiceReminderTimeKey) ?? '20:00';
    final title = prefs.getString(_practiceReminderTitleKey);
    final body = prefs.getString(_practiceReminderBodyKey);

    if (!enabled) return;

    final pending = await _localNotifications.pendingNotificationRequests();
    final alreadyScheduled = pending.any(
      (notification) => notification.id == _practiceReminderNotificationId,
    );
    if (alreadyScheduled) return;

    await _schedulePracticeReminder(
      enabled: true,
      time: time,
      title: title,
      body: body,
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
    if (_iapLaunchInProgress) {
      debugPrint('IAP purchase ignored: launch already in progress');
      FirebaseCrashlytics.instance.log(
        'IAP purchase ignored: launch already in progress',
      );
      _notifyWebLoadingDone();
      return;
    }

    _iapLaunchInProgress = true;
    try {
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
        _finishIapPurchaseFlow();
        return;
      }

      final response = await _iap.queryProductDetails({_subscriptionProductId});
      debugPrint(
        'IAP purchase product query: '
        'productId=$_subscriptionProductId, '
        'count=${response.productDetails.length}, '
        'notFoundIDs=${response.notFoundIDs.join(",")}, '
        'error=${response.error?.code ?? "none"}:${response.error?.message ?? "none"}',
      );
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
        if (_useIosDebugPurchaseFallback) {
          await _runIosDebugPurchaseFallback();
          return;
        }
        _showSnackBar('상품 정보를 찾을 수 없습니다', isError: true);
        _finishIapPurchaseFlow();
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
        _finishIapPurchaseFlow();
      }
    } catch (e) {
      debugPrint('IAP purchase flow error: $e');
      unawaited(
        FirebaseCrashlytics.instance.recordError(
          e,
          StackTrace.current,
          reason: 'IAP purchase flow error',
        ),
      );
      _showSnackBar('결제를 시작할 수 없습니다', isError: true);
      _finishIapPurchaseFlow();
    }
  }

  Future<void> _runIosDebugPurchaseFallback() async {
    final action = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('시뮬레이터 결제 테스트'),
          content: const Text('로컬 StoreKit 상품 조회가 비어 시뮬레이터 테스트 모드로 전환합니다.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop('cancel'),
              child: const Text('취소'),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop('fail'),
              child: const Text('실패'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop('success'),
              child: const Text('성공'),
            ),
          ],
        );
      },
    );

    switch (action) {
      case 'success':
        _showSnackBar('시뮬레이터 결제 테스트 성공');
        break;
      case 'fail':
        _showSnackBar('시뮬레이터 결제 테스트 실패', isError: true);
        break;
      default:
        break;
    }

    _finishIapPurchaseFlow();
  }

  void _onPurchaseUpdated(List<PurchaseDetails> purchases) {
    for (final purchase in purchases) {
      switch (purchase.status) {
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          unawaited(_verifyAndDeliver(purchase));
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
          _finishIapPurchaseFlow();
          if (purchase.pendingCompletePurchase) {
            unawaited(_iap.completePurchase(purchase));
          }
          break;
        case PurchaseStatus.canceled:
          _finishIapPurchaseFlow();
          break;
        case PurchaseStatus.pending:
          debugPrint('IAP purchase pending...');
          break;
      }
    }
  }

  Future<void> _verifyAndDeliver(PurchaseDetails purchase) async {
    var shouldCompletePurchase = false;
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
        _finishIapPurchaseFlow();
        return;
      }

      // JSON 파싱 — runJavaScriptReturningResult가 문자열을 따옴표로 감싸서 반환
      String jsonStr = resultJson;
      if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
        jsonStr = jsonDecode(jsonStr) as String;
      }
      final data = jsonDecode(jsonStr) as Map<String, dynamic>;

      if (data['success'] == true) {
        shouldCompletePurchase = true;
        _showSnackBar('구독이 시작되었습니다!');
        await _controller!.runJavaScript(
          'window.__iapPaymentCompleted && window.__iapPaymentCompleted();',
        );
        // WebView 새로고침으로 구독 상태 반영
        await _controller!.loadRequest(Uri.parse(MainWebView.targetUrl));
      } else {
        final errorCode = data['error']?.toString();
        final errorMessage = errorCode == 'IAP_SERVER_MISCONFIGURED'
            ? '결제 검증 설정에 문제가 있습니다. 잠시 후 다시 시도해주세요.'
            : errorCode ?? '검증 실패';
        _showSnackBar(errorMessage, isError: true);
        _finishIapPurchaseFlow();
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
      _finishIapPurchaseFlow();
    } finally {
      _iapLaunchInProgress = false;
      if (shouldCompletePurchase && purchase.pendingCompletePurchase) {
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

  void _finishIapPurchaseFlow() {
    _iapLaunchInProgress = false;
    _notifyWebLoadingDone();
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
    final topInset = Platform.isAndroid
        ? 0.0
        : MediaQuery.viewPaddingOf(context).top;
    if (controller == null) {
      return const Scaffold(
        backgroundColor: Color(0xFFF9F8F6),
        body: _AppSplashScreen(),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, dynamic result) async {
        if (didPop) return;
        await _handleBackPressed(controller);
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF9F8F6),
        body: Stack(
          children: [
            Positioned(
              top: topInset,
              left: 0,
              right: 0,
              bottom: 0,
              child: Offstage(
                offstage: _showNativeLogin,
                child: AbsorbPointer(
                  absorbing: _isNativeDialogVisible,
                  child: WebViewWidget(controller: controller),
                ),
              ),
            ),
            if (_showNativeLogin)
              NativeLoginScreen(
                isLoading: _authInProgress,
                onKakaoPressed: _startKakaoNativeLogin,
                onApplePressed: _startAppleNativeLogin,
                onGooglePressed: _startGoogleNativeLogin,
                onEmailPressed: () {
                  setState(() {
                    _showNativeLogin = false;
                  });
                },
              ),
            Positioned(
              top: topInset,
              left: 0,
              right: 0,
              child: _WebLoadProgressBar(
                visible: _hasRenderedFirstPage && _isWebPageLoading,
                progress: _webPageLoadProgress,
              ),
            ),
            Positioned.fill(
              child: IgnorePointer(
                ignoring: _hasRenderedFirstPage,
                child: AnimatedOpacity(
                  opacity: _hasRenderedFirstPage ? 0 : 1,
                  duration: const Duration(milliseconds: 320),
                  curve: Curves.easeOutCubic,
                  child: const _AppSplashScreen(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WebLoadProgressBar extends StatelessWidget {
  const _WebLoadProgressBar({required this.visible, required this.progress});

  final bool visible;
  final int progress;

  @override
  Widget build(BuildContext context) {
    final normalizedProgress = progress <= 0
        ? 0.08
        : (progress.clamp(8, 100) / 100).toDouble();

    return IgnorePointer(
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOutCubic,
        child: SizedBox(
          height: 3,
          child: LinearProgressIndicator(
            value: normalizedProgress,
            minHeight: 3,
            backgroundColor: const Color(0xFFE8E4D9),
            valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF2F4F3E)),
          ),
        ),
      ),
    );
  }
}

class _AppSplashScreen extends StatelessWidget {
  const _AppSplashScreen();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(color: Color(0xFFF9F8F6)),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            children: [
              const Spacer(flex: 3),
              Container(
                width: 112,
                height: 112,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(32),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2F4F3E).withValues(alpha: 0.14),
                      blurRadius: 34,
                      offset: const Offset(0, 18),
                    ),
                  ],
                ),
                child: Image.asset(
                  'assets/gijilai_icon.png',
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 26),
              const Text(
                '기질아이',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFF2F4F3E),
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '아이를 이해하는 따뜻한 시작',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFF6E7A75),
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0,
                ),
              ),
              const SizedBox(height: 42),
              SizedBox(
                width: 132,
                height: 4,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: const Color(0xFF2F4F3E).withValues(alpha: 0.10),
                    ),
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0.18, end: 0.82),
                      duration: const Duration(milliseconds: 1200),
                      curve: Curves.easeOutCubic,
                      builder: (context, value, child) {
                        return Align(
                          alignment: Alignment.centerLeft,
                          child: FractionallySizedBox(
                            widthFactor: value,
                            heightFactor: 1,
                            child: child,
                          ),
                        );
                      },
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: const Color(0xFFE5A150),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const Spacer(flex: 4),
            ],
          ),
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
  static const _textSub = Color(0xFF6E7A75);

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFFFBFAF6),
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.18),
              blurRadius: 30,
              offset: const Offset(0, 16),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: _primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.info_outline_rounded,
                      color: _primary,
                      size: 21,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        message,
                        style: const TextStyle(
                          color: _textMain,
                          fontSize: 16,
                          height: 1.38,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              if (content != null) ...[
                const SizedBox(height: 16),
                DefaultTextStyle.merge(
                  style: const TextStyle(color: _textSub),
                  child: content!,
                ),
              ],
              const SizedBox(height: 18),
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
      height: 46,
      child: FilledButton(
        onPressed: () {
          unawaited(HapticFeedback.lightImpact());
          onPressed();
        },
        style: FilledButton.styleFrom(
          backgroundColor: isPrimary ? _primary : const Color(0xFFF0EDE5),
          foregroundColor: isPrimary ? Colors.white : _textSub,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 14,
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
    required this.onApplePressed,
    required this.onGooglePressed,
    required this.onEmailPressed,
  });

  final bool isLoading;
  final VoidCallback onKakaoPressed;
  final VoidCallback onApplePressed;
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
                label: 'Apple로 계속하기',
                backgroundColor: const Color(0xFF111111),
                foregroundColor: Colors.white,
                enabled: !isLoading,
                icon: const Icon(Icons.apple, size: 20, color: Colors.white),
                onPressed: onApplePressed,
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
                onPressed: isLoading
                    ? null
                    : () {
                        unawaited(HapticFeedback.lightImpact());
                        onEmailPressed();
                      },
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
        onPressed: enabled
            ? () {
                unawaited(HapticFeedback.lightImpact());
                onPressed();
              }
            : null,
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
