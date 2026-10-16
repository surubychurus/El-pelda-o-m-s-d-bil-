const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// `three` en su versión CommonJS (three.cjs) llama a process.emitWarning al cargarse,
// que no existe en React Native y rompe el arranque. Se fuerza la versión ESM.
const threeEsm = path.join(__dirname, "node_modules", "three", "build", "three.module.js");
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return { type: "sourceFile", filePath: threeEsm };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
