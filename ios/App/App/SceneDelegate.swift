import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        // Launched from a home-screen shortcut: hand it over once the web view
        // is up, as SceneDelegateProxy does for links on a cold start.
        if let item = connectionOptions.shortcutItem {
            var token: NSObjectProtocol?
            token = NotificationCenter.default.addObserver(forName: .capacitorViewDidAppear, object: nil, queue: .main) { [weak self] _ in
                if let token { NotificationCenter.default.removeObserver(token) }
                _ = self?.open(shortcut: item, in: scene)
            }
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(open(shortcut: shortcutItem, in: windowScene))
    }

    /// Home-screen shortcuts (UIApplicationShortcutItems in Info.plist) open a
    /// wheretopark.sg URL, delivered like a Universal Link so the web app's
    /// appUrlOpen listener (src/lib/deepLinks.ts) routes it.
    private func open(shortcut: UIApplicationShortcutItem, in scene: UIScene) -> Bool {
        let paths = [
            "sg.wheretopark.app.near-me": "/?open=near-me",
            "sg.wheretopark.app.saved": "/?open=saved",
        ]
        guard let path = paths[shortcut.type], let url = URL(string: "https://wheretopark.sg" + path) else { return false }
        let activity = NSUserActivity(activityType: NSUserActivityTypeBrowsingWeb)
        activity.webpageURL = url
        SceneDelegateProxy.shared.scene(scene, continue: activity)
        return true
    }
}
