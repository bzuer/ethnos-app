# 07 — What is missing

← [Relevance](06-relevance.md) · [Index](README.md) · next → [Files and availability](08-files-and-availability.md)

---

A corpus assembled the way this one is has holes, and they are not evenly distributed. Naming them
is more useful than reporting a completeness figure, because **each hole marks the edge of what some
source was able to say** — and knowing which edge you are at tells you which questions the data can
answer.

## Field coverage, measured

| | Coverage | |
|---|---:|---|
| Publications with a DOI | 97.4% | |
| Publications placed in a venue | 99.2% | |
| Publications with a date | 100% | |
| Works with a language | 100% | inferred where unstated |
| Works with an abstract | **66.9%** | |
| Citation links resolving to a held work | **59.8%** | |
| Publications flagged open access | 55.3% | |
| Works with a subtitle | 47.1% | |
| People with an ORCID | **34.5%** | |
| Publications with an ISBN | **8.0%** | |

The last figure looks alarming and is not: only books and chapters have ISBNs at all, and they are
635,146 of 7,786,681 publications. Read against that denominator, **95.7% of books and chapters
carry a checksum-valid ISBN-13** — the remaining 27,453 are the backfill target, and a stubborn
residue of them is genuinely ISBN-less: pre-ISBN digitisations, humanities monographs from
platforms that never registered one, and "chapters" whose container is a serial.

---

## The gaps that matter

### Forty percent of citations point outside the corpus

Of 97,343,498 citation links, **58,233,380 resolve** to a work held here. The remaining 39 million
name works that were never ingested.

Some are outside the field entirely — an anthropologist citing a statistics textbook, a lab manual,
a legal code. Others are exactly the books this corpus most wants and cannot reach.

This gap is actionable, and there is a dedicated route for it: unresolved citations are aggregated
by identifier and ranked by **how many works here cite them**. A work cited fifty times by this
corpus and absent from it is almost certainly seminal, and its absence means its own record was
never registered anywhere reachable. That ranking is the highest-yield acquisition queue in the
project — it finds the field's canon by asking the corpus what it keeps pointing at.

### The subject vocabulary is barely tiered where books live

There are **112,478 distinct book subject headings** in the corpus. **238** of them have been
assigned a relevance tier.

This is not a defect in the scoring model. It is a **curation backlog**, and it is the direct cause
of the 709,968 unscored records. Ninety-nine percent of works carry subject tags — 7,629,530 of
7,698,445 — they simply carry tags nobody has yet judged.

The head of that distribution is short and tractable, and much of it is not even subject matter:
shelving noise like *General*, *Reference* and *Essays* belongs in the neutral tier, and
out-of-scope commerce, medicine and engineering belongs in the negative one. The work is
straightforward; it is simply work, and there is one person to do it.

### Most book containers rest on a heuristic, not a judgement

Of 313,860 book containers, **308,785 carry a provisional marker** rather than an assessed
relevance, and **233,350 hold a single work each** — the residue of a per-edition container that has
not yet been consolidated onto the series or edition it belongs to.

The marker is explicitly labelled as provisional in its own record, and three separate parts of the
scoring model are built to refuse it ([chapter 06](06-relevance.md)), precisely so that a
placeholder is never mistaken for an assessment. The real fix is a book-container assessment
programme that does not yet exist — the existing relevance evaluations cover journals only, and no
book container has ever carried a real one.

### Venue assessment is thin

**23,928** venues have been validated against an external register. **315,734** have not — nearly
all of them book containers, which no serial register can validate because they carry no serial
identity at all.

### Structural absences

Some things are missing because no source in use carries them, and adding a column would not help:

- **Series, edition statements, physical format, tables of contents and cover images** are carried
  by the book catalogue and have nowhere to go without a schema change.
- **Venue-level people** — a series' founding editor or editorial board — are stated by the
  publisher source and cannot be stored, because there is no venue-to-person table.
- **Peer-review status, funding for books, and translation lineage** are not systematically stated
  by anything.

---

## What incompleteness is not

None of these numbers is presented as a failure to be embarrassed about. A database of this shape,
built this way, has exactly these gaps — and a version of this documentation reporting 99% coverage
everywhere would be describing a different and less honest system.

What matters is that the gaps are **measured and named**, so that someone using the data knows
which questions it can answer well and which it cannot answer yet.

> **How to read any count from this corpus.** A count here means *"as recorded in this corpus, from
> these sources, as of this date"*. It does not mean *"as published in the world"*.
>
> The absence of a work is **not** evidence that it does not exist. It is evidence that no reachable
> source described it in a way this pipeline could ingest.

This applies with particular force to anything that looks like a trend. The corpus's decade
distribution ([chapter 02](02-data-model.md)) rises steeply toward the present, and that curve is
mostly a property of how registries describe recent material — not a measurement of what the
discipline published.

---

next → [08 — Files and availability](08-files-and-availability.md)
