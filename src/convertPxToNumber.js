const fs = require("fs");
const path = require("path");
const glob = require("glob");

const UPSCALE_FACTOR = 1;
// Function to convert '100px' to 100
function convertPxStringToNumber(content) {
  // Use a regular expression to find and replace all occurrences of values ending in 'px'
  return content.replace(/(\d+)px/g, (match, p1) => p1*UPSCALE_FACTOR);
}

// Function to process a single bundle file
function processBundle(bundlePath) {
  fs.readFile(bundlePath, "utf8", (err, data) => {
    if (err) {
      console.error(`Error reading bundle file ${bundlePath}:`, err);
      return;
    }

    const updatedContent = convertPxStringToNumber(data);

    fs.writeFile(bundlePath, updatedContent, "utf8", (err) => {
      if (err) {
        console.error(`Error writing bundle file ${bundlePath}:`, err);
        return;
      }
      console.log(`Processed bundle file: ${bundlePath}`);
    });
  });
}
// Function to find and process all bundle files
function processAllBundles(pattern) {
  glob(pattern, (err, files) => {
    if (err) {
      console.error("Error finding bundle files:", err);
      return;
    }

    files.forEach((file) => {
      processBundle(file);
    });
  });
}

// Specify the pattern for JavaScript files
const pattern = path.join(__dirname, "../public", "**", "*.bundle.js"); // Adjust this pattern if needed

// Process all files matching the pattern
processAllBundles(pattern);
