### Conceitos de Design — ethnos_app

Objetivo: fixar os conceitos que orientam o design do frontend, garantindo consistência, legibilidade e segurança. Este diretório consolida regras prescritivas que complementam o guia em `docs/examples/DESIGN_GUIDE.md`.

- 01_design_system.md — tokens, paleta e semântica de cores
- 02_layout_and_grid.md — layout, espaçamento e grades
- 03_typography.md — hierarquia tipográfica e usos
- 04_components_and_patterns.md — tabelas, formulários, navegação, botões
- 05_interactions_accessibility_security.md — interações, acessibilidade, CSP/segurança

Regra geral: o CSS fonte único de verdade (SSOT) está em `docs/static/css/styles.dev.css`. Templates Jinja2 não devem conter CSS/JS inline. Qualquer exceção exige revisão de CSP (ver `docs/AGENTS.md`).

