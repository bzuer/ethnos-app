# 06 — Relevance: scoring and filtering

← [Cleaning and repair](05-cleaning.md) · [Index](README.md) · next → [What is missing](07-incompleteness.md)

---

Seven point eight million records enter. Which of them are actually anthropology?

This is the hardest question in the project, and it has no clean answer — only a defensible one.

## Why the obvious approaches fail

- **Keyword matching on titles** is hopeless in a discipline whose subject matter is everything
  humans do. There is no word that appears in anthropological titles and not elsewhere.
- **Restricting to a list of anthropology journals** excludes the archaeology, linguistics and
  area-studies literature the field genuinely reads, excludes every book, and would make the corpus
  a list of journals rather than a literature.
- **Asking a source to classify the work** returns *that source's* taxonomy, which was designed for
  a different question — usually for library shelving or for citation-metric normalisation, neither
  of which is "does this belong to this field".
- **Training a classifier** requires labelled data for a field that has none, which is the original
  problem restated.

## What the pipeline does instead

It scores each publication on **the subject tags the sources already attached to it**, against a
hand-curated table saying what each of those tags is worth for a four-field conception of
anthropology: **socio-cultural, biological, archaeological and linguistic**.

The judgement is therefore concentrated in one small, reviewable, human-written table, and
everything else is arithmetic over it.

---

## The tier table

Every scoring decision routes through one curated table. It currently holds **805 rows out of
217,828 distinct subjects** — deliberately small, deliberately reviewable.

| Tier | Weight | Rows | Meaning |
|---|---:|---:|---|
| **A** | 10.0 | 17 | Anthropology itself — *Ethnography*, *Ethnology*, *Social anthropology*, *Medical anthropology*, *Applied anthropology* |
| **B** | 8.0 | 112 | Squarely within a subfield — *Archeology*, *Cultural Studies*, *Colonial History and Postcolonial Studies*, *African Studies and Ethnography* |
| **S** | 6.0 | 61 | Strongly adjacent disciplines the field shares |
| **C** | 5.0 | 195 | Adjacent — enough to place a work nearby, never enough alone to call it core |
| **D** | 2.0 | 126 | Weakly related |
| **E** | 0.5 | 2 | Marginal |
| **N** | **−3.0** | 245 | No four-field reading at all — dentistry, orthodontics, corporate finance, atomic physics |
| **X** | 0.0 | 47 | Explicitly neutral — cataloguing noise such as *General*, *Reference*, *Essays*. Also blocks inheritance |

Tiered rows by vocabulary: OpenLibrary topical headings 238, OpenAlex topics 192 and subfields 98,
Scopus subject areas 112, SCImago categories 105, and the Mohr Siebeck publisher taxonomy 60.

### Weight is not a property of the subject

An important piece of machinery: a subject's *effective* weight is resolved through a single shared
definition, not re-implemented per consumer. It resolves to the curated tier at full weight; or,
for an untiered topic, to **0.6 × its parent's** weight; or to nothing at all when the parent is a
declared catch-all.

Before that shared definition existed, each consumer implemented the propagation rule separately —
and they had drifted apart. That is worth recording as a general lesson: a rule implemented twice
is a rule that will eventually mean two things.

---

## The score

Five terms, each answering a different question, added into one number:

```
score = positive_signal + corroboration − negative_signal + venue_bonus + no_signal_penalty
```

| Term | What it asks | How it is computed |
|---|---|---|
| `positive_signal` | How on-topic is the strongest evidence? | **MAX** effective weight over the record's subjects. Not a sum — one work about one subject states one fact |
| `corroboration` | How much of the record agrees? | **+0.5 per additional distinct on-topic concept, capped at +1.5.** Directly-tiered tags only |
| `negative_signal` | Is there evidence it is *not* in scope? | **MAX** tier-N weight — and only when at least two distinct off-topic concepts agree |
| `venue_bonus` | What does its journal suggest? | +1.0 / +0.5 / 0 / −0.5 by the venue's assessed relevance |
| `no_signal_penalty` | Nothing at all? | −1.0, only when the work has no tiered subject **and** sits in an off-topic venue |

### Worked example — a monograph on kinship and land tenure

| Term | | Value |
|---|---|---:|
| `positive_signal` | strongest tag is tier B | **+8.00** |
| `corroboration` | three further distinct on-topic concepts, capped | **+1.50** |
| `negative_signal` | no off-topic tags | −0.00 |
| `venue_bonus` | container assessed as core | **+1.00** |
| `no_signal_penalty` | has tiered subjects | −0.00 |
| | | |
| **score** | → class **CORE** (≥ 7) | **10.50** |

### Counting concepts, not rows

`corroboration` and the negative-side guard count **normalised terms, never subject identifiers**.

Three of the vocabularies in use derive from the same underlying subject scheme, so one concept can
be present as three separate subject records. Counting records would let a single act of
cataloguing corroborate itself three times over.

The same shape appears in the publisher taxonomy, which stamps a product's entire ancestor chain
onto it: a book carries both its broad publishing area and its narrower area, which is one shelf
assignment stated twice. All nine broad areas are therefore weighted at zero, and positive weight
lives only at the narrower levels.

---

## The four constraints that hold the model honest

Each was adopted because removing it destroyed the model's ability to say "off-topic" at all —
which is the failure state this model was rebuilt out of.

**1. Both negative terms must stay reachable.** Tier N must be seeded, and the venue penalties must
not be gated so narrowly, or exempted so broadly, that they apply to almost nothing. A filter whose
negative side never fires is not a filter.

**2. Inherited relevance is discounted, never full.** An untiered topic inherits **0.6 ×** its
parent's weight, so the best possible inherited score is 10 × 0.6 = **6.00** — deliberately *below*
the core threshold of 7. Something can be placed as adjacent by inheritance; **nothing can be
declared core without evidence of its own.** With undiscounted propagation, a single tangential
topic under a broad parent decides the class for millions of rows.

**3. Identification confidence is never scored as topical relevance.** The database holds a
heuristic estimating how confidently a *book container* was identified — derived from whether it
has a work-level identifier and how many works it holds. Feeding that into a relevance score would
launder "we know what this book is" into "this book is anthropology", inflate book containers above
real journals on zero impact, and make an irrelevant book impossible to find. The heuristic is
therefore marked as provisional in its own record, and **three separate consumers are built to
refuse it**. A book container scores on its own tiered subject headings, or on nothing — 0 being
the honest reading of "no topical evidence", and the one that leaves an irrelevant book findable.

**4. A container may not promote its contents.** On the score lattice, with class cuts at 3 and 7,
a bonus of +1.0 moves a 6 to a 7 and a 2 to a 3 — the container promoting the work into a higher
class on the container's own say-so. The venue bonus is therefore capped below the gap between
adjacent classes. A work is never called core on its journal's authority alone.

### An asymmetry, on purpose

The negative side is deliberately harder to trigger than the positive side. One tag earns full
positive weight; one tag earns **no** negative weight at all, because off-topic evidence must be
corroborated by a second distinct concept.

This is not an oversight. A spurious positive over-includes, and the record survives for review. A
spurious negative marks real material for removal.

And it is not hypothetical. A single mis-assigned *Artificial Intelligence* tag — wrong in two
independent sources at once — is enough to send a sociology monograph to off-topic on one signal.
With the guard, it lands unscored instead, which is to say: in the review queue, where a person can
see it.

Negative signal is also suppressed entirely when the record carries a **direct tier-A or tier-B
tag**: an archaeology paper that also uses computer vision is archaeology.

---

## What comes out

| Class | Cut | Publications | Share |
|---|---|---:|---:|
| **CORE** | ≥ 7 | 2,535,992 | 32.6% |
| **ADJACENT** | ≥ 3 | 3,577,935 | 45.9% |
| **BORDERLINE** | ≥ 0 | 958,942 | 12.3% |
| **UNSCORED** | no tiered tag either way | 709,968 | 9.1% |
| **OFF** | < 0 | **3,844** | **0.05%** |

Mean components per class, which show the model behaving as designed:

| Class | positive | corroboration | negative | venue | score |
|---|---:|---:|---:|---:|---:|
| CORE | 7.58 | 0.74 | 0.00 | 0.60 | 8.93 |
| ADJACENT | 4.69 | 0.20 | 0.00 | 0.41 | 5.30 |
| BORDERLINE | 1.36 | 0.03 | 0.03 | 0.26 | 1.62 |
| UNSCORED | 0.00 | 0.00 | 0.00 | 0.35 | 0.35 |
| OFF | 0.33 | 0.00 | 2.73 | −0.01 | −2.50 |

**UNSCORED is reported separately from BORDERLINE on purpose.** "Weak evidence" and "no evidence"
are opposite findings, and only the second is a task for a human. Collapsing them would hide the
reviewable population inside a merely uncertain one.

---

## Nothing is deleted

> **The scores are a reading list for a person, not a delete key. Nothing in this corpus has ever
> been removed by the relevance model.**

That is the design decision most likely to surprise a technically-minded reader. A filter that
classifies 7.8 million records and deletes nothing looks incomplete.

It is not. The removal path was left out **deliberately**, because in a field with no canonical
source, an automated deletion is an unrecoverable loss of exactly the marginal material that is
hardest to find again. A record wrongly deleted here cannot be re-acquired from anywhere, because
there is nowhere to re-acquire it from.

So the model's real output is a set of **review queues**, exported for human attention:

| Queue | Size | Why it is reviewable |
|---|---:|---|
| One off-topic tag and nothing else | 100,277 | The suppressed-negative case above — a person should look |
| Unscored books and chapters | — | Mostly fixable by tiering one subject heading |
| Records classed OFF | 3,844 | The only population the model actively asserts against |
| Venues ranked by their share of OFF records | — | Finds a wrongly-included journal rather than a wrongly-included article |
| Book containers still on the identification heuristic | 308,785 | Awaiting a real assessment |

Every scored row stores its own terms — including **the off-topic weight observed before the guards
suppressed it**. Without that pair of columns, a record with one suppressed off-topic tag would be
indistinguishable from a record with no tags at all, and those are precisely the rows most worth a
person's time.

---

## Catch-all parents

Four broad subject areas are marked as **not propagating** to their children: *Sociology and
Political Science*, *Education*, *Political Science and International Relations*, and *Law*. An
untiered child of these inherits nothing, and is in scope only if tiered explicitly.

The membership test is **breadth, not subject matter**. *Law* is a tier-C area with forty untiered
children; its inherited 3.00 lands a work at exactly the adjacent floor — so an entire national
legal literature entered the corpus as ADJACENT on inherited evidence alone. Its genuinely
in-scope children — legal anthropology, customary and indigenous law — are curated back
individually, as the other three were.

The unlisted remainder is **not asserted off-topic**. It is asserted *unevidenced*, which is the
conservative direction for a filter: a genuinely anthropological work in that tail almost always
carries a second, directly-tiered tag that reaches it anyway.

---

## Changing the model safely

A tier edit changes the class of potentially millions of records, so it is never applied blind. The
proposed tiers are built into a **shadow database** holding the new table, the shared weight
definition and the venue scores, and the before/after class distribution, transition matrix and
samples are read from there — read-only against production, so previewing new tiers never requires
seeding them live first.

After any tier edit or venue re-classification, venue scoring and relevance must both be re-run, in
that order, because the second reads what the first produces.

---

next → [07 — What is missing](07-incompleteness.md)
