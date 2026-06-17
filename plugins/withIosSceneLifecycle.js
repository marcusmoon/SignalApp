const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const sceneConfigurationMethod = `  public override func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
`;

const sceneDelegateClass = `class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory else {
      return
    }

    let nextWindow = UIWindow(windowScene: windowScene)
    nextWindow.backgroundColor = SignalLaunchBackground.color
    window = nextWindow
    appDelegate.window = nextWindow

    factory.startReactNative(
      withModuleName: "main",
      in: nextWindow,
      launchOptions: nil)

    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }

    if let userActivity = connectionOptions.userActivities.first {
      self.scene(scene, continue: userActivity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let urlContext = URLContexts.first,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: urlContext.options.openInPlace,
    ]

    if let sourceApplication = urlContext.options.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }

    if let annotation = urlContext.options.annotation {
      options[.annotation] = annotation
    }

    _ = appDelegate.application(UIApplication.shared, open: urlContext.url, options: options)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    _ = appDelegate.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }
}
`;

function addInfoPlistSceneManifest(config) {
  return withInfoPlist(config, (nextConfig) => {
    nextConfig.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };

    return nextConfig;
  });
}

function patchAppDelegate(contents) {
  if (contents.includes('class SceneDelegate: UIResponder, UIWindowSceneDelegate')) {
    return contents;
  }

  let nextContents = contents;

  const startupBlockPattern =
    /#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*?factory\.startReactNative\([\s\S]*?launchOptions: launchOptions\)\n#endif/;

  if (!startupBlockPattern.test(nextContents)) {
    throw new Error(
      'Could not find the Expo AppDelegate React Native startup block to patch for UIScene lifecycle.',
    );
  }

  nextContents = nextContents.replace(
    startupBlockPattern,
    '#if os(iOS) || os(tvOS)\n    // React Native starts in SceneDelegate (required for latest iOS SDK).\n#endif',
  );

  if (!nextContents.includes('configurationForConnecting connectingSceneSession')) {
    const linkingMarker = '\n  // Linking API';

    if (!nextContents.includes(linkingMarker)) {
      throw new Error('Could not find the AppDelegate linking section to insert the UIScene configuration method.');
    }

    nextContents = nextContents.replace(linkingMarker, `\n${sceneConfigurationMethod}\n  // Linking API`);
  }

  const reactNativeDelegateMarker = '\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate';

  if (!nextContents.includes(reactNativeDelegateMarker)) {
    throw new Error('Could not find ReactNativeDelegate to insert SceneDelegate.');
  }

  return nextContents.replace(reactNativeDelegateMarker, `\n${sceneDelegateClass}${reactNativeDelegateMarker}`);
}

function addAppDelegateSceneLifecycle(config) {
  return withAppDelegate(config, (nextConfig) => {
    if (nextConfig.modResults.language !== 'swift') {
      throw new Error(
        `Cannot apply iOS scene lifecycle plugin to ${nextConfig.modResults.language} AppDelegate. Swift is required.`,
      );
    }

    nextConfig.modResults.contents = patchAppDelegate(nextConfig.modResults.contents);
    return nextConfig;
  });
}

/**
 * Xcode 27 / iOS 27 SDK requires UIScene lifecycle (Apple TN3187).
 * Remove when expo-template-bare-minimum ships SceneDelegate natively.
 */
module.exports = function withIosSceneLifecycle(config) {
  return addAppDelegateSceneLifecycle(addInfoPlistSceneManifest(config));
};
