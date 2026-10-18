# Recursos e dependências

## Ferramenta de investigação

REA: https://github.com/morluto/rea, commit `7e4eed9dd48485b6a7100300aa98401811c2deb9`; código próprio da REA sob MIT. O clone em `.tools/rea` preserva `LICENSE` e avisos de terceiros. A CLI foi adquirida do pacote oficial npm `rea-agents@6.5.0`. Consulte `research/REA.md` para evidências e proveniência.

As páginas, bundles e ilustrações da documentação Canva são evidências de referência conservadas em `research/`. Seus direitos permanecem com os respectivos titulares. Esses arquivos não integram os assets servidos pela aplicação.

## Fotografias

Oito arquivos em `public/photos` foram baixados de `images.unsplash.com` com parâmetros `auto=format&fit=crop&w=1400&q=85`. `scripts/download-photos.py` preserva os identificadores e o procedimento. Fonte e condições de uso: https://unsplash.com/license.

| Arquivo        | Identificador da fonte             |
| -------------- | ---------------------------------- |
| `coast.jpg`    | `photo-1518837695005-2083093ee35b` |
| `interior.jpg` | `photo-1600210492486-724fe5c67fb0` |
| `flowers.jpg`  | `photo-1490750967868-88aa4486c946` |
| `mountain.jpg` | `photo-1464822759023-fed622ff2c3b` |
| `portrait.jpg` | `photo-1534528741775-53994a69daeb` |
| `orange.jpg`   | `photo-1611080626919-7cf5a9dbab5b` |
| `leaves.jpg`   | `photo-1416879595882-3373a0480b5b` |
| `building.jpg` | `photo-1487958449943-2429e8be8625` |

## Fontes e ícones

- DM Sans e Manrope, distribuídas por Fontsource: SIL Open Font License 1.1. Os textos de licença são preservados em `public/licenses/` e nos pacotes npm.
- Lucide React: ISC; licença preservada em `public/licenses/` e no pacote npm.
- A biblioteca vetorial contém os 1.544 ícones canônicos do pacote Lucide instalado, extraídos sem executar os módulos, e 50 desenhos originais. O arquivo de licença inclui os avisos dos ícones derivados de Feather. Proveniência: `docs/ELEMENT_CATALOG.md`.
- O catálogo Fontsource contém 2.095 famílias de texto. Os 49 arquivos locais de 16 famílias possuem licenças originais em `public/licenses/fonts/` e URLs com versão exata em `public/fonts/provenance.json`. Outras famílias são adquiridas sob demanda a partir dos endpoints oficiais; as fontes mantêm suas licenças próprias. Detalhes: `docs/FONT_CATALOG.md`.
- O fixture ABeeZee usado nos testes foi adquirido do CDN oficial Fontsource, versão 5.3.0. Seu texto OFL original acompanha o arquivo em `tests/fixtures/ABeeZee-OFL.txt`.

## Runtime e ferramentas

React/React DOM, Vite, TypeScript, jsPDF, Playwright e Vitest são instalados pelo npm, com versões e integridades em `package-lock.json`. Os pacotes preservam seus textos de licença e avisos. `public/licenses/dependencies.json` registra nome, versão, licença e repositório dos pacotes de produção instalados.

Os modelos em `src/templates.ts`, a identidade Axis Design e a implementação do editor foram criados para este projeto.
