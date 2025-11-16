const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    'script.min': './script.js',
    'music-system.min': './music-system.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: false, // Keep console.logs for now (can change to true)
            drop_debugger: true,
            pure_funcs: ['console.log'], // Remove console.logs in production
          },
          mangle: {
            toplevel: true,
            properties: {
              regex: /^_/ // Only mangle properties starting with _
            }
          },
          format: {
            comments: false, // Remove comments
          },
        },
        extractComments: false,
      }),
    ],
  },
  resolve: {
    extensions: ['.js'],
  },
};

