# Design Guide — ethnos_app (Next.js)

- SSOT CSS: `docs/html-css/static/css/styles.dev.css` mirrored to `public/css/styles.css`.
- Typography: prefer `var(--mono)` for titles, labels, navigation, meta; `var(--sans)` only for longer descriptive text.
- Headings: `h1.page-title` (page), `h2.title-section` (section), `h3.result-title` (result item titles).
- Lists of results: `ul.results-list > li.result-item`; titles use `.result-link`; metadata as `p.result-meta` with `.result-authors`, `.result-year`, `.result-type`.
- Tables: `.data-table` with proper `<th scope="col|row">`; table body uses `.field-value`.
- Buttons/Links: `.action-btn` (neutral), add `.btn-positive` (blue hover) or `.btn-negative` (red hover). Non-tabular links to works use `.result-link`; links inside tables use `.action-link`.
- Forms: `.form-input`/`.form-select` (36px height); grouped by `fieldset.figure-plate > legend.form-label`.
- Accessibility: `skip-link` to `#main-content`; avoid redundant ARIA; label nav with `aria-label`; use `aria-current` for active navigation.
- No inline CSS/JS; sanitize data before injecting into the DOM.

This guide summarizes the canonical classes and patterns used across pages to preserve visual and semantic parity with the original templates.
