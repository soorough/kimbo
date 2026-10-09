const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

/**
 * expo-router imports expo-symbols for its native tabs, and on Android that pulls in the
 * ~1 MB Material Symbols font. Kimbo draws its own tab bar with Feather icons, so the font
 * is never used: resolve it to a stub to keep it out of the APK.
 */
const STUBS = {
  "@expo-google-fonts/material-symbols/400Regular": path.join(__dirname, "src/lib/material-symbols-stub.js"),
};

const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const stub = STUBS[moduleName];
  if (stub) return { type: "sourceFile", filePath: stub };
  return resolveRequest ? resolveRequest(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
