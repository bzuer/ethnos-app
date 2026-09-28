# 01 --- The problem: there is no source

← [Index](README.md) · next → [The shape of the data](02-data-model.md)

------------------------------------------------------------------------

Every database like this one begins with a question: *where do you get the data?*

For medicine there is PubMed. For physics, arXiv and INSPIRE. For chemistry, CAS. These are field-wide, well-funded, and largely complete within their scope. A project that needs the literature of those fields starts by downloading it.

For anthropology there is nothing of the kind. **Not a partial one, not a paid one, not a national one.** There is no register that can be asked *"list the scholarly literature of anthropology"* and answer usefully.

This is not an inconvenience to be routed around. It is the founding condition of the project, and it explains nearly every unusual decision documented in the rest of this folder.

------------------------------------------------------------------------

## Why the gap exists

Scholarly indexing infrastructure was built around the **journal article**: a short, dated, individually identified object, deposited by a publisher who wants it found. That model fits the experimental sciences almost perfectly.

It fits anthropology badly, because a very large part of the discipline's serious work is published as **books** --- monographs, edited volumes, chapters, series, critical editions --- and books enter the indexing system late, partially, or not at all. A monograph may have no DOI. An edited volume may be registered as a single object with no chapters. A chapter may be registered with no ISBN, because the ISBN belongs to the container and nobody thought to copy it down.

The consequence is a split that runs through every source available:

- **The article indexes know journals well and books badly.** They can list every paper in a journal since 1888, and be unable to tell you an edited volume's chapters, its editors, or its ISBN.
- **The library catalogues know books well and articles not at all.** They hold editions, subject headings and physical description, and carry no citations, no abstracts, and no notion of a journal issue.
- **The commercial indexes are partial and cost money.** They cover a curated slice of journals with good metrics attached, and are structurally uninterested in the rest.
- **The publishers' own catalogues are authoritative and tiny.** A publisher knows exactly what it published, in which volume, with which contributor in which role --- and knows nothing whatever about anyone else's list.

There is a second, compounding problem. Anthropology is not a bounded subject area. Its literature runs through archaeology, linguistics, history, area studies, human biology, development, law and religion, and a great deal of what the field reads was published under some other discipline's label. A source that classifies by discipline will therefore either miss most of it, or return a great deal that is not it.

------------------------------------------------------------------------

## What follows from that

Since the corpus cannot be downloaded, it has to be **built**: one source at a time, with an explicit rule for what each source is allowed to say. That rule is the single most important idea in the project:

> **No source is trusted in general. Each source is trusted only for the things it is actually in a position to know.**

A publisher is believed about which volume a book belongs to, and disbelieved about how important it is. A citation index is believed about who cites whom, and disbelieved about whether a contributor was an author or an editor. A library catalogue is believed about an edition's page count, and disbelieved about a person's name.

Every stage documented in this folder is an application of that rule. [Chapter 03](03-sources.md) sets it out source by source; [chapter 05](05-cleaning.md) shows what happens when two sources that are each authoritative about something disagree about the same record.

### A corollary: disagreement is usable

Sources disagree constantly, and the disagreements are **not random**. Each source is wrong in a characteristic direction, for a structural reason --- a missing field in its data format, a coverage boundary, a genre it does not model. Once the direction is known, a disagreement stops being noise and becomes evidence: you can tell which of two conflicting claims to keep, and why.

A concrete case. A large index reports that an edited volume has fourteen *authors*. A publisher's record reports two *editors* and twelve chapter authors. The second is believed --- not because the publisher is more virtuous, but because it was in a position to know, and the index was working from a format with no slot for the distinction.

------------------------------------------------------------------------

## The other condition: one person

This is a single-person project. The database design, the collection machinery, the cleaning rules, the scoring model, the API and the website are the work and the responsibility of one researcher, running on their own hardware, paying their own costs, with the tools they happen to have access to.

That constraint is visible in the design throughout:

- Where a funded project would buy a licence, this one finds a free route or does without --- which is why API pricing is a real architectural constraint ([chapter 04](04-collection.md)).
- Where a team would run a labelling operation, this one writes a rule and audits it --- which is why the relevance model is a small curated table rather than a trained classifier ([chapter 06](06-relevance.md)).
- Where an institution would employ curators, this one exports a review list and works through it.
- Everything destructive is previewed by default and reversible by design, because there is no one else to catch a mistake ([chapter 09](09-operations.md)).

### It has been rebuilt more than once

Because the field has no canonical source, the understanding of what the available sources actually contain has itself changed repeatedly --- and the corpus has been restructured to match, more than once. Books were originally modelled as though they behaved like articles; they do not. Contributor roles were originally taken at face value; they cannot be. Whole subsystems exist because an earlier assumption turned out to be wrong at scale.

This is not a finished object under maintenance. It is an evolving reading of a very disordered landscape, and it will change again.

------------------------------------------------------------------------

next → [02 --- The shape of the data](02-data-model.md)

# 02 --- The shape of the data

← [The problem](01-the-problem.md) · [Index](README.md) · next → [Sources](03-sources.md)

------------------------------------------------------------------------

One distinction governs everything else in this database, and it is worth getting straight before anything else.

## A work is not a publication

A **work** is the intellectual thing: an argument, a study, a book, written once.

A **publication** is a particular issued version of it: this printing, in this journal issue, with this DOI, at this page range, in this binding.

One work can have many publications. A book issued in cloth, paperback and PDF is one work and three publications. An article that later appears as a chapter in an edited volume is one work and two publications. A translated article registered separately in each language is one work and several publications.

> **In plain words.** Think of a library catalogue card versus the copies on the shelf. The card is the *work*. Each edition, printing and format is a *publication*. This database keeps both, and keeps them linked, because most confusion in bibliographic data comes from systems that keep only one of the two.

This is not pedantry. It is what makes it possible to count a book's citations once instead of three times, to let a reader who found one edition see that the others exist, and to record that two records describing "the same thing" really are the same thing without destroying the differences between them.

The database is **type-agnostic at the work level**: a work has a title, a subtitle, an abstract and a language, and nothing else. Whether the thing is an article, a book or a chapter is a property of the *publication*, because it is the issued object that has a carrier.

------------------------------------------------------------------------

## The entity model

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

  ---------------------------------------------------------------------------------------------------------------------------------------
  Table                                      Rows What it holds
  ----------------------- ----------------------- ---------------------------------------------------------------------------------------
  `works`                               7,698,445 Title, subtitle, abstract, language. No type.

  `publications`                        7,786,681 The issued version: carrier type, DOI, ISBN, dates, venue, pages, licence, source tag

  `persons`                             4,902,477 Contributors. 1,689,443 (34.5%) carry an ORCID

  `authorships`                        16,870,149 Who is credited on what, **with a role** --- author, editor, translator, reviewer

  `venues`                                339,662 Journals, series, repositories --- and container books (see below)

  `subjects`                              217,828 Topical vocabulary across six independent schemes

  `work_subjects`                      85,332,494 Which subject is attached to which work

  `work_references`                    97,343,498 Citation edges. 58,233,380 (59.8%) resolve to a work held here

  `organizations`                       1,099,971 855,892 institutes, 219,068 funders, 21,314 publishers, 3,697 universities

  `funding`                             1,092,290 Grant links between works and funder organizations

  `files`                               7,173,322 Availability records --- see [chapter 08](08-files-and-availability.md)
  ---------------------------------------------------------------------------------------------------------------------------------------

The database occupies **48.0 GB** across 30 tables --- 21.4 GB of data and 26.6 GB of indexes. That ratio is deliberate: nearly every access path in the pipeline and the API is an indexed lookup, because a full scan over a 97-million-row table is not a thing one person's hardware can afford to do casually.

------------------------------------------------------------------------

## The strange one: a book is its own venue

An article's **venue** is its journal. A chapter's venue is *the book it sits in*. So the database models a container book as a venue in its own right, typed `SOURCE_BOOK`.

This is how a chapter reaches its container's publisher, language, subject headings and identity **without those being stamped onto the chapter itself**. A chapter is never given the book's identifiers --- that would make the chapter look like the book --- so the shared venue is the only route it has to its container.

It is also why the venue table is dominated not by journals but by books:

  ------------------------------------------------------------------------------
  Venue type          Count What it is
  --------------- --------- ----------------------------------------------------
  `SOURCE_BOOK`     313,860 A container book --- the venue of its own chapters

  `JOURNAL`          24,262 A serial

  `REPOSITORY`          653 A preprint server or archive

  `BOOK_SERIES`         537 A monograph series

  `CONFERENCE`          242 Proceedings

  `OTHER`               108 Identity unresolved
  ------------------------------------------------------------------------------

Container books are keyed in layers --- by a work-level book identifier where one is known, by ISBN-13 otherwise, and by name only as a last resort --- so that the different editions of one book consolidate onto one container instead of fragmenting. Getting that consolidation right is the single largest cleaning problem in the project, and it is documented in [chapter 05](05-cleaning.md).

------------------------------------------------------------------------

## What kind of things the corpus holds

  -----------------------------------------------------------------------------------------------------------------------------------
  Carrier                            Publications Note
  ----------------------- ----------------------- -----------------------------------------------------------------------------------
  Article                               7,119,575 Journal articles --- the best-described part of the corpus

  Book                                    394,030 Monographs, edited volumes, reference works

  Chapter                                 241,116 Contributions inside a container book

  Thesis                                   11,059 Dissertations, where a registry carries them

  Review                                    4,584 Book reviews --- assigned by repair, never by a source ([ch. 05](05-cleaning.md))

  Report                                    2,767 

  Preprint                                  1,547 

  Other                                    12,003 Datasets, conference papers, unclassifiable carriers
  -----------------------------------------------------------------------------------------------------------------------------------

The carrier vocabulary deliberately collapses genre distinctions the sources make and the database does not need: a monograph is a *book*, a reference entry is a *chapter*, a posted preprint is a *preprint*. What matters downstream is the physical shape of the thing, because that is what decides how it is identified, where its metadata lives, and which container it belongs to.

------------------------------------------------------------------------

## Coverage in time and language

Publications by decade:

  Decade     Publications    Decade     Publications
  -------- -------------- -- -------- --------------
  1900s            21,960    1970s           377,229
  1910s            29,573    1980s           522,079
  1920s            49,809    1990s           744,471
  1930s            83,792    2000s         1,140,202
  1940s            93,952    2010s         1,917,013
  1950s           154,784    2020s         2,373,317
  1960s           244,704             

The oldest record is dated 1400. The steep recent rise is partly real growth in publishing and partly a **coverage effect**: registries describe recent decades far better than old ones. That is a finding about the sources, not about the discipline --- and it is a reason to be careful with any time-series drawn from this corpus.

Language coverage reflects both the field and the sources' own bias:

  ------------ ----------- --------- --------
  English        6,422,531 Italian     25,311
  French           449,909 Turkish     18,817
  Portuguese       289,838 Polish      10,370
  Spanish          260,781 Catalan      8,882
  German           183,550 Dutch        7,319
  ------------ ----------- --------- --------

Every work carries a language code. Where no source stated one, it is inferred from the text itself --- one of the few places the pipeline derives a fact rather than recording one.

------------------------------------------------------------------------

next → [03 --- Sources](03-sources.md)

# 03 --- Sources

← [The shape of the data](02-data-model.md) · [Index](README.md) · next → [Collection](04-collection.md)

------------------------------------------------------------------------

Six sources currently feed the corpus, plus two side catalogues consulted only for availability ([chapter 08](08-files-and-availability.md)). Each is used for what it is authoritative about and explicitly distrusted elsewhere, per the rule in [chapter 01](01-the-problem.md).

## Which source created what

  Source           Publications   Share
  -------------- -------------- -------
  Crossref            5,343,988   68.6%
  OpenAlex            2,301,855   29.6%
  OpenLibrary           109,969    1.4%
  Mohr Siebeck           30,869    0.4%

These counts are the source that *first created* each record. Most records are subsequently enriched by others, so the table understates how much each source contributes. The two small sources are not marginal in value: they carry the book description the two large ones structurally cannot provide.

------------------------------------------------------------------------

## What each source is trusted for

### Crossref --- the registration authority

**Believed about:** DOIs and registration facts; ISBNs; **stated contributor roles** (author vs. editor vs. translator); licences; reference lists; deposit and indexing timestamps. Free to use on the polite pool.

**Not believed about:** what a work is *about* --- its subject data is thin and inconsistent. Also mistypes systematically in one known way: it types every record from certain book platforms as a whole `book`, including each individual chapter, so a chapter arrives claiming to be a book and carrying its container's ISBN.

Crossref is the closest thing to a ground truth for *identity* --- it is where a DOI means something --- and it is the only large free source that states contributor roles rather than flattening them.

### OpenAlex --- the graph

**Believed about:** topic classification; the citation graph; institutional affiliations; open-access status. Very broad coverage.

**Not believed about:** contributor roles --- it flattens editors and translators into "authors". Emits **no ISBN at all**, so its books arrive unidentifiable as editions, which is why the corpus must re-fetch a book's own identifier from Crossref to recover it.

OpenAlex also prices its API by call type, which turns out to be an architectural constraint rather than a billing detail --- see [chapter 04](04-collection.md).

### OpenLibrary --- the book catalogue

**Believed about:** book editions --- subtitle, page extent, physical identifiers, publisher, and above all **subject headings**, which are the richest topical description available for books anywhere free. Also states editor and translator roles explicitly where the record says so.

**Not believed about:** its `authors` list, which for an edited volume names the *editors* --- and which collides with its own `contributions` field that says so properly. Heading quality varies from library-grade authority records to shelving noise.

OpenLibrary is reached by ISBN, not DOI, and answers with an *edition*. One edition answers for many ISBNs, which makes its caching model different from every other source ([chapter 04](04-collection.md)).

### Mohr Siebeck --- a publisher's own catalogue

**Believed about:** its own list, exactly. Volume structure of multi-volume critical editions, series membership, contributor roles in a formal publishing code (ONIX List 17: author, edited by, in collaboration with, revised by, introduction by), and the publisher's own abbreviations.

**Not believed about:** anything outside its catalogue. Its shop-locale language field, which is where the record was sold rather than what language the text is in. Its journal keyword field, which is contaminated --- one identical term set is stamped across thousands of articles in unrelated journals.

This source exists in the corpus for a specific reason: **the aggregators lose structure that the publisher states outright.** A 70-volume critical edition, catalogued by an index that cannot see the edition, arrives as scores of unrelated books with no volume numbers. The publisher's own record states the edition, the volume within it, and the physical manifestation. Nothing else does.

### Scopus --- a commercial venue index

**Believed about:** venue-level identity and subject areas for the journals it indexes.

**Not believed about:** coverage. It indexes a curated slice, and silence from it means nothing at all about a journal.

### SCImago --- venue classification and prestige

**Believed about:** venue type, quartile rank, and subject categories. Treated as the most reliable venue *classifier* available, and therefore applied **last** in the venue loading order, so that it settles genuine disagreements between the other sources rather than being overwritten by them.

**Not believed about:** anything work-level. Its bibliometrics --- h-index, document and citation counts, coverage years --- are deliberately **not** loaded, because the database computes those from this corpus instead. A number in this database always means "as measured here", never "as claimed there".

------------------------------------------------------------------------

## The rule in practice: roles

The clearest illustration of source-specific trust is contributor roles, because it is where the sources contradict each other constantly and the correct answer is always available.

Roles are stored per work as one of `AUTHOR`, `EDITOR`, `TRANSLATOR`, `REVIEWER`. The governing principle:

> **`AUTHOR` is a default slot, not a claim.** For a source that emits every contributor as an author, "author" means only "a contributor".

From which:

- A source that flattens roles is **marked as such**, and is then forbidden from writing an `AUTHOR` row for a person the work already carries under a role that some other source *explicitly stated*.
- Only sources that actually state roles --- Crossref and Mohr Siebeck --- are entitled to *reclassify* an existing role.
- Nothing is ever deleted by this rule. A wrong row is suppressed at write time; residue is cleared later by an auditable pass that never removes a role no other row carries.
- An editors-only work with no authors is valid, and common. Refusing to record that is how edited volumes lose their editors.

Bibliometrics count `AUTHOR` rows only, which is why getting this right matters beyond display: an editor miscounted as an author distorts every derived statistic about that person.

------------------------------------------------------------------------

## A source assessed and refused

Not every candidate source is adopted, and recording *why one was refused* is part of the method.

The **SciELO** network --- 2,210 journals across Latin America, Iberia and southern Africa, and a serious presence in this discipline --- was evaluated in depth and **not integrated**. Its bulk export, its citation service and both of its harvesting endpoints are defunct; its book platform is unreachable; and for the 846 of its journals already present in the corpus, what it adds over the sources above did not justify an article-by-article sweep at its cost.

The assessment was kept rather than discarded, because two of its findings still constrain the design:

1.  One database column recording SciELO membership can only ever be populated from the network's own journal list. It is therefore **empty for the entire network**, and must not be inferred from a country code or a DOI prefix --- neither of which is the network's actual boundary.
2.  SciELO registers **one DOI per language version** under a single article identifier, which is why one identifier legitimately meets several DOIs. Without knowing that, the collision looks like data corruption and would be "repaired" into a loss.

The full assessment, the endpoint surface and the reproducing scripts are kept in `audits/scielo/`.

------------------------------------------------------------------------

## Why provenance is recorded per record

Each publication carries a `source` tag naming the loader that created it, written once and never overwritten. Registration provenance --- the registrant prefix, member id, deposit and index timestamps --- is stored separately and only from Crossref, because the equivalent fields in other sources mean something different and merging them would produce a column that cannot be interpreted.

This matters when a record turns out to be wrong. Knowing *which* source produced a claim is what makes it possible to decide whether the claim was mis-parsed here or mis-stated there --- and, when a loading rule turns out to be wrong, to re-derive every record that rule touched from the cached originals rather than re-fetching them ([chapter 04](04-collection.md)).

------------------------------------------------------------------------

next → [04 --- Collection](04-collection.md)

# 04 --- Collection

← [Sources](03-sources.md) · [Index](README.md) · next → [Cleaning and repair](05-cleaning.md)

------------------------------------------------------------------------

There is no button that returns a discipline. Collection is a loop of asking narrow, answerable questions and keeping every answer --- including the answer "nothing".

## The five stages, and why they are separate

  ------------------------------------------------------------------------------------------------------------------------------------
  Stage             Role                                                       Network?                       Creates rows?
  ----------------- ---------------------------------------------------------- ------------------------------ ------------------------
  **Extract**       Fetch from external services into a local file cache       Yes                            No --- writes files

  **Load**          Read the cache; insert and update records                  Only to read a side database   Yes

  **Transform**     Repair, merge, normalise, re-link what is already stored   No                             Derives and cleans

  **Enrich**        Derive new facts from stored data alone                    No                             Derives columns

  **Validate**      Audit stored records against the cached originals          No                             No --- writes findings
  ------------------------------------------------------------------------------------------------------------------------------------

The separation is strict and load-bearing. A script that touches the network cannot write derived data; a script that computes cannot fetch. Loaders write only external metadata --- never a computed column, never a statistic, never a score.

That is what makes it possible for one person to reason about a failure. A wrong number is a transform bug. A missing record is an extract bug. A record present but wrong is a load bug. The three can never be confused, because no script is capable of more than one of them.

The distinction that decides where a script belongs is not what it produces but **what it reads**: a script that opens an external or side database is a *loader*; a script that derives from what is already stored is an *enricher*. There is no third option.

------------------------------------------------------------------------

## The worklist: subtract what you already have

Collection does not ask "give me anthropology". It asks, per journal and per year: *what did you register?* --- then subtracts what the database already holds, and fetches only the difference.

The remainder is written to disk as a **worklist**: a list of known-missing identifiers, grouped by journal and year. The fetchers consume worklists; they never browse.

> **In plain words.** Imagine rebuilding a library's holdings by writing to every publisher, one at a time, asking for their catalogue for one year --- then crossing off everything you already have and requesting only the rest. Then doing it again next month. That is the entire collection strategy, and it is the only one available when nobody sells you the list.

Several worklists exist, each answering a different question about what is missing:

- **Missing by journal and year** --- the main one. Enumerate a journal's registered catalogue, subtract the database's holdings.
- **Missing across sources** --- diff the local caches of two sources against each other, so each can be brought to parity with the other without touching the network.
- **Missing book identifiers** --- books and chapters that have no ISBN, listing the identifier that would recover one.
- **Missing cited works** --- the works this corpus cites most often but does not hold, ranked by how many works here cite them. A frequently-cited absent work is almost certainly a seminal one whose own record was never ingested, which makes this list a high-yield acquisition queue rather than an error report.

### Books are collected differently

Books are reached by **ISBN**, not by DOI, and a chapter's ISBN generally does not live on the chapter's own record --- it lives on its container book's. So recovering a chapter's edition means deriving the container's identifier, fetching *that*, and propagating the result back down to the chapter.

Several collection routes exist purely to make that possible, and a residue remains that is genuinely unreachable: pre-ISBN digitisations, humanities monographs from platforms that never registered one, and "chapters" whose container is a serial with an ISSN and no ISBN at all.

------------------------------------------------------------------------

## Cost is a design constraint, not a footnote

One of the main sources prices its calls by kind:

  ------------------------------------------------------------------------------------------------
  Call type                                        Cost                    Practical limit
  ------------------------------------------------ ----------------------- -----------------------
  Look up one record by its own identifier         **free**                unlimited

  Filter a list (up to 100 identifiers per call)   \$0.0001                10,000 calls/day free

  **Search by text**                               **\$0.001**             1,000/day free
  ------------------------------------------------------------------------------------------------

For a self-funded project this reverses the obvious design. Text search is the intuitive way to find things and is **the scarce resource here**, so the pipeline is built to avoid it:

- resolve by identifier wherever an identifier exists, because that call is free;
- batch up to 100 identifiers into a single filtered call when many are needed;
- treat a name search as a last resort, with a hard cap on how many may be spent per run;
- and note that "free" is a property of the *identifier-namespace URL form*, not of the lookup --- the convenient URL for the same record is billed, so the pipeline always constructs the free form.

The venue resolvers apply the same logic: they try authoritative keys first, and only fall back to a cleaned title search for venues that carry no key at all --- with the search capped and the result accepted only on an exact normalised-name match.

------------------------------------------------------------------------

## Caching: the answers are kept, including "no"

Every fetched record is written to disk **verbatim** before anything reads it.

That cache is what makes the database **rebuildable**. A loading rule that turns out to be wrong can be corrected and re-applied to the original responses --- without re-fetching anything, and without trusting the previous interpretation of them. Given that the understanding of these sources has changed repeatedly ([chapter 01](01-the-problem.md)), this is not a convenience; it is what makes the corpus survivable.

**Not-found is cached too.** A miss is a fact about the source, and a valuable one: it means a subsequent run skips a call it already knows to be fruitless. Misses are recorded in manifests alongside the data, kept separately for identifier-type queries and ISBN-type queries, because those answer different questions and a hit on one does not predict the other.

### Two storage tiers

The cache is kept in two tiers, and they are **disjoint** --- the working set is not a subset of the archive but the increment since it was made:

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
                                   Files   Uncompressed        On disk What it is
  --------------------- ---------------- -------------- -------------- -------------------------------------------------------------------------------------------------
  **Working cache**              563,964       \~5.6 GB         5.6 GB Records fetched since the archive was made --- live, unpacked, directly readable by the loaders

  **Source archive**      **22,114,859**   **297.5 GB**        39.7 GB The accumulated collection to date, in a single `.tar.gz` (plus 74,625 directories)

  **Total collected**     **22,678,823**   **\~303 GB**        45.3 GB 
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Twenty-two million cached source responses, 297 GB of JSON**, compressed 7.5 : 1 into a single archive because JSON of this shape compresses extremely well and 300 GB of small files unpacked is not a reasonable thing to keep on a working disk. The archive is not needed unpacked except when a loading rule changes and records have to be re-derived from the originals --- which is exactly the case it exists for.

The working cache is about **2.5% of the collection**: roughly two weeks of fetching. Reporting it as though it were the whole cache badly understates the collection effort, which is what the two tiers together actually measure.

That measure is worth stating plainly, because it is the clearest answer to "how much work is this":

> The database's **7,786,681 publications** are the surviving product of **22,678,823 fetched source records** --- a ratio of about **2.9 : 1**.

A record does not survive one-to-one because it may be fetched from several sources for the same work, superseded by a later fetch, excluded at ingest by the type and title filters, or merged into another record by the deduplication in [chapter 05](05-cleaning.md). The gap between the two numbers *is* the collection and cleaning work.

Neither tier is published or served. They are working material.

### Why cache keys are chosen carefully

A cache key has to be trustworthy, because filters consult filenames before opening files.

DOI-keyed caches are the awkward case: a DOI contains slashes and colons that a filesystem cannot store, so the mapping to a filename is **lossy in one direction**. Every filter that consults filenames therefore matches *forward* --- build the expected filename from the identifier and compare --- rather than reconstructing an identifier from a filename, which silently mis-derives any DOI containing multiple slashes or a colon, and would drop those records before their contents were ever read.

Book and publisher caches are keyed by identifiers that survive the round trip intact, and are bucketed by a computed path, so the location of a record is always calculated and never searched for. This matters at the scale involved: with hundreds of thousands of files, "find the file for this record" must not be a directory walk.

One consequence is specific to OpenLibrary: it is *queried* by ISBN but *answers* with an edition, and one edition answers for many ISBNs. Only one of the two can name the file, and the record's own identity wins --- so the ISBN a file answers for is not recoverable from its name, and the skip-set manifests are the only thing that makes a re-run cheap.

------------------------------------------------------------------------

## Rate limits and failure

Fetching is done through a shared HTTP client with retry and backoff, a rate-limit ceiling, and escalation when a source returns persistent refusals. The daily runner deliberately does **not** abort on a failed fetch: a flaky network must not prevent the database work from running, so collection failures are logged and the run continues. A worklist not fully drained today is drained tomorrow.

------------------------------------------------------------------------

next → [05 --- Cleaning and repair](05-cleaning.md)

# 05 --- Cleaning and repair

← [Collection](04-collection.md) · [Index](README.md) · next → [Relevance](06-relevance.md)

------------------------------------------------------------------------

Most of the code in this project lives here. Of 123 pipeline scripts, **56 do nothing but repair what the sources delivered**. This is where an entangled landscape is made into something countable.

Four problems recur, each with a characteristic cause. What follows is each one, its concrete shape, and the rule adopted against it --- because **the rules are more interesting than the counts**, and they are what the project should be judged by.

------------------------------------------------------------------------

## Problem 1 --- The same thing, recorded many times

One book, deposited by two different registrants, arrives as two records with different identifiers. One edition issued in cloth, half-leather and PDF arrives as three. A 70-volume critical edition, whose volumes were catalogued individually by an aggregator that could not see the edition, arrives as scores of unrelated "books" with no volume numbers.

The naive fix --- merge records with the same title --- is **catastrophic here**, because a chapter frequently carries its container's title, its container's ISBN, or both. Merging on title and ISBN folds a book's chapters into the book and deletes their records.

> **The rule.** A merge requires **positive evidence that two records are the same item**, never merely the absence of a difference.

Accepted evidence, any one of which is sufficient within a matching title block:

- an **identical reference fingerprint** (three or more shared references);
- an **identical abstract** of real length, in the same year;
- a **declared identifier alias** --- the two records name each other;
- a **shared valid ISBN-13**, for books only, where a first author is not required because books frequently carry no author row at all;
- an **identical title with a long abstract** across years, in the same venue and carrier.

And a guard that overrides all of them: a group is dropped whole when one member's own identifier shows it is a **part** of another --- the signature of a chapter sitting under its container. That guard has to be written precisely. It cannot key on "the identifier mentions the ISBN", because that is *also* true of the genuine duplicate shape (one book deposited by two registrants, each embedding the ISBN), and would block the large majority of real merges.

Where several formats of one work are confirmed, they are **not** merged into one record but re-parented: one work, several publications, which is the true shape. 579 works are currently marked as confirmed multi-format items, so that no later pass re-splits them.

A separate pass handles the inverse case --- several *publication* rows for one edition under a single work --- where the guard is different again: two identifier-bearing rows within one work are two distinct registered records, so collapsing them would destroy a registered identifier and the rows would return on the next load. That would be a nightly delete-and-recreate loop rather than convergence.

------------------------------------------------------------------------

## Problem 2 --- The same person, under many names

An older ingestion records *M Ford*. A later one records *Michele Ford*. Both become people, and one paper now credits the same human twice.

The tempting fix is to merge the two people. **This project refuses to**, and the reason is worth stating plainly:

> On a different paper, *M Ford* may be Mark Ford.

Merging people on the basis of an abbreviation destroys information that cannot be recovered.

> **The rule.** Name variants are an **authorship** problem, not a **person** problem.

The repair happens at the level of "who is credited on this specific work", where the other contributors provide context --- and only when the match is **unique on that work**. A paper carrying both *Jane Smith* and *John Smith* leaves *J Smith* alone.

The evidence is graded, from strict to loose: exact match; one name abbreviating the other position for position; one given-name sequence being a subsequence of the other; and --- admissible only when an entire contributor list corresponds one-to-one --- a coarse surname-plus-initial key. That last one is what allows a whole flattened author list to be recognised as a copy of a stated one, and it is **never applied to a single pair**, where two same-initial relatives are a real possibility.

When two renderings do fold together, the survivor is the record carrying an **ORCID** --- a durable researcher identifier --- even when that record has the less complete name. A display string is cosmetic; a resolvable identity is not. The fuller name decides only when ORCID does not separate them.

This rule is shared deliberately between the loaders and the nightly cleanup. If the loader suppressed the identifier-bearing rendering, the cleanup could never restore a row that was never written --- and if the two disagreed about which row should survive, the result would be a permanent write-and-delete loop.

------------------------------------------------------------------------

## Problem 3 --- Roles flattened into "author"

Covered in [chapter 03](03-sources.md): sources without a role field emit every contributor as an author, and an edited volume's editors silently become its authors.

Since a discipline that publishes heavily in edited volumes depends on that distinction, the pipeline treats a **stated** role as always outranking a **defaulted** one, suppresses the weaker claim at write time, and clears the residue in a nightly pass that never deletes a role no other row carries.

One subtlety is worth recording because it caused a real failure. A single source can contradict *itself*: a catalogue whose "authors" list names the editors, and whose "contributions" list then correctly identifies them as editors, will manufacture an author-and-editor pair for the same person in a single pass. So a record's own author list is filtered against the roles that same record states, before anything is written.

------------------------------------------------------------------------

## Problem 4 --- The review that stole a book's citations

This one is worth describing in full, because it is the clearest illustration of how tangled the sources actually are.

A journal publishes a review of a book. The review is registered **under the reviewed book's title**. Other scholars then cite the book --- and because the registry's best match for that title is the review's identifier, the book's entire citation cluster is deposited against the review.

The result: a two-page review carries a famous monograph's citation count, the monograph itself sits near zero, and the review's journal is credited with impact it never had. Since venue bibliometrics are computed from these counts, the error propagates into journal rankings.

**Nothing in the data marks this.** No flag, no field, no source says so.

### The signal

The one number that separates a misdirected review from a genuine article is **the review's own citation count as the registry reports it** --- which is not a column in this database and is not in the local cache for almost any candidate. It has to be fetched. That is why detection is an *extract* step and not a transform: the evidence does not exist locally.

Where the stored count says 1,204 and the registry says 5, the record is a review wearing a book's clothes.

Where the registry reports **more** than the database holds, the record proves itself genuine and is left alone --- which is how a famous essay that later became a book of the same name rejects the correction automatically, without anyone having to special-case it.

### The correction, and its limits

When the case is confirmed, the citations are moved to the book, the review is reset to its true count, re-typed as a review, and **permanently linked** to the book it reviews --- so that future citations of the review's identifier resolve to the book instead. Every resolution point in the pipeline honours that redirect, and the work-merge procedures carry it across edition merges. 4,557 reviews currently hold that link.

And critically: **a title match is never enough.** The registry files the reviewer first and the reviewed book's authors after, so the review's own record names the book's authors --- and that is required as corroboration. Three verdicts are possible:

  ------------------------------------------------------------------------------------------------------------------------
  Verdict                 Meaning                                         Action
  ----------------------- ----------------------------------------------- ------------------------------------------------
  corroborated            a stated author is carried by the target work   apply

  unstated                the review names no additional contributor      apply (absence of evidence, common and benign)

  contradicted            it names authors and the target carries none    **defer to a human**
  ------------------------------------------------------------------------------------------------------------------------

Contradiction defers rather than rejects, because the registry occasionally files a *second reviewer* in the authors' slot. A disagreement there is unresolved evidence, not a wrong answer. The last run deferred 120 cases that way, each with its reason recorded.

> **In plain words.** Bibliographic data is not merely incomplete --- it is *actively misleading* in ways that look completely normal until you check. A record can be well-formed, carry a valid identifier, come from a reputable registry, and still describe the wrong object.
>
> The only defence is corroboration: never act on one signal, always require a second one that could have disagreed, and when the two conflict, stop and ask a person rather than guessing.

------------------------------------------------------------------------

## The quieter repairs

Beneath the four problems above sits a layer of normalisation that is unglamorous and load-bearing, because the deduplication above blocks on normalised values and would fail on dirty ones:

- **Text** --- strip markup, decode entities, repair mojibake, normalise Unicode, remove invisible characters, trim decorative junk from edges *without* eating a title's question mark. Applied to a curated list of free-text columns, never to identifiers, URLs or computed keys, where cleaning would corrupt rather than repair.
- **Placeholders** --- the literals `none`, `null`, `n/a` and their relatives become actual nulls.
- **Identifiers** --- DOIs, ORCIDs and ISSNs are canonicalised; ISBNs are converted to checksum-valid ISBN-13 or set to null, never stored as a raw ISBN-10 or an empty string.
- **Names** --- parenthetical annotations, embedded birth and death years, stray number tokens and broken initials are stripped by one canonical cleaner, shared between the cleaning pass and the deduplication key so that both agree on what a name is.
- **Capitalisation** --- shouting titles are re-cased; pronounceable acronyms are title-cased while spelled-out initialisms and Roman numerals are left alone.
- **Language, licence, venue abbreviation** --- normalised to controlled vocabularies.

A recurring lesson from this layer, learned the hard way: string length in characters is not string length in bytes, and mixing the two in offset arithmetic silently corrupts accented names --- splitting *Jérôme David* into a given name of *Jérôme Da*. In a corpus this multilingual, that is not an edge case.

------------------------------------------------------------------------

## Everything destructive is reversible

Merging, re-linking and deleting are the operations that can lose data permanently, so they share one discipline throughout:

1.  **Preview by default.** A run reports what it would do and changes nothing until told to apply.
2.  **A full database backup** before the destructive block of the daily run.
3.  **A compressed reversal trail** written for every applied step, kept outside the database, dated, and sufficient to restore the touched rows verbatim.

The audit trail is not decorative. It is what makes it acceptable for one person to run a merge across seven million records with nobody reviewing the change.

------------------------------------------------------------------------

next → [06 --- Relevance: scoring and filtering](06-relevance.md)

# 06 --- Relevance: scoring and filtering

← [Cleaning and repair](05-cleaning.md) · [Index](README.md) · next → [What is missing](07-incompleteness.md)

------------------------------------------------------------------------

Seven point eight million records enter. Which of them are actually anthropology?

This is the hardest question in the project, and it has no clean answer --- only a defensible one.

## Why the obvious approaches fail

- **Keyword matching on titles** is hopeless in a discipline whose subject matter is everything humans do. There is no word that appears in anthropological titles and not elsewhere.
- **Restricting to a list of anthropology journals** excludes the archaeology, linguistics and area-studies literature the field genuinely reads, excludes every book, and would make the corpus a list of journals rather than a literature.
- **Asking a source to classify the work** returns *that source's* taxonomy, which was designed for a different question --- usually for library shelving or for citation-metric normalisation, neither of which is "does this belong to this field".
- **Training a classifier** requires labelled data for a field that has none, which is the original problem restated.

## What the pipeline does instead

It scores each publication on **the subject tags the sources already attached to it**, against a hand-curated table saying what each of those tags is worth for a four-field conception of anthropology: **socio-cultural, biological, archaeological and linguistic**.

The judgement is therefore concentrated in one small, reviewable, human-written table, and everything else is arithmetic over it.

------------------------------------------------------------------------

## The tier table

Every scoring decision routes through one curated table. It currently holds **805 rows out of 217,828 distinct subjects** --- deliberately small, deliberately reviewable.

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Tier                         Weight              Rows Meaning
  ----------------- ----------------- ----------------- -------------------------------------------------------------------------------------------------------------------------------------------------
  **A**                          10.0                17 Anthropology itself --- *Ethnography*, *Ethnology*, *Social anthropology*, *Medical anthropology*, *Applied anthropology*

  **B**                           8.0               112 Squarely within a subfield --- *Archeology*, *Cultural Studies*, *Colonial History and Postcolonial Studies*, *African Studies and Ethnography*

  **S**                           6.0                61 Strongly adjacent disciplines the field shares

  **C**                           5.0               195 Adjacent --- enough to place a work nearby, never enough alone to call it core

  **D**                           2.0               126 Weakly related

  **E**                           0.5                 2 Marginal

  **N**                      **−3.0**               245 No four-field reading at all --- dentistry, orthodontics, corporate finance, atomic physics

  **X**                           0.0                47 Explicitly neutral --- cataloguing noise such as *General*, *Reference*, *Essays*. Also blocks inheritance
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Tiered rows by vocabulary: OpenLibrary topical headings 238, OpenAlex topics 192 and subfields 98, Scopus subject areas 112, SCImago categories 105, and the Mohr Siebeck publisher taxonomy 60.

### Weight is not a property of the subject

An important piece of machinery: a subject's *effective* weight is resolved through a single shared definition, not re-implemented per consumer. It resolves to the curated tier at full weight; or, for an untiered topic, to **0.6 × its parent's** weight; or to nothing at all when the parent is a declared catch-all.

Before that shared definition existed, each consumer implemented the propagation rule separately --- and they had drifted apart. That is worth recording as a general lesson: a rule implemented twice is a rule that will eventually mean two things.

------------------------------------------------------------------------

## The score

Five terms, each answering a different question, added into one number:

    score = positive_signal + corroboration − negative_signal + venue_bonus + no_signal_penalty

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Term                    What it asks                              How it is computed
  ----------------------- ----------------------------------------- ---------------------------------------------------------------------------------------------------------------
  `positive_signal`       How on-topic is the strongest evidence?   **MAX** effective weight over the record's subjects. Not a sum --- one work about one subject states one fact

  `corroboration`         How much of the record agrees?            **+0.5 per additional distinct on-topic concept, capped at +1.5.** Directly-tiered tags only

  `negative_signal`       Is there evidence it is *not* in scope?   **MAX** tier-N weight --- and only when at least two distinct off-topic concepts agree

  `venue_bonus`           What does its journal suggest?            +1.0 / +0.5 / 0 / −0.5 by the venue's assessed relevance

  `no_signal_penalty`     Nothing at all?                           −1.0, only when the work has no tiered subject **and** sits in an off-topic venue
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

### Worked example --- a monograph on kinship and land tenure

  --------------------------------------------------------------------------------------------------
  Term                                                                                         Value
  ----------------------- -------------------------------------------------- -----------------------
  `positive_signal`       strongest tag is tier B                                          **+8.00**

  `corroboration`         three further distinct on-topic concepts, capped                 **+1.50**

  `negative_signal`       no off-topic tags                                                    −0.00

  `venue_bonus`           container assessed as core                                       **+1.00**

  `no_signal_penalty`     has tiered subjects                                                  −0.00

                                                                             

  **score**               → class **CORE** (≥ 7)                                           **10.50**
  --------------------------------------------------------------------------------------------------

### Counting concepts, not rows

`corroboration` and the negative-side guard count **normalised terms, never subject identifiers**.

Three of the vocabularies in use derive from the same underlying subject scheme, so one concept can be present as three separate subject records. Counting records would let a single act of cataloguing corroborate itself three times over.

The same shape appears in the publisher taxonomy, which stamps a product's entire ancestor chain onto it: a book carries both its broad publishing area and its narrower area, which is one shelf assignment stated twice. All nine broad areas are therefore weighted at zero, and positive weight lives only at the narrower levels.

------------------------------------------------------------------------

## The four constraints that hold the model honest

Each was adopted because removing it destroyed the model's ability to say "off-topic" at all --- which is the failure state this model was rebuilt out of.

**1. Both negative terms must stay reachable.** Tier N must be seeded, and the venue penalties must not be gated so narrowly, or exempted so broadly, that they apply to almost nothing. A filter whose negative side never fires is not a filter.

**2. Inherited relevance is discounted, never full.** An untiered topic inherits **0.6 ×** its parent's weight, so the best possible inherited score is 10 × 0.6 = **6.00** --- deliberately *below* the core threshold of 7. Something can be placed as adjacent by inheritance; **nothing can be declared core without evidence of its own.** With undiscounted propagation, a single tangential topic under a broad parent decides the class for millions of rows.

**3. Identification confidence is never scored as topical relevance.** The database holds a heuristic estimating how confidently a *book container* was identified --- derived from whether it has a work-level identifier and how many works it holds. Feeding that into a relevance score would launder "we know what this book is" into "this book is anthropology", inflate book containers above real journals on zero impact, and make an irrelevant book impossible to find. The heuristic is therefore marked as provisional in its own record, and **three separate consumers are built to refuse it**. A book container scores on its own tiered subject headings, or on nothing --- 0 being the honest reading of "no topical evidence", and the one that leaves an irrelevant book findable.

**4. A container may not promote its contents.** On the score lattice, with class cuts at 3 and 7, a bonus of +1.0 moves a 6 to a 7 and a 2 to a 3 --- the container promoting the work into a higher class on the container's own say-so. The venue bonus is therefore capped below the gap between adjacent classes. A work is never called core on its journal's authority alone.

### An asymmetry, on purpose

The negative side is deliberately harder to trigger than the positive side. One tag earns full positive weight; one tag earns **no** negative weight at all, because off-topic evidence must be corroborated by a second distinct concept.

This is not an oversight. A spurious positive over-includes, and the record survives for review. A spurious negative marks real material for removal.

And it is not hypothetical. A single mis-assigned *Artificial Intelligence* tag --- wrong in two independent sources at once --- is enough to send a sociology monograph to off-topic on one signal. With the guard, it lands unscored instead, which is to say: in the review queue, where a person can see it.

Negative signal is also suppressed entirely when the record carries a **direct tier-A or tier-B tag**: an archaeology paper that also uses computer vision is archaeology.

------------------------------------------------------------------------

## What comes out

  Class            Cut                          Publications       Share
  ---------------- -------------------------- -------------- -----------
  **CORE**         ≥ 7                             2,535,992       32.6%
  **ADJACENT**     ≥ 3                             3,577,935       45.9%
  **BORDERLINE**   ≥ 0                               958,942       12.3%
  **UNSCORED**     no tiered tag either way          709,968        9.1%
  **OFF**          \< 0                            **3,844**   **0.05%**

Mean components per class, which show the model behaving as designed:

  Class          positive   corroboration   negative   venue   score
  ------------ ---------- --------------- ---------- ------- -------
  CORE               7.58            0.74       0.00    0.60    8.93
  ADJACENT           4.69            0.20       0.00    0.41    5.30
  BORDERLINE         1.36            0.03       0.03    0.26    1.62
  UNSCORED           0.00            0.00       0.00    0.35    0.35
  OFF                0.33            0.00       2.73   −0.01   −2.50

**UNSCORED is reported separately from BORDERLINE on purpose.** "Weak evidence" and "no evidence" are opposite findings, and only the second is a task for a human. Collapsing them would hide the reviewable population inside a merely uncertain one.

------------------------------------------------------------------------

## Nothing is deleted

> **The scores are a reading list for a person, not a delete key. Nothing in this corpus has ever been removed by the relevance model.**

That is the design decision most likely to surprise a technically-minded reader. A filter that classifies 7.8 million records and deletes nothing looks incomplete.

It is not. The removal path was left out **deliberately**, because in a field with no canonical source, an automated deletion is an unrecoverable loss of exactly the marginal material that is hardest to find again. A record wrongly deleted here cannot be re-acquired from anywhere, because there is nowhere to re-acquire it from.

So the model's real output is a set of **review queues**, exported for human attention:

  ---------------------------------------------------------------------------------------------------------------------------------------------------------
  Queue                                                                      Size Why it is reviewable
  ------------------------------------------------------- ----------------------- -------------------------------------------------------------------------
  One off-topic tag and nothing else                                      100,277 The suppressed-negative case above --- a person should look

  Unscored books and chapters                                                 --- Mostly fixable by tiering one subject heading

  Records classed OFF                                                       3,844 The only population the model actively asserts against

  Venues ranked by their share of OFF records                                 --- Finds a wrongly-included journal rather than a wrongly-included article

  Book containers still on the identification heuristic                   308,785 Awaiting a real assessment
  ---------------------------------------------------------------------------------------------------------------------------------------------------------

Every scored row stores its own terms --- including **the off-topic weight observed before the guards suppressed it**. Without that pair of columns, a record with one suppressed off-topic tag would be indistinguishable from a record with no tags at all, and those are precisely the rows most worth a person's time.

------------------------------------------------------------------------

## Catch-all parents

Four broad subject areas are marked as **not propagating** to their children: *Sociology and Political Science*, *Education*, *Political Science and International Relations*, and *Law*. An untiered child of these inherits nothing, and is in scope only if tiered explicitly.

The membership test is **breadth, not subject matter**. *Law* is a tier-C area with forty untiered children; its inherited 3.00 lands a work at exactly the adjacent floor --- so an entire national legal literature entered the corpus as ADJACENT on inherited evidence alone. Its genuinely in-scope children --- legal anthropology, customary and indigenous law --- are curated back individually, as the other three were.

The unlisted remainder is **not asserted off-topic**. It is asserted *unevidenced*, which is the conservative direction for a filter: a genuinely anthropological work in that tail almost always carries a second, directly-tiered tag that reaches it anyway.

------------------------------------------------------------------------

## Changing the model safely

A tier edit changes the class of potentially millions of records, so it is never applied blind. The proposed tiers are built into a **shadow database** holding the new table, the shared weight definition and the venue scores, and the before/after class distribution, transition matrix and samples are read from there --- read-only against production, so previewing new tiers never requires seeding them live first.

After any tier edit or venue re-classification, venue scoring and relevance must both be re-run, in that order, because the second reads what the first produces.

------------------------------------------------------------------------

next → [07 --- What is missing](07-incompleteness.md)

# 07 --- What is missing

← [Relevance](06-relevance.md) · [Index](README.md) · next → [Files and availability](08-files-and-availability.md)

------------------------------------------------------------------------

A corpus assembled the way this one is has holes, and they are not evenly distributed. Naming them is more useful than reporting a completeness figure, because **each hole marks the edge of what some source was able to say** --- and knowing which edge you are at tells you which questions the data can answer.

## Field coverage, measured

                                               Coverage 
  ----------------------------------------- ----------- -------------------------
  Publications with a DOI                         97.4% 
  Publications placed in a venue                  99.2% 
  Publications with a date                         100% 
  Works with a language                            100% inferred where unstated
  Works with an abstract                      **66.9%** 
  Citation links resolving to a held work     **59.8%** 
  Publications flagged open access                55.3% 
  Works with a subtitle                           47.1% 
  People with an ORCID                        **34.5%** 
  Publications with an ISBN                    **8.0%** 

The last figure looks alarming and is not: only books and chapters have ISBNs at all, and they are 635,146 of 7,786,681 publications. Read against that denominator, **95.7% of books and chapters carry a checksum-valid ISBN-13** --- the remaining 27,453 are the backfill target, and a stubborn residue of them is genuinely ISBN-less: pre-ISBN digitisations, humanities monographs from platforms that never registered one, and "chapters" whose container is a serial.

------------------------------------------------------------------------

## The gaps that matter

### Forty percent of citations point outside the corpus

Of 97,343,498 citation links, **58,233,380 resolve** to a work held here. The remaining 39 million name works that were never ingested.

Some are outside the field entirely --- an anthropologist citing a statistics textbook, a lab manual, a legal code. Others are exactly the books this corpus most wants and cannot reach.

This gap is actionable, and there is a dedicated route for it: unresolved citations are aggregated by identifier and ranked by **how many works here cite them**. A work cited fifty times by this corpus and absent from it is almost certainly seminal, and its absence means its own record was never registered anywhere reachable. That ranking is the highest-yield acquisition queue in the project --- it finds the field's canon by asking the corpus what it keeps pointing at.

### The subject vocabulary is barely tiered where books live

There are **112,478 distinct book subject headings** in the corpus. **238** of them have been assigned a relevance tier.

This is not a defect in the scoring model. It is a **curation backlog**, and it is the direct cause of the 709,968 unscored records. Ninety-nine percent of works carry subject tags --- 7,629,530 of 7,698,445 --- they simply carry tags nobody has yet judged.

The head of that distribution is short and tractable, and much of it is not even subject matter: shelving noise like *General*, *Reference* and *Essays* belongs in the neutral tier, and out-of-scope commerce, medicine and engineering belongs in the negative one. The work is straightforward; it is simply work, and there is one person to do it.

### Most book containers rest on a heuristic, not a judgement

Of 313,860 book containers, **308,785 carry a provisional marker** rather than an assessed relevance, and **233,350 hold a single work each** --- the residue of a per-edition container that has not yet been consolidated onto the series or edition it belongs to.

The marker is explicitly labelled as provisional in its own record, and three separate parts of the scoring model are built to refuse it ([chapter 06](06-relevance.md)), precisely so that a placeholder is never mistaken for an assessment. The real fix is a book-container assessment programme that does not yet exist --- the existing relevance evaluations cover journals only, and no book container has ever carried a real one.

### Venue assessment is thin

**23,928** venues have been validated against an external register. **315,734** have not --- nearly all of them book containers, which no serial register can validate because they carry no serial identity at all.

### Structural absences

Some things are missing because no source in use carries them, and adding a column would not help:

- **Series, edition statements, physical format, tables of contents and cover images** are carried by the book catalogue and have nowhere to go without a schema change.
- **Venue-level people** --- a series' founding editor or editorial board --- are stated by the publisher source and cannot be stored, because there is no venue-to-person table.
- **Peer-review status, funding for books, and translation lineage** are not systematically stated by anything.

------------------------------------------------------------------------

## What incompleteness is not

None of these numbers is presented as a failure to be embarrassed about. A database of this shape, built this way, has exactly these gaps --- and a version of this documentation reporting 99% coverage everywhere would be describing a different and less honest system.

What matters is that the gaps are **measured and named**, so that someone using the data knows which questions it can answer well and which it cannot answer yet.

> **How to read any count from this corpus.** A count here means *"as recorded in this corpus, from these sources, as of this date"*. It does not mean *"as published in the world"*.
>
> The absence of a work is **not** evidence that it does not exist. It is evidence that no reachable source described it in a way this pipeline could ingest.

This applies with particular force to anything that looks like a trend. The corpus's decade distribution ([chapter 02](02-data-model.md)) rises steeply toward the present, and that curve is mostly a property of how registries describe recent material --- not a measurement of what the discipline published.

------------------------------------------------------------------------

next → [08 --- Files and availability](08-files-and-availability.md)

# 08 --- Files and availability

← [What is missing](07-incompleteness.md) · [Index](README.md) · next → [Operations](09-operations.md)

------------------------------------------------------------------------

The database records **whether a work appears in various external catalogues of full-text availability**. That statement needs to be made precisely, because it is easy to read it as something it is not.

## What an availability record is

For a publication, the corpus may hold one or more *availability records*. Each states that some external catalogue lists an item with a given technical fingerprint, of a given format and size.

A record holds: a hash set (`md5` and secondary hashes), `file_size`, `file_format`, `pages`, `language`, and the catalogue's own record identifier. That is all it holds.

  -----------------------------------------------------------------------------------------------------------------------------------------------------------
  Origin                                     Rows What the row holds
  ----------------------- ----------------------- -----------------------------------------------------------------------------------------------------------
  Open access                           2,802,079 A publisher- or repository-provided link to a legitimately open copy, as reported by the indexing sources

  Article catalogue                     3,775,526 A fingerprint and file description only

  Book catalogue                          603,204 A fingerprint and file description only

  *(overlap)*                             *7,487* *Rows listed by both catalogues, counted once*
  -----------------------------------------------------------------------------------------------------------------------------------------------------------

The two side catalogues together account for **4,371,243 distinct rows**.

The natural key is the pair *(hash, publication)*, deliberately not one file per publication: a publication may legitimately have several entries --- different formats, different scans --- and one hash may be listed against many publications, since a book's fingerprint corresponds to every chapter in it.

------------------------------------------------------------------------

## What is not stored

Verified across all **4,371,243** rows sourced from the two side catalogues:

                                      Count
  --------------------------------- -------
  Stored download URLs                **0**
  Stored torrent records              **0**
  Stored access links of any kind     **0**

> **This project does not host, mirror, proxy, relay, or serve any file from those catalogues.** It holds no copies. It does not fetch them, does not link to them, and does not facilitate access to them.

What is recorded is *whether an item appears to be indexed* --- a fact **about a third-party catalogue**, not a copy of anything and not a route to anything.

The `md5` and the other hash values are exactly that: **hashes**. A hash is a fixed-length fingerprint computed from content. It is a value used here to recognise that two catalogue entries describe the same object and to match a catalogue entry to a publication. It is not a file, does not contain a file, and does not yield one. The same is true of every hash column in the row, including the content-addressed one, which the loader copies in the same block as the others.

These values are, in any case, **not published and not made available**: they are internal matching material.

------------------------------------------------------------------------

## What is not verified

Equally important, and stated without hedging:

> **This project does not verify the existence, validity, integrity, legality or provenance of any external record it indexes.**

No step in the pipeline checks whether a catalogued item is real, whether the fingerprint corresponds to anything, whether the described work is what it claims to be, or where it came from. Every availability record carries a verification status of *pending*, and there is **no verification step** --- because performing one would mean retrieving the material, which this project does not do.

What is recorded is therefore **a claim made by a third party, reproduced as a claim**. It is not an endorsement, not a confirmation, and not a representation that the underlying item exists or is lawfully available.

Responsibility for those catalogues, their contents, their legality and their operation lies entirely with whoever operates them. It is not this project's, and this project makes no representation about them.

------------------------------------------------------------------------

## Why the information is recorded at all

The reason is bibliographic rather than practical.

For a discipline whose literature is scattered across defunct presses, untranslated editions, regional publishers and long out-of-print monographs, **knowing that a work has been catalogued somewhere is itself a bibliographic fact**. It is the same class of fact as a library holding statement --- "this exists, and a copy of it has been recorded" --- and no more than that.

It also does real work inside the corpus. A fingerprint listed against many publications is evidence that those publications describe one object, which feeds the deduplication described in [chapter 05](05-cleaning.md). A format and page count corroborate a book's extent where no bibliographic source stated one.

> **In plain words.** The database can tell you that an item with a given fingerprint appears in an external index. It cannot give you that item, does not know whether the entry is genuine, and holds nothing that would help anyone obtain it.

------------------------------------------------------------------------

## Open-access files are a different thing

The 2,802,079 open-access rows are not in the above category and should not be read as though they were. They carry publisher- or repository-provided links to copies the rights-holder has made openly available, as reported by the indexing sources --- the ordinary open-access metadata that Crossref and OpenAlex publish. Those links are stored because they are meant to be followed.

The distinction is maintained in the data itself: an open-access row carries a link and no side catalogue identifier; a side-catalogue row carries an identifier and no link.

------------------------------------------------------------------------

next → [09 --- Operations](09-operations.md)

# 09 --- Operations

← [Files and availability](08-files-and-availability.md) · [Index](README.md)

------------------------------------------------------------------------

Everything documented so far runs as one ordered, re-runnable, idempotent script: `execute.sh` at the repository root. This chapter is how the corpus is actually kept alive, and what it costs.

## The daily run

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Block                   What it does                                                                                                                                                                       Cadence
  ----------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- -----------------------
  **1 · Extract**         Venues, works, book editions, book-review detection                                                                                                                                Daily to periodic

  **2 · Load**            Venues, works, organizations, book editions into the database                                                                                                                      Daily

  **3 · Enrich**          Subject hierarchy, language detection, venue abbreviations                                                                                                                         Daily

  **4 · Transform**       Sanitise → persons → subjects → **backup** → organizations → book containers → work and authorship dedup → book-review reattribution → orphan removal → keys → files → recompute   Daily

  **5 · Finish**          A second orphan sweep, then table optimisation                                                                                                                                     Daily
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

The transform block is the long one, and its internal order is **dependency-driven, not stylistic**. Each step reads what an earlier step produced:

- Text normalisation precedes deduplication, because duplicate detection blocks on a normalised title.
- Person reconciliation precedes statistics, so aggregates are computed on merged people rather than on their fragments.
- Work merging precedes authorship deduplication, because merging two works re-parents two contributor lists onto one record and creates fresh duplicates for it to clear.
- Book-container consolidation precedes work deduplication, so that book identifiers and containers are settled before records are matched on them.
- Book-review reattribution precedes reference resolution, so the redirect it writes takes effect on the same run.
- Statistics precede venue scoring; venue scoring precedes relevance scoring. Each reads a table the previous one populates.
- File linking runs **after** cleanup, not with the loads --- a file row linked before orphan removal may be attached to a publication the cleanup then deletes, so linking last spends the side-database lookups only on the surviving records.
- Orphan removal runs last among the cleanups. It is the single enforcer of the rule that *a work with no publication is deleted*, and it is kept deliberately non-deleting in the final pass, since anything removed after the recomputation would leave the freshly-computed numbers stale.

One rule guards the whole layer from a subtle failure mode: **a repair the loaders would undo on the next ingestion, or a loader write the nightly cleanup then deletes, produces a permanent write-and-delete loop rather than convergence.** Several rules in this pipeline exist specifically because that loop was possible, and the loaders and the cleanup were made to share one definition of which row should survive.

------------------------------------------------------------------------

## Safety properties

The pipeline is built around four properties, because there is one person and no reviewer.

**Idempotent.** Every step can be re-run. A second consecutive run of the deduplication changes nothing; the loaders stabilise at zero updates. This is what makes a partial or interrupted run safe --- the fix is always "run it again".

**Preview by default.** Destructive operations report what they would do and change nothing until explicitly told to apply. The dry run is the default, not a flag.

**Backed up before mutation.** The destructive block begins with a full database dump. Backups run at roughly 6 GB compressed each.

**Reversible.** Every applied destructive step writes a compressed reversal trail --- sufficient to restore the touched rows verbatim --- kept outside the database, dated, in `audits/`. Organization merges, venue merges, work merges, authorship deduplication, book-identifier normalisation, book-review reattribution and subject inheritance each have their own trail.

The daily runner deliberately does **not** stop on error. A flaky network fetch must not abort the database work, so failures are logged and the run continues. The cost of that choice is that a silent failure can pass unnoticed for a day; the benefit is that one bad API response does not cost a night's processing.

------------------------------------------------------------------------

## Scale, in practice

  -------------------------------- ----------------------------------------------------------
  Database                           **48.0 GB** --- 21.4 GB data, 26.6 GB indexes, 30 tables
  Largest table                                                    `work_references`, 15.1 GB
  Working source cache                                                  563,964 files, 5.6 GB
  Source archive                        **22,114,859 files, 297.5 GB** --- 39.7 GB compressed
  Total source records collected                                               **22,678,823**
  Database backups retained                                                           \~17 GB
  Pipeline code                                                       123 files, 41,271 lines
  -------------------------------- ----------------------------------------------------------

The index-to-data ratio is deliberate. Nearly every access path is an indexed lookup, because a full scan over a 97-million-row table is not something one person's hardware can afford to do casually. This has a direct consequence for anyone writing queries against the corpus, and it is worth stating as a rule:

> **Query the indexed generated column, never the expression it was generated from.** The two spellings are equivalent by definition, but the optimiser infers neither from the other --- so the non-generated spelling silently turns a constant-time lookup into a full table scan.

A related operational hazard, recorded because it wastes hours when it is not known: the database client's read timeout is a **socket** timeout on the client side, independent of any server setting. When it expires, the client reports a lost connection *while the server runs the statement to completion* --- so a timeout reads like a network fault. Long-running transforms set it explicitly above the cost of their slowest step.

------------------------------------------------------------------------

## What is not automated

Some operations are deliberately on-demand rather than daily, because their inputs cannot be produced automatically or their effects are policy rather than repair:

- **Relevance tier edits** --- previewed in a shadow database, applied by hand ([chapter 06](06-relevance.md)).
- **Organization unification at low confidence** --- the high-confidence tiers run daily; the looser ones need a person to look at the proposed map.
- **Cross-namespace organization merges** --- folding a publisher and an institution that share an identifier changes what downstream links point at, so it is opt-in.
- **The book-review cases whose book is absent from the corpus** --- resolving and ingesting the reviewed book is a curated wave, after which reattribution keys on an explicit map rather than a title.
- **Publisher-catalogue consolidation** --- moving hundreds of books from per-edition containers onto their series changes venue statistics substantially, so it is run and verified deliberately.
- **Any removal of a publication from the corpus.** There is no automated path ([chapter 06](06-relevance.md)).

The exact invocations for these live in the project's runbook, not here; this chapter documents *why* they sit outside the daily run.

------------------------------------------------------------------------

## Testing

There are **no automated tests**, and this is a stated position rather than an omission. The validation strategy is instead:

- `--limit` and `--dry-run` runs against production data;
- database spot-checks after any change;
- a read-only validation stage that cross-checks stored records against the cached originals and writes findings to an audit table rather than fixing anything;
- and the reversibility trail, which makes an incorrect applied change recoverable rather than fatal.

For a data pipeline whose inputs are seven external services that change their own behaviour without notice, a test suite over synthetic fixtures would validate the wrong thing. What matters is whether the rule holds against the real corpus, and that is what is checked.

------------------------------------------------------------------------

## Where this sits

  --------------------------------------------------------------------------------------------------------------------------------
  Layer                   What it is                                                                       Documented
  ----------------------- -------------------------------------------------------------------------------- -----------------------
  **1 · The corpus**      This database and its pipeline                                                   **here**

  **2 · The API**         A public read interface with full-text search and caching --- `api.ethnos.app`   elsewhere

  **3 · The site**        The reading and browsing interface --- `ethnos.app`                              elsewhere
  --------------------------------------------------------------------------------------------------------------------------------

The layers are separated for the same reason the pipeline stages are: so that a wrong number can be traced to one place. If a count on the website looks wrong, it is wrong in the corpus, in the query, or in the display --- three different investigations. **Nothing downstream computes bibliographic facts.** They are all decided here, under the rules documented in this folder.

------------------------------------------------------------------------

← [Index](README.md)
