### Tipografia

Objetivo: garantir hierarquia clara e leitura eficiente.

- Sistemas tipográficos
  - Sans (`--sans`): corpo e descrições (`.description`, trechos explicativos).
  - Mono (`--mono`): interface, dados e títulos (navegação, `.title-*`, `.field-value`, `.result-meta`).

- Hierarquia e tamanhos (referência)
  - `.title-primary`: 16px mono, uppercase, peso 700.
  - `.page-title`: 24px mono, uppercase, peso 700.
  - `.title-section`: 14px mono, uppercase, pesa 700.
  - `.field-value`, `.result-meta`, `figcaption`: 12px mono.
  - `.description`: 14px/16px sans, cor `--data-gray`.

- Regras
  - Nunca usar itálico para dados/labels. Itálico apenas para referências/descrições pontuais.
  - Altas (uppercase) em títulos/labels para reforçar estrutura.
  - Não usar fontes externas (CSP e performance); depender de sistema.

