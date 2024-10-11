const express = require("express");
const path = require("path");
const app = express()
app.use(express.static(path.join(__dirname + "/public")));

// Serve the initial HTML page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// All Other App Routes...
app.get("/quadtree-demo", (req, res) => {
  res.sendFile(__dirname + "/public/quadtree.html");
});
app.get("/smooth-pixel-demo", (req, res) => {
  res.sendFile(__dirname + "/public/smooth-pixel.html");
});
app.get("/world-loader-demo", (req, res) => {
  res.sendFile(__dirname + "/public/tiled.html");
});

app.get("/manifest.json", (req, res) => {
  res.sendFile(__dirname + "/public/manifest.json");
});

app.use((req, res) => {
  res.status(404);
  res.send(`<h1>Error 404: Resource not found</h1>`);
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
