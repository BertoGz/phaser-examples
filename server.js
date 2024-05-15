const express = require("express");
const path = require("path");
const app = express();

app.use(express.static(path.join(__dirname + "/public")));
// Serve the initial HTML page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/manifest.json", (req, res) => {
  res.sendFile(__dirname + "/public/manifest.json");
});

app.use((req, res) => {
  res.status(404);
  res.send(`<h1>Error 404: Resource not found</h1>`);
});

app.listen(3000, () => {
  console.log("App listening on port 3000");
});
