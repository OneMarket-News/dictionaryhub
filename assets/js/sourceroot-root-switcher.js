(function sourceRootSwitcherFactory(global) {
  "use strict";

  const STYLESHEET = "assets/css/sourceroot-root-switcher.css?v=shared-root-switcher-v1";
  const NAVIGATION_OPEN_EVENT = "sourceroot:navigation-menu-open";
  const REGISTRY = Object.freeze([
    Object.freeze({
      id: "SourceRoot",
      displayName: "SourceRoot Home",
      canonicalUrl: "sourceroot.html",
      available: true,
      destinationType: "utility",
      group: "SourceRoot",
      description: "Provenance infrastructure and registry overview.",
      icon: "SR",
      order: 10
    }),
    Object.freeze({
      id: "SourceRootSearch",
      displayName: "Search All Roots",
      canonicalUrl: "sourceroot-search.html",
      available: true,
      destinationType: "utility",
      group: "SourceRoot",
      description: "Search supported Roots without merging their evidence.",
      icon: "⌕",
      order: 20
    }),
    Object.freeze({
      id: "DictionaryRoot",
      displayName: "DictionaryRoot",
      canonicalUrl: "index.html",
      available: true,
      destinationType: "root",
      group: "Roots",
      description: "Exact meanings, lexical evidence, and relationships.",
      icon: "D",
      order: 30
    }),
    Object.freeze({
      id: "HistoryRoot",
      displayName: "HistoryRoot",
      canonicalUrl: "historyroot.html",
      available: true,
      destinationType: "root",
      group: "Roots",
      description: "Historical records, evidence, and interpretation.",
      icon: "H",
      order: 40
    })
  ]);

  const instances = new WeakMap();
  let instanceSequence = 0;

  function currentFile(locationValue) {
    const location = locationValue || global.location || {};
    const pathname = String(location.pathname || "");
    return pathname.split("/").pop().toLowerCase() || "sourceroot.html";
  }

  function detectCurrentId(locationValue) {
    const file = currentFile(locationValue);
    if (file === "sourceroot.html") return "SourceRoot";
    if (file === "sourceroot-search.html") return "SourceRootSearch";
    if (file === "index.html" || /^(concept|graph|sources|history|coverage|editorial)-v2\.html$/.test(file) ||
        /^(workflow|account|admin)-v1\.html$/.test(file)) {
      return "DictionaryRoot";
    }
    if (file === "historyroot.html" || /^history-.+-v1\.html$/.test(file)) {
      return "HistoryRoot";
    }
    return "";
  }

  function ensureStylesheet() {
    if (document.querySelector('link[data-sourceroot-root-switcher-styles]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLESHEET;
    link.dataset.sourcerootRootSwitcherStyles = "v1";
    document.head.appendChild(link);
  }

  function availableDestinations() {
    return REGISTRY
      .filter((destination) => destination.available)
      .slice()
      .sort((left, right) => left.order - right.order);
  }

  function uniqueMenuId() {
    let id;
    do {
      instanceSequence += 1;
      id = `sourcerootRootSwitcherMenu${instanceSequence}`;
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

  function createDestination(destination, currentId, close) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const isCurrent = destination.id === currentId;
    link.href = destination.canonicalUrl;
    link.dataset.rootDestination = destination.id;
    if (isCurrent) link.setAttribute("aria-current", "page");

    appendText(link, "span", "sr-root-switcher-icon", destination.icon || "•")
      .setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    copy.className = "sr-root-switcher-copy";
    appendText(copy, "strong", "", destination.displayName);
    appendText(copy, "small", "", destination.description || "");
    link.appendChild(copy);
    if (isCurrent) appendText(link, "span", "sr-root-switcher-current", "Current");

    link.addEventListener("click", (event) => {
      close(false);
      if (isCurrent) event.preventDefault();
    });
    item.appendChild(link);
    return item;
  }

  function init(options) {
    const settings = options || {};
    const mount = typeof settings.mount === "string"
      ? document.querySelector(settings.mount)
      : settings.mount || document.querySelector("[data-sourceroot-root-switcher]");
    if (!mount) return null;
    if (instances.has(mount)) return instances.get(mount);

    ensureStylesheet();
    const currentId = settings.currentId || mount.dataset.currentRoot || detectCurrentId();
    const currentDestination = REGISTRY.find((destination) => destination.id === currentId);
    const menuId = uniqueMenuId();
    mount.classList.add("sr-root-switcher");
    mount.dataset.sourcerootRootSwitcherInitialized = "true";
    mount.replaceChildren();

    const trigger = document.createElement("button");
    trigger.className = "sr-root-switcher-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", menuId);
    trigger.setAttribute(
      "aria-label",
      `Switch Roots${currentDestination ? `. Current experience: ${currentDestination.displayName}` : ""}`
    );
    appendText(trigger, "span", "", "Switch Roots");
    appendText(trigger, "span", "sr-root-switcher-chevron", "▾").setAttribute("aria-hidden", "true");

    const panel = document.createElement("nav");
    panel.className = "sr-root-switcher-panel";
    panel.id = menuId;
    panel.setAttribute("aria-label", "SourceRoot destinations");
    panel.hidden = true;

    const destinations = availableDestinations();
    ["SourceRoot", "Roots"].forEach((groupName) => {
      const grouped = destinations.filter((destination) => destination.group === groupName);
      if (!grouped.length) return;
      const group = document.createElement("section");
      group.className = "sr-root-switcher-group";
      appendText(group, "h2", "", groupName);
      const list = document.createElement("ul");
      grouped.forEach((destination) => {
        list.appendChild(createDestination(destination, currentId, close));
      });
      group.appendChild(list);
      panel.appendChild(group);
    });

    function setOpen(open, returnFocus) {
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      mount.dataset.open = String(open);
      if (open) {
        positionPanel();
        global.dispatchEvent(new CustomEvent(NAVIGATION_OPEN_EVENT, {
          detail: { owner: mount, menu: "root-switcher" }
        }));
      }
      if (!open && returnFocus) trigger.focus();
    }

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
      currentId,
      open: () => setOpen(true, false),
      close
    });
    instances.set(mount, api);
    return api;
  }

  function initializePage() {
    document.querySelectorAll("[data-sourceroot-root-switcher]").forEach((mount) => {
      init({ mount, currentId: mount.dataset.currentRoot });
    });
  }

  global.SourceRootRootSwitcher = Object.freeze({
    registry: REGISTRY,
    detectCurrentId,
    init,
    initializePage
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePage, { once: true });
  } else {
    initializePage();
  }
})(window);
