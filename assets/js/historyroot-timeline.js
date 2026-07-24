(function historyRootTimelinePage(global) {
  "use strict";

  const ui = global.HistoryRootShared;
  const PAGE_SIZE = 12;

  function urlState() {
    const params = new URLSearchParams(global.location.search);
    return {
      q: ui.clean(params.get("q")),
      from: ui.clean(params.get("from")),
      to: ui.clean(params.get("to")),
      precision: ui.clean(params.get("precision")) || "all",
      background: params.get("background") === "true",
      transition: params.get("transition") === "true",
      memory: params.get("memory") === "true",
      event: ui.clean(params.get("event"))
    };
  }

  function scopeKey(record) {
    const coverage = ui.clean(record && record.metadata && record.metadata.coveragePeriod);
    if (coverage === "background-1605-1615") return "background";
    if (coverage === "background-to-core-bridge") return "background";
    if (coverage === "1692-transition") return "transition";
    if (coverage === "cultural-memory-afterlife") return "memory";
    return "core";
  }

  function timelineCard(entry, focusId) {
    const article = ui.element("article", {
      className: "hr-timeline-card",
      attributes: {
        "data-temporal-kind": entry.temporal.temporalKind,
        "data-focused": entry.record.id === focusId ? "true" : "false"
      }
    });
    const date = ui.element("div", { className: "hr-timeline-date" });
    ui.append(
      date,
      ui.element("strong", {
        text: entry.temporal.dateLabel || "Date not specified"
      }),
      ui.element("span", {
        text: ui.temporalPrecisionLabel(entry.temporal)
      })
    );
    const copy = ui.element("div");
    const heading = ui.element("div", { className: "hr-timeline-card-heading" });
    const title = ui.element("h3");
    ui.append(
      title,
      ui.element("a", {
        text: ui.recordTitle(entry.record),
        attributes: {
          href: ui.recordHref(entry.record, { from: "timeline" })
        }
      })
    );
    ui.append(heading, title, ui.chip(ui.typeLabel(entry.record), "entity"));
    ui.append(copy, heading);
    const summary = ui.recordSummary(entry.record);
    if (summary) {
      ui.append(copy, ui.element("p", { text: summary }));
    }
    const uncertainty = ui.temporalUncertainty(entry.temporal);
    if (uncertainty) {
      ui.append(
        copy,
        ui.element("p", {
          className: "hr-attribution",
          text: `Chronology note: ${uncertainty}`
        })
      );
    }
    const scope = ui.scopeLabel(entry.record);
    if (scope) {
      ui.append(copy, ui.chip(scope, "scope"));
    }
    ui.append(article, date, copy);
    return article;
  }

  function memoryCard(memory) {
    const article = ui.element("article", {
      className: "hr-timeline-card hr-memory-card"
    });
    const date = ui.element("div", { className: "hr-timeline-date" });
    ui.append(
      date,
      ui.element("strong", { text: memory.periodLabel || "Later memory" }),
      ui.element("span", { text: "Cultural-memory afterlife" })
    );
    const copy = ui.element("div");
    const title = ui.element("h3");
    ui.append(
      title,
      ui.element("a", {
        text: ui.recordTitle(memory),
        attributes: { href: ui.recordHref(memory, { from: "timeline" }) }
      })
    );
    ui.append(copy, title);
    if (ui.recordSummary(memory)) {
      ui.append(copy, ui.element("p", { text: ui.recordSummary(memory) }));
    }
    ui.append(article, date, copy);
    return article;
  }

  async function start() {
    const { client } = await ui.initialize();
    const statePanel = document.querySelector("#historyrootTimelineState");
    const form = document.querySelector("#historyrootTimelineForm");
    const query = document.querySelector("#historyrootTimelineQuery");
    const from = document.querySelector("#historyrootTimelineFrom");
    const to = document.querySelector("#historyrootTimelineTo");
    const precision = document.querySelector("#historyrootTimelinePrecision");
    const background = document.querySelector("#historyrootTimelineBackground");
    const transition = document.querySelector("#historyrootTimelineTransition");
    const memory = document.querySelector("#historyrootTimelineMemory");
    const reset = document.querySelector("#historyrootTimelineReset");
    const count = document.querySelector("#historyrootTimelineCount");
    const results = document.querySelector("#historyrootTimelineResults");
    const more = document.querySelector("#historyrootTimelineMore");
    let entries = [];
    let visible = PAGE_SIZE;
    let runNumber = 0;

    function applyInputs(state) {
      query.value = state.q;
      from.value = state.from;
      to.value = state.to;
      precision.value = state.precision;
      background.checked = state.background;
      transition.checked = state.transition;
      memory.checked = state.memory;
    }

    function inputState() {
      return {
        q: query.value,
        from: from.value,
        to: to.value,
        precision: precision.value,
        background: background.checked ? "true" : "",
        transition: transition.checked ? "true" : "",
        memory: memory.checked ? "true" : ""
      };
    }

    function render(active) {
      ui.clear(results);
      const shown = entries.slice(0, visible);
      count.textContent = `${entries.length.toLocaleString()} ${
        entries.length === 1 ? "entry" : "entries"
      }`;
      if (!shown.length) {
        ui.append(
          results,
          ui.statePanel(
            "empty",
            "No chronology matches this view",
            "Try a wider date range or include another period."
          )
        );
        more.hidden = true;
        return;
      }

      let currentScope = "";
      let group = null;
      shown.forEach((entry) => {
        if (entry.scope !== currentScope) {
          currentScope = entry.scope;
          group = ui.element("section", {
            className: "hr-timeline-group",
            attributes: { "data-scope": currentScope }
          });
          const labels = {
            background: "Background context",
            core: "Core period · 1616–1691",
            transition: "1692 transition",
            memory: "Cultural-memory afterlife"
          };
          ui.append(
            group,
            ui.element("h2", { text: labels[currentScope] || "Chronology" })
          );
          ui.append(results, group);
        }
        ui.append(
          group,
          entry.memory
            ? memoryCard(entry.memory)
            : timelineCard(entry, active.event)
        );
      });
      more.hidden = visible >= entries.length;
      if (active.event) {
        const focused = results.querySelector('[data-focused="true"]');
        if (focused) focused.setAttribute("tabindex", "-1");
      }
    }

    async function load() {
      const active = urlState();
      applyInputs(active);
      visible = PAGE_SIZE;
      const thisRun = ++runNumber;
      ui.renderState(
        statePanel,
        "loading",
        "Building the chronology",
        "Loading dates and their live subject records from SourceRoot."
      );
      ui.clear(results);
      count.textContent = "Loading…";
      more.hidden = true;

      try {
        await ui.requireDataset(client);
        const [temporals, memories] = await Promise.all([
          client.contextAll("temporalAssertions").then((payload) => payload.items),
          active.memory
            ? client.contextAll("culturalMemories").then((payload) => payload.items)
            : Promise.resolve([])
        ]);
        const subjectIds = temporals.map((temporal) => temporal.subjectId);
        const records = await client.recordsByIds(subjectIds);
        if (thisRun !== runNumber) return;
        const recordById = new Map(records.map((record) => [record.id, record]));
        const fromYear = active.from ? Number(active.from) : null;
        const toYear = active.to ? Number(active.to) : null;
        const dated = temporals
          .map((temporal) => ({
            temporal,
            record: recordById.get(temporal.subjectId)
          }))
          .filter((entry) => entry.record)
          .filter((entry) => {
            const entryScope = scopeKey(entry.record);
            if (entryScope === "background" && !active.background) return false;
            if (entryScope === "transition" && !active.transition) return false;
            if (entryScope === "memory" && !active.memory) return false;
            if (active.precision !== "all" && entry.temporal.temporalKind !== active.precision) {
              return false;
            }
            const year = ui.temporalYear(entry.temporal);
            if (fromYear !== null && (year === null || year < fromYear)) return false;
            if (toYear !== null && (year === null || year > toYear)) return false;
            if (active.q && !ui.textMatches(entry.record, active.q)) return false;
            return true;
          })
          .map((entry) => Object.assign(entry, { scope: scopeKey(entry.record) }))
          .sort((left, right) => {
            const order = { background: 0, core: 1, transition: 2, memory: 3 };
            return (
              order[left.scope] - order[right.scope] ||
              ui.temporalSortValue(left.temporal) -
                ui.temporalSortValue(right.temporal) ||
              ui.recordTitle(left.record).localeCompare(ui.recordTitle(right.record))
            );
          });
        const memoryEntries = memories
          .filter((record) => !active.q || ui.textMatches(record, active.q))
          .map((record) => ({
            scope: "memory",
            memory: record,
            sort: ui.clean(record.periodLabel)
          }))
          .sort((left, right) => left.sort.localeCompare(right.sort));
        entries = dated.concat(memoryEntries);
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
      load();
    });
    reset.addEventListener("click", () => {
      ui.updateUrl({
        q: "",
        from: "",
        to: "",
        precision: "",
        background: "",
        transition: "",
        memory: "",
        event: ""
      });
      load();
    });
    more.addEventListener("click", () => {
      visible += PAGE_SIZE;
      render(urlState());
    });
    global.addEventListener("popstate", load);
    await load();
  }

  start();
})(window);
