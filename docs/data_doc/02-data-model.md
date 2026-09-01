# 02 — The shape of the data

← [The problem](01-the-problem.md) · [Index](README.md) · next → [Sources](03-sources.md)

---

One distinction governs everything else in this database, and it is worth getting straight before
anything else.

## A work is not a publication

A **work** is the intellectual thing: an argument, a study, a book, written once.

A **publication** is a particular issued version of it: this printing, in this journal issue, with
this DOI, at this page range, in this binding.

One work can have many publications. A book issued in cloth, paperback and PDF is one work and
three publications. An article that later appears as a chapter in an edited volume is one work and
two publications. A translated article registered separately in each language is one work and
several publications.

> **In plain words.** Think of a library catalogue card versus the copies on the shelf. The card is
> the *work*. Each edition, printing and format is a *publication*. This database keeps both, and
> keeps them linked, because most confusion in bibliographic data comes from systems that keep only
> one of the two.

This is not pedantry. It is what makes it possible to count a book's citations once instead of
three times, to let a reader who found one edition see that the others exist, and to record that
two records describing "the same thing" really are the same thing without destroying the
differences between them.

The database is **type-agnostic at the work level**: a work has a title, a subtitle, an abstract
and a language, and nothing else. Whether the thing is an article, a book or a chapter is a
property of the *publication*, because it is the issued object that has a carrier.

---

## The entity model

```
                        work_references
                     (97,343,498 citation links)
                              ↑   ↓
    ┌───────────┐        ┌─────────────┐        ┌────────────┐
    │  PERSONS  │───────▶│    WORKS    │◀───────│  SUBJECTS  │
    │ 4,902,477 │credited│  7,698,445  │ tagged │  217,828   │
    │           │   on   │             │  with  │            │
    └───────────┘        └──────┬──────┘        └────────────┘
     via authorships            │ 1 → n           via work_subjects
     (16,870,149, with role)    ▼                 (85,332,494 links)
    ┌───────────┐        ┌─────────────┐        ┌────────────┐
    │  VENUES   │◀───────│PUBLICATIONS │───────▶│   FILES    │
    │  339,662  │appears │  7,786,681  │ avail- │ 7,173,322  │
    │           │   in   │             │ able as│            │
    └───────────┘        └──────┬──────┘        └────────────┘
                                │ published / funded by
                                ▼
                       ┌──────────────────┐
                       │  ORGANIZATIONS   │
                       │    1,099,971     │
                       └──────────────────┘
```

| Table | Rows | What it holds |
|---|---:|---|
| `works` | 7,698,445 | Title, subtitle, abstract, language. No type. |
| `publications` | 7,786,681 | The issued version: carrier type, DOI, ISBN, dates, venue, pages, licence, source tag |
| `persons` | 4,902,477 | Contributors. 1,689,443 (34.5%) carry an ORCID |
| `authorships` | 16,870,149 | Who is credited on what, **with a role** — author, editor, translator, reviewer |
| `venues` | 339,662 | Journals, series, repositories — and container books (see below) |
| `subjects` | 217,828 | Topical vocabulary across six independent schemes |
| `work_subjects` | 85,332,494 | Which subject is attached to which work |
| `work_references` | 97,343,498 | Citation edges. 58,233,380 (59.8%) resolve to a work held here |
| `organizations` | 1,099,971 | 855,892 institutes, 219,068 funders, 21,314 publishers, 3,697 universities |
| `funding` | 1,092,290 | Grant links between works and funder organizations |
| `files` | 7,173,322 | Availability records — see [chapter 08](08-files-and-availability.md) |

The database occupies **48.0 GB** across 30 tables — 21.4 GB of data and 26.6 GB of indexes. That
ratio is deliberate: nearly every access path in the pipeline and the API is an indexed lookup,
because a full scan over a 97-million-row table is not a thing one person's hardware can afford to
do casually.

---

## The strange one: a book is its own venue

An article's **venue** is its journal. A chapter's venue is *the book it sits in*. So the database
models a container book as a venue in its own right, typed `SOURCE_BOOK`.

This is how a chapter reaches its container's publisher, language, subject headings and identity
**without those being stamped onto the chapter itself**. A chapter is never given the book's
identifiers — that would make the chapter look like the book — so the shared venue is the only
route it has to its container.

It is also why the venue table is dominated not by journals but by books:

| Venue type | Count | What it is |
|---|---:|---|
| `SOURCE_BOOK` | 313,860 | A container book — the venue of its own chapters |
| `JOURNAL` | 24,262 | A serial |
| `REPOSITORY` | 653 | A preprint server or archive |
| `BOOK_SERIES` | 537 | A monograph series |
| `CONFERENCE` | 242 | Proceedings |
| `OTHER` | 108 | Identity unresolved |

Container books are keyed in layers — by a work-level book identifier where one is known, by
ISBN-13 otherwise, and by name only as a last resort — so that the different editions of one book
consolidate onto one container instead of fragmenting. Getting that consolidation right is the
single largest cleaning problem in the project, and it is documented in
[chapter 05](05-cleaning.md).

---

## What kind of things the corpus holds

| Carrier | Publications | Note |
|---|---:|---|
| Article | 7,119,575 | Journal articles — the best-described part of the corpus |
| Book | 394,030 | Monographs, edited volumes, reference works |
| Chapter | 241,116 | Contributions inside a container book |
| Thesis | 11,059 | Dissertations, where a registry carries them |
| Review | 4,584 | Book reviews — assigned by repair, never by a source ([ch. 05](05-cleaning.md)) |
| Report | 2,767 | |
| Preprint | 1,547 | |
| Other | 12,003 | Datasets, conference papers, unclassifiable carriers |

The carrier vocabulary deliberately collapses genre distinctions the sources make and the database
does not need: a monograph is a *book*, a reference entry is a *chapter*, a posted preprint is a
*preprint*. What matters downstream is the physical shape of the thing, because that is what
decides how it is identified, where its metadata lives, and which container it belongs to.

---

## Coverage in time and language

Publications by decade:

| Decade | Publications | | Decade | Publications |
|---|---:|---|---|---:|
| 1900s | 21,960 | | 1970s | 377,229 |
| 1910s | 29,573 | | 1980s | 522,079 |
| 1920s | 49,809 | | 1990s | 744,471 |
| 1930s | 83,792 | | 2000s | 1,140,202 |
| 1940s | 93,952 | | 2010s | 1,917,013 |
| 1950s | 154,784 | | 2020s | 2,373,317 |
| 1960s | 244,704 | | | |

The oldest record is dated 1400. The steep recent rise is partly real growth in publishing and
partly a **coverage effect**: registries describe recent decades far better than old ones. That is
a finding about the sources, not about the discipline — and it is a reason to be careful with any
time-series drawn from this corpus.

Language coverage reflects both the field and the sources' own bias:

| | | | |
|---|---:|---|---:|
| English | 6,422,531 | Italian | 25,311 |
| French | 449,909 | Turkish | 18,817 |
| Portuguese | 289,838 | Polish | 10,370 |
| Spanish | 260,781 | Catalan | 8,882 |
| German | 183,550 | Dutch | 7,319 |

Every work carries a language code. Where no source stated one, it is inferred from the text
itself — one of the few places the pipeline derives a fact rather than recording one.

---

next → [03 — Sources](03-sources.md)
