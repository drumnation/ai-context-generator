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
              configFile: "tsconfig.json"
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
