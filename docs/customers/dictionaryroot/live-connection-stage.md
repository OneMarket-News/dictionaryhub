# DictionaryRoot Live Customer Connection

## Stage completed

DictionaryRoot Customer #001 now reads its public concept and graph experiences from the SourceRoot API rather than the old static concept and graph datasets.

## Customer request path

```text
DictionaryRoot public page
-> DictionaryRoot customer manifest
-> DictionaryRoot API client
-> SourceRoot API
-> PostgreSQL
-> customer-friendly response
```

## Live customer capabilities

- Search only the stable DictionaryRoot bundle and DictionaryRoot domain.
- Distinguish separate word-sense nodes.
- Load definitions and usage examples from assertions.
- Load semantic relationships from incoming and outgoing edges.
- Load recorded source and license details.
- Open a selected meaning in the live knowledge graph.
- Expand graph nodes one layer at a time.
- Protect the browser with customer-configured graph limits.
- Expose raw SourceRoot records only under advanced details.

## Contract correction discovered during hookup

The initial customer manifest used `dictionary` as its domain, while the imported OEWN records use `DictionaryRoot`. The live connection changed the manifest to the exact stored domain value. This is a reusable onboarding lesson: customer filters must be verified against imported normalized records before frontend integration.

## Remaining work

- Complete the customer acceptance checklist in the browser.
- Review graph layout behavior with concepts having unusually high relationship counts.
- Add production API configuration when the backend is hosted.
- Test a stable-bundle replacement without frontend changes.
