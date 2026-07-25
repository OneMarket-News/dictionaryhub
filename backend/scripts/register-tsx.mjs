// TSX asks Node for OS account details when process.geteuid is unavailable.
// Some managed Windows hosts deny that lookup. The temp directory is already
// user-scoped on Windows, so a stable non-privileged sentinel avoids the lookup.
if (process.platform === "win32" && typeof process.geteuid !== "function") {
  Object.defineProperty(process, "geteuid", {
    configurable: true,
    value: () => 1,
  });
}

await import("tsx");

