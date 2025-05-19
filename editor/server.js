const http = require("http");
const fs = require("fs");
const path = require("path");

// Define the port
const PORT = 3000;

// MIME types for different file extensions
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

// Create an HTTP server
const server = http.createServer((req, res) => {
  console.log(`Request for ${req.url}`);

  // If request is for the root, serve index.html
  let filePath =
    req.url === "/"
      ? path.join(__dirname, "index.html")
      : path.join(__dirname, "..", req.url);

  // Get the file extension
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || "application/octet-stream";

  // Read the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        // Page not found
        res.writeHead(404);
        res.end("404 - File Not Found");
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Press Ctrl+C to stop the server`);
});
