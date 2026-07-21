(function dictionaryRootBrand(global) {
  "use strict";

  const DEFAULT_BRAND = {
    productName: "DictionaryRoot",
    tagline: "Explore how meaning connects.",
    supportingDescription: "Definitions, relationships, and sources connected through a traceable knowledge graph.",
    poweredBy: "SourceRoot",
    logoPath: "assets/brand/dictionaryroot-mark.svg",
    navigation: [
      { label: "Home", href: "index.html" },
      { label: "Concept", href: "concept-v2.html" },
      { label: "Knowledge Sphere", href: "graph-v2.html" },
      { label: "Sources", href: "sources-v2.html" },
      { label: "History", href: "history-v2.html" },
      { label: "Coverage", href: "coverage-v2.html" },
      { label: "Editorial", href: "editorial-v2.html" }
    ]
  };

  const PAGE_META = {
    "index.html": {
      title: "DictionaryRoot — Meaning, Connected",
      heading: "DictionaryRoot",
      intro: "Search an exact meaning, explore its relationships, verify its sources, and follow its history."
    },
    "concept-v2.html": {
      title: "DictionaryRoot — Concept Explorer",
      heading: "Concept Explorer",
      intro: "Search meanings, compare word senses, and inspect the definitions and sources behind each concept."
    },
    "graph-v2.html": {
      title: "DictionaryRoot — Knowledge Graph",
      heading: "DictionaryRoot Knowledge Graph",
      intro: "Explore a word as a connected map of broader, narrower, opposite, and related meanings."
    },
    "sources-v2.html": {
      title: "DictionaryRoot — Sources",
      heading: "Sources & Attribution",
      intro: "See where DictionaryRoot’s lexical information comes from and how each source supports the knowledge graph."
    },
    "coverage-v2.html": {
      title: "DictionaryRoot — Coverage and Data Quality",
      heading: "Coverage and Data Quality",
      intro: "See which meanings are graph-connected, source-backed, reviewed, revision-tracked, or still waiting for deeper integration."
    },
    "editorial-v2.html": {
      title: "DictionaryRoot — Editorial Review",
      heading: "Editorial Review",
      intro: "Review exact meanings, record decisions, annotate issues, and promote approved concepts into the curated graph."
    },
    "dictionaryroot-connection.html": {
      title: "DictionaryRoot — Data Status",
      heading: "Dictionary Data Status",
      intro: "Verify the live connection between DictionaryRoot and the SourceRoot knowledge service."
    }
  };

  const RELATIONSHIP_LABELS = {
    HYPERNYM: "Broader meaning",
    INSTANCE_HYPERNYM: "Broader named category",
    HYPONYM: "More specific meaning",
    INSTANCE_HYPONYM: "Named example",
    ANTONYM: "Opposite",
    MERONYM: "Part of",
    MEMBER_MERONYM: "Member of",
    SUBSTANCE_MERONYM: "Made from",
    PART_MERONYM: "Component of",
    HOLONYM: "Includes",
    MEMBER_HOLONYM: "Has members",
    SUBSTANCE_HOLONYM: "Contains substance",
    PART_HOLONYM: "Has component",
    SIMILAR_TO: "Similar meaning",
    ALSO_SEE: "Related concept",
    CAUSE: "Can cause",
    ENTAILMENT: "Implies",
    DERIVATIONALLY_RELATED: "Related word form"
  };

  function currentFile() {
    const path = global.location.pathname.split("/").pop();
    return path || "index.html";
  }

  async function loadBrand() {
    try {
      const response = await fetch("config/dictionaryroot-brand.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Object.assign({}, DEFAULT_BRAND, await response.json());
    } catch (error) {
      console.warn("DictionaryRoot brand fallback active:", error);
      return Object.assign({}, DEFAULT_BRAND);
    }
  }

  function createBrandLockup(brand) {
    const anchor = document.createElement("a");
    anchor.className = "dictionaryroot-brand-lockup";
    anchor.href = "index.html";
    anchor.setAttribute("aria-label", `${brand.productName} home`);
    anchor.innerHTML = `
      <img src="${brand.logoPath}" alt="" width="42" height="42">
      <span class="dictionaryroot-brand-copy">
        <span class="dictionaryroot-brand-name">${brand.productName}</span>
        <span class="dictionaryroot-brand-tagline">${brand.tagline}</span>
      </span>`;
    return anchor;
  }

  function injectProductBar(brand) {
    if (document.querySelector(".dictionaryroot-product-bar")) return;
    const bar = document.createElement("div");
    bar.className = "dictionaryroot-product-bar";
    const file = currentFile();
    const nav = brand.navigation.map((item) => {
      const active = file.toLowerCase() === item.href.toLowerCase();
      return `<a href="${item.href}"${active ? ' aria-current="page"' : ""}>${item.label}</a>`;
    }).join("");
    bar.innerHTML = `
      <div class="dictionaryroot-product-bar-inner">
        <div data-dr-brand-slot></div>
        <nav class="dictionaryroot-product-nav" aria-label="DictionaryRoot">
          ${nav}
        </nav>
        <span class="dictionaryroot-powered-by">Powered by <strong>${brand.poweredBy}</strong></span>
      </div>`;
    bar.querySelector("[data-dr-brand-slot]").appendChild(createBrandLockup(brand));
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function injectSkipLink() {
    if (document.querySelector(".dictionaryroot-skip-link")) return;
    const main = document.querySelector("main");
    if (!main) return;
    if (!main.id) main.id = "main-content";
    const link = document.createElement("a");
    link.className = "dictionaryroot-skip-link";
    link.href = `#${main.id}`;
    link.textContent = "Skip to content";
    document.body.insertBefore(link, document.body.firstChild);
  }

  function updatePageCopy(meta) {
    if (!meta) return;
    document.title = meta.title;

    const heading = document.querySelector("main h1, .hero h1, h1");
    if (heading && /source\s*root|dictionary\s*hub|graph\s*v?2|concept|source registry|knowledge graph/i.test(heading.textContent || "")) {
      heading.textContent = meta.heading;
    }

    const main = document.querySelector("main");
    if (main && !main.querySelector(".dr-hero") && !main.querySelector(".dr-home-hero") && !main.querySelector(".dictionaryroot-page-intro")) {
      const intro = document.createElement("section");
      intro.className = "dictionaryroot-page-intro";
      intro.setAttribute("aria-label", "Page introduction");
      intro.innerHTML = `<p>${meta.intro}</p>`;
      main.insertBefore(intro, main.firstChild);
    }
  }

  function improveInputs() {
    document.querySelectorAll('input[type="search"], input[data-search], input[name="q"]').forEach((input) => {
      if (!input.placeholder || /search|filter|query/i.test(input.placeholder)) {
        input.placeholder = "Search for knowledge, truth, language, light…";
      }
      if (!input.getAttribute("aria-label")) input.setAttribute("aria-label", "Search DictionaryRoot");
    });
  }

  function humanizeRelationshipElement(element) {
    if (!element || element.children.length) return;
    const raw = String(element.textContent || "").trim();
    const normalized = raw.toUpperCase().replace(/[\s-]+/g, "_");
    if (!RELATIONSHIP_LABELS[normalized]) return;
    element.dataset.sourceRootRelationship = normalized;
    element.title = `SourceRoot relationship: ${normalized}`;
    element.textContent = RELATIONSHIP_LABELS[normalized];
    element.classList.add("dictionaryroot-friendly-relationship");
  }

  function humanizeRelationships(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("span, button, td, th, option, .badge, .tag, .relationship-type, .edge-type").forEach(humanizeRelationshipElement);
  }

  function installObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          humanizeRelationshipElement(node);
          humanizeRelationships(node);
          improveInputs();
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function appendFooter(brand) {
    const footer = document.querySelector("footer");
    if (!footer || footer.querySelector(".dictionaryroot-powered-by")) return;
    const line = document.createElement("p");
    line.className = "dictionaryroot-powered-by";
    line.innerHTML = `${brand.productName} · Powered by <strong>${brand.poweredBy}</strong>`;
    footer.appendChild(line);
  }

  async function init() {
    document.body.classList.add("dictionaryroot-customer-page");
    const brand = await loadBrand();
    const meta = PAGE_META[currentFile().toLowerCase()] || {
      title: `${brand.productName}`,
      heading: brand.productName,
      intro: brand.supportingDescription
    };
    injectProductBar(brand);
    injectSkipLink();
    updatePageCopy(meta);
    improveInputs();
    humanizeRelationships(document);
    installObserver();
    appendFooter(brand);
    document.dispatchEvent(new CustomEvent("dictionaryroot:brand-ready", { detail: { brand, meta } }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  global.DictionaryRootBrand = { RELATIONSHIP_LABELS };
})(window);
