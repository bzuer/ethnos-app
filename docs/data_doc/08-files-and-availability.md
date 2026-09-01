# 08 — Files and availability

← [What is missing](07-incompleteness.md) · [Index](README.md) · next → [Operations](09-operations.md)

---

The database records **whether a work appears in various external catalogues of full-text
availability**. That statement needs to be made precisely, because it is easy to read it as
something it is not.

## What an availability record is

For a publication, the corpus may hold one or more *availability records*. Each states that some
external catalogue lists an item with a given technical fingerprint, of a given format and size.

A record holds: a hash set (`md5` and secondary hashes), `file_size`, `file_format`, `pages`,
`language`, and the catalogue's own record identifier. That is all it holds.

| Origin | Rows | What the row holds |
|---|---:|---|
| Open access | 2,802,079 | A publisher- or repository-provided link to a legitimately open copy, as reported by the indexing sources |
| Article catalogue | 3,775,526 | A fingerprint and file description only |
| Book catalogue | 603,204 | A fingerprint and file description only |
| *(overlap)* | *7,487* | *Rows listed by both catalogues, counted once* |

The two side catalogues together account for **4,371,243 distinct rows**.

The natural key is the pair *(hash, publication)*, deliberately not one file per publication: a
publication may legitimately have several entries — different formats, different scans — and one
hash may be listed against many publications, since a book's fingerprint corresponds to every
chapter in it.

---

## What is not stored

Verified across all **4,371,243** rows sourced from the two side catalogues:

| | Count |
|---|---:|
| Stored download URLs | **0** |
| Stored torrent records | **0** |
| Stored access links of any kind | **0** |

> **This project does not host, mirror, proxy, relay, or serve any file from those catalogues.** It
> holds no copies. It does not fetch them, does not link to them, and does not facilitate access to
> them.

What is recorded is *whether an item appears to be indexed* — a fact **about a third-party
catalogue**, not a copy of anything and not a route to anything.

The `md5` and the other hash values are exactly that: **hashes**. A hash is a fixed-length
fingerprint computed from content. It is a value used here to recognise that two catalogue entries
describe the same object and to match a catalogue entry to a publication. It is not a file, does
not contain a file, and does not yield one. The same is true of every hash column in the row,
including the content-addressed one, which the loader copies in the same block as the others.

These values are, in any case, **not published and not made available**: they are internal matching
material.

---

## What is not verified

Equally important, and stated without hedging:

> **This project does not verify the existence, validity, integrity, legality or provenance of any
> external record it indexes.**

No step in the pipeline checks whether a catalogued item is real, whether the fingerprint
corresponds to anything, whether the described work is what it claims to be, or where it came from.
Every availability record carries a verification status of *pending*, and there is **no verification
step** — because performing one would mean retrieving the material, which this project does not do.

What is recorded is therefore **a claim made by a third party, reproduced as a claim**. It is not an
endorsement, not a confirmation, and not a representation that the underlying item exists or is
lawfully available.

Responsibility for those catalogues, their contents, their legality and their operation lies
entirely with whoever operates them. It is not this project's, and this project makes no
representation about them.

---

## Why the information is recorded at all

The reason is bibliographic rather than practical.

For a discipline whose literature is scattered across defunct presses, untranslated editions,
regional publishers and long out-of-print monographs, **knowing that a work has been catalogued
somewhere is itself a bibliographic fact**. It is the same class of fact as a library holding
statement — "this exists, and a copy of it has been recorded" — and no more than that.

It also does real work inside the corpus. A fingerprint listed against many publications is
evidence that those publications describe one object, which feeds the deduplication described in
[chapter 05](05-cleaning.md). A format and page count corroborate a book's extent where no
bibliographic source stated one.

> **In plain words.** The database can tell you that an item with a given fingerprint appears in an
> external index. It cannot give you that item, does not know whether the entry is genuine, and
> holds nothing that would help anyone obtain it.

---

## Open-access files are a different thing

The 2,802,079 open-access rows are not in the above category and should not be read as though they
were. They carry publisher- or repository-provided links to copies the rights-holder has made
openly available, as reported by the indexing sources — the ordinary open-access metadata that
Crossref and OpenAlex publish. Those links are stored because they are meant to be followed.

The distinction is maintained in the data itself: an open-access row carries a link and no side
catalogue identifier; a side-catalogue row carries an identifier and no link.

---

next → [09 — Operations](09-operations.md)
