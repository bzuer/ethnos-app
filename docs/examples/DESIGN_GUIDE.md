### Guia de Design e Construção — ethnos_app

Versão 2.0
Objetivo: definir, de forma normativa, como construir o front-end do ethnos_app. Este guia consolida filosofia, tokens de design, estrutura de arquivos, semântica visual e regras de implementação. As páginas funcionais em `docs/examples/` são protótipos de referência visual; a implementação efetiva ocorre nos templates Jinja2 em `templates/` e nos assets de `static/`.

#### 1. Filosofia e Princípios

- Conceito: “Brutalismo Elegante” — forma segue função. Sem ornamentos, sem sombras, sem cantos arredondados. Hierarquia e legibilidade através de tipografia, espaçamento e bordas.
- Princípios não negociáveis:
  - Funcionalidade primeiro: todo elemento tem propósito explícito.
  - Honestidade estrutural: tabelas, bordas e seções expõem a organização da informação.
  - Tipografia como interface: a hierarquia é tipográfica + espacial, não cromática/decorativa.
  - Consistência e economia: paleta curta, dois sistemas tipográficos e tokens fixos.

#### 2. Estrutura do Projeto (relevante ao front-end)

```
templates/
  base.html                 # layout base (head, container, header, main, footer)
  components/
    global-header.html      # título + navegação (breadcrumbs)
    footer.html             # rodapé padronizado
  pages/
    home.html               # página inicial
    search-form.html        # busca avançada
    search-results.html     # resultados
    works-detail.html       # ficha/catalogo da obra
    lists.html              # lista pessoal
    venues*.html, organizations*.html, courses*.html, instructors*.html, ppgas*.html

static/
  css/styles.dev.css        # fonte única de verdade (SSOT) do CSS
  css/styles.min.css        # build minificado (produção)
  js/*.dev.js               # fontes JS
  js/*.min.js               # build minificado (produção)

docs/examples/              # protótipos funcionais (HTML) e CSS de modelo
  index.html, busca-avancada.html, resultados.html,
  item-detail.html, minha-lista.html, visualizador-redes.html, modelo.css
```

Regra: edite somente `static/css/styles.dev.css`; gere `styles.min.css` via build. Não insira estilos inline nos templates (CSP sem `unsafe-inline`).

#### 3. Sistema de Design (tokens e semântica)

- Cores (tokens do `:root`):
  - `--document-white #F8F8F7` fundo de componentes; `--bg-light #F5F5F4` agrupamentos e hovers sutis.
  - `--border-gray #CCCCCA` bordas estruturais; `--text-black #0D0D0D` texto principal.
  - `--label-gray #555555`, `--data-gray #333333`, `--subtle-gray #888888` para labels, dados e metadados.
  - `--primary-blue #1B365D` ações positivas (ver Interações); `--primary-red #C41E3A` ações negativas/alerta.

- Tipografia:
  - `--sans`: interface de leitura (corpo/descrições pontuais).
  - `--mono`: navegação, dados, labels, metadados e TÍTULOS do sistema.
  - Hierarquia (classes canônicas): `.title-primary 16px mono`, `.page-title 24px mono`, `.title-section 14px mono`, dados/metas/captions `12px mono`, descrições `14px/16px sans`.

- Layout:
  - Container: coluna centralizada (`.container`), `max-width: 800px` (texto) e `960px` (visualizações).
  - Fundo quadriculado no `<body>` (papel milimetrado) com `--grid-unit 36px` e `--grid-height 24px`.

- Tabelas (`.data-table`):
  - Bordas visíveis, `<th>` em mono/uppercase, corpo em mono 12px; hover de linha com `--bg-light`.
  - Larguras por coluna ajustadas por contexto via classes auxiliares (ver `styles.dev.css`).

- Formulários:
  - Inputs/selects `.form-input/.form-select` 36px de altura, mono 14px, foco em `--primary-red`.
  - Grupos em `.figure-plate` para campos relacionados.

- Links de ação e navegação:
  - `.action-link` azul (`--primary-blue`) com sublinhado no `:hover`.
  - Breadcrumbs `.nav-breadcrumb` em mono/uppercase; `aria-current="page"` em negrito.

#### 4. Interações e Estados (botões e cores)

- Base: `.action-btn`, `.pagination-btn` e `.search-btn` são NEUTROS por padrão (fundo `--document-white`, borda `--border-gray`, texto `--text-black`). Feedback de clique com `:active { transform: translateY(1px) }`.
- Ações POSITIVAS (ir, buscar, próximo, adicionar, exportar, baixar): aplique classe adicional `.btn-positive`. Regra: o destaque acontece no HOVER: `:hover { background: --primary-blue; color: branco; border-color: --primary-blue }`.
- Ações NEGATIVAS (apagar, voltar, remover, limpar, cancelar): aplique `.btn-negative`. Regra de hover: `:hover { background: --primary-red; color: branco; border-color: --primary-red }`.
- Paginação: número atual com fundo `--primary-red`; “Anterior” usa `.btn-negative`; “Próxima” usa `.btn-positive`.

Motivação: cor só quando há intenção (hover). O estado repouso é neutro, preservando a estética funcional e a legibilidade.

#### 5. Acessibilidade e Segurança (obrigatório)

- A11y: `skip-link`, uso de `role`, `aria-label`/`aria-current`, `scope="col/row"` em tabelas, rótulos explícitos, elementos de lista semânticos.
- CSP e segurança (ver `docs/AGENTS.md`): sem inline scripts/estilos; recursos externos requerem atualização da CSP; links `target="_blank"` com `rel="noopener noreferrer"`.
- JS: evite `innerHTML` com dados não sanitizados; prefira `textContent`. Autocomplete com escape de metacaracteres e HTML (já implementado nos `*.dev.js`).

#### 6. Guia de Implementação por Página

Cada protótipo em `docs/examples/` corresponde a um template em `templates/pages/`:

- `index.html` → `home.html`: seções em sequência; use `.title-section` e `.data-table` para agrupamentos e listagens.
- `busca-avancada.html` → `search-form.html`: grid simples para rótulos+inputs; inputs de período lado a lado; ações com `.btn-negative` (limpar) e `.btn-positive` (buscar).
- `resultados.html` → `search-results.html`: itens com `.result-title` + `.result-meta`; paginação com `.action-btn btn-negative/btn-positive`.
- `item-detail.html` → `works-detail.html`: apresentação de metadados em tabela label/valor; ferramentas em `fieldset.figure-plate` com botões neutros/positivos conforme ação.
- `minha-lista.html` → `lists.html`: tabela de gerenciamento + painel de exportação; ações de limpeza/remover como negativas.
- `visualizador-redes.html`: container largo (960px) + layout 2 colunas (`.network-layout`).

Observações:
- SSoT do CSS é `static/css/styles.dev.css` (minificado para produção). Não edite `styles.min.css` diretamente.
- Tipografia dos títulos é monoespaçada por padrão no sistema (consistir com `styles.dev.css`).
- Protótipos podem embutir CSS apenas para documentação; templates reais não devem conter CSS/JS inline.
