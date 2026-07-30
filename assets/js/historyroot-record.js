(function historyRootRecordPage(global) {
  "use strict";

  const ui = global.HistoryRootShared;

  function section(title, kicker, description) {
    const node = ui.element("section", { className: "hr-record-section" });
    const header = ui.element("div", { className: "hr-section-header" });
    const copy = ui.element("div");
    if (kicker) ui.append(copy, ui.element("p", { className: "hr-kicker", text: kicker }));
    ui.append(copy, ui.element("h2", { text: title }));
    if (description) ui.append(copy, ui.element("p", { text: description }));
    ui.append(header, copy);
    ui.append(node, header);
    return node;
  }

  function metadataRow(term, value) {
    const row = ui.element("div", { className: "hr-metadata-row" });
    ui.append(
      row,
      ui.element("dt", { text: term }),
      ui.element("dd", { text: value })
    );
    return row;
  }

  function recordLink(record, text) {
    return ui.element("a", {
      text: text || ui.recordTitle(record),
      attributes: { href: ui.recordHref(record) }
    });
  }

  function sourceLink(source, text) {
    return ui.element("a", {
      text: text || source.name || source.sourceId,
      attributes: { href: ui.sourceHref(source.sourceId) }
    });
  }

  function sourceMiniCard(source) {
    const card = ui.element("article", { className: "hr-source-card" });
    const heading = ui.element("div", { className: "hr-source-card-heading" });
    const title = ui.element("h3");
    ui.append(title, sourceLink(source));
    ui.append(
      heading,
      title,
      ui.chip(ui.sourceClassLabel(source), "source")
    );
    ui.append(card, heading);
    if (source.publisher) {
      ui.append(card, ui.element("p", { text: source.publisher }));
    }
    const status = source.accessStatus || source.verificationStatus;
    if (status) {
      ui.append(card, ui.chip(ui.statusLabel(status), "confidence"));
    }
    if (source.limitations) {
      ui.append(
        card,
        ui.element("p", {
          className: "hr-source-limitation",
          text: `Limitation: ${source.limitations}`
        })
      );
    }
    return card;
  }

  function temporalCard(temporal) {
    const card = ui.element("article", { className: "hr-timeline-card" });
    const date = ui.element("div", { className: "hr-timeline-date" });
    ui.append(
      date,
      ui.element("strong", { text: temporal.dateLabel || "Date not specified" }),
      ui.element("span", { text: ui.temporalPrecisionLabel(temporal) })
    );
    const copy = ui.element("div");
    const uncertainty = ui.temporalUncertainty(temporal);
    if (temporal.calendarSystem) {
      ui.append(
        copy,
        ui.element("p", {
          text: `Calendar: ${ui.humanize(temporal.calendarSystem)}`
        })
      );
    }
    if (uncertainty) {
      ui.append(copy, ui.element("p", { className: "hr-attribution", text: uncertainty }));
    }
    ui.append(card, date, copy);
    return card;
  }

  function accountCard(account, recordsById, sourcesById) {
    const card = ui.element("article", { className: "hr-account-card" });
    const heading = ui.element("h3", { text: ui.recordTitle(account) });
    ui.append(card, heading);
    if (account.content) ui.append(card, ui.element("p", { text: account.content }));
    const attribution = [];
    const author = recordsById.get(account.authorEntityId);
    if (author) attribution.push(`Attributed author: ${ui.recordTitle(author)}`);
    if (account.publicationLabel) attribution.push(account.publicationLabel);
    if (attribution.length) {
      ui.append(
        card,
        ui.element("p", {
          className: "hr-attribution",
          text: attribution.join(" · ")
        })
      );
    }
    const source = sourcesById.get(account.sourceId);
    if (source) {
      const line = ui.element("p");
      ui.append(line, "Source: ", sourceLink(source));
      ui.append(card, line);
    }
    return card;
  }

  function evidenceCard(evidence, sourcesById) {
    const card = ui.element("article", {
      className: "hr-evidence-card",
      attributes: { "data-evidence-type": evidence.evidenceType }
    });
    ui.append(
      card,
      ui.chip(
        evidence.evidenceType === "counterevidence"
          ? "Counterevidence"
          : "Supporting evidence",
        "evidence"
      ),
      ui.element("p", { text: evidence.explanation })
    );
    const metadata = evidence.metadata || {};
    if (metadata.locator) {
      ui.append(
        card,
        ui.element("p", {
          className: "hr-source-locator",
          text: `Locator: ${metadata.locator}`
        })
      );
    }
    if (metadata.limitation) {
      ui.append(
        card,
        ui.element("p", {
          className: "hr-source-limitation",
          text: `Evidence limit: ${metadata.limitation}`
        })
      );
    }
    const source = sourcesById.get(evidence.sourceId);
    if (source) {
      const line = ui.element("p");
      ui.append(line, "Source: ", sourceLink(source));
      ui.append(card, line);
    }
    if (evidence.strength || evidence.confidence) {
      ui.append(
        card,
        ui.chip(
          `Strength: ${ui.humanize(evidence.strength || evidence.confidence)}`,
          "confidence"
        )
      );
    }
    return card;
  }

  function claimCard(claim, evidence, sourcesById) {
    const card = ui.element("article", { className: "hr-claim-card" });
    const heading = ui.element("div", { className: "hr-record-card-heading" });
    ui.append(
      heading,
      ui.element("h3", { text: ui.recordTitle(claim) }),
      ui.chip(`Confidence: ${ui.humanize(claim.confidence || "not stated")}`, "claim")
    );
    ui.append(card, heading, ui.element("p", { text: claim.statement }));
    if (claim.uncertainty) {
      ui.append(
        card,
        ui.element("p", {
          className: "hr-attribution",
          text: `Qualification: ${claim.uncertainty}`
        })
      );
    }
    const locator = claim.metadata && claim.metadata.locator;
    if (locator) {
      ui.append(
        card,
        ui.element("p", {
          className: "hr-source-locator",
          text: `Claim locator: ${locator}`
        })
      );
    }
    const evidenceStack = ui.element("div", { className: "hr-evidence-stack" });
    evidence
      .filter((item) => item.claimId === claim.id)
      .forEach((item) => ui.append(evidenceStack, evidenceCard(item, sourcesById)));
    if (evidenceStack.childNodes.length) ui.append(card, evidenceStack);
    return card;
  }

  function interpretationCard(record, perspectivesById, sourcesById) {
    const card = ui.element("article", { className: "hr-interpretation-card" });
    ui.append(
      card,
      ui.element("h3", { text: ui.recordTitle(record) }),
      ui.element("p", { text: record.interpretation })
    );
    if (record.uncertainty) {
      ui.append(
        card,
        ui.element("p", {
          className: "hr-attribution",
          text: `Interpretive limit: ${record.uncertainty}`
        })
      );
    }
    const links = Array.isArray(record.perspectiveLinks)
      ? record.perspectiveLinks
      : [];
    const perspectiveIds = new Set(
      links
        .map((link) => link.perspectiveId)
        .concat(record.metadata && record.metadata.perspectiveId)
        .filter(Boolean)
    );
    perspectiveIds.forEach((id) => {
      const perspective = perspectivesById.get(id);
      if (perspective) {
        const line = ui.element("p");
        ui.append(line, "Attributed perspective: ", recordLink(perspective));
        ui.append(card, line);
      }
    });
    links.forEach((link) => {
      if (link.notes) {
        ui.append(
          card,
          ui.element("p", { className: "hr-attribution", text: link.notes })
        );
      }
    });
    const source = sourcesById.get(record.sourceId);
    if (source) {
      const line = ui.element("p");
      ui.append(line, "Source: ", sourceLink(source));
      ui.append(card, line);
    }
    return card;
  }

  function causalCard(link, selectedId, recordsById) {
    const card = ui.element("article", { className: "hr-causal-card" });
    const incoming = link.effectId === selectedId;
    const otherId = incoming ? link.causeId : link.effectId;
    const other = recordsById.get(otherId);
    ui.append(
      card,
      ui.chip(incoming ? "Contributing cause or context" : "Consequence", "causal"),
      ui.element("h3", {
        text: other
          ? ui.recordTitle(other)
          : incoming
            ? "Related cause or context"
            : "Related consequence"
      }),
      ui.element("p", { text: link.explanation })
    );
    if (other) {
      const line = ui.element("p");
      ui.append(line, recordLink(other, "Open related record"));
      ui.append(card, line);
    }
    if (link.uncertainty) {
      ui.append(
        card,
        ui.element("p", {
          className: "hr-attribution",
          text: `Causal qualification: ${link.uncertainty}`
        })
      );
    }
    if (link.confidence) {
      ui.append(
        card,
        ui.chip(`Confidence: ${ui.humanize(link.confidence)}`, "confidence")
      );
    }
    return card;
  }

  function relationshipCard(relationship, selectedId, recordsById) {
    const card = ui.element("article", { className: "hr-record-card" });
    const otherId =
      relationship.fromId === selectedId
        ? relationship.toId
        : relationship.fromId;
    const other = recordsById.get(otherId);
    ui.append(
      card,
      ui.chip(ui.humanize(relationship.relationshipType), "entity")
    );
    const heading = ui.element("h3");
    if (other) ui.append(heading, recordLink(other));
    else heading.textContent = ui.recordTitle(relationship);
    ui.append(card, heading);
    if (relationship.explanation) {
      ui.append(card, ui.element("p", { text: relationship.explanation }));
    }
    if (relationship.uncertainty) {
      ui.append(
        card,
        ui.element("p", {
          className: "hr-attribution",
          text: relationship.uncertainty
        })
      );
    }
    return card;
  }

  function transmissionCard(relationship, recordsById) {
    const from = recordsById.get(relationship.fromId);
    const to = recordsById.get(relationship.toId);
    const card = ui.element("article", { className: "hr-record-card" });
    ui.append(
      card,
      ui.chip(ui.humanize(relationship.relationshipType), "source")
    );
    const heading = ui.element("h3");
    if (from) ui.append(heading, recordLink(from));
    else heading.textContent = relationship.fromId;
    ui.append(heading, " → ");
    if (to) ui.append(heading, recordLink(to));
    else ui.append(heading, relationship.toId);
    ui.append(card, heading);
    if (relationship.explanation) {
      ui.append(card, ui.element("p", { text: relationship.explanation }));
    }
    [from, to].filter(Boolean).forEach((record) => {
      if (record.metadata && record.metadata.originalLost === true) {
        ui.append(card, ui.chip("Original does not survive", "memory"));
      }
    });
    return card;
  }

  function memoryCard(memory, perspectivesById, sourcesById) {
    const card = ui.element("article", { className: "hr-memory-card" });
    ui.append(
      card,
      ui.chip(ui.humanize(memory.memoryType), "memory"),
      ui.element("h3", { text: ui.recordTitle(memory) }),
      ui.element("p", { text: memory.narrative })
    );
    if (memory.periodLabel) {
      ui.append(card, ui.element("p", { className: "hr-attribution", text: memory.periodLabel }));
    }
    const perspective = perspectivesById.get(memory.perspectiveId);
    if (perspective) {
      const line = ui.element("p");
      ui.append(line, "Perspective: ", recordLink(perspective));
      ui.append(card, line);
    }
    const source = sourcesById.get(memory.sourceId);
    if (source) {
      const line = ui.element("p");
      ui.append(line, "Source: ", sourceLink(source));
      ui.append(card, line);
    }
    return card;
  }

  function dictionaryDiscoveryPanel() {
    const panel = ui.element("section", {
      className: "hr-cross-root-discovery",
      attributes: { "aria-labelledby": "historyrootDictionaryDiscoveryTitle" }
    });
    const title = ui.element("h2", {
      id: "historyrootDictionaryDiscoveryTitle",
      text: "Compare possible meanings in DictionaryRoot"
    });
    const explanation = ui.element("p", {
      text:
        "Choose a word from this historical record to inspect possible lexical senses. A modern DictionaryRoot definition does not establish what a historical speaker or source intended."
    });
    const form = ui.element("form", {
      className: "hr-cross-root-form",
      attributes: {
        action: "sourceroot-search.html",
        method: "get",
        role: "search",
        "aria-label": "Look up a term from this record in DictionaryRoot"
      }
    });
    const label = ui.element("label", {
      className: "hr-sr-only",
      text: "Word to look up",
      attributes: { for: "historyrootDictionaryDiscoveryTerm" }
    });
    const input = ui.element("input", {
      id: "historyrootDictionaryDiscoveryTerm",
      attributes: {
        name: "q",
        type: "search",
        autocomplete: "off",
        required: "required",
        placeholder: "Enter a word from this record"
      }
    });
    const roots = ui.element("input", {
      attributes: {
        name: "roots",
        type: "hidden",
        value: "DictionaryRoot"
      }
    });
    const resultTypes = ui.element("input", {
      attributes: {
        name: "resultTypes",
        type: "hidden",
        value: "lexical-sense"
      }
    });
    const page = ui.element("input", {
      attributes: { name: "page", type: "hidden", value: "1" }
    });
    const button = ui.element("button", {
      text: "Look up possible meanings",
      attributes: { type: "submit" }
    });
    ui.append(form, label, input, roots, resultTypes, page, button);
    ui.append(panel, title, explanation, form);
    return panel;
  }

  async function start() {
    const { client } = await ui.initialize();
    const state = document.querySelector("#historyrootRecordState");
    const article = document.querySelector("#historyrootRecord");
    const title = document.querySelector("#historyrootRecordTitle");
    const summary = document.querySelector("#historyrootRecordSummary");
    const type = document.querySelector("#historyrootRecordType");
    const chips = document.querySelector("#historyrootRecordChips");
    const aliases = document.querySelector("#historyrootRecordAliases");
    const namingNote = document.querySelector("#historyrootRecordNamingNote");
    const sections = document.querySelector("#historyrootRecordSections");
    const graphLink = document.querySelector("#historyrootRecordGraphLink");
    const timelineLink = document.querySelector("#historyrootRecordTimelineLink");
    const contextReviewLink = document.querySelector(
      "#historyrootRecordContextReviewLink"
    );
    const metadataPanel = document.querySelector("#historyrootRecordMetadataPanel");
    const metadataList = document.querySelector("#historyrootRecordMetadata");
    const recordId = ui.clean(new URLSearchParams(global.location.search).get("id"));

    async function load() {
      article.hidden = true;
      ui.renderState(
        state,
        "loading",
        recordId ? "Loading the historical record" : "Choose a record",
        recordId
          ? "Gathering context, evidence, sources, and relationships from SourceRoot."
          : "Open a result from Explore, Timeline, Sources, or the Knowledge Graph."
      );
      if (!recordId) return;

      try {
        await ui.requireDataset(client);
        const record = await client.record(recordId);
        const subjectId = record.subjectId || record.id;
        const collectionRequests = await Promise.all([
          client.contextAll("temporalAssertions", { subjectId }),
          client.contextAll("accounts", { subjectId }),
          client.contextAll("claims", { subjectId }),
          client.contextAll("interpretations", { subjectId }),
          client.contextAll("culturalMemories", { subjectId }),
          client.contextAll("relationships"),
          client.contextAll("causalLinks"),
          client.contextAll("evidence"),
          client.contextAll("perspectives")
        ]);
        const temporals = collectionRequests[0].items;
        const accounts = collectionRequests[1].items;
        const claims = collectionRequests[2].items;
        const interpretations = collectionRequests[3].items;
        const memories = collectionRequests[4].items;
        const allRelationships = collectionRequests[5].items;
        const allCausal = collectionRequests[6].items;
        const allEvidence = collectionRequests[7].items;
        const perspectives = collectionRequests[8].items;
        const relationships = allRelationships.filter(
          (link) => link.fromId === record.id || link.toId === record.id
        );
        const transmissionTypes = new Set([
          "created_document",
          "embodied_work",
          "textual_witness_of",
          "edition_of",
          "transcription_of",
          "version_of"
        ]);
        const transmissionRelationships = [];
        let transmissionFrontier = new Set([record.id]);
        const transmissionSeen = new Set([record.id]);
        for (let depth = 0; depth < 3; depth += 1) {
          const next = new Set();
          allRelationships.forEach((link) => {
            if (
              !transmissionTypes.has(link.relationshipType) ||
              (!transmissionFrontier.has(link.fromId) &&
                !transmissionFrontier.has(link.toId))
            ) {
              return;
            }
            if (!transmissionRelationships.some((item) => item.id === link.id)) {
              transmissionRelationships.push(link);
            }
            [link.fromId, link.toId].forEach((id) => {
              if (!transmissionSeen.has(id)) {
                transmissionSeen.add(id);
                next.add(id);
              }
            });
          });
          transmissionFrontier = next;
        }
        const causal = allCausal.filter(
          (link) => link.causeId === record.id || link.effectId === record.id
        );
        const perspectiveIds = new Set(
          interpretations
            .flatMap((item) =>
              (item.perspectiveLinks || []).map((link) => link.perspectiveId)
            )
            .concat(
              interpretations.map(
                (item) => item.metadata && item.metadata.perspectiveId
              ),
              memories.map((item) => item.perspectiveId),
              record.perspectiveLinks
                ? record.perspectiveLinks.map((link) => link.perspectiveId)
                : []
            )
            .filter(Boolean)
        );
        const relationshipIds = relationships
          .concat(transmissionRelationships)
          .flatMap((link) => [link.fromId, link.toId]);
        const causalIds = causal.flatMap((link) => [link.causeId, link.effectId]);
        const authorIds = accounts.map((account) => account.authorEntityId);
        const relatedRecords = await client.recordsByIds(
          Array.from(
            new Set(
              relationshipIds
                .concat(causalIds, authorIds, Array.from(perspectiveIds))
                .filter(Boolean)
            )
          )
        );
        const recordsById = new Map(
          relatedRecords.concat([record, ...perspectives]).map((item) => [item.id, item])
        );
        const perspectivesById = new Map(
          perspectives.map((item) => [item.id, item])
        );

        const sourceIds = new Set(
          [record]
            .concat(
              temporals,
              accounts,
              claims,
              interpretations,
              memories,
              relationships,
              causal,
              allEvidence.filter((item) =>
                claims.some((claim) => claim.id === item.claimId)
              )
            )
            .flatMap(ui.sourceIdsOf)
        );
        const sourceValues = await Promise.all(
          Array.from(sourceIds).map(async (sourceId) => {
            try {
              return await client.source(sourceId);
            } catch (_) {
              return null;
            }
          })
        );
        const sources = sourceValues.filter(Boolean);
        const sourcesById = new Map(
          sources.map((source) => [source.sourceId, source])
        );
        const evidence = allEvidence.filter((item) =>
          claims.some((claim) => claim.id === item.claimId)
        );

        title.textContent = ui.recordTitle(record);
        document.title = `${ui.recordTitle(record)} | HistoryRoot`;
        type.textContent = ui.typeLabel(record);
        summary.textContent = ui.recordSummary(record);
        summary.hidden = !ui.recordSummary(record);
        ui.clear(chips);
        ui.append(chips, ui.chip(ui.typeLabel(record), ui.toneForRecord(record)));
        const scope = ui.scopeLabel(record);
        if (scope) ui.append(chips, ui.chip(scope, "scope"));
        if (record.confidence) {
          ui.append(
            chips,
            ui.chip(`Confidence: ${ui.humanize(record.confidence)}`, "confidence")
          );
        }
        if (record.metadata && record.metadata.originalLost === true) {
          ui.append(chips, ui.chip("Original document lost", "memory"));
        }

        ui.clear(aliases);
        const alternateNames = ui.aliasesOf(record);
        if (alternateNames.length) {
          ui.append(
            aliases,
            ui.element("strong", { text: "Also known as" }),
            ui.element("span", { text: alternateNames.join(" · ") })
          );
          aliases.hidden = false;
        } else {
          aliases.hidden = true;
        }
        const note = ui.clean(record.metadata && record.metadata.namingNote);
        namingNote.textContent = note;
        namingNote.hidden = !note;
        graphLink.href = ui.graphHref(record.id);
        timelineLink.href = ui.timelineHref(record.id);
        contextReviewLink.hidden = claims.length === 0;
        if (claims.length) {
          contextReviewLink.href = ui.contextReviewHref(
            subjectId,
            claims[0].id,
            "",
            "record"
          );
        }

        ui.clear(sections);
        if (temporals.length) {
          const node = section(
            "Chronology",
            "When",
            "Dates retain the precision, calendar, and uncertainty supplied by the dataset."
          );
          temporals
            .sort((left, right) => ui.temporalSortValue(left) - ui.temporalSortValue(right))
            .forEach((temporal) => ui.append(node, temporalCard(temporal)));
          ui.append(sections, node);
        }
        if (accounts.length) {
          const node = section(
            "Historical accounts",
            "Attributed testimony",
            "Accounts are presented as situated sources, not as a neutral narrator."
          );
          const grid = ui.element("div", { className: "hr-record-section-grid" });
          accounts.forEach((account) =>
            ui.append(grid, accountCard(account, recordsById, sourcesById))
          );
          ui.append(node, grid);
          ui.append(sections, node);
        }
        if (claims.length) {
          const node = section(
            "Claims and evidence",
            "What the record supports",
            "Each claim keeps its supporting evidence, locator, confidence, and stated limits together."
          );
          claims.forEach((claim) =>
            ui.append(node, claimCard(claim, evidence, sourcesById))
          );
          ui.append(sections, node);
        }
        if (interpretations.length) {
          const node = section(
            "Interpretations and perspectives",
            "How the record is read",
            "Interpretations remain attributed and qualified; no perspective is presented as universal."
          );
          interpretations.forEach((item) =>
            ui.append(
              node,
              interpretationCard(item, perspectivesById, sourcesById)
            )
          );
          ui.append(sections, node);
        }
        if (causal.length) {
          const node = section(
            "Causes and consequences",
            "Qualified connections",
            "These are explicit, reviewable causal assertions—not deterministic arrows."
          );
          const grid = ui.element("div", { className: "hr-record-section-grid" });
          causal.forEach((link) =>
            ui.append(grid, causalCard(link, record.id, recordsById))
          );
          ui.append(node, grid);
          ui.append(sections, node);
        }
        if (relationships.length) {
          const node = section(
            "Related people, places, events, and documents",
            "Documented relationships",
            "Open another canonical record to continue through the knowledge network."
          );
          const grid = ui.element("div", { className: "hr-record-section-grid" });
          relationships.forEach((link) =>
            ui.append(grid, relationshipCard(link, record.id, recordsById))
          );
          ui.append(node, grid);
          ui.append(sections, node);
        }
        if (transmissionRelationships.length) {
          const node = section(
            "Document and textual transmission",
            "Works, originals, editions, and witnesses",
            "Conceptual works and surviving textual witnesses remain distinct; a lost original is never presented as a surviving object."
          );
          const grid = ui.element("div", { className: "hr-record-section-grid" });
          transmissionRelationships.forEach((link) =>
            ui.append(grid, transmissionCard(link, recordsById))
          );
          ui.append(node, grid);
          ui.append(sections, node);
        }
        if (memories.length) {
          const node = section(
            "Cultural memory and afterlife",
            "Later meaning",
            "Later commemoration is separated from the event chronology."
          );
          memories.forEach((item) =>
            ui.append(node, memoryCard(item, perspectivesById, sourcesById))
          );
          ui.append(sections, node);
        }
        if (sources.length) {
          const node = section(
            "Sources",
            "Provenance",
            "Review source classification and limits before following the external record."
          );
          const grid = ui.element("div", { className: "hr-source-grid" });
          sources.forEach((source) => ui.append(grid, sourceMiniCard(source)));
          ui.append(node, grid);
          ui.append(sections, node);
        }
        ui.append(sections, dictionaryDiscoveryPanel());

        ui.clear(metadataList);
        const metadataRows = [
          ["Stable ID", record.id],
          ["Record status", ui.statusLabel(record.status)],
          ["Dataset", record.bundleId],
          ["Updated", record.updatedAt ? record.updatedAt.slice(0, 10) : ""]
        ].filter((row) => row[1]);
        metadataRows.forEach(([term, value]) =>
          ui.append(metadataList, metadataRow(term, value))
        );
        metadataPanel.hidden = !metadataRows.length;
        ui.hideState(state);
        article.hidden = false;
      } catch (error) {
        const display = ui.displayDatasetError(error);
        ui.renderState(
          state,
          display.kind,
          display.title,
          display.message,
          load
        );
      }
    }

    await load();
  }

  start();
})(window);
