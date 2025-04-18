import * as path from "path";
import type { Configuration, DefinePlugin } from 'webpack';
import CopyWebpackPlugin from "copy-webpack-plugin";
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Create a require function for CommonJS modules
const require = createRequire(import.meta.url);

// Require webpack using the created function for runtime
const webpack = require('webpack');

// Get the directory name in an ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionConfig: Configuration = {
  target: "node",
  mode: "none",
  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]"
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
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.json",
              compilerOptions: {
                sourceMap: true
              }
            }
          }
        ]
      }
    ]
  },
  devtool: "source-map"
};

const webviewConfig: Configuration = {
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
      path: "path-browserify"
    }
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": JSON.stringify({}),
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development")
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "src/webview/webview.css", to: "webview.css" },
        { from: "src/webview/toolkit.css", to: "toolkit.css" }
      ]
    })
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.webview.json"
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      }
    ]
  }
};

export default [extensionConfig, webviewConfig];
