# The Ethnos Corpus — documentation

This folder documents **the database and the pipeline that fills it**: what the data is, where it comes from, how it is collected, how it is repaired, how it is scored, and what it does not contain. It is the layer beneath [ethnos.app](https://ethnos.app) and [api.ethnos.app](https://api.ethnos.app) — not the site and not the API, which are documented elsewhere.

It is written for two readers at once, who have opposite gaps:

- **the technically fluent reader** who does not know what the data situation in anthropology and the social sciences actually looks like, and
- **the anthropologist or researcher** who knows the literature and not the machinery.

Each chapter therefore leads with the idea in plain language and follows with the mechanism. Nothing requires the previous chapter, but they are ordered the way the data moves.

---

## The short version

There is no field-wide bibliographic database for anthropology. Not an open one, not a paid one, not a partial one. What exists are general-purpose indexes built around the journal article, and library catalogues built around the book, each holding a different fragment of the field and each confidently wrong about the parts it does not cover.

So this corpus is **assembled** rather than downloaded: source by source, with an explicit rule for what each source is allowed to say, a repair layer for the contradictions that result, and a scoring model that says how much evidence exists that a given record belongs to this field. It currently holds **7,698,445 works** and **7,786,681 publications**, distilled from **22,678,823 fetched source records** — 297 GB of cached responses — in a **48 GB** database.

It is the work of one person, on their own hardware, at their own cost.

---

## Chapters

| # | File | What it covers |
| --- | --- | --- |
| 01 | [The problem: there is no source](01-the-problem.md) | Why no field-wide source exists, what each available source can and cannot say, and the trust rule that follows from it |
| 02 | [The shape of the data](02-data-model.md) | Works vs. publications, the entity model, what is actually in the tables |
| 03 | [Sources](03-sources.md) | Every source in use, what it is authoritative for, what it gets wrong, and one that was assessed and refused |
| 04 | [Collection](04-collection.md) | Worklists, API cost as a design constraint, caching, the source archive |
| 05 | [Cleaning and repair](05-cleaning.md) | The four recurring corruptions and the rule adopted against each |
| 06 | [Relevance: scoring and filtering](06-relevance.md) | Tiers, the score, the four constraints, the classes — and why nothing is deleted |
| 07 | [What is missing](07-incompleteness.md) | The measured gaps, and what each one is the boundary of |
| 08 | [Files and availability](08-files-and-availability.md) | What an availability record is, what is not stored, and what is not verified |
| 09 | [Operations](09-operations.md) | The daily run, its ordering constraints, reversibility, and scale |

---

## Relationship to `CLAUDE.md`

`CLAUDE.md` at the repository root is the **directive technical reference** for working _on_ the pipeline: rules, invariants, contracts, and the reasoning that still constrains a decision. It is authoritative, and where these documents and `CLAUDE.md` disagree, `CLAUDE.md` is right and this folder should be corrected.

This folder is the **expository** counterpart, for understanding the corpus rather than modifying it. It explains the same rules instead of specifying them, and adds the context — the state of data in this field, the reasoning behind the design — that a specification has no room for.

Because these documents state rules and not only figures, **a rule change makes them wrong rather than merely stale.** When a rule described here changes, update it here in the same commit.

---

## Reading the figures

Every count in this folder was read directly from the live database on **2026-08-28** and describes its state on that date. The corpus is re-collected, re-cleaned and re-scored daily, so the numbers move. The _claims_ should not.

A count from this corpus means **"as recorded here, from these sources, as of this date"**. It does not mean "as published in the world". The absence of a work is not evidence that it does not exist; it is evidence that no reachable source described it in a way this pipeline could ingest.
