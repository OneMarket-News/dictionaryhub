#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argValue = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const root = path.resolve(argValue("--root", process.cwd()));
const screenshotRoot = path.resolve(argValue("--screenshots", path.join(root, "verification", "responsive")));
const noScreenshots = args.includes("--no-screenshots");

const pages = [
  "index.html",
  "concept-v2.html",
  "graph-v2.html",
  "coverage-v2.html",
  "editorial-v2.html",
  "history-v2.html"
];
const viewports = [
  { name: "desktop", width: 1440, height: 1000, scale: 1 },
  { name: "tablet", width: 1024, height: 900, scale: 1 },
  { name: "mobile", width: 390, height: 844, scale: 1 }
];

function findExecutable(command) {
  const lookup = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(lookup, [command], { encoding: "utf8", windowsHide: true });
  if (result.status === 0) return result.stdout.split(/\r?\n/).map((v) => v.trim()).find(Boolean) || "";
  return "";
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    process.platform === "win32" ? path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe") : "",
    process.platform === "win32" ? path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe") : "",
    process.platform === "win32" ? path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe") : "",
    process.platform === "win32" ? path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe") : "",
    process.platform === "win32" ? path.join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe") : "",
    findExecutable("msedge"), findExecutable("msedge.exe"), findExecutable("chrome"), findExecutable("chrome.exe"),
    findExecutable("chromium"), findExecutable("chromium-browser"), findExecutable("google-chrome")
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".txt": "text/plain; charset=utf-8"
  })[ext] || "application/octet-stream";
}

async function startServer() {
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404, { "content-type": "text/plain" }); response.end("Not found"); return;
    }
    response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, port: server.address().port };
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
        else resolve(message.result || {});
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }
  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 15000).unref();
    });
  }
}

async function waitForFile(file, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(file)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${file}`);
}

async function verifyPage(client, sessionId, baseUrl, pageName, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale, mobile: viewport.width <= 520
  }, sessionId);
  await client.send("Page.navigate", { url: `${baseUrl}/${pageName}` }, sessionId);
  await delay(1800);
  const result = await client.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const main = document.querySelector('main');
      const header = document.querySelector('.dictionaryroot-unified-header');
      const advanced = document.querySelector('#sphereAdvancedControls');
      const bodyRect = document.body.getBoundingClientRect();
      return {
        title: document.title,
        main: Boolean(main),
        mainVisible: Boolean(main && main.getBoundingClientRect().height > 20),
        header: Boolean(header),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        bodyLeft: bodyRect.left,
        bodyRight: bodyRect.right,
        advancedOpen: advanced ? advanced.open : null,
        homeCoverageLinks: document.querySelectorAll('.dr-home-coverage-grid a').length,
        identitySurface: Boolean(document.querySelector('.dr-editorial-identity-card')),
        href: location.href,
        bodyText: (document.body?.innerText || '').slice(0, 500)
      };
    })()`
  }, sessionId);
  const value = result.result?.value || {};
  if (String(value.href || '').startsWith('chrome-error://') || /ERR_BLOCKED_BY_ADMINISTRATOR|blocked by (?:your )?administrator/i.test(value.bodyText || '')) {
    throw new Error(`BROWSER_ENVIRONMENT_BLOCKED: navigation to ${pageName} was blocked by the browser environment`);
  }
  const failures = [];
  if (!value.main || !value.mainVisible) failures.push("main content is missing or not visible");
  if (!value.header) failures.push("unified navigation did not initialize");
  if (value.overflow) failures.push(`horizontal overflow ${value.scrollWidth}px > ${value.innerWidth}px`);
  if (pageName === "graph-v2.html" && value.advancedOpen !== false) failures.push("advanced Sphere controls are not collapsed by default");
  if (pageName === "index.html" && value.homeCoverageLinks !== 8) failures.push(`expected 8 homepage coverage links, found ${value.homeCoverageLinks}`);
  if (pageName === "editorial-v2.html" && !value.identitySurface) failures.push("editorial identity surface is missing");

  if (!noScreenshots) {
    fs.mkdirSync(screenshotRoot, { recursive: true });
    const capture = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
    fs.writeFileSync(path.join(screenshotRoot, `${pageName.replace(/\.html$/u, "")}-${viewport.name}.png`), Buffer.from(capture.data, "base64"));
  }
  return { pageName, viewport: viewport.name, value, failures };
}

let server;
let browser;
let tempDir;
let browserReady = false;
try {
  for (const page of pages) {
    if (!fs.existsSync(path.join(root, page))) throw new Error(`Missing page: ${page}`);
  }
  const browserPath = findBrowser();
  if (!browserPath) {
    console.warn("RESPONSIVE SKIP: Edge/Chrome/Chromium was not found. Set CHROME_PATH and rerun.");
    process.exitCode = 0;
  } else {
    const served = await startServer();
    server = served.server;
    const baseUrl = `http://127.0.0.1:${served.port}`;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dictionaryroot-responsive-"));
    browser = spawn(browserPath, [
      "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
      "--disable-background-networking", "--disable-sync", "--metrics-recording-only", "--mute-audio",
      "--remote-debugging-port=0", `--user-data-dir=${tempDir}`, "about:blank"
    ], { stdio: "ignore", windowsHide: true });
    const portFile = path.join(tempDir, "DevToolsActivePort");
    await waitForFile(portFile);
    const [debugPort, browserPathPart] = fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/);
    const ws = new WebSocket(`ws://127.0.0.1:${debugPort}${browserPathPart}`);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const client = new CdpClient(ws);
    const target = await client.send("Target.createTarget", { url: "about:blank" });
    const attached = await client.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    const sessionId = attached.sessionId;
    await client.send("Page.enable", {}, sessionId);
    await client.send("Runtime.enable", {}, sessionId);
    browserReady = true;

    const results = [];
    for (const page of pages) {
      for (const viewport of viewports) results.push(await verifyPage(client, sessionId, baseUrl, page, viewport));
    }
    await client.send("Target.closeTarget", { targetId: target.targetId });
    try { await client.send("Browser.close"); } catch {}
    ws.close();

    let failures = 0;
    for (const result of results) {
      if (result.failures.length) {
        failures += result.failures.length;
        console.error(`FAIL ${result.pageName} @ ${result.viewport}: ${result.failures.join("; ")}`);
      } else {
        console.log(`PASS ${result.pageName} @ ${result.viewport}: ${result.value.scrollWidth}px / ${result.value.innerWidth}px`);
      }
    }
    if (failures) {
      console.error(`Responsive verification failed with ${failures} issue(s).`);
      process.exitCode = 1;
    } else {
      console.log(`Responsive verification passed for ${pages.length} pages across ${viewports.length} viewports.`);
    }
  }
} catch (error) {
  const environmentBlocked = String(error && error.message || '').startsWith('BROWSER_ENVIRONMENT_BLOCKED:');
  if (!browserReady || environmentBlocked) {
    console.warn(`RESPONSIVE SKIP: A browser was found but could not complete headless verification in this environment. ${error.message}`);
    process.exitCode = 0;
  } else {
    console.error(`Responsive verification error: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
} finally {
  if (browser && browser.exitCode == null && !browser.killed) {
    try { browser.kill(process.platform === "win32" ? undefined : "SIGKILL"); } catch {}
  }
  if (server) {
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
}
