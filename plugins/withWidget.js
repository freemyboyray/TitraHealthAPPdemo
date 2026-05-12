const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const WIDGET_NAME = 'TitraHealthWidget';
const WIDGET_BUNDLE_ID = 'com.titrahealth.app.widget';
const APP_GROUP = 'group.com.titrahealth.app';
const WIDGET_DIR = 'TitraHealthWidget';

/**
 * Expo config plugin that:
 * 1. Adds App Group entitlement to the main app
 * 2. Adds the WidgetKit extension target to the Xcode project
 */
const withWidget = (config) => {
  // Step 1: Add App Group to main app entitlements
  config = withEntitlementsPlist(config, (mod) => {
    const groups = mod.modResults['com.apple.security.application-groups'] || [];
    if (!groups.includes(APP_GROUP)) {
      groups.push(APP_GROUP);
    }
    mod.modResults['com.apple.security.application-groups'] = groups;
    return mod;
  });

  // Step 2: Add widget extension target to Xcode project
  config = withXcodeProject(config, (mod) => {
    const proj = mod.modResults;
    const platformProjectRoot = mod.modRequest.platformProjectRoot; // ios/
    const widgetSourceDir = path.join(platformProjectRoot, WIDGET_DIR);

    // Bail if widget target already exists
    const existingTargets = proj.pbxTargetByName(WIDGET_NAME);
    if (existingTargets) {
      return mod;
    }

    // --- Collect source files ---
    const swiftFiles = fs.readdirSync(widgetSourceDir).filter((f) => f.endsWith('.swift'));

    // --- Create the widget target ---
    const target = proj.addTarget(
      WIDGET_NAME,
      'app_extension',
      WIDGET_DIR,
      WIDGET_BUNDLE_ID
    );

    // --- Add source files to the target ---
    const groupKey = proj.pbxCreateGroup(WIDGET_NAME, `"${WIDGET_DIR}"`);
    const mainGroupKey = proj.getFirstProject().firstProject.mainGroup;
    proj.addToPbxGroup(groupKey, mainGroupKey);

    for (const file of swiftFiles) {
      proj.addSourceFile(
        path.join(WIDGET_DIR, file),
        { target: target.uuid },
        groupKey
      );
    }

    // --- Add Info.plist ---
    const infoPlistPath = path.join(WIDGET_DIR, 'Info.plist');
    proj.addFile(infoPlistPath, groupKey);

    // --- Add entitlements file ---
    const entitlementsPath = path.join(WIDGET_DIR, `${WIDGET_NAME}.entitlements`);
    proj.addFile(entitlementsPath, groupKey);

    // --- Configure build settings ---
    const targetConfigs = proj.pbxXCBuildConfigurationSection();
    for (const key in targetConfigs) {
      const config = targetConfigs[key];
      if (typeof config !== 'object' || !config.buildSettings) continue;

      const bs = config.buildSettings;
      if (bs.PRODUCT_BUNDLE_IDENTIFIER === `"${WIDGET_BUNDLE_ID}"` ||
          bs.PRODUCT_BUNDLE_IDENTIFIER === WIDGET_BUNDLE_ID) {
        // Apply widget-specific build settings
        bs.SWIFT_VERSION = '5.0';
        bs.TARGETED_DEVICE_FAMILY = '"1,2"';
        bs.INFOPLIST_FILE = `"${infoPlistPath}"`;
        bs.CODE_SIGN_ENTITLEMENTS = `"${entitlementsPath}"`;
        bs.CODE_SIGN_STYLE = 'Automatic';
        bs.IPHONEOS_DEPLOYMENT_TARGET = '17.0';
        bs.PRODUCT_NAME = `"$(TARGET_NAME)"`;
        bs.SKIP_INSTALL = 'YES';
        bs.SWIFT_EMIT_LOC_STRINGS = 'YES';
        bs.GENERATE_INFOPLIST_FILE = 'NO';
        bs.CURRENT_PROJECT_VERSION = '1';
        bs.MARKETING_VERSION = '1.0';
        // Link WidgetKit and SwiftUI frameworks
        bs.LD_RUNPATH_SEARCH_PATHS = '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"';
      }
    }

    // --- Add WidgetKit + SwiftUI frameworks to the target ---
    proj.addFramework('WidgetKit.framework', {
      target: target.uuid,
      link: true,
    });
    proj.addFramework('SwiftUI.framework', {
      target: target.uuid,
      link: true,
    });

    // --- Embed the extension in the main app ---
    const mainTarget = proj.getFirstTarget();
    proj.addTargetDependency(mainTarget.firstTarget, [target.uuid]);

    // Add "Embed App Extensions" build phase
    const embedPhase = proj.addBuildPhase(
      [],
      'PBXCopyFilesBuildPhase',
      'Embed App Extensions',
      mainTarget.firstTarget.uuid,
      'app_extension'
    );
    if (embedPhase && embedPhase.buildPhase) {
      embedPhase.buildPhase.dstSubfolderSpec = 13; // Plugins folder
    }

    return mod;
  });

  return config;
};

module.exports = withWidget;
