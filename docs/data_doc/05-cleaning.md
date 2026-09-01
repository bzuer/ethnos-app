# 05 — Cleaning and repair

← [Collection](04-collection.md) · [Index](README.md) · next → [Relevance](06-relevance.md)

---

Most of the code in this project lives here. Of 123 pipeline scripts, **56 do nothing but repair
what the sources delivered**. This is where an entangled landscape is made into something
countable.

Four problems recur, each with a characteristic cause. What follows is each one, its concrete
shape, and the rule adopted against it — because **the rules are more interesting than the counts**,
and they are what the project should be judged by.

---

## Problem 1 — The same thing, recorded many times

One book, deposited by two different registrants, arrives as two records with different
identifiers. One edition issued in cloth, half-leather and PDF arrives as three. A 70-volume
critical edition, whose volumes were catalogued individually by an aggregator that could not see the
edition, arrives as scores of unrelated "books" with no volume numbers.

The naive fix — merge records with the same title — is **catastrophic here**, because a chapter
frequently carries its container's title, its container's ISBN, or both. Merging on title and ISBN
folds a book's chapters into the book and deletes their records.

> **The rule.** A merge requires **positive evidence that two records are the same item**, never
> merely the absence of a difference.

Accepted evidence, any one of which is sufficient within a matching title block:

- an **identical reference fingerprint** (three or more shared references);
- an **identical abstract** of real length, in the same year;
- a **declared identifier alias** — the two records name each other;
- a **shared valid ISBN-13**, for books only, where a first author is not required because books
  frequently carry no author row at all;
- an **identical title with a long abstract** across years, in the same venue and carrier.

And a guard that overrides all of them: a group is dropped whole when one member's own identifier
shows it is a **part** of another — the signature of a chapter sitting under its container. That
guard has to be written precisely. It cannot key on "the identifier mentions the ISBN", because
that is *also* true of the genuine duplicate shape (one book deposited by two registrants, each
embedding the ISBN), and would block the large majority of real merges.

Where several formats of one work are confirmed, they are **not** merged into one record but
re-parented: one work, several publications, which is the true shape. 579 works are currently
marked as confirmed multi-format items, so that no later pass re-splits them.

A separate pass handles the inverse case — several *publication* rows for one edition under a
single work — where the guard is different again: two identifier-bearing rows within one work are
two distinct registered records, so collapsing them would destroy a registered identifier and the
rows would return on the next load. That would be a nightly delete-and-recreate loop rather than
convergence.

---

## Problem 2 — The same person, under many names

An older ingestion records *M Ford*. A later one records *Michele Ford*. Both become people, and
one paper now credits the same human twice.

The tempting fix is to merge the two people. **This project refuses to**, and the reason is worth
stating plainly:

> On a different paper, *M Ford* may be Mark Ford.

Merging people on the basis of an abbreviation destroys information that cannot be recovered.

> **The rule.** Name variants are an **authorship** problem, not a **person** problem.

The repair happens at the level of "who is credited on this specific work", where the other
contributors provide context — and only when the match is **unique on that work**. A paper carrying
both *Jane Smith* and *John Smith* leaves *J Smith* alone.

The evidence is graded, from strict to loose: exact match; one name abbreviating the other position
for position; one given-name sequence being a subsequence of the other; and — admissible only when
an entire contributor list corresponds one-to-one — a coarse surname-plus-initial key. That last
one is what allows a whole flattened author list to be recognised as a copy of a stated one, and it
is **never applied to a single pair**, where two same-initial relatives are a real possibility.

When two renderings do fold together, the survivor is the record carrying an **ORCID** — a durable
researcher identifier — even when that record has the less complete name. A display string is
cosmetic; a resolvable identity is not. The fuller name decides only when ORCID does not separate
them.

This rule is shared deliberately between the loaders and the nightly cleanup. If the loader
suppressed the identifier-bearing rendering, the cleanup could never restore a row that was never
written — and if the two disagreed about which row should survive, the result would be a permanent
write-and-delete loop.

---

## Problem 3 — Roles flattened into "author"

Covered in [chapter 03](03-sources.md): sources without a role field emit every contributor as an
author, and an edited volume's editors silently become its authors.

Since a discipline that publishes heavily in edited volumes depends on that distinction, the
pipeline treats a **stated** role as always outranking a **defaulted** one, suppresses the weaker
claim at write time, and clears the residue in a nightly pass that never deletes a role no other
row carries.

One subtlety is worth recording because it caused a real failure. A single source can contradict
*itself*: a catalogue whose "authors" list names the editors, and whose "contributions" list then
correctly identifies them as editors, will manufacture an author-and-editor pair for the same
person in a single pass. So a record's own author list is filtered against the roles that same
record states, before anything is written.

---

## Problem 4 — The review that stole a book's citations

This one is worth describing in full, because it is the clearest illustration of how tangled the
sources actually are.

A journal publishes a review of a book. The review is registered **under the reviewed book's
title**. Other scholars then cite the book — and because the registry's best match for that title
is the review's identifier, the book's entire citation cluster is deposited against the review.

The result: a two-page review carries a famous monograph's citation count, the monograph itself
sits near zero, and the review's journal is credited with impact it never had. Since venue
bibliometrics are computed from these counts, the error propagates into journal rankings.

**Nothing in the data marks this.** No flag, no field, no source says so.

### The signal

The one number that separates a misdirected review from a genuine article is **the review's own
citation count as the registry reports it** — which is not a column in this database and is not in
the local cache for almost any candidate. It has to be fetched. That is why detection is an
*extract* step and not a transform: the evidence does not exist locally.

Where the stored count says 1,204 and the registry says 5, the record is a review wearing a book's
clothes.

Where the registry reports **more** than the database holds, the record proves itself genuine and
is left alone — which is how a famous essay that later became a book of the same name rejects the
correction automatically, without anyone having to special-case it.

### The correction, and its limits

When the case is confirmed, the citations are moved to the book, the review is reset to its true
count, re-typed as a review, and **permanently linked** to the book it reviews — so that future
citations of the review's identifier resolve to the book instead. Every resolution point in the
pipeline honours that redirect, and the work-merge procedures carry it across edition merges.
4,557 reviews currently hold that link.

And critically: **a title match is never enough.** The registry files the reviewer first and the
reviewed book's authors after, so the review's own record names the book's authors — and that is
required as corroboration. Three verdicts are possible:

| Verdict | Meaning | Action |
|---|---|---|
| corroborated | a stated author is carried by the target work | apply |
| unstated | the review names no additional contributor | apply (absence of evidence, common and benign) |
| contradicted | it names authors and the target carries none | **defer to a human** |

Contradiction defers rather than rejects, because the registry occasionally files a *second
reviewer* in the authors' slot. A disagreement there is unresolved evidence, not a wrong answer.
The last run deferred 120 cases that way, each with its reason recorded.

> **In plain words.** Bibliographic data is not merely incomplete — it is *actively misleading* in
> ways that look completely normal until you check. A record can be well-formed, carry a valid
> identifier, come from a reputable registry, and still describe the wrong object.
>
> The only defence is corroboration: never act on one signal, always require a second one that
> could have disagreed, and when the two conflict, stop and ask a person rather than guessing.

---

## The quieter repairs

Beneath the four problems above sits a layer of normalisation that is unglamorous and load-bearing,
because the deduplication above blocks on normalised values and would fail on dirty ones:

- **Text** — strip markup, decode entities, repair mojibake, normalise Unicode, remove invisible
  characters, trim decorative junk from edges *without* eating a title's question mark. Applied to a
  curated list of free-text columns, never to identifiers, URLs or computed keys, where cleaning
  would corrupt rather than repair.
- **Placeholders** — the literals `none`, `null`, `n/a` and their relatives become actual nulls.
- **Identifiers** — DOIs, ORCIDs and ISSNs are canonicalised; ISBNs are converted to checksum-valid
  ISBN-13 or set to null, never stored as a raw ISBN-10 or an empty string.
- **Names** — parenthetical annotations, embedded birth and death years, stray number tokens and
  broken initials are stripped by one canonical cleaner, shared between the cleaning pass and the
  deduplication key so that both agree on what a name is.
- **Capitalisation** — shouting titles are re-cased; pronounceable acronyms are title-cased while
  spelled-out initialisms and Roman numerals are left alone.
- **Language, licence, venue abbreviation** — normalised to controlled vocabularies.

A recurring lesson from this layer, learned the hard way: string length in characters is not string
length in bytes, and mixing the two in offset arithmetic silently corrupts accented names —
splitting *Jérôme David* into a given name of *Jérôme Da*. In a corpus this multilingual, that is
not an edge case.

---

## Everything destructive is reversible

Merging, re-linking and deleting are the operations that can lose data permanently, so they share
one discipline throughout:

1. **Preview by default.** A run reports what it would do and changes nothing until told to apply.
2. **A full database backup** before the destructive block of the daily run.
3. **A compressed reversal trail** written for every applied step, kept outside the database, dated,
   and sufficient to restore the touched rows verbatim.

The audit trail is not decorative. It is what makes it acceptable for one person to run a merge
across seven million records with nobody reviewing the change.

---

next → [06 — Relevance: scoring and filtering](06-relevance.md)
