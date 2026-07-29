import type {
  PreparedItem,
  PreparedLinkItem,
  PreparedSource,
  SourcePreparationWorkspaceV1_1,
} from "../source-preparation/source-preparation-types.js";

type JsonObject = Record<string, unknown>;

export interface AcquisitionCandidate extends JsonObject {
  acquisitionStatus: string;
  archiveIdentifier: string;
  candidateId: string;
  categories: {
    archaeologicalOrScholarly: boolean;
    indigenousLed: boolean;
    institutional: boolean;
    primaryOrArchival: boolean;
  };
  creatorOrResponsibleInstitution: string;
  date: string;
  geographicCoverage: string[];
  limitationsOrKnownPerspective: string;
  locatorStrategy: {
    bounded: boolean;
    type: string;
    value: string;
  };
  publicationOrEdition: string;
  rightsAccess: {
    basis: string;
    classification: "metadata_and_link_only" | "public_domain";
    contentUse: string;
  };
  sourceType: string;
  stableUrl: string;
  temporalCoverage: string;
  title: string;
}

export interface AcquisitionRegistry extends JsonObject {
  candidates: AcquisitionCandidate[];
}

const APPROVED_AT = "2026-07-28T18:00:00.000Z";
const APPROVED_BY =
  "SourceRoot Chunk 9 accepted acquisition and regional corpus review";
const PREFIX = "historyroot-wampanoag";

function item(object: JsonObject, note: string): PreparedItem {
  return {
    preparationStatus: "approved",
    reviewerNotes: note,
    approvalRecord: {
      approvedBy: APPROVED_BY,
      approvedAt: APPROVED_AT,
      note:
        "Approved within the bounded Chunk 9 acquisition gate; source statement, later interpretation, and project inference remain distinct.",
    },
    object,
  };
}

function linkItem(
  preparationId: string,
  object: JsonObject,
  note: string,
): PreparedLinkItem {
  return {
    ...item(object, note),
    preparationId,
  };
}

function sourceId(candidateId: string): string {
  return `${PREFIX}-source-${candidateId.replace(/^hr9-src-/, "")}`;
}

function recordId(slug: string): string {
  return `${PREFIX}-${slug}`;
}

const preservedEntityIds: Record<string, string> = {
  "person-john-sassamon": "historyroot-plymouth-person-john-sassamon",
  "place-cape-cod": "historyroot-plymouth-place-cape-cod",
  "place-great-swamp": "historyroot-plymouth-place-great-swamp",
  "place-manomet": "historyroot-plymouth-place-manomet",
  "place-nemasket": "historyroot-plymouth-place-nemasket",
  "place-narragansett-bay": "historyroot-plymouth-place-narragansett-bay",
  "place-mount-hope": "historyroot-plymouth-place-mount-hope",
  "place-pocasset": "historyroot-plymouth-place-pocasset",
  "place-sakonnet": "historyroot-plymouth-place-sakonnet",
  "place-swansea": "historyroot-plymouth-place-swansea",
  "person-epenow": "historyroot-plymouth-person-epenow",
  "person-weetamoo": "historyroot-plymouth-person-weetamoo",
  "person-metacom-regional": "historyroot-plymouth-person-metacom",
  "person-awashonks": "historyroot-plymouth-person-awashonks",
  "event-epenow-return": "historyroot-plymouth-event-epenow-capture-return",
};

function entityRef(slug: string): string {
  return preservedEntityIds[slug] ?? recordId(slug);
}

const preservedEntitySourceSlugs: Record<string, string> = {
  "person-john-sassamon": "easton-relation",
  "place-cape-cod": "mhc-cape-islands",
  "place-great-swamp": "mather-brief-history",
  "place-manomet": "nara-yale-indian-papers",
  "place-nemasket": "nara-yale-indian-papers",
  "place-narragansett-bay": "easton-relation",
  "place-mount-hope": "hubbard-map",
  "place-pocasset": "brooks-beloved-kin",
  "place-sakonnet": "brooks-beloved-kin",
  "place-swansea": "easton-relation",
  "person-epenow": "chappaquiddick-history",
  "person-weetamoo": "brooks-beloved-kin",
  "person-metacom-regional": "easton-relation",
  "person-awashonks": "brooks-beloved-kin",
  "event-epenow-return": "chappaquiddick-history",
};

function entitySourceSlug(slug: string): string {
  return recordDefinitions.find((entry) => entry.slug === slug)?.source
    ?? preservedEntitySourceSlugs[slug]
    ?? "aquinnah-history";
}

function identityKind(candidate: AcquisitionCandidate):
  PreparedSource["sourceIdentityReview"]["identityKind"] {
  if (candidate.candidateId.includes("timeline")
    || candidate.candidateId.includes("history")) {
    return "tribal_institutional_account";
  }
  if (candidate.candidateId.includes("archives")
    || candidate.candidateId.includes("nara")) {
    return "catalog_record";
  }
  if (candidate.candidateId.includes("map")) return "digital_surrogate";
  if (candidate.candidateId.includes("easton")
    || candidate.candidateId.includes("mather")
    || candidate.candidateId.includes("mittark")) {
    return "scholarly_edition";
  }
  if (candidate.candidateId.includes("nps")
    || candidate.candidateId.includes("mhc")
    || candidate.candidateId.includes("thpo")) {
    return "government_institutional_account";
  }
  return "scholarly_analysis";
}

function buildSources(candidates: AcquisitionCandidate[]): PreparedSource[] {
  return candidates.map((candidate) => ({
    ...item({
      id: sourceId(candidate.candidateId),
      name: candidate.title,
      type: candidate.sourceType,
      domain: "HistoryRoot",
      publisher: candidate.creatorOrResponsibleInstitution,
      qualityTier: "accepted-acquisition-gate",
      credibilityTier: "prototype",
      verificationStatus: "source-backed",
      sourceClass: candidate.sourceType,
      license: candidate.rightsAccess.classification,
      licenseStatus: candidate.rightsAccess.classification,
      reviewStatus: "needs-review",
      lastReviewed: "2026-07-28",
      url: candidate.stableUrl,
      citation:
        `${candidate.creatorOrResponsibleInstitution}, ${candidate.title}, ${candidate.publicationOrEdition}; ${candidate.archiveIdentifier}.`,
      accessStatus: "metadata-and-bounded-locator-inspected",
      accessDate: "2026-07-28",
      locatorsInspected: [candidate.locatorStrategy.value],
      limitations: candidate.limitationsOrKnownPerspective,
      supportsDetailedClaims: true,
      notes:
        "Accepted by the Chunk 9 acquisition gate. Registration does not assign a universal reliability score.",
      metadata: {
        acquisitionCandidateId: candidate.candidateId,
        archiveIdentifier: candidate.archiveIdentifier,
        categories: candidate.categories,
        temporalCoverage: candidate.temporalCoverage,
        geographicCoverage: candidate.geographicCoverage,
        locatorStrategy: candidate.locatorStrategy,
      },
    }, "New Chunk 9 accepted source registration; metadata and links only unless the rights record expressly allows more."),
    rightsReview: {
      classification: candidate.rightsAccess.classification,
      basis: candidate.rightsAccess.basis,
      attributionRequirements:
        "Preserve title, responsible institution or creator, edition identity, stable URL, archive identifier, and limitations.",
    },
    contentUse: {
      mode: candidate.rightsAccess.classification === "public_domain"
        ? "public_domain_excerpt"
        : "paraphrase_only",
      containsCopiedExcerpt: false,
    },
    sourceIdentityReview: {
      identityKind: identityKind(candidate),
      limitations: candidate.limitationsOrKnownPerspective,
    },
  }));
}

interface RecordDefinition {
  slug: string;
  label: string;
  entityType: string;
  description: string;
  source: string;
  alternateNames?: string[];
}

const recordDefinitions: RecordDefinition[] = [
  { slug: "community-aquinnah", label: "Aquinnah Wampanoag community", entityType: "cultural_community", description: "Wampanoag community at Aquinnah on Noepe; represented here through explicitly attributed tribal history and stewardship sources.", source: "aquinnah-history" },
  { slug: "community-chappaquiddick", label: "Chappaquiddick Wampanoag community", entityType: "cultural_community", description: "Wampanoag community associated with Chappaquiddick and Cape Poge on Noepe.", source: "chappaquiddick-history" },
  { slug: "community-herring-pond", label: "Herring Pond Wampanoag community", entityType: "cultural_community", description: "Wampanoag community associated with the Herring Pond area and a public tribal historical timeline.", source: "herring-pond-timeline" },
  { slug: "community-mashpee", label: "Mashpee Wampanoag community", entityType: "cultural_community", description: "Wampanoag community at Mashpee represented through tribal timeline and archive sources.", source: "mashpee-timeline" },
  { slug: "group-regional-network", label: "Wampanoag intercommunity network", entityType: "group", description: "Editorial grouping for displaying documented relationships among distinct Wampanoag communities; it is not a claim of centralized hierarchy.", source: "aquinnah-history" },
  { slug: "place-noepe", label: "Noepe", entityType: "place", description: "Wampanoag place name for the island also known as Martha's Vineyard; no territorial polygon is asserted.", source: "aquinnah-history", alternateNames: ["Martha's Vineyard"] },
  { slug: "place-aquinnah", label: "Aquinnah", entityType: "place", description: "Place on southwestern Noepe associated with the Aquinnah Wampanoag community.", source: "aquinnah-history", alternateNames: ["Gay Head"] },
  { slug: "place-chappaquiddick", label: "Chappaquiddick", entityType: "place", description: "Island and community place at the eastern end of Noepe.", source: "chappaquiddick-history" },
  { slug: "place-cape-poge", label: "Cape Poge", entityType: "place", description: "Place on Chappaquiddick named in Chappaquiddick Wampanoag public history.", source: "chappaquiddick-history" },
  { slug: "place-herring-pond", label: "Herring Pond", entityType: "place", description: "Place associated with the Herring Pond Wampanoag community.", source: "herring-pond-timeline" },
  { slug: "place-mashpee", label: "Mashpee", entityType: "place", description: "Cape Cod place associated with the Mashpee Wampanoag community.", source: "mashpee-timeline" },
  { slug: "place-great-island", label: "Great Island", entityType: "place", description: "Wellfleet archaeological landscape discussed in site-specific peer-reviewed research.", source: "beranek-great-island" },
  { slug: "place-wellfleet", label: "Wellfleet", entityType: "place", description: "Cape Cod town containing the Great Island research area.", source: "beranek-great-island" },
  { slug: "place-carns", label: "Carns Site", entityType: "place", description: "Archaeological site at Coast Guard Beach described by the National Park Service.", source: "nps-carns" },
  { slug: "place-coast-guard-beach", label: "Coast Guard Beach", entityType: "place", description: "Cape Cod coastal location associated with the Carns Site.", source: "nps-carns" },
  { slug: "place-hornblower-ii", label: "Hornblower II archaeological site", entityType: "place", description: "Archaeological site on Noepe included in a bounded radiocarbon study.", source: "watson-ams-dates" },
  { slug: "place-frisby-butler", label: "Frisby-Butler archaeological site", entityType: "place", description: "Archaeological site on Noepe included in a bounded radiocarbon study.", source: "watson-ams-dates" },
  { slug: "person-pakeponessoo", label: "Pakeponessoo", entityType: "person", description: "Person named in a 1642 entry of the Chappaquiddick Wampanoag historical timeline.", source: "chappaquiddick-history" },
  { slug: "person-hiacoomes", label: "Hiacoomes", entityType: "person", description: "Wampanoag person associated by tribal public history with a 1651 Christian assembly on Noepe.", source: "chappaquiddick-history" },
  { slug: "person-john-cotton-jr", label: "John Cotton Jr.", entityType: "person", description: "Colonial minister whose 1666-1667 diary and vocabulary are described by Herring Pond Wampanoag public history.", source: "herring-pond-timeline" },
  { slug: "person-mittark", label: "Mittark", entityType: "person", description: "Aquinnah sachem associated with a 1681 petition used only as post-1676 continuity context.", source: "mittark-petition" },
  { slug: "person-john-easton", label: "John Easton", entityType: "person", description: "Rhode Island colonial official whose 1675 relation reports negotiations and differs in framing from Increase Mather.", source: "easton-relation" },
  { slug: "person-increase-mather", label: "Increase Mather", entityType: "person", description: "Puritan minister and author of a 1676 providential narrative of the war.", source: "mather-brief-history" },
  { slug: "event-chappa-1642-entry", label: "Chappaquiddick 1642 timeline entry", entityType: "event", description: "A dated community-history entry naming Pakeponessoo; the source's attribution is preserved.", source: "chappaquiddick-history" },
  { slug: "event-noepe-1651-assembly", label: "Noepe Christian assembly account, 1651", entityType: "event", description: "A 1651 event presented by Chappaquiddick Wampanoag public history and not generalized to all communities.", source: "chappaquiddick-history" },
  { slug: "event-herring-pond-1666-1667", label: "Herring Pond Cotton diary encounter context", entityType: "event", description: "A 1666-1667 timeline context linking John Cotton Jr.'s diary and vocabulary to Herring Pond history.", source: "herring-pond-timeline" },
  { slug: "event-mashpee-1620-context", label: "Mashpee timeline 1620 context", entityType: "event", description: "Tribal timeline framing of English settlement in 1620 on Wampanoag homelands.", source: "mashpee-timeline" },
  { slug: "event-mashpee-1675-impact", label: "Mashpee timeline 1675 war-impact account", entityType: "event", description: "Tribal timeline account of war impacts, retained as an attributed community account.", source: "mashpee-timeline" },
  { slug: "event-great-island-occupation", label: "Great Island low-density occupation evidence", entityType: "event", description: "Site-specific archaeological activity dated broadly across the AD 1480-1630 calibration plateau.", source: "beranek-great-island" },
  { slug: "event-carns-investigation", label: "Carns Site archaeological investigation", entityType: "event", description: "National Park Service account of investigation and preservation response at an eroding coastal archaeological site.", source: "nps-carns" },
  { slug: "event-hornblower-seasonal-use", label: "Hornblower II seasonal-use evidence", entityType: "event", description: "Pre-1614 archaeological seasonal-use context; it does not assign a seventeenth-century political identity.", source: "watson-ams-dates" },
  { slug: "event-frisby-seasonal-use", label: "Frisby-Butler seasonal-use evidence", entityType: "event", description: "Pre-1614 archaeological seasonal-use context; it does not assign a seventeenth-century political identity.", source: "watson-ams-dates" },
  { slug: "event-easton-negotiations", label: "Easton negotiation account, 1675", entityType: "event", description: "Negotiations reported through John Easton's colonial mediation account, with reported Native grievances explicitly mediated by Easton.", source: "easton-relation" },
  { slug: "event-mather-publication", label: "Mather war narrative publication, 1676", entityType: "event", description: "Publication of Increase Mather's providential account, treated as a perspective-bearing source rather than neutral chronology.", source: "mather-brief-history" },
  { slug: "work-aquinnah-history", label: "Wampanoag History webpage", entityType: "work", description: "Official Aquinnah Wampanoag public-history work.", source: "aquinnah-history" },
  { slug: "work-chappaquiddick-history", label: "Chappaquiddick Our History webpage", entityType: "work", description: "Official Chappaquiddick Wampanoag public-history work.", source: "chappaquiddick-history" },
  { slug: "work-herring-pond-timeline", label: "Herring Pond historical timeline", entityType: "work", description: "Official Herring Pond Wampanoag public-history timeline.", source: "herring-pond-timeline" },
  { slug: "work-mashpee-timeline", label: "Mashpee Wampanoag history timeline", entityType: "work", description: "Official Mashpee Wampanoag history timeline.", source: "mashpee-timeline" },
  { slug: "work-beranek-great-island", label: "Great Island archaeological article", entityType: "work", description: "Peer-reviewed archaeological article bounded by DOI and pages.", source: "beranek-great-island" },
  { slug: "work-easton-relation", label: "Easton's Relation", entityType: "work", description: "Modernized electronic edition with original-language appendix of Easton's 1675 relation.", source: "easton-relation" },
  { slug: "work-hubbard-map", label: "Hubbard map of New England", entityType: "work", description: "1677 map registered through the Library of Congress object and IIIF identity.", source: "hubbard-map" },
  { slug: "work-mather-history", label: "Mather's Brief History", entityType: "work", description: "First-edition-based electronic text of Increase Mather's 1676 narrative.", source: "mather-brief-history" },
  { slug: "work-mittark-petition", label: "Mittark petition, 1681", entityType: "document", description: "Post-boundary Indigenous writing used only for continuity context through a bounded scholarly edition.", source: "mittark-petition" },
  { slug: "work-watson-ams", label: "Watson AMS dates article", entityType: "work", description: "Peer-reviewed radiocarbon study with DOI, pages, and dated-sample table locator.", source: "watson-ams-dates" },
  { slug: "work-aquinnah-thpo", label: "Aquinnah Tribal Historic Preservation webpage", entityType: "work", description: "Official tribal historic-preservation and consultation guidance.", source: "aquinnah-thpo" },
  { slug: "work-brooks-beloved-kin", label: "Our Beloved Kin", entityType: "work", description: "Indigenous-centered scholarly monograph registered for bounded follow-up; no vague book-level claim is imported.", source: "brooks-beloved-kin" },
  { slug: "work-delucia-memory-lands", label: "Memory Lands", entityType: "work", description: "Scholarly memory study registered for later page-bounded research; no vague book-level claim is imported.", source: "delucia-memory-lands" },
  { slug: "work-hubbard-narrative", label: "Hubbard's Narrative of the Troubles", entityType: "work", description: "Colonial narrative registered by accepted edition identity; no unlocated claim is imported.", source: "hubbard-narrative" },
  { slug: "work-mashpee-archives", label: "Mashpee Wampanoag Tribal Archives", entityType: "organization", description: "Tribal archive registered for governed item-level discovery; portal registration does not accept unidentified items.", source: "mashpee-archives" },
  { slug: "work-mhc-report", label: "Cape Cod and Islands reconnaissance report", entityType: "work", description: "Government archaeological reconnaissance report registered with its dated-content and OCR limitations.", source: "mhc-cape-islands" },
  { slug: "work-nara-yale-portal", label: "Yale Indian Papers / Native Northeast Portal", entityType: "work", description: "Archival discovery portal registered without treating portal-level metadata as item-level claim evidence.", source: "nara-yale-indian-papers" },
  { slug: "work-nps-carns", label: "NPS Carns Site summary", entityType: "work", description: "Government archaeological site summary.", source: "nps-carns" },
  { slug: "work-silverman-faith-boundaries", label: "Faith and Boundaries", entityType: "work", description: "Scholarly monograph registered with bounded Chapter 4 DOI and pages.", source: "silverman-faith-boundaries" },
  { slug: "work-thomas-creating-new-england", label: "Creating New England, Defending the Northeast", entityType: "work", description: "Scholarly collection registered for later chapter-and-page-bounded use; no vague claim is imported.", source: "thomas-creating-new-england" },
];

interface ClaimDefinition {
  slug: string;
  label: string;
  statement: string;
  subject: string;
  account: string;
  source: string;
  locator: string;
  role: "supports" | "qualifies" | "contextualizes" | "neutral_or_background";
  date: string;
  geography: string;
}

const claims: ClaimDefinition[] = [
  { slug: "aquinnah-noepe-homeland", label: "Aquinnah account identifies Noepe as Wampanoag homeland", statement: "The Aquinnah tribal history presents Noepe and Aquinnah within an enduring Wampanoag homeland.", subject: "community-aquinnah", account: "aquinnah-history", source: "aquinnah-history", locator: "Section heading: History of Martha's Vineyard", role: "supports", date: "deep history to present; core use 1614-1676", geography: "Noepe and Aquinnah" },
  { slug: "aquinnah-continuity", label: "Aquinnah public history presents community continuity", statement: "The Aquinnah tribal history presents community continuity across colonial and modern periods without implying that history began in 1614 or ended in 1676.", subject: "community-aquinnah", account: "aquinnah-history", source: "aquinnah-history", locator: "Section heading: Aquinnah Wampanoag History & Government", role: "supports", date: "deep history to present", geography: "Aquinnah" },
  { slug: "aquinnah-traditional-narrative", label: "Aquinnah traditional narrative is explicitly attributed", statement: "The Aquinnah history includes traditional narrative alongside institutional history; this corpus attributes that mode to the tribal source rather than converting it into an unqualified project claim.", subject: "work-aquinnah-history", account: "aquinnah-history", source: "aquinnah-history", locator: "Section heading: Historical Background of the Wampanoag", role: "contextualizes", date: "traditional narrative; page inspected 2026-07-28", geography: "Noepe" },
  { slug: "aquinnah-thpo-stewardship", label: "Aquinnah THPO describes present stewardship authority", statement: "The Aquinnah THPO page describes present tribal historic-preservation and consultation responsibilities; it is contextual stewardship evidence, not evidence for a specific seventeenth-century event.", subject: "community-aquinnah", account: "aquinnah-history", source: "aquinnah-thpo", locator: "Section heading: Tribal Historic Preservation Officer (THPO)", role: "contextualizes", date: "present-day stewardship", geography: "Aquinnah and ancestral lands" },
  { slug: "chappa-intercommunity", label: "Chappaquiddick history presents Noepe intercommunity connections", statement: "Chappaquiddick Wampanoag public history presents historical connections with other Wampanoag communities on Noepe while retaining a distinct Chappaquiddick identity.", subject: "community-chappaquiddick", account: "chappaquiddick-history", source: "chappaquiddick-history", locator: "Heading: A Brief History", role: "supports", date: "core use 1614-1676", geography: "Chappaquiddick and Noepe" },
  { slug: "epenow-1611-1614", label: "Chappaquiddick history dates the Epenow episode", statement: "The Chappaquiddick timeline associates Epenow with captivity and return episodes dated 1611 and 1614; the dates remain source-attributed.", subject: "event-epenow-return", account: "chappaquiddick-history", source: "chappaquiddick-history", locator: "Selected Dates: 1611 and 1614 entries", role: "supports", date: "1611-1614", geography: "Noepe and England" },
  { slug: "pakeponessoo-1642", label: "Chappaquiddick timeline names Pakeponessoo in 1642", statement: "The Chappaquiddick Wampanoag timeline names Pakeponessoo in its 1642 entry.", subject: "person-pakeponessoo", account: "chappaquiddick-history", source: "chappaquiddick-history", locator: "Selected Dates: 1642 entry", role: "supports", date: "1642", geography: "Chappaquiddick" },
  { slug: "hiacoomes-1651", label: "Chappaquiddick timeline presents a 1651 assembly account", statement: "The Chappaquiddick Wampanoag timeline presents a 1651 Christian assembly account associated with Hiacoomes; it is not generalized to every Noepe community.", subject: "event-noepe-1651-assembly", account: "chappaquiddick-history", source: "chappaquiddick-history", locator: "Selected Dates: 1651 entry", role: "supports", date: "1651", geography: "Noepe" },
  { slug: "herring-patuxet-continuity", label: "Herring Pond timeline frames survival after the 1617-1619 epidemic", statement: "The Herring Pond tribal timeline presents Wampanoag survival and continuity after the 1617-1619 epidemic, qualifying narratives of disappearance.", subject: "community-herring-pond", account: "herring-pond-timeline", source: "herring-pond-timeline", locator: "Historical Events: 1617-1619 entry", role: "qualifies", date: "1617-1619", geography: "Wampanoag homelands and Patuxet context" },
  { slug: "herring-cotton-diary", label: "Herring Pond timeline identifies Cotton diary and vocabulary context", statement: "The Herring Pond timeline identifies John Cotton Jr.'s 1666-1667 diary and vocabulary as a mediated documentary context for community history.", subject: "event-herring-pond-1666-1667", account: "herring-pond-timeline", source: "herring-pond-timeline", locator: "Historical Events: 1666-1667 entry", role: "supports", date: "1666-1667", geography: "Herring Pond" },
  { slug: "mashpee-1620-homelands", label: "Mashpee timeline frames 1620 settlement on Wampanoag land", statement: "The Mashpee Wampanoag timeline frames the 1620 English settlement within existing Wampanoag homelands.", subject: "event-mashpee-1620-context", account: "mashpee-timeline", source: "mashpee-timeline", locator: "A Brief Timeline of Wampanoag History: 1620 entry", role: "supports", date: "1620", geography: "Plymouth and Wampanoag homelands" },
  { slug: "mashpee-1675-impact", label: "Mashpee timeline reports regional war impact", statement: "The Mashpee Wampanoag timeline reports severe community impacts during the war beginning in 1675; the statement remains attributed and is not treated as a universal numerical estimate.", subject: "event-mashpee-1675-impact", account: "mashpee-timeline", source: "mashpee-timeline", locator: "A Brief Timeline of Wampanoag History: 1675 entry", role: "supports", date: "1675-1676", geography: "Wampanoag homelands" },
  { slug: "mashpee-archives-governed-access", label: "Mashpee archives describes governed access", statement: "The Mashpee Wampanoag Tribal Archives describes community-governed archival stewardship and item-level access requirements; portal registration does not accept unidentified items as claim evidence.", subject: "community-mashpee", account: "mashpee-timeline", source: "mashpee-archives", locator: "Repository heading: Mashpee Wampanoag Tribal Archives", role: "contextualizes", date: "present archive practice", geography: "Mashpee" },
  { slug: "great-island-activity", label: "Great Island study reports low-density Indigenous activity", statement: "The Great Island study reports extensive low-density Indigenous activity at the site across a radiocarbon plateau broadly spanning AD 1480-1630.", subject: "event-great-island-occupation", account: "beranek-great-island", source: "beranek-great-island", locator: "doi:10.1017/aaq.2024.80; pp. 307-327; section: Great Island Site 2", role: "supports", date: "approximately AD 1480-1630", geography: "Great Island, Wellfleet" },
  { slug: "great-island-site-specific", label: "Great Island evidence is site-specific", statement: "The Great Island archaeological findings are site-specific and do not establish a universal settlement pattern or precise political boundary.", subject: "place-great-island", account: "beranek-great-island", source: "beranek-great-island", locator: "doi:10.1017/aaq.2024.80; pp. 307-327; section: Discussion", role: "qualifies", date: "study published 2025; evidence pre-1630", geography: "Great Island, Wellfleet" },
  { slug: "great-island-tribal-monitors", label: "Great Island fieldwork included tribal monitors", statement: "The Great Island study reports participation by tribal monitors, an important part of the study's documented research context.", subject: "work-beranek-great-island", account: "beranek-great-island", source: "beranek-great-island", locator: "doi:10.1017/aaq.2024.80; pp. 307-327; section: Great Island Site 2", role: "contextualizes", date: "modern fieldwork reported in 2025", geography: "Great Island, Wellfleet" },
  { slug: "carns-native-site", label: "NPS identifies the Carns Site as an Indigenous archaeological site", statement: "The National Park Service identifies the Carns Site as an Indigenous archaeological site discovered in an eroding coastal setting.", subject: "place-carns", account: "nps-carns", source: "nps-carns", locator: "Webpage section: The Carns Site", role: "supports", date: "precontact context; modern investigation", geography: "Coast Guard Beach, Eastham" },
  { slug: "carns-no-later-identity", label: "Carns evidence does not assign a later political identity", statement: "The Carns Site summary provides deep-history context but does not by itself identify a later seventeenth-century community or political boundary.", subject: "event-carns-investigation", account: "nps-carns", source: "nps-carns", locator: "Webpage section: The Carns Site", role: "qualifies", date: "pre-1614 archaeological context", geography: "Coast Guard Beach, Eastham" },
  { slug: "hornblower-dates", label: "Watson study provides bounded AMS dates for Hornblower II", statement: "Watson reports new AMS dates for the Hornblower II site in a bounded site-specific study.", subject: "place-hornblower-ii", account: "watson-ams-dates", source: "watson-ams-dates", locator: "doi:10.1017/RDC.2020.19; pp. 1437-1451; dated-sample table", role: "supports", date: "precontact periods", geography: "southwestern Noepe" },
  { slug: "frisby-dates", label: "Watson study provides bounded AMS dates for Frisby-Butler", statement: "Watson reports new AMS dates for the Frisby-Butler site in a bounded site-specific study.", subject: "place-frisby-butler", account: "watson-ams-dates", source: "watson-ams-dates", locator: "doi:10.1017/RDC.2020.19; pp. 1437-1451; dated-sample table", role: "supports", date: "precontact periods", geography: "southwestern Noepe" },
  { slug: "watson-seasonal-use-qualified", label: "Watson seasonal-use interpretation remains site-specific", statement: "The study's seasonal-use interpretation concerns the Hornblower II and Frisby-Butler sites and does not establish seventeenth-century territorial ownership.", subject: "work-watson-ams", account: "watson-ams-dates", source: "watson-ams-dates", locator: "doi:10.1017/RDC.2020.19; pp. 1437-1451", role: "qualifies", date: "pre-1614 archaeological context", geography: "southwestern Noepe" },
  { slug: "easton-native-grievances-mediated", label: "Easton reports Native grievances through a colonial mediator", statement: "Easton's relation reports Native grievances presented during negotiations, but those statements remain mediated through Easton's colonial authorship.", subject: "event-easton-negotiations", account: "easton-relation", source: "easton-relation", locator: "Electronic edition landing page: Abstract; original-language appendix retained", role: "supports", date: "1675", geography: "Pokanoket, Swansea, and Rhode Island" },
  { slug: "easton-differs-mather", label: "Easton edition notes a different account from Mather", statement: "The Easton edition describes his account as differing materially from Increase Mather's narrative, supporting an explicit competing-account structure.", subject: "work-easton-relation", account: "easton-relation", source: "easton-relation", locator: "Electronic edition landing page: Abstract", role: "qualifies", date: "1675-1676", geography: "southern New England" },
  { slug: "mather-providential-frame", label: "Mather uses a providential war frame", statement: "The Mather edition describes a defensive-war and providential framing tied to Puritan colonial leadership; this corpus records it as a perspective, not neutral fact.", subject: "work-mather-history", account: "mather-brief-history", source: "mather-brief-history", locator: "Electronic edition landing page: Abstract", role: "supports", date: "1676", geography: "New England" },
  { slug: "mather-chronology-scope", label: "Mather narrative scope extends through August 1676", statement: "The electronic edition describes Mather's contemporary narrative as covering the war through August 1676.", subject: "event-mather-publication", account: "mather-brief-history", source: "mather-brief-history", locator: "Electronic edition landing page: Abstract and bibliographic metadata", role: "neutral_or_background", date: "1675-August 1676", geography: "New England" },
  { slug: "hubbard-map-identity", label: "Library of Congress identifies the 1677 Hubbard map object", statement: "The Library of Congress catalog identifies the 1677 Hubbard map object by call number G3720 1677 .H81 and LCCN gm71002303.", subject: "work-hubbard-map", account: "hubbard-map", source: "hubbard-map", locator: "Map title; call number G3720 1677 .H81; LCCN gm71002303; IIIF object", role: "supports", date: "1677", geography: "New England" },
  { slug: "hubbard-map-defects", label: "Hubbard map defects qualify spatial use", statement: "The Library of Congress object notes physical defects; the map is used for source-bounded names and locations, not exact territorial boundaries.", subject: "work-hubbard-map", account: "hubbard-map", source: "hubbard-map", locator: "LCCN gm71002303; catalog notes and IIIF object", role: "qualifies", date: "1677 object; modern digital surrogate", geography: "New England" },
  { slug: "mittark-postwar-petition", label: "Mittark petition supplies post-1676 continuity context", statement: "The scholarly edition identifies a 1681 petition associated with Gay Head sachem Mittark; it is used only as explicitly marked post-1676 continuity context.", subject: "work-mittark-petition", account: "mittark-petition", source: "mittark-petition", locator: "doi:10.2307/j.ctt1d9njj2.206; pp. 435-436", role: "contextualizes", date: "1681, outside core window", geography: "Gay Head (Aquinnah), Noepe" },
];

const accountDefinitions = [
  ["aquinnah-history", "work-aquinnah-history", "Aquinnah tribal public-history account"],
  ["chappaquiddick-history", "work-chappaquiddick-history", "Chappaquiddick tribal public-history account"],
  ["herring-pond-timeline", "work-herring-pond-timeline", "Herring Pond tribal timeline account"],
  ["mashpee-timeline", "work-mashpee-timeline", "Mashpee tribal timeline account"],
  ["beranek-great-island", "work-beranek-great-island", "Great Island archaeological analysis"],
  ["easton-relation", "work-easton-relation", "Easton mediated colonial account"],
  ["mather-brief-history", "work-mather-history", "Mather providential colonial account"],
  ["hubbard-map", "work-hubbard-map", "Hubbard cartographic account"],
  ["nps-carns", "work-nps-carns", "National Park Service archaeological account"],
  ["watson-ams-dates", "work-watson-ams", "Watson archaeological chronology account"],
  ["silverman-faith-boundaries", "work-silverman-faith-boundaries", "Silverman scholarly interpretation"],
  ["mittark-petition", "work-mittark-petition", "Mittark petition in scholarly edition"],
  ["mhc-cape-islands", "work-mhc-report", "Massachusetts Historical Commission reconnaissance account"],
  ["brooks-beloved-kin", "work-brooks-beloved-kin", "Brooks Indigenous-centered scholarly interpretation"],
] as const;

const relationshipDefinitions: Array<[string, string, string, string]> = [
  ["aquinnah-at-aquinnah", "community-aquinnah", "place-aquinnah", "associated_with"],
  ["great-island-wellfleet", "place-great-island", "place-wellfleet", "located_within"],
  ["chappa-at-chappa", "community-chappaquiddick", "place-chappaquiddick", "associated_with"],
  ["chappa-on-noepe", "community-chappaquiddick", "place-noepe", "located_within"],
  ["cape-poge-chappa", "place-cape-poge", "place-chappaquiddick", "part_of"],
  ["herring-community-place", "community-herring-pond", "place-herring-pond", "associated_with"],
  ["mashpee-community-place", "community-mashpee", "place-mashpee", "associated_with"],
  ["aquinnah-thpo-context", "work-aquinnah-thpo", "community-aquinnah", "documents"],
  ["delucia-memory-context", "work-delucia-memory-lands", "place-great-swamp", "contextualizes"],
  ["hubbard-narrative-context", "work-hubbard-narrative", "place-mount-hope", "documents"],
  ["mashpee-archive-context", "work-mashpee-archives", "community-mashpee", "documents"],
  ["nara-portal-context", "work-nara-yale-portal", "place-manomet", "catalogs"],
  ["occupation-great-island", "event-great-island-occupation", "place-great-island", "occurred_at"],
  ["thomas-spatial-context", "work-thomas-creating-new-england", "group-regional-network", "contextualizes"],
  ["investigation-carns", "event-carns-investigation", "place-carns", "concerns"],
  ["hornblower-noepe", "place-hornblower-ii", "place-noepe", "located_on"],
  ["frisby-noepe", "place-frisby-butler", "place-noepe", "located_on"],
  ["hornblower-use", "event-hornblower-seasonal-use", "place-hornblower-ii", "occurred_at"],
  ["frisby-use", "event-frisby-seasonal-use", "place-frisby-butler", "occurred_at"],
  ["epenow-event", "person-epenow", "event-epenow-return", "participant_in"],
  ["epenow-noepe", "person-epenow", "place-noepe", "associated_with"],
  ["pakeponessoo-entry", "person-pakeponessoo", "event-chappa-1642-entry", "reported_in"],
  ["pakeponessoo-chappa", "person-pakeponessoo", "place-chappaquiddick", "associated_with"],
  ["hiacoomes-assembly", "person-hiacoomes", "event-noepe-1651-assembly", "participant_in"],
  ["assembly-noepe", "event-noepe-1651-assembly", "place-noepe", "occurred_at"],
  ["cotton-herring-event", "person-john-cotton-jr", "event-herring-pond-1666-1667", "reported_in"],
  ["herring-event-place", "event-herring-pond-1666-1667", "place-herring-pond", "associated_with"],
  ["mashpee-1620-place", "event-mashpee-1620-context", "place-mashpee", "contextualized_by"],
  ["mashpee-1675-community", "event-mashpee-1675-impact", "community-mashpee", "affected"],
  ["easton-negotiations", "person-john-easton", "event-easton-negotiations", "reported"],
  ["easton-work", "person-john-easton", "work-easton-relation", "author_of"],
  ["mather-work", "person-increase-mather", "work-mather-history", "author_of"],
  ["mather-publication-work", "event-mather-publication", "work-mather-history", "published_work"],
  ["mittark-petition", "person-mittark", "work-mittark-petition", "associated_with"],
  ["mittark-aquinnah", "person-mittark", "place-aquinnah", "associated_with"],
  ["weetamoo-pocasset", "person-weetamoo", "place-pocasset", "associated_with"],
  ["awashonks-sakonnet", "person-awashonks", "place-sakonnet", "associated_with"],
  ["metacom-mount-hope", "person-metacom-regional", "place-mount-hope", "associated_with"],
  ["manomet-network", "place-manomet", "group-regional-network", "regional_context"],
  ["nemasket-network", "place-nemasket", "group-regional-network", "regional_context"],
  ["mount-hope-network", "place-mount-hope", "group-regional-network", "regional_context"],
  ["pocasset-network", "place-pocasset", "group-regional-network", "regional_context"],
  ["sakonnet-network", "place-sakonnet", "group-regional-network", "regional_context"],
  ["existing-cape-cod-network", "place-cape-cod", "group-regional-network", "regional_context"],
  ["existing-great-swamp-war-context", "place-great-swamp", "event-mashpee-1675-impact", "regional_context"],
  ["existing-narragansett-bay-negotiation-context", "place-narragansett-bay", "event-easton-negotiations", "regional_context"],
  ["existing-swansea-negotiation-context", "place-swansea", "event-easton-negotiations", "regional_context"],
  ["existing-sassamon-crisis-context", "person-john-sassamon", "event-easton-negotiations", "regional_context"],
];

const eventDates: Array<[string, string, string, string]> = [
  ["epenow-return", "event-epenow-return", "approximate", "1611-1614"],
  ["chappa-1642", "event-chappa-1642-entry", "exact", "1642"],
  ["noepe-1651", "event-noepe-1651-assembly", "exact", "1651"],
  ["herring-1666-1667", "event-herring-pond-1666-1667", "range", "1666-1667"],
  ["mashpee-1620", "event-mashpee-1620-context", "exact", "1620"],
  ["mashpee-1675", "event-mashpee-1675-impact", "range", "1675-1676"],
  ["great-island", "event-great-island-occupation", "approximate", "1480-1630"],
  ["carns-investigation", "event-carns-investigation", "approximate", "before 2025; modern investigation"],
  ["hornblower-use", "event-hornblower-seasonal-use", "before", "before 1614"],
  ["frisby-use", "event-frisby-seasonal-use", "before", "before 1614"],
  ["easton-1675", "event-easton-negotiations", "exact", "1675"],
  ["mather-1676", "event-mather-publication", "exact", "1676"],
];

const workDates: Array<[string, string, string]> = [
  ["aquinnah-history", "work-aquinnah-history", "2026 inspection; undated page"],
  ["chappa-history", "work-chappaquiddick-history", "2026 inspection; undated page"],
  ["herring-timeline", "work-herring-pond-timeline", "2026 inspection; undated page"],
  ["mashpee-timeline", "work-mashpee-timeline", "2026 inspection; undated page"],
  ["beranek-2025", "work-beranek-great-island", "2025"],
  ["work-easton-1675", "work-easton-relation", "1675; modern electronic edition"],
  ["hubbard-1677", "work-hubbard-map", "1677"],
  ["work-mather-1676", "work-mather-history", "1676"],
  ["mittark-1681", "work-mittark-petition", "1681; scholarly edition 2014"],
  ["watson-2020", "work-watson-ams", "2020"],
];

const personAttestations: Array<[string, string, string]> = [
  ["epenow", "person-epenow", "1611-1614 attested episode"],
  ["pakeponessoo", "person-pakeponessoo", "1642 timeline attestation"],
  ["hiacoomes", "person-hiacoomes", "1651 timeline attestation"],
  ["cotton", "person-john-cotton-jr", "1666-1667 documentary context"],
  ["mittark", "person-mittark", "1681 petition attestation"],
  ["easton", "person-john-easton", "1675 relation"],
  ["mather", "person-increase-mather", "1676 publication"],
  ["weetamoo", "person-weetamoo", "1675-1676 core context"],
  ["metacom", "person-metacom-regional", "1675-1676 core context"],
  ["awashonks", "person-awashonks", "1675-1676 core context"],
];

function sourceFor(slug: string): string {
  return sourceId(`hr9-src-${slug}`);
}

function makeDate(
  slug: string,
  subject: string,
  kind: string,
  label: string,
  source: string,
): PreparedItem {
  const object: JsonObject = {
    id: `${PREFIX}-time-${slug}`,
    label: `Attested date context for ${subject}`,
    subjectId: entityRef(subject),
    domain: "HistoryRoot",
    sourceIds: [sourceFor(source)],
    status: "corpus-review-ready",
    dateLabel: label,
    temporalKind: kind,
    calendarSystem: "historical-chronology",
    datePrecision: kind === "exact" ? "year" : "bounded-or-descriptive",
    dateNotes:
      "This expression dates a documented event, work, or attestation; it is not a birth, death, or unsupported precise date.",
  };
  if (kind === "exact") {
    object.exactDate = `${label.slice(0, 4)}-01-01`;
  } else if (kind === "range") {
    const [start, end] = label.split("-");
    object.startDate = `${start}-01-01`;
    object.endDate = `${end}-12-31`;
  } else if (kind === "before") {
    const year = label.match(/\d{4}/)?.[0] ?? "1614";
    object.beforeDate = `${year}-01-01`;
  } else {
    const years = label.match(/\d{4}/g);
    object.startDate = `${years?.[0] ?? "1600"}-01-01`;
    object.endDate = `${years?.at(-1) ?? years?.[0] ?? "2026"}-12-31`;
    object.startUncertainty = "Approximate or documentary-attestation boundary.";
    object.endUncertainty = "Approximate or documentary-attestation boundary.";
  }
  return item(object, "New Chunk 9 date expression with false precision explicitly avoided.");
}

export function createWampanoagRegionalWorkspace(
  baseline: SourcePreparationWorkspaceV1_1,
  registry: AcquisitionRegistry,
): SourcePreparationWorkspaceV1_1 {
  const workspace = structuredClone(baseline);
  const accepted = registry.candidates
    .filter((candidate) => candidate.acquisitionStatus === "accepted")
    .sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  if (accepted.length !== 20) {
    throw new Error(`Expected 20 accepted candidates; found ${accepted.length}.`);
  }

  workspace.workspaceId = "historyroot-wampanoag-regional-corpus-v1";
  workspace.title =
    "Wampanoag Homelands and Intercommunity Networks, 1614-1676";
  workspace.description =
    "Lossless Chunk 8 corpus plus a source-bounded regional expansion. Pre-1614 archaeology and post-1676 continuity are contextual only.";
  workspace.reviewMetadata = {
    bundleId: "historyroot-plymouth-knowledge-dataset-v1",
    version: "1.3.0",
    createdAt: APPROVED_AT,
    createdBy: "SourceRoot HistoryRoot Wampanoag regional corpus v1",
    description:
      "Replacement-safe combined HistoryRoot corpus preserving the accepted canonical bundle identity while adding bounded regional records, claims, sources, locators, provenance, and contextual structures.",
  };
  workspace.approvals = {
    approved: true,
    approvedBy: APPROVED_BY,
    approvedAt: APPROVED_AT,
    note:
      "All 20 accepted acquisition candidates are registered. The three rejected candidates and all unsupported newly discovered sources are excluded.",
  };
  workspace.bundleFields.extensions = {
    ...(workspace.bundleFields.extensions ?? {}),
    wampanoagRegionalCorpus: {
      corpusId: "historyroot-wampanoag-regional-corpus-v1",
      title: workspace.title,
      baselineCorpusId: "historyroot-corpus-expansion-quality-v1",
      baselineVersion: "1.2.0",
      version: "1.3.0",
      corePeriod: "1614-1676",
      pre1614Use: "contextual-only",
      post1676Use: "contextual-only",
      acceptedCandidateCount: 20,
      rejectedCandidateCount: 3,
      noUnsupportedSources: true,
      noTerritorialPolygons: true,
      noUniversalReliabilityScore: true,
      noArtificialVersionHistory: true,
    },
  };

  workspace.sourceSet.push(...buildSources(accepted));
  workspace.records.push(...recordDefinitions.map((definition) => item({
    id: recordId(definition.slug),
    label: definition.label,
    entityType: definition.entityType,
    name: definition.label,
    ...(definition.alternateNames
      ? { alternateNames: definition.alternateNames }
      : {}),
    description: definition.description,
    domain: "HistoryRoot",
    sourceIds: [sourceFor(definition.source)],
    status: "corpus-review-ready",
    metadata: {
      corpusAddition: "chunk-9",
      noTerritorialPolygon: definition.entityType === "place",
      identityReviewRequired: true,
    },
  }, "New Chunk 9 regional record; identity distinctions and geographic uncertainty are preserved.")));

  workspace.accounts.push(...accountDefinitions.map(
    ([slug, subject, label]) => item({
      id: `${PREFIX}-account-${slug}`,
      label,
      subjectId: entityRef(subject),
      sourceId: sourceFor(slug),
      accountType: slug.includes("timeline") || slug.includes("history")
        ? "attributed-community-or-institutional-account"
        : "attributed-source-account",
      content:
        "A bounded reporting or interpretive account whose perspective and limitations remain explicit.",
      publicationLabel: label,
      domain: "HistoryRoot",
      sourceIds: [sourceFor(slug)],
      status: "corpus-review-ready",
      metadata: {
        attributedAccount: true,
        sourceLimitationRequired: true,
        notUniversalCommunityVoice: true,
      },
    }, "New Chunk 9 reporting account with explicit source identity and limitation."),
  ));

  for (const definition of claims) {
    const claimId = `${PREFIX}-claim-${definition.slug}`;
    const evidenceId = `${PREFIX}-evidence-${definition.slug}`;
    const accountId = `${PREFIX}-account-${definition.account}`;
    const source = sourceFor(definition.source);
    workspace.claims.push(item({
      id: claimId,
      label: definition.label,
      accountId: definition.slug === "mashpee-1620-homelands"
        ? "historyroot-plymouth-account-mashpee"
        : accountId,
      subjectId: entityRef(definition.subject),
      claimType: "source-bounded-regional-context",
      statement: definition.statement,
      confidence: "source-bounded",
      uncertainty:
        "The statement is bounded to the named source, locator, time, and geography and remains subject to historical, editorial, and tribal review.",
      domain: "HistoryRoot",
      sourceIds: [source],
      status: "corpus-review-ready",
      metadata: {
        locator: definition.locator,
        dateContext: definition.date,
        geographicContext: definition.geography,
        preparationStatus: "approved",
        substantiveClaim: true,
        reviewRequired: true,
      },
    }, "New Chunk 9 bounded claim; no unlocated quotation or unsupported inference is introduced."));
    workspace.evidence.push(item({
      id: evidenceId,
      label: `Evidence for: ${definition.label}`,
      claimId,
      evidenceType: "evidence",
      sourceId: source,
      accountId,
      explanation:
        `${definition.locator}. Role: ${definition.role}. The source limitation and reporting perspective remain controlling.`,
      strength: "bounded-locator",
      confidence: "role-explicit",
      domain: "HistoryRoot",
      sourceIds: [source],
      status: "corpus-review-ready",
      metadata: {
        locator: definition.locator,
        limitation: "No universal reliability or truth score is assigned.",
        supportsClaimId: claimId,
      },
    }, "New Chunk 9 evidence record preserving the accepted source and bounded locator."));
    workspace.sourceLocators.push(item({
      id: `${PREFIX}-locator-${definition.slug}`,
      evidenceId,
      sourceId: source,
      locatorType: "citation",
      locatorLabel: definition.locator,
      locator: {
        acceptedReference: definition.locator,
      },
      note:
        "Real bounded locator from the accepted acquisition or a specifically resolved stable heading; no page or identifier was invented.",
    }, "New Chunk 9 structured locator."));
    workspace.fieldProvenance.push(item({
      id: `${PREFIX}-provenance-claim-${definition.slug}-statement`,
      targetId: claimId,
      fieldPath: "statement",
      sourceId: source,
      supportType: "reporting-provenance",
      note:
        "Field provenance identifies the reporting source and does not convert attribution into proof.",
    }, "New Chunk 9 claim-statement field provenance."));
    workspace.claimAttributions.push(item({
      id: `${PREFIX}-attribution-${definition.slug}`,
      claimId,
      accountId,
      attributionRole: "reported_by",
      sourceIds: [source],
      note:
        "The source or community account is explicit; project-level inference is not imported as historical fact.",
      confidence: "source-path-explicit",
    }, "New Chunk 9 explicit reporting attribution."));
  }

  // The projected 18 explicit links are reserved for the claims most useful
  // in Context Review; every other new claim documents why no duplicate link
  // is needed while retaining evidence, locator, attribution, and provenance.
  for (const definition of claims.slice(0, 18)) {
    workspace.evidenceLinks.push(item({
      id: `${PREFIX}-evidence-link-${definition.slug}`,
      evidenceId: `${PREFIX}-evidence-${definition.slug}`,
      claimId: `${PREFIX}-claim-${definition.slug}`,
      supportRole: definition.role,
      scopePath: "statement",
      explanation:
        `The evidence is linked only for the scoped role "${definition.role}"; provenance remains separately recorded.`,
      relevance: "directly-located-source-material",
      confidence: "role-explicit",
      sourceIds: [sourceFor(definition.source)],
    }, "New Chunk 9 explicit-role evidence link."));
  }

  workspace.relationships.push(...relationshipDefinitions.map(
    ([slug, from, to, relationshipType]) => {
      const source = entitySourceSlug(from);
      return item({
        id: `${PREFIX}-relationship-${slug}`,
        label: `${from} ${relationshipType} ${to}`,
        fromId: entityRef(from),
        toId: entityRef(to),
        relationshipType,
        explanation:
          "Source-bounded regional linkage; it does not imply centralized hierarchy, territorial ownership, or an unsupported kinship claim.",
        confidence: "source-bounded",
        uncertainty:
          "Historical labels, jurisdiction, and community identity remain distinct and reviewable.",
        domain: "HistoryRoot",
        sourceIds: [sourceFor(source)],
        status: "corpus-review-ready",
        metadata: {
          attributionKind: "source-grounded-editorial-linkage",
          reviewRequired: true,
          noBoundaryGeometry: true,
        },
      }, "New Chunk 9 relationship; artificial orphan-reduction links are prohibited.");
    },
  ));

  workspace.dateExpressions.push(
    ...eventDates.map(([slug, subject, kind, label]) => {
      const source = entitySourceSlug(subject);
      return makeDate(slug, subject, kind, label, source);
    }),
    ...workDates.map(([slug, subject, label]) => {
      const source = entitySourceSlug(subject);
      return makeDate(slug, subject, "approximate", label, source);
    }),
    ...personAttestations.map(([slug, subject, label]) => {
      const source = entitySourceSlug(subject);
      return makeDate(`attestation-${slug}`, subject, "approximate", label, source);
    }),
  );

  const aliasDefinitions: Array<[string, string, string, string]> = [
    ["noepe-marthas-vineyard", "place-noepe", "Martha's Vineyard", "colonial_or_modern"],
    ["aquinnah-gay-head", "place-aquinnah", "Gay Head", "colonial_or_modern"],
    ["metacom-king-philip", "person-metacom-regional", "King Philip", "colonial"],
    ["mount-hope-montaup", "place-mount-hope", "Montaup", "historical"],
    ["chappa-cappeack", "place-chappaquiddick", "Cappeack", "historical"],
    ["sakonnet-seconet", "place-sakonnet", "Seconet", "historical"],
    ["pocasset-pocasset-country", "place-pocasset", "Pocasset country", "historical"],
    ["mashpee-marshpee", "place-mashpee", "Marshpee", "colonial"],
    ["herring-pond-manomet", "place-herring-pond", "Herring Pond community place", "descriptive"],
    ["great-island-site-2", "place-great-island", "Great Island Site 2", "archaeological"],
    ["hornblower-site", "place-hornblower-ii", "Hornblower II", "archaeological"],
    ["frisby-site", "place-frisby-butler", "Frisby-Butler", "archaeological"],
  ];
  workspace.historicalNames.push(...aliasDefinitions.map(
    ([slug, entity, text, aliasType]) => item({
      id: `${PREFIX}-alias-${slug}`,
      entityId: entityRef(entity),
      text,
      aliasType: `custom:${aliasType}`,
      notes:
        "Name form is retained with its historical, colonial, modern, or archaeological context; it does not merge identities.",
      status: "corpus-review-ready",
      sourceIds: [sourceFor(
        entitySourceSlug(entity),
      )],
    }, "New Chunk 9 historical-name context with identity distinctions preserved."),
  ));

  const relationPairs: Array<[string, string, "qualifies" | "contradicts", string]> = [
    ["herring-patuxet-continuity", "mashpee-1675-impact", "qualifies", "Community continuity qualifies any reading of wartime impact as disappearance."],
    ["great-island-site-specific", "great-island-activity", "qualifies", "The site-specific limit qualifies broader use of the archaeological activity evidence."],
    ["carns-no-later-identity", "carns-native-site", "qualifies", "Deep-history site identification does not establish a later political identity."],
    ["watson-seasonal-use-qualified", "hornblower-dates", "qualifies", "Site-specific chronology does not establish territorial ownership."],
    ["watson-seasonal-use-qualified", "frisby-dates", "qualifies", "Site-specific chronology does not establish territorial ownership."],
    ["easton-differs-mather", "mather-providential-frame", "contradicts", "Easton's negotiation-centered account and Mather's providential framing are preserved as materially competing accounts."],
    ["hubbard-map-defects", "hubbard-map-identity", "qualifies", "The mapped object is identifiable, but defects and cartographic perspective constrain spatial use."],
    ["mittark-postwar-petition", "aquinnah-continuity", "qualifies", "The 1681 petition supplies contextual continuity after, not evidence within, the core 1614-1676 window."],
  ];
  workspace.claimRelations.push(...relationPairs.map(
    ([from, to, relationType, explanation]) => item({
      id: `${PREFIX}-claim-relation-${from}-${to}`,
      fromClaimId: `${PREFIX}-claim-${from}`,
      toClaimId: `${PREFIX}-claim-${to}`,
      relationType,
      explanation,
      sourceIds: [
        sourceFor(claims.find((entry) => entry.slug === from)?.source
          ?? "aquinnah-history"),
        sourceFor(claims.find((entry) => entry.slug === to)?.source
          ?? "aquinnah-history"),
      ],
      confidence: "scoped-editorial-link",
      uncertainty:
        "The relation preserves both claims and does not resolve historical truth automatically.",
      reviewStatus: "corpus-review-ready",
    }, "New Chunk 9 qualifying or conflicting-account structure."),
  ));

  for (const [slug, source] of [
    ["community-aquinnah", "aquinnah-history"],
    ["community-chappaquiddick", "chappaquiddick-history"],
    ["community-herring-pond", "herring-pond-timeline"],
    ["community-mashpee", "mashpee-timeline"],
  ] as const) {
    workspace.fieldProvenance.push(item({
      id: `${PREFIX}-provenance-${slug}-name`,
      targetId: entityRef(slug),
      fieldPath: "name",
      sourceId: sourceFor(source),
      supportType: "identity-field-source",
      note:
        "The named tribal source supports this display name; the record remains distinct from colonial labels and modern jurisdictional descriptions.",
    }, "New Chunk 9 identity-field provenance."));
  }

  const perspectiveDefinitions: Array<[string, string, string]> = [
    ["aquinnah", "Aquinnah tribal public-history framing", "aquinnah-history"],
    ["chappaquiddick", "Chappaquiddick tribal public-history framing", "chappaquiddick-history"],
    ["herring-pond", "Herring Pond tribal timeline framing", "herring-pond-timeline"],
    ["mashpee", "Mashpee tribal timeline framing", "mashpee-timeline"],
    ["archaeology", "Site-specific archaeological framing", "beranek-great-island"],
    ["easton", "Easton colonial mediation framing", "easton-relation"],
    ["mather", "Mather Puritan providential framing", "mather-brief-history"],
    ["cartographic", "Seventeenth-century colonial cartographic framing", "hubbard-map"],
  ];
  workspace.perspectives.push(...perspectiveDefinitions.map(
    ([slug, label, source]) => item({
      id: `${PREFIX}-perspective-${slug}`,
      label,
      name: label,
      description:
        "Explicitly attributed perspective; it is not treated as a unified regional or community voice.",
      domain: "HistoryRoot",
      sourceIds: [sourceFor(source)],
      status: "corpus-review-ready",
      metadata: {
        attributedTo: label,
        perspectiveScope: "source-specific",
      },
    }, "New Chunk 9 perspective with accountable source attribution."),
  ));

  const interpretationDefinitions: Array<[string, string, string, string]> = [
    ["intercommunity-distinction", "Intercommunity connections without centralized hierarchy", "group-regional-network", "aquinnah"],
    ["noepe-continuity", "Noepe continuity across the core boundary", "place-noepe", "aquinnah"],
    ["chappa-distinct", "Chappaquiddick identity remains distinct within Noepe connections", "community-chappaquiddick", "chappaquiddick"],
    ["herring-survival", "Continuity qualifies disappearance narratives", "community-herring-pond", "herring-pond"],
    ["archaeology-site-specific", "Archaeology supplies contextual chronology, not later political identity", "event-great-island-occupation", "archaeology"],
    ["easton-mediated", "Easton's reported grievances remain mediated", "event-easton-negotiations", "easton"],
    ["mather-perspective", "Mather's chronology is inseparable from providential framing", "work-mather-history", "mather"],
    ["map-limited", "Hubbard map is evidence of cartographic representation, not exact boundaries", "work-hubbard-map", "cartographic"],
  ];
  workspace.interpretations.push(...interpretationDefinitions.map(
    ([slug, label, subject, perspective]) => {
      const source = perspectiveDefinitions.find((entry) =>
        entry[0] === perspective)?.[2] ?? "aquinnah-history";
      return item({
        id: `${PREFIX}-interpretation-${slug}`,
        label,
        subjectId: entityRef(subject),
        accountId: `${PREFIX}-account-${source}`,
        sourceId: sourceFor(source),
        interpretation: label,
        confidence: "bounded-interpretation",
        uncertainty:
          "Project-level synthesis is labeled as interpretation and is not imported as a historical fact claim.",
        publishedConclusion: false,
        domain: "HistoryRoot",
        sourceIds: [sourceFor(source)],
        status: "corpus-review-ready",
        metadata: {
          attributionKind: "project-level-inference",
          reviewRequired: true,
          perspectiveId: `${PREFIX}-perspective-${perspective}`,
        },
      }, "New Chunk 9 labeled project interpretation, kept separate from claims.");
    },
  ));
  workspace.interpretations.push(
    item({
      id: `${PREFIX}-interpretation-silverman-bounded-use`,
      label: "Silverman Chapter 4 is bounded interpretation context",
      subjectId: entityRef("work-silverman-faith-boundaries"),
      accountId: `${PREFIX}-account-silverman-faith-boundaries`,
      sourceId: sourceFor("silverman-faith-boundaries"),
      interpretation:
        "The accepted Chapter 4 DOI and pages identify a responsible path for Noepe governance research, but no claim is imported without a narrower page locator.",
      confidence: "bounded-interpretation",
      uncertainty: "Future claim-level page review is required.",
      publishedConclusion: false,
      domain: "HistoryRoot",
      sourceIds: [sourceFor("silverman-faith-boundaries")],
      status: "corpus-review-ready",
      metadata: { attributionKind: "acquisition-use-interpretation", reviewRequired: true },
    }, "New Chunk 9 source-use interpretation, not a historical fact claim."),
    item({
      id: `${PREFIX}-interpretation-mhc-bounded-use`,
      label: "MHC report requires page-image and newer-source review",
      subjectId: entityRef("work-mhc-report"),
      accountId: `${PREFIX}-account-mhc-cape-islands`,
      sourceId: sourceFor("mhc-cape-islands"),
      interpretation:
        "The state report is useful for research-gap and place context, but its dated content and OCR warning require page-image review and newer tribal or peer-reviewed sources.",
      confidence: "bounded-interpretation",
      uncertainty: "No OCR-derived historical claim is imported.",
      publishedConclusion: false,
      domain: "HistoryRoot",
      sourceIds: [sourceFor("mhc-cape-islands")],
      status: "corpus-review-ready",
      metadata: { attributionKind: "acquisition-use-interpretation", reviewRequired: true },
    }, "New Chunk 9 source-use interpretation, not a historical fact claim."),
    item({
      id: `${PREFIX}-interpretation-brooks-bounded-use`,
      label: "Brooks monograph is registered for page-bounded network research",
      subjectId: entityRef("work-brooks-beloved-kin"),
      accountId: `${PREFIX}-account-brooks-beloved-kin`,
      sourceId: sourceFor("brooks-beloved-kin"),
      interpretation:
        "The accepted monograph is relevant to kin and regional-network research, but no book-level historical claim is imported without exact pages.",
      confidence: "bounded-interpretation",
      uncertainty: "Future claim-level page review is required.",
      publishedConclusion: false,
      domain: "HistoryRoot",
      sourceIds: [sourceFor("brooks-beloved-kin")],
      status: "corpus-review-ready",
      metadata: { attributionKind: "acquisition-use-interpretation", reviewRequired: true },
    }, "New Chunk 9 source-use interpretation, not a historical fact claim."),
  );
  workspace.perspectiveLinks.push(...interpretationDefinitions.map(
    ([slug, , , perspective]) => linkItem(
      `prepared-perspective-link:${PREFIX}-interpretation-${slug}:${PREFIX}-perspective-${perspective}`,
      {
        recordId: `${PREFIX}-interpretation-${slug}`,
        perspectiveId: `${PREFIX}-perspective-${perspective}`,
        stance: "attributed-interpretation",
        notes:
          "Attribution is explicit and does not imply a unified community or institutional view.",
      },
      "New Chunk 9 perspective link.",
    ),
  ));

  workspace.causalLinks.push(
    item({
      id: `${PREFIX}-causal-war-impact-context`,
      label: "War is a context for reported community impact, not a complete single cause",
      causeId: entityRef("event-mashpee-1675-impact"),
      effectId: entityRef("community-mashpee"),
      causalKind: "cause",
      explanation:
        "The attributed Mashpee account identifies wartime impact while this link explicitly avoids a deterministic or exhaustive causal claim.",
      confidence: "qualified",
      uncertainty: "Community impacts require additional claim-level research.",
      domain: "HistoryRoot",
      sourceIds: [sourceFor("mashpee-timeline")],
      status: "corpus-review-ready",
      metadata: { notDeterministic: true, reviewRequired: true },
    }, "New Chunk 9 qualified causal context."),
    item({
      id: `${PREFIX}-causal-erosion-investigation`,
      label: "Coastal erosion prompted Carns Site investigation",
      causeId: entityRef("place-coast-guard-beach"),
      effectId: entityRef("event-carns-investigation"),
      causalKind: "cause",
      explanation:
        "The NPS site summary connects coastal erosion and archaeological investigation; this is modern preservation context.",
      confidence: "source-bounded",
      uncertainty: "Not a claim about precontact causation.",
      domain: "HistoryRoot",
      sourceIds: [sourceFor("nps-carns")],
      status: "corpus-review-ready",
      metadata: { notDeterministic: true, reviewRequired: true },
    }, "New Chunk 9 modern preservation causal context."),
    item({
      id: `${PREFIX}-causal-calibration-qualification`,
      label: "Radiocarbon calibration plateau constrains chronological precision",
      causeId: entityRef("event-great-island-occupation"),
      effectId: entityRef("work-beranek-great-island"),
      causalKind: "cause",
      explanation:
        "The calibration plateau constrains precision; it does not establish a single occupation year.",
      confidence: "method-explicit",
      uncertainty: "Site-specific archaeological interpretation.",
      domain: "HistoryRoot",
      sourceIds: [sourceFor("beranek-great-island")],
      status: "corpus-review-ready",
      metadata: { notDeterministic: true, reviewRequired: true },
    }, "New Chunk 9 methodological causal context."),
    item({
      id: `${PREFIX}-causal-source-framing`,
      label: "Authorial perspective shapes competing war accounts",
      causeId: entityRef("work-easton-relation"),
      effectId: entityRef("work-mather-history"),
      causalKind: "cause",
      explanation:
        "Different authorial positions help explain contrasting accounts without manufacturing symmetry or resolving historical truth.",
      confidence: "qualified",
      uncertainty: "The works differ in purpose, mediation, and perspective.",
      domain: "HistoryRoot",
      sourceIds: [sourceFor("easton-relation"), sourceFor("mather-brief-history")],
      status: "corpus-review-ready",
      metadata: { notDeterministic: true, reviewRequired: true },
    }, "New Chunk 9 qualified interpretive context."),
  );

  workspace.culturalMemories.push(
    item({
      id: `${PREFIX}-memory-aquinnah-continuity`,
      label: "Aquinnah continuity in tribal public history",
      subjectId: entityRef("community-aquinnah"),
      perspectiveId: `${PREFIX}-perspective-aquinnah`,
      sourceId: sourceFor("aquinnah-history"),
      memoryType: "tribal-public-history",
      narrative:
        "Aquinnah public history connects deep history, the colonial period, and present governance; the narrative remains attributed to the tribal institution.",
      periodLabel: "Deep history to present; core corpus 1614-1676",
      domain: "HistoryRoot",
      sourceIds: [sourceFor("aquinnah-history")],
      status: "corpus-review-ready",
      metadata: { attributedTo: "Wampanoag Tribe of Gay Head (Aquinnah)", reviewRequired: true },
    }, "New Chunk 9 cultural-memory context."),
    item({
      id: `${PREFIX}-memory-chappaquiddick-dates`,
      label: "Chappaquiddick selected-dates community narrative",
      subjectId: entityRef("community-chappaquiddick"),
      perspectiveId: `${PREFIX}-perspective-chappaquiddick`,
      sourceId: sourceFor("chappaquiddick-history"),
      memoryType: "tribal-public-history",
      narrative:
        "The selected-dates timeline organizes community history through named episodes while remaining a present tribal public-history account.",
      periodLabel: "1595 to present; core use 1614-1676",
      domain: "HistoryRoot",
      sourceIds: [sourceFor("chappaquiddick-history")],
      status: "corpus-review-ready",
      metadata: { attributedTo: "Chappaquiddick Wampanoag Tribe", reviewRequired: true },
    }, "New Chunk 9 cultural-memory context."),
    item({
      id: `${PREFIX}-memory-herring-continuity`,
      label: "Herring Pond continuity narrative",
      subjectId: entityRef("community-herring-pond"),
      perspectiveId: `${PREFIX}-perspective-herring-pond`,
      sourceId: sourceFor("herring-pond-timeline"),
      memoryType: "tribal-public-history",
      narrative:
        "The Herring Pond timeline presents survival, documentary encounters, and community continuity in a tribal public-history sequence.",
      periodLabel: "Deep history to present; core use 1614-1676",
      domain: "HistoryRoot",
      sourceIds: [sourceFor("herring-pond-timeline")],
      status: "corpus-review-ready",
      metadata: { attributedTo: "Herring Pond Wampanoag Tribe", reviewRequired: true },
    }, "New Chunk 9 cultural-memory context."),
    item({
      id: `${PREFIX}-memory-mittark-continuity`,
      label: "Mittark petition as postwar continuity context",
      subjectId: entityRef("work-mittark-petition"),
      perspectiveId: `${PREFIX}-perspective-aquinnah`,
      sourceId: sourceFor("mittark-petition"),
      memoryType: "published-indigenous-writing-context",
      narrative:
        "The 1681 petition is retained as post-boundary Indigenous-writing context and not projected backward as a claim about every 1614-1676 event.",
      periodLabel: "1681, contextual exception",
      domain: "HistoryRoot",
      sourceIds: [sourceFor("mittark-petition")],
      status: "corpus-review-ready",
      metadata: { attributedTo: "Mittark through the identified scholarly edition", reviewRequired: true },
    }, "New Chunk 9 post-boundary cultural-memory context."),
  );

  return workspace;
}
