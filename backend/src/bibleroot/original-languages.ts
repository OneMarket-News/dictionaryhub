import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const ORIGINAL_LANGUAGE_DATA_DIRECTORY = path.resolve(
  moduleDirectory,
  "../../data/bibleroot-original-language-foundation-v1",
);
export const ORIGINAL_LANGUAGE_DATASET_ID =
  "br-dataset-original-language-foundation-v1";
export const ORIGINAL_LANGUAGE_DATASET_VERSION = "1.0.0";
export const OSHB_EDITION_ID = "br-ol-edition-oshb-wlc-v2-2";
export const NESTLE1904_EDITION_ID = "br-ol-edition-nestle1904-rel-1-3";

export type AnalysisStatus =
  | "analyzed"
  | "not_yet_analyzed"
  | "ambiguous";
export type MappingType =
  | "one_to_one"
  | "shifted"
  | "split"
  | "merged"
  | "omitted_or_untranslated"
  | "disputed";

export interface SourceArtifactIdentity {
  artifactId: string;
  publicationId: string;
  sourceId: string;
  sourceRepository: string;
  immutableRef: string;
  commitSha: string;
  repositoryPath: string;
  retrievalMethod: string;
  rawFilename: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  sourceUrl: string;
  retrievedAt: string;
  rightsStatus: string;
  rightsStatement: string;
  territorialLimitation: string;
  parsingRules: string;
}

export interface OriginalLanguageEdition {
  editionId: string;
  language: "he" | "grc";
  displayTitle: string;
  abbreviation: string;
  versionIdentity: string;
  immutableSourceRef: string;
  publicationId: string;
  artifactIds: string[];
  description: string;
}

export interface OriginalLanguageVerse {
  sourceVerseId: string;
  editionId: string;
  artifactId: string;
  sourceBook: string;
  sourceChapter: number;
  sourceVerseIdentifier: string;
  sourceNativeCitation: string;
  sourceNativeVersification: string;
  surfaceText: string;
  sourcerootIdentity: string;
}

export interface OriginalLanguageToken {
  tokenId: string;
  sourceNativeTokenId: string | null;
  editionId: string;
  sourceVerseId: string;
  artifactId: string;
  sequencePosition: number;
  surfaceForm: string;
  lemma: {
    verbatim: string | null;
    sourceNativeIdentifier: string | null;
    analysisStatus: AnalysisStatus;
  };
  morphologies: Array<{
    verbatimCode: string | null;
    morphologySystem: string;
    analysisStatus: AnalysisStatus;
  }>;
}

export interface VerseMapping {
  mappingId: string;
  sourceVerseId: string;
  targetCanonicalReferenceId: string | null;
  mappingType: MappingType;
  explanation: string;
  evidenceSource: string;
  reviewStatus: "reviewed";
}

export interface RightsComponent {
  componentId: string;
  artifactId: string;
  componentType: string;
  rightsStatus: string;
  licenseName: string | null;
  licenseUrl: string | null;
  rightsStatement: string;
  attribution: string;
  territorialLimitation: string;
  evidenceDocument: string;
}

export interface OriginalLanguageSourceMetadata {
  schemaVersion: "1.0.0";
  datasetId: string;
  retrievedAt: string;
  sources: Array<{
    sourceId: string;
    publicationId: string;
    title: string;
    provider: string;
    stableIdentifier: string;
    publicationDate: string | null;
    description: string;
    repository: string;
    immutableRef: string;
    commitSha: string;
    documentation: string[];
  }>;
  documents: Array<{
    sourceId: string;
    repositoryPath: string;
    preservedPath: string;
    byteLength: number;
    sha256: string;
  }>;
  artifacts: SourceArtifactIdentity[];
}

export interface OriginalLanguageManifest {
  schemaVersion: "1.0.0";
  datasetId: string;
  version: string;
  status: "bounded-read-only";
  normalizedDatasetSha256: string;
  expectedCounts: {
    editions: number;
    sourceArtifacts: number;
    sourceVerses: number;
    tokens: number;
    tokensByLanguage: Record<string, number>;
    tokensByChapter: Record<string, number>;
    lemmas: number;
    morphologies: number;
    missingAnalysis: number;
    ambiguousAnalysis: number;
    mappings: number;
    mappingTypes: Record<string, number>;
  };
  files: Record<string, string>;
}

export interface OriginalLanguageDataset {
  manifest: OriginalLanguageManifest;
  sourceMetadata: OriginalLanguageSourceMetadata;
  editions: OriginalLanguageEdition[];
  verses: OriginalLanguageVerse[];
  tokens: OriginalLanguageToken[];
  mappings: VerseMapping[];
  rightsComponents: RightsComponent[];
}

const ARTIFACTS: SourceArtifactIdentity[] = [
  {
    artifactId: "br-artifact-oshb-gen-v2-2",
    publicationId: "br-publication-oshb-v2-2",
    sourceId: "br-source-oshb-v2-2",
    sourceRepository: "https://github.com/openscriptures/morphhb.git",
    immutableRef: "v.2.2",
    commitSha: "6a5db284c715c18b239422e57bb89684e6a19f00",
    repositoryPath: "wlc/Gen.xml",
    retrievalMethod: "git clone --depth 1 --branch v.2.2",
    rawFilename: "Gen.xml",
    mediaType: "application/xml",
    byteLength: 1_881_356,
    sha256: "87B6221B89CCD308A96B287EFB4520397912A16FE0F8CE4F788A3B4C09D8F2A4",
    sourceUrl: "https://raw.githubusercontent.com/openscriptures/morphhb/v.2.2/wlc/Gen.xml",
    retrievedAt: "2026-08-01T00:00:00-05:00",
    rightsStatus: "mixed-component-rights",
    rightsStatement: "WLC text and OSHB analysis have separate rights components.",
    territorialLimitation: "No broader territorial conclusion is asserted beyond the pinned project documentation.",
    parsingRules: "Parse only chapter Gen.1; preserve XML word text, lemma, morph, id, and order without Unicode normalization.",
  },
  {
    artifactId: "br-artifact-oshb-ps-v2-2",
    publicationId: "br-publication-oshb-v2-2",
    sourceId: "br-source-oshb-v2-2",
    sourceRepository: "https://github.com/openscriptures/morphhb.git",
    immutableRef: "v.2.2",
    commitSha: "6a5db284c715c18b239422e57bb89684e6a19f00",
    repositoryPath: "wlc/Ps.xml",
    retrievalMethod: "git clone --depth 1 --branch v.2.2",
    rawFilename: "Ps.xml",
    mediaType: "application/xml",
    byteLength: 1_949_574,
    sha256: "6B4BC0EAFFF4787FC5DD10F5F3D4F753B132C71DC3D681818D8E73D95E74A6DB",
    sourceUrl: "https://raw.githubusercontent.com/openscriptures/morphhb/v.2.2/wlc/Ps.xml",
    retrievedAt: "2026-08-01T00:00:00-05:00",
    rightsStatus: "mixed-component-rights",
    rightsStatement: "WLC text and OSHB analysis have separate rights components.",
    territorialLimitation: "No broader territorial conclusion is asserted beyond the pinned project documentation.",
    parsingRules: "Parse only chapter Ps.23; split the title segment at the preserved KJV note; preserve XML word values and order.",
  },
  {
    artifactId: "br-artifact-oshb-eccl-v2-2",
    publicationId: "br-publication-oshb-v2-2",
    sourceId: "br-source-oshb-v2-2",
    sourceRepository: "https://github.com/openscriptures/morphhb.git",
    immutableRef: "v.2.2",
    commitSha: "6a5db284c715c18b239422e57bb89684e6a19f00",
    repositoryPath: "wlc/Eccl.xml",
    retrievalMethod: "git clone --depth 1 --branch v.2.2",
    rawFilename: "Eccl.xml",
    mediaType: "application/xml",
    byteLength: 288_538,
    sha256: "28599B243D236813C5F4407CE477E9DF1019CBBEA88BA39AD4A95F1AEC8CECCF",
    sourceUrl: "https://raw.githubusercontent.com/openscriptures/morphhb/v.2.2/wlc/Eccl.xml",
    retrievedAt: "2026-08-01T00:00:00-05:00",
    rightsStatus: "mixed-component-rights",
    rightsStatement: "WLC text and OSHB analysis have separate rights components.",
    territorialLimitation: "No broader territorial conclusion is asserted beyond the pinned project documentation.",
    parsingRules: "Parse only chapter Eccl.3; preserve XML word text, lemma, morph, id, and order without Unicode normalization.",
  },
  {
    artifactId: "br-artifact-nestle1904-rel-1-3",
    publicationId: "br-publication-nestle1904-rel-1-3",
    sourceId: "br-source-nestle1904-rel-1-3",
    sourceRepository: "https://github.com/biblicalhumanities/Nestle1904.git",
    immutableRef: "rel-1-3",
    commitSha: "f2e8fef56eeea892697b5d511a87b8545d6c3dda",
    repositoryPath: "Nestle1904.csv",
    retrievalMethod: "git clone --depth 1 --branch rel-1-3",
    rawFilename: "Nestle1904.csv",
    mediaType: "text/tab-separated-values; charset=utf-8",
    byteLength: 9_098_651,
    sha256: "F239AA40669138EED4BDA0BD4BDC7B2071687CAC26752FA5A1FD468F7FD0ABF0",
    sourceUrl: "https://raw.githubusercontent.com/biblicalhumanities/Nestle1904/rel-1-3/Nestle1904.csv",
    retrievedAt: "2026-08-01T00:00:00-05:00",
    rightsStatus: "project-documentation-public-domain-statement",
    rightsStatement: "The tag-pinned project README states that the total work is in the Public Domain; components are recorded separately.",
    territorialLimitation: "SourceRoot records the project statement and makes no independent global legal determination.",
    parsingRules: "Parse only rows whose first field begins John 1:; require seven documented fields plus the artifact's empty trailing field.",
  },
];

const SOURCE_METADATA: OriginalLanguageSourceMetadata = {
  schemaVersion: "1.0.0",
  datasetId: ORIGINAL_LANGUAGE_DATASET_ID,
  retrievedAt: "2026-08-01",
  sources: [
    {
      sourceId: "br-source-oshb-v2-2",
      publicationId: "br-publication-oshb-v2-2",
      title: "Open Scriptures Hebrew Bible v.2.2",
      provider: "Open Scriptures Hebrew Bible Project",
      stableIdentifier: "github:openscriptures/morphhb@v.2.2",
      publicationDate: null,
      description: "Tag-pinned WLC text with OSHB lemma and morphology analysis.",
      repository: "https://github.com/openscriptures/morphhb.git",
      immutableRef: "v.2.2",
      commitSha: "6a5db284c715c18b239422e57bb89684e6a19f00",
      documentation: [
        "source-docs/oshb-README.md",
        "source-docs/oshb-LICENSE.md",
        "source-docs/oshb-parsing-README.md",
        "source-docs/oshb-HebrewMorphologyCodes.html",
      ],
    },
    {
      sourceId: "br-source-nestle1904-rel-1-3",
      publicationId: "br-publication-nestle1904-rel-1-3",
      title: "Nestle 1904 Greek New Testament with analysis, version 1.3",
      provider: "Biblical Humanities",
      stableIdentifier: "github:biblicalhumanities/Nestle1904@rel-1-3",
      publicationDate: "2017-04-15",
      description: "Tag-pinned Nestle 1904 text with morphology, lemmatization, and Strong's-number fields.",
      repository: "https://github.com/biblicalhumanities/Nestle1904.git",
      immutableRef: "rel-1-3",
      commitSha: "f2e8fef56eeea892697b5d511a87b8545d6c3dda",
      documentation: [
        "source-docs/nestle1904-README.md",
        "source-docs/nestle1904-parsing.txt",
      ],
    },
  ],
  documents: [
    { sourceId: "br-source-oshb-v2-2", repositoryPath: "README.md", preservedPath: "source-docs/oshb-README.md", byteLength: 5_124, sha256: "D0BE8DBBF3BDBA685B1C7C0E6E3C12265D4D113867E43DDA3D9746E6E6BB0F05" },
    { sourceId: "br-source-oshb-v2-2", repositoryPath: "LICENSE.md", preservedPath: "source-docs/oshb-LICENSE.md", byteLength: 1_505, sha256: "A3572C65155CE4FD7C482F635A7E3A903B69F28051961D1E9CC92AA8A657152C" },
    { sourceId: "br-source-oshb-v2-2", repositoryPath: "parsing/README.md", preservedPath: "source-docs/oshb-parsing-README.md", byteLength: 7_642, sha256: "EB804C6C7245E323EF451DF0BF5DBD51511F72AFE4DCB48537708C2A43D8515B" },
    { sourceId: "br-source-oshb-v2-2", repositoryPath: "parsing/HebrewMorphologyCodes.html", preservedPath: "source-docs/oshb-HebrewMorphologyCodes.html", byteLength: 18_944, sha256: "4EF067CD9F2508DE19D81AAB93BF2D7E24D1687A7664C5168DE1411ADAF4EE1D" },
    { sourceId: "br-source-nestle1904-rel-1-3", repositoryPath: "README.md", preservedPath: "source-docs/nestle1904-README.md", byteLength: 8_789, sha256: "6B657411F03DA73738C7FF09576AD34BD3BB5575CB4218E1D3445C923C40C710" },
    { sourceId: "br-source-nestle1904-rel-1-3", repositoryPath: "parsing.txt", preservedPath: "source-docs/nestle1904-parsing.txt", byteLength: 5_330, sha256: "777B2B93ACDDB162DAD0CFA9AD83C1DBA5064FD5930163704E7DA02F7EEEDDB8" },
  ],
  artifacts: ARTIFACTS,
};

const EDITIONS: OriginalLanguageEdition[] = [
  {
    editionId: OSHB_EDITION_ID,
    language: "he",
    displayTitle: "Open Scriptures Hebrew Bible — Westminster Leningrad Codex",
    abbreviation: "OSHB WLC",
    versionIdentity: "v.2.2",
    immutableSourceRef: "v.2.2@6a5db284c715c18b239422e57bb89684e6a19f00",
    publicationId: "br-publication-oshb-v2-2",
    artifactIds: ARTIFACTS.slice(0, 3).map((artifact) => artifact.artifactId),
    description: "Hebrew source text with verbatim OSHB lemma and morphology fields; not a translation.",
  },
  {
    editionId: NESTLE1904_EDITION_ID,
    language: "grc",
    displayTitle: "Nestle 1904 Greek New Testament with analysis",
    abbreviation: "Nestle 1904",
    versionIdentity: "rel-1-3 / version 1.3",
    immutableSourceRef: "rel-1-3@f2e8fef56eeea892697b5d511a87b8545d6c3dda",
    publicationId: "br-publication-nestle1904-rel-1-3",
    artifactIds: ["br-artifact-nestle1904-rel-1-3"],
    description: "Greek source edition with verbatim functional/form morphology, lemma, and Strong's fields; it is not the source text underlying the KJV.",
  },
];

function rightsComponents(): RightsComponent[] {
  const exactAttribution =
    "Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb";
  const oshb = ARTIFACTS.slice(0, 3).flatMap((artifact) => [
    {
      componentId: `${artifact.artifactId}-wlc-text-rights`,
      artifactId: artifact.artifactId,
      componentType: "westminster-leningrad-codex-source-text",
      rightsStatus: "public-domain-per-project-documentation",
      licenseName: null,
      licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
      rightsStatement: "The tag-pinned OSHB documentation states that the Westminster Leningrad Codex text remains in the Public Domain.",
      attribution: "Westminster Leningrad Codex text; public-domain status recorded separately from OSHB analysis.",
      territorialLimitation: "Recorded from the pinned source project; no broader independent legal conclusion.",
      evidenceDocument: "source-docs/oshb-LICENSE.md",
    },
    {
      componentId: `${artifact.artifactId}-oshb-analysis-rights`,
      artifactId: artifact.artifactId,
      componentType: "oshb-lemma-and-morphology-analysis",
      rightsStatus: "licensed",
      licenseName: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      rightsStatement: "OSHB lemma and morphology data are licensed under Creative Commons Attribution 4.0 International.",
      attribution: exactAttribution,
      territorialLimitation: "CC BY 4.0 terms apply to the analysis component; public-domain elements remain separate.",
      evidenceDocument: "source-docs/oshb-LICENSE.md",
    },
  ] satisfies RightsComponent[]);
  const greekTypes = [
    "nestle-1904-printed-edition",
    "digital-transcription",
    "morphological-tagging",
    "lemmatization",
    "strongs-number-data",
    "repository-markup-and-formatting",
  ];
  const greek = greekTypes.map((componentType) => ({
    componentId: `br-artifact-nestle1904-rel-1-3-${componentType}-rights`,
    artifactId: "br-artifact-nestle1904-rel-1-3",
    componentType,
    rightsStatus: "public-domain-per-project-documentation",
    licenseName: null,
    licenseUrl: null,
    rightsStatement: "The rel-1-3 README states that the total work is in the Public Domain; this record applies that statement only to the named component.",
    attribution: "Nestle 1904 base text curated by Diego Renato dos Santos; analysis edited by Dr. Ulrik Sandborg-Petersen, substantially derived from Dr. Maurice A. Robinson's work, as documented in the pinned README.",
    territorialLimitation: "SourceRoot records the pinned project's statement and makes no independent global legal determination.",
    evidenceDocument: "source-docs/nestle1904-README.md",
  } satisfies RightsComponent));
  return [...oshb, ...greek];
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function decodeXml(value: string): string {
  return value.replace(
    /&(?:#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,
    (entity) => {
      if (entity === "&amp;") return "&";
      if (entity === "&lt;") return "<";
      if (entity === "&gt;") return ">";
      if (entity === "&quot;") return "\"";
      if (entity === "&apos;") return "'";
      const hex = entity.startsWith("&#x");
      const number = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
      assert(Number.isSafeInteger(number), `Malformed XML entity: ${entity}`);
      return String.fromCodePoint(number);
    },
  );
}

function attribute(attributes: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attributes);
  return match ? decodeXml(match[1]!) : null;
}

interface WordInput {
  surface: string;
  sourceNativeId: string | null;
  lemma: string | null;
  lemmaIdentifier: string | null;
  morphologies: Array<{ code: string | null; system: string }>;
}

function analysisStatus(codes: Array<string | null>): AnalysisStatus {
  const present = codes.filter((code): code is string => Boolean(code));
  if (present.length === 0) return "not_yet_analyzed";
  return new Set(present).size > 1 ? "ambiguous" : "analyzed";
}

function parseWordElements(fragment: string): WordInput[] {
  const words: WordInput[] = [];
  const wordPattern = /<w\s+([^>]*)>([\s\S]*?)<\/w>/g;
  for (const match of fragment.matchAll(wordPattern)) {
    const attributes = match[1]!;
    const inner = match[2]!;
    assert(!/<[^>]+>/.test(inner), "Unexpected nested markup inside OSHB word element.");
    const sourceNativeId = attribute(attributes, "id");
    assert(sourceNativeId, "OSHB word is missing its immutable id attribute.");
    const surface = decodeXml(inner);
    assert(surface.length > 0, `OSHB word ${sourceNativeId} has an empty surface form.`);
    const lemma = attribute(attributes, "lemma");
    const morph = attribute(attributes, "morph");
    words.push({
      surface,
      sourceNativeId,
      lemma,
      lemmaIdentifier: lemma,
      morphologies: [{ code: morph, system: "OSHB Hebrew morphology v.2.2" }],
    });
  }
  assert(words.length > 0, "OSHB source verse contains no word elements.");
  return words;
}

function verseKey(book: string, chapter: number, verse: string): string {
  const safeVerse = verse.replaceAll(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  return `${book.toLowerCase()}-${String(chapter).padStart(3, "0")}-${safeVerse.padStart(3, "0")}`;
}

function makeVerse(
  editionId: string,
  artifactId: string,
  book: string,
  chapter: number,
  verseIdentifier: string,
  citation: string,
  versification: string,
  words: WordInput[],
): { verse: OriginalLanguageVerse; tokens: OriginalLanguageToken[] } {
  const key = verseKey(book, chapter, verseIdentifier);
  const sourceVerseId = `br-ol-verse-${editionId === OSHB_EDITION_ID ? "oshb" : "nestle1904"}-${key}`;
  const tokens = words.map((word, index): OriginalLanguageToken => {
    const codes = word.morphologies.map((morphology) => morphology.code);
    const status = analysisStatus(codes);
    return {
      tokenId: `br-ol-token-${editionId === OSHB_EDITION_ID ? "oshb" : "nestle1904"}-${key}-${String(index + 1).padStart(4, "0")}`,
      sourceNativeTokenId: word.sourceNativeId,
      editionId,
      sourceVerseId,
      artifactId,
      sequencePosition: index + 1,
      surfaceForm: word.surface,
      lemma: {
        verbatim: word.lemma,
        sourceNativeIdentifier: word.lemmaIdentifier,
        analysisStatus: word.lemma ? "analyzed" : "not_yet_analyzed",
      },
      morphologies: word.morphologies.map((morphology) => ({
        verbatimCode: morphology.code,
        morphologySystem: morphology.system,
        analysisStatus: status,
      })),
    };
  });
  const verse: OriginalLanguageVerse = {
    sourceVerseId,
    editionId,
    artifactId,
    sourceBook: book,
    sourceChapter: chapter,
    sourceVerseIdentifier: verseIdentifier,
    sourceNativeCitation: citation,
    sourceNativeVersification: versification,
    surfaceText: words.map((word) => word.surface).join(" "),
    sourcerootIdentity: sourceVerseId,
  };
  return { verse, tokens };
}

export function parseOshbChapter(
  xml: string,
  artifactId: string,
  osisBook: "Gen" | "Ps" | "Eccl",
  chapterNumber: number,
): { verses: OriginalLanguageVerse[]; tokens: OriginalLanguageToken[] } {
  const chapterMatch = new RegExp(
    `<chapter\\s+osisID="${osisBook}\\.${chapterNumber}"[^>]*>([\\s\\S]*?)<\\/chapter>`,
  ).exec(xml);
  assert(chapterMatch, `Required OSHB chapter is missing: ${osisBook}.${chapterNumber}.`);
  const verses: OriginalLanguageVerse[] = [];
  const tokens: OriginalLanguageToken[] = [];
  const versePattern = new RegExp(
    `<verse\\s+osisID="${osisBook}\\.${chapterNumber}\\.(\\d+)"[^>]*>([\\s\\S]*?)<\\/verse>`,
    "g",
  );
  for (const match of chapterMatch[1]!.matchAll(versePattern)) {
    const number = Number(match[1]);
    const fragment = match[2]!;
    if (osisBook === "Ps" && chapterNumber === 23 && number === 1) {
      const marker = "<note>KJV:Ps.23.1</note>";
      const markerIndex = fragment.indexOf(marker);
      assert(markerIndex >= 0, "Psalm 23 superscription mapping note is missing.");
      const titleWords = parseWordElements(fragment.slice(0, markerIndex));
      const bodyWords = parseWordElements(fragment.slice(markerIndex + marker.length));
      for (const item of [
        makeVerse(OSHB_EDITION_ID, artifactId, osisBook, chapterNumber, "title", "Ps.23.1 (superscription segment)", "OSHB WLC v.2.2 OSIS; title split transparently at the preserved KJV mapping note", titleWords),
        makeVerse(OSHB_EDITION_ID, artifactId, osisBook, chapterNumber, "1", "Ps.23.1 (text segment)", "OSHB WLC v.2.2 OSIS; text following the preserved KJV mapping note", bodyWords),
      ]) {
        verses.push(item.verse);
        tokens.push(...item.tokens);
      }
    } else {
      const item = makeVerse(
        OSHB_EDITION_ID,
        artifactId,
        osisBook,
        chapterNumber,
        String(number),
        `${osisBook}.${chapterNumber}.${number}`,
        "OSHB WLC v.2.2 OSIS",
        parseWordElements(fragment),
      );
      verses.push(item.verse);
      tokens.push(...item.tokens);
    }
  }
  assert(verses.length > 0, `No verses parsed for ${osisBook}.${chapterNumber}.`);
  return { verses, tokens };
}

export function parseNestleJohn1(
  csv: string,
): { verses: OriginalLanguageVerse[]; tokens: OriginalLanguageToken[] } {
  const byCitation = new Map<string, WordInput[]>();
  for (const [index, line] of csv.split(/\r?\n/).entries()) {
    if (!line.startsWith("John 1:")) continue;
    const fields = line.split("\t");
    assert(
      fields.length === 8 && fields[7] === "",
      `Malformed Nestle1904 John 1 row ${index + 1}: expected seven fields and the preserved trailing tab.`,
    );
    const [citation, surface, functional, formOriented, strongs, lemma] = fields;
    assert(citation && /^John 1:\d+$/.test(citation), `Malformed John 1 citation at row ${index + 1}.`);
    assert(surface, `Empty Greek surface form at row ${index + 1}.`);
    const words = byCitation.get(citation) ?? [];
    words.push({
      surface,
      sourceNativeId: null,
      lemma: lemma || null,
      lemmaIdentifier: strongs || null,
      morphologies: [
        { code: functional || null, system: "Nestle1904 Robinson-like functional" },
        { code: formOriented || null, system: "Nestle1904 Robinson-like form-oriented" },
      ],
    });
    byCitation.set(citation, words);
  }
  assert(byCitation.size === 51, `Expected 51 John 1 verses; found ${byCitation.size}.`);
  const verses: OriginalLanguageVerse[] = [];
  const tokens: OriginalLanguageToken[] = [];
  for (let number = 1; number <= 51; number += 1) {
    const citation = `John 1:${number}`;
    const words = byCitation.get(citation);
    assert(words, `Nestle1904 is missing ${citation}.`);
    const item = makeVerse(
      NESTLE1904_EDITION_ID,
      "br-artifact-nestle1904-rel-1-3",
      "John",
      1,
      String(number),
      citation,
      "Nestle1904 rel-1-3 OSIS citation field",
      words,
    );
    verses.push(item.verse);
    tokens.push(...item.tokens);
  }
  return { verses, tokens };
}

function mappingForVerse(verse: OriginalLanguageVerse): VerseMapping {
  const isTitle = verse.sourceVerseIdentifier === "title";
  const bookCode = verse.sourceBook.toLowerCase();
  const numericVerse = Number(verse.sourceVerseIdentifier);
  const target = isTitle
    ? null
    : `br-ref-${bookCode}-${String(verse.sourceChapter).padStart(3, "0")}-${String(numericVerse).padStart(3, "0")}`;
  return {
    mappingId: `${verse.sourceVerseId}-to-kjv`,
    sourceVerseId: verse.sourceVerseId,
    targetCanonicalReferenceId: target,
    mappingType: isTitle ? "omitted_or_untranslated" : "one_to_one",
    explanation: isTitle
      ? "The OSHB Ps.23.1 element begins with the Hebrew superscription. SourceRoot preserves it as a separate source segment with no KJV verse target; the following text segment maps explicitly to Psalm 23:1."
      : "This source verse segment maps explicitly to the existing Chunk 12 canonical/KJV verse with the same displayed chapter and verse.",
    evidenceSource: isTitle
      ? "br-artifact-oshb-ps-v2-2: preserved <note>KJV:Ps.23.1</note> boundary"
      : `${verse.artifactId}:${verse.sourceNativeCitation}`,
    reviewStatus: "reviewed",
  };
}

function normalizedMaterial(dataset: Omit<OriginalLanguageDataset, "manifest">): string {
  return JSON.stringify({
    sourceMetadata: dataset.sourceMetadata,
    editions: dataset.editions,
    verses: dataset.verses,
    tokens: dataset.tokens,
    mappings: dataset.mappings,
    rightsComponents: dataset.rightsComponents,
  });
}

async function validatedRaw(artifact: SourceArtifactIdentity): Promise<Buffer> {
  const rawPath = path.join(ORIGINAL_LANGUAGE_DATA_DIRECTORY, "raw", artifact.rawFilename);
  const bytes = await readFile(rawPath);
  assert(bytes.byteLength === artifact.byteLength, `Raw byte length mismatch: ${artifact.rawFilename}.`);
  assert(sha256(bytes) === artifact.sha256, `Raw SHA-256 mismatch: ${artifact.rawFilename}.`);
  return bytes;
}

async function validateSourceDocuments(): Promise<void> {
  for (const document of SOURCE_METADATA.documents) {
    const bytes = await readFile(
      path.join(ORIGINAL_LANGUAGE_DATA_DIRECTORY, document.preservedPath),
    );
    assert(bytes.byteLength === document.byteLength, `Source-document byte length mismatch: ${document.preservedPath}.`);
    assert(sha256(bytes) === document.sha256, `Source-document SHA-256 mismatch: ${document.preservedPath}.`);
  }
}

function counts(
  editions: OriginalLanguageEdition[],
  verses: OriginalLanguageVerse[],
  tokens: OriginalLanguageToken[],
  mappings: VerseMapping[],
): OriginalLanguageManifest["expectedCounts"] {
  const tokensByLanguage: Record<string, number> = { he: 0, grc: 0 };
  const tokensByChapter: Record<string, number> = {};
  const editionLanguage = new Map(editions.map((edition) => [edition.editionId, edition.language]));
  const verseById = new Map(verses.map((verse) => [verse.sourceVerseId, verse]));
  let lemmas = 0;
  let morphologies = 0;
  let missingAnalysis = 0;
  let ambiguousAnalysis = 0;
  for (const token of tokens) {
    const language = editionLanguage.get(token.editionId)!;
    tokensByLanguage[language] = (tokensByLanguage[language] ?? 0) + 1;
    const verse = verseById.get(token.sourceVerseId)!;
    const chapterKey = `${language}:${verse.sourceBook}.${verse.sourceChapter}`;
    tokensByChapter[chapterKey] = (tokensByChapter[chapterKey] ?? 0) + 1;
    if (token.lemma.verbatim) lemmas += 1;
    if (token.lemma.analysisStatus === "not_yet_analyzed") missingAnalysis += 1;
    for (const morphology of token.morphologies) {
      if (morphology.verbatimCode) morphologies += 1;
    }
    const status = token.morphologies[0]?.analysisStatus;
    if (status === "not_yet_analyzed") missingAnalysis += 1;
    if (status === "ambiguous") ambiguousAnalysis += 1;
  }
  const mappingTypes: Record<string, number> = {};
  for (const mapping of mappings) {
    mappingTypes[mapping.mappingType] = (mappingTypes[mapping.mappingType] ?? 0) + 1;
  }
  return {
    editions: editions.length,
    sourceArtifacts: ARTIFACTS.length,
    sourceVerses: verses.length,
    tokens: tokens.length,
    tokensByLanguage,
    tokensByChapter,
    lemmas,
    morphologies,
    missingAnalysis,
    ambiguousAnalysis,
    mappings: mappings.length,
    mappingTypes,
  };
}

export async function prepareOriginalLanguageDataset(): Promise<OriginalLanguageDataset> {
  await validateSourceDocuments();
  const rawArtifacts = await Promise.all(
    ARTIFACTS.map(validatedRaw),
  );
  const genesis = rawArtifacts[0]!;
  const psalms = rawArtifacts[1]!;
  const ecclesiastes = rawArtifacts[2]!;
  const nestle = rawArtifacts[3]!;
  const parsed = [
    parseOshbChapter(genesis.toString("utf8"), ARTIFACTS[0]!.artifactId, "Gen", 1),
    parseOshbChapter(psalms.toString("utf8"), ARTIFACTS[1]!.artifactId, "Ps", 23),
    parseOshbChapter(ecclesiastes.toString("utf8"), ARTIFACTS[2]!.artifactId, "Eccl", 3),
    parseNestleJohn1(nestle.toString("utf8")),
  ];
  const verses = parsed.flatMap((item) => item.verses);
  const tokens = parsed.flatMap((item) => item.tokens);
  const mappings = verses.map(mappingForVerse);
  const base = {
    sourceMetadata: SOURCE_METADATA,
    editions: EDITIONS,
    verses,
    tokens,
    mappings,
    rightsComponents: rightsComponents(),
  };
  const manifest: OriginalLanguageManifest = {
    schemaVersion: "1.0.0",
    datasetId: ORIGINAL_LANGUAGE_DATASET_ID,
    version: ORIGINAL_LANGUAGE_DATASET_VERSION,
    status: "bounded-read-only",
    normalizedDatasetSha256: sha256(normalizedMaterial(base)),
    expectedCounts: counts(EDITIONS, verses, tokens, mappings),
    files: Object.fromEntries(
      SOURCE_METADATA.documents.map((document) => [
        document.preservedPath,
        document.sha256,
      ]),
    ),
  };
  return { manifest, ...base };
}

const OUTPUTS = {
  "source-metadata.json": "sourceMetadata",
  "editions.json": "editions",
  "verses.json": "verses",
  "tokens.json": "tokens",
  "mappings.json": "mappings",
  "rights-components.json": "rightsComponents",
} as const;

export async function writeOriginalLanguageDataset(): Promise<OriginalLanguageDataset> {
  const dataset = await prepareOriginalLanguageDataset();
  for (const [filename, key] of Object.entries(OUTPUTS)) {
    const datasetKey = key as
      | "sourceMetadata"
      | "editions"
      | "verses"
      | "tokens"
      | "mappings"
      | "rightsComponents";
    const content = `${JSON.stringify(dataset[datasetKey], null, 2)}\n`;
    await writeFile(path.join(ORIGINAL_LANGUAGE_DATA_DIRECTORY, filename), content, "utf8");
    dataset.manifest.files[filename] = sha256(content);
  }
  const manifestContent = `${JSON.stringify(dataset.manifest, null, 2)}\n`;
  await writeFile(
    path.join(ORIGINAL_LANGUAGE_DATA_DIRECTORY, "dataset-manifest.json"),
    manifestContent,
    "utf8",
  );
  return dataset;
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(
    await readFile(path.join(ORIGINAL_LANGUAGE_DATA_DIRECTORY, filename), "utf8"),
  ) as T;
}

export async function loadOriginalLanguageDataset(): Promise<OriginalLanguageDataset> {
  const [manifest, sourceMetadata, editions, verses, tokens, mappings, rightsComponents] =
    await Promise.all([
      readJson<OriginalLanguageManifest>("dataset-manifest.json"),
      readJson<OriginalLanguageSourceMetadata>("source-metadata.json"),
      readJson<OriginalLanguageEdition[]>("editions.json"),
      readJson<OriginalLanguageVerse[]>("verses.json"),
      readJson<OriginalLanguageToken[]>("tokens.json"),
      readJson<VerseMapping[]>("mappings.json"),
      readJson<RightsComponent[]>("rights-components.json"),
    ]);
  const dataset = { manifest, sourceMetadata, editions, verses, tokens, mappings, rightsComponents };
  assert(manifest.datasetId === ORIGINAL_LANGUAGE_DATASET_ID, "Original-language dataset ID mismatch.");
  for (const [filename, expected] of Object.entries(manifest.files)) {
    assert(sha256(await readFile(path.join(ORIGINAL_LANGUAGE_DATA_DIRECTORY, filename))) === expected, `Normalized file SHA-256 mismatch: ${filename}.`);
  }
  for (const artifact of sourceMetadata.artifacts) await validatedRaw(artifact);
  await validateSourceDocuments();
  assert(manifest.normalizedDatasetSha256 === sha256(normalizedMaterial(dataset)), "Normalized dataset SHA-256 mismatch.");
  assert(tokens.every((token) => token.sequencePosition > 0), "Invalid token position.");
  assert(tokens.filter((token) => token.sourceNativeTokenId === null).every((token) => token.editionId === NESTLE1904_EDITION_ID), "Only Nestle1904 tokens may have null source-native IDs.");
  assert(new Set(tokens.map((token) => token.tokenId)).size === tokens.length, "Duplicate SourceRoot token ID.");
  return dataset;
}
