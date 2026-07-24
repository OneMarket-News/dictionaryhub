#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();
const pages = [
  "historyroot.html",
  "history-explore-v1.html",
  "history-timeline-v1.html",
  "history-record-v1.html",
  "history-sources-v1.html",
  "history-graph-v1.html",
];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "compact-desktop", width: 1265, height: 900 },
  { name: "tablet", width: 1024, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

function executable(command) {
  const result = spawnSync("where", [command], {
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0
    ? result.stdout.split(/\r?\n/u).map((value) => value.trim()).find(Boolean) || ""
    : "";
}

function browserPath() {
  const programFiles = process.env.PROGRAMFILES || "";
  const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "";
  const localAppData = process.env.LOCALAPPDATA || "";
  return [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    executable("msedge.exe"),
    executable("chrome.exe"),
  ]
    .filter(Boolean)
    .find((candidate) => fs.existsSync(candidate));
}

function contentType(file) {
  const extension = path.extname(file).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
  }[extension] || "application/octet-stream";
}

async function staticServer() {
  const server = http.createServer((request, response) => {
    const requested = decodeURIComponent(
      new URL(request.url || "/", "http://localhost").pathname,
    ).replace(/^\/+/u, "");
    const file = path.resolve(root, requested || "historyroot.html");
    if (
      !file.startsWith(`${root}${path.sep}`) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": contentType(file),
      "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15_000).unref();
    });
  }
}

async function waitFor(file) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (fs.existsSync(file)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${file}`);
}

let server;
let browser;
let tempDirectory;
try {
  pages.forEach((page) => {
    if (!fs.existsSync(path.join(root, page))) {
      throw new Error(`Missing page: ${page}`);
    }
  });
  const foundBrowser = browserPath();
  if (!foundBrowser) {
    throw new Error("Edge or Chrome was not found.");
  }
  server = await staticServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "historyroot-responsive-"),
  );
  browser = spawn(
    foundBrowser,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--disable-extensions",
      "--disable-background-networking",
      "--remote-debugging-port=0",
      `--user-data-dir=${tempDirectory}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  const portFile = path.join(tempDirectory, "DevToolsActivePort");
  await waitFor(portFile);
  const [debugPort, websocketPath] = fs
    .readFileSync(portFile, "utf8")
    .trim()
    .split(/\r?\n/u);
  const socket = new WebSocket(
    `ws://127.0.0.1:${debugPort}${websocketPath}`,
  );
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const client = new Cdp(socket);
  const target = await client.send("Target.createTarget", { url: "about:blank" });
  const attached = await client.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true,
  });
  await client.send("Page.enable", {}, attached.sessionId);
  await client.send("Runtime.enable", {}, attached.sessionId);

  let failures = 0;
  for (const page of pages) {
    for (const viewport of viewports) {
      await client.send(
        "Emulation.setDeviceMetricsOverride",
        {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: viewport.width <= 520,
        },
        attached.sessionId,
      );
      await client.send(
        "Page.navigate",
        { url: `${baseUrl}/${page}` },
        attached.sessionId,
      );
      await delay(900);
      const evaluated = await client.send(
        "Runtime.evaluate",
        {
          returnByValue: true,
          expression: `(() => {
            const main = document.querySelector("main");
            const header = document.querySelector("[data-historyroot-navigation]");
            const menu = document.querySelector("#historyrootMenuButton");
            const headerInner = document.querySelector(".historyroot-product-bar-inner");
            const brand = document.querySelector(".historyroot-brand-lockup");
            const graphCheckboxes = Array.from(document.querySelectorAll("#historyrootGraphTypes input"));
            return {
              href: location.href,
              h1: document.querySelectorAll("h1").length,
              mainVisible: Boolean(main && main.getBoundingClientRect().height > 20),
              header: Boolean(header),
              menu: Boolean(menu),
              menuDisplay: menu ? getComputedStyle(menu).display : "",
              headerHeight: headerInner ? headerInner.getBoundingClientRect().height : 0,
              brandRight: brand ? brand.getBoundingClientRect().right : 0,
              menuLeft: menu ? menu.getBoundingClientRect().left : 0,
              graphCheckboxMax: graphCheckboxes.length
                ? Math.max(...graphCheckboxes.map((input) => input.getBoundingClientRect().width))
                : 0,
              overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
              statusRegion: Boolean(document.querySelector("[aria-live]")),
            };
          })()`,
        },
        attached.sessionId,
      );
      const value = evaluated.result?.value || {};
      const issues = [];
      if (!value.mainVisible) issues.push("main is not visible");
      if (!value.header) issues.push("navigation did not initialize");
      if (!value.menu) issues.push("mobile menu control is absent");
      if (viewport.width <= 1320 && value.menuDisplay === "none") {
        issues.push("responsive menu is not visible at the navigation breakpoint");
      }
      if (viewport.width <= 520 && value.headerHeight > 90) {
        issues.push(`mobile product header is too tall at ${value.headerHeight}px`);
      }
      if (
        viewport.width <= 520 &&
        value.brandRight > value.menuLeft - 6
      ) {
        issues.push("mobile brand and menu overlap");
      }
      if (page === "history-graph-v1.html" && value.graphCheckboxMax > 24) {
        issues.push(`graph checkboxes expanded to ${value.graphCheckboxMax}px`);
      }
      if (value.h1 !== 1) issues.push(`expected one h1, found ${value.h1}`);
      if (value.overflow) issues.push("horizontal overflow");
      if (!value.statusRegion) issues.push("accessible live status is absent");
      if (issues.length) {
        failures += issues.length;
        console.error(`FAIL ${page} @ ${viewport.name}: ${issues.join("; ")}`);
      } else {
        console.log(`PASS ${page} @ ${viewport.name}`);
      }
    }
  }
  if (failures) {
    throw new Error(`Responsive browser verification found ${failures} issue(s).`);
  }
  console.log(
    `HistoryRoot responsive browser verification passed: ${pages.length * viewports.length} page/viewport checks.`,
  );
  try {
    await client.send("Browser.close");
  } catch {}
  socket.close();
} catch (error) {
  console.error(`HistoryRoot responsive browser verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (browser && browser.exitCode == null && !browser.killed) {
    try {
      browser.kill();
    } catch {}
  }
  if (server) {
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
  if (tempDirectory) {
    try {
      fs.rmSync(tempDirectory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
    } catch {}
  }
}
