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
            drop_console: true, // Remove all console statements in production
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.debug', 'console.info'], // Remove specific console methods
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

