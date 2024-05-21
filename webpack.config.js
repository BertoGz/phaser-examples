const path = require("path");

module.exports = {
  entry: {
    index: { import: "./src/index.js" },
    smoothPixel: { import: "./src/Examples/smooth-pixel.js" },
    quadtree: { import: "./src/Examples/quadtree.js" },
  }, // Replace with your entry file
  output: {
    filename: "[name].bundle.js", // Output file name
    path: path.resolve(__dirname, "public"), // Output directory
  },
  mode: "development", // Set to 'production' for minification
  // devtool: "source-map", // Generates source maps for debugging
};
