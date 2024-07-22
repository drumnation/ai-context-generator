import * as path from "path";
import * as webpack from "webpack";
import CopyWebpackPlugin from "copy-webpack-plugin";

const extensionConfig: webpack.Configuration = {
  target: "node",
  mode: "none",
  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2"
  },
  externals: {
    vscode: "commonjs vscode"
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: [/node_modules/, /\.test\.ts$/],
        use: "ts-loader"
      }
    ]
  },
  devtool: "nosources-source-map"
};

const webviewConfig: webpack.Configuration = {
  target: "web",
  mode: "none",
  entry: "./src/webview/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "webview.js"
  },
  resolve: {
    extensions: [".ts", ".js", ".tsx", ".jsx"],
    fallback: {
      path: require.resolve("path-browserify")
    }
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": JSON.stringify({}),
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development"
      ),
      "process.env.NODE_DEBUG": JSON.stringify(process.env.NODE_DEBUG || "")
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "src/webview/toolkit.css", to: "toolkit.css" },
        { from: "src/webview/webview.css", to: "webview.css" }
      ]
    })
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: "ts-loader"
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      }
    ]
  },
  devtool: "nosources-source-map"
};

export default [extensionConfig, webviewConfig];
