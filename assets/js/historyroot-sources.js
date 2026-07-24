(function historyRootSourcesPage(global) {
  "use strict";

  const ui = global.HistoryRootShared;

  function urlState() {
    const params = new URLSearchParams(global.location.search);
    return {
      q: ui.clean(params.get("q")),
      className: ui.clean(params.get("class")) || "all",
      status: ui.clean(params.get("status")) || "all",
      source: ui.clean(params.get("source"))
    };
  }

  function sourceCard(source, activeSource) {
    const card = ui.element("article", {
      className: "hr-source-card",
      attributes: {
        "data-source-id": source.sourceId,
        "data-selected": source.sourceId === activeSource ? "true" : "false",
        "aria-current": source.sourceId === activeSource ? "true" : null
      }
    });
    const heading = ui.element("div", { className: "hr-source-card-heading" });
    const title = ui.element("h3");
    ui.append(
      title,
      ui.element("a", {
        text: source.name,
        attributes: { href: ui.sourceHref(source.sourceId) }
      })
    );
    ui.append(heading, title, ui.chip(ui.sourceClassLabel(source), "source"));
    ui.append(card, heading);
    if (source.publisher) {
      ui.append(card, ui.element("p", { text: source.publisher }));
    }
    const status = source.accessStatus || source.verificationStatus;
    if (status) ui.append(card, ui.chip(ui.statusLabel(status), "confidence"));
    if (source.limitations) {
      ui.append(
        card,
        ui.element("p", {
          className: "hr-source-summary",
          text: source.limitations
        })
      );
    }
    return card;
  }

  function detailRow(term, value) {
    const row = ui.element("div", { className: "hr-metadata-row" });
    ui.append(
      row,
      ui.element("dt", { text: term }),
      ui.element("dd", { text: value })
    );
    return row;
  }

  async function start() {
    const { client } = await ui.initialize();
    const form = document.querySelector("#historyrootSourcesForm");
    const query = document.querySelector("#historyrootSourcesQuery");
    const classSelect = document.querySelector("#historyrootSourcesClass");
    const statusSelect = document.querySelector("#historyrootSourcesStatus");
    const reset = document.querySelector("#historyrootSourcesReset");
    const statePanel = document.querySelector("#historyrootSourcesState");
    const count = document.querySelector("#historyrootSourcesCount");
    const results = document.querySelector("#historyrootSourcesResults");
    const detail = document.querySelector("#historyrootSourceDetail");
    let sources = [];
    let runNumber = 0;

    function applyInputs(active) {
      query.value = active.q;
      classSelect.value = active.className;
      statusSelect.value = active.status;
    }

    function inputState() {
      return {
        q: query.value,
        class: classSelect.value,
        status: statusSelect.value,
        source: ""
      };
    }

    function populateClasses() {
      const current = classSelect.value;
      const existing = new Set(
        Array.from(classSelect.options).map((option) => option.value)
      );
      Array.from(new Set(sources.map((source) => source.sourceClass).filter(Boolean)))
        .sort()
        .forEach((sourceClass) => {
          if (existing.has(sourceClass)) return;
          ui.append(
            classSelect,
            ui.element("option", {
              text: ui.sourceClassLabel({ sourceClass }),
              attributes: { value: sourceClass }
            })
          );
        });
      classSelect.value = current;
    }

    function filtered(active) {
      return sources.filter((source) => {
        if (active.q && !ui.textMatches(source, active.q)) return false;
        if (active.className !== "all" && source.sourceClass !== active.className) {
          return false;
        }
        const access = source.accessStatus || source.verificationStatus;
        if (active.status !== "all" && access !== active.status) return false;
        return true;
      });
    }

    async function renderDetail(sourceId) {
      ui.clear(detail);
      const source = sources.find((item) => item.sourceId === sourceId);
      if (!source) {
        ui.append(
          detail,
          ui.element("p", { className: "hr-kicker", text: "Select a source" }),
          ui.element("h2", { text: "Provenance in context" }),
          ui.element("p", {
            text: "Choose a source to inspect its citation, access record, limitations, and linked historical records."
          })
        );
        return;
      }

      ui.append(
        detail,
        ui.element("p", { className: "hr-kicker", text: ui.sourceClassLabel(source) }),
        ui.element("h2", { text: source.name })
      );
      if (source.publisher) {
        ui.append(detail, ui.element("p", { text: source.publisher }));
      }
      const list = ui.element("dl", { className: "hr-metadata-list" });
      [
        ["Access status", ui.statusLabel(source.accessStatus || source.verificationStatus)],
        ["Accessed", source.accessDate || source.lastReviewed],
        ["License or rights", source.license],
        ["Use status", source.licenseStatus]
      ]
        .filter((row) => row[1])
        .forEach(([term, value]) => ui.append(list, detailRow(term, value)));
      if (list.childNodes.length) ui.append(detail, list);
      if (source.citation) {
        ui.append(
          detail,
          ui.element("section", { className: "hr-source-locator" }),
        );
        const citationSection = detail.lastChild;
        ui.append(
          citationSection,
          ui.element("h3", { text: "Citation" }),
          ui.element("p", { text: source.citation })
        );
      }
      if (
        Array.isArray(source.locatorsInspected) &&
        source.locatorsInspected.length
      ) {
        const locatorSection = ui.element("section", { className: "hr-source-locator" });
        const listNode = ui.element("ul");
        source.locatorsInspected.forEach((locator) =>
          ui.append(listNode, ui.element("li", { text: locator }))
        );
        ui.append(
          locatorSection,
          ui.element("h3", { text: "Locators inspected" }),
          listNode
        );
        ui.append(detail, locatorSection);
      }
      if (source.limitations) {
        const limitation = ui.element("section", { className: "hr-source-limitation" });
        ui.append(
          limitation,
          ui.element("h3", { text: "Limitations" }),
          ui.element("p", { text: source.limitations })
        );
        ui.append(detail, limitation);
      }
      const external = ui.externalLink(source.url, "Open source in a new tab");
      if (external) ui.append(detail, external);

      const linkedHeading = ui.element("h3", { text: "Linked records" });
      ui.append(detail, linkedHeading);
      const linkedState = ui.element("div");
      ui.append(
        linkedState,
        ui.statePanel(
          "loading",
          "Loading linked records",
          "Finding live records supported by this source."
        )
      );
      ui.append(detail, linkedState);
      try {
        const linked = await client.sourceLinkedRecords(source.sourceId);
        const records = ui.dedupeRecords(Object.values(linked).flat()).slice(0, 12);
        ui.clear(linkedState);
        if (!records.length) {
          ui.append(
            linkedState,
            ui.element("p", { text: "No linked customer records were returned." })
          );
        } else {
          records.forEach((record) =>
            ui.append(linkedState, ui.recordCard(record))
          );
        }
      } catch (error) {
        const display = ui.displayError(error);
        ui.clear(linkedState);
        ui.append(
          linkedState,
          ui.statePanel(display.kind, display.title, display.message, () =>
            renderDetail(source.sourceId)
          )
        );
      }
    }

    function render(active) {
      const visible = filtered(active);
      ui.clear(results);
      count.textContent = `${visible.length.toLocaleString()} ${
        visible.length === 1 ? "source" : "sources"
      }`;
      if (!visible.length) {
        ui.append(
          results,
          ui.statePanel(
            "empty",
            "No sources match these filters",
            "Try another source class, access status, or search term."
          )
        );
      } else {
        visible.forEach((source) =>
          ui.append(results, sourceCard(source, active.source))
        );
      }
      results.querySelectorAll("a[href]").forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          const sourceId = link.closest("[data-source-id]").dataset.sourceId;
          ui.updateUrl({ source: sourceId });
          render(urlState());
          renderDetail(sourceId);
        });
      });
      renderDetail(active.source);
    }

    async function load() {
      const active = urlState();
      applyInputs(active);
      const thisRun = ++runNumber;
      ui.renderState(
        statePanel,
        "loading",
        "Loading the source register",
        "Reading source classification and review metadata from SourceRoot."
      );
      ui.clear(results);
      count.textContent = "Loading…";
      try {
        await ui.requireDataset(client);
        const payload = await client.sources({ page: 1, limit: 100 });
        if (thisRun !== runNumber) return;
        sources = global.HistoryRootApi.itemsFrom(payload);
        populateClasses();
        applyInputs(active);
        ui.hideState(statePanel);
        render(active);
      } catch (error) {
        if (thisRun !== runNumber) return;
        const display = ui.displayDatasetError(error);
        ui.renderState(
          statePanel,
          display.kind,
          display.title,
          display.message,
          load
        );
        count.textContent = "Unavailable";
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      ui.updateUrl(inputState());
      render(urlState());
    });
    reset.addEventListener("click", () => {
      ui.updateUrl({ q: "", class: "", status: "", source: "" });
      render(urlState());
    });
    global.addEventListener("popstate", () => {
      const active = urlState();
      applyInputs(active);
      render(active);
    });

    await load();
  }

  start();
})(window);
