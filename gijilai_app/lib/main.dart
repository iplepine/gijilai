import 'package:flutter/material.dart';
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
  late final WebViewController _controller;

  // 웹뷰 연결 주소
  final String targetUrl = 'https://gijilai-web.vercel.app/'; 
  
  void _handlePaymentRequest(String message) {
    // TODO: 실제 in_app_purchase 연동
    // 현재는 결제 성공 시뮬레이션
    debugPrint('Payment Request Received: $message');
    
    // 2초 후 성공 응답 전송 시뮬레이션
    Future.delayed(const Duration(seconds: 2), () {
      _controller.runJavaScript('window.onPaymentComplete({ "status": "success" })');
    });
  }

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            // 로딩 바 업데이트를 여기에 구현할 수 있습니다.
          },
          onPageStarted: (String url) {},
          onPageFinished: (String url) {},
          onWebResourceError: (WebResourceError error) {},
          onNavigationRequest: (NavigationRequest request) {
            // 특정 URL 패턴 차단 등의 로직
            return NavigationDecision.navigate;
          },
        ),
      )
      ..addJavaScriptChannel(
        'PaymentBridge',
        onMessageReceived: (JavaScriptMessage message) {
          // 결제 요청 처리
          _handlePaymentRequest(message.message);
        },
      )
      ..loadRequest(Uri.parse(targetUrl));
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvoked: (bool didPop) async {
        if (didPop) return;
        
        final navigator = Navigator.of(context);
        if (await _controller.canGoBack()) {
          // 웹뷰 내 히스토리가 있다면 브라우저 뒤로가기 실행
          _controller.goBack();
        } else {
          // 뒤로 갈 히스토리가 더 없다면 (앱의 첫 화면) 종료할지 여부
          // 임시로 그냥 앱을 background로 내리거나 닫도록 허용
          navigator.pop();
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
