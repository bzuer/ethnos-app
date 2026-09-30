# Ethnos App Frontend

[![DOI](https://zenodo.org/badge/1050037172.svg)](https://doi.org/10.5281/zenodo.17050053)

Next.js 16 frontend of [ethnos.app](https://ethnos.app), a bibliographic discovery tool for
anthropology and sociology in English, Portuguese and Spanish. It renders the records of the Ethnos
API (`127.0.0.1:1211`) as plain, structured pages: works, persons, venues, institutions and
subjects, with search, a personal reading list and citation exports (JSON, BibTeX, RIS, APA).

## Running

- Node 20–24 (24 preferred) and `npm ci`.
- Configuration and secrets live in `/etc/next-frontend.env` (template:
  `config/env/next-frontend.env.example`); set `ENV_FILE=` to use another file.
- Development: `./bin/dev` → `http://localhost:1210`.
- Production: `scripts/manage.sh deploy` builds the app, installs the `ethnos-app` system unit
  (Next on `localhost:1202`) and the nginx vhost that publishes it on `:1212`.
- `scripts/manage.sh help` lists every command.

## Structure

- `src/app/(site)/[locale]/` — pages; `src/components/common/` — shared components;
  `src/lib/` — API access, adapters and export formats; `messages/` — UI strings.
- `public/css/styles.css` — the single stylesheet.
- `config/nginx.conf`, `scripts/` — deployment.
- `docs/SEO.md` — indexability contract; `CLAUDE.md` — architecture and conventions.
