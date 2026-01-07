### Interações, Acessibilidade e Segurança

Objetivo: estabelecer regras de feedback visual, requisitos A11y e higiene de segurança.

- Interações
  - Hover é o principal realce semântico: azul (positivo) e vermelho (negativo).
  - Estado de repouso de botões é neutro. Clique tem `translateY(1px)`.
  - Inputs/Selects têm foco com borda `--primary-red`.

- Acessibilidade
  - `skip-link` visível no foco; páginas com `<main id="main-content">`.
  - Breadcrumbs com `aria-current` e navegações com `role="navigation"`.
  - Tabelas com `scope` em cabeçalhos; listas semânticas (`<ol>/<ul>`).
  - Elementos utilitários `.sr-only/.visually-hidden` conforme `styles.dev.css`.

- Segurança e CSP (ver `docs/AGENTS.md`)
  - Sem estilos ou scripts inline nos templates.
  - CSP conservadora: `default-src 'self'`; dependências externas exigem ajuste explícito.
  - Links externos com `rel="noopener noreferrer"` quando `target="_blank"`.
  - JS: não usar `eval`/`new Function`/`document.write`. Escape antes de usar `innerHTML`.

