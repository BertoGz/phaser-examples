/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ (() => {

eval("// Create a new <div> element\nlet newDiv = document.createElement(\"div\");\n\n// Set the id attribute\nnewDiv.setAttribute(\"id\", \"myDiv\");\nnewDiv.style.display = \"flex\";\nnewDiv.style.flexDirection = \"column\";\n// Set a property (e.g., text content)\n\n// Add a class\nnewDiv.classList.add(\"my-class\");\n\n// Append the new div to the body\ndocument.body.appendChild(newDiv);\n\nfunction createButton(label = \"\", fn) {\n  // Create a new button element\n  const button = document.createElement(\"button\");\n  button.textContent = label;\n  button.style.color = \"black\";\n  button.style.padding = \"10px 20px\";\n  button.style.border = \"none\";\n  button.style.borderRadius = \"5px\";\n  button.style.cursor = \"pointer\";\n\n  // Add an event listener\n  button.addEventListener(\"click\", fn);\n\n  return button;\n}\n\nconst pixelDemoBtn = createButton(\"Pixel Perfect Demo\", () => {\n  window.location.href = window.location.origin + \"/smooth-pixel-demo\";\n});\nnewDiv.appendChild(pixelDemoBtn);\nconst quadtreeDemoBtn = createButton(\"Quadtree Demo\", () => {\n  window.location.href = window.location.origin + \"/quadtree-demo\";\n});\nnewDiv.appendChild(quadtreeDemoBtn);\ndocument.body.style.backgroundColor = \"white\";\n\n\n//# sourceURL=webpack://phaser-webpack-project/./src/index.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./src/index.js"]();
/******/ 	
/******/ })()
;