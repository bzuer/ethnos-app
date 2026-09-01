# 09 — Operations

← [Files and availability](08-files-and-availability.md) · [Index](README.md)

---

Everything documented so far runs as one ordered, re-runnable, idempotent script:
`execute.sh` at the repository root. This chapter is how the corpus is actually kept alive, and
what it costs.

## The daily run

| Block | What it does | Cadence |
|---|---|---|
| **1 · Extract** | Venues, works, book editions, book-review detection | Daily to periodic |
| **2 · Load** | Venues, works, organizations, book editions into the database | Daily |
| **3 · Enrich** | Subject hierarchy, language detection, venue abbreviations | Daily |
| **4 · Transform** | Sanitise → persons → subjects → **backup** → organizations → book containers → work and authorship dedup → book-review reattribution → orphan removal → keys → files → recompute | Daily |
| **5 · Finish** | A second orphan sweep, then table optimisation | Daily |

The transform block is the long one, and its internal order is **dependency-driven, not
stylistic**. Each step reads what an earlier step produced:

- Text normalisation precedes deduplication, because duplicate detection blocks on a normalised
  title.
- Person reconciliation precedes statistics, so aggregates are computed on merged people rather
  than on their fragments.
- Work merging precedes authorship deduplication, because merging two works re-parents two
  contributor lists onto one record and creates fresh duplicates for it to clear.
- Book-container consolidation precedes work deduplication, so that book identifiers and containers
  are settled before records are matched on them.
- Book-review reattribution precedes reference resolution, so the redirect it writes takes effect on
  the same run.
- Statistics precede venue scoring; venue scoring precedes relevance scoring. Each reads a table the
  previous one populates.
- File linking runs **after** cleanup, not with the loads — a file row linked before orphan removal
  may be attached to a publication the cleanup then deletes, so linking last spends the side-database
  lookups only on the surviving records.
- Orphan removal runs last among the cleanups. It is the single enforcer of the rule that *a work
  with no publication is deleted*, and it is kept deliberately non-deleting in the final pass, since
  anything removed after the recomputation would leave the freshly-computed numbers stale.

One rule guards the whole layer from a subtle failure mode: **a repair the loaders would undo on the
next ingestion, or a loader write the nightly cleanup then deletes, produces a permanent
write-and-delete loop rather than convergence.** Several rules in this pipeline exist specifically
because that loop was possible, and the loaders and the cleanup were made to share one definition of
which row should survive.

---

## Safety properties

The pipeline is built around four properties, because there is one person and no reviewer.

**Idempotent.** Every step can be re-run. A second consecutive run of the deduplication changes
nothing; the loaders stabilise at zero updates. This is what makes a partial or interrupted run safe
— the fix is always "run it again".

**Preview by default.** Destructive operations report what they would do and change nothing until
explicitly told to apply. The dry run is the default, not a flag.

**Backed up before mutation.** The destructive block begins with a full database dump. Backups run
at roughly 6 GB compressed each.

**Reversible.** Every applied destructive step writes a compressed reversal trail — sufficient to
restore the touched rows verbatim — kept outside the database, dated, in `audits/`. Organization
merges, venue merges, work merges, authorship deduplication, book-identifier normalisation,
book-review reattribution and subject inheritance each have their own trail.

The daily runner deliberately does **not** stop on error. A flaky network fetch must not abort the
database work, so failures are logged and the run continues. The cost of that choice is that a
silent failure can pass unnoticed for a day; the benefit is that one bad API response does not cost
a night's processing.

---

## Scale, in practice

| | |
|---|---:|
| Database | **48.0 GB** — 21.4 GB data, 26.6 GB indexes, 30 tables |
| Largest table | `work_references`, 15.1 GB |
| Working source cache | 563,964 files, 5.6 GB |
| Source archive | **22,114,859 files, 297.5 GB** — 39.7 GB compressed |
| Total source records collected | **22,678,823** |
| Database backups retained | ~17 GB |
| Pipeline code | 123 files, 41,271 lines |

The index-to-data ratio is deliberate. Nearly every access path is an indexed lookup, because a full
scan over a 97-million-row table is not something one person's hardware can afford to do casually.
This has a direct consequence for anyone writing queries against the corpus, and it is worth stating
as a rule:

> **Query the indexed generated column, never the expression it was generated from.** The two
> spellings are equivalent by definition, but the optimiser infers neither from the other — so the
> non-generated spelling silently turns a constant-time lookup into a full table scan.

A related operational hazard, recorded because it wastes hours when it is not known: the database
client's read timeout is a **socket** timeout on the client side, independent of any server setting.
When it expires, the client reports a lost connection *while the server runs the statement to
completion* — so a timeout reads like a network fault. Long-running transforms set it explicitly
above the cost of their slowest step.

---

## What is not automated

Some operations are deliberately on-demand rather than daily, because their inputs cannot be
produced automatically or their effects are policy rather than repair:

- **Relevance tier edits** — previewed in a shadow database, applied by hand
  ([chapter 06](06-relevance.md)).
- **Organization unification at low confidence** — the high-confidence tiers run daily; the looser
  ones need a person to look at the proposed map.
- **Cross-namespace organization merges** — folding a publisher and an institution that share an
  identifier changes what downstream links point at, so it is opt-in.
- **The book-review cases whose book is absent from the corpus** — resolving and ingesting the
  reviewed book is a curated wave, after which reattribution keys on an explicit map rather than a
  title.
- **Publisher-catalogue consolidation** — moving hundreds of books from per-edition containers onto
  their series changes venue statistics substantially, so it is run and verified deliberately.
- **Any removal of a publication from the corpus.** There is no automated path
  ([chapter 06](06-relevance.md)).

The exact invocations for these live in the project's runbook, not here; this chapter documents
*why* they sit outside the daily run.

---

## Testing

There are **no automated tests**, and this is a stated position rather than an omission. The
validation strategy is instead:

- `--limit` and `--dry-run` runs against production data;
- database spot-checks after any change;
- a read-only validation stage that cross-checks stored records against the cached originals and
  writes findings to an audit table rather than fixing anything;
- and the reversibility trail, which makes an incorrect applied change recoverable rather than
  fatal.

For a data pipeline whose inputs are seven external services that change their own behaviour without
notice, a test suite over synthetic fixtures would validate the wrong thing. What matters is whether
the rule holds against the real corpus, and that is what is checked.

---

## Where this sits

| Layer | What it is | Documented |
|---|---|---|
| **1 · The corpus** | This database and its pipeline | **here** |
| **2 · The API** | A public read interface with full-text search and caching — `api.ethnos.app` | elsewhere |
| **3 · The site** | The reading and browsing interface — `ethnos.app` | elsewhere |

The layers are separated for the same reason the pipeline stages are: so that a wrong number can be
traced to one place. If a count on the website looks wrong, it is wrong in the corpus, in the query,
or in the display — three different investigations. **Nothing downstream computes bibliographic
facts.** They are all decided here, under the rules documented in this folder.

---

← [Index](README.md)
