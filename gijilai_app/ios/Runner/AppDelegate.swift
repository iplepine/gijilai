import Flutter
import Foundation
import UIKit
import app_links
#if DEBUG
import StoreKitTest
#endif

@main
@objc class AppDelegate: FlutterAppDelegate {
  #if DEBUG
  private var storeKitTestSession: SKTestSession?
  #endif

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    #if DEBUG
    #if targetEnvironment(simulator)
    configureLocalStoreKitSessionIfNeeded()
    #endif
    #endif

    GeneratedPluginRegistrant.register(with: self)

    if let url = AppLinks.shared.getLink(launchOptions: launchOptions) {
      AppLinks.shared.handleLink(url: url)
      return true
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  #if DEBUG
  #if targetEnvironment(simulator)
  private func configureLocalStoreKitSessionIfNeeded() {
    guard storeKitTestSession == nil else { return }

    do {
      let session = try SKTestSession(configurationFileNamed: "Configuration")
      session.resetToDefaultState()
      session.clearTransactions()
      session.disableDialogs = false
      storeKitTestSession = session
      NSLog("GIJILAI IAP: local StoreKit test session started")
    } catch {
      NSLog("GIJILAI IAP: failed to start local StoreKit test session: \(error)")
    }
  }
  #endif
  #endif
}
