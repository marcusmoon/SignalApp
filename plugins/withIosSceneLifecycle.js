const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

const SCENE_DELEGATE_MARKER = '// SIGNAL_SCENE_DELEGATE_V2';

const sceneConfigurationMethod = `#if os(iOS) || os(tvOS)
  public func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
#endif
`;

const sceneDelegateClass = `class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  ${SCENE_DELEGATE_MARKER}
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

    for userActivity in connectionOptions.userActivities {
      self.scene(scene, continue: userActivity)
    }
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    window = nil
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    ExpoAppDelegateSubscriberManager.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    ExpoAppDelegateSubscriberManager.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    ExpoAppDelegateSubscriberManager.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    ExpoAppDelegateSubscriberManager.applicationDidEnterBackground(UIApplication.shared)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    for urlContext in URLContexts {
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

function removeLegacySceneDelegate(contents) {
  return contents.replace(/\nclass SceneDelegate:[\s\S]*?\n}\n(?=\nclass ReactNativeDelegate)/, '\n');
}

function normalizeSceneConfigurationMethod(contents) {
  return contents.replace(
    /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*public override func application\(\s*\n\s*_ application: UIApplication,\s*\n\s*configurationForConnecting[\s\S]*?\n#endif\s*\n\s*\/\/ Linking API/,
    `${sceneConfigurationMethod}\n\n  // Linking API`,
  ).replace(
    /\n\s*public override func application\(\s*\n\s*_ application: UIApplication,\s*\n\s*configurationForConnecting[\s\S]*?\n\s*}\n\n\s*\/\/ Linking API/,
    `\n${sceneConfigurationMethod}\n\n  // Linking API`,
  ).replace(
    /\n\s*public func application\(\s*\n\s*_ application: UIApplication,\s*\n\s*configurationForConnecting[\s\S]*?\n\s*}\n\n\s*\/\/ Linking API/,
    `\n${sceneConfigurationMethod}\n\n  // Linking API`,
  );
}

function patchAppDelegate(contents) {
  if (contents.includes(SCENE_DELEGATE_MARKER)) {
    return contents;
  }

  let nextContents = contents;

  if (nextContents.includes('class SceneDelegate:')) {
    nextContents = removeLegacySceneDelegate(nextContents);
  }

  const startupBlockPattern =
    /#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*?factory\.startReactNative\([\s\S]*?launchOptions: launchOptions\)\n#endif/;

  if (startupBlockPattern.test(nextContents)) {
    nextContents = nextContents.replace(
      startupBlockPattern,
      '#if os(iOS) || os(tvOS)\n    // React Native starts in SceneDelegate (required for iOS 27 SDK).\n#endif',
    );
  } else if (!nextContents.includes('React Native starts in SceneDelegate')) {
    throw new Error(
      'Could not find the Expo AppDelegate React Native startup block to patch for UIScene lifecycle.',
    );
  } else {
    nextContents = nextContents.replace(
      '// React Native starts in SceneDelegate (required for latest iOS SDK).',
      '// React Native starts in SceneDelegate (required for iOS 27 SDK).',
    );
  }

  if (!nextContents.includes('configurationForConnecting connectingSceneSession')) {
    const linkingMarker = '\n  // Linking API';

    if (!nextContents.includes(linkingMarker)) {
      throw new Error('Could not find the AppDelegate linking section to insert the UIScene configuration method.');
    }

    nextContents = nextContents.replace(linkingMarker, `\n${sceneConfigurationMethod}\n\n  // Linking API`);
  } else {
    nextContents = normalizeSceneConfigurationMethod(nextContents);
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
 * iOS 27 SDK requires UIScene lifecycle (Apple TN3187).
 * Remove when published Expo npm ships ExpoAppSceneDelegate in the prebuild template.
 */
module.exports = function withIosSceneLifecycle(config) {
  return addAppDelegateSceneLifecycle(addInfoPlistSceneManifest(config));
};
