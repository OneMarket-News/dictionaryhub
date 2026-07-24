(function historyRootHomePage(global) {
  "use strict";

  const ui = global.HistoryRootShared;
  const apiTools = global.HistoryRootApi;

  function stat(value, label) {
    const node = ui.element("div", { className: "hr-stat" });
    ui.append(
      node,
      ui.element("strong", { text: Number(value || 0).toLocaleString() }),
      ui.element("span", { text: label })
    );
    return node;
  }

  async function start() {
    const { manifest, client } = await ui.initialize();
    const state = document.querySelector("#historyrootHomeState");
    const serviceState = document.querySelector("#historyrootHomeServiceState");
    const stats = document.querySelector("#historyrootHomeStats");
    const featured = document.querySelector("#historyrootHomeFeatured");
    const form = document.querySelector("#historyrootHomeSearchForm");
    const input = document.querySelector("#historyrootHomeSearchInput");
    const searchSection = document.querySelector("#historyrootHomeSearchSection");
    const searchResults = document.querySelector("#historyrootHomeResults");
    const exploreLink = document.querySelector("#historyrootHomeExploreLink");

    async function loadHome() {
      ui.renderState(
        state,
        "loading",
        "Connecting to SourceRoot",
        "Checking the live Plymouth knowledge dataset."
      );
      serviceState.dataset.state = "loading";
      serviceState.textContent = "Connecting";
      ui.clear(stats);
      ui.clear(featured);

      try {
        await ui.requireDataset(client);
        const requests = await Promise.allSettled([
          client.contextAll("entities"),
          client.context("claims", { page: 1, limit: 1 }),
          client.context("relationships", { page: 1, limit: 1 }),
          client.context("culturalMemories", { page: 1, limit: 1 }),
          client.sources({ page: 1, limit: 100 })
        ]);
        const entitiesResult = requests[0];
        if (entitiesResult.status !== "fulfilled") {
          throw entitiesResult.reason;
        }

        const entities = entitiesResult.value.items;
        const sourcePayload =
          requests[4].status === "fulfilled" ? requests[4].value : null;
        const claimPayload =
          requests[1].status === "fulfilled" ? requests[1].value : null;
        const relationshipPayload =
          requests[2].status === "fulfilled" ? requests[2].value : null;
        const memoryPayload =
          requests[3].status === "fulfilled" ? requests[3].value : null;
        const totals = [
          [entities.length, "entities"],
          [apiTools.totalFrom(claimPayload), "claims"],
          [apiTools.totalFrom(relationshipPayload), "relationships"],
          [apiTools.totalFrom(sourcePayload), "sources"],
          [apiTools.totalFrom(memoryPayload), "memory records"],
          [
            entities.filter((record) => record.entityType === "event").length,
            "events"
          ]
        ];
        totals.forEach(([value, label]) => ui.append(stats, stat(value, label)));

        const byId = new Map(entities.map((record) => [record.id, record]));
        const selected = (manifest.featuredRecordIds || [])
          .map((id) => byId.get(id))
          .filter(Boolean);
        selected.forEach((record) =>
          ui.append(featured, ui.recordCard(record))
        );

        serviceState.dataset.state = "live";
        serviceState.textContent = "Live";
        const partial = requests.some((result) => result.status === "rejected");
        if (partial) {
          ui.renderState(
            state,
            "partial",
            "Some knowledge counts are unavailable",
            "The live entity records are available. One or more supporting collection totals could not be loaded.",
            loadHome
          );
        } else {
          ui.hideState(state);
        }
      } catch (error) {
        serviceState.dataset.state = "offline";
        serviceState.textContent = "Unavailable";
        const display = ui.displayDatasetError(error);
        ui.renderState(
          state,
          display.kind,
          display.title,
          display.message,
          loadHome
        );
      }
    }

    async function runSearch(query) {
      const normalized = ui.clean(query);
      if (!normalized) {
        input.focus();
        return;
      }
      searchSection.hidden = false;
      ui.clear(searchResults);
      ui.append(
        searchResults,
        ui.statePanel(
          "loading",
          "Searching SourceRoot",
          `Looking for “${normalized}”.`
        )
      );
      const queryParams = new URLSearchParams({ q: normalized });
      exploreLink.href = `history-explore-v1.html?${queryParams.toString()}`;
      try {
        const payload = await client.search(normalized);
        const hits = apiTools.itemsFrom(payload);
        const records = await client.recordsByIds(
          hits.slice(0, 9).map((hit) => hit.id)
        );
        ui.clear(searchResults);
        if (!records.length) {
          ui.append(
            searchResults,
            ui.statePanel(
              "empty",
              "No matching records",
              "Try a canonical name, an alternate name, a place, or an event."
            )
          );
          return;
        }
        records.forEach((record) =>
          ui.append(searchResults, ui.recordCard(record, { query: normalized }))
        );
      } catch (error) {
        const display = ui.displayDatasetError(error);
        ui.clear(searchResults);
        ui.append(
          searchResults,
          ui.statePanel(
            display.kind,
            display.title,
            display.message,
            () => runSearch(normalized)
          )
        );
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      runSearch(input.value);
    });
    document
      .querySelectorAll("[data-history-query]")
      .forEach((button) =>
        button.addEventListener("click", () => {
          input.value = button.dataset.historyQuery || "";
          runSearch(input.value);
        })
      );

    await loadHome();
  }

  start();
})(window);
