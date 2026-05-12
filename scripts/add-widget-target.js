#!/usr/bin/env node
/**
 * One-time script to add the TitraHealthWidget extension target
 * to the existing Xcode project. Run: node scripts/add-widget-target.js
 */
const xcode = require('xcode');
const path = require('path');
const fs = require('fs');

const PROJECT_PATH = path.join(__dirname, '..', 'ios', 'TitraHealth.xcodeproj', 'project.pbxproj');
const WIDGET_NAME = 'TitraHealthWidget';
const WIDGET_BUNDLE_ID = 'com.titrahealth.app.widget';
const WIDGET_DIR = 'TitraHealthWidget';

const proj = xcode.project(PROJECT_PATH);
proj.parseSync();

// Check if widget target already exists
const nativeTargets = proj.pbxNativeTargetSection();
for (const key in nativeTargets) {
  if (typeof nativeTargets[key] === 'object' && nativeTargets[key].name === `"${WIDGET_NAME}"`) {
    console.log('Widget target already exists, skipping.');
    process.exit(0);
  }
}

// 1. Add the widget target
const target = proj.addTarget(WIDGET_NAME, 'app_extension', WIDGET_DIR, WIDGET_BUNDLE_ID);
console.log('Added target:', WIDGET_NAME, 'uuid:', target.uuid);

// 2. Create a PBX group for the widget files
const groupKey = proj.pbxCreateGroup(WIDGET_NAME, `"${WIDGET_DIR}"`);
const mainGroupKey = proj.getFirstProject().firstProject.mainGroup;
proj.addToPbxGroup(groupKey, mainGroupKey);

// 3. Add Swift source files to the widget target
const widgetSourceDir = path.join(__dirname, '..', 'ios', WIDGET_DIR);
const swiftFiles = fs.readdirSync(widgetSourceDir).filter(f => f.endsWith('.swift'));
for (const file of swiftFiles) {
  // Use just the filename — the group's path already provides the TitraHealthWidget/ prefix
  proj.addSourceFile(file, { target: target.uuid }, groupKey);
  console.log('Added source:', file);
}

// 4. Add Info.plist and entitlements as file references
proj.addFile('Info.plist', groupKey);
proj.addFile(`${WIDGET_NAME}.entitlements`, groupKey);

// 5. Add WidgetKit and SwiftUI frameworks
proj.addFramework('WidgetKit.framework', { target: target.uuid, link: true });
proj.addFramework('SwiftUI.framework', { target: target.uuid, link: true });
console.log('Added frameworks: WidgetKit, SwiftUI');

// 6. Configure build settings for the widget target
const configs = proj.pbxXCBuildConfigurationSection();
for (const key in configs) {
  const cfg = configs[key];
  if (typeof cfg !== 'object' || !cfg.buildSettings) continue;
  const bs = cfg.buildSettings;
  if (bs.PRODUCT_BUNDLE_IDENTIFIER === `"${WIDGET_BUNDLE_ID}"` ||
      bs.PRODUCT_BUNDLE_IDENTIFIER === WIDGET_BUNDLE_ID) {
    bs.SWIFT_VERSION = '5.0';
    bs.TARGETED_DEVICE_FAMILY = '"1,2"';
    bs.INFOPLIST_FILE = `"${WIDGET_DIR}/Info.plist"`;
    bs.CODE_SIGN_ENTITLEMENTS = `"${WIDGET_DIR}/${WIDGET_NAME}.entitlements"`;
    bs.CODE_SIGN_STYLE = 'Automatic';
    bs.IPHONEOS_DEPLOYMENT_TARGET = '17.0';
    bs.PRODUCT_NAME = '"$(TARGET_NAME)"';
    bs.SKIP_INSTALL = 'YES';
    bs.SWIFT_EMIT_LOC_STRINGS = 'YES';
    bs.GENERATE_INFOPLIST_FILE = 'NO';
    bs.CURRENT_PROJECT_VERSION = '1';
    bs.MARKETING_VERSION = '1.0';
    bs.LD_RUNPATH_SEARCH_PATHS = '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"';
    console.log('Configured build settings for:', cfg.name);
  }
}

// 7. Skip addTargetDependency — Xcode will resolve the dependency
//    automatically from the embed build phase.

// 8. The embed phase for app extensions is handled by Xcode automatically
//    when you build the main target with a dependent extension.
console.log('Widget target added — Xcode will handle embedding automatically.');

// 9. Write the modified project
fs.writeFileSync(PROJECT_PATH, proj.writeSync());
console.log('Wrote project.pbxproj successfully!');
console.log('\nNext: Build with npx expo run:ios');
