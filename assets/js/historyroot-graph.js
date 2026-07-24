(function historyRootGraphPage(global) {
  "use strict";

  const ui = global.HistoryRootShared;
  const apiTools = global.HistoryRootApi;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ALL_KINDS = ["relationship", "causal", "knowledge", "memory"];

  async function start() {
    const { manifest, client } = await ui.initialize();
    const form = document.querySelector("#historyrootGraphForm");
    const query = document.querySelector("#historyrootGraphQuery");
    const typeControls = document.querySelector("#historyrootGraphTypes");
    const statePanel = document.querySelector("#historyrootGraphState");
    const stage = document.querySelector("#historyrootGraphStage");
    const edgeLayer = document.querySelector("#historyrootGraphEdges");
    const nodeLayer = document.querySelector("#historyrootGraphNodes");
    const detail = document.querySelector("#historyrootGraphDetail");
    const list = document.querySelector("#historyrootGraphList");
    const count = document.querySelector("#historyrootGraphCount");
    let recordsById = new Map();
    let allEdges = [];
    let focusId = "";
    let loadNumber = 0;

    function activeKinds() {
      return new Set(
        Array.from(typeControls.querySelectorAll('input[type="checkbox"]:checked'))
          .map((control) => control.value)
      );
    }

    function applyKindsFromUrl() {
      const params = new URLSearchParams(global.location.search);
      const configured = ui.clean(params.get("types"));
      const requested = new Set(
        configured
          .split(",")
          .map(ui.clean)
          .filter((kind) => ALL_KINDS.includes(kind))
      );
      typeControls
        .querySelectorAll('input[type="checkbox"]')
        .forEach((control) => {
          control.checked = configured ? requested.has(control.value) : true;
        });
    }

    function writeKindsToUrl() {
      const selected = Array.from(activeKinds());
      ui.updateUrl({
        types:
          selected.length === ALL_KINDS.length
            ? ""
            : selected.length
              ? selected.join(",")
              : "none"
      });
    }

    function edgeLabel(edge) {
      if (edge.kind === "relationship") return ui.humanize(edge.record.relationshipType);
      if (edge.kind === "causal") return ui.humanize(edge.record.causalKind);
      if (edge.kind === "knowledge") return ui.typeLabel(edge.record);
      return "Cultural memory";
    }

    function focusFromUrl() {
      return (
        ui.clean(new URLSearchParams(global.location.search).get("id")) ||
        manifest.defaults.graphCenterId
      );
    }

    function buildNeighborhood(centerId) {
      const enabled = activeKinds();
      const usable = allEdges.filter(
        (edge) =>
          enabled.has(edge.kind) &&
          recordsById.has(edge.from) &&
          recordsById.has(edge.to)
      );
      const max = Number(manifest.graph.maximumNodeLimit || 30);
      const initial = Number(manifest.graph.initialNodeLimit || 18);
      const selectedIds = new Set([centerId]);
      const selectedEdges = [];
      const direct = usable.filter(
        (edge) => edge.from === centerId || edge.to === centerId
      );
      direct.slice(0, max - 1).forEach((edge) => {
        selectedEdges.push(edge);
        selectedIds.add(edge.from);
        selectedIds.add(edge.to);
      });
      if (selectedIds.size < Math.min(initial, max)) {
        usable.forEach((edge) => {
          if (selectedIds.size >= Math.min(initial, max)) return;
          if (!selectedIds.has(edge.from) && !selectedIds.has(edge.to)) return;
          if (!selectedEdges.includes(edge)) selectedEdges.push(edge);
          if (selectedIds.size < max) selectedIds.add(edge.from);
          if (selectedIds.size < max) selectedIds.add(edge.to);
        });
      }
      return {
        records: Array.from(selectedIds)
          .map((id) => recordsById.get(id))
          .filter(Boolean),
        edges: selectedEdges.filter(
          (edge) => selectedIds.has(edge.from) && selectedIds.has(edge.to)
        )
      };
    }

    function positions(records, centerId) {
      const map = new Map([[centerId, { x: 50, y: 50 }]]);
      const remaining = records.filter((record) => record.id !== centerId);
      const firstRingCount = Math.min(10, remaining.length);
      remaining.forEach((record, index) => {
        const firstRing = index < firstRingCount;
        const ringIndex = firstRing ? index : index - firstRingCount;
        const ringCount = firstRing
          ? firstRingCount
          : Math.max(1, remaining.length - firstRingCount);
        const angle =
          -Math.PI / 2 + (Math.PI * 2 * ringIndex) / Math.max(1, ringCount);
        const radiusX = firstRing ? 29 : 44;
        const radiusY = firstRing ? 27 : 41;
        map.set(record.id, {
          x: 50 + Math.cos(angle) * radiusX,
          y: 50 + Math.sin(angle) * radiusY
        });
      });
      return map;
    }

    function renderDetail(record, neighborhood) {
      ui.clear(detail);
      ui.append(
        detail,
        ui.element("p", { className: "hr-kicker", text: "Current graph focus" }),
        ui.element("h2", { text: ui.recordTitle(record) }),
        ui.chip(ui.typeLabel(record), ui.toneForRecord(record))
      );
      const summary = ui.recordSummary(record);
      if (summary) ui.append(detail, ui.element("p", { text: summary }));
      const aliases = ui.aliasesOf(record);
      if (aliases.length) {
        ui.append(
          detail,
          ui.element("p", {
            className: "hr-alias-match",
            text: `Also known as: ${aliases.join(" · ")}`
          })
        );
      }
      const open = ui.element("a", {
        className: "hr-button-secondary",
        text: "Open full record",
        attributes: { href: ui.recordHref(record, { from: "graph" }) }
      });
      ui.append(detail, open);
      const incident = neighborhood.edges.filter(
        (edge) => edge.from === record.id || edge.to === record.id
      );
      if (incident.length) {
        const heading = ui.element("h3", { text: "Visible connections" });
        const relationList = ui.element("ul");
        incident.forEach((edge) => {
          const otherId = edge.from === record.id ? edge.to : edge.from;
          const other = recordsById.get(otherId);
          const item = ui.element("li");
          const line = ui.element("div");
          ui.append(
            line,
            `${edgeLabel(edge)} · `,
            ui.element("a", {
              text: other ? ui.recordTitle(other) : otherId,
              attributes: {
                href: `history-graph-v1.html?${new URLSearchParams({
                  id: otherId
                }).toString()}`
              }
            })
          );
          ui.append(item, line);
          if (edge.record.explanation) {
            ui.append(
              item,
              ui.element("p", { text: edge.record.explanation })
            );
          }
          if (edge.record.uncertainty) {
            ui.append(
              item,
              ui.element("p", {
                className: "hr-attribution",
                text: `Qualification: ${edge.record.uncertainty}`
              })
            );
          }
          if (edge.record.confidence) {
            ui.append(
              item,
              ui.chip(
                `Confidence: ${ui.humanize(edge.record.confidence)}`,
                "confidence"
              )
            );
          }
          ui.append(relationList, item);
        });
        ui.append(detail, heading, relationList);
        detail.querySelectorAll("li a").forEach((link) => {
          link.addEventListener("click", (event) => {
            event.preventDefault();
            selectFocus(
              new URL(link.href).searchParams.get("id"),
              { push: true, focus: true }
            );
          });
        });
      }
    }

    function renderGraph(options) {
      const center = recordsById.get(focusId);
      if (!center) {
        ui.renderState(
          statePanel,
          "empty",
          "The graph focus was not found",
          "Choose another live record through search."
        );
        return;
      }
      ui.hideState(statePanel);
      const neighborhood = buildNeighborhood(focusId);
      const coordinate = positions(neighborhood.records, focusId);
      ui.clear(nodeLayer);
      ui.clear(edgeLayer);
      ui.clear(list);
      edgeLayer.setAttribute("viewBox", "0 0 100 100");
      edgeLayer.setAttribute("preserveAspectRatio", "none");

      neighborhood.edges.forEach((edge) => {
        const from = coordinate.get(edge.from);
        const to = coordinate.get(edge.to);
        if (!from || !to) return;
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("class", "hr-graph-edge");
        line.setAttribute("data-kind", edge.kind === "knowledge" ? "claim" : edge.kind);
        line.setAttribute("x1", String(from.x));
        line.setAttribute("y1", String(from.y));
        line.setAttribute("x2", String(to.x));
        line.setAttribute("y2", String(to.y));
        edgeLayer.appendChild(line);
      });

      neighborhood.records.forEach((record) => {
        const point = coordinate.get(record.id);
        const button = ui.element("button", {
          className: "hr-graph-node",
          attributes: {
            type: "button",
            "data-node-id": record.id,
            "data-tone": ui.toneForRecord(record),
            "data-selected": record.id === focusId ? "true" : "false",
            "aria-pressed": record.id === focusId ? "true" : "false",
            title: `Focus graph on ${ui.recordTitle(record)}`
          }
        });
        button.style.left = `${point.x}%`;
        button.style.top = `${point.y}%`;
        ui.append(
          button,
          ui.element("strong", { text: ui.recordTitle(record) }),
          ui.element("span", { text: ui.typeLabel(record) })
        );
        button.addEventListener("click", () =>
          selectFocus(record.id, { push: true, focus: true })
        );
        ui.append(nodeLayer, button);
      });

      neighborhood.records
        .filter((record) => record.id !== focusId)
        .forEach((record) => ui.append(list, ui.recordCard(record)));
      count.textContent = `${neighborhood.records.length} records · ${neighborhood.edges.length} connections`;
      renderDetail(center, neighborhood);
      if (options && options.focus) {
        const active = nodeLayer.querySelector('[data-selected="true"]');
        if (active) active.focus();
      }
    }

    function selectFocus(recordId, options) {
      if (!recordsById.has(recordId)) return;
      focusId = recordId;
      if (options && options.push) ui.updateUrl({ id: focusId });
      renderGraph(options);
    }

    async function searchFocus(searchTerm) {
      const normalized = ui.clean(searchTerm);
      if (!normalized) {
        query.focus();
        return;
      }
      ui.renderState(
        statePanel,
        "loading",
        "Searching for a graph focus",
        `Looking for “${normalized}” in SourceRoot.`
      );
      try {
        const payload = await client.search(normalized);
        const hit = apiTools
          .itemsFrom(payload)
          .find((item) => recordsById.has(item.id));
        if (!hit) {
          ui.renderState(
            statePanel,
            "empty",
            "No graph record matched",
            "Try a canonical name, alternate name, place, event, or document."
          );
          return;
        }
        selectFocus(hit.id, { push: true, focus: true });
      } catch (error) {
        const display = ui.displayDatasetError(error);
        ui.renderState(
          statePanel,
          display.kind,
          display.title,
          display.message,
          () => searchFocus(normalized)
        );
      }
    }

    async function load() {
      const thisRun = ++loadNumber;
      ui.renderState(
        statePanel,
        "loading",
        "Building a focused knowledge graph",
        "Loading records and explicit connections from SourceRoot."
      );
      stage.setAttribute("aria-busy", "true");
      try {
        await ui.requireDataset(client);
        applyKindsFromUrl();
        const collections = await Promise.all([
          client.contextAll("entities"),
          client.contextAll("claims"),
          client.contextAll("interpretations"),
          client.contextAll("culturalMemories"),
          client.contextAll("relationships"),
          client.contextAll("causalLinks")
        ]);
        if (thisRun !== loadNumber) return;
        const entities = collections[0].items;
        const claims = collections[1].items;
        const interpretations = collections[2].items;
        const memories = collections[3].items;
        const relationships = collections[4].items;
        const causal = collections[5].items;
        const records = ui.dedupeRecords(
          entities.concat(claims, interpretations, memories)
        );
        recordsById = new Map(records.map((record) => [record.id, record]));
        allEdges = relationships
          .map((record) => ({
            kind: "relationship",
            from: record.fromId,
            to: record.toId,
            record
          }))
          .concat(
            causal.map((record) => ({
              kind: "causal",
              from: record.causeId,
              to: record.effectId,
              record
            })),
            claims.map((record) => ({
              kind: "knowledge",
              from: record.subjectId,
              to: record.id,
              record
            })),
            interpretations.map((record) => ({
              kind: "knowledge",
              from: record.subjectId,
              to: record.id,
              record
            })),
            memories.map((record) => ({
              kind: "memory",
              from: record.subjectId,
              to: record.id,
              record
            }))
          );
        focusId = focusFromUrl();
        if (!recordsById.has(focusId)) {
          focusId = entities[0] ? entities[0].id : "";
        }
        stage.setAttribute("aria-busy", "false");
        renderGraph();
      } catch (error) {
        stage.setAttribute("aria-busy", "false");
        const display = ui.displayDatasetError(error);
        ui.renderState(
          statePanel,
          display.kind,
          display.title,
          display.message,
          load
        );
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      searchFocus(query.value);
    });
    typeControls.addEventListener("change", () => {
      writeKindsToUrl();
      renderGraph();
    });
    global.addEventListener("popstate", () => {
      applyKindsFromUrl();
      const next = focusFromUrl();
      if (recordsById.has(next)) {
        focusId = next;
        renderGraph();
      }
    });

    await load();
  }

  start();
})(window);
