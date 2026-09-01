# 01 — The problem: there is no source

← [Index](README.md) · next → [The shape of the data](02-data-model.md)

---

Every database like this one begins with a question: *where do you get the data?*

For medicine there is PubMed. For physics, arXiv and INSPIRE. For chemistry, CAS. These are
field-wide, well-funded, and largely complete within their scope. A project that needs the
literature of those fields starts by downloading it.

For anthropology there is nothing of the kind. **Not a partial one, not a paid one, not a national
one.** There is no register that can be asked *"list the scholarly literature of anthropology"* and
answer usefully.

This is not an inconvenience to be routed around. It is the founding condition of the project, and
it explains nearly every unusual decision documented in the rest of this folder.

---

## Why the gap exists

Scholarly indexing infrastructure was built around the **journal article**: a short, dated,
individually identified object, deposited by a publisher who wants it found. That model fits the
experimental sciences almost perfectly.

It fits anthropology badly, because a very large part of the discipline's serious work is published
as **books** — monographs, edited volumes, chapters, series, critical editions — and books enter the
indexing system late, partially, or not at all. A monograph may have no DOI. An edited volume may
be registered as a single object with no chapters. A chapter may be registered with no ISBN,
because the ISBN belongs to the container and nobody thought to copy it down.

The consequence is a split that runs through every source available:

- **The article indexes know journals well and books badly.** They can list every paper in a
  journal since 1888, and be unable to tell you an edited volume's chapters, its editors, or its
  ISBN.
- **The library catalogues know books well and articles not at all.** They hold editions, subject
  headings and physical description, and carry no citations, no abstracts, and no notion of a
  journal issue.
- **The commercial indexes are partial and cost money.** They cover a curated slice of journals
  with good metrics attached, and are structurally uninterested in the rest.
- **The publishers' own catalogues are authoritative and tiny.** A publisher knows exactly what it
  published, in which volume, with which contributor in which role — and knows nothing whatever
  about anyone else's list.

There is a second, compounding problem. Anthropology is not a bounded subject area. Its literature
runs through archaeology, linguistics, history, area studies, human biology, development, law and
religion, and a great deal of what the field reads was published under some other discipline's
label. A source that classifies by discipline will therefore either miss most of it, or return a
great deal that is not it.

---

## What follows from that

Since the corpus cannot be downloaded, it has to be **built**: one source at a time, with an
explicit rule for what each source is allowed to say. That rule is the single most important idea
in the project:

> **No source is trusted in general. Each source is trusted only for the things it is actually in a
> position to know.**

A publisher is believed about which volume a book belongs to, and disbelieved about how important
it is. A citation index is believed about who cites whom, and disbelieved about whether a
contributor was an author or an editor. A library catalogue is believed about an edition's page
count, and disbelieved about a person's name.

Every stage documented in this folder is an application of that rule. [Chapter 03](03-sources.md)
sets it out source by source; [chapter 05](05-cleaning.md) shows what happens when two sources
that are each authoritative about something disagree about the same record.

### A corollary: disagreement is usable

Sources disagree constantly, and the disagreements are **not random**. Each source is wrong in a
characteristic direction, for a structural reason — a missing field in its data format, a coverage
boundary, a genre it does not model. Once the direction is known, a disagreement stops being noise
and becomes evidence: you can tell which of two conflicting claims to keep, and why.

A concrete case. A large index reports that an edited volume has fourteen *authors*. A publisher's
record reports two *editors* and twelve chapter authors. The second is believed — not because the
publisher is more virtuous, but because it was in a position to know, and the index was working
from a format with no slot for the distinction.

---

## The other condition: one person

This is a single-person project. The database design, the collection machinery, the cleaning
rules, the scoring model, the API and the website are the work and the responsibility of one
researcher, running on their own hardware, paying their own costs, with the tools they happen to
have access to.

That constraint is visible in the design throughout:

- Where a funded project would buy a licence, this one finds a free route or does without — which
  is why API pricing is a real architectural constraint ([chapter 04](04-collection.md)).
- Where a team would run a labelling operation, this one writes a rule and audits it — which is why
  the relevance model is a small curated table rather than a trained classifier
  ([chapter 06](06-relevance.md)).
- Where an institution would employ curators, this one exports a review list and works through it.
- Everything destructive is previewed by default and reversible by design, because there is no one
  else to catch a mistake ([chapter 09](09-operations.md)).

### It has been rebuilt more than once

Because the field has no canonical source, the understanding of what the available sources actually
contain has itself changed repeatedly — and the corpus has been restructured to match, more than
once. Books were originally modelled as though they behaved like articles; they do not. Contributor
roles were originally taken at face value; they cannot be. Whole subsystems exist because an
earlier assumption turned out to be wrong at scale.

This is not a finished object under maintenance. It is an evolving reading of a very disordered
landscape, and it will change again.

---

next → [02 — The shape of the data](02-data-model.md)
