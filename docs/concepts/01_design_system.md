### Sistema de Design (Tokens e Semântica)

Objetivo: definir tokens e regras de uso. Fonte de verdade: `static/css/styles.dev.css`.

- Cores (tokens)
  - `--document-white #F8F8F7`: fundo de componentes (inputs, tabelas, figuras).
  - `--bg-light #F5F5F4`: agrupamentos (`.figure-plate`), hovers sutis, estados vazios.
  - `--border-gray #CCCCCA`: bordas estruturais (tabelas, inputs, containers).
  - `--text-black #0D0D0D`: texto principal e ênfases em dados.
  - `--label-gray #555555`: rótulos, `<th>`, títulos de seção.
  - `--data-gray #333333`: conteúdos/dados e descrições.
  - `--subtle-gray #888888`: metadados, navegação, rodapé.
  - `--primary-blue #1B365D`: ações positivas (ir, buscar, próximo, adicionar, exportar, baixar).
  - `--primary-red #C41E3A`: ações negativas (apagar, voltar, remover, limpar, cancelar) e alertas.

- Tipografia (tokens)
  - `--sans`: leitura (corpo/descrições pontuais).
  - `--mono`: interface (navegação, dados, labels, metadados, títulos).

- Títulos e escalas (classes canônicas)
  - `.title-primary 16px mono` (título no cabeçalho global)
  - `.page-title 24px mono` (título principal da página)
  - `.title-section 14px mono` (seções internas)
  - Dados/metas/captions: `.field-value`, `.result-meta`, `figcaption` → 12px mono
  - Descrições: `.description` 14px/16px sans

- Layout
  - `.container` centralizado: 800px (texto) e 960px (visualizações).
  - Fundo quadriculado (papel milimetrado) no `<body>` com `--grid-unit 36px`, `--grid-height 24px`.

Diretriz: usar classes e tokens existentes. Não inventar variações locais. O estado visual padrão é neutro; cor é usada para intenção (hover).

