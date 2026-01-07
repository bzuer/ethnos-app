### Componentes e Padrões

Objetivo: padronizar elementos recorrentes.

- Cabeçalho e navegação
  - `components/global-header.html`: título `.title-primary` e breadcrumbs `.nav-breadcrumb`.
  - `aria-current="page"` para a rota ativa. Separador `/` com `.breadcrumb-separator`.

- Rodapé
  - `components/footer.html`: links externos com `rel="noopener noreferrer"` e sem inline JS.

- Tabelas (`.data-table`)
  - Cabeçalho `<th>` em mono 12px uppercase; corpo `.field-value` 12px mono.
  - Borda total; `tr:hover` com `--bg-light`.
  - Larguras por coluna definidas por classes utilitárias específicas da página (ver `styles.dev.css`).

- Formulários
  - `.form-input/.form-select`: 36px de altura, mono 14px. Foco em `--primary-red`.
  - Agrupamentos com `fieldset.figure-plate` + `legend.form-label`.
  - Autocomplete e realce de termos: apenas via JS sanitizado; usar utilitários de escape.

- Botões e links de ação
  - Base neutra: `.action-btn`, `.pagination-btn`, `.search-btn`.
  - Ações positivas: adicionar `.btn-positive` (hover azul). Exemplos: Buscar, Próximo, Adicionar, Exportar, Baixar.
  - Ações negativas: adicionar `.btn-negative` (hover vermelho). Exemplos: Remover, Limpar, Voltar, Cancelar.
  - Links `.action-link`: cor azul, sublinhado no hover.

- Paginação
  - Número atual: `.pagination-number.current` com fundo `--primary-red`.
  - Botões: “Anterior” negativo; “Próxima” positivo.

