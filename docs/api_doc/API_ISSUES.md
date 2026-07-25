# Ethnos API — Problemas identificados, correções e validação

Documento de gestão de problemas. Origem: auditoria completa dos 78 endpoints (2026-07-23), confrontando respostas reais da API viva (`:1211`) com o código-fonte e o swagger. Cada problema segue o ciclo **Problema → Causa raiz → Solução → Validação**.

Convenção de validação: toda correção foi aplicada em `src/` e validada numa **instância temporária em `PORT=1210`** (a `:1211` viva nunca foi tocada; deploy é do operador). Fixes de código são read-only no banco (consumer-only preservado). Todos os arquivos editados passam `node --check`.

Estado da auditoria: 92 endpoints `ok`, 9 `ok_empty` (válidos, dados ausentes por base vazia — cursos/bibliografias), 8 `degraded`, 4 `broken` → **após correção: 0 broken, 0 degraded por defeito de código**. As 212 divergências doc-vs-realidade (44 alta / 78 média / 90 baixa) de **documentação** são resolvidas na fase de swagger; este arquivo trata os defeitos de **comportamento** (15 corrigidos + 2 operador-side).

Legenda: 🟢 corrigido+validado · 📋 operador (fora do alcance da API).

Arquivos alterados nesta fase: `src/services/{metrics,autocomplete,subjects,publications,collaborations,instructors}.service.js`, `src/controllers/{metrics,persons,works}.controller.js`, `src/dto/{course,dashboard}.dto.js`, `src/routes/{dashboard,persons}.js`, `src/services/citations.service.js`, `src/app.js`, `database/required_objects.sql`.

---

## Bloco A — Endpoints quebrados (retornavam erro em vez de dados)

### P1 · 🟢 `GET /metrics/annual` → era 503 REQUEST_TIMEOUT
- **Problema:** `?limit=10` retornava 503 em ~5s, sempre. Só `limit=1` respondia.
- **Causa raiz:** `getAnnualStats` rodava `GROUP BY p.year` sobre `publications INNER JOIN works` (7,2M linhas) **sem `withTimeout`**; o join a `works` (para `avg_citations`/`total_downloads`) era o gargalo. Medições: histórico completo e só-publications >8s.
- **Solução** (`src/services/metrics.service.js` `getAnnualStats`): eliminado o join a `works`; `avg_citations = ROUND(AVG(p.citation_count),2)` (coluna denormalizada, idêntica, sem join); `total_downloads = 0` (`works.download_count` é universalmente 0/nulo); agrega **apenas os anos da página** (`SELECT DISTINCT year … LIMIT/OFFSET` → `WHERE p.year IN (…)`); `total = COUNT(DISTINCT year)`; tudo em `withTimeout` + `catch isStatementTimeout` → degradação graciosa (`summary.degraded`). Cache key `v3→v4`.
- **Validação (1210):** `GET /metrics/annual?limit=10` → **HTTP 200 em 2.86s**, 10 anos. Ano 2020: `total_publications 321204, avg_citations 1.19, open_access_percentage 71.22, total_downloads 0, unique_organizations 0`. avg_citations bate com a versão antiga com join.
- **Nota:** esta agregação ao vivo foi depois **substituída** pela leitura direta da tabela pré-computada `metrics_annual_summary` (sub-segundo, `unique_organizations` real) e `total_downloads` foi removido — ver P17. A agregação ao vivo permanece como fallback.

### P2 · 🟢 `GET /search/popular` → era 503 REQUEST_TIMEOUT
- **Causa raiz:** `getPopularTerms` fazia cross-join `works × publications × números(1..10)` com `SUBSTRING_INDEX` sobre cada palavra de título, **sem `withTimeout`**; Redis só cacheava não-vazio, nunca aquecia.
- **Solução** (`src/services/autocomplete.service.js` `getPopularTerms`): substituída a fonte pesada por agregação sobre o analytics já gravado no Redis (`search_analytics:YYYY-MM-DD`, últimos 7 dias, `lrange` limitado a 2000/dia), tally de frequência de query, top-N, filtrando `stopWords` e termos <2 chars. Nunca executa SQL; cacheia inclusive vazio (TTL 600s); fallback `[]`.
- **Validação (1210):** `GET /search/popular` → **HTTP 200 em ~1ms**, retornando os termos realmente buscados (`silva`, `kins`). Semanticamente correto ("popular" = mais buscado).

### P3 · 🟢 `GET /subjects/{id}/works` → era 500 INTERNAL_ERROR (subjects grandes)
- **Causa raiz:** `getSubjectWorks` usava `withTimeout` mas **não capturava** `isStatementTimeout` → timeout virava 500. Ordenava por `ws.relevance_score` (sem índice composto com `subject_id`, e é placeholder uniforme) e contava via `COUNT(DISTINCT w.id)` caro.
- **Solução** (`src/services/subjects.service.js` `getSubjectWorks`): paginate-then-hydrate — id-selection `SELECT ws.work_id … WHERE ws.subject_id=? ORDER BY ws.work_id DESC LIMIT/OFFSET` (usa `idx_work_subjects_subject_work`, 0,01s), hidrata os ≤limit work_ids; `total` de `subjects.total_works`; `catch isStatementTimeout` → degradação. Filtros `year/type/language` aplicados na hidratação (under-fill possível), `min_relevance` na id-selection.
- **Validação (1210):** `GET /subjects/341907/works?limit=3` (2,8M works) → **HTTP 200 em ~4ms**, 3 rows, `total 2819809`.

### P4 · 🟢 `GET /publications?has_files=true` (isolado) → era 503 REQUEST_TIMEOUT
- **Causa raiz:** (1) count (budget 2s) e id-selection (budget 4,5s) rodavam **sequenciais** → soma >5s → 503 antes do budget de statement disparar. (2) `EXISTS(files)` correlacionado + `ORDER BY p.id DESC` gerava varredura de `publications` (>8s).
- **Solução** (`src/services/publications.service.js`): count e id-selection agora **concorrentes** (`Promise.all`) → wall-clock ≈ max(budgets) < 5s, degradando a `page_degraded` em vez de 503. Fast-path para `has_files===true` (sem full-text/venue e sort default): id-selection dirigida pela tabela `files` (`SELECT DISTINCT f.publication_id … ORDER BY … LIMIT/OFFSET`, 0,01s) → dados reais. Flag `meta.has_files_source: "files_index"`.
- **Validação (1210):** `has_files=true&limit=2` → **HTTP 200 em ~4ms**, 2 rows, todas com arquivos, `meta.has_files_source=files_index`. Combinado `has_files=true&type=ARTICLE` → **200 em 2s** com `meta.has_files_note` de under-fill.

---

## Bloco B — Cálculos/valores incorretos

### P5 · 🟢 `GET /collaborations/top` → `ranking` era sempre `null`
- **Causa/Solução** (`src/services/collaborations.service.js` `getTopCollaborations`): o `.map` passou a `(pair, i) => formatTopCollaboration({…}, offset + i + 1)`; o DTO já emitia `ranking` do 2º parâmetro.
- **Validação (1210):** `GET /collaborations/top?limit=3` → `data[].ranking = [1, 2, 3]` (era `[null, null, null]` na 1211).

### P6 · 🟢 `/dashboard/alerts` + `/dashboard/overview` → alerta de erro falso ("208%")
- **Causa/Solução** (`src/routes/dashboard.js` `checkSystemAlerts`; alinhado em `src/dto/dashboard.dto.js`): `error_rate` já é percentual; trocado `> 0.05` por `> 5` e removido o `*100` da mensagem/`current_value`. Confirmado em `src/middleware/monitoring.js` que `error_rate = errors/requests*100`.
- **Validação (1210):** `GET /dashboard/alerts` → nenhum alerta de erro falso (>100%); `overview.error_rate` sã.

### P9 · 🟢 `GET /persons/{id}/collaborators` → `avg_shared_citations`/`timespan` sempre 0/null; `sort_by` ignorado
- **Causa/Solução** (`src/services/collaborations.service.js` `getPersonCollaborators`): espelhado o enriquecimento de `/collaborations/top` (`LEFT JOIN works`+`publications`, `AVG(citation_count)`, `MIN/MAX(pub.year)`); `sort_by` mapeado por allowlist fixa (sem interpolação crua).
- **Validação (1210):** `GET /persons/3589585/collaborators` → `avg_shared_citations 1.31`, `timespan 1975-2017`; `sort_by=avg_citations_together` → `[111, 100.5, 50, 41, 28]`.

### P11 · 🟢 `GET /instructors/{id}` → `program_ids` sempre `[]`
- **Causa/Solução** (`src/services/instructors.service.js` `getInstructorById`): adicionado `GROUP_CONCAT(DISTINCT c.program_id)` (espelhando a query de lista) + parse.
- **Validação (1210):** `GET /instructors/11111` → `program_ids [1]` (== `GET /instructors`).

### P14 · 🟢 (com ressalva) `GET /works/{id}/metrics` → anos temporais lixo
- **Causa/Solução** (`src/services/citations.service.js` `getWorkMetrics`): adicionado `AND p.year BETWEEN 1000 AND YEAR(CURDATE())+1` nas subqueries de MIN/MAX do ano de citação.
- **Validação (1210):** clamp aplicado; remove anos impossíveis (fora de 1000..ano+1). **Ressalva:** outliers *dentro* do range persistem (ex. `1970`, tipicamente epoch-default, e `2027 = ano+1`), pois são válidos pelo intervalo escolhido. Saneamento fino é dado-de-origem (ver P16).

---

## Bloco C — Parâmetros no-op / inconsistências menores

### P7 · 🟢 `GET /persons` → filtros `affiliation` e `country` eram no-op
- **Solução:** removidos de `src/routes/persons.js` (validação + `@swagger`) e de `src/controllers/persons.controller.js` (coleta). Nunca funcionaram; implementação correta exigiria joins caros (candidato operador-side).
- **Validação (1210):** `affiliation=USP` sem efeito (lista completa 4.727.444); os params não são mais aceitos/documentados.

### P8 · 🟢 `GET /persons` → `q` silenciosamente ignorado (só `search` funcionava)
- **Solução** (`src/controllers/persons.controller.js`): `q` tratado como alias de `search` (usado quando `search` ausente/vazio, após normalização de string vazia).
- **Validação (1210):** `search=silva` → total 27.846; `q=silva` → **total 27.846** (idêntico).

### P10 · 🟢 `GET /works` → `has_files` aceito mas ignorado
- **Solução** (`src/controllers/works.controller.js`): removida a coleta morta de `has_files` (nunca aplicada na vitrine). O filtro por arquivos permanece em `/publications?has_files=true`.
- **Validação (1210):** `GET /works?has_files=true&limit=2` → 200 normal; param não mais aceito.

### P12 · 🟢 `GET /courses` → `subject_count` da lista sempre 0
- **Solução** (`src/dto/course.dto.js` `formatCourseListItem`): `subject_count` emitido condicionalmente (só quando presente) → omitido na lista, mantido no detalhe.
- **Validação (1210):** `GET /courses?limit=2` → itens sem `subject_count`; detalhe inalterado.

### P13 · 🟢 `GET /metrics/collaborations` → `min_collaborations` ecoava como string
- **Solução** (`src/controllers/metrics.controller.js`): `parseInt(req.query.min_collaborations, 10) || 2`.
- **Validação (1210):** `?min_collaborations=5` → `meta.filters.min_collaborations = 5` (int).

### P15 · 🟢 `GET /` → auto-descrição desatualizada + exemplos 404
- **Solução** (`src/app.js`): reescritas `system_status.search_engine`, a descrição de busca, `technical_features.search_performance` e o log de boot para: **Manticore (SphinxQL) para works/persons; MariaDB FULLTEXT para venues (`ft_venues_search`), subjects (`ft_subjects_term`), organizations (`ft_organizations_name`); filtro de venue via `ft_venues_search`**. `quick_examples` corrigidos para rotas válidas.
- **Validação (1210):** `GET /` mostra Manticore; os 5 `quick_examples` retornam **HTTP 200**. (Efetiva-se na 1211 apenas após deploy do operador — sem impacto no serviço vivo.)

---

## Bloco D — Operador (fora do alcance da API)

### P16 · 📋 Anos futuros/epoch lixo em `publications.year`
- Dados de origem ruins (ex. `2028`, `1970` epoch). A API expõe/clampa ao intervalo válido, mas outliers dentro do range são legítimos pelo critério. Saneamento é operador-side (limpeza de `publications.year`). Registrado, não "corrigível" pela API sem heurística arriscada.

### P17 · 🟢 Pré-cálculo de agregados anuais (sub-segundo) — RESOLVIDO 2026-07-23
- **Contexto:** P1 respondia ~3s com degradação graciosa e servia `unique_organizations = 0` (COUNT(DISTINCT affiliation) por ano é caro demais) e `total_downloads = 0`.
- **Solução (operador + API):** o operador criou e populou a tabela `metrics_annual_summary` (PK `year`; `total_publications`, `unique_works`, `open_access_count`, `articles`, `books`, `avg_citations`, `unique_organizations`, `refreshed_at`) — 273 anos, com `unique_organizations` e `avg_citations` reais. A API (`getAnnualStats`) passou a **ler direto dessa tabela** (leitura indexada única por `year`, sub-segundo), derivando `open_access_percentage` e mantendo o clamp `1000..YEAR(CURDATE())+1` na leitura, com **fallback transparente** para a agregação ao vivo sobre `publications` se a tabela sumir (`isMissingTable`). Cache key `v4→v5`.
- **`total_downloads` removido:** `works.download_count` é universalmente nulo/zero e não é computado no banco; em vez de servir um `0` enganoso, o campo foi **removido** da resposta (query + DTO). Não é mais objeto da API.
- **Validação (1210):** `GET /metrics/annual?limit=10` → **HTTP 200 em ~4ms**. Ano 2026: `total_publications 205986, unique_organizations 53449, avg_citations 0.02, open_access_percentage 80.1`; nenhum `total_downloads` no payload. 36/36 testes unitários verdes. Snapshot: `backups/data.schema.2026-07-23.sql` (29 tabelas base).

---

_As divergências puramente de documentação (schemas swagger obsoletos, params não-documentados, enums faltantes, descrições estale) são tratadas na fase de reconstrução do swagger; inventário completo em `scratchpad/reports/verification.json`._
