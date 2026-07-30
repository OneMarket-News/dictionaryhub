(function sourceRootUserMenuFactory(global) {
  "use strict";

  const STYLESHEET = "assets/css/sourceroot-user-menu.css?v=shared-user-menu-v1";
  const NAVIGATION_OPEN_EVENT = "sourceroot:navigation-menu-open";
  const REGISTRY = Object.freeze([
    Object.freeze({
      id: "SourceRootSignIn",
      label: "Sign in to SourceRoot",
      canonicalUrl: "account-v1.html",
      destinationType: "authentication-entry",
      availabilityStatus: "available",
      authenticationRequirement: "sign-in-entry-point",
      authenticationEnforcedByComponent: false,
      currentFiles: Object.freeze([]),
      description: "Continue to the existing SourceRoot account entry point.",
      icon: "SR",
      order: 10,
      group: "Source Root account"
    }),
    Object.freeze({
      id: "SourceRootEditorial",
      label: "Editorial",
      canonicalUrl: "editorial-v2.html",
      destinationType: "workspace",
      availabilityStatus: "available",
      authenticationRequirement: "existing-route-policy",
      authenticationEnforcedByComponent: false,
      currentFiles: Object.freeze(["editorial-v2.html"]),
      description: "Inspect the current editorial review experience.",
      icon: "E",
      order: 20,
      group: "Workspace"
    }),
    Object.freeze({
      id: "SourceRootWorkflow",
      label: "Workflow",
      canonicalUrl: "workflow-v1.html",
      destinationType: "workspace",
      availabilityStatus: "available",
      authenticationRequirement: "existing-route-policy",
      authenticationEnforcedByComponent: false,
      currentFiles: Object.freeze(["workflow-v1.html"]),
      description: "Open the existing proposal and review workflow.",
      icon: "W",
      order: 30,
      group: "Workspace"
    }),
    Object.freeze({
      id: "SourceRootAccount",
      label: "Account",
      canonicalUrl: "account-v1.html",
      destinationType: "account",
      availabilityStatus: "available",
      authenticationRequirement: "existing-route-policy",
      authenticationEnforcedByComponent: false,
      currentFiles: Object.freeze(["account-v1.html"]),
      description: "Open the existing account and access experience.",
      icon: "A",
      order: 40,
      group: "Workspace"
    })
  ]);

  const instances = new WeakMap();
  let instanceSequence = 0;

  function currentFile(locationValue) {
    const location = locationValue || global.location || {};
    const pathname = String(location.pathname || "");
    return pathname.split("/").pop().toLowerCase() || "sourceroot.html";
  }

  function detectCurrentItemId(locationValue, registry) {
    const file = currentFile(locationValue);
    const items = registry || REGISTRY;
    const current = items.find((item) =>
      Array.isArray(item.currentFiles) && item.currentFiles.includes(file)
    );
    return current ? current.id : "";
  }

  function ensureStylesheet() {
    if (document.querySelector('link[data-sourceroot-user-menu-styles]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLESHEET;
    link.dataset.sourcerootUserMenuStyles = "v1";
    document.head.appendChild(link);
  }

  function availableItems(registry) {
    return registry
      .filter((item) => item.availabilityStatus === "available")
      .slice()
      .sort((left, right) => left.order - right.order);
  }

  function uniquePanelId(prefix) {
    const safePrefix = String(prefix || "sourcerootUserMenu")
      .replace(/[^A-Za-z0-9_.:-]/g, "") || "sourcerootUserMenu";
    let id;
    do {
      instanceSequence += 1;
      id = `${safePrefix}Panel${instanceSequence}`;
    } while (document.getElementById(id));
    return id;
  }

  function appendText(parent, tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function createDestination(item, currentItemId, close) {
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    const isCurrent = item.id === currentItemId;
    link.href = item.canonicalUrl;
    link.dataset.userMenuDestination = item.id;
    if (isCurrent) link.setAttribute("aria-current", "page");

    appendText(link, "span", "sr-user-menu-icon", item.icon || "")
      .setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    copy.className = "sr-user-menu-copy";
    appendText(copy, "strong", "", item.label);
    appendText(copy, "small", "", item.description || "");
    link.appendChild(copy);
    if (isCurrent) appendText(link, "span", "sr-user-menu-current", "Current");

    link.addEventListener("click", () => close(false));
    listItem.appendChild(link);
    return listItem;
  }

  function init(options) {
    const settings = options || {};
    const mount = typeof settings.mount === "string"
      ? document.querySelector(settings.mount)
      : settings.mount || document.querySelector("[data-sourceroot-user-menu]");
    if (!mount) return null;
    if (instances.has(mount)) return instances.get(mount);

    ensureStylesheet();
    const registry = settings.registry || REGISTRY;
    const currentItemId = settings.currentItemId || detectCurrentItemId(settings.location, registry);
    const panelId = uniquePanelId(settings.idPrefix || mount.dataset.userMenuIdPrefix);
    const triggerLabel = settings.triggerLabel || "Sign in";
    mount.classList.add("sr-user-menu");
    mount.dataset.sourcerootUserMenuInitialized = "true";
    mount.dataset.authState = "signed-out";
    mount.replaceChildren();

    const trigger = document.createElement("button");
    trigger.className = "sr-user-menu-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", panelId);
    trigger.setAttribute("aria-label", "Open SourceRoot account and workspace navigation");
    appendText(trigger, "span", "", triggerLabel);
    appendText(trigger, "span", "sr-user-menu-chevron", "\u25be")
      .setAttribute("aria-hidden", "true");

    const panel = document.createElement("nav");
    panel.className = "sr-user-menu-panel";
    panel.id = panelId;
    panel.setAttribute("aria-label", "SourceRoot account and workspace");
    panel.hidden = true;

    const items = availableItems(registry);
    ["Source Root account", "Workspace"].forEach((groupName) => {
      const groupedItems = items.filter((item) => item.group === groupName);
      if (!groupedItems.length) return;
      const group = document.createElement("section");
      group.className = "sr-user-menu-group";
      appendText(group, "h2", "", groupName);
      const list = document.createElement("ul");
      groupedItems.forEach((item) => {
        list.appendChild(createDestination(item, currentItemId, close));
      });
      group.appendChild(list);
      panel.appendChild(group);
    });

    function positionPanel() {
      if (!global.matchMedia("(max-width: 560px)").matches) {
        panel.style.removeProperty("top");
        return;
      }
      const triggerRect = trigger.getBoundingClientRect();
      const viewportInset = 8;
      const preferredTop = triggerRect.bottom + viewportInset;
      const maximumTop = Math.max(
        viewportInset,
        global.innerHeight - panel.getBoundingClientRect().height - viewportInset
      );
      panel.style.top = `${Math.min(preferredTop, maximumTop)}px`;
    }

    function setOpen(open, returnFocus) {
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      mount.dataset.open = String(open);
      if (open) {
        positionPanel();
        global.dispatchEvent(new CustomEvent(NAVIGATION_OPEN_EVENT, {
          detail: { owner: mount, menu: "user" }
        }));
      }
      if (!open && returnFocus) trigger.focus();
    }

    function close(returnFocus) {
      setOpen(false, Boolean(returnFocus));
    }

    trigger.addEventListener("click", () => {
      setOpen(trigger.getAttribute("aria-expanded") !== "true", false);
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(trigger.getAttribute("aria-expanded") !== "true", false);
      }
    });
    document.addEventListener("click", (event) => {
      if (!mount.contains(event.target)) close(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && trigger.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        close(true);
      }
    });
    global.addEventListener(NAVIGATION_OPEN_EVENT, (event) => {
      if (!event.detail || event.detail.owner !== mount) close(false);
    });
    global.addEventListener("resize", () => {
      if (trigger.getAttribute("aria-expanded") === "true") positionPanel();
    });

    mount.append(trigger, panel);
    const api = Object.freeze({
      mount,
      trigger,
      panel,
      currentItemId,
      authState: "signed-out",
      open: () => setOpen(true, false),
      close
    });
    instances.set(mount, api);
    return api;
  }

  function initializePage() {
    document.querySelectorAll("[data-sourceroot-user-menu]").forEach((mount) => {
      init({
        mount,
        currentItemId: mount.dataset.currentUserMenuItem,
        idPrefix: mount.dataset.userMenuIdPrefix
      });
    });
  }

  global.SourceRootUserMenu = Object.freeze({
    registry: REGISTRY,
    authState: "signed-out",
    detectCurrentItemId,
    init,
    initializePage
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePage, { once: true });
  } else {
    initializePage();
  }
})(window);
