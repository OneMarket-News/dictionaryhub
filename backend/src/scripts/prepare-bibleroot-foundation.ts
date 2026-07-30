import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const datasetDirectory = path.resolve(
  currentDirectory,
  "../../data/bibleroot-foundation-v1",
);
const rawPath = path.join(
  datasetDirectory,
  "raw/project-gutenberg-ebook-10-10-0.txt",
);

const DATASET_ID = "bibleroot-foundation-v1";
const DATASET_VERSION = "1.0.0";
const CANON_ID = "br-canon-kjv-66";
const EDITION_ID = "br-edition-kjv-pg10-2024";
const SOURCE_ID = "bibleroot-source-project-gutenberg-ebook-10";
const PUBLICATION_ID = "br-publication-project-gutenberg-ebook-10";
const ARTIFACT_ID = "br-artifact-pg10-10-0-txt-sha256-0f1a83cb";
const EXPECTED_RAW_SHA256 =
  "0F1A83CBCDC1D3FAE6BCC3DAAA496D4FA723FCCE9526E84E20DF12AE33FDA986";
const EXPECTED_RAW_BYTES = 4436268;

type BookSeed = {
  code: string;
  name: string;
  aliases: string[];
  collection: "Old Testament" | "New Testament";
  chapterCount: number;
};

const books: BookSeed[] = [
  ["gen", "Genesis", ["Gen", "Ge", "Gn"], "Old Testament"],
  ["exod", "Exodus", ["Exod", "Ex", "Exo"], "Old Testament"],
  ["lev", "Leviticus", ["Lev", "Le", "Lv"], "Old Testament"],
  ["num", "Numbers", ["Num", "Nu", "Nm"], "Old Testament"],
  ["deut", "Deuteronomy", ["Deut", "Dt", "Deu"], "Old Testament"],
  ["josh", "Joshua", ["Josh", "Jos"], "Old Testament"],
  ["judg", "Judges", ["Judg", "Jdg", "Jgs"], "Old Testament"],
  ["ruth", "Ruth", ["Ru", "Rth"], "Old Testament"],
  ["1sam", "1 Samuel", ["1 Sam", "1Sa"], "Old Testament"],
  ["2sam", "2 Samuel", ["2 Sam", "2Sa"], "Old Testament"],
  ["1kgs", "1 Kings", ["1 Kgs", "1Ki"], "Old Testament"],
  ["2kgs", "2 Kings", ["2 Kgs", "2Ki"], "Old Testament"],
  ["1chr", "1 Chronicles", ["1 Chr", "1Ch"], "Old Testament"],
  ["2chr", "2 Chronicles", ["2 Chr", "2Ch"], "Old Testament"],
  ["ezra", "Ezra", ["Ezr"], "Old Testament"],
  ["neh", "Nehemiah", ["Neh", "Ne"], "Old Testament"],
  ["esth", "Esther", ["Esth", "Est"], "Old Testament"],
  ["job", "Job", ["Jb"], "Old Testament"],
  ["ps", "Psalm", ["Ps", "Psa", "Psalms"], "Old Testament"],
  ["prov", "Proverbs", ["Prov", "Pr", "Prv"], "Old Testament"],
  ["eccl", "Ecclesiastes", ["Eccl", "Ecc", "Qoheleth"], "Old Testament"],
  ["song", "Song of Solomon", ["Song", "Song of Songs", "SOS"], "Old Testament"],
  ["isa", "Isaiah", ["Isa", "Is"], "Old Testament"],
  ["jer", "Jeremiah", ["Jer", "Je"], "Old Testament"],
  ["lam", "Lamentations", ["Lam", "La"], "Old Testament"],
  ["ezek", "Ezekiel", ["Ezek", "Eze"], "Old Testament"],
  ["dan", "Daniel", ["Dan", "Da"], "Old Testament"],
  ["hos", "Hosea", ["Hos", "Ho"], "Old Testament"],
  ["joel", "Joel", ["Joe"], "Old Testament"],
  ["amos", "Amos", ["Am"], "Old Testament"],
  ["obad", "Obadiah", ["Obad", "Ob"], "Old Testament"],
  ["jonah", "Jonah", ["Jon"], "Old Testament"],
  ["mic", "Micah", ["Mic", "Mi"], "Old Testament"],
  ["nah", "Nahum", ["Nah", "Na"], "Old Testament"],
  ["hab", "Habakkuk", ["Hab"], "Old Testament"],
  ["zeph", "Zephaniah", ["Zeph", "Zep"], "Old Testament"],
  ["hag", "Haggai", ["Hag"], "Old Testament"],
  ["zech", "Zechariah", ["Zech", "Zec"], "Old Testament"],
  ["mal", "Malachi", ["Mal"], "Old Testament"],
  ["matt", "Matthew", ["Matt", "Mt"], "New Testament"],
  ["mark", "Mark", ["Mk", "Mrk"], "New Testament"],
  ["luke", "Luke", ["Lk", "Luk"], "New Testament"],
  ["john", "John", ["Jn", "Jhn"], "New Testament"],
  ["acts", "Acts", ["Ac", "Act"], "New Testament"],
  ["rom", "Romans", ["Rom", "Ro"], "New Testament"],
  ["1cor", "1 Corinthians", ["1 Cor", "1Co"], "New Testament"],
  ["2cor", "2 Corinthians", ["2 Cor", "2Co"], "New Testament"],
  ["gal", "Galatians", ["Gal", "Ga"], "New Testament"],
  ["eph", "Ephesians", ["Eph"], "New Testament"],
  ["phil", "Philippians", ["Phil", "Php"], "New Testament"],
  ["col", "Colossians", ["Col"], "New Testament"],
  ["1thess", "1 Thessalonians", ["1 Thess", "1Th"], "New Testament"],
  ["2thess", "2 Thessalonians", ["2 Thess", "2Th"], "New Testament"],
  ["1tim", "1 Timothy", ["1 Tim", "1Ti"], "New Testament"],
  ["2tim", "2 Timothy", ["2 Tim", "2Ti"], "New Testament"],
  ["titus", "Titus", ["Tit"], "New Testament"],
  ["phlm", "Philemon", ["Phlm", "Phm"], "New Testament"],
  ["heb", "Hebrews", ["Heb"], "New Testament"],
  ["jas", "James", ["Jas", "Jm"], "New Testament"],
  ["1pet", "1 Peter", ["1 Pet", "1Pe"], "New Testament"],
  ["2pet", "2 Peter", ["2 Pet", "2Pe"], "New Testament"],
  ["1john", "1 John", ["1 Jn", "1Jo"], "New Testament"],
  ["2john", "2 John", ["2 Jn", "2Jo"], "New Testament"],
  ["3john", "3 John", ["3 Jn", "3Jo"], "New Testament"],
  ["jude", "Jude", ["Jud"], "New Testament"],
  ["rev", "Revelation", ["Rev", "Re"], "New Testament"],
].map(([code, name, aliases, collection], index) => ({
  code: code as string,
  name: name as string,
  aliases: aliases as string[],
  collection: collection as BookSeed["collection"],
  chapterCount: [
    50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10,
    42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3,
    2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3,
    1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
  ][index] as number,
}));

const selections = [
  {
    code: "gen",
    chapter: 1,
    heading: "The First Book of Moses: Called Genesis",
    nextHeading: "The Second Book of Moses: Called Exodus",
  },
  {
    code: "john",
    chapter: 1,
    heading: "The Gospel According to Saint John",
    nextHeading: "The Acts of the Apostles",
  },
  {
    code: "ps",
    chapter: 23,
    heading: "The Book of Psalms",
    nextHeading: "The Proverbs",
  },
  {
    code: "eccl",
    chapter: 3,
    heading: "Ecclesiastes",
    nextHeading: "The Song of Solomon",
  },
] as const;

const phraseSeeds = [
  ["in-the-beginning", "In the beginning"],
  ["let-there-be-light", "Let there be light"],
  ["the-word", "the Word"],
  ["the-word-was-with-god", "the Word was with God"],
  ["the-word-was-god", "the Word was God"],
  ["still-waters", "still waters"],
  ["valley-of-the-shadow-of-death", "valley of the shadow of death"],
  ["a-time-to-be-born", "A time to be born"],
  ["a-time-to-die", "a time to die"],
] as const;

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function canonicalBook(code: string): BookSeed {
  const book = books.find((candidate) => candidate.code === code);
  if (!book) throw new Error(`Unknown book code: ${code}`);
  return book;
}

function extractBook(raw: string, heading: string, nextHeading: string): string {
  const start = raw.lastIndexOf(`\n${heading}\n`);
  const end = raw.lastIndexOf(`\n${nextHeading}\n`);
  if (start < 0 || end <= start) {
    throw new Error(`Could not isolate source book: ${heading}`);
  }
  return raw.slice(start + heading.length + 2, end);
}

async function main(): Promise<void> {
  const rawBytes = await readFile(rawPath);
  if (rawBytes.byteLength !== EXPECTED_RAW_BYTES) {
    throw new Error(`Raw byte length mismatch: ${rawBytes.byteLength}`);
  }
  const rawHash = sha256(rawBytes);
  if (rawHash !== EXPECTED_RAW_SHA256) {
    throw new Error(`Raw SHA-256 mismatch: ${rawHash}`);
  }
  const raw = rawBytes.toString("utf8").replace(/\r\n?/g, "\n");
  const verseRecords: Array<Record<string, unknown> & {
    bookCode: string;
    chapterNumber: number;
    verseNumber: number;
    exactText: string;
    canonicalReferenceId: string;
    editionTextId: string;
  }> = [];

  for (const selection of selections) {
    const book = canonicalBook(selection.code);
    const block = extractBook(raw, selection.heading, selection.nextHeading);
    const versePattern = /(\d+):(\d+)\s+([\s\S]*?)(?=\s+\d+:\d+\s+|$)/g;
    for (const match of block.matchAll(versePattern)) {
      const chapterNumber = Number(match[1]);
      if (chapterNumber !== selection.chapter) continue;
      const verseNumber = Number(match[2]);
      const exactText = match[3]!.replace(/\s+/g, " ").trim();
      const chapterToken = String(chapterNumber).padStart(3, "0");
      const verseToken = String(verseNumber).padStart(3, "0");
      verseRecords.push({
        bookId: `br-book-${book.code}`,
        bookCode: book.code,
        bookName: book.name,
        chapterId: `br-chapter-${book.code}-${chapterToken}`,
        chapterNumber,
        verseNumber,
        canonicalReferenceId:
          `br-ref-${book.code}-${chapterToken}-${verseToken}`,
        editionTextId:
          `br-text-kjv-pg10-${book.code}-${chapterToken}-${verseToken}`,
        normalizedReference: `${book.name} ${chapterNumber}:${verseNumber}`,
        citation: `${book.name} ${chapterNumber}:${verseNumber} (KJV)`,
        exactText,
      });
    }
  }

  verseRecords.sort((left, right) => {
    const bookOrder = selections.findIndex((entry) => entry.code === left.bookCode)
      - selections.findIndex((entry) => entry.code === right.bookCode);
    return bookOrder || left.chapterNumber - right.chapterNumber
      || left.verseNumber - right.verseNumber;
  });

  const expectedCounts = new Map([
    ["gen:1", 31],
    ["john:1", 51],
    ["ps:23", 6],
    ["eccl:3", 22],
  ]);
  for (const [key, count] of expectedCounts) {
    const [bookCode, chapter] = key.split(":");
    const actual = verseRecords.filter(
      (verse) => verse.bookCode === bookCode
        && verse.chapterNumber === Number(chapter),
    );
    if (actual.length !== count || actual.some(
      (verse, index) => verse.verseNumber !== index + 1,
    )) {
      throw new Error(`Verse sequence mismatch for ${key}: ${actual.length}`);
    }
  }
  if (verseRecords.length !== 110) {
    throw new Error(`Expected 110 verses; found ${verseRecords.length}`);
  }

  const normalizedMaterial = verseRecords
    .map((verse) => `${verse.editionTextId}\t${verse.exactText}`)
    .join("\n");
  const normalizedTextSha256 = sha256(normalizedMaterial);

  const phraseRecords = phraseSeeds.map(([slug, displayText]) => {
    const occurrences: Array<Record<string, unknown>> = [];
    for (const verse of verseRecords) {
      let startOffset = verse.exactText.indexOf(displayText);
      while (startOffset >= 0) {
        const endOffset = startOffset + displayText.length;
        const before = verse.exactText[startOffset - 1] ?? "";
        const after = verse.exactText[endOffset] ?? "";
        if (!/[A-Za-z0-9]/.test(before) && !/[A-Za-z0-9]/.test(after)) {
          occurrences.push({
            occurrenceId:
              `br-occurrence-${slug}-${verse.bookCode}-`
              + `${String(verse.chapterNumber).padStart(3, "0")}-`
              + `${String(verse.verseNumber).padStart(3, "0")}-`
              + `${String(startOffset).padStart(3, "0")}`,
            editionTextId: verse.editionTextId,
            canonicalReferenceId: verse.canonicalReferenceId,
            startOffset,
            endOffset,
            exactText: verse.exactText.slice(startOffset, endOffset),
          });
        }
        startOffset = verse.exactText.indexOf(displayText, startOffset + 1);
      }
    }
    if (occurrences.length === 0) {
      throw new Error(`Phrase not found in selected source text: ${displayText}`);
    }
    return {
      phraseId: `br-phrase-${slug}`,
      displayText,
      normalizedLookupText: displayText.toLowerCase(),
      editionId: EDITION_ID,
      provenanceNote:
        "Exact textual occurrence in the acquired Project Gutenberg eBook 10 artifact; no interpretation is asserted.",
      occurrences,
    };
  });

  const canon = {
    canonId: CANON_ID,
    displayName: "KJV source 66-book Protestant canon order",
    description:
      "The 66-book order represented by the selected Project Gutenberg KJV source artifact.",
    scopeNote:
      "This is one explicit canon identity and does not imply that it is the only Christian biblical canon.",
    authoritySourceId: SOURCE_ID,
    books: books.map((book, index) => ({
      bookId: `br-book-${book.code}`,
      machineCode: book.code,
      displayName: book.name,
      aliases: [book.name, ...book.aliases],
      broadCollection: book.collection,
      chapterCount: book.chapterCount,
      canonicalOrder: index + 1,
      availabilityStatus: selections.some((entry) => entry.code === book.code)
        ? "text_available"
        : "metadata_only",
      authoritySourceId: SOURCE_ID,
    })),
  };
  const edition = {
    editionId: EDITION_ID,
    displayTitle: "King James Version — Project Gutenberg eBook 10 text",
    abbreviation: "KJV",
    language: "en",
    translationName: "King James Version",
    editionDescription:
      "The text supplied by Project Gutenberg eBook 10, without an unsupported 1611 or 1769 edition claim.",
    publisherOrDistributor: "Project Gutenberg",
    publicationOrReleaseDate: "1989-08-01",
    rightsStatus: "public-domain-usa",
    territorialLimitation:
      "Copyright status can differ outside the United States; check local law.",
    publicationId: PUBLICATION_ID,
    artifactId: ARTIFACT_ID,
    datasetVersion: DATASET_VERSION,
    normalizedTextSha256,
    provenanceNotes:
      "Only source line wrapping was normalized; spelling, punctuation, capitalization, pronouns, and wording were preserved.",
  };

  await writeFile(path.join(datasetDirectory, "canon.json"), json(canon));
  await writeFile(path.join(datasetDirectory, "edition.json"), json(edition));
  await writeFile(path.join(datasetDirectory, "verses.json"), json(verseRecords));
  await writeFile(path.join(datasetDirectory, "phrases.json"), json(phraseRecords));

  const fileHashes: Record<string, string> = {};
  for (const filename of [
    "source-metadata.json",
    "canon.json",
    "edition.json",
    "verses.json",
    "phrases.json",
  ]) {
    fileHashes[filename] = sha256(
      await readFile(path.join(datasetDirectory, filename)),
    );
  }
  fileHashes["raw/project-gutenberg-ebook-10-10-0.txt"] = rawHash;

  const manifest = {
    schemaVersion: "1.0.0",
    datasetId: DATASET_ID,
    version: DATASET_VERSION,
    status: "foundation-alpha",
    canonId: CANON_ID,
    editionId: EDITION_ID,
    sourceId: SOURCE_ID,
    publicationId: PUBLICATION_ID,
    artifactId: ARTIFACT_ID,
    expectedCounts: {
      canons: 1,
      books: 66,
      populatedChapters: 4,
      verses: 110,
      phrases: 9,
      phraseOccurrences: phraseRecords.reduce(
        (sum, phrase) => sum + phrase.occurrences.length,
        0,
      ),
    },
    featuredReferences: [
      "Genesis 1",
      "John 1",
      "Psalm 23",
      "Ecclesiastes 3",
    ],
    normalizedTextSha256,
    files: fileHashes,
  };
  await writeFile(
    path.join(datasetDirectory, "dataset-manifest.json"),
    json(manifest),
  );

  console.log(JSON.stringify({
    datasetId: DATASET_ID,
    version: DATASET_VERSION,
    rawBytes: rawBytes.byteLength,
    rawSha256: rawHash,
    normalizedTextSha256,
    books: books.length,
    populatedChapters: selections.length,
    verses: verseRecords.length,
    phrases: phraseRecords.length,
    phraseOccurrences: manifest.expectedCounts.phraseOccurrences,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
