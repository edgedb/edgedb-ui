const path = require("path");
const webpack = require("webpack");
const {getLoader, loaderByName} = require("@craco/craco");

module.exports = {
  webpack: {
    plugins: {
      add: [
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
        }),
      ],
    },
    configure: (webpackConfig, {env, paths}) => {
      const {isFound, match} = getLoader(
        webpackConfig,
        loaderByName("babel-loader")
      );
      if (isFound) {
        const include = Array.isArray(match.loader.include)
          ? match.loader.include
          : [match.loader.include];
        match.loader.include = [...include, path.resolve("../common")];
      }

      if (!webpackConfig.resolve.fallback) {
        webpackConfig.resolve.fallback = {};
      }
      webpackConfig.resolve.fallback.util = false;
      webpackConfig.resolve.fallback.crypto = false;
      webpackConfig.resolve.fallback.fs = false;
      webpackConfig.resolve.fallback.path = false;
      webpackConfig.resolve.fallback.os = false;
      webpackConfig.resolve.fallback.net = false;
      webpackConfig.resolve.fallback.tls = false;
      webpackConfig.resolve.fallback.readline = false;
      webpackConfig.resolve.fallback.stream = false;
      webpackConfig.resolve.fallback.buffer = require.resolve("buffer/");

      return webpackConfig;
    },
  },
};
