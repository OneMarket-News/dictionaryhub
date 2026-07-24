import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DISCLAIMER =
  "A machine-assisted pilot dataset awaiting further historical, editorial, and tribal review.";
const BUNDLE_ID = "historyroot-plymouth-knowledge-dataset-v1";
const DOMAIN = "HistoryRoot";
const REVIEW_DATE = "2026-07-23";

const currentFile = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(currentFile), "../../..");
const outputDirectory = path.join(
  repositoryRoot,
  "data",
  "historyroot",
  "plymouth-v1",
);

const sourceIds = {
  mourts: "historyroot-plymouth-source-mourts-relation-loc",
  bradford: "historyroot-plymouth-source-bradford-eada",
  goodNewes: "historyroot-plymouth-source-good-newes-gutenberg",
  charter: "historyroot-plymouth-source-charter-1691-avalon",
  bradfordManuscript:
    "historyroot-plymouth-source-bradford-manuscript-massachusetts",
  compactExhibit: "historyroot-plymouth-source-compact-loc-exhibit",
  compactLaw: "historyroot-plymouth-source-compact-loc-law-blog",
  nmaiTimeline: "historyroot-plymouth-source-nmai-timeline",
  nmaiTreaty: "historyroot-plymouth-source-nmai-treaty-harvest",
  mashpeeCulture: "historyroot-plymouth-source-mashpee-culture",
  aquinnahAncient: "historyroot-plymouth-source-aquinnah-ancient-ways",
  uaine: "historyroot-plymouth-source-uaine-national-day-mourning",
  cdcEpidemic: "historyroot-plymouth-source-cdc-epidemic-study",
  npsWar: "historyroot-plymouth-source-nps-king-philips-war",
  npsSwansea: "historyroot-plymouth-source-nps-swansea-war-start",
  church: "historyroot-plymouth-source-church-war-narrative",
  pilgrimHallRock: "historyroot-plymouth-source-pilgrim-hall-rock",
  plimothThanksgiving:
    "historyroot-plymouth-source-plimoth-thanksgiving-unit",
  massArchives: "historyroot-plymouth-source-massachusetts-archives-overview",
  plymouthRecords:
    "historyroot-plymouth-source-massachusetts-plymouth-records",
} as const;

type SourceOptions = {
  id: string;
  name: string;
  type: string;
  publisher: string;
  sourceClass: string;
  url: string;
  citation: string;
  accessStatus:
    | "accessed-and-inspected"
    | "metadata-verified-not-inspected"
    | "bibliographic-only"
    | "inaccessible"
    | "rejected";
  locatorsInspected: string[];
  limitations: string;
  license: string;
  licenseStatus: string;
  credibilityTier?: string;
  verificationStatus?: string;
  notes?: string;
};

function source(options: SourceOptions) {
  return {
    id: options.id,
    name: options.name,
    type: options.type,
    domain: DOMAIN,
    publisher: options.publisher,
    qualityTier: "curated-pilot",
    credibilityTier: options.credibilityTier ?? "high",
    verificationStatus: options.verificationStatus ?? "source-backed",
    sourceClass: options.sourceClass,
    license: options.license,
    licenseStatus: options.licenseStatus,
    reviewStatus: "needs-review",
    lastReviewed: REVIEW_DATE,
    url: options.url,
    citation: options.citation,
    accessStatus: options.accessStatus,
    accessDate: REVIEW_DATE,
    locatorsInspected: options.locatorsInspected,
    limitations: options.limitations,
    supportsDetailedClaims:
      options.accessStatus === "accessed-and-inspected",
    notes:
      options.notes
      ?? `${DISCLAIMER} Access and limitations are recorded in the source register.`,
  };
}

const sources = [
  source({
    id: sourceIds.mourts,
    name: "Mourt's Relation or Journal of the Plantation at Plymouth",
    type: "digitized-primary-source-edition",
    publisher: "Library of Congress",
    sourceClass: "primary-account-later-edition",
    url: "https://www.loc.gov/item/03008746/",
    citation:
      "William Bradford and Edward Winslow, Mourt's Relation, 1622; Henry Martyn Dexter ed., Boston: J. K. Wiggin, 1865, Library of Congress LCCN 03008746.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Library of Congress item metadata and rights statement",
      "1865 edition, pp. 5-6 (Mayflower Compact introduction and text)",
      "1621 harvest account as reproduced in the edition",
    ],
    limitations:
      "English colonial account published partly to report and promote the plantation; the inspected object is an 1865 edition of the 1622 printing, not the lost manuscripts behind it.",
    license: "Public domain digitized book",
    licenseStatus: "public-domain",
  }),
  source({
    id: sourceIds.bradford,
    name: "Of Plymouth Plantation, electronic edition",
    type: "scholarly-electronic-primary-source-edition",
    publisher: "Early Americas Digital Archive, University of Maryland",
    sourceClass: "primary-retrospective-account",
    url: "https://eada.lib.umd.edu/text-entries/of-plymouth-plantation/",
    citation:
      "William Bradford, Of Plymouth Plantation, electronic edition based on William T. Davis ed., Bradford's History of Plymouth Plantation, 1606-1646 (1908).",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "EADA lines 2345-2386 (Compact, government, first winter)",
      "EADA lines 2436-2481 (Samoset, Ousamequin agreement, Tisquantum)",
      "EADA lines 3355-3379 and 3382-3399 (Tisquantum death and Wessagusset)",
      "EADA lines 4217-4239 (John Robinson's criticism)",
      "EADA lines 5381-5389 (Merrymount)",
    ],
    limitations:
      "Retrospective English colonial narrative written over years, with providential interpretation and hostile period terminology; it does not supply an Indigenous account.",
    license:
      "Freely available electronic text when distributed with archive header information",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.goodNewes,
    name: "Good Newes from New England",
    type: "digitized-primary-source-edition",
    publisher: "Project Gutenberg",
    sourceClass: "primary-contemporary-account-later-edition",
    url: "https://www.gutenberg.org/ebooks/66332",
    citation:
      "Edward Winslow, Good Newes from New England (London, 1624), 1841 edition digitized by Project Gutenberg.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "1841 edition, pp. 13-26 (Tisquantum, Ousamequin, diplomacy)",
      "1841 edition, pp. 41-52 (Wessagusset crisis and killings)",
    ],
    limitations:
      "English colonial and promotional narrative; later editorial notes and modernization must be distinguished from Winslow's 1624 text.",
    license: "Public domain ebook",
    licenseStatus: "public-domain",
  }),
  source({
    id: sourceIds.charter,
    name: "Charter of Massachusetts Bay, October 7, 1691",
    type: "legal-document-transcription",
    publisher: "Avalon Project, Yale Law School",
    sourceClass: "primary-legal-document",
    url: "https://avalon.law.yale.edu/17th_century/mass07.asp",
    citation:
      "William III and Mary II, Charter of Massachusetts Bay, October 7, 1691, Avalon Project transcription.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Document title and date",
      "Territorial grant incorporating New Plymouth into the Province",
    ],
    limitations:
      "Modern transcription of a royal legal instrument; issuance and later inauguration are distinct events and require institutional chronology.",
    license: "Yale Avalon educational transcription; link and paraphrase",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.bradfordManuscript,
    name: "Bradford's manuscript Of Plimoth Plantation, 1630-1650",
    type: "archival-manuscript-metadata",
    publisher: "State Library of Massachusetts",
    sourceClass: "primary-manuscript-metadata",
    url: "https://www.mass.gov/info-details/bradfords-manuscript-of-plimoth-plantation",
    citation:
      "William Bradford, Of Plimoth Plantation manuscript, 1630-1650, State Library of Massachusetts digital collections.",
    accessStatus: "metadata-verified-not-inspected",
    locatorsInspected: [
      "State Library catalog/search metadata for manuscript title, author, and date range",
    ],
    limitations:
      "The manuscript object was not directly inspected during this build because the page denied automated access; it supports document identity only, not detailed historical claims.",
    license: "Archival metadata; rights vary by digital object",
    licenseStatus: "metadata-only",
    verificationStatus: "needs-review",
  }),
  source({
    id: sourceIds.compactExhibit,
    name: "The Mayflower Compact: A Toolkit for Associations",
    type: "institutional-exhibit",
    publisher: "Library of Congress",
    sourceClass: "government-institutional-synthesis",
    url: "https://www.loc.gov/exhibitions/join-in-voluntary-associations-in-america/about-this-exhibition/a-toolkit-for-associations/the-mayflower-compact/",
    citation: "Library of Congress, The Mayflower Compact, Join In exhibition.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Exhibit section The Mayflower Compact, paragraphs on patent, civil body politic, and lost original",
    ],
    limitations:
      "Concise exhibit interpretation intended for a broad audience; it should be paired with the surviving textual witnesses.",
    license: "U.S. government institutional webpage; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.compactLaw,
    name: "The 400th Anniversary of the Mayflower Compact",
    type: "government-library-scholarly-blog",
    publisher: "Law Library of Congress",
    sourceClass: "government-institutional-analysis",
    url: "https://blogs.loc.gov/law/2020/11/the-400th-anniversary-of-the-mayflower-compact/",
    citation:
      "Robert Brammer, The 400th Anniversary of the Mayflower Compact, In Custodia Legis, Library of Congress, 2020.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Paragraphs 284-299 (patent context, immediate function, textual witnesses, later memory)",
    ],
    limitations:
      "Modern legal-historical interpretation on an institutional blog; cited secondary scholarship was not independently inspected for this pilot.",
    license: "U.S. government institutional webpage; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.nmaiTimeline,
    name: "The First Thanksgiving: Wampanoag and English Perspectives timeline",
    type: "indigenous-centered-museum-education",
    publisher: "Smithsonian National Museum of the American Indian",
    sourceClass: "indigenous-centered-institutional-synthesis",
    url: "https://americanindian.si.edu/nk360/thanksgiving/timeline.html",
    citation:
      "Native Knowledge 360°, The First Thanksgiving: Wampanoag and English Perspectives, Timeline, Smithsonian NMAI.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Timeline sections 1524-1615 through 1675-1676",
      "Timeline section 1900-present",
    ],
    limitations:
      "Educational synthesis, not a primary source; its broad chronology compresses local variation and historiographic disagreement.",
    license: "Smithsonian terms of use; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.nmaiTreaty,
    name: "Treaty and Harvest Celebration",
    type: "indigenous-centered-museum-education",
    publisher: "Smithsonian National Museum of the American Indian",
    sourceClass: "indigenous-centered-institutional-analysis",
    url: "https://americanindian.si.edu/nk360/Thanksgiving/sq4ss1.html",
    citation:
      "Native Knowledge 360°, Treaty and Harvest Celebration, Smithsonian NMAI.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Treaty terms and discussion questions",
      "Sections on weapons, punishment, diplomacy, and harvest",
    ],
    limitations:
      "Educational interpretation that paraphrases primary accounts; it foregrounds asymmetry but is not a substitute for community review.",
    license: "Smithsonian terms of use; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.mashpeeCulture,
    name: "History and Culture of the Mashpee Wampanoag",
    type: "tribal-institutional-history",
    publisher: "Mashpee Wampanoag Tribe",
    sourceClass: "tribal-institutional-perspective",
    url: "https://mashpeewampanoagtribe-nsn.gov/culture",
    citation:
      "jessie little doe baird, History and Culture of the Mashpee Wampanoag, Mashpee Wampanoag Tribe.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Contact timeline entries for 1616, 1620, 1632, and 1655",
    ],
    limitations:
      "A concise tribal public-history timeline; numerical and diagnostic epidemic claims require specialist review and are not treated as settled in this dataset.",
    license: "Tribal website; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.aquinnahAncient,
    name: "Ancient Ways",
    type: "tribal-institutional-history",
    publisher: "Wampanoag Tribe of Gay Head (Aquinnah)",
    sourceClass: "tribal-institutional-perspective",
    url: "https://wampanoagtribe-nsn.gov/ancientways",
    citation: "Wampanoag Tribe of Gay Head (Aquinnah), Ancient Ways.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Epenow account",
      "Creation of Noepe and Wampanoag cultural-practice sections",
    ],
    limitations:
      "Tribal public-history and cultural page combining historical narrative, oral tradition, and present-day practice; each mode must retain its own attribution.",
    license: "Tribal website; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.uaine,
    name: "National Day of Mourning and Historical Information",
    type: "indigenous-activist-institutional-history",
    publisher: "United American Indians of New England",
    sourceClass: "indigenous-organizational-perspective",
    url: "https://www.uaine.org/",
    citation:
      "United American Indians of New England, National Day of Mourning homepage and Historical Information.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "National Day of Mourning homepage introduction",
      "Historical Information, 1970 origins and Wamsutta Frank James",
    ],
    limitations:
      "Explicitly activist and commemorative organizational perspective; use for attributed memory and critique, not as an unattributed universal Indigenous view.",
    license: "Organizational website; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.cdcEpidemic,
    name: "New Hypothesis for Cause of Epidemic among Native Americans, New England, 1616-1619",
    type: "peer-reviewed-medical-history-article",
    publisher: "CDC Emerging Infectious Diseases",
    sourceClass: "modern-scholarly-analysis",
    url: "https://wwwnc.cdc.gov/eid/article/16/2/09-0276_article",
    citation:
      "John S. Marr and John T. Cathey, Emerging Infectious Diseases 16, no. 2 (2010): 281-286, doi:10.3201/eid1602.090276.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "pp. 281-286; especially limitations and competing disease hypotheses",
    ],
    limitations:
      "Retrospective diagnostic hypothesis based on sparse descriptions; the authors explicitly state that the cause may never be proven.",
    license: "U.S. government journal webpage; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.npsWar,
    name: "King Philip's War (1675-1678)",
    type: "government-public-history",
    publisher: "National Park Service, Roger Williams National Memorial",
    sourceClass: "government-institutional-synthesis",
    url: "https://www.nps.gov/rowi/learn/historyculture/kingphilip.htm",
    citation:
      "National Park Service, Roger Williams National Memorial, King Philip's War (1675-1678).",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Overview paragraphs on land purchases, refugees, neutrality, Great Swamp, and Narragansett entry",
    ],
    limitations:
      "Concise site interpretation with some rounded casualty estimates; this pilot uses it for broad sequence and qualified causal framing.",
    license: "U.S. government webpage; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.npsSwansea,
    name: "The Unexpected Start to Metacom's War",
    type: "government-public-history-archeology",
    publisher: "National Park Service, American Battlefield Protection Program",
    sourceClass: "government-institutional-synthesis",
    url: "https://www.nps.gov/articles/000/the-unexpected-start-to-metacom-s-war-investigating-the-archeological-remains-of-swansea-at-nockum-hill.htm",
    citation:
      "National Park Service, The Unexpected Start to Metacom's War: Investigating the Archeological Remains of Swansea at Nockum Hill.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Article paragraphs on the executions, Swansea attack, and uncertainty over Metacom's authorization",
    ],
    limitations:
      "Short project description rather than a full historiographic study; the archaeological project was prospective when described.",
    license: "U.S. government webpage; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.church,
    name: "Entertaining Passages Relating to Philip's War",
    type: "digitized-primary-source-edition",
    publisher: "University of Michigan Library Digital Collections",
    sourceClass: "primary-retrospective-war-narrative",
    url: "https://quod.lib.umich.edu/e/evans/N01515.0001.001/1:3?rgn=div1;view=fulltext",
    citation:
      "Benjamin Church, Entertaining Passages Relating to Philip's War (Boston: B. Green, 1716), Evans-TCP digital edition.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "1716 edition, pp. 22-28 (Awashonks/Sakonnet negotiations)",
      "Catalog metadata and rights statement",
    ],
    limitations:
      "Retrospective English military narrative published in 1716; dialogue and motives are mediated through Church and later publication.",
    license: "TCP text CC0 1.0; image rights may differ",
    licenseStatus: "cc0-text",
  }),
  source({
    id: sourceIds.pilgrimHallRock,
    name: "History of Plymouth Rock",
    type: "museum-historical-analysis",
    publisher: "Pilgrim Hall Museum",
    sourceClass: "museum-memory-study",
    url: "https://www.pilgrimhall.org/history-of-plymouth-rock/",
    citation: "Pilgrim Hall Museum, History of Plymouth Rock.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Sections Plymouth Rock in the 17th Century and Landing Place of the Pilgrims?",
      "Sections on the 1741 oral tradition and Revolutionary memory",
    ],
    limitations:
      "Museum interpretation of layered evidence and oral tradition; it expressly notes that the landing claim cannot be definitively resolved.",
    license: "Museum website; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.plimothThanksgiving,
    name: "You Are The Historian, Unit 4: Plymouth and America's Holiday",
    type: "museum-curriculum-and-historical-analysis",
    publisher: "Plimoth Patuxet Museums",
    sourceClass: "museum-multiperspectival-synthesis",
    url: "https://plimoth.org/yath/unit-4",
    citation:
      "Plimoth Patuxet Museums, You Are The Historian, Unit 4: Plymouth and America's Holiday.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Unit 4 key ideas on the single English eyewitness account, absent contemporary Wampanoag record, gratitude, and diplomacy",
    ],
    limitations:
      "Public-history curriculum; statements about missing evidence are valuable, but reconstructions and educational prompts are not primary testimony.",
    license: "Museum educational website; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.massArchives,
    name: "Massachusetts Archives Collection Overview",
    type: "government-archival-guide",
    publisher: "Massachusetts Archives",
    sourceClass: "government-archival-synthesis",
    url: "https://www.sec.state.ma.us/divisions/archives/collections/mass-archives-collection.htm",
    citation: "Massachusetts Archives, Massachusetts Archives Collection Overview.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Inter-charter period, lines 246-276",
      "Provincial period, lines 277-284",
    ],
    limitations:
      "Archival overview rather than a monograph; useful for institutional chronology and holdings, not for reconstructing all local consequences.",
    license: "Massachusetts government webpage; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
  source({
    id: sourceIds.plymouthRecords,
    name: "Transcripts of the Records of New Plymouth Colony, 1620-1691",
    type: "government-archival-register",
    publisher: "Massachusetts Archives",
    sourceClass: "primary-records-series-register",
    url: "https://www.sec.state.ma.us/divisions/archives/collections/plymouth-records.htm",
    citation:
      "Massachusetts Archives, Transcripts of the Records of New Plymouth Colony, 1620-1691; Shurtleff and Pulsifer eds., 12 vols.",
    accessStatus: "accessed-and-inspected",
    locatorsInspected: [
      "Collection description and volume list, including Court Orders, Judicial Acts, Laws, and Deeds",
    ],
    limitations:
      "The collection register and volume metadata were inspected, not every record in the twelve-volume series; detailed record claims require volume-and-page review.",
    license: "Massachusetts government archival guide; linked and paraphrased",
    licenseStatus: "repository-link-and-paraphrase",
  }),
];

const status = "pilot-review-required";

function entity(
  id: string,
  entityType: string,
  name: string,
  alternateNames: string[],
  description: string,
  recordSourceIds: string[],
  metadata: Record<string, unknown> = {},
) {
  return {
    id,
    label: name,
    entityType,
    name,
    alternateNames,
    description,
    domain: DOMAIN,
    sourceIds: recordSourceIds,
    status,
    metadata: {
      canonicalIdPolicy: "historyroot-plymouth-v1",
      normalizedAliases: alternateNames.map((item) => item.toLocaleLowerCase()),
      reviewRequired: true,
      ...metadata,
    },
  };
}

const people = [
  entity(
    "historyroot-plymouth-person-ousamequin",
    "person",
    "Ousamequin",
    ["Massasoit", "Massasoyt", "Massassowat"],
    "Pokanoket Wampanoag great sachem whose diplomacy shaped the 1621 agreement with Plymouth.",
    [sourceIds.nmaiTimeline, sourceIds.bradford],
    { namingNote: "Ousamequin is canonical; Massasoit is retained as a familiar English title/name form." },
  ),
  entity(
    "historyroot-plymouth-person-wamsutta",
    "person",
    "Wamsutta",
    ["Alexander"],
    "Older son of Ousamequin and a Wampanoag sachem whose death deepened distrust of Plymouth.",
    [sourceIds.nmaiTimeline],
  ),
  entity(
    "historyroot-plymouth-person-metacom",
    "person",
    "Metacom",
    ["Metacomet", "King Philip", "Philip"],
    "Pokanoket Wampanoag leader known to English colonists as King Philip.",
    [sourceIds.nmaiTimeline, sourceIds.npsWar],
    { namingNote: "Metacom is canonical; the English name King Philip is an alias." },
  ),
  entity(
    "historyroot-plymouth-person-weetamoo",
    "person",
    "Weetamoo",
    ["Weetamoe", "Weetamore"],
    "Saunkskwa of Pocasset and a major leader during Metacom's War.",
    [sourceIds.nmaiTimeline],
  ),
  entity(
    "historyroot-plymouth-person-awashonks",
    "person",
    "Awashonks",
    ["Awasuncks", "Awashunks", "Awashunckes"],
    "Saunkskwa of the Sakonnet whose diplomacy navigated pressure from Plymouth and wartime alliances.",
    [sourceIds.church],
  ),
  entity(
    "historyroot-plymouth-person-tisquantum",
    "person",
    "Tisquantum",
    ["Squanto"],
    "Patuxet Wampanoag man kidnapped in 1614 who later mediated between Plymouth and regional Native communities.",
    [sourceIds.nmaiTimeline, sourceIds.bradford, sourceIds.goodNewes],
    { namingNote: "Tisquantum is canonical; Squanto is retained as the common English alias." },
  ),
  entity(
    "historyroot-plymouth-person-hobbamock",
    "person",
    "Hobbamock",
    ["Hobomock", "Hobbamok"],
    "Pokanoket pniese and diplomat who lived near Plymouth and participated in regional diplomacy.",
    [sourceIds.bradford, sourceIds.goodNewes],
  ),
  entity(
    "historyroot-plymouth-person-samoset",
    "person",
    "Samoset",
    ["Samaset"],
    "Abenaki visitor whose English-language greeting opened sustained communication at Plymouth in March 1621.",
    [sourceIds.bradford],
  ),
  entity(
    "historyroot-plymouth-person-epenow",
    "person",
    "Epenow",
    ["Epanow"],
    "Aquinnah Wampanoag leader taken to England who escaped during a return voyage.",
    [sourceIds.aquinnahAncient, sourceIds.nmaiTimeline],
  ),
  entity(
    "historyroot-plymouth-person-corbitant",
    "person",
    "Corbitant",
    ["Coubatant", "Conbatant"],
    "Pocasset sachem whose reported words expose tensions and differing expectations in early diplomacy.",
    [sourceIds.nmaiTreaty, sourceIds.goodNewes],
  ),
  entity(
    "historyroot-plymouth-person-pecksuot",
    "person",
    "Pecksuot",
    ["Pecksuot the pniese"],
    "Massachusett pniese killed by Myles Standish during the Wessagusset violence.",
    [sourceIds.goodNewes],
  ),
  entity(
    "historyroot-plymouth-person-wituwamat",
    "person",
    "Wituwamat",
    ["Wittuwamat"],
    "Massachusett man killed during the Wessagusset violence; his head was displayed at Plymouth.",
    [sourceIds.goodNewes],
  ),
  entity(
    "historyroot-plymouth-person-aspinet",
    "person",
    "Aspinet",
    ["Aspinet of Nauset"],
    "Nauset sachem named in early English accounts.",
    [sourceIds.goodNewes],
  ),
  entity(
    "historyroot-plymouth-person-john-carver",
    "person",
    "John Carver",
    [],
    "Mayflower passenger and first governor chosen by the Plymouth colonists.",
    [sourceIds.bradford, sourceIds.compactLaw],
  ),
  entity(
    "historyroot-plymouth-person-william-bradford",
    "person",
    "William Bradford",
    [],
    "Plymouth governor and author of Of Plymouth Plantation.",
    [sourceIds.bradford, sourceIds.bradfordManuscript],
  ),
  entity(
    "historyroot-plymouth-person-edward-winslow",
    "person",
    "Edward Winslow",
    [],
    "Plymouth colonist, diplomat, and author associated with Mourt's Relation and Good Newes.",
    [sourceIds.mourts, sourceIds.goodNewes],
  ),
  entity(
    "historyroot-plymouth-person-myles-standish",
    "person",
    "Myles Standish",
    ["Miles Standish"],
    "Military officer at Plymouth who led the 1623 Wessagusset killings.",
    [sourceIds.goodNewes, sourceIds.bradford],
  ),
  entity(
    "historyroot-plymouth-person-thomas-hunt",
    "person",
    "Thomas Hunt",
    [],
    "English captain identified in the NMAI timeline as the kidnapper of Patuxet and Nauset men in 1614.",
    [sourceIds.nmaiTimeline],
  ),
  entity(
    "historyroot-plymouth-person-thomas-dermer",
    "person",
    "Thomas Dermer",
    [],
    "English captain with whom Tisquantum returned to Wampanoag homelands in 1619.",
    [sourceIds.nmaiTimeline],
  ),
  entity(
    "historyroot-plymouth-person-thomas-weston",
    "person",
    "Thomas Weston",
    [],
    "Merchant sponsor of the short-lived Wessagusset colony.",
    [sourceIds.bradford, sourceIds.goodNewes],
  ),
  entity(
    "historyroot-plymouth-person-thomas-morton",
    "person",
    "Thomas Morton",
    [],
    "English colonist associated with Merrymount and its conflict with Plymouth leaders.",
    [sourceIds.bradford],
  ),
  entity(
    "historyroot-plymouth-person-john-robinson",
    "person",
    "John Robinson",
    [],
    "Leiden pastor who criticized the scale and necessity of Plymouth's 1623 killings.",
    [sourceIds.bradford],
  ),
  entity(
    "historyroot-plymouth-person-william-phips",
    "person",
    "William Phips",
    ["Sir William Phips"],
    "Royal governor whose arrival accompanied implementation of the Province government in 1692.",
    [sourceIds.massArchives],
  ),
  entity(
    "historyroot-plymouth-person-wamsutta-frank-james",
    "person",
    "Wamsutta Frank James",
    ["Frank B. James", "Frank James"],
    "Aquinnah Wampanoag elder whose rejected anniversary speech helped initiate the National Day of Mourning in 1970.",
    [sourceIds.uaine, sourceIds.nmaiTimeline],
  ),
  entity(
    "historyroot-plymouth-person-john-sassamon",
    "person",
    "John Sassamon",
    ["Wassausmon"],
    "Wampanoag Christian interpreter whose death and the colonial trial that followed preceded the outbreak of war in 1675.",
    [sourceIds.npsSwansea],
  ),
];

const groups = [
  entity(
    "historyroot-plymouth-group-wampanoag",
    "cultural_community",
    "Wampanoag",
    ["Wampanoag Nation", "Wôpanâak"],
    "A living Indigenous nation composed of multiple communities in southeastern New England.",
    [sourceIds.nmaiTimeline, sourceIds.mashpeeCulture, sourceIds.aquinnahAncient],
    { continuityNote: "The dataset rejects disappearance narratives and recognizes living Wampanoag communities." },
  ),
  entity(
    "historyroot-plymouth-group-pokanoket",
    "group",
    "Pokanoket",
    ["Puckanokick", "Pokanoket Wampanoag"],
    "Wampanoag political community associated with Ousamequin and Metacom.",
    [sourceIds.nmaiTimeline, sourceIds.goodNewes],
  ),
  entity(
    "historyroot-plymouth-group-patuxet",
    "group",
    "Patuxet",
    ["Pahtuksut", "Patuxet Wampanoag"],
    "Wampanoag community whose homeland became the site of Plymouth settlement.",
    [sourceIds.nmaiTimeline, sourceIds.mashpeeCulture],
  ),
  entity(
    "historyroot-plymouth-group-nauset",
    "group",
    "Nauset",
    ["Nauset Wampanoag"],
    "Wampanoag community on Cape Cod encountered by Mayflower exploring parties.",
    [sourceIds.nmaiTimeline, sourceIds.bradford],
  ),
  entity(
    "historyroot-plymouth-group-massachusett",
    "cultural_community",
    "Massachusett",
    ["Massachuset", "Massachusetts people"],
    "Indigenous communities of the Massachusetts Bay region.",
    [sourceIds.goodNewes, sourceIds.npsWar],
  ),
  entity(
    "historyroot-plymouth-group-narragansett",
    "cultural_community",
    "Narragansett",
    ["Narraganset", "Nanohigganset"],
    "Indigenous nation west of Narragansett Bay whose wartime position changed after the Great Swamp attack.",
    [sourceIds.npsWar, sourceIds.nmaiTimeline],
  ),
  entity(
    "historyroot-plymouth-group-pocasset",
    "group",
    "Pocasset",
    ["Pocasset Wampanoag", "Pacusset"],
    "Wampanoag community led by saunkskwas including Weetamoo.",
    [sourceIds.nmaiTimeline, sourceIds.church],
  ),
  entity(
    "historyroot-plymouth-group-sakonnet",
    "group",
    "Sakonnet",
    ["Sogkonate", "Saconet"],
    "Wampanoag community led by Awashonks.",
    [sourceIds.church],
  ),
  entity(
    "historyroot-plymouth-group-plymouth-colonists",
    "group",
    "Plymouth colonists",
    ["New Plymouth colonists", "Plimoth colonists", "Mayflower colonists"],
    "The heterogeneous English settler community established at Patuxet in 1620.",
    [sourceIds.mourts, sourceIds.bradford],
  ),
  entity(
    "historyroot-plymouth-group-wessagusset-colonists",
    "group",
    "Wessagusset colonists",
    ["Weston's colony", "Wichaguscusset colonists"],
    "Short-lived English settlement in Massachusetts Bay sponsored by Thomas Weston.",
    [sourceIds.goodNewes, sourceIds.bradford],
  ),
];

const places = [
  entity(
    "historyroot-plymouth-place-patuxet-plymouth",
    "place",
    "Patuxet / Plymouth",
    ["Patuxet", "Plymouth", "Plimoth", "New Plymouth", "Pahtuksut"],
    "Wampanoag homeland and village site where English settlers established Plymouth.",
    [sourceIds.nmaiTimeline, sourceIds.mashpeeCulture, sourceIds.bradford],
    { coordinatePolicy: "No coordinates supplied; locality is represented without invented precision." },
  ),
  entity("historyroot-plymouth-place-cape-cod", "place", "Cape Cod", ["Cap-Codd"], "Cape and peninsula first reached by the Mayflower in November 1620.", [sourceIds.bradford, sourceIds.nmaiTimeline]),
  entity("historyroot-plymouth-place-provincetown-harbor", "place", "Provincetown Harbor", ["Cape Cod Harbor"], "Harbor where the Mayflower anchored and the Compact was signed.", [sourceIds.compactLaw, sourceIds.mashpeeCulture]),
  entity("historyroot-plymouth-place-nauset", "place", "Nauset", ["Nauset territory"], "Wampanoag territory on Cape Cod where early Mayflower encounters occurred.", [sourceIds.nmaiTimeline]),
  entity("historyroot-plymouth-place-sowams", "place", "Sowams / Pokanoket", ["Sowams", "Puckanokick", "Pokanoket"], "Principal place associated in English accounts with Ousamequin.", [sourceIds.bradford, sourceIds.goodNewes]),
  entity("historyroot-plymouth-place-manomet", "place", "Manomet", ["Manamoyack", "Manomet"], "Cape-area place appearing in Plymouth accounts and Tisquantum's final journey.", [sourceIds.bradford, sourceIds.goodNewes]),
  entity("historyroot-plymouth-place-nemasket", "place", "Nemasket", ["Namaschet"], "Wampanoag town in the interior travel network west of Plymouth.", [sourceIds.goodNewes]),
  entity("historyroot-plymouth-place-wessagusset", "place", "Wessagusset", ["Wichaguscusset", "Wessaguscus"], "Site of Weston's short-lived colony and the 1623 killings in Massachusetts Bay.", [sourceIds.goodNewes, sourceIds.bradford]),
  entity("historyroot-plymouth-place-merrymount", "place", "Merrymount", ["Meriemounte", "Mount Wollaston", "Mount Dagon"], "Settlement associated with Thomas Morton and the Maypole controversy.", [sourceIds.bradford]),
  entity("historyroot-plymouth-place-mount-hope", "place", "Mount Hope", ["Montaup"], "Pokanoket place strongly associated with Metacom.", [sourceIds.npsWar, sourceIds.church]),
  entity("historyroot-plymouth-place-pocasset", "place", "Pocasset", ["Pocasset country"], "Homeland associated with Weetamoo and Pocasset Wampanoag.", [sourceIds.church, sourceIds.nmaiTimeline]),
  entity("historyroot-plymouth-place-sakonnet", "place", "Sakonnet", ["Sogkonate", "Saconet"], "Homeland associated with Awashonks and the Sakonnet.", [sourceIds.church]),
  entity("historyroot-plymouth-place-narragansett-bay", "place", "Narragansett Bay", [], "Bay linking Wampanoag, Narragansett, Rhode Island, and Plymouth-region histories.", [sourceIds.npsWar]),
  entity("historyroot-plymouth-place-great-swamp", "place", "Great Swamp", ["Great Swamp settlement"], "Narragansett winter settlement attacked by colonial forces in December 1675.", [sourceIds.npsWar]),
  entity("historyroot-plymouth-place-swansea", "place", "Swansea", ["Swansey"], "English settlement attacked at the outbreak of war in June 1675.", [sourceIds.npsSwansea]),
  entity("historyroot-plymouth-place-coles-hill", "place", "Cole's Hill", ["Cole Hill"], "Plymouth hill where the National Day of Mourning has gathered since 1970.", [sourceIds.uaine]),
  entity("historyroot-plymouth-place-plymouth-harbor", "place", "Plymouth Harbor", [], "Harbor entered by the Mayflower in December 1620.", [sourceIds.bradford]),
  entity("historyroot-plymouth-place-england", "place", "England", [], "Kingdom connected to the voyage, captivity, publishing, and imperial government.", [sourceIds.nmaiTimeline, sourceIds.compactLaw]),
  entity("historyroot-plymouth-place-spain", "place", "Spain", [], "One destination in accounts of Tisquantum's forced Atlantic journey.", [sourceIds.nmaiTimeline]),
  entity("historyroot-plymouth-place-london", "place", "London", [], "Publishing and commercial center in Tisquantum's travels and Plymouth's documentary history.", [sourceIds.nmaiTimeline, sourceIds.mourts]),
  entity("historyroot-plymouth-place-newfoundland", "place", "Newfoundland", [], "Fishing-colony region in Tisquantum's Atlantic travels before his return.", [sourceIds.nmaiTimeline]),
  entity("historyroot-plymouth-place-boston", "place", "Boston", [], "Seat of the Province government inaugurated in May 1692.", [sourceIds.massArchives]),
];

type EventRow = {
  id: string;
  name: string;
  aliases?: string[];
  description: string;
  sources: string[];
  time:
    | { kind: "exact"; date: string; label: string; calendar?: string; notes?: string }
    | { kind: "approximate"; date?: string; start?: string; end?: string; label: string; notes: string }
    | { kind: "range"; start: string; end: string; label: string; notes?: string }
    | { kind: "disputed"; proposals: Array<{ date?: string; label: string; uncertainty?: string }>; label: string; notes: string };
  metadata?: Record<string, unknown>;
};

const eventRows: EventRow[] = [
  { id: "epenow-capture-return", name: "Epenow's captivity and escape", description: "Epenow was taken to England and later escaped to his homeland during a return voyage.", sources: [sourceIds.aquinnahAncient, sourceIds.nmaiTimeline], time: { kind: "approximate", start: "1611-01-01", end: "1614-12-31", label: "About 1611-1614", notes: "Public-history sources give the episode without a single secure day." } },
  { id: "hunt-kidnappings", name: "Thomas Hunt kidnaps Patuxet and Nauset men", aliases: ["Tisquantum's kidnapping"], description: "Thomas Hunt kidnapped twenty men from Patuxet and seven from Nauset, including Tisquantum.", sources: [sourceIds.nmaiTimeline], time: { kind: "approximate", date: "1614-01-01", label: "1614", notes: "Year-level precision only." } },
  { id: "great-dying", name: "Wampanoag-region epidemic", aliases: ["Great Dying", "1616-1619 epidemic"], description: "Severe epidemics devastated Native communities along the New England coast before Plymouth's settlement.", sources: [sourceIds.nmaiTimeline, sourceIds.cdcEpidemic, sourceIds.mashpeeCulture], time: { kind: "range", start: "1616-01-01", end: "1619-12-31", label: "1616-1619", notes: "Duration and disease identity remain debated." }, metadata: { uncertaintyClass: "competing-diagnoses" } },
  { id: "tisquantum-atlantic-captivity", name: "Tisquantum's forced Atlantic travels", description: "After his kidnapping, Tisquantum was held and traveled through European and North Atlantic networks.", sources: [sourceIds.nmaiTimeline], time: { kind: "range", start: "1614-01-01", end: "1619-12-31", label: "1614-1619", notes: "The sequence is better supported than exact dates for each leg." } },
  { id: "tisquantum-return", name: "Tisquantum returns to Wampanoag homelands", description: "Tisquantum returned with Thomas Dermer and learned that Patuxet had been devastated.", sources: [sourceIds.nmaiTimeline], time: { kind: "approximate", date: "1619-01-01", label: "1619", notes: "Year-level precision only." } },
  { id: "mayflower-voyage", name: "Mayflower transatlantic voyage", description: "The Mayflower carried the Plymouth colonists from England to Cape Cod.", sources: [sourceIds.compactLaw, sourceIds.bradford], time: { kind: "range", start: "1620-09-06", end: "1620-11-11", label: "September-November 1620 (English Old Style)", notes: "Dates follow common English Old Style labeling; modern-calendar conversion is not silently substituted." } },
  { id: "cape-cod-arrival", name: "Mayflower arrives at Cape Cod", description: "The ship arrived outside the geographic scope of the colonists' surviving patent authority.", sources: [sourceIds.compactExhibit, sourceIds.compactLaw], time: { kind: "exact", date: "1620-11-11", label: "11 November 1620 (English Old Style)", calendar: "julian-old-style", notes: "Often rendered 21 November in the proleptic Gregorian calendar." } },
  { id: "mayflower-compact", name: "Mayflower Compact agreement", aliases: ["Mayflower Compact", "Agreement Between the Settlers at New Plymouth"], description: "Adult male passengers signed a combination establishing a civil body politic before settlement.", sources: [sourceIds.mourts, sourceIds.compactExhibit, sourceIds.compactLaw], time: { kind: "exact", date: "1620-11-11", label: "11 November 1620 (English Old Style)", calendar: "julian-old-style", notes: "The original signed document is lost; date labels preserve the source calendar." } },
  { id: "first-encounter", name: "First Encounter at Nauset", description: "A Mayflower exploring party and Nauset people exchanged fire during the Cape Cod explorations.", sources: [sourceIds.bradford, sourceIds.nmaiTimeline], time: { kind: "exact", date: "1620-12-08", label: "8 December 1620 (English Old Style)", calendar: "julian-old-style", notes: "Source-calendar date; modern Gregorian equivalent is later in December." } },
  { id: "plymouth-harbor-arrival", name: "Mayflower reaches Plymouth Harbor", description: "The exploring party and ship reached the harbor by Patuxet where settlement began.", sources: [sourceIds.bradford, sourceIds.nmaiTimeline], time: { kind: "exact", date: "1620-12-16", label: "16 December 1620 (English Old Style)", calendar: "julian-old-style", notes: "The settlement sequence unfolded over multiple days." } },
  { id: "plymouth-settlement", name: "English settlement established at Patuxet", description: "The colonists began building at the Wampanoag village site of Patuxet, renamed Plymouth.", sources: [sourceIds.nmaiTimeline, sourceIds.bradford, sourceIds.mashpeeCulture], time: { kind: "range", start: "1620-12-16", end: "1621-03-31", label: "Winter 1620-1621", notes: "Settlement was a process, not a single landing instant." } },
  { id: "first-winter", name: "Plymouth's first-winter mortality crisis", description: "Disease, exposure, and inadequate shelter killed roughly half the company.", sources: [sourceIds.bradford], time: { kind: "range", start: "1620-12-01", end: "1621-03-31", label: "Winter 1620-1621", notes: "Bradford emphasizes January and February; the range avoids a false endpoint." } },
  { id: "samoset-arrival", name: "Samoset enters Plymouth", description: "Samoset entered the settlement and spoke with colonists in English.", sources: [sourceIds.bradford], time: { kind: "exact", date: "1621-03-16", label: "16 March 1621 (English Old Style)", calendar: "julian-old-style", notes: "Date follows Bradford's English calendar." } },
  { id: "ousamequin-meeting", name: "Ousamequin-Plymouth meeting", description: "Ousamequin and Plymouth leaders met with Samoset, Tisquantum, and others present.", sources: [sourceIds.bradford, sourceIds.nmaiTimeline], time: { kind: "approximate", date: "1621-03-22", label: "Late March 1621", notes: "Modern summaries vary in date conventions; dataset keeps approximate wording." } },
  { id: "peace-agreement", name: "Pokanoket-Plymouth peace and mutual-aid agreement", aliases: ["1621 treaty", "Ousamequin agreement"], description: "The parties recorded terms concerning injury, restitution, mutual defense, and weapons at meetings.", sources: [sourceIds.bradford, sourceIds.nmaiTreaty], time: { kind: "approximate", date: "1621-03-22", label: "Late March 1621", notes: "Linked to the meeting; exact modern-calendar rendering is not asserted." } },
  { id: "tisquantum-mediation", name: "Tisquantum lives at and mediates for Plymouth", description: "Tisquantum interpreted, guided travel, and taught subsistence practices while pursuing his own political position.", sources: [sourceIds.bradford, sourceIds.goodNewes, sourceIds.nmaiTimeline], time: { kind: "range", start: "1621-03-01", end: "1622-11-30", label: "1621-1622", notes: "Ends with his death during a trading journey." } },
  { id: "harvest-gathering", name: "Plymouth-Pokanoket harvest gathering", aliases: ["1621 harvest celebration", "First Thanksgiving"], description: "A three-day harvest gathering brought Plymouth colonists together with Ousamequin and about ninety men.", sources: [sourceIds.mourts, sourceIds.nmaiTimeline, sourceIds.plimothThanksgiving], time: { kind: "approximate", start: "1621-09-01", end: "1621-11-30", label: "Autumn 1621", notes: "The surviving eyewitness account does not provide an exact date." } },
  { id: "tisquantum-death", name: "Death of Tisquantum", description: "Tisquantum became ill and died during a trading voyage near Manomet/Monomoy.", sources: [sourceIds.bradford], time: { kind: "approximate", date: "1622-11-01", label: "Late 1622", notes: "Month is an approximate anchor; do not treat as an exact day." } },
  { id: "wessagusset-founded", name: "Wessagusset colony established", description: "Thomas Weston's settlers established a separate colony in Massachusetts Bay.", sources: [sourceIds.bradford, sourceIds.goodNewes], time: { kind: "approximate", date: "1622-07-01", label: "1622", notes: "Year-level foundation sequence." } },
  { id: "wessagusset-crisis", name: "Wessagusset subsistence and trust crisis", description: "Wessagusset colonists faced hunger after thefts, coercive proposals, and deteriorating relations.", sources: [sourceIds.bradford, sourceIds.goodNewes], time: { kind: "range", start: "1622-12-01", end: "1623-03-22", label: "Winter 1622-1623", notes: "Accounts describe a developing crisis rather than one incident." } },
  { id: "wessagusset-killings", name: "Wessagusset killings", aliases: ["Standish raid at Wessagusset"], description: "Myles Standish and allied Englishmen killed Pecksuot, Wituwamat, and others in a preemptive operation.", sources: [sourceIds.goodNewes, sourceIds.bradford], time: { kind: "exact", date: "1623-03-25", label: "25 March 1623 (English Old Style account)", calendar: "julian-old-style", notes: "The narrative labels 25 March; calendar and year-start conventions require specialist review." } },
  { id: "robinson-response", name: "John Robinson criticizes the Wessagusset killings", description: "Robinson questioned their necessity and warned that bloodshed could be difficult to stop.", sources: [sourceIds.bradford], time: { kind: "approximate", date: "1623-12-01", label: "After reports of the 1623 killings", notes: "The response survives through Bradford; exact letter date needs edition-level review." } },
  { id: "private-corn-allotments", name: "Plymouth assigns household corn plots", description: "Plymouth temporarily shifted corn planting responsibility to households while retaining public obligations.", sources: [sourceIds.goodNewes, sourceIds.bradford], time: { kind: "approximate", date: "1623-04-01", label: "Spring 1623", notes: "A seasonal administrative change, not a complete privatization of colony property." } },
  { id: "merrymount-maypole", name: "Merrymount Maypole celebration", description: "Thomas Morton's community erected a Maypole and celebrated in ways Bradford condemned.", sources: [sourceIds.bradford], time: { kind: "approximate", start: "1627-01-01", end: "1628-12-31", label: "About 1627-1628", notes: "Bradford places the episode in his 1628 chapter but describes a sequence." } },
  { id: "merrymount-suppression", name: "Suppression of Merrymount", description: "Colonial authorities arrested Morton and later cut down the Maypole.", sources: [sourceIds.bradford], time: { kind: "approximate", date: "1628-01-01", label: "1628", notes: "Year-level precision." } },
  { id: "plymouth-patent", name: "New Plymouth patent granted to Bradford and associates", description: "The Council for New England granted a patent to William Bradford and associates.", sources: [sourceIds.charter, sourceIds.plymouthRecords], time: { kind: "approximate", date: "1629-01-01", label: "1629", notes: "The dataset does not infer Native consent from the English patent." } },
  { id: "massachusetts-bay-expansion", name: "Massachusetts Bay settlement expansion", description: "Large-scale English settlement expanded in Massachusetts Bay and across regional homelands.", sources: [sourceIds.nmaiTimeline, sourceIds.massArchives], time: { kind: "range", start: "1630-01-01", end: "1669-12-31", label: "1630s-1660s", notes: "A long process represented as a range." } },
  { id: "smallpox-epidemic-1633", name: "Regional smallpox epidemic", description: "A documented smallpox epidemic caused further severe mortality in Native communities.", sources: [sourceIds.nmaiTimeline], time: { kind: "approximate", date: "1633-01-01", label: "1633", notes: "Year-level regional event." } },
  { id: "missionary-praying-towns", name: "Missionary and praying-town expansion", description: "Missionary programs and praying towns altered religious, political, and land relations.", sources: [sourceIds.nmaiTimeline, sourceIds.mashpeeCulture], time: { kind: "range", start: "1632-01-01", end: "1670-12-31", label: "1630s-1670", notes: "Long institutional process." } },
  { id: "ousamequin-death", name: "Death of Ousamequin", description: "Ousamequin died after decades of diplomacy with Plymouth.", sources: [sourceIds.nmaiTimeline], time: { kind: "approximate", start: "1660-01-01", end: "1661-12-31", label: "About 1660-1661", notes: "Public chronologies vary; no exact date asserted." } },
  { id: "wamsutta-court-death", name: "Wamsutta brought to Plymouth and dies", description: "Plymouth authorities compelled Wamsutta to a hearing; he died soon afterward amid Wampanoag suspicion.", sources: [sourceIds.nmaiTimeline], time: { kind: "disputed", proposals: [{ date: "1661-01-01", label: "1661 in NMAI educational timeline" }, { date: "1662-01-01", label: "1662 in other historical chronologies", uncertainty: "Requires specialist reconciliation" }], label: "1661 or 1662", notes: "The dataset preserves competing year labels and does not assert poisoning as established fact." } },
  { id: "metacom-leadership", name: "Metacom becomes Pokanoket sachem", description: "Metacom emerged as a principal Pokanoket leader after Wamsutta's death.", sources: [sourceIds.nmaiTimeline], time: { kind: "approximate", start: "1661-01-01", end: "1662-12-31", label: "About 1661-1662", notes: "Dependent on the chronology of Wamsutta's death." } },
  { id: "awashonks-1671-negotiation", name: "Plymouth-Awashonks negotiations", description: "Awashonks negotiated under Plymouth pressure over authority, arms, and peace.", sources: [sourceIds.church, sourceIds.plymouthRecords], time: { kind: "approximate", date: "1671-07-01", label: "July 1671", notes: "Primary-record volume and page review remains an open task." } },
  { id: "sassamon-death", name: "Death of John Sassamon", description: "John Sassamon was found dead after warning Plymouth about possible conflict.", sources: [sourceIds.npsSwansea], time: { kind: "approximate", date: "1675-01-01", label: "January 1675", notes: "Day not asserted by the inspected source." } },
  { id: "sassamon-trial-executions", name: "Trial and executions for Sassamon's death", description: "Plymouth tried and executed three Wampanoag men in connection with Sassamon's death.", sources: [sourceIds.npsSwansea], time: { kind: "approximate", date: "1675-06-01", label: "June 1675", notes: "The project overview supplies sequence but not a full legal-record analysis." } },
  { id: "swansea-attack", name: "Attack on Swansea", description: "Wampanoag fighters attacked the English settlement at Swansea as war began.", sources: [sourceIds.npsSwansea], time: { kind: "approximate", date: "1675-06-20", label: "June 1675", notes: "The inspected source describes the opening attack and cautions it may have begun without Metacom's permission." } },
  { id: "metacoms-war", name: "Metacom's War", aliases: ["King Philip's War", "Metacomet's War"], description: "A devastating regional war involving multiple Indigenous nations, English colonies, and Native allies.", sources: [sourceIds.nmaiTimeline, sourceIds.npsWar, sourceIds.npsSwansea, sourceIds.church], time: { kind: "range", start: "1675-06-01", end: "1676-08-31", label: "June 1675-August 1676 in the Plymouth-Wampanoag core theater", notes: "Some regional accounts extend connected fighting to 1678; this dataset's core event ends with the 1676 southern New England phase." } },
  { id: "great-swamp-attack", name: "Great Swamp attack", aliases: ["Great Swamp Fight", "Great Swamp Massacre"], description: "United Colonies forces attacked the Narragansett winter settlement in the Great Swamp.", sources: [sourceIds.npsWar], time: { kind: "approximate", date: "1675-12-19", label: "December 1675", notes: "Exact day varies with calendar convention; month is the safe display label." } },
  { id: "awashonks-peace-negotiation", name: "Awashonks negotiates a wartime change of alliance", description: "Awashonks and Sakonnet representatives negotiated with Benjamin Church and Plymouth officials.", sources: [sourceIds.church], time: { kind: "approximate", date: "1676-07-01", label: "Summer 1676", notes: "Church's retrospective account supplies the sequence; the exact day is not asserted." } },
  { id: "metacom-death", name: "Death of Metacom", description: "Metacom was killed near Mount Hope as the southern New England phase of the war collapsed.", sources: [sourceIds.nmaiTimeline, sourceIds.church], time: { kind: "exact", date: "1676-08-12", label: "12 August 1676 (English Old Style)", calendar: "julian-old-style", notes: "Date requires calendar-aware display." } },
  { id: "weetamoo-death", name: "Death of Weetamoo", description: "Weetamoo died during the final phase of the war and her body was treated as a colonial trophy.", sources: [sourceIds.nmaiTimeline], time: { kind: "approximate", date: "1676-08-01", label: "August 1676", notes: "Month-level precision in this pilot." } },
  { id: "war-enslavement-displacement", name: "Postwar killing, enslavement, and displacement", description: "Native survivors faced death, captivity, overseas enslavement, coerced assimilation, and confinement.", sources: [sourceIds.nmaiTimeline], time: { kind: "range", start: "1675-06-01", end: "1700-12-31", label: "1675 through the late seventeenth century", notes: "Consequences unfolded unevenly and continued beyond the core war dates." } },
  { id: "charter-signed", name: "William and Mary sign the Province charter", description: "The 1691 charter incorporated Plymouth into the new Province of Massachusetts Bay.", sources: [sourceIds.charter, sourceIds.massArchives], time: { kind: "exact", date: "1691-10-07", label: "7 October 1691", calendar: "julian-old-style", notes: "Charter signature date is distinct from governmental inauguration." } },
  { id: "province-inaugurated", name: "Province government inaugurated in Boston", description: "The new Province government began operating, implementing Plymouth's incorporation.", sources: [sourceIds.massArchives], time: { kind: "exact", date: "1692-05-14", label: "14 May 1692", calendar: "julian-old-style", notes: "Institutional chronology uses this inauguration date; some references use Phips's swearing-in two days later for a related milestone." } },
  { id: "national-day-mourning-1970", name: "First National Day of Mourning", description: "Wamsutta Frank James and other Native people gathered at Cole's Hill after his anniversary speech was rejected.", sources: [sourceIds.uaine, sourceIds.nmaiTimeline], time: { kind: "approximate", date: "1970-11-26", label: "U.S. Thanksgiving Day, 1970", notes: "Modern Gregorian date." } },
];

const events = eventRows.map((event) =>
  entity(
    `historyroot-plymouth-event-${event.id}`,
    "event",
    event.name,
    event.aliases ?? [],
    event.description,
    event.sources,
    {
      coveragePeriod:
        event.id === "national-day-mourning-1970"
          ? "cultural-memory-afterlife"
          : event.id === "province-inaugurated"
            ? "1692-transition"
            : ["epenow-capture-return", "hunt-kidnappings"].includes(
                event.id,
              )
              ? "background-1605-1615"
              : event.id === "tisquantum-atlantic-captivity"
                ? "background-to-core-bridge"
                : "core-1616-1691",
      ...event.metadata,
    },
  ),
);

function temporalAssertion(event: EventRow) {
  const base = {
    id: `historyroot-plymouth-time-${event.id}`,
    label: `Date of ${event.name}`,
    subjectId: `historyroot-plymouth-event-${event.id}`,
    domain: DOMAIN,
    sourceIds: event.sources,
    status,
    dateLabel: event.time.label,
    metadata: {
      reviewRequired: true,
      falsePrecisionAvoided: true,
    },
  };

  if (event.time.kind === "exact") {
    return {
      ...base,
      temporalKind: "exact",
      exactDate: event.time.date,
      calendarSystem: event.time.calendar ?? "gregorian",
      datePrecision: "day",
      dateNotes: event.time.notes ?? "Exact day supplied by the cited chronology.",
    };
  }

  if (event.time.kind === "range") {
    return {
      ...base,
      temporalKind: "range",
      startDate: event.time.start,
      endDate: event.time.end,
      calendarSystem: "mixed-historical-labels",
      datePrecision: "range",
      dateNotes: event.time.notes ?? "Range represents an extended event.",
    };
  }

  if (event.time.kind === "disputed") {
    return {
      ...base,
      temporalKind: "disputed",
      proposedDates: event.time.proposals,
      calendarSystem: "historical-chronology",
      datePrecision: "competing-year",
      dateNotes: event.time.notes,
    };
  }

  return {
    ...base,
    temporalKind: "approximate",
    ...(event.time.date ? { exactDate: event.time.date } : {}),
    ...(event.time.start ? { startDate: event.time.start } : {}),
    ...(event.time.end ? { endDate: event.time.end } : {}),
    calendarSystem: "historical-chronology",
    datePrecision: event.time.date ? "approximate-year-or-month" : "approximate-range",
    startUncertainty: "Start is approximate.",
    endUncertainty: "End is approximate.",
    dateNotes: event.time.notes,
  };
}

const documentEntities = [
  entity("historyroot-plymouth-work-mayflower-compact-text", "work", "Mayflower Compact text", ["Compact text"], "The textual work known through surviving early witnesses.", [sourceIds.mourts, sourceIds.compactLaw]),
  entity("historyroot-plymouth-document-mayflower-compact-original", "document", "Original signed Mayflower Compact", ["Original Compact"], "The signed 1620 document, now lost.", [sourceIds.compactExhibit, sourceIds.compactLaw], { documentState: "lost", originalLost: true }),
  entity("historyroot-plymouth-work-mourts-relation", "work", "Mourt's Relation", ["A Relation or Journal"], "A 1622 printed account of the voyage and Plymouth's first year.", [sourceIds.mourts]),
  entity("historyroot-plymouth-document-mourts-1622", "document", "Mourt's Relation, 1622 edition", ["1622 Mourt's Relation"], "Earliest surviving printed witness containing the Compact text.", [sourceIds.mourts], { witnessOrder: 1 }),
  entity("historyroot-plymouth-document-purchas-1625", "document", "Purchas his Pilgrimes, 1625 Compact witness", ["Purchas Compact witness"], "A 1625 printed witness to the Compact text.", [sourceIds.compactLaw], { witnessOrder: 2 }),
  entity("historyroot-plymouth-document-bradford-manuscript", "document", "Bradford's Of Plimoth Plantation manuscript", ["Of Plymouth Plantation manuscript"], "Bradford's manuscript copy, written between 1630 and 1650, containing a Compact witness.", [sourceIds.bradfordManuscript, sourceIds.compactLaw], { witnessOrder: 3 }),
  entity("historyroot-plymouth-work-good-newes", "work", "Good Newes from New England", ["Good News from New England"], "Edward Winslow's 1624 account of diplomacy, subsistence, and the Wessagusset violence.", [sourceIds.goodNewes]),
  entity("historyroot-plymouth-work-plymouth-records", "work", "Records of the Colony of New Plymouth", ["Plymouth Colony Records"], "Twelve-volume published transcription series of court orders, judicial acts, laws, deeds, and related records.", [sourceIds.plymouthRecords]),
  entity("historyroot-plymouth-document-charter-1691", "document", "Charter of Massachusetts Bay, 1691", ["William and Mary Charter", "Province Charter"], "Royal charter signed in 1691 and inaugurated in 1692.", [sourceIds.charter, sourceIds.massArchives]),
  entity("historyroot-plymouth-work-church-war-narrative", "work", "Entertaining Passages Relating to Philip's War", ["Church's Philip's War narrative"], "Benjamin Church's retrospective war narrative published in 1716.", [sourceIds.church]),
];

const jurisdictions = [
  entity("historyroot-plymouth-jurisdiction-plymouth-colony", "political_jurisdiction", "Plymouth Colony", ["New Plymouth Colony", "Colony of New Plymouth"], "English colony existing from 1620 until incorporation into the Province of Massachusetts Bay.", [sourceIds.plymouthRecords, sourceIds.massArchives]),
  entity("historyroot-plymouth-jurisdiction-massachusetts-bay", "political_jurisdiction", "Massachusetts Bay Colony", ["Massachusetts Colony"], "Neighboring English colony centered on Boston.", [sourceIds.massArchives]),
  entity("historyroot-plymouth-jurisdiction-province-massachusetts-bay", "political_jurisdiction", "Province of Massachusetts Bay", ["Province of Massachusetts"], "Royal province established by the 1691 charter and inaugurated in 1692.", [sourceIds.charter, sourceIds.massArchives]),
];

const entities = [
  ...people,
  ...groups,
  ...places,
  ...events,
  ...documentEntities,
  ...jurisdictions,
];

const perspectives = [
  {
    id: "historyroot-plymouth-perspective-nmai",
    label: "NMAI Wampanoag-centered educational framing",
    name: "NMAI Wampanoag-centered educational framing",
    description: "Perspective explicitly attributed to the Smithsonian National Museum of the American Indian's Native Knowledge 360° materials.",
    domain: DOMAIN,
    sourceIds: [sourceIds.nmaiTimeline, sourceIds.nmaiTreaty],
    status,
    metadata: { attributedTo: "Smithsonian National Museum of the American Indian", perspectiveScope: "institutional-educational" },
  },
  {
    id: "historyroot-plymouth-perspective-mashpee",
    label: "Mashpee Wampanoag tribal public-history framing",
    name: "Mashpee Wampanoag tribal public-history framing",
    description: "Perspective attributed to the Mashpee Wampanoag Tribe's public history and culture page.",
    domain: DOMAIN,
    sourceIds: [sourceIds.mashpeeCulture],
    status,
    metadata: { attributedTo: "Mashpee Wampanoag Tribe", perspectiveScope: "tribal-institutional" },
  },
  {
    id: "historyroot-plymouth-perspective-aquinnah",
    label: "Aquinnah Wampanoag tribal history and tradition",
    name: "Aquinnah Wampanoag tribal history and tradition",
    description: "Perspective attributed to the Wampanoag Tribe of Gay Head (Aquinnah), including expressly identified tribal tradition.",
    domain: DOMAIN,
    sourceIds: [sourceIds.aquinnahAncient],
    status,
    metadata: { attributedTo: "Wampanoag Tribe of Gay Head (Aquinnah)", perspectiveScope: "tribal-institutional-and-oral-tradition" },
  },
  {
    id: "historyroot-plymouth-perspective-uaine",
    label: "UAINE National Day of Mourning perspective",
    name: "UAINE National Day of Mourning perspective",
    description: "Perspective attributed to United American Indians of New England's commemorative and activist interpretation.",
    domain: DOMAIN,
    sourceIds: [sourceIds.uaine],
    status,
    metadata: { attributedTo: "United American Indians of New England", perspectiveScope: "indigenous-activist-organization" },
  },
  {
    id: "historyroot-plymouth-perspective-bradford",
    label: "William Bradford's providential colonial narrative",
    name: "William Bradford's providential colonial narrative",
    description: "Bradford's retrospective English colonial framing, preserved as an attributed account rather than neutral narration.",
    domain: DOMAIN,
    sourceIds: [sourceIds.bradford],
    status,
    metadata: { attributedTo: "William Bradford", perspectiveScope: "individual-primary-account" },
  },
  {
    id: "historyroot-plymouth-perspective-winslow",
    label: "Edward Winslow's colonial diplomatic narrative",
    name: "Edward Winslow's colonial diplomatic narrative",
    description: "Winslow's contemporary English description of diplomacy and violence, including promotional and providential purposes.",
    domain: DOMAIN,
    sourceIds: [sourceIds.goodNewes, sourceIds.mourts],
    status,
    metadata: { attributedTo: "Edward Winslow", perspectiveScope: "individual-primary-account" },
  },
  {
    id: "historyroot-plymouth-perspective-robinson",
    label: "John Robinson's moral critique",
    name: "John Robinson's moral critique",
    description: "Robinson's English Separatist criticism of the necessity and scale of the Wessagusset killings.",
    domain: DOMAIN,
    sourceIds: [sourceIds.bradford],
    status,
    metadata: { attributedTo: "John Robinson through Bradford's transcription", perspectiveScope: "attributed-letter" },
  },
  {
    id: "historyroot-plymouth-perspective-imperial-legal",
    label: "English imperial legal framing",
    name: "English imperial legal framing",
    description: "The claims to jurisdiction and government expressed in patents, compacts, and royal charters.",
    domain: DOMAIN,
    sourceIds: [sourceIds.compactLaw, sourceIds.charter, sourceIds.massArchives],
    status,
    metadata: { attributedTo: "English colonial and royal legal documents", perspectiveScope: "institutional-legal" },
  },
  {
    id: "historyroot-plymouth-perspective-public-memory",
    label: "Museum historical-memory analysis",
    name: "Museum historical-memory analysis",
    description: "Public-history analysis of how Plymouth Rock, the Compact, and Thanksgiving accrued later meanings.",
    domain: DOMAIN,
    sourceIds: [sourceIds.pilgrimHallRock, sourceIds.plimothThanksgiving, sourceIds.compactLaw],
    status,
    metadata: { attributedTo: "Pilgrim Hall Museum, Plimoth Patuxet Museums, and Library of Congress", perspectiveScope: "institutional-memory-analysis" },
  },
  {
    id: "historyroot-plymouth-perspective-epidemiology",
    label: "Modern retrospective epidemiological analysis",
    name: "Modern retrospective epidemiological analysis",
    description: "A modern medical-historical hypothesis that foregrounds diagnostic uncertainty and retrospective bias.",
    domain: DOMAIN,
    sourceIds: [sourceIds.cdcEpidemic],
    status,
    metadata: { attributedTo: "Marr and Cathey, Emerging Infectious Diseases (2010)", perspectiveScope: "scholarly-hypothesis" },
  },
];

const accounts = [
  ["mourts", "Mourt's Relation account", "historyroot-plymouth-work-mourts-relation", "historyroot-plymouth-person-edward-winslow", sourceIds.mourts, "contemporary-english-published-account", "A near-contemporary English account of the voyage, Compact, settlement, diplomacy, and harvest gathering.", "1865 edition of 1622 work"],
  ["bradford", "Bradford's retrospective account", "historyroot-plymouth-document-bradford-manuscript", "historyroot-plymouth-person-william-bradford", sourceIds.bradford, "retrospective-english-manuscript-account", "Bradford's later narrative of Plymouth's formation and early decades.", "EADA electronic edition"],
  ["good-newes", "Winslow's Good Newes account", "historyroot-plymouth-work-good-newes", "historyroot-plymouth-person-edward-winslow", sourceIds.goodNewes, "contemporary-english-published-account", "Winslow's account of regional diplomacy, subsistence, Tisquantum, and Wessagusset.", "1841 edition of 1624 work"],
  ["compact-exhibit", "Library of Congress Compact exhibit account", "historyroot-plymouth-work-mayflower-compact-text", undefined, sourceIds.compactExhibit, "institutional-interpretive-account", "The Library of Congress explains the patent problem, immediate association, and loss of the original Compact.", "Library of Congress exhibition"],
  ["compact-law", "Law Library Compact textual-history account", "historyroot-plymouth-work-mayflower-compact-text", undefined, sourceIds.compactLaw, "institutional-legal-history-account", "The Law Library of Congress identifies three early surviving textual witnesses and the Compact's later memory.", "In Custodia Legis"],
  ["nmai-timeline", "NMAI timeline account", "historyroot-plymouth-event-metacoms-war", undefined, sourceIds.nmaiTimeline, "indigenous-centered-institutional-account", "NMAI presents a Wampanoag-centered regional timeline from deep history through modern continuity.", "Native Knowledge 360°"],
  ["nmai-treaty", "NMAI treaty and harvest account", "historyroot-plymouth-event-peace-agreement", undefined, sourceIds.nmaiTreaty, "indigenous-centered-institutional-account", "NMAI examines the agreement's terms, asymmetries, and relationship to the harvest gathering.", "Native Knowledge 360°"],
  ["mashpee", "Mashpee Wampanoag contact timeline", "historyroot-plymouth-group-wampanoag", undefined, sourceIds.mashpeeCulture, "tribal-institutional-account", "The Mashpee Wampanoag Tribe frames contact as an ongoing process rather than a single encounter.", "Mashpee Wampanoag Tribe"],
  ["aquinnah", "Aquinnah Ancient Ways account", "historyroot-plymouth-person-epenow", undefined, sourceIds.aquinnahAncient, "tribal-institutional-account", "The Aquinnah tribal page presents Epenow's return and tribally attributed cultural traditions.", "Wampanoag Tribe of Gay Head (Aquinnah)"],
  ["uaine", "UAINE National Day of Mourning account", "historyroot-plymouth-event-national-day-mourning-1970", "historyroot-plymouth-person-wamsutta-frank-james", sourceIds.uaine, "indigenous-organizational-memory-account", "UAINE describes the origins, purposes, and continuing meaning of National Day of Mourning.", "United American Indians of New England"],
  ["cdc", "CDC epidemic hypothesis account", "historyroot-plymouth-event-great-dying", undefined, sourceIds.cdcEpidemic, "modern-scholarly-hypothesis", "Marr and Cathey review competing diagnoses and propose leptospirosis while emphasizing limits.", "Emerging Infectious Diseases 16.2"],
  ["nps-war", "NPS King Philip's War account", "historyroot-plymouth-event-metacoms-war", undefined, sourceIds.npsWar, "government-public-history-account", "NPS summarizes land pressure, refugee politics, Great Swamp, and regional escalation.", "Roger Williams National Memorial"],
  ["nps-swansea", "NPS Swansea conflict account", "historyroot-plymouth-event-swansea-attack", undefined, sourceIds.npsSwansea, "government-archeological-public-history-account", "NPS presents the executions and Swansea attack while noting uncertainty about Metacom's authorization.", "American Battlefield Protection Program"],
  ["church", "Benjamin Church war narrative", "historyroot-plymouth-work-church-war-narrative", undefined, sourceIds.church, "retrospective-english-war-account", "Church's 1716 narrative recounts his negotiations with Awashonks and Sakonnet people.", "Evans-TCP digital edition"],
  ["rock", "Pilgrim Hall Plymouth Rock analysis", "historyroot-plymouth-place-patuxet-plymouth", undefined, sourceIds.pilgrimHallRock, "museum-memory-analysis", "Pilgrim Hall distinguishes seventeenth-century silence from later oral tradition and patriotic memory.", "Pilgrim Hall Museum"],
  ["thanksgiving", "Plimoth Patuxet harvest-memory analysis", "historyroot-plymouth-event-harvest-gathering", undefined, sourceIds.plimothThanksgiving, "museum-multiperspectival-analysis", "Plimoth Patuxet emphasizes the thin contemporary record, distinct gratitude traditions, and diplomatic context.", "You Are The Historian"],
  ["mass-archives", "Massachusetts Archives transition account", "historyroot-plymouth-event-province-inaugurated", undefined, sourceIds.massArchives, "government-archival-account", "The Archives distinguishes the 1691 signature from the 1692 inauguration and explains institutional change.", "Massachusetts Archives overview"],
  ["plymouth-records", "Massachusetts Archives Plymouth records guide", "historyroot-plymouth-work-plymouth-records", undefined, sourceIds.plymouthRecords, "government-archival-register-account", "The Archives describes the surviving record series and its twelve published volumes.", "Massachusetts Archives guide"],
].map(([id, label, subjectId, authorEntityId, sourceId, accountType, content, publicationLabel]) => ({
  id: `historyroot-plymouth-account-${id}`,
  label,
  subjectId,
  ...(authorEntityId ? { authorEntityId } : {}),
  sourceId,
  accountType,
  content,
  publicationLabel,
  domain: DOMAIN,
  sourceIds: [sourceId],
  status,
  metadata: {
    attributedAccount: true,
    sourceLimitationRequired: true,
  },
}));

type ClaimRow = {
  id: string;
  label: string;
  account: string;
  subject: string;
  object?: string;
  type: string;
  statement: string;
  sources: string[];
  confidence: string;
  uncertainty?: string;
  locator: string;
  limitation: string;
};

const claimRows: ClaimRow[] = [
  { id: "wampanoag-deep-history", label: "Wampanoag presence predates Plymouth by millennia", account: "nmai-timeline", subject: "historyroot-plymouth-group-wampanoag", type: "historical-context", statement: "NMAI presents oral histories and archaeology as placing Wampanoag people in the region for thousands of years before English settlement.", sources: [sourceIds.nmaiTimeline], confidence: "strong", locator: "Timeline, 12,000+ Years Ago", limitation: "Educational synthesis; archaeological citations should be independently reviewed." },
  { id: "epenow-escape", label: "Epenow returned by escape", account: "aquinnah", subject: "historyroot-plymouth-person-epenow", object: "historyroot-plymouth-event-epenow-capture-return", type: "biographical-event", statement: "The Aquinnah tribal history recounts that Epenow escaped from an English vessel and returned to his relatives at Noepe.", sources: [sourceIds.aquinnahAncient], confidence: "moderate", locator: "Ancient Ways, Epenow section", limitation: "Tribal public history; precise voyage chronology needs specialist review." },
  { id: "hunt-kidnappings", label: "Hunt kidnapped Patuxet and Nauset men", account: "nmai-timeline", subject: "historyroot-plymouth-event-hunt-kidnappings", object: "historyroot-plymouth-person-tisquantum", type: "coercive-displacement", statement: "The NMAI timeline states that Thomas Hunt kidnapped twenty men from Patuxet, including Tisquantum, and seven from Nauset in 1614.", sources: [sourceIds.nmaiTimeline], confidence: "strong", locator: "Timeline, 1524-1615", limitation: "Educational synthesis; individual identities beyond Tisquantum are not reconstructed here." },
  { id: "epidemic-depopulation", label: "Epidemic caused catastrophic regional mortality", account: "nmai-timeline", subject: "historyroot-plymouth-event-great-dying", object: "historyroot-plymouth-group-wampanoag", type: "demographic-impact", statement: "Multiple inspected sources describe catastrophic mortality in Wampanoag and neighboring coastal communities during the 1616-1619 epidemics.", sources: [sourceIds.nmaiTimeline, sourceIds.cdcEpidemic, sourceIds.mashpeeCulture], confidence: "strong", uncertainty: "Local mortality estimates vary and should not be homogenized.", locator: "NMAI Timeline 1616-1620; CDC pp. 281-286; Mashpee contact timeline 1616", limitation: "Retrospective estimates vary; the dataset does not adopt a single percentage." },
  { id: "epidemic-diagnosis-uncertain", label: "The epidemic's diagnosis remains uncertain", account: "cdc", subject: "historyroot-plymouth-event-great-dying", type: "historical-epidemiology", statement: "The specific disease or diseases responsible for the 1616-1619 epidemic cannot be established from the surviving evidence; leptospirosis is one proposed hypothesis among several.", sources: [sourceIds.cdcEpidemic], confidence: "strong", uncertainty: "Competing diagnoses include smallpox, plague, yellow fever, and others.", locator: "CDC article pp. 281-286, especially limitations and conclusion", limitation: "The article is a retrospective hypothesis and expressly not a definite diagnosis." },
  { id: "tisquantum-travels-return", label: "Tisquantum's captivity created Atlantic experience", account: "nmai-timeline", subject: "historyroot-plymouth-person-tisquantum", object: "historyroot-plymouth-event-tisquantum-return", type: "biographical-sequence", statement: "After forced removal, Tisquantum lived within English Atlantic networks and returned to Wampanoag homelands with Thomas Dermer in 1619.", sources: [sourceIds.nmaiTimeline], confidence: "moderate", locator: "Timeline, 1616-1620", limitation: "The timeline compresses a complex travel history; exact routes and intervals need deeper review." },
  { id: "settlement-at-patuxet", label: "Plymouth was established at Patuxet", account: "nmai-timeline", subject: "historyroot-plymouth-event-plymouth-settlement", object: "historyroot-plymouth-place-patuxet-plymouth", type: "place-and-settlement", statement: "The English settlement called Plymouth was established at the Wampanoag village site of Patuxet after epidemic devastation.", sources: [sourceIds.nmaiTimeline, sourceIds.mashpeeCulture, sourceIds.bradford], confidence: "strong", locator: "NMAI Timeline 1620-1621; Mashpee timeline 1620; Bradford settlement sequence", limitation: "English descriptions of an 'empty' place must not erase Patuxet ownership, memory, or survivors." },
  { id: "compact-original-lost", label: "The original Mayflower Compact is lost", account: "compact-exhibit", subject: "historyroot-plymouth-document-mayflower-compact-original", object: "historyroot-plymouth-work-mayflower-compact-text", type: "document-survival", statement: "The signed original Mayflower Compact has not survived.", sources: [sourceIds.compactExhibit, sourceIds.compactLaw], confidence: "strong", locator: "LOC exhibit, The Mayflower Compact; LOC Law blog paragraphs 298-299", limitation: "Surviving texts are witnesses, not the original signed sheet." },
  { id: "mourts-earliest-witness", label: "Mourt's Relation is the earliest surviving Compact witness", account: "compact-law", subject: "historyroot-plymouth-document-mourts-1622", object: "historyroot-plymouth-work-mayflower-compact-text", type: "textual-witness", statement: "The 1622 Mourt's Relation is the earliest surviving document containing the Compact text.", sources: [sourceIds.compactExhibit, sourceIds.compactLaw, sourceIds.mourts], confidence: "strong", locator: "LOC exhibit paragraph 66; LOC Law blog paragraph 298; Mourt's Relation pp. 5-6", limitation: "Earliest surviving witness does not mean original manuscript." },
  { id: "compact-three-witnesses", label: "Three early Compact witnesses survive", account: "compact-law", subject: "historyroot-plymouth-work-mayflower-compact-text", type: "document-transmission", statement: "The inspected Library of Congress analysis identifies Mourt's Relation (1622), Purchas his Pilgrimes (1625), and Bradford's manuscript as three early textual witnesses.", sources: [sourceIds.compactLaw], confidence: "strong", locator: "LOC Law blog paragraphs 298-299", limitation: "This pilot records witness relationships but does not collate textual variants." },
  { id: "compact-immediate-function", label: "Compact addressed an immediate authority problem", account: "compact-exhibit", subject: "historyroot-plymouth-event-mayflower-compact", type: "political-function", statement: "The Compact joined signers into a civil body politic while the colony operated outside the geographic warrant of its patent.", sources: [sourceIds.compactExhibit, sourceIds.compactLaw, sourceIds.bradford], confidence: "strong", locator: "LOC exhibit paragraphs 65-66; LOC Law blog paragraphs 284-292; Bradford Compact passage", limitation: "It was an interim governing agreement, not a complete constitution or universal democratic compact." },
  { id: "compact-signers-scope", label: "Compact participation was restricted", account: "compact-law", subject: "historyroot-plymouth-event-mayflower-compact", object: "historyroot-plymouth-group-plymouth-colonists", type: "participation-scope", statement: "The Compact was signed by 41 of the roughly 50 adult men aboard, not by all passengers and not by Native people whose homeland was being entered.", sources: [sourceIds.compactLaw], confidence: "strong", locator: "LOC Law blog paragraph 289", limitation: "The familiar phrase 'the colonists agreed' can obscure exclusions from formal signature." },
  { id: "first-winter-mortality", label: "About half the Plymouth company died", account: "bradford", subject: "historyroot-plymouth-event-first-winter", object: "historyroot-plymouth-group-plymouth-colonists", type: "mortality", statement: "Bradford reports that about half the company died during the first winter amid scurvy, other disease, exposure, and inadequate housing.", sources: [sourceIds.bradford], confidence: "strong", locator: "EADA lines 2376-2386", limitation: "Bradford is retrospective and emphasizes providential meaning; exact medical diagnoses are limited." },
  { id: "samoset-contact", label: "Samoset opened English-language communication", account: "bradford", subject: "historyroot-plymouth-event-samoset-arrival", object: "historyroot-plymouth-person-samoset", type: "diplomatic-contact", statement: "Bradford reports that Samoset entered Plymouth in March 1621 and spoke in English learned through eastern fishing contacts.", sources: [sourceIds.bradford], confidence: "strong", locator: "EADA lines 2436-2451", limitation: "The description is solely through Bradford's account." },
  { id: "agreement-terms", label: "The 1621 agreement set reciprocal and asymmetric terms", account: "nmai-treaty", subject: "historyroot-plymouth-event-peace-agreement", object: "historyroot-plymouth-person-ousamequin", type: "diplomatic-agreement", statement: "The recorded agreement addressed injury, restitution, mutual defense, notification of allies, and weapons, while its punishment and weapons provisions could operate asymmetrically.", sources: [sourceIds.bradford, sourceIds.nmaiTreaty], confidence: "strong", locator: "Bradford EADA lines 2454-2475; NMAI Treaty and Harvest sections", limitation: "The surviving written terms are English-language records; Wampanoag understandings are not preserved in a contemporary Wampanoag document." },
  { id: "ousamequin-strategy", label: "Ousamequin integrated Plymouth into a regional network", account: "nmai-timeline", subject: "historyroot-plymouth-person-ousamequin", object: "historyroot-plymouth-group-plymouth-colonists", type: "diplomatic-strategy", statement: "NMAI interprets Ousamequin's alliance as a cautious decision to bring the newcomers into a Wampanoag network of relationships.", sources: [sourceIds.nmaiTimeline], confidence: "moderate", locator: "Timeline, 1620-1621", limitation: "Institutional interpretation; motives should remain plural and reviewable." },
  { id: "tisquantum-mediator", label: "Tisquantum provided crucial mediation and knowledge", account: "bradford", subject: "historyroot-plymouth-person-tisquantum", object: "historyroot-plymouth-group-plymouth-colonists", type: "mediation", statement: "Tisquantum served as interpreter, guide, and teacher for Plymouth, drawing on his language skills and local knowledge.", sources: [sourceIds.bradford, sourceIds.nmaiTimeline], confidence: "strong", locator: "Bradford EADA lines 2476-2481; NMAI Timeline 1620-1621", limitation: "Bradford's providential praise can flatten Tisquantum's own purposes and coercive history." },
  { id: "tisquantum-political-agency", label: "Tisquantum pursued an independent political position", account: "good-newes", subject: "historyroot-plymouth-person-tisquantum", object: "historyroot-plymouth-person-ousamequin", type: "political-agency", statement: "Winslow reports that Tisquantum used his access to Plymouth to increase his standing and alarm communities, provoking conflict with Ousamequin.", sources: [sourceIds.goodNewes], confidence: "moderate", uncertainty: "The account is Winslow's interpretation of Tisquantum's motives.", locator: "Good Newes, 1841 ed., pp. 24-26", limitation: "A hostile English assessment of motive; it must remain attributed, not stated as transparent fact." },
  { id: "harvest-three-days", label: "The 1621 harvest gathering lasted three days", account: "nmai-timeline", subject: "historyroot-plymouth-event-harvest-gathering", object: "historyroot-plymouth-person-ousamequin", type: "gathering", statement: "The surviving account describes a three-day gathering attended by Ousamequin and about ninety men, who contributed five deer.", sources: [sourceIds.mourts, sourceIds.nmaiTimeline], confidence: "strong", locator: "Mourt's Relation harvest passage; NMAI Timeline 1620-1621", limitation: "The account does not provide an exact date, full attendee list, or a contemporary Wampanoag description." },
  { id: "harvest-evidence-limits", label: "Evidence for the harvest gathering is thin and asymmetric", account: "thanksgiving", subject: "historyroot-plymouth-event-harvest-gathering", type: "source-criticism", statement: "Plimoth Patuxet identifies one surviving English eyewitness account and no contemporary Wampanoag historical record describing the gathering from a Wampanoag perspective.", sources: [sourceIds.plimothThanksgiving], confidence: "strong", locator: "You Are The Historian Unit 4, Key Idea 1", limitation: "Absence of a surviving written record is not absence of Wampanoag knowledge, memory, or interpretation." },
  { id: "harvest-diplomatic-context", label: "The harvest gathering had diplomatic context", account: "thanksgiving", subject: "historyroot-plymouth-event-harvest-gathering", object: "historyroot-plymouth-event-peace-agreement", type: "interpretive-context", statement: "The gathering can be situated within the season of diplomacy and political encounters between Pokanoket and Plymouth, not only as a later holiday origin story.", sources: [sourceIds.nmaiTreaty, sourceIds.plimothThanksgiving], confidence: "moderate", locator: "NMAI Treaty and Harvest; Plimoth Patuxet Unit 4 Key Idea 4", limitation: "This is a modern interpretation rather than a verbatim intention stated by all participants." },
  { id: "wessagusset-corn-theft", label: "Wessagusset theft and coercion damaged relations", account: "good-newes", subject: "historyroot-plymouth-event-wessagusset-crisis", object: "historyroot-plymouth-group-massachusett", type: "resource-conflict", statement: "Winslow and Bradford describe Wessagusset colonists stealing corn and considering force, contributing to fear and hostility.", sources: [sourceIds.goodNewes, sourceIds.bradford], confidence: "strong", locator: "Good Newes pp. 41-44; Bradford EADA lines 3367-3399", limitation: "English accounts dominate and frame Indigenous responses as conspiracy." },
  { id: "wessagusset-killings", label: "Standish's party killed Pecksuot and Wituwamat", account: "good-newes", subject: "historyroot-plymouth-event-wessagusset-killings", object: "historyroot-plymouth-person-myles-standish", type: "armed-violence", statement: "Winslow recounts that Standish's party killed Pecksuot, Wituwamat, another man, and a young captive during the Wessagusset operation.", sources: [sourceIds.goodNewes], confidence: "strong", locator: "Good Newes, 1841 ed., pp. 47-49", limitation: "The assailants' own narrative justifies the action as preemption and uses dehumanizing language." },
  { id: "wessagusset-head-display", label: "Wituwamat's head was displayed at Plymouth", account: "good-newes", subject: "historyroot-plymouth-event-wessagusset-killings", object: "historyroot-plymouth-person-wituwamat", type: "postmortem-violence", statement: "Winslow reports that Wituwamat's head was carried to Plymouth and displayed at the fort.", sources: [sourceIds.goodNewes], confidence: "strong", locator: "Good Newes, 1841 ed., pp. 50-51", limitation: "English account; the dataset avoids repeating spectacle beyond what is necessary to document the violence." },
  { id: "wessagusset-aftermath-attributed", label: "Winslow attributed regional flight and sickness to the killings", account: "good-newes", subject: "historyroot-plymouth-event-wessagusset-killings", object: "historyroot-plymouth-event-wessagusset-crisis", type: "attributed-consequence", statement: "Winslow attributed subsequent flight, disrupted planting, and deaths among nearby Native communities to fear following the killings.", sources: [sourceIds.goodNewes], confidence: "moderate", uncertainty: "This is Winslow's causal attribution, not independently established demographic analysis.", locator: "Good Newes, 1841 ed., pp. 51-52", limitation: "The source collapses complex events into providential explanation and is not an Indigenous account." },
  { id: "robinson-critique", label: "Robinson questioned the necessity and scale of the killings", account: "bradford", subject: "historyroot-plymouth-event-robinson-response", object: "historyroot-plymouth-event-wessagusset-killings", type: "contemporary-moral-critique", statement: "John Robinson's letter, preserved by Bradford, argued that necessity did not justify killing so many and warned that bloodshed could continue.", sources: [sourceIds.bradford], confidence: "strong", locator: "EADA lines 4217-4239", limitation: "The letter is preserved through Bradford's text; Robinson still writes within a colonial missionary framework." },
  { id: "merrymount-contested", label: "Merrymount combined cultural conflict and trade concerns", account: "bradford", subject: "historyroot-plymouth-event-merrymount-maypole", object: "historyroot-plymouth-person-thomas-morton", type: "settler-conflict", statement: "Bradford condemned Merrymount's Maypole celebrations and emphasized Morton's trade in firearms with Native people.", sources: [sourceIds.bradford], confidence: "strong", locator: "EADA lines 5381-5389", limitation: "Bradford was Morton's opponent; his moral language is partisan evidence, not neutral description." },
  { id: "merrymount-suppressed", label: "Colonial authorities suppressed Merrymount", account: "bradford", subject: "historyroot-plymouth-event-merrymount-suppression", object: "historyroot-plymouth-place-merrymount", type: "colonial-enforcement", statement: "Plymouth arrested Morton, and Massachusetts Bay authority later ordered the Maypole cut down.", sources: [sourceIds.bradford], confidence: "strong", locator: "EADA chapter 19, especially lines 5385 onward", limitation: "Bradford's narrative centers colonial legitimacy and does not recover all participants' views." },
  { id: "english-patent-not-native-consent", label: "English patent did not establish Native consent", account: "mass-archives", subject: "historyroot-plymouth-event-plymouth-patent", object: "historyroot-plymouth-jurisdiction-plymouth-colony", type: "legal-scope", statement: "The 1629 patent was an English grant of claimed jurisdiction; this dataset does not treat it as evidence that Wampanoag communities consented to English sovereignty or land title.", sources: [sourceIds.charter, sourceIds.plymouthRecords], confidence: "strong", locator: "Avalon 1629 patent metadata; Massachusetts Archives Plymouth records guide", limitation: "This is an editorial scope distinction; tribal legal-historical review is required." },
  { id: "land-pressure", label: "Colonial expansion constrained Wampanoag land use", account: "nmai-timeline", subject: "historyroot-plymouth-event-massachusetts-bay-expansion", object: "historyroot-plymouth-group-wampanoag", type: "land-and-power", statement: "NMAI describes expanding settlements, livestock, fields, deeds, and courts as restricting access to Wampanoag hunting, gathering, fishing, and homelands.", sources: [sourceIds.nmaiTimeline], confidence: "strong", locator: "Timeline, 1622-1640s through 1640s-1660s", limitation: "Regional synthesis; local deeds and community-specific experiences require record-level review." },
  { id: "wamsutta-succession", label: "Wamsutta succeeded Ousamequin", account: "nmai-timeline", subject: "historyroot-plymouth-person-wamsutta", object: "historyroot-plymouth-person-ousamequin", type: "leadership-succession", statement: "After Ousamequin's death, Wamsutta became sachem amid increasing conflict over land and colonial authority.", sources: [sourceIds.nmaiTimeline], confidence: "strong", locator: "Timeline, 1660s-1670s", limitation: "Succession and governance should be reviewed with Wampanoag historians rather than mapped to European monarchy." },
  { id: "wamsutta-death-suspicion", label: "Wamsutta's death generated suspicion", account: "nmai-timeline", subject: "historyroot-plymouth-event-wamsutta-court-death", object: "historyroot-plymouth-person-metacom", type: "contested-death", statement: "NMAI reports that Wampanoag leaders suspected English poisoning after Wamsutta was compelled to Plymouth and died soon afterward.", sources: [sourceIds.nmaiTimeline], confidence: "moderate", uncertainty: "Suspicion is historically significant; poisoning is not asserted as proven.", locator: "Timeline, 1660s-1670s", limitation: "The date varies across chronologies, and the cause of death remains contested." },
  { id: "metacom-alliance-building", label: "Metacom strengthened regional alliances", account: "nmai-timeline", subject: "historyroot-plymouth-person-metacom", object: "historyroot-plymouth-event-metacoms-war", type: "political-leadership", statement: "NMAI presents Metacom as strengthening Wampanoag and neighboring alliances in defense of homelands before and during the war.", sources: [sourceIds.nmaiTimeline], confidence: "moderate", locator: "Timeline, 1660s-1670s and 1675-1676", limitation: "Alliances were dynamic; the record should not imply unified command over every action." },
  { id: "weetamoo-leadership", label: "Weetamoo was a major wartime leader", account: "nmai-timeline", subject: "historyroot-plymouth-person-weetamoo", object: "historyroot-plymouth-event-metacoms-war", type: "political-and-military-leadership", statement: "NMAI identifies Weetamoo, saunkskwa of Pocasset, as a key alliance-builder and wartime leader.", sources: [sourceIds.nmaiTimeline], confidence: "strong", locator: "Timeline, 1675-1676", limitation: "Concise synthesis; community-specific sources should deepen her political biography." },
  { id: "awashonks-diplomacy", label: "Awashonks negotiated Sakonnet wartime choices", account: "church", subject: "historyroot-plymouth-person-awashonks", object: "historyroot-plymouth-event-awashonks-peace-negotiation", type: "diplomacy-and-leadership", statement: "Church's account depicts Awashonks negotiating a break with Metacom's alliance and terms for Sakonnet participation with Plymouth.", sources: [sourceIds.church], confidence: "moderate", locator: "Entertaining Passages, 1716 ed., pp. 22-28", limitation: "Retrospective English military narrative; Awashonks's words and choices are mediated through Church." },
  { id: "war-multiple-causes", label: "Metacom's War had multiple interacting causes", account: "nps-war", subject: "historyroot-plymouth-event-metacoms-war", type: "causal-complexity", statement: "Institutional sources connect the war to colonial land expansion, contested authority, intertribal politics, reciprocal fear, hostile incidents, and the immediate crisis after Sassamon's death and the executions.", sources: [sourceIds.npsWar, sourceIds.npsSwansea, sourceIds.nmaiTimeline], confidence: "strong", locator: "NPS King Philip's War paragraphs 50-54; NPS Swansea paragraphs 47-49; NMAI timeline", limitation: "No single cause is treated as sufficient, and named actors did not form two internally unified blocs." },
  { id: "war-outbreak-uncertain-command", label: "The Swansea attack may not have had Metacom's authorization", account: "nps-swansea", subject: "historyroot-plymouth-event-swansea-attack", object: "historyroot-plymouth-person-metacom", type: "contested-command", statement: "The NPS Swansea project notes that the opening attack may have begun without Metacom's permission.", sources: [sourceIds.npsSwansea], confidence: "moderate", uncertainty: "Command responsibility remains uncertain in the inspected source.", locator: "NPS Swansea article paragraph 48", limitation: "Short public-history project overview; further primary-source comparison is required." },
  { id: "great-swamp-escalation", label: "Great Swamp attack changed Narragansett participation", account: "nps-war", subject: "historyroot-plymouth-event-great-swamp-attack", object: "historyroot-plymouth-group-narragansett", type: "war-escalation", statement: "NPS states that the colonial attack on the Narragansett winter settlement prompted Narragansett entry into the war.", sources: [sourceIds.npsWar], confidence: "strong", locator: "NPS King Philip's War paragraphs 52-55", limitation: "Casualty totals are approximate and the page is a concise institutional narrative." },
  { id: "war-native-enslavement", label: "War survivors faced killing and enslavement", account: "nmai-timeline", subject: "historyroot-plymouth-event-war-enslavement-displacement", object: "historyroot-plymouth-group-wampanoag", type: "war-consequence", statement: "NMAI states that Native survivors were killed, captured, sold into slavery, displaced, pressured to assimilate, or confined.", sources: [sourceIds.nmaiTimeline], confidence: "strong", locator: "Timeline, 1675-1676 and aftermath", limitation: "The regional summary does not enumerate every community, destination, or legal disposition." },
  { id: "war-not-simple-binary", label: "The war was not a simple English-versus-Indigenous binary", account: "nps-war", subject: "historyroot-plymouth-event-metacoms-war", type: "coalition-complexity", statement: "The conflict involved multiple Native nations, English colonies, Native allies of English forces, refugees, neutral parties, and shifting coalitions.", sources: [sourceIds.npsWar, sourceIds.church, sourceIds.nmaiTimeline], confidence: "strong", locator: "NPS war overview; Church pp. 22-28; NMAI timeline", limitation: "This high-level formulation requires expansion with community-specific records." },
  { id: "charter-annexed-plymouth", label: "The 1691 charter incorporated Plymouth", account: "mass-archives", subject: "historyroot-plymouth-event-charter-signed", object: "historyroot-plymouth-jurisdiction-plymouth-colony", type: "jurisdictional-transition", statement: "The charter signed by William and Mary on 7 October 1691 incorporated Plymouth Colony into the Province of Massachusetts Bay.", sources: [sourceIds.charter, sourceIds.massArchives], confidence: "strong", locator: "Avalon 1691 Charter; Massachusetts Archives lines 277-280", limitation: "Signature created the legal instrument; local implementation followed in 1692." },
  { id: "charter-implementation-1692", label: "Provincial government was inaugurated in 1692", account: "mass-archives", subject: "historyroot-plymouth-event-province-inaugurated", object: "historyroot-plymouth-jurisdiction-province-massachusetts-bay", type: "institutional-implementation", statement: "Massachusetts Archives dates inauguration of the Province government in Boston to 14 May 1692, distinct from the charter's 1691 signature.", sources: [sourceIds.massArchives], confidence: "strong", locator: "Massachusetts Archives lines 277-283", limitation: "Related milestones include Phips's swearing-in; the dataset distinguishes rather than collapses them." },
  { id: "plymouth-records-scope", label: "Plymouth records survive in a multi-volume series", account: "plymouth-records", subject: "historyroot-plymouth-work-plymouth-records", type: "archival-survival", statement: "Massachusetts Archives describes a twelve-volume transcription series containing court orders, judicial acts, laws, deeds, and other Plymouth records.", sources: [sourceIds.plymouthRecords], confidence: "strong", locator: "Massachusetts Archives Plymouth records guide, volume list", limitation: "The register was inspected; record-level claims require consulting specific volumes and pages." },
  { id: "rock-absent-early-accounts", label: "Plymouth Rock is absent from the early landing accounts", account: "rock", subject: "historyroot-plymouth-place-patuxet-plymouth", type: "memory-source-criticism", statement: "Pilgrim Hall notes that neither Bradford nor Mourt's Relation identifies a rock in describing the 1620 landing.", sources: [sourceIds.pilgrimHallRock], confidence: "strong", locator: "History of Plymouth Rock, Plymouth Rock in the 17th Century", limitation: "Silence does not disprove every oral tradition, but it prevents treating the Rock landing as contemporaneously documented." },
  { id: "rock-later-tradition", label: "Plymouth Rock's landing story developed through later tradition", account: "rock", subject: "historyroot-plymouth-place-patuxet-plymouth", type: "cultural-memory-development", statement: "The landing-place identification appears through eighteenth-century oral tradition and later print, then acquired patriotic meaning.", sources: [sourceIds.pilgrimHallRock], confidence: "strong", locator: "History of Plymouth Rock, 1741 tradition and Revolutionary sections", limitation: "The tradition's chain of transmission contains unavoidable evidentiary gaps." },
  { id: "compact-memory-development", label: "The Compact acquired later national political meanings", account: "compact-law", subject: "historyroot-plymouth-work-mayflower-compact-text", type: "cultural-memory-development", statement: "The Law Library of Congress traces the Compact's elevation in American political memory to competing late-eighteenth- and early-nineteenth-century interpretations.", sources: [sourceIds.compactLaw], confidence: "strong", locator: "LOC Law blog paragraphs 293-297", limitation: "Later symbolic uses should not be projected unchanged back onto 1620." },
  { id: "thanksgiving-later-holiday", label: "The 1621 gathering became a national origin story later", account: "thanksgiving", subject: "historyroot-plymouth-event-harvest-gathering", type: "cultural-memory-development", statement: "Museum interpretation distinguishes the 1621 gathering from the later development of the national Thanksgiving narrative.", sources: [sourceIds.plimothThanksgiving], confidence: "strong", locator: "You Are The Historian Unit 4 and linked memory materials", limitation: "The cultural history extends beyond this dataset's core period and is represented selectively." },
  { id: "national-day-mourning-origin", label: "National Day of Mourning began in 1970", account: "uaine", subject: "historyroot-plymouth-event-national-day-mourning-1970", object: "historyroot-plymouth-person-wamsutta-frank-james", type: "commemorative-history", statement: "UAINE identifies the rejected speech of Wamsutta Frank James and the 1970 Cole's Hill gathering as the origin of the continuing National Day of Mourning.", sources: [sourceIds.uaine, sourceIds.nmaiTimeline], confidence: "strong", locator: "UAINE homepage and Historical Information; NMAI Timeline 1900-present", limitation: "This is an explicitly attributed Indigenous activist and commemorative perspective." },
  { id: "wampanoag-continuity", label: "Wampanoag communities remain living nations", account: "nmai-timeline", subject: "historyroot-plymouth-group-wampanoag", type: "community-continuity", statement: "Tribal and NMAI sources document continuing Wampanoag governments, cultural practices, remembrance, and language reclamation.", sources: [sourceIds.nmaiTimeline, sourceIds.mashpeeCulture, sourceIds.aquinnahAncient], confidence: "strong", locator: "NMAI Timeline 1900-present; tribal culture pages", limitation: "This pilot includes only a small selection of living communities and must not imply exhaustive representation." },
];

const claims = claimRows.map((claim) => ({
  id: `historyroot-plymouth-claim-${claim.id}`,
  label: claim.label,
  accountId: `historyroot-plymouth-account-${claim.account}`,
  subjectId: claim.subject,
  ...(claim.object ? { objectId: claim.object } : {}),
  claimType: claim.type,
  statement: claim.statement,
  confidence: claim.confidence,
  ...(claim.uncertainty ? { uncertainty: claim.uncertainty } : {}),
  domain: DOMAIN,
  sourceIds: claim.sources,
  status,
  metadata: {
    locator: claim.locator,
    evidenceLimitation: claim.limitation,
    substantiveClaim: true,
    reviewRequired: true,
  },
}));

const evidence = claimRows.map((claim) => ({
  id: `historyroot-plymouth-evidence-${claim.id}`,
  label: `Evidence for: ${claim.label}`,
  claimId: `historyroot-plymouth-claim-${claim.id}`,
  evidenceType: "evidence",
  sourceId: claim.sources[0],
  accountId: `historyroot-plymouth-account-${claim.account}`,
  explanation: `${claim.locator}. Evidence limit: ${claim.limitation}`,
  strength: claim.confidence === "strong" ? "strong" : "moderate",
  confidence: claim.confidence,
  domain: DOMAIN,
  sourceIds: claim.sources,
  status,
  metadata: {
    locator: claim.locator,
    limitation: claim.limitation,
    supportsClaimId: `historyroot-plymouth-claim-${claim.id}`,
  },
}));

type InterpretationRow = {
  id: string;
  label: string;
  subject: string;
  account: string;
  source: string;
  text: string;
  confidence: string;
  uncertainty: string;
  perspective: string;
};

const interpretationRows: InterpretationRow[] = [
  { id: "ousamequin-strategic-alliance", label: "Ousamequin's alliance as regional strategy", subject: "historyroot-plymouth-event-peace-agreement", account: "nmai-timeline", source: sourceIds.nmaiTimeline, text: "The agreement is best treated as Ousamequin's strategic incorporation of a vulnerable newcomer community into existing regional politics, not as uncomplicated welcome.", confidence: "moderate", uncertainty: "Motives are reconstructed through institutional synthesis and English records.", perspective: "nmai" },
  { id: "agreement-asymmetry", label: "Mutual language and asymmetric power", subject: "historyroot-plymouth-event-peace-agreement", account: "nmai-treaty", source: sourceIds.nmaiTreaty, text: "Reciprocal promises coexisted with terms and later practices that could privilege English jurisdiction and armed mobility.", confidence: "moderate", uncertainty: "Implementation varied and Wampanoag understandings are not preserved in a contemporary written account.", perspective: "nmai" },
  { id: "tisquantum-complex-mediator", label: "Tisquantum as indispensable and self-directed mediator", subject: "historyroot-plymouth-person-tisquantum", account: "good-newes", source: sourceIds.goodNewes, text: "Tisquantum's mediation joined coerced Atlantic experience, Patuxet knowledge, service to Plymouth, and attempts to build personal political leverage.", confidence: "moderate", uncertainty: "His intentions are filtered through English observers.", perspective: "winslow" },
  { id: "harvest-diplomacy-not-tableau", label: "Harvest gathering as diplomacy rather than static tableau", subject: "historyroot-plymouth-event-harvest-gathering", account: "thanksgiving", source: sourceIds.plimothThanksgiving, text: "The gathering is more responsibly interpreted within an active diplomatic relationship, with major gaps in knowledge, than as a fully documented modern Thanksgiving scene.", confidence: "moderate", uncertainty: "Only one English eyewitness account survives.", perspective: "public-memory" },
  { id: "wessagusset-turning-point", label: "Wessagusset as an escalation in colonial violence", subject: "historyroot-plymouth-event-wessagusset-killings", account: "good-newes", source: sourceIds.goodNewes, text: "The 1623 killings linked resource conflict, intelligence claims, preemptive violence, intimidation, and wider regional fear.", confidence: "moderate", uncertainty: "Indigenous accounts of the event do not survive in the inspected record.", perspective: "winslow" },
  { id: "robinson-internal-dissent", label: "Robinson shows contemporary English dissent", subject: "historyroot-plymouth-event-robinson-response", account: "bradford", source: sourceIds.bradford, text: "Robinson's criticism demonstrates that Plymouth's justification of the killings was not the only contemporary English moral assessment.", confidence: "strong", uncertainty: "The critique remains within a missionary colonial worldview.", perspective: "robinson" },
  { id: "merrymount-conflict", label: "Merrymount conflict had cultural, commercial, and security dimensions", subject: "historyroot-plymouth-event-merrymount-suppression", account: "bradford", source: sourceIds.bradford, text: "Bradford's moral denunciation should be separated from concrete colonial concerns about trade, firearms, authority, and competition.", confidence: "moderate", uncertainty: "The pilot has not inspected Morton's counter-narrative, New English Canaan.", perspective: "bradford" },
  { id: "war-multicausal", label: "Metacom's War requires multi-causal explanation", subject: "historyroot-plymouth-event-metacoms-war", account: "nps-war", source: sourceIds.npsWar, text: "Land loss, colonial jurisdiction, intercommunity politics, prior violence, fear, diplomacy, and immediate triggering events interacted; no single-cause label is adequate.", confidence: "strong", uncertainty: "Relative weight differed across communities and moments.", perspective: "nmai" },
  { id: "women-leadership", label: "Weetamoo and Awashonks demonstrate distinct women's leadership", subject: "historyroot-plymouth-person-weetamoo", account: "nmai-timeline", source: sourceIds.nmaiTimeline, text: "Weetamoo's and Awashonks's different wartime choices should be represented as separate exercises of political leadership, not a single gendered or unified Indigenous position.", confidence: "strong", uncertainty: "Their biographies need further community-specific review.", perspective: "nmai" },
  { id: "charter-two-stage-transition", label: "Plymouth's political end was a two-stage transition", subject: "historyroot-plymouth-event-charter-signed", account: "mass-archives", source: sourceIds.massArchives, text: "The 1691 signature and 1692 inauguration should remain distinct so legal creation is not confused with operational implementation.", confidence: "strong", uncertainty: "Additional local administrative changes continued after inauguration.", perspective: "imperial-legal" },
  { id: "compact-function-memory", label: "Compact's immediate function differs from later civic memory", subject: "historyroot-plymouth-work-mayflower-compact-text", account: "compact-law", source: sourceIds.compactLaw, text: "The Compact's 1620 role as an interim association should be distinguished from later claims that made it a national democratic origin document.", confidence: "strong", uncertainty: "Later interpretations are selective and politically situated.", perspective: "public-memory" },
  { id: "rock-memory-object", label: "Plymouth Rock is historically important as memory even when landing proof is absent", subject: "historyroot-plymouth-place-patuxet-plymouth", account: "rock", source: sourceIds.pilgrimHallRock, text: "The Rock's evidentiary weakness as a documented landing point coexists with a well-documented later history as a patriotic and commemorative object.", confidence: "strong", uncertainty: "Oral-tradition claims cannot be definitively confirmed or dismissed.", perspective: "public-memory" },
];

const interpretations = interpretationRows.map((item) => ({
  id: `historyroot-plymouth-interpretation-${item.id}`,
  label: item.label,
  subjectId: item.subject,
  accountId: `historyroot-plymouth-account-${item.account}`,
  sourceId: item.source,
  interpretation: item.text,
  confidence: item.confidence,
  uncertainty: item.uncertainty,
  publishedConclusion: false,
  domain: DOMAIN,
  sourceIds: [item.source],
  status,
  metadata: {
    attributionKind: "editorial-synthesis",
    reviewRequired: true,
    perspectiveId: `historyroot-plymouth-perspective-${item.perspective}`,
  },
}));

type CausalRow = {
  id: string;
  cause: string;
  effect: string;
  kind: "cause" | "consequence";
  explanation: string;
  sources: string[];
  confidence: string;
  uncertainty: string;
  attribution: string;
};

const causalRows: CausalRow[] = [
  { id: "epidemic-patuxet-context", cause: "historyroot-plymouth-event-great-dying", effect: "historyroot-plymouth-event-plymouth-settlement", kind: "cause", explanation: "Epidemic devastation was a major enabling context for English occupation of Patuxet, without converting catastrophe into legitimate consent or title.", sources: [sourceIds.nmaiTimeline, sourceIds.cdcEpidemic], confidence: "moderate", uncertainty: "One contextual condition among voyage, colonizing plans, and local decisions.", attribution: "editorial synthesis from NMAI and CDC" },
  { id: "kidnapping-atlantic-travels", cause: "historyroot-plymouth-event-hunt-kidnappings", effect: "historyroot-plymouth-event-tisquantum-atlantic-captivity", kind: "cause", explanation: "Hunt's kidnapping forced Tisquantum into Atlantic captivity and travel.", sources: [sourceIds.nmaiTimeline], confidence: "strong", uncertainty: "Later stages of the route remain compressed.", attribution: "NMAI timeline" },
  { id: "travels-mediation", cause: "historyroot-plymouth-event-tisquantum-atlantic-captivity", effect: "historyroot-plymouth-event-tisquantum-mediation", kind: "cause", explanation: "English-language and Atlantic experience contributed to Tisquantum's later mediating capacity.", sources: [sourceIds.nmaiTimeline, sourceIds.bradford], confidence: "moderate", uncertainty: "Local knowledge and political choice were also essential.", attribution: "editorial synthesis from NMAI and Bradford" },
  { id: "patent-gap-compact", cause: "historyroot-plymouth-event-cape-cod-arrival", effect: "historyroot-plymouth-event-mayflower-compact", kind: "cause", explanation: "Arrival outside the intended patent's geographic warrant contributed to the decision to form an interim civil association.", sources: [sourceIds.compactExhibit, sourceIds.compactLaw], confidence: "strong", uncertainty: "Concerns over internal faction also contributed.", attribution: "Library of Congress interpretation" },
  { id: "winter-conditions-mortality", cause: "historyroot-plymouth-event-plymouth-settlement", effect: "historyroot-plymouth-event-first-winter", kind: "cause", explanation: "Late-season settlement, inadequate housing, voyage-related illness, and winter conditions contributed to mortality.", sources: [sourceIds.bradford], confidence: "strong", uncertainty: "Individual medical causes cannot always be determined.", attribution: "Bradford account with editorial qualification" },
  { id: "agreement-cooperation", cause: "historyroot-plymouth-event-peace-agreement", effect: "historyroot-plymouth-event-tisquantum-mediation", kind: "cause", explanation: "The diplomatic agreement created a framework within which mediators and exchanges operated.", sources: [sourceIds.bradford, sourceIds.nmaiTimeline], confidence: "moderate", uncertainty: "Mediation also preceded and shaped the agreement.", attribution: "editorial relational inference" },
  { id: "wessagusset-theft-tension", cause: "historyroot-plymouth-event-wessagusset-crisis", effect: "historyroot-plymouth-event-wessagusset-killings", kind: "cause", explanation: "Resource theft, hunger, threats, and mutual fear formed the immediate context for Plymouth's preemptive operation.", sources: [sourceIds.goodNewes, sourceIds.bradford], confidence: "moderate", uncertainty: "English allegations of a coordinated plot cannot be independently verified here.", attribution: "English accounts, explicitly qualified" },
  { id: "wessagusset-killings-fear", cause: "historyroot-plymouth-event-wessagusset-killings", effect: "historyroot-plymouth-event-robinson-response", kind: "consequence", explanation: "News of the killings prompted Robinson's contemporary moral criticism.", sources: [sourceIds.bradford], confidence: "strong", uncertainty: "The timing of the surviving letter needs edition review.", attribution: "Bradford's preserved letter" },
  { id: "firearms-suppression", cause: "historyroot-plymouth-event-merrymount-maypole", effect: "historyroot-plymouth-event-merrymount-suppression", kind: "cause", explanation: "Bradford connected moral disorder and firearms trade to colonial action against Merrymount.", sources: [sourceIds.bradford], confidence: "moderate", uncertainty: "Bradford's partisan account may overstate or selectively frame motives.", attribution: "Bradford's attributed explanation" },
  { id: "expansion-land-pressure", cause: "historyroot-plymouth-event-massachusetts-bay-expansion", effect: "historyroot-plymouth-event-metacoms-war", kind: "cause", explanation: "Settlement expansion and land pressure contributed materially to the deterioration of relations that preceded war.", sources: [sourceIds.nmaiTimeline, sourceIds.npsWar], confidence: "strong", uncertainty: "Not a sufficient cause by itself.", attribution: "NMAI and NPS synthesis" },
  { id: "wamsutta-mistrust", cause: "historyroot-plymouth-event-wamsutta-court-death", effect: "historyroot-plymouth-event-metacom-leadership", kind: "consequence", explanation: "Wamsutta's compelled appearance and disputed death deepened mistrust as Metacom assumed leadership.", sources: [sourceIds.nmaiTimeline], confidence: "moderate", uncertainty: "The causal effect is interpretive; the cause of death is unresolved.", attribution: "NMAI timeline with editorial qualification" },
  { id: "executions-swansea", cause: "historyroot-plymouth-event-sassamon-trial-executions", effect: "historyroot-plymouth-event-swansea-attack", kind: "cause", explanation: "The executions formed the immediate crisis preceding the Swansea attack and wider war.", sources: [sourceIds.npsSwansea], confidence: "moderate", uncertainty: "Long-term tensions and autonomous local choices also mattered.", attribution: "NPS project summary" },
  { id: "swansea-war", cause: "historyroot-plymouth-event-swansea-attack", effect: "historyroot-plymouth-event-metacoms-war", kind: "cause", explanation: "The Swansea attack marked the outbreak of open warfare in the Plymouth-Wampanoag core theater.", sources: [sourceIds.npsSwansea], confidence: "strong", uncertainty: "The source cautions that the attack may not have been authorized by Metacom.", attribution: "NPS project summary" },
  { id: "great-swamp-narragansett", cause: "historyroot-plymouth-event-great-swamp-attack", effect: "historyroot-plymouth-event-metacoms-war", kind: "cause", explanation: "The Great Swamp attack helped transform Narragansett neutrality into participation in the war.", sources: [sourceIds.npsWar], confidence: "strong", uncertainty: "Narragansett decisions had additional political and humanitarian contexts.", attribution: "NPS interpretation" },
  { id: "war-deaths", cause: "historyroot-plymouth-event-metacoms-war", effect: "historyroot-plymouth-event-metacom-death", kind: "consequence", explanation: "The war culminated in Metacom's death during the collapse of the southern resistance.", sources: [sourceIds.nmaiTimeline, sourceIds.church], confidence: "strong", uncertainty: "Church's war narrative is retrospective and partisan.", attribution: "NMAI and Church" },
  { id: "war-enslavement", cause: "historyroot-plymouth-event-metacoms-war", effect: "historyroot-plymouth-event-war-enslavement-displacement", kind: "consequence", explanation: "War generated mass death, captivity, enslavement, displacement, and coercive postwar restructuring.", sources: [sourceIds.nmaiTimeline], confidence: "strong", uncertainty: "Consequences varied by community and extended beyond 1676.", attribution: "NMAI timeline" },
  { id: "charter-inauguration", cause: "historyroot-plymouth-event-charter-signed", effect: "historyroot-plymouth-event-province-inaugurated", kind: "consequence", explanation: "The signed 1691 charter supplied the legal basis for the Province government inaugurated in 1692.", sources: [sourceIds.charter, sourceIds.massArchives], confidence: "strong", uncertainty: "Implementation involved additional commissions and local administrative steps.", attribution: "charter and Massachusetts Archives chronology" },
  { id: "later-memory-rock", cause: "historyroot-plymouth-event-plymouth-settlement", effect: "historyroot-plymouth-event-national-day-mourning-1970", kind: "consequence", explanation: "Centuries of heroic Plymouth commemoration helped create the public-memory setting against which National Day of Mourning intervened.", sources: [sourceIds.pilgrimHallRock, sourceIds.uaine], confidence: "moderate", uncertainty: "This is a long-range cultural-memory relationship, not a direct single cause.", attribution: "editorial synthesis from Pilgrim Hall and UAINE" },
];

const causalLinks = causalRows.map((item) => ({
  id: `historyroot-plymouth-causal-${item.id}`,
  label: item.explanation.slice(0, 100),
  causeId: item.cause,
  effectId: item.effect,
  causalKind: item.kind,
  explanation: item.explanation,
  confidence: item.confidence,
  uncertainty: item.uncertainty,
  domain: DOMAIN,
  sourceIds: item.sources,
  status,
  metadata: {
    attributionKind: "qualified-causal-link",
    attributedTo: item.attribution,
    notDeterministic: true,
    reviewRequired: true,
  },
}));

type RelationshipRow = [
  string,
  string,
  string,
  string,
  string,
  string[],
  string?,
];

const relationshipRows: RelationshipRow[] = [
  ["ousamequin-pokanoket", "historyroot-plymouth-person-ousamequin", "historyroot-plymouth-group-pokanoket", "leader_of", "Ousamequin was a leading Pokanoket sachem.", [sourceIds.nmaiTimeline, sourceIds.bradford]],
  ["wamsutta-pokanoket", "historyroot-plymouth-person-wamsutta", "historyroot-plymouth-group-pokanoket", "leader_of", "Wamsutta succeeded to Pokanoket leadership.", [sourceIds.nmaiTimeline]],
  ["metacom-pokanoket", "historyroot-plymouth-person-metacom", "historyroot-plymouth-group-pokanoket", "leader_of", "Metacom became a principal Pokanoket leader.", [sourceIds.nmaiTimeline]],
  ["weetamoo-pocasset", "historyroot-plymouth-person-weetamoo", "historyroot-plymouth-group-pocasset", "leader_of", "Weetamoo was saunkskwa of Pocasset.", [sourceIds.nmaiTimeline]],
  ["awashonks-sakonnet", "historyroot-plymouth-person-awashonks", "historyroot-plymouth-group-sakonnet", "leader_of", "Awashonks was saunkskwa of the Sakonnet.", [sourceIds.church]],
  ["tisquantum-patuxet", "historyroot-plymouth-person-tisquantum", "historyroot-plymouth-group-patuxet", "member_of", "Tisquantum was a Patuxet man.", [sourceIds.nmaiTimeline, sourceIds.bradford]],
  ["aspinet-nauset", "historyroot-plymouth-person-aspinet", "historyroot-plymouth-group-nauset", "leader_of", "Aspinet was identified as a Nauset sachem.", [sourceIds.goodNewes]],
  ["corbitant-pocasset", "historyroot-plymouth-person-corbitant", "historyroot-plymouth-group-pocasset", "leader_of", "Corbitant is identified with Pocasset leadership in the inspected account.", [sourceIds.goodNewes]],
  ["wampanoag-pokanoket", "historyroot-plymouth-group-pokanoket", "historyroot-plymouth-group-wampanoag", "community_within", "Pokanoket is represented as a Wampanoag political community.", [sourceIds.nmaiTimeline]],
  ["wampanoag-patuxet", "historyroot-plymouth-group-patuxet", "historyroot-plymouth-group-wampanoag", "community_within", "Patuxet is represented as a Wampanoag community.", [sourceIds.nmaiTimeline]],
  ["wampanoag-nauset", "historyroot-plymouth-group-nauset", "historyroot-plymouth-group-wampanoag", "community_within", "Nauset is represented as a Wampanoag community.", [sourceIds.nmaiTimeline]],
  ["wampanoag-pocasset", "historyroot-plymouth-group-pocasset", "historyroot-plymouth-group-wampanoag", "community_within", "Pocasset is represented as a Wampanoag community.", [sourceIds.nmaiTimeline]],
  ["wampanoag-sakonnet", "historyroot-plymouth-group-sakonnet", "historyroot-plymouth-group-wampanoag", "community_within", "Sakonnet is represented as a Wampanoag community.", [sourceIds.church]],
  ["patuxet-place", "historyroot-plymouth-group-patuxet", "historyroot-plymouth-place-patuxet-plymouth", "homeland_at", "Patuxet community is linked to the Patuxet/Plymouth place.", [sourceIds.nmaiTimeline, sourceIds.mashpeeCulture]],
  ["nauset-place", "historyroot-plymouth-group-nauset", "historyroot-plymouth-place-nauset", "homeland_at", "Nauset community is linked to Nauset territory.", [sourceIds.nmaiTimeline]],
  ["pokanoket-sowams", "historyroot-plymouth-group-pokanoket", "historyroot-plymouth-place-sowams", "homeland_at", "Pokanoket leadership is linked to Sowams/Pokanoket.", [sourceIds.goodNewes, sourceIds.bradford]],
  ["pocasset-place", "historyroot-plymouth-group-pocasset", "historyroot-plymouth-place-pocasset", "homeland_at", "Pocasset community is linked to Pocasset homeland.", [sourceIds.church]],
  ["sakonnet-place", "historyroot-plymouth-group-sakonnet", "historyroot-plymouth-place-sakonnet", "homeland_at", "Sakonnet community is linked to Sakonnet homeland.", [sourceIds.church]],
  ["hunt-kidnapped-tisquantum", "historyroot-plymouth-person-thomas-hunt", "historyroot-plymouth-person-tisquantum", "kidnapped", "Thomas Hunt kidnapped Tisquantum in 1614.", [sourceIds.nmaiTimeline]],
  ["dermer-return-tisquantum", "historyroot-plymouth-person-thomas-dermer", "historyroot-plymouth-person-tisquantum", "transported_with", "Tisquantum returned to Wampanoag homelands with Thomas Dermer.", [sourceIds.nmaiTimeline]],
  ["samoset-introduced-tisquantum", "historyroot-plymouth-person-samoset", "historyroot-plymouth-person-tisquantum", "introduced", "Bradford's account links Samoset's visit to Tisquantum's later arrival.", [sourceIds.bradford]],
  ["ousamequin-agreement", "historyroot-plymouth-person-ousamequin", "historyroot-plymouth-event-peace-agreement", "participant_in", "Ousamequin was a principal party to the 1621 agreement.", [sourceIds.bradford, sourceIds.nmaiTimeline]],
  ["carver-agreement", "historyroot-plymouth-person-john-carver", "historyroot-plymouth-event-peace-agreement", "participant_in", "Carver represented Plymouth in the agreement-making sequence.", [sourceIds.bradford]],
  ["tisquantum-agreement", "historyroot-plymouth-person-tisquantum", "historyroot-plymouth-event-peace-agreement", "interpreter_at", "Tisquantum participated in early diplomacy and interpretation.", [sourceIds.bradford]],
  ["hobbamock-mediation", "historyroot-plymouth-person-hobbamock", "historyroot-plymouth-event-tisquantum-mediation", "parallel_mediator", "Hobbamock also lived near Plymouth and acted in diplomacy.", [sourceIds.goodNewes, sourceIds.nmaiTimeline]],
  ["harvest-ousamequin", "historyroot-plymouth-person-ousamequin", "historyroot-plymouth-event-harvest-gathering", "participant_in", "Ousamequin attended the harvest gathering.", [sourceIds.mourts, sourceIds.nmaiTimeline]],
  ["harvest-pokanoket", "historyroot-plymouth-group-pokanoket", "historyroot-plymouth-event-harvest-gathering", "participant_in", "About ninety men accompanying Ousamequin participated.", [sourceIds.mourts, sourceIds.nmaiTimeline]],
  ["harvest-plymouth", "historyroot-plymouth-group-plymouth-colonists", "historyroot-plymouth-event-harvest-gathering", "participant_in", "Plymouth colonists hosted the harvest gathering.", [sourceIds.mourts]],
  ["settlement-place", "historyroot-plymouth-event-plymouth-settlement", "historyroot-plymouth-place-patuxet-plymouth", "occurred_at", "The settlement was built at Patuxet.", [sourceIds.nmaiTimeline, sourceIds.bradford]],
  ["settlement-jurisdiction", "historyroot-plymouth-event-plymouth-settlement", "historyroot-plymouth-jurisdiction-plymouth-colony", "established", "The settlement became the center of Plymouth Colony.", [sourceIds.plymouthRecords]],
  ["mayflower-arrival-cape", "historyroot-plymouth-event-cape-cod-arrival", "historyroot-plymouth-place-provincetown-harbor", "occurred_at", "The Mayflower anchored in Cape Cod/Provincetown Harbor.", [sourceIds.compactLaw, sourceIds.mashpeeCulture]],
  ["compact-at-harbor", "historyroot-plymouth-event-mayflower-compact", "historyroot-plymouth-place-provincetown-harbor", "occurred_at", "The Compact was agreed aboard ship in Cape Cod Harbor.", [sourceIds.compactLaw]],
  ["compact-created-original", "historyroot-plymouth-event-mayflower-compact", "historyroot-plymouth-document-mayflower-compact-original", "created_document", "The signing event created the now-lost original document.", [sourceIds.compactExhibit, sourceIds.compactLaw]],
  ["original-realizes-text", "historyroot-plymouth-document-mayflower-compact-original", "historyroot-plymouth-work-mayflower-compact-text", "embodied_work", "The lost signed document embodied the Compact text.", [sourceIds.compactLaw]],
  ["mourts-witness", "historyroot-plymouth-document-mourts-1622", "historyroot-plymouth-work-mayflower-compact-text", "textual_witness_of", "Mourt's Relation is the earliest surviving Compact witness.", [sourceIds.compactLaw, sourceIds.mourts], "earliest-surviving"],
  ["purchas-witness", "historyroot-plymouth-document-purchas-1625", "historyroot-plymouth-work-mayflower-compact-text", "textual_witness_of", "Purchas his Pilgrimes preserves another early copy.", [sourceIds.compactLaw], "second-early-witness"],
  ["bradford-witness", "historyroot-plymouth-document-bradford-manuscript", "historyroot-plymouth-work-mayflower-compact-text", "textual_witness_of", "Bradford's manuscript preserves a further early copy.", [sourceIds.compactLaw, sourceIds.bradfordManuscript], "manuscript-witness"],
  ["bradford-authored-manuscript", "historyroot-plymouth-person-william-bradford", "historyroot-plymouth-document-bradford-manuscript", "author_of", "Bradford authored the manuscript over multiple years.", [sourceIds.bradfordManuscript, sourceIds.compactLaw]],
  ["winslow-good-newes", "historyroot-plymouth-person-edward-winslow", "historyroot-plymouth-work-good-newes", "author_of", "Winslow authored Good Newes.", [sourceIds.goodNewes]],
  ["bradford-mourts", "historyroot-plymouth-person-william-bradford", "historyroot-plymouth-work-mourts-relation", "contributor_to", "Library of Congress metadata attributes Mourt's Relation to Bradford and Winslow.", [sourceIds.mourts]],
  ["winslow-mourts", "historyroot-plymouth-person-edward-winslow", "historyroot-plymouth-work-mourts-relation", "contributor_to", "Library of Congress metadata attributes Mourt's Relation to Bradford and Winslow.", [sourceIds.mourts]],
  ["weston-wessagusset", "historyroot-plymouth-person-thomas-weston", "historyroot-plymouth-group-wessagusset-colonists", "sponsor_of", "Weston sponsored the Wessagusset colonists.", [sourceIds.bradford, sourceIds.goodNewes]],
  ["wessagusset-at-place", "historyroot-plymouth-group-wessagusset-colonists", "historyroot-plymouth-place-wessagusset", "settled_at", "Weston's colony was located at Wessagusset.", [sourceIds.goodNewes]],
  ["standish-led-killings", "historyroot-plymouth-person-myles-standish", "historyroot-plymouth-event-wessagusset-killings", "led", "Standish led the Wessagusset operation.", [sourceIds.goodNewes]],
  ["pecksuot-killed", "historyroot-plymouth-person-pecksuot", "historyroot-plymouth-event-wessagusset-killings", "killed_in", "Pecksuot was killed in the Wessagusset violence.", [sourceIds.goodNewes]],
  ["wituwamat-killed", "historyroot-plymouth-person-wituwamat", "historyroot-plymouth-event-wessagusset-killings", "killed_in", "Wituwamat was killed in the Wessagusset violence.", [sourceIds.goodNewes]],
  ["robinson-criticized", "historyroot-plymouth-person-john-robinson", "historyroot-plymouth-event-wessagusset-killings", "criticized", "Robinson criticized the necessity and scale of the killings.", [sourceIds.bradford]],
  ["morton-merrymount", "historyroot-plymouth-person-thomas-morton", "historyroot-plymouth-place-merrymount", "associated_with", "Morton led the Merrymount community in Bradford's account.", [sourceIds.bradford]],
  ["merrymount-event-place", "historyroot-plymouth-event-merrymount-maypole", "historyroot-plymouth-place-merrymount", "occurred_at", "The Maypole celebration occurred at Merrymount.", [sourceIds.bradford]],
  ["wamsutta-metacom-siblings", "historyroot-plymouth-person-wamsutta", "historyroot-plymouth-person-metacom", "sibling_of", "Wamsutta and Metacom were sons of Ousamequin.", [sourceIds.nmaiTimeline]],
  ["ousamequin-wamsutta-parent", "historyroot-plymouth-person-ousamequin", "historyroot-plymouth-person-wamsutta", "parent_of", "Wamsutta was Ousamequin's older son.", [sourceIds.nmaiTimeline]],
  ["ousamequin-metacom-parent", "historyroot-plymouth-person-ousamequin", "historyroot-plymouth-person-metacom", "parent_of", "Metacom was Ousamequin's younger son.", [sourceIds.nmaiTimeline]],
  ["sassamon-death-trial", "historyroot-plymouth-event-sassamon-death", "historyroot-plymouth-event-sassamon-trial-executions", "preceded", "Sassamon's death preceded the colonial trial and executions.", [sourceIds.npsSwansea]],
  ["executions-preceded-swansea", "historyroot-plymouth-event-sassamon-trial-executions", "historyroot-plymouth-event-swansea-attack", "preceded", "The executions preceded the Swansea attack.", [sourceIds.npsSwansea]],
  ["swansea-part-war", "historyroot-plymouth-event-swansea-attack", "historyroot-plymouth-event-metacoms-war", "opening_event_of", "The Swansea attack marked the opening of war in the core theater.", [sourceIds.npsSwansea]],
  ["metacom-led-war", "historyroot-plymouth-person-metacom", "historyroot-plymouth-event-metacoms-war", "leader_in", "Metacom was a central Wampanoag leader in the war.", [sourceIds.nmaiTimeline, sourceIds.npsWar]],
  ["weetamoo-led-war", "historyroot-plymouth-person-weetamoo", "historyroot-plymouth-event-metacoms-war", "leader_in", "Weetamoo was a central Pocasset leader in the war.", [sourceIds.nmaiTimeline]],
  ["awashonks-war", "historyroot-plymouth-person-awashonks", "historyroot-plymouth-event-metacoms-war", "negotiated_during", "Awashonks made consequential alliance decisions during the war.", [sourceIds.church]],
  ["narragansett-great-swamp", "historyroot-plymouth-group-narragansett", "historyroot-plymouth-event-great-swamp-attack", "targeted_in", "Narragansett people were attacked at the Great Swamp settlement.", [sourceIds.npsWar]],
  ["great-swamp-war", "historyroot-plymouth-event-great-swamp-attack", "historyroot-plymouth-event-metacoms-war", "major_event_of", "The Great Swamp attack was a major escalation in the war.", [sourceIds.npsWar]],
  ["metacom-death-war", "historyroot-plymouth-person-metacom", "historyroot-plymouth-event-metacom-death", "subject_of", "The event records Metacom's death.", [sourceIds.nmaiTimeline, sourceIds.church]],
  ["weetamoo-death-war", "historyroot-plymouth-person-weetamoo", "historyroot-plymouth-event-weetamoo-death", "subject_of", "The event records Weetamoo's death.", [sourceIds.nmaiTimeline]],
  ["war-enslavement", "historyroot-plymouth-event-metacoms-war", "historyroot-plymouth-event-war-enslavement-displacement", "followed_by", "Mass captivity and displacement followed and accompanied the war.", [sourceIds.nmaiTimeline]],
  ["charter-document-event", "historyroot-plymouth-document-charter-1691", "historyroot-plymouth-event-charter-signed", "issued_in", "The charter document was issued in the 1691 signing event.", [sourceIds.charter, sourceIds.massArchives]],
  ["charter-created-province", "historyroot-plymouth-document-charter-1691", "historyroot-plymouth-jurisdiction-province-massachusetts-bay", "established", "The charter established the Province's legal framework.", [sourceIds.charter, sourceIds.massArchives]],
  ["plymouth-incorporated", "historyroot-plymouth-jurisdiction-plymouth-colony", "historyroot-plymouth-jurisdiction-province-massachusetts-bay", "incorporated_into", "Plymouth Colony was incorporated into the Province.", [sourceIds.massArchives, sourceIds.charter]],
  ["mass-bay-incorporated", "historyroot-plymouth-jurisdiction-massachusetts-bay", "historyroot-plymouth-jurisdiction-province-massachusetts-bay", "incorporated_into", "Massachusetts Bay Colony was incorporated into the Province.", [sourceIds.massArchives, sourceIds.charter]],
  ["inauguration-boston", "historyroot-plymouth-event-province-inaugurated", "historyroot-plymouth-place-boston", "occurred_at", "The Province government was inaugurated in Boston.", [sourceIds.massArchives]],
  ["phips-inauguration", "historyroot-plymouth-person-william-phips", "historyroot-plymouth-event-province-inaugurated", "governor_at_transition", "Phips arrived as the royal governor during the transition.", [sourceIds.massArchives]],
  ["frank-james-ndom", "historyroot-plymouth-person-wamsutta-frank-james", "historyroot-plymouth-event-national-day-mourning-1970", "initiated", "James's rejected speech and leadership helped initiate the gathering.", [sourceIds.uaine, sourceIds.nmaiTimeline]],
  ["ndom-coles-hill", "historyroot-plymouth-event-national-day-mourning-1970", "historyroot-plymouth-place-coles-hill", "occurred_at", "The gathering took place at Cole's Hill.", [sourceIds.uaine]],
];

const relationships = relationshipRows.map(
  ([id, fromId, toId, relationshipType, explanation, recordSourceIds, relationshipRole]) => ({
    id: `historyroot-plymouth-relationship-${id}`,
    label: explanation,
    fromId,
    toId,
    relationshipType,
    ...(relationshipRole ? { relationshipRole } : {}),
    explanation,
    confidence: "moderate",
    uncertainty:
      "Relationship is source-grounded but remains subject to historical and tribal review.",
    domain: DOMAIN,
    sourceIds: recordSourceIds,
    status,
    metadata: {
      attributionKind: "source-grounded-editorial-linkage",
      reviewRequired: true,
    },
  }),
);

const culturalMemories = [
  {
    id: "historyroot-plymouth-memory-first-thanksgiving",
    label: "The First Thanksgiving origin narrative",
    subjectId: "historyroot-plymouth-event-harvest-gathering",
    perspectiveId: "historyroot-plymouth-perspective-public-memory",
    sourceId: sourceIds.plimothThanksgiving,
    memoryType: "national-origin-narrative",
    narrative: "The autumn 1621 gathering was later transformed into a national 'First Thanksgiving' story whose familiar details exceed the thin contemporary record.",
    periodLabel: "Nineteenth century to present",
    domain: DOMAIN,
    sourceIds: [sourceIds.plimothThanksgiving],
    status,
    metadata: { attributedTo: "Plimoth Patuxet Museums historical-memory analysis", reviewRequired: true },
  },
  {
    id: "historyroot-plymouth-memory-plymouth-rock",
    label: "Plymouth Rock landing tradition",
    subjectId: "historyroot-plymouth-place-patuxet-plymouth",
    perspectiveId: "historyroot-plymouth-perspective-public-memory",
    sourceId: sourceIds.pilgrimHallRock,
    memoryType: "place-based-origin-tradition",
    narrative: "Plymouth Rock became a powerful landing and patriotic symbol through eighteenth-century tradition and later commemoration despite silence in the seventeenth-century landing accounts.",
    periodLabel: "1741 to present",
    domain: DOMAIN,
    sourceIds: [sourceIds.pilgrimHallRock],
    status,
    metadata: { attributedTo: "Pilgrim Hall Museum analysis", evidentiaryStatus: "later-tradition-not-contemporary-proof" },
  },
  {
    id: "historyroot-plymouth-memory-compact-democracy",
    label: "Mayflower Compact as democratic origin",
    subjectId: "historyroot-plymouth-work-mayflower-compact-text",
    perspectiveId: "historyroot-plymouth-perspective-public-memory",
    sourceId: sourceIds.compactLaw,
    memoryType: "civic-origin-narrative",
    narrative: "Later political writers elevated the Compact into a national origin story; that memory should remain distinct from its narrower 1620 function and restricted signatory body.",
    periodLabel: "Late eighteenth century to present",
    domain: DOMAIN,
    sourceIds: [sourceIds.compactLaw],
    status,
    metadata: { attributedTo: "Law Library of Congress analysis", reviewRequired: true },
  },
  {
    id: "historyroot-plymouth-memory-heroic-pilgrim",
    label: "Heroic Pilgrim founding narrative",
    subjectId: "historyroot-plymouth-event-plymouth-settlement",
    perspectiveId: "historyroot-plymouth-perspective-public-memory",
    sourceId: sourceIds.pilgrimHallRock,
    memoryType: "heroic-settler-origin-narrative",
    narrative: "Commemorative traditions often center providential survival, liberty, and heroic settlement while minimizing Patuxet homeland, epidemic catastrophe, coercion, and later colonial violence.",
    periodLabel: "Eighteenth century to present",
    domain: DOMAIN,
    sourceIds: [sourceIds.pilgrimHallRock, sourceIds.compactLaw, sourceIds.uaine],
    status,
    metadata: { attributionKind: "editorial-synthesis", reviewRequired: true },
  },
  {
    id: "historyroot-plymouth-memory-national-day-mourning",
    label: "National Day of Mourning counter-memory",
    subjectId: "historyroot-plymouth-event-national-day-mourning-1970",
    perspectiveId: "historyroot-plymouth-perspective-uaine",
    sourceId: sourceIds.uaine,
    memoryType: "indigenous-counter-commemoration",
    narrative: "UAINE frames National Day of Mourning as remembrance, spiritual connection, protest, and affirmation of Native survival against celebratory colonial mythology.",
    periodLabel: "1970 to present",
    domain: DOMAIN,
    sourceIds: [sourceIds.uaine],
    status,
    metadata: { attributedTo: "United American Indians of New England", reviewRequired: true },
  },
  {
    id: "historyroot-plymouth-memory-wampanoag-continuity",
    label: "Wampanoag continuity and resurgence",
    subjectId: "historyroot-plymouth-group-wampanoag",
    perspectiveId: "historyroot-plymouth-perspective-nmai",
    sourceId: sourceIds.nmaiTimeline,
    memoryType: "community-continuity",
    narrative: "Wampanoag governments, gatherings, cultural practices, activism, land stewardship, and language reclamation contradict narratives that end Native history in the colonial period.",
    periodLabel: "Seventeenth century to present",
    domain: DOMAIN,
    sourceIds: [sourceIds.nmaiTimeline, sourceIds.mashpeeCulture, sourceIds.aquinnahAncient],
    status,
    metadata: { attributedTo: "NMAI and named tribal institutions", reviewRequired: true },
  },
];

const recordPerspectives = [
  ...interpretationRows.map((item) => ({
    recordId: `historyroot-plymouth-interpretation-${item.id}`,
    perspectiveId: `historyroot-plymouth-perspective-${item.perspective}`,
    stance: "attributed-interpretation",
    notes: "Attribution is explicit; this link does not imply a unified community view.",
  })),
  {
    recordId: "historyroot-plymouth-claim-epidemic-diagnosis-uncertain",
    perspectiveId: "historyroot-plymouth-perspective-epidemiology",
    stance: "scholarly-hypothesis",
    notes: "The diagnosis is expressly unresolved.",
  },
  {
    recordId: "historyroot-plymouth-claim-national-day-mourning-origin",
    perspectiveId: "historyroot-plymouth-perspective-uaine",
    stance: "organizational-memory",
    notes: "Attributed to UAINE.",
  },
  {
    recordId: "historyroot-plymouth-claim-wampanoag-continuity",
    perspectiveId: "historyroot-plymouth-perspective-mashpee",
    stance: "tribal-continuity",
    notes: "One specifically attributed tribal institutional source among several.",
  },
  {
    recordId: "historyroot-plymouth-claim-epenow-escape",
    perspectiveId: "historyroot-plymouth-perspective-aquinnah",
    stance: "tribal-public-history",
    notes: "Attributed to the Aquinnah tribal history page.",
  },
  {
    recordId: "historyroot-plymouth-claim-wessagusset-killings",
    perspectiveId: "historyroot-plymouth-perspective-winslow",
    stance: "primary-account",
    notes: "The account and its justifications are attributed to Winslow.",
  },
  {
    recordId: "historyroot-plymouth-claim-robinson-critique",
    perspectiveId: "historyroot-plymouth-perspective-robinson",
    stance: "contemporary-dissent",
    notes: "Robinson's criticism survives through Bradford.",
  },
];

const bundle = {
  bundleId: BUNDLE_ID,
  bundleType: "sourceroot-import-bundle",
  version: "1.0.0",
  domain: DOMAIN,
  createdAt: "2026-07-23T12:00:00.000Z",
  createdBy: "SourceRoot HistoryRoot Plymouth knowledge dataset v1",
  description: `${DISCLAIMER} Focused on Plymouth and regional relationships, 1616-1691, with limited background and memory afterlife.`,
  nodes: [],
  assertions: [],
  edges: [],
  sources,
  revisions: [],
  context: {
    entities,
    temporalAssertions: eventRows.map(temporalAssertion),
    accounts,
    claims,
    evidence,
    interpretations,
    perspectives,
    recordPerspectives,
    causalLinks,
    relationships,
    culturalMemories,
  },
  extensions: {
    datasetId: "historyroot-plymouth-v1",
    disclaimer: DISCLAIMER,
    corePeriod: { start: "1616", end: "1691" },
    backgroundPeriod: { start: "1605", end: "1615", use: "only where needed" },
    transitionBoundary: {
      charterSigned: "1691-10-07",
      provinceInaugurated: "1692-05-14",
    },
    outOfScope: [
      { topic: "Complete Mayflower passenger genealogy", reason: "Outside the focused contextual mission." },
      { topic: "Complete town-by-town colonial chronology", reason: "Requires a broader regional dataset." },
      { topic: "Definitive tribal territorial boundaries", reason: "Would require community-led and cartographic review; no invented polygons or coordinates are supplied." },
      { topic: "Definitive diagnosis of the 1616-1619 epidemic", reason: "The evidence supports competing hypotheses, not a settled diagnosis." },
      { topic: "Complete military chronology after 1676", reason: "The core Plymouth-Wampanoag theater ends in 1676; connected northern fighting extended later." },
    ],
  },
};

function countByType() {
  const entityCount = (type: string) =>
    entities.filter((item) => item.entityType === type).length;
  return {
    people: entityCount("person"),
    groups:
      entityCount("group")
      + entityCount("organization")
      + entityCount("cultural_community"),
    places: entityCount("place"),
    events: entityCount("event"),
    documentsAndWorks: entityCount("document") + entityCount("work"),
    politicalJurisdictions: entityCount("political_jurisdiction"),
    sources: sources.length,
    temporalAssertions: eventRows.length,
    accounts: accounts.length,
    claims: claims.length,
    evidence: evidence.length,
    interpretations: interpretations.length,
    perspectives: perspectives.length,
    perspectiveLinks: recordPerspectives.length,
    causalLinks: causalLinks.length,
    relationships: relationships.length,
    culturalMemories: culturalMemories.length,
    contextualRecords:
      entities.length
      + eventRows.length
      + accounts.length
      + claims.length
      + evidence.length
      + interpretations.length
      + perspectives.length
      + causalLinks.length
      + relationships.length
      + culturalMemories.length,
  };
}

const counts = countByType();

const manifest = {
  datasetId: "historyroot-plymouth-v1",
  bundleId: BUNDLE_ID,
  version: "1.0.0",
  title: "HistoryRoot Plymouth Knowledge Dataset v1",
  disclaimer: DISCLAIMER,
  generatedOn: REVIEW_DATE,
  bundleFile: "historyroot-plymouth-v1.bundle.json",
  sourceRegisterFile: "source-register.json",
  claimEvidenceMatrixFile: "claim-evidence-matrix.json",
  reviewFiles: [
    "open-questions-and-gaps.md",
    "historical-review-guide.md",
  ],
  chronologicalScope: {
    core: "1616-1691",
    background: "Approximately 1605-1615 only where needed",
    transition: "1692 implementation of the 1691 Province charter",
    memoryAfterlife: "Selected later commemorative developments only",
  },
  counts,
  minimums: {
    people: 15,
    groups: 6,
    places: 12,
    events: 20,
    sources: 12,
    claims: 30,
    evidence: 15,
    relationships: 40,
    interpretationsOrPerspectives: 8,
    causalLinks: 12,
    culturalMemories: 4,
  },
  targets: {
    people: [20, 35],
    groups: [6, 12],
    places: [15, 25],
    events: [25, 45],
    sources: [12, 25],
    relationships: [50, 90],
    claims: [35, 70],
    evidence: [20, 50],
    interpretations: [8, 20],
    perspectives: [6, 15],
    causalLinks: [15, 35],
    culturalMemories: [4, 10],
  },
  sourcePolicy: {
    detailedClaimsRequire: "accessed-and-inspected",
    statuses: [
      "accessed-and-inspected",
      "metadata-verified-not-inspected",
      "bibliographic-only",
      "inaccessible",
      "rejected",
    ],
  },
  schemaDecision:
    "No migration is required. The domain-neutral contextual foundation represents the dataset through existing entity, temporal, account, claim, evidence, interpretation, perspective, causal, relationship, cultural-memory, and source structures.",
};

const sourceRegister = {
  datasetId: manifest.datasetId,
  reviewedOn: REVIEW_DATE,
  policy:
    "Only sources marked accessed-and-inspected may support detailed claims. Other statuses may establish identity, bibliography, gaps, or future review tasks.",
  sources: sources.map((item) => ({
    id: item.id,
    name: item.name,
    publisher: item.publisher,
    sourceClass: item.sourceClass,
    citation: item.citation,
    url: item.url,
    accessStatus: item.accessStatus,
    accessDate: item.accessDate,
    locatorsInspected: item.locatorsInspected,
    limitations: item.limitations,
    supportsDetailedClaims: item.supportsDetailedClaims,
    license: item.license,
    licenseStatus: item.licenseStatus,
  })),
  consideredButNotUsed: [
    {
      id: "historyroot-plymouth-candidate-fisher-surrenderers",
      name: "Why Shall Wee Have Peace to Bee Made Slaves: Indian Surrenderers During and After King Philip's War",
      accessStatus: "metadata-verified-not-inspected",
      reason:
        "Search metadata was verified, but automated access presented a challenge page. It is listed for specialist review and does not support dataset claims.",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5654607/",
    },
    {
      id: "historyroot-plymouth-candidate-sargent-compact-myth",
      name: "The Conservative Covenant: The Rise of the Mayflower Compact in American Myth",
      accessStatus: "bibliographic-only",
      reason:
        "Bibliographic details were encountered through the Library of Congress essay, but the article itself was not inspected.",
    },
    {
      id: "historyroot-plymouth-candidate-unsourced-popular-pages",
      name: "Unsourced or weakly sourced popular summaries",
      accessStatus: "rejected",
      reason:
        "Rejected where claims could instead be grounded in primary texts, tribal institutions, archives, museums, government sources, or inspected scholarship.",
    },
  ],
};

const claimEvidenceMatrix = {
  datasetId: manifest.datasetId,
  generatedOn: REVIEW_DATE,
  claims: claimRows.map((claim) => ({
    claimId: `historyroot-plymouth-claim-${claim.id}`,
    evidenceIds: [`historyroot-plymouth-evidence-${claim.id}`],
    accountId: `historyroot-plymouth-account-${claim.account}`,
    sourceIds: claim.sources,
    locator: claim.locator,
    limitation: claim.limitation,
    reviewRequired: true,
  })),
};

const openQuestions = `# HistoryRoot Plymouth v1: open questions and gaps

${DISCLAIMER}

## Highest-priority review

- Seek review from appropriate Wampanoag historians, cultural offices, and knowledge keepers before treating naming, political relationships, community descriptions, or cultural-memory framing as publication-ready.
- Reconcile the 1661/1662 chronologies for Wamsutta's compelled appearance and death using record-level scholarship and Plymouth Colony records.
- Inspect record-level sources for Awashonks's 1671 negotiations, Weetamoo's political activity, land deeds, court jurisdiction, and the legal disposition of Native captives.
- Collate the three early Mayflower Compact witnesses and record material textual variants; the current dataset models witness identity but not a critical edition.
- Expand source balance beyond surviving English narratives for Wessagusset and Merrymount. Thomas Morton's New English Canaan was not inspected in this pilot.

## Evidence limits to retain

- Do not replace the uncertain 1616-1619 epidemic diagnosis with a definitive disease label.
- Do not convert English descriptions of an epidemic-struck or temporarily unoccupied Patuxet into a claim of land without owners, memory, or political relationships.
- Do not infer exact dates where sources provide only seasons, years, or conflicting calendar conventions.
- Do not present NMAI, Mashpee, Aquinnah, or UAINE as one generic "Indigenous perspective"; keep every perspective attributed.
- Do not present the 1621 harvest gathering as fully reconstructed. One English eyewitness account survives, and the pilot has no contemporary Wampanoag written account.
- Do not present "King Philip's War" as a simple binary conflict or a single-cause event.

## Coverage intentionally deferred

- Comprehensive Mayflower passenger prosopography and genealogy.
- Complete land-deed graph and parcel geography.
- Full Plymouth court chronology and all town foundations.
- Complete Pequot War, praying-town, and northern 1676-1678 war datasets.
- Definitive modern tribal boundary mapping or coordinates.
`;

const historicalReviewGuide = `# Historical review guide

${DISCLAIMER}

Reviewers should evaluate the dataset as a structured source-and-claim map, not as a finished narrative.

## Tribal and community review

1. Confirm canonical names, aliases, diacritics, community relationships, and distinctions among Wampanoag, Pokanoket, Patuxet, Nauset, Pocasset, Sakonnet, Massachusett, and Narragansett records.
2. Assess whether descriptions reproduce colonial categories or imply political unity where sources show distinct communities and decisions.
3. Review all perspectives and cultural-memory records for accurate attribution and appropriate limits.
4. Identify culturally sensitive material that should be revised, restricted, or removed.

## Historical and editorial review

1. Open each source-register entry and verify citation metadata, inspected locators, access status, rights notes, and limitations.
2. Check every row in the claim-evidence matrix against the cited locator.
3. Distinguish event, later account, edition, transcription, and modern interpretation.
4. Preserve Old Style calendar labels and approximate/range semantics; do not silently normalize historical dates.
5. Confirm that causal links remain qualified and attributed.
6. Treat the 1691 charter signature and 1692 inauguration as separate events.
7. Review Wessagusset, Merrymount, Wamsutta's death, the outbreak of war, and wartime enslavement as high-risk topics.

## Release decision

- A passing machine verifier establishes structural integrity, target coverage, import lifecycle behavior, and regression safety.
- It does not prove historical accuracy.
- Publication requires explicit historical, editorial, rights, and tribal review decisions recorded outside this pilot bundle.
`;

async function writeJson(fileName: string, value: unknown) {
  await writeFile(
    path.join(outputDirectory, fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8",
  );
}

async function generate() {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeJson("historyroot-plymouth-v1.bundle.json", bundle),
    writeJson("manifest.json", manifest),
    writeJson("source-register.json", sourceRegister),
    writeJson("claim-evidence-matrix.json", claimEvidenceMatrix),
    writeFile(
      path.join(outputDirectory, "open-questions-and-gaps.md"),
      openQuestions,
      "utf8",
    ),
    writeFile(
      path.join(outputDirectory, "historical-review-guide.md"),
      historicalReviewGuide,
      "utf8",
    ),
  ]);

  console.log("Generated HistoryRoot Plymouth Knowledge Dataset v1.");
  console.log(`Output: ${outputDirectory}`);
  console.log(JSON.stringify(counts, null, 2));
}

generate().catch((error: unknown) => {
  console.error("HistoryRoot Plymouth dataset generation failed:", error);
  process.exitCode = 1;
});
