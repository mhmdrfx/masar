const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const DIST_DIR = path.resolve(__dirname, "..", "frontend", "dist");
const OUT_DIR = path.resolve(__dirname, "..", "docs", "screenshots");
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];
  let filePath = path.join(DIST_DIR, urlPath === "/" ? "index.html" : urlPath);

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
});

const PORT = 43210;

function runChromeCapture(args) {
  return new Promise((resolve, reject) => {
    execFile(CHROME_PATH, args, { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

server.listen(PORT, "127.0.0.1", async () => {
  console.log(`Preview server listening on http://127.0.0.1:${PORT}`);

  const targets = [
    {
      name: "masar-mtr-dark.png",
      url: `http://127.0.0.1:${PORT}/?lang=en&theme=dark&tab=mtr&trace=1`,
      width: 1320,
      height: 1040,
    },
    {
      name: "masar-speed-dark.png",
      url: `http://127.0.0.1:${PORT}/?lang=en&theme=dark&tab=speed&speed=1`,
      width: 1320,
      height: 890,
    },
    {
      name: "masar-arabic-light.png",
      url: `http://127.0.0.1:${PORT}/?lang=ar&theme=light&tab=mtr&trace=1`,
      width: 1320,
      height: 1040,
    },
    {
      name: "masar-report-studio.png",
      url: `http://127.0.0.1:${PORT}/?lang=ar&theme=dark&tab=mtr&trace=1&report=1`,
      width: 1320,
      height: 1040,
    },
  ];

  for (const t of targets) {
    const outPath = path.join(OUT_DIR, t.name);
    console.log(`Capturing ${t.name} from ${t.url} ...`);

    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--force-prefers-reduced-motion",
      `--window-size=${t.width},${t.height}`,
      "--force-device-scale-factor=2",
      "--hide-scrollbars",
      `--screenshot=${outPath}`,
      t.url,
    ];

    try {
      await runChromeCapture(args);
      if (fs.existsSync(outPath)) {
        const sz = fs.statSync(outPath).size;
        console.log(`✓ Generated ${t.name} (${Math.round(sz / 1024)} KB)`);
      } else {
        console.error(`✗ File not created: ${outPath}`);
      }
    } catch (err) {
      console.error(`Error capturing ${t.name}:`, err.message);
    }
  }

  server.close(() => {
    console.log("Server closed. All screenshots captured successfully.");
    process.exit(0);
  });
});
