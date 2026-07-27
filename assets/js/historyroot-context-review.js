(function historyRootContextReviewFactory(root, factory) {
  "use strict";

  const api = factory(root);
  root.HistoryRootContextReview = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (
    root.document &&
    root.HistoryRootShared &&
    root.HistoryRootApi
  ) {
    api.start();
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function createHistoryRootContextReview(global) {
    "use strict";

    const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
    const EVIDENCE_ORDER = [
      "supports",
      "disputes",
      "qualifies",
      "contextualizes",
      "neutral_or_background",
      "corroborates",
      "contradicts",
      "legacy_unclassified"
    ];
    const RELATION_ORDER = [
      "contradicts",
      "qualifies",
      "refines",
      "restates",
      "supersedes",
      "corrects",
      "retracts",
      "derived_from"
    ];
    const ATTRIBUTION_ORDER = [
      "asserted_by",
      "attributed_to",
      "reported_by",
      "recorded_by",
      "issued_by"
    ];

    function clean(value) {
      return String(value == null ? "" : value).trim();
    }

    function isSafeId(value) {
      return SAFE_ID.test(clean(value));
    }

    function parseUrlState(search) {
      const params = new URLSearchParams(search || "");
      const record = clean(params.get("record"));
      const claim = clean(params.get("claim"));
      const version = clean(params.get("version"));
      const from = clean(params.get("from"));
      if (!record && !claim) {
        return {
          valid: false,
          code: "MISSING_REVIEW_TARGET",
          message: "Provide a record or claim identifier."
        };
      }
      for (const [field, value] of Object.entries({ record, claim, version })) {
        if (value && !isSafeId(value)) {
          return {
            valid: false,
            code: "MALFORMED_REVIEW_TARGET",
            field,
            message: `${field} is not a valid SourceRoot identifier.`
          };
        }
      }
      if (version && !claim) {
        return {
          valid: false,
          code: "VERSION_REQUIRES_CLAIM",
          field: "version",
          message: "A historical version must be paired with its claim."
        };
      }
      return { valid: true, record, claim, version, from };
    }

    function reviewHref(recordId, claimId, versionId, from) {
      const query = new URLSearchParams();
      if (recordId) query.set("record", clean(recordId));
      if (claimId) query.set("claim", clean(claimId));
      if (versionId) query.set("version", clean(versionId));
      if (from) query.set("from", clean(from));
      return `history-context-review-v1.html?${query.toString()}`;
    }

    function groupBy(items, key, missingKey) {
      return (items || []).reduce((groups, item) => {
        const raw = item && item[key];
        const group = clean(raw) || missingKey;
        if (!groups[group]) groups[group] = [];
        groups[group].push(item);
        return groups;
      }, {});
    }

    function orderedKeys(groups, preferred) {
      const keys = Object.keys(groups || {});
      const ranks = new Map((preferred || []).map((value, index) => [value, index]));
      return keys.sort((left, right) => {
        const leftRank = ranks.has(left) ? ranks.get(left) : Number.MAX_SAFE_INTEGER;
        const rightRank = ranks.has(right) ? ranks.get(right) : Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank || left.localeCompare(right);
      });
    }

    function requestIdFromError(error) {
      return clean(
        error &&
          error.details &&
          (error.details.responseRequestId || error.details.requestId)
      );
    }

    function errorDisplay(error) {
      const details = (error && error.details) || {};
      const code = clean(details.code);
      const status = Number(details.status || 0);
      if (status === 403 || details.category === "forbidden") {
        return {
          kind: "permission",
          title: "This review is not visible",
          message: "SourceRoot denied access to the requested contextual review."
        };
      }
      if (
        code === "CONTEXT_REVIEW_RECORD_NOT_FOUND" ||
        code === "CONTEXT_REVIEW_CLAIM_NOT_FOUND"
      ) {
        return {
          kind: "not-found",
          title: "The requested review was not found",
          message: clean(error.message)
        };
      }
      if (code === "CONTEXT_REVIEW_VERSION_NOT_FOUND") {
        return {
          kind: "version-not-found",
          title: "The historical version was not found",
          message: clean(error.message)
        };
      }
      if (code === "MALFORMED_RESPONSE") {
        return {
          kind: "unexpected-response",
          title: "The review response could not be used",
          message: "SourceRoot returned an unexpected response shape."
        };
      }
      if (code === "TIMEOUT") {
        return {
          kind: "timeout",
          title: "The review request timed out",
          message: "SourceRoot did not return the contextual review in time."
        };
      }
      if (code === "ABORTED") {
        return {
          kind: "aborted",
          title: "The request was cancelled",
          message: "A newer claim selection replaced this request."
        };
      }
      return {
        kind: "offline",
        title: "The Context API is unavailable",
        message:
          "HistoryRoot could not reach the live SourceRoot review API. No fallback claims are displayed."
      };
    }

    function start() {
      const ui = global.HistoryRootShared;
      const apiTools = global.HistoryRootApi;

      return ui.initialize().then(({ client }) => {
        const nodes = {
          live: document.querySelector("#historyrootContextReviewLive"),
          state: document.querySelector("#historyrootContextReviewState"),
          article: document.querySelector("#historyrootContextReview"),
          back: document.querySelector("#historyrootContextReviewBack"),
          title: document.querySelector("#historyrootContextReviewTitle"),
          summary: document.querySelector("#historyrootContextReviewSummary"),
          recordChips: document.querySelector("#historyrootContextReviewRecordChips"),
          claimFilter: document.querySelector("#historyrootContextClaimFilter"),
          claimCount: document.querySelector("#historyrootContextClaimCount"),
          claimList: document.querySelector("#historyrootContextClaimList"),
          claimPagination: document.querySelector("#historyrootContextClaimPagination"),
          claimPrevious: document.querySelector("#historyrootContextClaimPrevious"),
          claimNext: document.querySelector("#historyrootContextClaimNext"),
          switching: document.querySelector("#historyrootContextSwitching"),
          primary: document.querySelector("#historyrootContextPrimary"),
          account: document.querySelector("#historyrootContextAccount"),
          sources: document.querySelector("#historyrootContextSources"),
          evidence: document.querySelector("#historyrootContextEvidence"),
          relations: document.querySelector("#historyrootContextRelations"),
          versions: document.querySelector("#historyrootContextVersions"),
          provenance: document.querySelector("#historyrootContextProvenance"),
          diagnostics: document.querySelector("#historyrootContextDiagnostics"),
          diagnosticsBody: document.querySelector("#historyrootContextDiagnosticsBody")
        };
        let recordPayload = null;
        let claimPayload = null;
        let claimPage = 1;
        let activeRequest = null;
        let navigationRun = 0;
        let currentUrlState = parseUrlState(global.location.search);
        let missingVersionId = "";

        function createRequestController() {
          return typeof client.createAbortController === "function"
            ? client.createAbortController()
            : new AbortController();
        }

        function announce(message) {
          nodes.live.textContent = message;
        }

        function sectionHeader(container, id, kicker, title, description) {
          ui.clear(container);
          const header = ui.element("div", { className: "hr-section-header" });
          const copy = ui.element("div");
          if (kicker) {
            ui.append(copy, ui.element("p", { className: "hr-kicker", text: kicker }));
          }
          ui.append(copy, ui.element("h2", { id, text: title }));
          if (description) ui.append(copy, ui.element("p", { text: description }));
          ui.append(header, copy);
          ui.append(container, header);
        }

        function missing(message) {
          return ui.element("p", { className: "hr-review-missing", text: message });
        }

        function fact(term, value) {
          const row = ui.element("div", { className: "hr-review-fact" });
          ui.append(
            row,
            ui.element("dt", { text: term }),
            ui.element("dd", { text: clean(value) || "Not recorded" })
          );
          return row;
        }

        function sourceMap() {
          return new Map(
            (((claimPayload || {}).sources || {}).items || []).map((source) => [
              source.sourceId,
              source
            ])
          );
        }

        function sourceReference(sourceId, sourcesById) {
          const source = sourcesById.get(sourceId);
          if (!source) {
            return ui.element("span", {
              text: sourceId ? `Source unavailable (${sourceId})` : "Source not recorded"
            });
          }
          return ui.element("a", {
            text: source.name || source.sourceId,
            attributes: { href: ui.sourceHref(source.sourceId) }
          });
        }

        function renderRecordHeader(record) {
          const fallback = (claimPayload && claimPayload.claim) || {};
          nodes.title.textContent = record
            ? ui.recordTitle(record)
            : "Contextual claim review";
          nodes.summary.textContent = record ? ui.recordSummary(record) : "";
          nodes.summary.hidden = !nodes.summary.textContent;
          ui.clear(nodes.recordChips);
          if (record) {
            ui.append(
              nodes.recordChips,
              ui.chip(ui.typeLabel(record), ui.toneForRecord(record)),
              ui.chip(`Stable ID: ${record.id}`, "scope")
            );
            if (record.status) {
              ui.append(
                nodes.recordChips,
                ui.chip(`Record status: ${ui.statusLabel(record.status)}`, "confidence")
              );
            }
            document.title = `${ui.recordTitle(record)} context review | HistoryRoot`;
          } else {
            ui.append(
              nodes.recordChips,
              ui.chip(`Claim: ${fallback.id || "unavailable"}`, "claim")
            );
          }
          const from = currentUrlState.from;
          if (record && from === "graph") {
            nodes.back.href = ui.graphHref(record.id);
            nodes.back.textContent = "Back to Knowledge Graph";
          } else if (record) {
            nodes.back.href = ui.recordHref(record, { from: "context-review" });
            nodes.back.textContent = "Back to full record";
          } else {
            nodes.back.href = "historyroot.html";
            nodes.back.textContent = "Back to HistoryRoot";
          }
        }

        function renderClaimList() {
          ui.clear(nodes.claimList);
          if (!recordPayload) {
            nodes.claimCount.textContent = "The parent record is unavailable.";
            ui.append(nodes.claimList, missing("Claim selection could not be loaded."));
            nodes.claimPagination.hidden = true;
            return;
          }
          const query = clean(nodes.claimFilter.value).toLocaleLowerCase();
          const claims = (recordPayload.claims || []).filter((claim) =>
            [
              claim.id,
              claim.label,
              claim.statement,
              claim.claimType,
              claim.status
            ]
              .map(clean)
              .join(" ")
              .toLocaleLowerCase()
              .includes(query)
          );
          nodes.claimCount.textContent = query
            ? `${claims.length} matching claims on this page`
            : `${recordPayload.returned} of ${recordPayload.total} visible claims`;
          if (!claims.length) {
            ui.append(
              nodes.claimList,
              missing(
                query
                  ? "No claim on this page matches the filter."
                  : "This record has no visible contextual claims."
              )
            );
          }
          claims.forEach((claim) => {
            const counts = claim.counts || {};
            const selected =
              claimPayload && claimPayload.claim && claimPayload.claim.id === claim.id;
            const button = ui.element("button", {
              className: "hr-review-claim-button",
              attributes: {
                type: "button",
                "aria-current": selected ? "true" : "false",
                "data-claim-id": claim.id
              }
            });
            ui.append(
              button,
              ui.element("strong", { text: claim.statement || claim.label || claim.id }),
              ui.element("span", {
                text:
                  `${ui.statusLabel(claim.status) || "Status not recorded"} · ` +
                  `${Number(counts.evidence || 0)} evidence links · ` +
                  `${Number(counts.relationships || 0)} relationships · ` +
                  `${Number(counts.versions || 0)} versions`
              })
            );
            button.addEventListener("click", () => selectClaim(claim.id));
            ui.append(nodes.claimList, button);
          });
          const pagination = recordPayload.pagination || recordPayload;
          nodes.claimPagination.hidden =
            Number(pagination.totalPages || 0) <= 1;
          nodes.claimPrevious.disabled = claimPage <= 1;
          nodes.claimNext.disabled = !pagination.hasMore;
        }

        function renderPrimary() {
          const payload = claimPayload;
          const claim = payload.claim;
          const selected = payload.selectedVersion;
          const current = payload.currentVersion;
          sectionHeader(
            nodes.primary,
            "historyroot-context-primary-title",
            "Primary claim review",
            claim.label || "Contextual claim",
            "Claim wording is presented as a recorded statement. Confidence and uncertainty retain their exact claim scope."
          );
          if (missingVersionId) {
            ui.append(
              nodes.primary,
              ui.element("div", {
                className: "hr-review-partial",
                text:
                  `Historical version ${missingVersionId} is missing or not visible. The current claim is shown instead.`
              })
            );
          }
          const banner = ui.element("div", {
            className: "hr-review-state-banner",
            attributes: { "data-state": payload.displayState }
          });
          const stateLabel =
            payload.displayState === "historical"
              ? "Historical version"
              : payload.displayState === "legacy-current"
                ? "Current legacy projection"
                : payload.displayState === "current-pointer-missing"
                  ? "Current projection — version pointer unavailable"
                : "Current wording";
          ui.append(banner, ui.element("strong", { text: stateLabel }));
          if (payload.displayState === "historical") {
            ui.append(
              banner,
              ui.element("a", {
                className: "hr-button-secondary",
                text: "Return to current wording",
                attributes: {
                  href: reviewHref(
                    payload.record && payload.record.id,
                    claim.id,
                    "",
                    currentUrlState.from
                  )
                }
              })
            );
          }
          ui.append(nodes.primary, banner);
          ui.append(
            nodes.primary,
            ui.element("p", {
              className: "hr-review-statement",
              text: payload.selectedStatement || claim.statement || "Statement not recorded"
            })
          );
          if (payload.displayState === "historical") {
            const comparison = ui.element("div", {
              className: "hr-review-current-comparison"
            });
            ui.append(
              comparison,
              ui.element("strong", { text: "Current claim statement" }),
              ui.element("p", { text: payload.currentStatement || "Not recorded" })
            );
            ui.append(nodes.primary, comparison);
          }
          if (payload.displayState === "legacy-current") {
            ui.append(
              nodes.primary,
              missing(
                "No recorded immutable version history is available. The displayed text is the current legacy claim projection; no version was fabricated."
              )
            );
          }
          if (payload.displayState === "current-pointer-missing") {
            ui.append(
              nodes.primary,
              missing(
                "Immutable versions exist, but no visible current-version pointer is available. The current claim projection is shown without inventing a version selection."
              )
            );
          }
          const facts = ui.element("dl", { className: "hr-review-facts" });
          [
            ["Stable claim ID", claim.id],
            ["Claim type", ui.humanize(claim.claimType)],
            ["Claim status", ui.statusLabel(claim.status)],
            ["Display state", stateLabel],
            ["Selected version ID", selected && selected.id],
            ["Version status", selected && ui.humanize(selected.status)],
            ["Change type", selected && ui.humanize(selected.changeType)],
            ["Change reason", selected && selected.changeReason],
            ["Claim confidence", claim.confidence],
            ["Claim uncertainty", claim.uncertainty],
            ["Content hash", selected && selected.contentHash]
          ].forEach(([term, value]) => ui.append(facts, fact(term, value)));
          ui.append(nodes.primary, facts);
        }

        function renderAccountAndAttribution() {
          sectionHeader(
            nodes.account,
            "historyroot-context-account-title",
            "Where this claim appeared",
            "Reporting account and attribution",
            "A source or account proving that a claim was recorded does not automatically support the factual truth of the claim."
          );
          const account = claimPayload.reportingAccount;
          if (!account) {
            ui.append(
              nodes.account,
              missing("The reporting account is missing or not visible.")
            );
          } else {
            const card = ui.element("article", { className: "hr-review-card" });
            ui.append(
              card,
              ui.element("h3", { text: account.label || account.id }),
              ui.element("p", { text: account.content || "Account content not recorded" })
            );
            const facts = ui.element("dl", { className: "hr-review-facts" });
            [
              ["Account role", "Contains or reports the claim"],
              ["Account type", ui.humanize(account.accountType)],
              ["Publication", account.publicationLabel],
              ["Attributed author", account.author && (account.author.name || account.author.label)],
              ["Account source ID", account.sourceId]
            ].forEach(([term, value]) => ui.append(facts, fact(term, value)));
            ui.append(card, facts);
            ui.append(nodes.account, card);
          }
          const attributions = (claimPayload.attributions || {}).items || [];
          const groups = groupBy(attributions, "attributionRole", "role_not_recorded");
          if (!attributions.length) {
            ui.append(
              nodes.account,
              missing("No normalized attribution roles are recorded for this claim.")
            );
            return;
          }
          orderedKeys(groups, ATTRIBUTION_ORDER).forEach((role) => {
            const group = ui.element("div", { className: "hr-review-group" });
            ui.append(group, ui.element("h3", { text: ui.humanize(role) }));
            const grid = ui.element("div", { className: "hr-review-card-grid" });
            groups[role].forEach((attribution) => {
              const card = ui.element("article", { className: "hr-review-card" });
              const actor =
                attribution.actor &&
                (attribution.actor.name || attribution.actor.label);
              ui.append(
                card,
                ui.element("strong", {
                  text: actor || attribution.account?.label || "Actor not recorded"
                })
              );
              const facts = ui.element("dl", { className: "hr-review-facts" });
              [
                ["Attribution role", ui.humanize(attribution.attributionRole)],
                ["Reporting account", attribution.account && attribution.account.label],
                ["Recorded time", attribution.temporal && attribution.temporal.dateLabel],
                ["Attribution confidence", attribution.confidence],
                ["Attribution uncertainty", attribution.uncertainty],
                ["Attribution note", attribution.note]
              ].forEach(([term, value]) => ui.append(facts, fact(term, value)));
              ui.append(card, facts);
              ui.append(grid, card);
            });
            ui.append(group, grid);
            ui.append(nodes.account, group);
          });
        }

        function renderSources() {
          sectionHeader(
            nodes.sources,
            "historyroot-context-sources-title",
            "Claim provenance",
            "Sources that record the claim",
            "These sources establish provenance or recording context. Evidence about the claim is reviewed separately below."
          );
          const sourcesById = sourceMap();
          const claim = claimPayload.claim || {};
          const selected = claimPayload.selectedVersion || {};
          const attributions = (claimPayload.attributions || {}).items || [];
          const provenanceSourceIds = Array.from(
            new Set(
              []
                .concat(claim.sourceIds || [])
                .concat(selected.sourceIds || [])
                .concat(
                  attributions.flatMap((item) => item.sourceIds || [])
                )
                .concat(
                  claimPayload.reportingAccount?.sourceId
                    ? [claimPayload.reportingAccount.sourceId]
                    : []
                )
                .filter(Boolean)
            )
          );
          if (!provenanceSourceIds.length) {
            ui.append(
              nodes.sources,
              missing("No claim-provenance source is recorded.")
            );
          } else {
            const grid = ui.element("div", { className: "hr-review-card-grid" });
            provenanceSourceIds.forEach((sourceId) => {
              const source = sourcesById.get(sourceId);
              const card = ui.element("article", { className: "hr-review-card" });
              ui.append(
                card,
                ui.chip("Records the claim", "source"),
                ui.element("h3", {
                  text: source ? source.name : `Source unavailable (${sourceId})`
                })
              );
              if (source && source.publisher) {
                ui.append(card, ui.element("p", { text: source.publisher }));
              }
              const line = ui.element("p");
              ui.append(line, sourceReference(sourceId, sourcesById));
              ui.append(card, line);
              if (source) {
                const external = ui.externalLink(source.url, "Open external source");
                if (external) ui.append(card, external);
              }
              ui.append(grid, card);
            });
            ui.append(nodes.sources, grid);
          }
          const unavailable =
            claimPayload.sources &&
            claimPayload.sources.summary &&
            Number(claimPayload.sources.summary.hiddenOrUnavailable || 0);
          if (unavailable) {
            ui.append(
              nodes.sources,
              ui.element("p", {
                className: "hr-review-partial",
                text:
                  `${unavailable} referenced source ${unavailable === 1 ? "is" : "are"} hidden or unavailable. No source details were fabricated.`
              })
            );
          }
        }

        function locatorCard(locator) {
          const node = ui.element("div", { className: "hr-review-locator" });
          ui.append(
            node,
            ui.element("strong", {
              text: locator.locatorLabel || "Locator label not recorded"
            })
          );
          const list = ui.element("dl");
          [
            ["Locator type", ui.humanize(locator.locatorType)],
            ["Source ID", locator.sourceId],
            ["Note", locator.note],
            ["Stored excerpt", locator.excerpt]
          ].forEach(([term, value]) => {
            if (!clean(value)) return;
            ui.append(
              list,
              ui.element("dt", { text: term }),
              ui.element("dd", { text: value })
            );
          });
          const structured =
            locator.locator &&
            typeof locator.locator === "object" &&
            !Array.isArray(locator.locator)
              ? Object.entries(locator.locator)
              : [];
          structured.forEach(([key, value]) => {
            ui.append(
              list,
              ui.element("dt", { text: ui.humanize(key) }),
              ui.element("dd", { text: String(value) })
            );
          });
          if (list.childNodes.length) ui.append(node, list);
          return node;
        }

        function renderEvidence() {
          sectionHeader(
            nodes.evidence,
            "historyroot-context-evidence-title",
            "Evidence about the claim",
            "Explicit evidence roles",
            "Roles and confidence remain separately scoped. Counts do not imply truth, consensus, or ranking."
          );
          const evidence = claimPayload.evidence || {};
          const items = evidence.items || [];
          if (!items.length) {
            ui.append(
              nodes.evidence,
              missing("No visible evidence links are recorded for this claim.")
            );
            return;
          }
          const groups =
            evidence.groups || groupBy(items, "supportRole", "legacy_unclassified");
          const labels = {
            supports: "Supporting",
            disputes: "Disputing",
            qualifies: "Qualifying",
            contextualizes: "Contextual or background",
            neutral_or_background: "Neutral or background",
            corroborates: "Corroborating",
            contradicts: "Contradicting",
            legacy_unclassified: "Legacy evidence without a normalized role"
          };
          orderedKeys(groups, EVIDENCE_ORDER).forEach((role) => {
            const group = ui.element("div", { className: "hr-review-group" });
            ui.append(
              group,
              ui.element("h3", { text: labels[role] || ui.humanize(role) })
            );
            const grid = ui.element("div", { className: "hr-review-card-grid" });
            groups[role].forEach((entry) => {
              const evidenceRecord = entry.evidence || {};
              const card = ui.element("article", {
                className: "hr-review-card",
                attributes: { "data-role": role }
              });
              ui.append(
                card,
                ui.chip(
                  role === "legacy_unclassified"
                    ? "Role not recorded"
                    : ui.humanize(role),
                  "evidence"
                ),
                ui.element("h3", {
                  text: evidenceRecord.label || evidenceRecord.id || "Evidence record"
                }),
                ui.element("p", {
                  text:
                    entry.linkExplanation ||
                    evidenceRecord.explanation ||
                    "Explanation not recorded"
                })
              );
              if (!entry.normalizedLinkSupplied) {
                ui.append(
                  card,
                  missing(
                    "Legacy evidence association: no support or dispute role was inferred."
                  )
                );
              }
              const facts = ui.element("dl", { className: "hr-review-facts" });
              [
                ["Targets claim version", entry.claimVersionId],
                ["Evidence ID", evidenceRecord.id],
                ["Evidence type", ui.humanize(evidenceRecord.evidenceType)],
                ["Evidence strength", evidenceRecord.strength],
                ["Evidence confidence", evidenceRecord.confidence],
                ["Evidence uncertainty", evidenceRecord.uncertainty],
                ["Link relevance", entry.relevance],
                ["Evidence-link confidence", entry.linkConfidence],
                ["Evidence-link uncertainty", entry.linkUncertainty],
                ["Evidence version", evidenceRecord.currentVersion?.id],
                ["Evidence version status", evidenceRecord.currentVersion?.status]
              ].forEach(([term, value]) => ui.append(facts, fact(term, value)));
              ui.append(card, facts);
              const locators = entry.sourceLocators || [];
              if (locators.length) {
                ui.append(card, ui.element("h4", { text: "Exact source locators" }));
                locators.forEach((locator) =>
                  ui.append(card, locatorCard(locator))
                );
                if (Number(entry.sourceLocatorCount || 0) > locators.length) {
                  ui.append(
                    card,
                    missing(
                      `Showing ${locators.length} of ${entry.sourceLocatorCount} locators.`
                    )
                  );
                }
              } else {
                ui.append(card, missing("No exact source locator is recorded."));
              }
              ui.append(grid, card);
            });
            ui.append(group, grid);
            ui.append(nodes.evidence, group);
          });
          if (evidence.pagination && evidence.pagination.hasMore) {
            ui.append(
              nodes.evidence,
              missing(
                `Showing ${evidence.pagination.returned} of ${evidence.pagination.total} evidence entries. Use the bounded Context API pagination fields for additional entries.`
              )
            );
          }
        }

        function renderRelations() {
          sectionHeader(
            nodes.relations,
            "historyroot-context-relations-title",
            "Related and competing claims",
            "Explicit claim relationships",
            "Relationship types remain distinct; related claims are not all conflicts and are not resolved automatically."
          );
          const related = claimPayload.relatedClaims || {};
          const items = related.items || [];
          if (!items.length) {
            ui.append(
              nodes.relations,
              missing("No visible claim relationships are recorded.")
            );
            return;
          }
          const groups =
            related.groups || groupBy(items, "relationType", "unclassified");
          orderedKeys(groups, RELATION_ORDER).forEach((type) => {
            const group = ui.element("div", { className: "hr-review-group" });
            ui.append(group, ui.element("h3", { text: ui.humanize(type) }));
            const grid = ui.element("div", { className: "hr-review-card-grid" });
            groups[type].forEach((relation) => {
              const relatedClaim = relation.relatedClaim || {};
              const card = ui.element("article", { className: "hr-review-card" });
              const heading = ui.element("h3");
              ui.append(
                heading,
                ui.element("a", {
                  text:
                    relatedClaim.statement ||
                    relatedClaim.label ||
                    relatedClaim.id ||
                    "Related claim unavailable",
                  attributes: {
                    href: reviewHref(
                      claimPayload.record && claimPayload.record.id,
                      relatedClaim.id,
                      "",
                      currentUrlState.from
                    )
                  }
                })
              );
              ui.append(
                card,
                ui.chip(
                  `${ui.humanize(type)} · ${ui.humanize(relation.direction)}`,
                  "claim"
                ),
                heading
              );
              if (relation.explanation) {
                ui.append(card, ui.element("p", { text: relation.explanation }));
              }
              const facts = ui.element("dl", { className: "hr-review-facts" });
              [
                ["Relationship confidence", relation.confidence],
                ["Relationship uncertainty", relation.uncertainty],
                ["Review status", relation.reviewStatus],
                ["Related claim status", relatedClaim.status],
                ["Related current version", relatedClaim.currentVersionId]
              ].forEach(([term, value]) => ui.append(facts, fact(term, value)));
              ui.append(card, facts);
              ui.append(grid, card);
            });
            ui.append(group, grid);
            ui.append(nodes.relations, group);
          });
        }

        function renderVersions() {
          sectionHeader(
            nodes.versions,
            "historyroot-context-versions-title",
            "Immutable history",
            "Version timeline",
            "Correction, refinement, retraction, supersession, and restoration remain visible; historical wording is never presented as current."
          );
          const versions = claimPayload.versions || {};
          const items = versions.items || [];
          if (!claimPayload.hasVersionHistory || !items.length) {
            ui.append(
              nodes.versions,
              missing(
                "No recorded immutable version history is available for this legacy claim."
              )
            );
            return;
          }
          const list = ui.element("div", { className: "hr-review-version-list" });
          items.forEach((version) => {
            const selected =
              claimPayload.selectedVersion &&
              claimPayload.selectedVersion.id === version.id;
            const card = ui.element("article", {
              className: "hr-review-version",
              attributes: {
                "data-current": version.current ? "true" : "false",
                "data-selected": selected ? "true" : "false"
              }
            });
            const heading = ui.element("h3");
            ui.append(
              heading,
              ui.element("a", {
                text:
                  `${version.current ? "Current" : "Historical"} version` +
                  `${version.ordinal ? ` ${version.ordinal}` : ""}`,
                attributes: {
                  href: reviewHref(
                    claimPayload.record && claimPayload.record.id,
                    claimPayload.claim.id,
                    version.current ? "" : version.id,
                    currentUrlState.from
                  ),
                  "aria-current": selected ? "true" : undefined
                }
              })
            );
            ui.append(
              card,
              heading,
              ui.element("p", { text: version.statement }),
              ui.element("p", {
                className: "hr-review-version-lineage",
                text:
                  `Status: ${ui.humanize(version.status) || "not recorded"} · ` +
                  `Change: ${ui.humanize(version.changeType) || "not recorded"} · ` +
                  `Recorded: ${clean(version.createdAt).slice(0, 10) || "not recorded"}`
              })
            );
            if (version.changeReason) {
              ui.append(
                card,
                ui.element("p", { text: `Reason: ${version.changeReason}` })
              );
            }
            const successorIds = version.successorVersionIds || [];
            ui.append(
              card,
              ui.element("p", {
                className: "hr-review-version-lineage",
                text:
                  `Predecessor: ${version.priorVersionId || "none recorded"} · ` +
                  `Successor: ${successorIds.length ? successorIds.join(", ") : "none recorded"}`
              })
            );
            ui.append(list, card);
          });
          ui.append(nodes.versions, list);
          if (versions.pagination && versions.pagination.hasMore) {
            ui.append(
              nodes.versions,
              missing(
                `Showing ${versions.pagination.returned} of ${versions.pagination.total} immutable versions.`
              )
            );
          }
        }

        function renderProvenance() {
          sectionHeader(
            nodes.provenance,
            "historyroot-context-provenance-title",
            "Field-level recording basis",
            "Provenance by field",
            "Field provenance records where supplied values came from. It is not automatically evidence that those values are factually true."
          );
          const provenance = claimPayload.provenance || {};
          const items = provenance.items || [];
          if (!items.length) {
            ui.append(
              nodes.provenance,
              missing("No field-level provenance is recorded for this claim.")
            );
            return;
          }
          const groups =
            provenance.groups || groupBy(items, "fieldPath", "field_not_recorded");
          Object.keys(groups)
            .sort()
            .forEach((fieldPath) => {
              const group = ui.element("div", { className: "hr-review-group" });
              ui.append(group, ui.element("h3", { text: fieldPath }));
              const grid = ui.element("div", { className: "hr-review-card-grid" });
              groups[fieldPath].forEach((item) => {
                const card = ui.element("article", { className: "hr-review-card" });
                const facts = ui.element("dl", { className: "hr-review-facts" });
                [
                  ["Source ID", item.sourceId],
                  ["Support type", item.supportType],
                  ["Subrecord type", item.subrecordType],
                  ["Subrecord ID", item.subrecordId],
                  ["Provenance confidence", item.confidence],
                  ["Provenance uncertainty", item.uncertainty],
                  ["Explanation", item.note]
                ].forEach(([term, value]) => ui.append(facts, fact(term, value)));
                ui.append(card, facts);
                ui.append(grid, card);
              });
              ui.append(group, grid);
              ui.append(nodes.provenance, group);
            });
        }

        function renderDiagnostics() {
          ui.clear(nodes.diagnosticsBody);
          const diagnostics = claimPayload.diagnostics || {};
          const requestId = claimPayload.requestId;
          const list = ui.element("dl");
          [
            ["Request ID", requestId],
            ["Contract version", claimPayload.contractVersion],
            ["Current pointer missing", String(Boolean(diagnostics.currentPointerMissing))],
            ["Parent record unavailable", String(Boolean(diagnostics.parentRecordUnavailable))],
            ["Reporting account unavailable", String(Boolean(diagnostics.reportingAccountUnavailable))],
            ["Hidden or unavailable sources", diagnostics.hiddenOrUnavailableSources],
            ["Partial response", String(Boolean(diagnostics.partial))]
          ].forEach(([term, value]) => {
            ui.append(
              list,
              ui.element("dt", { text: term }),
              ui.element("dd", { text: clean(value) || "Not recorded" })
            );
          });
          ui.append(nodes.diagnosticsBody, list);
          nodes.diagnostics.open = Boolean(diagnostics.partial || missingVersionId);
          if (diagnostics.partial) {
            const notice = ui.element("p", {
              className: "hr-review-partial",
              text:
                "Some child records are hidden or unavailable. The primary visible claim remains displayed, and missing details are marked rather than fabricated."
            });
            nodes.diagnosticsBody.insertBefore(notice, list);
          }
        }

        function renderClaim() {
          const payload = claimPayload;
          if (
            !payload ||
            !payload.claim ||
            !payload.claim.id ||
            typeof payload.currentStatement !== "string"
          ) {
            throw new Error("Unexpected Context API response.");
          }
          renderRecordHeader(payload.record);
          renderClaimList();
          renderPrimary();
          renderAccountAndAttribution();
          renderSources();
          renderEvidence();
          renderRelations();
          renderVersions();
          renderProvenance();
          renderDiagnostics();
          nodes.switching.hidden = true;
          nodes.article.hidden = false;
          ui.hideState(nodes.state);
          announce(
            payload.displayState === "historical"
              ? "Historical claim version loaded."
              : "Current contextual claim loaded."
          );
        }

        function renderNoClaims(record) {
          claimPayload = null;
          renderRecordHeader(record);
          renderClaimList();
          sectionHeader(
            nodes.primary,
            "historyroot-context-primary-title",
            "Context review",
            "No visible contextual claims",
            "This record is available, but no visible contextual claim can be reviewed."
          );
          ui.append(
            nodes.primary,
            missing("No claim or immutable version was fabricated for this record.")
          );
          [
            nodes.account,
            nodes.sources,
            nodes.evidence,
            nodes.relations,
            nodes.versions,
            nodes.provenance,
            nodes.diagnostics
          ].forEach((node) => {
            node.hidden = true;
          });
          nodes.article.hidden = false;
          ui.hideState(nodes.state);
          announce("The record has no visible contextual claims.");
        }

        async function loadRecord(recordId, page) {
          const payload = await client.contextRecordReview(
            recordId,
            { page, limit: 25 },
            { signal: activeRequest.signal }
          );
          if (!payload || !payload.record || !Array.isArray(payload.claims)) {
            throw new global.HistoryRootApi.HistoryRootApiError(
              "The knowledge service returned a malformed response.",
              { code: "MALFORMED_RESPONSE" }
            );
          }
          recordPayload = payload;
          claimPage = page;
          renderClaimList();
          return payload;
        }

        async function loadClaim(claimId, versionId, options) {
          const settings = options || {};
          const run = ++navigationRun;
          if (activeRequest) activeRequest.abort();
          activeRequest = createRequestController();
          nodes.switching.hidden = !claimPayload;
          announce("Loading the selected contextual claim.");
          missingVersionId = "";
          try {
            let payload;
            try {
              payload = await client.contextClaimReview(
                claimId,
                versionId ? { version: versionId } : {},
                { signal: activeRequest.signal }
              );
            } catch (error) {
              const display = errorDisplay(error);
              if (display.kind !== "version-not-found") throw error;
              missingVersionId = versionId;
              payload = await client.contextClaimReview(
                claimId,
                {},
                { signal: activeRequest.signal }
              );
            }
            if (
              !payload
              || !payload.claim
              || !payload.evidence
              || !Array.isArray(payload.evidence.items)
              || !payload.versions
              || !Array.isArray(payload.versions.items)
            ) {
              throw new global.HistoryRootApi.HistoryRootApiError(
                "The knowledge service returned a malformed response.",
                { code: "MALFORMED_RESPONSE" }
              );
            }
            if (run !== navigationRun) return;
            claimPayload = payload;
            const resolvedRecordId = clean(payload.record && payload.record.id);
            if (
              resolvedRecordId &&
              (!recordPayload || recordPayload.record.id !== resolvedRecordId)
            ) {
              await loadRecord(resolvedRecordId, 1);
            }
            if (run !== navigationRun) return;
            currentUrlState = {
              valid: true,
              record: resolvedRecordId || currentUrlState.record,
              claim: claimId,
              version: missingVersionId ? "" : versionId,
              from: currentUrlState.from
            };
            if (settings.writeUrl) {
              global.history.pushState(
                {},
                "",
                reviewHref(
                  currentUrlState.record,
                  claimId,
                  currentUrlState.version,
                  currentUrlState.from
                )
              );
            } else if (
              resolvedRecordId &&
              resolvedRecordId !== parseUrlState(global.location.search).record
            ) {
              global.history.replaceState(
                {},
                "",
                reviewHref(
                  resolvedRecordId,
                  claimId,
                  currentUrlState.version,
                  currentUrlState.from
                )
              );
            }
            renderClaim();
            if (settings.focus) nodes.primary.focus({ preventScroll: false });
          } catch (error) {
            if (
              run !== navigationRun ||
              clean(error && error.details && error.details.code) === "ABORTED"
            ) {
              return;
            }
            const display = errorDisplay(error);
            const requestId = requestIdFromError(error);
            nodes.article.hidden = true;
            nodes.switching.hidden = true;
            ui.renderState(
              nodes.state,
              display.kind,
              display.title,
              `${display.message}${requestId ? ` Request ID: ${requestId}.` : ""}`,
              () => loadClaim(claimId, versionId)
            );
            announce(display.title);
          }
        }

        function selectClaim(claimId) {
          if (!isSafeId(claimId)) return;
          loadClaim(claimId, "", { writeUrl: true, focus: true });
        }

        async function navigate() {
          const run = ++navigationRun;
          if (activeRequest) activeRequest.abort();
          activeRequest = createRequestController();
          currentUrlState = parseUrlState(global.location.search);
          missingVersionId = "";
          recordPayload = null;
          claimPayload = null;
          claimPage = 1;
          nodes.article.hidden = true;
          nodes.switching.hidden = true;
          if (!currentUrlState.valid) {
            ui.renderState(
              nodes.state,
              "malformed",
              "The review link is incomplete",
              currentUrlState.message
            );
            announce("Malformed context review URL.");
            return;
          }
          ui.renderState(
            nodes.state,
            "loading",
            "Loading contextual review",
            "Gathering the record, visible claims, evidence roles, locators, lineage, and provenance from SourceRoot."
          );
          announce("Loading contextual review.");
          try {
            if (currentUrlState.claim) {
              const claimId = currentUrlState.claim;
              const versionId = currentUrlState.version;
              navigationRun = run - 1;
              await loadClaim(claimId, versionId);
              return;
            }
            const payload = await loadRecord(currentUrlState.record, 1);
            if (run !== navigationRun) return;
            if (!payload.claims.length) {
              renderNoClaims(payload.record);
              return;
            }
            const firstClaim = payload.claims[0];
            global.history.replaceState(
              {},
              "",
              reviewHref(
                payload.record.id,
                firstClaim.id,
                "",
                currentUrlState.from
              )
            );
            currentUrlState.claim = firstClaim.id;
            navigationRun = run - 1;
            await loadClaim(firstClaim.id, "");
          } catch (error) {
            if (
              run !== navigationRun ||
              clean(error && error.details && error.details.code) === "ABORTED"
            ) {
              return;
            }
            const display = errorDisplay(error);
            const requestId = requestIdFromError(error);
            ui.renderState(
              nodes.state,
              display.kind,
              display.title,
              `${display.message}${requestId ? ` Request ID: ${requestId}.` : ""}`,
              navigate
            );
            announce(display.title);
          }
        }

        nodes.claimFilter.addEventListener("input", renderClaimList);
        nodes.claimPrevious.addEventListener("click", async () => {
          if (!recordPayload || claimPage <= 1) return;
          await loadRecord(recordPayload.record.id, claimPage - 1);
        });
        nodes.claimNext.addEventListener("click", async () => {
          if (!recordPayload || !recordPayload.hasMore) return;
          await loadRecord(recordPayload.record.id, claimPage + 1);
        });
        global.addEventListener("popstate", navigate);
        return navigate();
      });
    }

    return Object.freeze({
      SAFE_ID,
      EVIDENCE_ORDER,
      RELATION_ORDER,
      ATTRIBUTION_ORDER,
      isSafeId,
      parseUrlState,
      reviewHref,
      groupBy,
      orderedKeys,
      requestIdFromError,
      errorDisplay,
      start
    });
  }
);
