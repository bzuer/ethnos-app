### Layout e Grade

Objetivo: padronizar estrutura, espaçamento e alinhamento das páginas.

- Contêiner
  - `.container` centralizado; largura máxima 800px (texto) e 960px (visualizações).
  - Padding horizontal `var(--spacing-xl)`.

- Fundo (papel milimetrado)
  - Aplicado ao `<body>` via dois `linear-gradient` com `--grid-unit 36px`, `--grid-height 24px`.
  - Apenas decorativo/funcional; não interfere em hit targets.

- Seções e espaçamento vertical
  - `main > section` separadas por `var(--spacing-lg)`/`var(--spacing-xl)` conforme contexto.
  - Seções usam `.title-section` para abrir agrupamentos.
  - Agrupamentos de formulário e painéis: `fieldset.figure-plate` com borda `--border-gray` e fundo `--bg-light`.

- Grades locais
  - Formulários complexos: grid simples `label 150px` + `1fr` para campo (`search-form.html`).
  - Pares de campos (ex.: ano inicial/final): display flex com `gap: var(--spacing-sm)` e inputs com altura 36px.

Diretriz: privilegiar leitura top-down, uma coluna. Usar duas colunas apenas para visualizações (ex.: `.network-layout`).

