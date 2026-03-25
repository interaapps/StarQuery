const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('node:path');

const iconBasePath = path.resolve(__dirname, 'images', 'icon');
const pngIconPath = path.resolve(__dirname, 'images', 'icon.png');
const icoIconPath = path.resolve(__dirname, 'images', 'icon.ico');
const msixAssetsPath = path.resolve(__dirname, 'images', 'msix-assets');
const isDarwin = process.platform === 'darwin';

function readBooleanEnv(name, fallback = false) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function buildMsixMakerConfig() {
  const minOsVersion =
    process.env.STARQUERY_MSIX_MIN_OS_VERSION || '10.0.19041.0';
  const maxOsVersionTested =
    process.env.STARQUERY_MSIX_MAX_OS_VERSION_TESTED || minOsVersion;

  const config = {
    sign: readBooleanEnv('STARQUERY_MSIX_SIGN', false),
    logLevel: process.env.STARQUERY_MSIX_LOG_LEVEL || 'warn',
    packageAssets: msixAssetsPath,
    manifestVariables: {
      publisher: process.env.STARQUERY_MSIX_PUBLISHER || 'CN=StarQuery',
      publisherDisplayName:
        process.env.STARQUERY_MSIX_PUBLISHER_DISPLAY_NAME || 'StarQuery',
      packageIdentity:
        process.env.STARQUERY_MSIX_IDENTITY_NAME || 'InteraApps.StarQuery',
      packageDisplayName:
        process.env.STARQUERY_MSIX_PACKAGE_DISPLAY_NAME || 'StarQuery',
      appDisplayName:
        process.env.STARQUERY_MSIX_APP_DISPLAY_NAME || 'StarQuery',
      packageBackgroundColor:
        process.env.STARQUERY_MSIX_BACKGROUND_COLOR || '#101828',
      packageMinOSVersion: minOsVersion,
      packageMaxOSVersionTested: maxOsVersionTested,
    },
  };

  if (process.env.STARQUERY_MSIX_WINDOWS_KIT_VERSION) {
    config.windowsKitVersion = process.env.STARQUERY_MSIX_WINDOWS_KIT_VERSION;
  }

  if (process.env.STARQUERY_MSIX_WINDOWS_KIT_PATH) {
    config.windowsKitPath = process.env.STARQUERY_MSIX_WINDOWS_KIT_PATH;
  }

  return config;
}

function buildMacSignConfig() {
  if (!isDarwin || !readBooleanEnv('STARQUERY_MAC_SIGN', false)) {
    return undefined;
  }

  const config = {
    hardenedRuntime: true,
    gatekeeperAssess: false,
  };

  const identity = process.env.APPLE_SIGN_IDENTITY || process.env.CSC_NAME;
  if (identity) {
    config.identity = identity;
  }

  return config;
}

function buildMacNotarizeConfig() {
  if (!isDarwin || !readBooleanEnv('STARQUERY_MAC_NOTARIZE', false)) {
    return undefined;
  }

  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;

  if (appleApiKey && appleApiKeyId && appleApiIssuer) {
    return {
      appleApiKey,
      appleApiKeyId,
      appleApiIssuer,
    };
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword =
    process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (appleId && appleIdPassword && teamId) {
    return {
      appleId,
      appleIdPassword,
      teamId,
    };
  }

  return undefined;
}

const macSignConfig = buildMacSignConfig();
const macNotarizeConfig = buildMacNotarizeConfig();

module.exports = {
  packagerConfig: {
    icon: iconBasePath,
    asar: true,
    appBundleId: process.env.STARQUERY_MAC_BUNDLE_ID || 'com.interaapps.starquery',
    appCategoryType:
      process.env.STARQUERY_MAC_APP_CATEGORY || 'public.app-category.developer-tools',
    ...(macSignConfig ? { osxSign: macSignConfig } : {}),
    ...(macNotarizeConfig ? { osxNotarize: macNotarizeConfig } : {}),
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: icoIconPath,
      },
    },
    {
      name: '@electron-forge/maker-msix',
      config: buildMsixMakerConfig(),
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: pngIconPath,
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: pngIconPath,
        },
      },
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
