// Create a new <div> element
let newDiv = document.createElement("div");

// Set the id attribute
newDiv.setAttribute("id", "myDiv");
newDiv.style.display = "flex";
newDiv.style.flexDirection = "column";
// Set a property (e.g., text content)

// Add a class
newDiv.classList.add("my-class");

// Append the new div to the body
document.body.appendChild(newDiv);

function createButton(label = "", fn) {
  // Create a new button element
  const button = document.createElement("button");
  button.textContent = label;
  button.style.color = "black";
  button.style.padding = "10px 20px";
  button.style.border = "none";
  button.style.borderRadius = "5px";
  button.style.cursor = "pointer";

  // Add an event listener
  button.addEventListener("click", fn);

  return button;
}

const pixelDemoBtn = createButton("Pixel Perfect Demo", () => {
  window.location.href = window.location.origin + "/smooth-pixel-demo";
});
newDiv.appendChild(pixelDemoBtn);

const quadtreeDemoBtn = createButton("Quadtree Demo", () => {
  window.location.href = window.location.origin + "/quadtree-demo";
});
newDiv.appendChild(quadtreeDemoBtn);


const tiledDemoBtn = createButton("World Loader Demo", () => {
  window.location.href = window.location.origin + "/world-loader-demo";
});
newDiv.appendChild(tiledDemoBtn);

document.body.style.backgroundColor = "white";

