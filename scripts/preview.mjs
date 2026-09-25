// Local-only static export preview. Run npm run build first. No writes or directory listings.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("out");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff": "font/woff", ".woff2": "font/woff2" };
http.createServer((req, res) => {
  try {
    let file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(400).end("Bad request"); }
}).listen(3002, "127.0.0.1", () => console.log("Static preview: http://localhost:3002"));
