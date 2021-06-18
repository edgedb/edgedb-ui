const {
  override,
  babelInclude,
  addBundleVisualizer,
  setWebpackTarget,
  addWebpackModuleRule,
  getBabelLoader,
  addWebpackPlugin,
} = require("customize-cra");

const path = require("path");

const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

module.exports = override(
  process.env.BUNDLE_VISUALIZE && addBundleVisualizer(),
  babelInclude([path.resolve("./renderer"), path.resolve("../common")]),
  (config) => {
    const babelLoader = getBabelLoader(config);
    return addWebpackModuleRule({
      test: /\.ts$/,
      use: [
        {loader: "@open-wc/webpack-import-meta-loader"},
        {
          loader: babelLoader.loader,
          options: babelLoader.options,
        },
      ],
    })(config);
  },
  (config) => {
    // https://github.com/educartoons/creact-react-app-typescript-web-workers/blob/master/config-overrides.js
    const babelLoader = getBabelLoader(config);
    return addWebpackModuleRule({
      test: /\.worker\.ts$/,
      use: [
        {loader: "worker-loader"},
        {
          loader: babelLoader.loader,
          options: babelLoader.options,
        },
      ],
    })(config);
  },
  (config) => {
    // https://github.com/facebook/create-react-app/issues/4912#issuecomment-472223885
    config.resolve.extensions.push(".wasm");
    config.module.rules.forEach((rule) => {
      (rule.oneOf || []).forEach((oneOf) => {
        if (oneOf.loader && oneOf.loader.indexOf("file-loader") >= 0) {
          // Make file-loader ignore WASM files
          oneOf.exclude.push(/\.wasm$/);
        }
      });
    });
    return config;
  },
  addWebpackModuleRule({
    test: /onigasm\.wasm$/,
    type: "javascript/auto",
    loader: "file-loader",
  }),
  addWebpackPlugin(
    new MonacoWebpackPlugin({
      languages: [],
    })
  )
);

module.exports.paths = (paths) => {
  paths.appPublic = path.resolve(__dirname, "assets");
  paths.appHtml = path.resolve(__dirname, "assets/index.html");
  paths.appIndexJs = path.resolve(__dirname, "renderer/index.tsx");
  paths.appSrc = path.resolve(__dirname, "renderer");
  paths.appTypeDeclarations = path.resolve(
    __dirname,
    "renderer/react-app-env.d.ts"
  );
  return paths;
};
