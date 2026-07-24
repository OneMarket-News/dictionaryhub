(function historyRootExplorePage(global) {
  "use strict";

  const ui = global.HistoryRootShared;
  const apiTools = global.HistoryRootApi;
  const MEMORY_TYPE = "cultural_memory";

  function queryState() {
    const params = new URLSearchParams(global.location.search);
    return {
      q: ui.clean(params.get("q")),
      type: ui.clean(params.get("type")) || "all",
      from: ui.clean(params.get("from")),
      to: ui.clean(params.get("to")),
      uncertain: params.get("uncertain") === "true",
      memory: params.get("memory") === "true"
    };
  }

  function yearInRange(year, state) {
    if (year === null) return !state.from && !state.to;
    if (state.from && year < Number(state.from)) return false;
    if (state.to && year > Number(state.to)) return false;
    return true;
  }

  async function start() {
    const { manifest, client } = await ui.initialize();
    const statePanel = document.querySelector("#historyrootExploreState");
    const form = document.querySelector("#historyrootExploreForm");
    const query = document.querySelector("#historyrootExploreQuery");
    const type = document.querySelector("#historyrootExploreType");
    const from = document.querySelector("#historyrootExploreFrom");
    const to = document.querySelector("#historyrootExploreTo");
    const uncertain = document.querySelector("#historyrootExploreUncertain");
    const memory = document.querySelector("#historyrootExploreMemory");
    const reset = document.querySelector("#historyrootExploreReset");
    const results = document.querySelector("#historyrootExploreResults");
    const count = document.querySelector("#historyrootExploreCount");
    const more = document.querySelector("#historyrootExploreMore");
    const pageSize = Number(manifest.defaults.pageSize || 24);
    let records = [];
    let visible = pageSize;
    let runNumber = 0;

    function applyInputs(state) {
      query.value = state.q;
      type.value = state.type;
      from.value = state.from;
      to.value = state.to;
      uncertain.checked = state.uncertain;
      memory.checked = state.memory;
    }

    function inputState() {
      return {
        q: ui.clean(query.value),
        type: type.value,
        from: ui.clean(from.value),
        to: ui.clean(to.value),
        uncertain: uncertain.checked ? "true" : "",
        memory: memory.checked ? "true" : ""
      };
    }

    function render(active) {
      ui.clear(results);
      const shown = records.slice(0, visible);
      count.textContent = `${records.length.toLocaleString()} ${
        records.length === 1 ? "record" : "records"
      }`;
      if (!shown.length) {
        ui.append(
          results,
          ui.statePanel(
            "empty",
            "No records match these filters",
            "Try broadening the date range, changing the record type, or including cultural memory."
          )
        );
      } else {
        shown.forEach((record) =>
          ui.append(results, ui.recordCard(record, { query: active.q }))
        );
      }
      more.hidden = visible >= records.length;
    }

    async function load() {
      const active = queryState();
      applyInputs(active);
      visible = pageSize;
      const thisRun = ++runNumber;
      ui.renderState(
        statePanel,
        "loading",
        "Loading historical records",
        "Querying the live SourceRoot dataset."
      );
      count.textContent = "Loading…";
      ui.clear(results);
      more.hidden = true;

      try {
        await ui.requireDataset(client);
        const collectionForType = {
          claim: "claims",
          interpretation: "interpretations",
          cultural_memory: "culturalMemories"
        };
        const selectedCollection = collectionForType[active.type];
        const [entityResult, temporalResult, memoryResult] = await Promise.all([
          active.q
            ? client
                .search(active.q)
                .then((payload) =>
                  client.recordsByIds(
                    apiTools.itemsFrom(payload).map((record) => record.id)
                  )
                )
            : client
                .contextAll(selectedCollection || "entities")
                .then((payload) => payload.items),
          client.contextAll("temporalAssertions").then((payload) => payload.items),
          active.memory || active.type === MEMORY_TYPE
            ? client
                .contextAll("culturalMemories")
                .then((payload) => payload.items)
            : Promise.resolve([])
        ]);
        if (thisRun !== runNumber) return;

        const temporalBySubject = new Map();
        temporalResult.forEach((temporal) => {
          if (!temporalBySubject.has(temporal.subjectId)) {
            temporalBySubject.set(temporal.subjectId, temporal);
          }
        });
        const merged = ui.dedupeRecords(entityResult.concat(memoryResult));
        records = merged
          .filter((record) => {
            const recordType = ui.typeOf(record);
            if (active.type !== "all" && recordType !== active.type) return false;
            if (!active.memory && recordType === MEMORY_TYPE) return false;
            if (active.q && !ui.textMatches(record, active.q)) {
              return false;
            }
            const temporal = temporalBySubject.get(record.id);
            if (active.uncertain) {
              if (
                !temporal ||
                !["approximate", "range", "disputed", "multiple_proposed", "before", "after"].includes(
                  temporal.temporalKind
                )
              ) {
                return false;
              }
            }
            if ((active.from || active.to) && !yearInRange(ui.temporalYear(temporal), active)) {
              return false;
            }
            return true;
          })
          .map((record) => {
            const temporal = temporalBySubject.get(record.id);
            return temporal
              ? Object.assign({}, record, { dateLabel: temporal.dateLabel })
              : record;
          })
          .sort((left, right) =>
            ui.recordTitle(left).localeCompare(ui.recordTitle(right))
          );
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
      ui.updateUrl(
        { q: "", type: "", from: "", to: "", uncertain: "", memory: "" }
      );
      load();
    });
    more.addEventListener("click", () => {
      visible += pageSize;
      render(queryState());
    });
    global.addEventListener("popstate", load);

    await load();
  }

  start();
})(window);
