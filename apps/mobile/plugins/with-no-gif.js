const { withGradleProperties } = require("expo/config-plugins");

/** Kimbo shows no GIFs: drop Fresco's GIF decoder (~320 KB of native code) from the APK. */
module.exports = function withNoGif(config) {
  return withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter((p) => !(p.type === "property" && p.key === "expo.gif.enabled"));
    c.modResults.push({ type: "property", key: "expo.gif.enabled", value: "false" });
    return c;
  });
};
