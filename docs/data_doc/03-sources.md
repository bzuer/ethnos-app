# 03 — Sources

← [The shape of the data](02-data-model.md) · [Index](README.md) · next → [Collection](04-collection.md)

---

Six sources currently feed the corpus, plus two side catalogues consulted only for availability
([chapter 08](08-files-and-availability.md)). Each is used for what it is authoritative about and
explicitly distrusted elsewhere, per the rule in [chapter 01](01-the-problem.md).

## Which source created what

| Source | Publications | Share |
|---|---:|---:|
| Crossref | 5,343,988 | 68.6% |
| OpenAlex | 2,301,855 | 29.6% |
| OpenLibrary | 109,969 | 1.4% |
| Mohr Siebeck | 30,869 | 0.4% |

These counts are the source that *first created* each record. Most records are subsequently
enriched by others, so the table understates how much each source contributes. The two small
sources are not marginal in value: they carry the book description the two large ones structurally
cannot provide.

---

## What each source is trusted for

### Crossref — the registration authority

**Believed about:** DOIs and registration facts; ISBNs; **stated contributor roles** (author vs.
editor vs. translator); licences; reference lists; deposit and indexing timestamps. Free to use on
the polite pool.

**Not believed about:** what a work is *about* — its subject data is thin and inconsistent. Also
mistypes systematically in one known way: it types every record from certain book platforms as a
whole `book`, including each individual chapter, so a chapter arrives claiming to be a book and
carrying its container's ISBN.

Crossref is the closest thing to a ground truth for *identity* — it is where a DOI means something
— and it is the only large free source that states contributor roles rather than flattening them.

### OpenAlex — the graph

**Believed about:** topic classification; the citation graph; institutional affiliations;
open-access status. Very broad coverage.

**Not believed about:** contributor roles — it flattens editors and translators into "authors".
Emits **no ISBN at all**, so its books arrive unidentifiable as editions, which is why the corpus
must re-fetch a book's own identifier from Crossref to recover it.

OpenAlex also prices its API by call type, which turns out to be an architectural constraint rather
than a billing detail — see [chapter 04](04-collection.md).

### OpenLibrary — the book catalogue

**Believed about:** book editions — subtitle, page extent, physical identifiers, publisher, and
above all **subject headings**, which are the richest topical description available for books
anywhere free. Also states editor and translator roles explicitly where the record says so.

**Not believed about:** its `authors` list, which for an edited volume names the *editors* — and
which collides with its own `contributions` field that says so properly. Heading quality varies
from library-grade authority records to shelving noise.

OpenLibrary is reached by ISBN, not DOI, and answers with an *edition*. One edition answers for
many ISBNs, which makes its caching model different from every other source
([chapter 04](04-collection.md)).

### Mohr Siebeck — a publisher's own catalogue

**Believed about:** its own list, exactly. Volume structure of multi-volume critical editions,
series membership, contributor roles in a formal publishing code (ONIX List 17: author, edited by,
in collaboration with, revised by, introduction by), and the publisher's own abbreviations.

**Not believed about:** anything outside its catalogue. Its shop-locale language field, which is
where the record was sold rather than what language the text is in. Its journal keyword field,
which is contaminated — one identical term set is stamped across thousands of articles in unrelated
journals.

This source exists in the corpus for a specific reason: **the aggregators lose structure that the
publisher states outright.** A 70-volume critical edition, catalogued by an index that cannot see
the edition, arrives as scores of unrelated books with no volume numbers. The publisher's own
record states the edition, the volume within it, and the physical manifestation. Nothing else does.

### Scopus — a commercial venue index

**Believed about:** venue-level identity and subject areas for the journals it indexes.

**Not believed about:** coverage. It indexes a curated slice, and silence from it means nothing at
all about a journal.

### SCImago — venue classification and prestige

**Believed about:** venue type, quartile rank, and subject categories. Treated as the most reliable
venue *classifier* available, and therefore applied **last** in the venue loading order, so that it
settles genuine disagreements between the other sources rather than being overwritten by them.

**Not believed about:** anything work-level. Its bibliometrics — h-index, document and citation
counts, coverage years — are deliberately **not** loaded, because the database computes those from
this corpus instead. A number in this database always means "as measured here", never "as claimed
there".

---

## The rule in practice: roles

The clearest illustration of source-specific trust is contributor roles, because it is where the
sources contradict each other constantly and the correct answer is always available.

Roles are stored per work as one of `AUTHOR`, `EDITOR`, `TRANSLATOR`, `REVIEWER`. The governing
principle:

> **`AUTHOR` is a default slot, not a claim.** For a source that emits every contributor as an
> author, "author" means only "a contributor".

From which:

- A source that flattens roles is **marked as such**, and is then forbidden from writing an
  `AUTHOR` row for a person the work already carries under a role that some other source
  *explicitly stated*.
- Only sources that actually state roles — Crossref and Mohr Siebeck — are entitled to
  *reclassify* an existing role.
- Nothing is ever deleted by this rule. A wrong row is suppressed at write time; residue is cleared
  later by an auditable pass that never removes a role no other row carries.
- An editors-only work with no authors is valid, and common. Refusing to record that is how edited
  volumes lose their editors.

Bibliometrics count `AUTHOR` rows only, which is why getting this right matters beyond display: an
editor miscounted as an author distorts every derived statistic about that person.

---

## A source assessed and refused

Not every candidate source is adopted, and recording *why one was refused* is part of the method.

The **SciELO** network — 2,210 journals across Latin America, Iberia and southern Africa, and a
serious presence in this discipline — was evaluated in depth and **not integrated**. Its bulk
export, its citation service and both of its harvesting endpoints are defunct; its book platform is
unreachable; and for the 846 of its journals already present in the corpus, what it adds over the
sources above did not justify an article-by-article sweep at its cost.

The assessment was kept rather than discarded, because two of its findings still constrain the
design:

1. One database column recording SciELO membership can only ever be populated from the network's
   own journal list. It is therefore **empty for the entire network**, and must not be inferred
   from a country code or a DOI prefix — neither of which is the network's actual boundary.
2. SciELO registers **one DOI per language version** under a single article identifier, which is
   why one identifier legitimately meets several DOIs. Without knowing that, the collision looks
   like data corruption and would be "repaired" into a loss.

The full assessment, the endpoint surface and the reproducing scripts are kept in
`audits/scielo/`.

---

## Why provenance is recorded per record

Each publication carries a `source` tag naming the loader that created it, written once and never
overwritten. Registration provenance — the registrant prefix, member id, deposit and index
timestamps — is stored separately and only from Crossref, because the equivalent fields in other
sources mean something different and merging them would produce a column that cannot be
interpreted.

This matters when a record turns out to be wrong. Knowing *which* source produced a claim is what
makes it possible to decide whether the claim was mis-parsed here or mis-stated there — and, when a
loading rule turns out to be wrong, to re-derive every record that rule touched from the cached
originals rather than re-fetching them ([chapter 04](04-collection.md)).

---

next → [04 — Collection](04-collection.md)
