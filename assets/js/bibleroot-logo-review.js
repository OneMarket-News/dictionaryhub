(() => {
  "use strict";

  const rubric = [
    { id: "distinctiveness", label: "Distinctiveness", weight: 12 },
    { id: "family", label: "SourceRoot-family consistency", weight: 10 },
    { id: "relevance", label: "BibleRoot relevance", weight: 12 },
    { id: "trust", label: "Trust and seriousness", weight: 11 },
    { id: "legibility", label: "Legibility", weight: 10 },
    { id: "favicon", label: "Favicon performance", weight: 9 },
    { id: "monochrome", label: "Monochrome performance", weight: 8 },
    { id: "accessibility", label: "Accessibility", weight: 9 },
    { id: "longevity", label: "Longevity", weight: 8 },
    { id: "originality", label: "Originality", weight: 7 },
    { id: "generic", label: "Avoidance of generic religious-application branding", weight: 4 }
  ];

  const concepts = [
    {
      id: "a",
      name: "Rooted Manuscript",
      path: "assets/brand/bibleroot-concepts/bibleroot-concept-a-rooted-manuscript.svg",
      thesis: "A restrained source manuscript remains readable above while its central binding becomes an inspectable origin below.",
      construction: "Paired manuscript contour · four textual strokes · central spine · three rooted terminals",
      strength: "The most familiar and immediately understandable accessible control direction.",
      risk: "It may become too generic if it is not refined.",
      initial: [4, 4, 5, 4, 4, 3, 4, 4, 4, 3, 3]
    },
    {
      id: "b",
      name: "Verse Network",
      path: "assets/brand/bibleroot-concepts/bibleroot-concept-b-verse-network.svg",
      thesis: "Discrete verse lines stay intact while a sparse edge path exposes documented connections among textual units.",
      construction: "Four unequal verse lines · ordered provenance path · four large anchors · no radial network",
      strength: "The strongest current non-binding lead: potentially distinctive, durable, and well aligned with SourceRoot.",
      risk: "It is less immediately familiar than A and needs a stronger recognizable textual or manuscript anchor.",
      initial: [4, 5, 4, 4, 4, 4, 5, 4, 4, 4, 4]
    },
    {
      id: "c",
      name: "Source Seal",
      path: "assets/brand/bibleroot-concepts/bibleroot-concept-c-source-seal.svg",
      thesis: "A compact archival custody mark holds an inspectable source sheet—checkable record, not certified theological truth.",
      construction: "Bold custody ring · source sheet · two record lines · archival tails · no crest or checkmark",
      strength: "A durable compact mark worth preserving as research.",
      risk: "Its symbolic associations may alienate part of the broad population; do not advance it as the primary public identity.",
      initial: [3, 4, 3, 5, 5, 5, 5, 5, 5, 3, 4]
    },
    {
      id: "d",
      name: "Citation Root",
      path: "assets/brand/bibleroot-concepts/bibleroot-concept-d-citation-root.svg",
      thesis: "Paired citation brackets become one source locator and rooted base: a reference is useful because its origin can be inspected.",
      construction: "Two citation brackets · locator baseline · vertical source stem · two angular roots",
      strength: "A strong abstract score and distinctive monochrome construction preserved for research.",
      risk: "Rejected as a primary direction because it lacks sufficient familiarity, recognizable identity, and emotional connection.",
      initial: [5, 4, 4, 4, 4, 4, 5, 4, 4, 5, 5]
    }
  ];

  const sizes = [16, 24, 32, 48, 64, 128];
  const initialTotals = new Map();

  function weighted(score, weight) {
    return weight * score / 5;
  }

  function format(value) {
    return value.toFixed(1);
  }

  function icon(path, alt, className = "", style = "") {
    const label = alt ? ` role="img" aria-label="${alt}"` : " aria-hidden=\"true\"";
    const classes = `concept-mask${className ? ` ${className}` : ""}`;
    const stylesheetRelativePath = path.replace(/^assets\//, "../");
    return `<span class="${classes}" style="--concept-url:url('${stylesheetRelativePath}')${style ? `;${style}` : ""}"${label}></span>`;
  }

  function sizeTests(concept) {
    return sizes.map((size) => `
      <div class="size-test">
        <div class="size-test__frame">${icon(concept.path, "", "", `--sample-size:${size}px`)}</div>
        <span>${size}px</span>
      </div>`).join("");
  }

  function modeTests(concept) {
    const modes = [
      ["one", "One color"], ["gray", "Grayscale"],
      ["light", "Light background"], ["dark", "Dark background"]
    ];
    return modes.map(([key, label]) => `
      <div class="mode-sample mode-sample--${key}">${icon(concept.path, "")}<span>${label}</span></div>`).join("");
  }

  function paletteTests(concept) {
    const palettes = [
      ["indigo", "Deep indigo / parchment"],
      ["midnight", "Midnight / warm gold"],
      ["burgundy", "Charcoal / burgundy"],
      ["evergreen", "Evergreen / aged ivory"]
    ];
    return palettes.map(([key, label]) => `
      <div class="palette-sample palette-sample--${key}">${icon(concept.path, "")}<span>${label}</span></div>`).join("");
  }

  function wordmarkTests(concept) {
    const variants = [
      ["equal", "Equal weight", "Bible<span class=\"root-suffix\">Root</span>"],
      ["reduced", "Reduced Root", "<strong>Bible</strong><span class=\"root-suffix\">Root</span>"],
      ["accent", "Accent Root", "Bible<span class=\"root-suffix\">Root</span>"]
    ];
    return variants.map(([key, label, word]) => `
      <div class="wordmark-lockup">
        ${icon(concept.path, "")}
        <span class="wordmark-name wordmark-name--${key}">${word}</span>
        <span class="wordmark-label">${label}</span>
      </div>`).join("");
  }

  function headerTests(concept) {
    const lockup = `${icon(concept.path, "")}<strong>BibleRoot</strong>`;
    return `
      <div class="header-mockup header-mockup--desktop" aria-label="Desktop header mockup">
        ${lockup}<nav aria-label="Mock desktop navigation"><span>Home</span><span>Passage</span><span>Compare</span><span>Roots ▾</span></nav>
      </div>
      <div class="header-mockup header-mockup--mobile" aria-label="Mobile header mockup">
        ${lockup}<nav aria-label="Mock mobile navigation"><span>Passage</span><span>Compare</span><span>Roots ▾</span></nav>
      </div>`;
  }

  function scoreRows(concept) {
    return rubric.map((criterion, index) => {
      const score = concept.initial[index];
      return `
        <tr>
          <th scope="row">${criterion.label}</th>
          <td>${criterion.weight}</td>
          <td><input class="score-input" type="number" min="0" max="5" step="1" value="${score}" data-concept="${concept.id}" data-weight="${criterion.weight}" data-initial="${score}" aria-label="${concept.name}: ${criterion.label} score from 0 to 5"></td>
          <td><output class="score-output" data-weighted-output>${format(weighted(score, criterion.weight))}</output></td>
        </tr>`;
    }).join("");
  }

  function initialTotal(concept) {
    return rubric.reduce((sum, criterion, index) => sum + weighted(concept.initial[index], criterion.weight), 0);
  }

  function conceptMarkup(concept, index) {
    const total = initialTotal(concept);
    initialTotals.set(concept.id, total);
    return `
      <article class="concept-card" id="concept-${concept.id}" aria-labelledby="concept-${concept.id}-title">
        <div class="concept-card__hero">
          <div class="concept-card__visual">${icon(concept.path, `${concept.name} symbol`)}</div>
          <div class="concept-card__copy">
            <span class="concept-index">Concept ${String.fromCharCode(65 + index)} · unapproved</span>
            <h3 id="concept-${concept.id}-title">${concept.name}</h3>
            <p class="concept-thesis">${concept.thesis}</p>
            <p class="concept-construction"><strong>Construction:</strong> ${concept.construction}</p>
          </div>
        </div>
        <section class="concept-panel" aria-labelledby="concept-${concept.id}-sizes">
          <h4 id="concept-${concept.id}-sizes">Small-size test</h4>
          <div class="size-tests">${sizeTests(concept)}</div>
        </section>
        <section class="concept-panel" aria-labelledby="concept-${concept.id}-modes">
          <h4 id="concept-${concept.id}-modes">Reproduction modes</h4>
          <div class="mode-grid">${modeTests(concept)}</div>
        </section>
        <section class="concept-panel" aria-labelledby="concept-${concept.id}-palettes">
          <h4 id="concept-${concept.id}-palettes">Four preliminary color territories</h4>
          <div class="palette-grid">${paletteTests(concept)}</div>
        </section>
        <section class="concept-panel" aria-labelledby="concept-${concept.id}-type">
          <h4 id="concept-${concept.id}-type">Wordmark and header behavior</h4>
          <div class="mockup-grid">
            <div class="wordmark-board">${wordmarkTests(concept)}</div>
            <div class="header-mockups">${headerTests(concept)}</div>
          </div>
        </section>
        <section class="concept-panel" aria-labelledby="concept-${concept.id}-evidence">
          <h4 id="concept-${concept.id}-evidence">Strengths and risks</h4>
          <div class="evidence-grid">
            <div class="evidence-card"><h5>Strength</h5><p>${concept.strength}</p></div>
            <div class="evidence-card evidence-card--risk"><h5>Concern</h5><p>${concept.risk}</p></div>
          </div>
        </section>
        <section class="concept-panel" aria-labelledby="concept-${concept.id}-score">
          <h4 id="concept-${concept.id}-score">100-point evaluation</h4>
          <div class="score-wrap">
            <table class="score-table">
              <caption>Scores are editable locally from 0 to 5 and never persist.</caption>
              <thead><tr><th scope="col">Criterion</th><th scope="col">Weight</th><th scope="col">Score</th><th scope="col">Weighted</th></tr></thead>
              <tbody>${scoreRows(concept)}</tbody>
              <tfoot><tr class="score-total-row"><th scope="row">Total</th><td>100</td><td colspan="2"><output class="score-total" data-total-for="${concept.id}">${format(total)} / 100</output></td></tr></tfoot>
            </table>
          </div>
          <label class="notes-label" for="notes-${concept.id}">Human notes <small>Local to this page and discarded on reload.</small></label>
          <textarea class="concept-notes" id="notes-${concept.id}" placeholder="Record questions, reactions, or refinement ideas. Nothing is saved."></textarea>
        </section>
      </article>`;
  }

  function summaryMarkup(concept, index) {
    return `<tr data-summary-for="${concept.id}"><th scope="row">${String.fromCharCode(65 + index)} · ${concept.name}</th><td data-summary-total>${format(initialTotal(concept))}</td><td>${concept.strength}</td><td>${concept.risk}</td></tr>`;
  }

  function updateConcept(conceptId, announce = true) {
    const inputs = Array.from(document.querySelectorAll(`.score-input[data-concept="${conceptId}"]`));
    let total = 0;
    inputs.forEach((input) => {
      const score = Math.max(0, Math.min(5, Number(input.value)));
      const weight = Number(input.dataset.weight);
      const result = weighted(Number.isFinite(score) ? score : 0, weight);
      input.value = String(Number.isFinite(score) ? score : 0);
      input.closest("tr").querySelector("[data-weighted-output]").value = format(result);
      total += result;
    });
    document.querySelector(`[data-total-for="${conceptId}"]`).value = `${format(total)} / 100`;
    document.querySelector(`[data-summary-for="${conceptId}"] [data-summary-total]`).textContent = format(total);
    if (announce) {
      const concept = concepts.find((item) => item.id === conceptId);
      document.querySelector("#scoreLiveStatus").textContent = `${concept.name} total updated to ${format(total)} out of 100.`;
    }
  }

  function resetScores() {
    document.querySelectorAll(".score-input").forEach((input) => {
      input.value = input.dataset.initial;
    });
    concepts.forEach((concept) => updateConcept(concept.id, false));
    document.querySelector("#scoreLiveStatus").textContent = "All concept scores reset to the documented initial evaluation.";
  }

  function initialize() {
    const reviewList = document.querySelector("#conceptReviewList");
    const summaryBody = document.querySelector("#scoreSummaryBody");
    reviewList.innerHTML = concepts.map(conceptMarkup).join("");
    summaryBody.innerHTML = concepts.map(summaryMarkup).join("");

    document.querySelectorAll(".score-input").forEach((input) => {
      input.addEventListener("input", () => updateConcept(input.dataset.concept));
    });
    document.querySelector("#resetScores").addEventListener("click", resetScores);
  }

  initialize();
})();
