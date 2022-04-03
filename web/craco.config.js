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
      webpackConfig.output.publicPath = "/ui/";
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
      webpackConfig.resolve.fallback["node-fetch"] = false;
      webpackConfig.resolve.fallback.buffer = require.resolve("buffer/");

      return webpackConfig;
    },
  },
};
