# 04 — Collection

← [Sources](03-sources.md) · [Index](README.md) · next → [Cleaning and repair](05-cleaning.md)

---

There is no button that returns a discipline. Collection is a loop of asking narrow, answerable
questions and keeping every answer — including the answer "nothing".

## The five stages, and why they are separate

| Stage | Role | Network? | Creates rows? |
|---|---|---|---|
| **Extract** | Fetch from external services into a local file cache | Yes | No — writes files |
| **Load** | Read the cache; insert and update records | Only to read a side database | Yes |
| **Transform** | Repair, merge, normalise, re-link what is already stored | No | Derives and cleans |
| **Enrich** | Derive new facts from stored data alone | No | Derives columns |
| **Validate** | Audit stored records against the cached originals | No | No — writes findings |

The separation is strict and load-bearing. A script that touches the network cannot write derived
data; a script that computes cannot fetch. Loaders write only external metadata — never a computed
column, never a statistic, never a score.

That is what makes it possible for one person to reason about a failure. A wrong number is a
transform bug. A missing record is an extract bug. A record present but wrong is a load bug. The
three can never be confused, because no script is capable of more than one of them.

The distinction that decides where a script belongs is not what it produces but **what it reads**:
a script that opens an external or side database is a *loader*; a script that derives from what is
already stored is an *enricher*. There is no third option.

---

## The worklist: subtract what you already have

Collection does not ask "give me anthropology". It asks, per journal and per year: *what did you
register?* — then subtracts what the database already holds, and fetches only the difference.

The remainder is written to disk as a **worklist**: a list of known-missing identifiers, grouped by
journal and year. The fetchers consume worklists; they never browse.

> **In plain words.** Imagine rebuilding a library's holdings by writing to every publisher, one at
> a time, asking for their catalogue for one year — then crossing off everything you already have
> and requesting only the rest. Then doing it again next month. That is the entire collection
> strategy, and it is the only one available when nobody sells you the list.

Several worklists exist, each answering a different question about what is missing:

- **Missing by journal and year** — the main one. Enumerate a journal's registered catalogue,
  subtract the database's holdings.
- **Missing across sources** — diff the local caches of two sources against each other, so each can
  be brought to parity with the other without touching the network.
- **Missing book identifiers** — books and chapters that have no ISBN, listing the identifier that
  would recover one.
- **Missing cited works** — the works this corpus cites most often but does not hold, ranked by how
  many works here cite them. A frequently-cited absent work is almost certainly a seminal one whose
  own record was never ingested, which makes this list a high-yield acquisition queue rather than
  an error report.

### Books are collected differently

Books are reached by **ISBN**, not by DOI, and a chapter's ISBN generally does not live on the
chapter's own record — it lives on its container book's. So recovering a chapter's edition means
deriving the container's identifier, fetching *that*, and propagating the result back down to the
chapter.

Several collection routes exist purely to make that possible, and a residue remains that is
genuinely unreachable: pre-ISBN digitisations, humanities monographs from platforms that never
registered one, and "chapters" whose container is a serial with an ISSN and no ISBN at all.

---

## Cost is a design constraint, not a footnote

One of the main sources prices its calls by kind:

| Call type | Cost | Practical limit |
|---|---|---|
| Look up one record by its own identifier | **free** | unlimited |
| Filter a list (up to 100 identifiers per call) | $0.0001 | 10,000 calls/day free |
| **Search by text** | **$0.001** | 1,000/day free |

For a self-funded project this reverses the obvious design. Text search is the intuitive way to
find things and is **the scarce resource here**, so the pipeline is built to avoid it:

- resolve by identifier wherever an identifier exists, because that call is free;
- batch up to 100 identifiers into a single filtered call when many are needed;
- treat a name search as a last resort, with a hard cap on how many may be spent per run;
- and note that "free" is a property of the *identifier-namespace URL form*, not of the lookup —
  the convenient URL for the same record is billed, so the pipeline always constructs the free
  form.

The venue resolvers apply the same logic: they try authoritative keys first, and only fall back to
a cleaned title search for venues that carry no key at all — with the search capped and the result
accepted only on an exact normalised-name match.

---

## Caching: the answers are kept, including "no"

Every fetched record is written to disk **verbatim** before anything reads it.

That cache is what makes the database **rebuildable**. A loading rule that turns out to be wrong
can be corrected and re-applied to the original responses — without re-fetching anything, and
without trusting the previous interpretation of them. Given that the understanding of these sources
has changed repeatedly ([chapter 01](01-the-problem.md)), this is not a convenience; it is what
makes the corpus survivable.

**Not-found is cached too.** A miss is a fact about the source, and a valuable one: it means a
subsequent run skips a call it already knows to be fruitless. Misses are recorded in manifests
alongside the data, kept separately for identifier-type queries and ISBN-type queries, because
those answer different questions and a hit on one does not predict the other.

### Two storage tiers

The cache is kept in two tiers, and they are **disjoint** — the working set is not a subset of the
archive but the increment since it was made:

| | Files | Uncompressed | On disk | What it is |
|---|---:|---:|---:|---|
| **Working cache** | 563,964 | ~5.6 GB | 5.6 GB | Records fetched since the archive was made — live, unpacked, directly readable by the loaders |
| **Source archive** | **22,114,859** | **297.5 GB** | 39.7 GB | The accumulated collection to date, in a single `.tar.gz` (plus 74,625 directories) |
| **Total collected** | **22,678,823** | **~303 GB** | 45.3 GB | |

**Twenty-two million cached source responses, 297 GB of JSON**, compressed 7.5 : 1 into a single
archive because JSON of this shape compresses extremely well and 300 GB of small files unpacked is
not a reasonable thing to keep on a working disk. The archive is not needed unpacked except when a
loading rule changes and records have to be re-derived from the originals — which is exactly the
case it exists for.

The working cache is about **2.5% of the collection**: roughly two weeks of fetching. Reporting it
as though it were the whole cache badly understates the collection effort, which is what the two
tiers together actually measure.

That measure is worth stating plainly, because it is the clearest answer to "how much work is this":

> The database's **7,786,681 publications** are the surviving product of **22,678,823 fetched source
> records** — a ratio of about **2.9 : 1**.

A record does not survive one-to-one because it may be fetched from several sources for the same
work, superseded by a later fetch, excluded at ingest by the type and title filters, or merged into
another record by the deduplication in [chapter 05](05-cleaning.md). The gap between the two
numbers *is* the collection and cleaning work.

Neither tier is published or served. They are working material.

### Why cache keys are chosen carefully

A cache key has to be trustworthy, because filters consult filenames before opening files.

DOI-keyed caches are the awkward case: a DOI contains slashes and colons that a filesystem cannot
store, so the mapping to a filename is **lossy in one direction**. Every filter that consults
filenames therefore matches *forward* — build the expected filename from the identifier and compare
— rather than reconstructing an identifier from a filename, which silently mis-derives any DOI
containing multiple slashes or a colon, and would drop those records before their contents were
ever read.

Book and publisher caches are keyed by identifiers that survive the round trip intact, and are
bucketed by a computed path, so the location of a record is always calculated and never searched
for. This matters at the scale involved: with hundreds of thousands of files, "find the file for
this record" must not be a directory walk.

One consequence is specific to OpenLibrary: it is *queried* by ISBN but *answers* with an edition,
and one edition answers for many ISBNs. Only one of the two can name the file, and the record's own
identity wins — so the ISBN a file answers for is not recoverable from its name, and the skip-set
manifests are the only thing that makes a re-run cheap.

---

## Rate limits and failure

Fetching is done through a shared HTTP client with retry and backoff, a rate-limit ceiling, and
escalation when a source returns persistent refusals. The daily runner deliberately does **not**
abort on a failed fetch: a flaky network must not prevent the database work from running, so
collection failures are logged and the run continues. A worklist not fully drained today is drained
tomorrow.

---

next → [05 — Cleaning and repair](05-cleaning.md)
