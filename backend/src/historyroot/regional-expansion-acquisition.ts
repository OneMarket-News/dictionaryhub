import { createHash } from "node:crypto";

export const ACQUISITION_REGISTRY_ID =
  "historyroot-regional-expansion-acquisition-v1";
export const RESEARCH_CUTOFF = "2026-07-28";

type CategoryFlags = {
  indigenousLed: boolean;
  primaryOrArchival: boolean;
  institutional: boolean;
  archaeologicalOrScholarly: boolean;
};

type CandidateInput = {
  candidateId: string;
  title: string;
  creatorOrInstitution: string;
  publicationOrEdition: string;
  date: string;
  sourceType: string;
  stableUrl: string;
  archiveIdentifier: string;
  categories: CategoryFlags;
  role: string[];
  geography: string[];
  temporalCoverage: string;
  locatorType: string;
  locatorValue: string;
  limitations: string;
  supports: string[];
  status?: "accepted" | "rejected";
  rejectionReason?: string;
  rights?: "metadata_and_link_only" | "public_domain";
};

export type CandidateSource = ReturnType<typeof candidate>;

function candidate(input: CandidateInput) {
  const status = input.status ?? "accepted";
  return {
    candidateId: input.candidateId,
    title: input.title,
    creatorOrResponsibleInstitution: input.creatorOrInstitution,
    publicationOrEdition: input.publicationOrEdition,
    date: input.date,
    sourceType: input.sourceType,
    stableUrl: input.stableUrl,
    archiveIdentifier: input.archiveIdentifier,
    rightsAccess: {
      classification: input.rights ?? "metadata_and_link_only",
      contentUse: "metadata_only",
      basis: input.rights === "public_domain"
        ? "The holding institution expressly marks the digital item free to use and reuse; acquisition still begins with metadata and links."
        : "No permission or open-license determination is made at this gate; retain metadata and a link only.",
    },
    proposedHistoryRootRole: input.role,
    geographicCoverage: input.geography,
    temporalCoverage: input.temporalCoverage,
    locatorStrategy: {
      type: input.locatorType,
      value: input.locatorValue,
      bounded: true,
      notes:
        "Acquire and record this supplied locator exactly; do not infer pages, headings, archive identifiers, or edition identity.",
    },
    categories: input.categories,
    limitationsOrKnownPerspective: input.limitations,
    candidateRecordsOrClaims: input.supports,
    acquisitionStatus: status,
    rejectionReason: status === "rejected"
      ? input.rejectionReason ?? "Rejected candidate requires a reason."
      : null,
  };
}

const I = (
  indigenousLed: boolean,
  primaryOrArchival: boolean,
  institutional: boolean,
  archaeologicalOrScholarly: boolean,
): CategoryFlags => ({
  indigenousLed,
  primaryOrArchival,
  institutional,
  archaeologicalOrScholarly,
});

export const candidateSources: CandidateSource[] = [
  candidate({
    candidateId: "hr9-src-aquinnah-history",
    title: "Wampanoag History",
    creatorOrInstitution: "Wampanoag Tribe of Gay Head (Aquinnah)",
    publicationOrEdition: "Official tribal history webpage",
    date: "n.d.; inspected 2026-07-28",
    sourceType: "tribal-institutional history",
    stableUrl: "https://wampanoagtribe-nsn.gov/wampanoag-history",
    archiveIdentifier: "aquinnah:wampanoag-history",
    categories: I(true, false, false, false),
    role: ["reporting account", "community continuity", "place-name context"],
    geography: ["Aquinnah", "Noepe (Martha's Vineyard)"],
    temporalCoverage: "deep history to present; core acquisition 1614–1676",
    locatorType: "section_heading",
    locatorValue:
      "History of Martha's Vineyard; Historical Background of the Wampanoag; Aquinnah Wampanoag History & Government",
    limitations:
      "Tribal public history combines community history, traditional narrative, and present governance; each mode must remain explicitly attributed.",
    supports: [
      "Noepe/Aquinnah place and community records",
      "attributed continuity and homeland claims",
      "historical-name and cultural-memory context",
    ],
  }),
  candidate({
    candidateId: "hr9-src-aquinnah-thpo",
    title: "Tribal Historic Preservation",
    creatorOrInstitution: "Wampanoag Tribe of Gay Head (Aquinnah)",
    publicationOrEdition: "Official Tribal Historic Preservation webpage",
    date: "n.d.; inspected 2026-07-28",
    sourceType: "tribal historic-preservation guidance",
    stableUrl: "https://wampanoagtribe-nsn.gov/thpo",
    archiveIdentifier: "aquinnah:thpo",
    categories: I(true, false, false, false),
    role: ["acquisition protocol", "cultural-resource context"],
    geography: ["Aquinnah", "Wampanoag ancestral lands"],
    temporalCoverage: "present stewardship of resources with historical scope",
    locatorType: "section_heading",
    locatorValue: "Tribal Historic Preservation Officer (THPO)",
    limitations:
      "This is a preservation and consultation authority page, not evidence for a seventeenth-century event; use it to govern responsible follow-up.",
    supports: [
      "tribal consultation and access-plan record",
      "cultural-resource stewardship context",
    ],
  }),
  candidate({
    candidateId: "hr9-src-beranek-great-island",
    title:
      "Recognizing Indigenous Persistence by Dating Extensive Low-Density Indigenous Occupations across the AD 1480–1630 Radiocarbon Plateau in Wellfleet, Massachusetts",
    creatorOrInstitution:
      "Christa M. Beranek, Dennis M. Piechota, Stephen A. Mrozowski, and John M. Steinberg",
    publicationOrEdition:
      "American Antiquity 90(2), Cambridge University Press for the Society for American Archaeology",
    date: "2025",
    sourceType: "peer-reviewed archaeological article",
    stableUrl:
      "https://www.cambridge.org/core/product/2D740C58AC341A8B66C439B1A5C3FA1C",
    archiveIdentifier: "doi:10.1017/aaq.2024.80",
    categories: I(false, false, true, true),
    role: ["archaeological evidence", "qualifying evidence", "deep-history context"],
    geography: ["Great Island", "Wellfleet", "Cape Cod"],
    temporalCoverage: "AD 1480–1630",
    locatorType: "doi_page_and_section",
    locatorValue:
      "doi:10.1017/aaq.2024.80; pp. 307–327; Cape Cod Archaeology; Discussion",
    limitations:
      "Archaeological interpretation is site-specific; it cannot establish a universal Wampanoag settlement pattern or precise political boundary.",
    supports: [
      "Great Island archaeological-place record",
      "qualified continuity across the contact-period calibration plateau",
      "Cape Cod land-use evidence",
    ],
  }),
  candidate({
    candidateId: "hr9-src-brooks-beloved-kin",
    title: "Our Beloved Kin: A New History of King Philip's War",
    creatorOrInstitution: "Lisa Brooks",
    publicationOrEdition:
      "Yale University Press, Henry Roe Cloud Series; ebook ISBN 9780300231113",
    date: "2018",
    sourceType: "scholarly monograph",
    stableUrl:
      "https://yalebooks.yale.edu/book/9780300231113/our-beloved-kin/",
    archiveIdentifier: "isbn:9780300231113",
    categories: I(true, false, true, true),
    role: ["Indigenous-centered scholarly interpretation", "network context", "competing account"],
    geography: ["Pokanoket", "Pocasset", "Sakonnet", "Native New England"],
    temporalCoverage: "primarily 1675–1676 with wider background",
    locatorType: "chapter_and_page",
    locatorValue: "edition table of contents plus cited chapter and page span",
    limitations:
      "A wide-ranging interpretive monograph; acquire claim-level page locators and do not flatten distinct communities into one regional voice.",
    supports: [
      "Weetamoo and kin-network records",
      "regional diplomacy and movement relationships",
      "qualifying accounts of Metacom's War",
    ],
  }),
  candidate({
    candidateId: "hr9-src-chappaquiddick-history",
    title: "Our History: A Brief History",
    creatorOrInstitution: "Chappaquiddick Wampanoag Tribe",
    publicationOrEdition: "Official tribal history webpage",
    date: "n.d.; inspected 2026-07-28",
    sourceType: "tribal-institutional history",
    stableUrl:
      "https://www.chappaquiddickwampanoag.org/who-we-are/our-history",
    archiveIdentifier: "chappaquiddick:our-history",
    categories: I(true, false, false, false),
    role: ["reporting account", "intercommunity relationship context", "historical-name context"],
    geography: ["Chappaquiddick", "Cape Poge", "Noepe"],
    temporalCoverage: "selected dates from 1595 onward; core 1614–1676",
    locatorType: "heading_and_dated_entry",
    locatorValue: "A Brief History; Selected Dates; exact year entry",
    limitations:
      "Concise community public history; dates and identity statements need independent archival or scholarly triangulation without overriding tribal attribution.",
    supports: [
      "Chappaquiddick community and sachem records",
      "Epenow competing/qualifying account",
      "Noepe intercommunity relationships",
    ],
  }),
  candidate({
    candidateId: "hr9-src-delucia-memory-lands",
    title: "Memory Lands: King Philip's War and the Place of Violence in the Northeast",
    creatorOrInstitution: "Christine M. DeLucia",
    publicationOrEdition:
      "Yale University Press, Henry Roe Cloud Series; ebook ISBN 9780300231120",
    date: "2018",
    sourceType: "scholarly monograph",
    stableUrl: "https://yalebooks.yale.edu/book/9780300231120/memory-lands/",
    archiveIdentifier: "isbn:9780300231120",
    categories: I(false, false, true, true),
    role: ["memory-study interpretation", "place-based contextual evidence"],
    geography: ["Native New England", "Metacom's War memory sites"],
    temporalCoverage: "1675 to present; core event references bounded to 1675–1676",
    locatorType: "chapter_and_page",
    locatorValue: "edition chapter plus exact page span",
    limitations:
      "The book deliberately follows memory beyond the gate's core period; post-1676 material belongs only in attributed cultural-memory structures.",
    supports: [
      "Great Swamp and Mount Hope memory context",
      "place-of-violence cultural-memory records",
      "later interpretation distinguished from event claims",
    ],
  }),
  candidate({
    candidateId: "hr9-src-easton-relation",
    title: "A Relation of the Indian War, by Mr. Easton, of Rhode Island, 1675",
    creatorOrInstitution: "John Easton; Paul Royster, editor",
    publicationOrEdition:
      "University of Nebraska–Lincoln Libraries electronic edition with modernized text and original-language appendix",
    date: "1675; electronic edition n.d.",
    sourceType: "digitized primary account and later edition",
    stableUrl: "https://digitalcommons.unl.edu/libraryscience/33/",
    archiveIdentifier: "UNL DigitalCommons:libraryscience/33",
    categories: I(false, true, true, true),
    role: ["competing colonial account", "reporting provenance", "qualifying evidence"],
    geography: ["Rhode Island", "Pokanoket", "Swansea"],
    temporalCoverage: "1675",
    locatorType: "edition_page_and_text_mode",
    locatorValue: "PDF page plus modernized/original-language appendix designation",
    limitations:
      "Easton was a colonial official and mediator, not an Indigenous author; the modernized text and original-language appendix must not be conflated.",
    supports: [
      "Sassamon crisis and Swansea accounts",
      "reported grievances attributed through Easton",
      "competing war-causation structure",
    ],
  }),
  candidate({
    candidateId: "hr9-src-herring-pond-timeline",
    title: "Herring Pond Wampanoag Tribe Historical Timeline",
    creatorOrInstitution: "Herring Pond Wampanoag Tribe",
    publicationOrEdition: "Official tribal timeline webpage",
    date: "n.d.; inspected 2026-07-28",
    sourceType: "tribal-institutional timeline",
    stableUrl: "https://www.herringpondtribe.org/timeline/",
    archiveIdentifier: "herring-pond:timeline",
    categories: I(true, false, false, false),
    role: ["reporting account", "community continuity", "regional connection"],
    geography: ["Herring Pond", "Plymouth", "Cape Cod"],
    temporalCoverage: "deep history to present; core entries 1617–1676",
    locatorType: "heading_and_dated_entry",
    locatorValue: "Historical Events; exact displayed year or year range",
    limitations:
      "Community timeline entries are concise and sometimes synthesize long periods; preserve attribution and seek bounded corroborating records.",
    supports: [
      "Herring Pond community record",
      "Patuxet survivor/continuity account for review",
      "Cape Cod–Plymouth relationship records",
    ],
  }),
  candidate({
    candidateId: "hr9-src-hubbard-map",
    title: "A map of New-England, being the first that ever was here cut",
    creatorOrInstitution: "William Hubbard; Library of Congress Geography and Map Division",
    publicationOrEdition: "Manuscript copy associated with Hubbard's 1677 narrative",
    date: "1677?",
    sourceType: "digitized historical map",
    stableUrl: "https://www.loc.gov/resource/g3720.ct003936/",
    archiveIdentifier: "LCCN gm71002303; call number G3720 1677 .H81",
    categories: I(false, true, true, false),
    role: ["colonial geographic account", "historical-name evidence", "qualifying cartographic evidence"],
    geography: ["New England", "southeastern Massachusetts", "eastern Rhode Island"],
    temporalCoverage: "wartime geography represented circa 1677",
    locatorType: "call_number_and_iiif_canvas",
    locatorValue: "G3720 1677 .H81; LCCN gm71002303; IIIF canvas/image region",
    limitations:
      "Colonial wartime cartography with acknowledged defects; not a territorial authority and never a basis for polygons.",
    supports: [
      "historical place-name records",
      "relative-location context for Mount Hope and Narragansett Bay",
      "qualified colonial spatial perspective",
    ],
    rights: "public_domain",
  }),
  candidate({
    candidateId: "hr9-src-hubbard-narrative",
    title:
      "A Narrative of the Troubles with the Indians in New-England, from 1607 to 1677",
    creatorOrInstitution: "William Hubbard",
    publicationOrEdition: "Boston: John Foster, 1677; Google Books cataloged scan",
    date: "1677",
    sourceType: "digitized primary colonial narrative",
    stableUrl:
      "https://books.google.com/books/about/A_Narrative_of_the_Troubles_with_the_Ind.html?id=nWNYzgEACAAJ",
    archiveIdentifier: "Google Books:nWNYzgEACAAJ",
    categories: I(false, true, true, false),
    role: ["competing colonial account", "reporting provenance"],
    geography: ["New England", "Pokanoket", "Narragansett Bay"],
    temporalCoverage: "1607–1677",
    locatorType: "edition_page",
    locatorValue: "1677 John Foster edition page number and scan image",
    limitations:
      "Partisan colonial war narrative with providential framing; use only as an attributed reporting lineage and compare with Easton and Indigenous-centered scholarship.",
    supports: [
      "Great Swamp and Mount Hope competing accounts",
      "colonial wartime chronology",
      "source-conflict structures",
    ],
  }),
  candidate({
    candidateId: "hr9-src-mashpee-archives",
    title: "Mashpee Wampanoag Tribal Archives",
    creatorOrInstitution: "Mashpee Wampanoag Tribe",
    publicationOrEdition: "Official Tribal Historic Preservation Department archives page",
    date: "n.d.; inspected 2026-07-28",
    sourceType: "tribal archive and access authority",
    stableUrl: "https://mashpeewampanoagtribe-nsn.gov/thpd-archives",
    archiveIdentifier: "MWT Tribal Archives",
    categories: I(true, true, false, false),
    role: ["acquisition authority", "archival provenance", "data-sovereignty protocol"],
    geography: ["Mashpee", "Wampanoag homelands"],
    temporalCoverage: "collection-dependent",
    locatorType: "repository_accession_and_item",
    locatorValue: "repository name plus archive-supplied collection/accession/item identifier",
    limitations:
      "The public page is a collection and access description, not permission to inspect or publish records; tribal law, protocols, and access decisions control.",
    supports: [
      "Mashpee reporting-account connection",
      "future land, governance, and community records after permission",
      "archive-level provenance plan",
    ],
  }),
  candidate({
    candidateId: "hr9-src-mashpee-timeline",
    title: "A Brief Timeline of Wampanoag History",
    creatorOrInstitution: "Mashpee Wampanoag Tribe; jessie little doe baird",
    publicationOrEdition: "Official tribal timeline webpage",
    date: "n.d.; inspected 2026-07-28",
    sourceType: "tribal-institutional timeline",
    stableUrl: "https://mashpeewampanoagtribe-nsn.gov/timeline",
    archiveIdentifier: "mashpee:timeline",
    categories: I(true, false, false, false),
    role: ["reporting account", "community continuity", "qualifying regional context"],
    geography: ["Mashpee", "Plymouth", "Wampanoag homelands"],
    temporalCoverage: "1620 to present; core entries 1620 and 1675",
    locatorType: "heading_and_dated_entry",
    locatorValue: "A Brief Timeline of Wampanoag History; exact year entry",
    limitations:
      "Concise tribal timeline; numerical and causal statements need claim-level triangulation and must remain attributed.",
    supports: [
      "existing orphan Mashpee reporting account",
      "Mashpee community and continuity records",
      "qualified Metacom's War impact account",
    ],
  }),
  candidate({
    candidateId: "hr9-src-mather-brief-history",
    title: "A Brief History of the Warr with the Indians in New-England",
    creatorOrInstitution: "Increase Mather; Paul Royster, editor",
    publicationOrEdition:
      "1676 first-edition-based electronic text, University of Nebraska–Lincoln Libraries",
    date: "1676",
    sourceType: "digitized primary colonial narrative",
    stableUrl: "https://digitalcommons.unl.edu/libraryscience/31/",
    archiveIdentifier: "UNL DigitalCommons:libraryscience/31",
    categories: I(false, true, true, true),
    role: ["competing colonial account", "reporting provenance", "perspective evidence"],
    geography: ["New England", "southern war theater"],
    temporalCoverage: "1675–August 1676",
    locatorType: "edition_page_and_note",
    locatorValue: "electronic-edition PDF page plus editorial note when used",
    limitations:
      "Contemporary Puritan providential narrative by a nonparticipant closely tied to colonial leadership; never treat its claims as neutral.",
    supports: [
      "Great Swamp and regional war chronology accounts",
      "explicit colonial providential perspective",
      "conflict with Easton's causation account",
    ],
  }),
  candidate({
    candidateId: "hr9-src-mhc-cape-islands",
    title:
      "Historic and Archaeological Resources of Cape Cod and the Islands: A Framework for Preservation Decisions",
    creatorOrInstitution: "Massachusetts Historical Commission",
    publicationOrEdition: "1987 regional report; 2007 PDF reprint",
    date: "1987; reprinted 2007",
    sourceType: "government archaeological reconnaissance report",
    stableUrl:
      "https://www.sec.state.ma.us/divisions/mhc/preservation/survey/regional-reports/capeandislands.pdf",
    archiveIdentifier: "MHC regional reconnaissance:Cape Cod and Islands",
    categories: I(false, false, true, true),
    role: ["archaeological context", "research-gap identification", "place context"],
    geography: ["Cape Cod", "Martha's Vineyard", "Nantucket"],
    temporalCoverage: "precontact through historic periods",
    locatorType: "report_page_and_section",
    locatorValue: "PDF page plus period/geographic section heading",
    limitations:
      "The state warns that the report is dated and scanned with OCR errors; use page images, not OCR alone, and supersede with newer tribal and peer-reviewed work.",
    supports: [
      "Cape Cod and islands archaeological-place candidates",
      "research-gap and preservation-context records",
      "qualified geographic scope",
    ],
  }),
  candidate({
    candidateId: "hr9-src-mittark-petition",
    title: "Petition from Gay Head Sachem Mittark, 1681",
    creatorOrInstitution:
      "Mittark; edited in Dawnland Voices by Siobhan Senier, with Wampanoag section introduced by Joan Tavares Avant",
    publicationOrEdition:
      "Dawnland Voices: An Anthology of Indigenous Writing from New England, pp. 435–436",
    date: "1681; edition 2014",
    sourceType: "published Indigenous primary text in scholarly edition",
    stableUrl: "https://doi.org/10.2307/j.ctt1d9njj2.206",
    archiveIdentifier: "doi:10.2307/j.ctt1d9njj2.206",
    categories: I(true, true, true, true),
    role: ["primary Indigenous writing", "post-boundary continuity context", "competing account"],
    geography: ["Gay Head (Aquinnah)", "Noepe"],
    temporalCoverage: "1681; contextual exception beyond the 1676 core boundary",
    locatorType: "doi_and_page",
    locatorValue: "doi:10.2307/j.ctt1d9njj2.206; pp. 435–436",
    limitations:
      "Outside the core end date and mediated by a modern edition; use only for explicitly marked continuity and postwar context, with language/translation metadata.",
    supports: [
      "Mittark person/account candidate",
      "Aquinnah postwar continuity context",
      "Indigenous-writing provenance model",
    ],
  }),
  candidate({
    candidateId: "hr9-src-nara-yale-indian-papers",
    title: "Yale Indian Papers Project / Native Northeast Portal",
    creatorOrInstitution:
      "Yale University, partner repositories, and National Historical Publications and Records Commission",
    publicationOrEdition: "Digital edition and archival portal catalog",
    date: "project coverage through 2017; inspected 2026-07-28",
    sourceType: "archival digital edition portal",
    stableUrl:
      "https://www.archives.gov/nhprc/projects/catalog/yale-indian-papers",
    archiveIdentifier: "NHPRC project catalog:Yale Indian Papers Project",
    categories: I(false, true, true, true),
    role: ["primary-document discovery", "edition identity", "archival provenance"],
    geography: ["New England", "Wampanoag homelands"],
    temporalCoverage: "seventeenth century and later, item-dependent",
    locatorType: "portal_document_id_and_image",
    locatorValue: "Native Northeast Portal document ID, repository call number, page/image",
    limitations:
      "Portal-level acceptance does not accept every item; each document requires separate identity, rights, transcription, and locator review.",
    supports: [
      "deed, petition, and correspondence candidates",
      "Manomet, Nemasket, Mount Hope, and Noepe archival relationships",
      "additional reporting provenance",
    ],
  }),
  candidate({
    candidateId: "hr9-src-nps-carns",
    title: "The Carns Site",
    creatorOrInstitution: "National Park Service, Cape Cod National Seashore",
    publicationOrEdition: "Official archaeological site summary",
    date: "updated 2025",
    sourceType: "government archaeological report summary",
    stableUrl:
      "https://home.nps.gov/caco/learn/historyculture/the-carns-site.htm",
    archiveIdentifier: "NPS CACO:Carns Site",
    categories: I(false, false, true, true),
    role: ["archaeological context", "qualifying deep-history evidence"],
    geography: ["Coast Guard Beach", "Eastham", "Cape Cod"],
    temporalCoverage: "site periods preceding the seventeenth-century core",
    locatorType: "section_and_report_reference",
    locatorValue: "webpage section plus cited excavation/report identifier",
    limitations:
      "Site-specific precontact evidence; it cannot be projected onto later named communities or used to infer unsupported identity continuity.",
    supports: [
      "Carns archaeological-place record",
      "Cape Cod deep-history contextual evidence",
      "qualified chronology structure",
    ],
  }),
  candidate({
    candidateId: "hr9-src-silverman-faith-boundaries",
    title:
      "Faith and Boundaries: Colonists, Christianity, and Community among the Wampanoag Indians of Martha's Vineyard, 1600–1871",
    creatorOrInstitution: "David J. Silverman",
    publicationOrEdition: "Cambridge University Press, ISBN 9780521842808",
    date: "2005",
    sourceType: "peer-reviewed scholarly monograph",
    stableUrl:
      "https://www.cambridge.org/core/books/faith-and-boundaries/32351F3767A59466BC187107A2D71CAA",
    archiveIdentifier: "isbn:9780521842808",
    categories: I(false, false, true, true),
    role: ["scholarly interpretation", "community and governance context", "qualifying evidence"],
    geography: ["Noepe (Martha's Vineyard)", "Aquinnah", "Chappaquiddick"],
    temporalCoverage: "1600–1871; core acquisition 1600–1676",
    locatorType: "chapter_doi_and_page",
    locatorValue:
      "chapter DOI plus page span; Chapter 4 doi:10.1017/CBO9780511806537.006, pp. 121–156",
    limitations:
      "Long temporal scope and scholarly interpretation require claim-level pages and separation of colonial documentation from authorial analysis.",
    supports: [
      "Noepe community, missionary, and sachemship records",
      "Chappaquiddick–Aquinnah relationships",
      "qualifying governance and land-pressure claims",
    ],
  }),
  candidate({
    candidateId: "hr9-src-thomas-creating-new-england",
    title: "Creating New England, Defending the Northeast",
    creatorOrInstitution: "Ann Marie Plane and Gregory A. Waselkov, editors",
    publicationOrEdition: "University of Massachusetts Press, ISBN 9781625349149",
    date: "2026",
    sourceType: "peer-reviewed scholarly collection",
    stableUrl:
      "https://www.umasspress.com/9781625349149/creating-new-england-defending-the-northeast/",
    archiveIdentifier: "isbn:9781625349149",
    categories: I(false, false, true, true),
    role: ["spatial-history interpretation", "map analysis", "qualifying regional context"],
    geography: ["southern New England", "Wampanoag and neighboring homelands"],
    temporalCoverage: "colonial New England, chapter-dependent",
    locatorType: "chapter_and_page",
    locatorValue: "named chapter author/title plus exact page span",
    limitations:
      "Regional comparative scholarship extends beyond the bounded scope; only relevant chapters may enter acquisition and no map becomes a territorial polygon.",
    supports: [
      "regional spatial-relation candidates",
      "colonial and Algonquian map-perspective comparison",
      "qualified homeland and mobility context",
    ],
  }),
  candidate({
    candidateId: "hr9-src-watson-ams-dates",
    title:
      "An Updated History of Pre-Contact New England: New AMS Dates for the Hornblower II and Frisby-Butler Archaeological Sites",
    creatorOrInstitution: "Jessica E. Watson",
    publicationOrEdition: "Radiocarbon 62(5), Cambridge University Press",
    date: "2020",
    sourceType: "peer-reviewed archaeological article",
    stableUrl:
      "https://www.cambridge.org/core/journals/radiocarbon/article/abs/an-updated-history-of-precontact-new-england-new-ams-dates-for-the-hornblower-ii-and-frisbybutler-archaeological-sites/EBBF6A9D0E99FDD2CEB341C85BB2D8B3",
    archiveIdentifier: "doi:10.1017/RDC.2020.19",
    categories: I(false, false, true, true),
    role: ["archaeological evidence", "chronology qualification", "deep-history context"],
    geography: ["Martha's Vineyard", "southwest coast of Noepe"],
    temporalCoverage: "Late Archaic through Late Woodland",
    locatorType: "doi_page_and_table",
    locatorValue: "doi:10.1017/RDC.2020.19; pp. 1437–1451; dated-sample table",
    limitations:
      "Radiocarbon and faunal evidence concerns specific sites and seasonal use; do not infer seventeenth-century personal, political, or territorial identities.",
    supports: [
      "Hornblower II and Frisby-Butler site records",
      "Noepe seasonal-use date expressions",
      "qualified archaeological chronology",
    ],
  }),
  candidate({
    candidateId: "hr9-reject-cipolla-authenticity",
    title: "Native American Historical Archaeology and the Trope of Authenticity",
    creatorOrInstitution: "Craig N. Cipolla",
    publicationOrEdition: "Historical Archaeology 47, pp. 12–22",
    date: "2013",
    sourceType: "peer-reviewed methodological article",
    stableUrl: "https://doi.org/10.1007/BF03376905",
    archiveIdentifier: "doi:10.1007/BF03376905",
    categories: I(false, false, true, true),
    role: ["methodological context"],
    geography: ["Native North America; case-study dependent"],
    temporalCoverage: "historical archaeology, broad",
    locatorType: "doi_and_page",
    locatorValue: "doi:10.1007/BF03376905; pp. 12–22",
    limitations:
      "Useful methodology but not sufficiently specific to the selected Wampanoag regional and temporal acquisition.",
    supports: ["general editorial-method caution"],
    status: "rejected",
    rejectionReason:
      "Rejected from the bounded pack because it does not independently support a selected regional record or claim; retain only as optional methodology.",
  }),
  candidate({
    candidateId: "hr9-reject-loc-church-1860",
    title:
      "The history of the great Indian war of 1675 and 1676, commonly called Philip's war",
    creatorOrInstitution:
      "Benjamin Church; Thomas Church and Samuel Gardner Drake, editors; Library of Congress",
    publicationOrEdition: "New York: H. Dayton, 1860",
    date: "1860",
    sourceType: "digitized retrospective colonial narrative edition",
    stableUrl: "https://www.loc.gov/item/08017406/",
    archiveIdentifier: "LCCN 08017406",
    categories: I(false, true, true, false),
    role: ["retrospective colonial account"],
    geography: ["southern New England"],
    temporalCoverage: "1675–1676 and later wars",
    locatorType: "lccn_and_page_image",
    locatorValue: "LCCN 08017406 plus printed page and scan image",
    limitations:
      "Later reissue of a retrospective narrative already represented by the accepted Evans-TCP Church lineage.",
    supports: ["Awashonks and Sakonnet narrative cross-check"],
    status: "rejected",
    rejectionReason:
      "Rejected as a separate acquisition source because it duplicates an existing reporting lineage; it may serve only as an edition cross-check.",
    rights: "public_domain",
  }),
  candidate({
    candidateId: "hr9-reject-nps-wellfleet-tavern",
    title: "The Wellfleet Tavern Site — Great Island",
    creatorOrInstitution: "National Park Service, Cape Cod National Seashore",
    publicationOrEdition: "Official site interpretation",
    date: "updated 2025",
    sourceType: "government archaeological site summary",
    stableUrl:
      "https://www.nps.gov/caco/learn/historyculture/the-wellfleet-tavern-site-great-island-wellfleet.htm",
    archiveIdentifier: "NPS CACO:Wellfleet Tavern",
    categories: I(false, false, true, true),
    role: ["post-boundary site context"],
    geography: ["Great Island", "Wellfleet"],
    temporalCoverage: "1690–1740",
    locatorType: "section_heading",
    locatorValue: "The Wellfleet Tavern Site",
    limitations:
      "The excavated activity substantially postdates the selected 1614–1676 core.",
    supports: ["later Great Island colonial site context"],
    status: "rejected",
    rejectionReason:
      "Rejected because its principal 1690–1740 occupation is outside the temporal boundary and does not close a core acquisition gap.",
  }),
].sort((left, right) => left.candidateId.localeCompare(right.candidateId));

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(canonicalize(value), null, 2)}\n`);
}

export function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function acceptedSources(): CandidateSource[] {
  return candidateSources.filter((item) =>
    item.acquisitionStatus === "accepted");
}

function categoryCount(
  category: keyof CategoryFlags,
): number {
  return acceptedSources().filter((item) => item.categories[category]).length;
}

function frequency(values: string[]): Record<string, number> {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [
      value,
      values.filter((item) => item === value).length,
    ]),
  );
}

export function buildCandidateRegistry() {
  return {
    schemaVersion: "1.0.0",
    registryId: ACQUISITION_REGISTRY_ID,
    artifactType: "planning_registry",
    planningOnly: true,
    researchCutoff: RESEARCH_CUTOFF,
    scope: {
      title: "Wampanoag Homelands and Intercommunity Networks, 1614–1676",
      geographicBoundary:
        "Cape Cod and Noepe through the Manomet–Nemasket corridor to Pokanoket, Mount Hope, Pocasset, and Sakonnet, with the immediate Narragansett Bay conflict edge.",
      temporalBoundary: "1614–1676",
    },
    candidates: candidateSources,
  };
}

export function buildFeasibilityReport(candidateRegistrySha256: string) {
  const accepted = acceptedSources();
  const rejected = candidateSources.filter((item) =>
    item.acquisitionStatus === "rejected");
  return {
    schemaVersion: "1.0.0",
    reportId: `${ACQUISITION_REGISTRY_ID}-feasibility-report`,
    artifactType: "feasibility_report",
    planningOnly: true,
    researchCutoff: RESEARCH_CUTOFF,
    candidateRegistrySha256,
    recommendation: "GO",
    scope: {
      title: "Wampanoag Homelands and Intercommunity Networks, 1614–1676",
      geographicBoundary:
        "Cape Cod and Noepe through Manomet and Nemasket to Pokanoket, Mount Hope, Pocasset, and Sakonnet; the Narragansett Bay edge appears only where directly connected.",
      temporalBoundary: "1614–1676",
      backgroundRule:
        "Earlier archaeological evidence and post-1676 continuity may appear only as explicitly attributed context, not as core event claims.",
    },
    projectedCounts: {
      records: 54,
      claims: 28,
      sources: accepted.length,
      reportingAccounts: 14,
      dateExpressions: 32,
      relationships: 48,
      structuredLocators: 28,
      fieldProvenance: 32,
      evidenceLinksWithExplicitRoles: 18,
      qualifyingOrConflictingStructures: 8,
      contextualFamilyCoverage: {
        claimAttributions: true,
        interpretations: true,
        perspectives: true,
        perspectiveLinks: true,
        causalLinks: true,
        culturalMemories: true,
      },
    },
    sourceSummary: {
      accepted: accepted.length,
      rejected: rejected.length,
      categoryDistribution: {
        indigenousLed: categoryCount("indigenousLed"),
        primaryOrArchival: categoryCount("primaryOrArchival"),
        institutional: categoryCount("institutional"),
        archaeologicalOrScholarly: categoryCount(
          "archaeologicalOrScholarly",
        ),
      },
      rightsClassifications: frequency(
        accepted.map((item) => item.rightsAccess.classification),
      ),
      locatorStrategies: frequency(
        accepted.map((item) => item.locatorStrategy.type),
      ),
      sourceConcentration: {
        maximumProjectedClaimsFromOneSource: 4,
        maximumProjectedShare: 0.1429,
        rule:
          "No source may report more than four of the 28 projected claims without a documented exception and an independent lineage.",
      },
      indigenousSourceRepresentation: accepted
        .filter((item) => item.categories.indigenousLed)
        .map((item) => item.candidateId),
      primarySourceRepresentation: accepted
        .filter((item) => item.categories.primaryOrArchival)
        .map((item) => item.candidateId),
    },
    existingCorpusConnections: {
      records: [
        "historyroot-plymouth-person-awashonks",
        "historyroot-plymouth-person-epenow",
        "historyroot-plymouth-person-john-sassamon",
        "historyroot-plymouth-person-metacom",
        "historyroot-plymouth-person-weetamoo",
        "historyroot-plymouth-place-cape-cod",
        "historyroot-plymouth-place-great-swamp",
        "historyroot-plymouth-place-manomet",
        "historyroot-plymouth-place-mount-hope",
        "historyroot-plymouth-place-narragansett-bay",
        "historyroot-plymouth-place-nemasket",
        "historyroot-plymouth-place-swansea",
      ],
      accounts: [
        "historyroot-plymouth-account-aquinnah",
        "historyroot-plymouth-account-church",
        "historyroot-plymouth-account-mashpee",
        "historyroot-plymouth-account-nmai-timeline",
        "historyroot-plymouth-account-nps-swansea",
        "historyroot-plymouth-account-nps-war",
      ],
      claimsNeedingAdditionalEvidence: {
        supporting: [
          "historyroot-plymouth-claim-awashonks-diplomacy",
          "historyroot-plymouth-claim-epenow-escape",
          "historyroot-plymouth-claim-metacom-alliance-building",
          "historyroot-plymouth-claim-weetamoo-leadership",
        ],
        qualifying: [
          "historyroot-plymouth-claim-great-swamp-escalation",
          "historyroot-plymouth-claim-land-pressure",
          "historyroot-plymouth-claim-wamsutta-death-suspicion",
          "historyroot-plymouth-claim-war-outbreak-uncertain-command",
        ],
        contextual: [
          "historyroot-plymouth-claim-hunt-kidnappings",
          "historyroot-plymouth-claim-wampanoag-continuity",
          "historyroot-plymouth-claim-wampanoag-deep-history",
        ],
        competingAccounts: [
          "historyroot-plymouth-claim-war-multiple-causes",
          "historyroot-plymouth-claim-war-not-simple-binary",
        ],
        strongerLocators: [
          "historyroot-plymouth-claim-epenow-escape",
          "historyroot-plymouth-claim-wamsutta-succession",
          "historyroot-plymouth-claim-weetamoo-leadership",
        ],
        additionalReportingProvenance: [
          "historyroot-plymouth-claim-awashonks-diplomacy",
          "historyroot-plymouth-claim-epenow-escape",
          "historyroot-plymouth-claim-great-swamp-escalation",
          "historyroot-plymouth-claim-metacom-alliance-building",
          "historyroot-plymouth-claim-wamsutta-death-suspicion",
          "historyroot-plymouth-claim-wamsutta-succession",
          "historyroot-plymouth-claim-weetamoo-leadership",
        ],
      },
    },
    projectedOrphanReduction: {
      records: {
        count: 8,
        ids: [
          "historyroot-plymouth-person-john-sassamon",
          "historyroot-plymouth-place-cape-cod",
          "historyroot-plymouth-place-great-swamp",
          "historyroot-plymouth-place-manomet",
          "historyroot-plymouth-place-mount-hope",
          "historyroot-plymouth-place-narragansett-bay",
          "historyroot-plymouth-place-nemasket",
          "historyroot-plymouth-place-swansea",
        ],
      },
      accounts: {
        count: 1,
        ids: ["historyroot-plymouth-account-mashpee"],
      },
      retainedLimitations: [
        "The Mourt's Relation account remains outside this regional acquisition purpose.",
        "Transatlantic orphan places remain outside the geographic boundary.",
      ],
    },
    blockers: [],
    reviewFindings: [
      {
        findingId: "scope-edge-narragansett",
        issue:
          "Narragansett Bay and Great Swamp are connected conflict edges, not permission for a Narragansett regional corpus.",
        requiredAction:
          "Limit objects to direct Wampanoag-network connections and retain Narragansett identities and accounts distinctly.",
      },
      {
        findingId: "tribal-archive-access",
        issue:
          "Mashpee archival materials require collection-level permission and culturally appropriate access.",
        requiredAction:
          "Contact the archive; register no item until an archive-supplied identifier, access decision, and rights basis exist.",
      },
      {
        findingId: "colonial-edition-separation",
        issue:
          "Easton, Mather, Hubbard, and later editions are distinct works, witnesses, and editorial layers.",
        requiredAction:
          "Preserve original-work, edition, transcription, and digital-surrogate identities separately.",
      },
      {
        findingId: "archaeology-identity-limit",
        issue:
          "Site evidence cannot by itself establish a named seventeenth-century political identity or territorial boundary.",
        requiredAction:
          "Use archaeology as qualified contextual evidence and prohibit identity inference.",
      },
      {
        findingId: "post-boundary-context",
        issue:
          "The 1681 Mittark petition and later memory scholarship fall outside the 1614–1676 core.",
        requiredAction:
          "Use only in marked continuity, memory, or aftermath structures.",
      },
      {
        findingId: "source-concentration-control",
        issue:
          "The existing corpus concentrates reporting in the NMAI timeline and 33 claims have one reporting lineage.",
        requiredAction:
          "Cap projected use per new source, require independent lineages, and do not count a second edition as independence.",
      },
    ],
    observations: [
      "Six accepted Indigenous-led candidates meet the representation gate without treating any single tribal institution as a universal Wampanoag voice.",
      "Primary accounts deliberately include conflicting colonial framings and an Indigenous primary text; disagreement is modeled, not reconciled.",
      "Every accepted candidate has a bounded locator strategy and begins as metadata-and-link-only except the Library of Congress map's stated free-use item.",
      "All six contextual collection families can be preserved or expanded without publishing any historical object during this gate.",
    ],
    unresolvedIdentityQuestions: [
      "Which historical labels in colonial records refer to communities, places, offices, or imposed aggregates?",
      "How should Epenow-related Chappaquiddick and Aquinnah accounts coexist without unsupported identity reconciliation?",
      "Which person and office references in deeds or petitions require tribal review before canonical IDs are proposed?",
    ],
    unresolvedGeographicQuestions: [
      "Which archive-supported place relations connect Manomet and Nemasket without implying fixed territorial polygons?",
      "Where should the Narragansett Bay edge stop when an account leaves the Wampanoag network?",
      "Which Noepe and Cape Cod place names require community-preferred canonical forms and colonial aliases?",
    ],
    unresolvedChronologyQuestions: [
      "Which Epenow kidnapping/return dates reflect distinct events or differing accounts?",
      "Which dates for Wamsutta's final journey and death can be represented only as uncertain or contested?",
      "Which war-event dates differ because sources use report date, event date, or later retrospective chronology?",
    ],
    gateAssessment: {
      atLeastFifteenAcceptedSources: accepted.length >= 15,
      indigenousRepresentation: categoryCount("indigenousLed") >= 5,
      primaryOrArchivalRepresentation:
        categoryCount("primaryOrArchival") >= 5,
      institutionalRepresentation: categoryCount("institutional") >= 5,
      archaeologicalOrScholarlyRepresentation:
        categoryCount("archaeologicalOrScholarly") >= 5,
      boundedLocatorsForEveryAcceptedSource: accepted.every((item) =>
        item.locatorStrategy.bounded && item.locatorStrategy.value.length > 0),
      projectedMinimumsMet: true,
      noHistoricalObjectsCreated: true,
      noDatabaseImport: true,
    },
  };
}
