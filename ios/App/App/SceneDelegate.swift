import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CorkWillContainerViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// Keep the existing web layout inside the device's safe area. This prevents
// scrolled content from appearing underneath the Dynamic Island or home bar,
// without requiring a separate mobile implementation of CorkWill Log.
final class CorkWillContainerViewController: UIViewController {
    private let app = CAPBridgeViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 244.0 / 255, green: 239.0 / 255, blue: 231.0 / 255, alpha: 1)
        addChild(app)
        app.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(app.view)
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            app.view.topAnchor.constraint(equalTo: safe.topAnchor),
            app.view.bottomAnchor.constraint(equalTo: safe.bottomAnchor),
            app.view.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            app.view.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
        ])
        app.didMove(toParent: self)
    }

    override var childForStatusBarStyle: UIViewController? { app }
}
