const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Block .claude worktrees and other non-app dirs from being bundled
const blockList = [
  /\/\.claude\/.*/,
  /\/\.mcp\.json/,
];
config.resolver.blockList = blockList;

// react-native-svg@15.x ships TypeScript source in its "react-native" field.
// Metro's resolver can fail on transitive sub-path imports from that source
// (e.g. ./utils/fetchData). Redirect the top-level import to the pre-compiled
// CommonJS output so all relative requires stay in lib/commonjs/.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-svg') {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/react-native-svg/lib/commonjs/index.js',
      ),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
