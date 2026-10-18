# REA — investigação pública do Canva

Data da coleta: 17/10/2026, America/Sao_Paulo. Escopo: referências públicas para uma alternativa local de edição visual. A investigação não acessou contas, designs privados, código-fonte interno nem serviços privados do Canva.

## Ferramenta e identidade

- Repositório solicitado: https://github.com/morluto/rea, clonado em `.tools/rea` com `--depth 1`.
- Commit: `7e4eed9dd48485b6a7100300aa98401811c2deb9`.
- CLI executada: pacote npm **rea-agents@6.5.0**, via `npx.cmd -y`; Node **22.23.2**, Windows x64.
- Integridade publicada do pacote: `sha512-C6BG7LyrAdR74mSjertM6PrxJkcNZ2bfQNOJornPo9erDEp2tyPRVYPnV5Yodr+1RqewCQla68WulXlVnveD+A==` (metadados completos em `rea-package-dist.json`).
- `doctor --client codex --json` retornou código 1: Node compatível; registro MCP Codex ausente, motores nativos não instalados. A CLI de navegador/JavaScript funcionou sem esses motores. Nenhuma configuração global/MCP foi alterada.
- Navegador observado pela REA: Chromium **155.0.8059.80**, executável Chrome já instalado. Cada cenário usou perfil temporário próprio, headless; `cleanup: terminated-owned-process`. Nenhum perfil existente foi conectado.

## Evidências e limites

| ID / arquivo | Resultado observado | Limite |
|---|---|---|
| `ev_32bcae28bb3c04acf50b6d86460d3ee1c8e4fcece210346af30a99d19f359036` / `canva-public-capture.json` | REA navegou para `https://www.canva.com/features/` e esperou 6 s. DOM, acessibilidade e screenshot registram a tela de espera Cloudflare. | O editor não foi observado. Eventos de rede incompletos porque duas solicitações continuavam em andamento. Nenhum desafio foi resolvido ou contornado. |
| `canva-public.png`, `canva-public-summary.json` | Imagem e resumo derivados do registro anterior. O texto acessível informa que o usuário voltará a criar designs em breve. | Não representa a interface principal do Canva. |
| `ev_248d2387eb4485bb7e04828103cd99ee84831a84896bfb292c995a2308a6923a` / `canva-docs-capture.json` | REA navegou para a documentação pública de layout e esperou 2 s. Capturou URL, acessibilidade e screenshot; cobertura solicitada completa. | É a documentação, não o editor. Outros eventos, armazenamento e corpos de rede não foram solicitados. |
| `ev_c57dd705cc69898583b2bf7cd4448c23c75f81966fd4be98680e9cd2b94f0c3f` / `canva-docs-static-analysis.json` | REA analisou duas bundles JavaScript públicas da documentação: 33.333 bytes, 2 arquivos analisados, 20 módulos, 40 findings e 5.665 nós AST visitados; sem falhas de parse. Reconheceu marcadores Webpack/Next.js. | Reconstrução estática parcial: dependências de outras chunks não foram baixadas. Os bundles nunca foram executados pela análise. Isso não prova que o editor use Next.js ou tenha a arquitetura da documentação. |
| `public-artifacts/provenance.json` | Cada HTML, bundle e imagem possui URL, status HTTP, horário, tamanho e SHA-256. | O GET de `/features/` recebeu 403. `/docs/apps/design-elements/` recebeu 404; isso só descreve essa URL. |

Identidade raiz do artefato estático: `ada8eb33178d4ef66f94697e08030da1212a47efd9a0799b700f0f6333cbeb0d`. Inventário: `agm_648dc48f6458f5c203c63e3c9292e2eeec61750f0c5de8c7d8baf9c7a2ccd3ad`.

## Registro de achados e decisões de implementação

As afirmações abaixo são observações da documentação oficial ou da imagem publicada, e não descobertas de código privado. A coluna de aplicação é uma proposta independente para o produto local.

| Área | Observação e fonte | Aplicação proposta |
|---|---|---|
| Estrutura do editor | A [referência visual oficial](https://www.canva.dev/docs/apps/design-guidelines/layout/) mostra barra superior em gradiente, trilho vertical de ferramentas, painel branco e superfície cinza com página ao centro. Imagem preservada em `public-artifacts/official-editor-layout-reference.png`. | Organizar o editor em barra global, ferramentas, biblioteca e prancheta central. Usar marca, templates e assets próprios. |
| Painel e responsividade | A documentação de [layout](https://www.canva.dev/docs/apps/design-guidelines/layout/) descreve painel de apps com cerca de 350 px no desktop e largura total no mobile, controles verticais, galerias em grid e botões largos. | Painel previsível, biblioteca pesquisável e adaptação para telas estreitas. |
| Espaçamento | [Spacing](https://www.canva.dev/docs/apps/design-guidelines/spacing/): 16 px nas bordas e em torno da busca, 8 px entre conteúdos relacionados, 24 px entre seções e 4 px em rótulos. | Escala visual consistente, rolagem única por painel. |
| Cor e estados | [Colors](https://www.canva.dev/docs/apps/design-guidelines/colors/) define cores por papel e variantes de estado, com temas e contraste. | Tokens semânticos para primário, borda, superfície, texto, hover e seleção. Valores exatos do editor não foram extraídos. |
| Documento | [Design Editing API](https://www.canva.dev/docs/apps/design-editing/) expõe páginas, elementos, IDs estáveis, estados de bloqueio, edição por página ou documento e sincronização de snapshots. Cada sync corresponde a uma operação de desfazer. | Modelo local de documento/páginas/objetos; alterações agrupadas em uma entrada do histórico. Persistência local é escolha própria, não inferência sobre o armazenamento Canva. |
| Seleção | [Selection API](https://www.canva.dev/docs/apps/selection/) documenta seleção de imagem, plaintext, richtext e vídeo, evento de mudança e contagem usada para habilitar controles. | Barra de propriedades contextual, estado vazio e seleção múltipla. |
| Transformação | [Positioning elements](https://www.canva.dev/docs/apps/positioning-elements/) usa posição, dimensões e rotação, incluindo coordenadas em grupos. | Arrastar, redimensionar, girar e editar números no inspetor. |
| Grupos e camadas | [Grouping elements](https://www.canva.dev/docs/apps/grouping-elements/) descreve mover/redimensionar/girar grupo; bloqueio impede edição. Elementos posteriores renderizam à frente dos anteriores. | Pilha de camadas explícita, seleção múltipla, agrupar/desagrupar e bloqueio. |
| Texto | [Creating text](https://www.canva.dev/docs/apps/creating-text/) diferencia texto simples e trechos formatados, com formatação de parágrafo e inline; containers possuem posição e rotação. | Edição direta de texto, fonte, tamanho, peso, cor, alinhamento e espaçamento. Paridade completa de richtext permanece requisito separado. |
| Exportação | [Exporting designs](https://www.canva.dev/docs/apps/exporting-designs/) descreve diálogo com formato, resolução e seleção de páginas, além de cancelamento. API documenta PNG/JPG/SVG/PDF/GIF/MP4/PPTX e tratamento diferente de páginas por formato. | Priorizar PNG/JPG/SVG e documento editável JSON local; PDF e demais formatos só devem ser anunciados se implementados e verificados. |

A imagem oficial é material de referência da investigação, não um asset a incorporar à aplicação. SHA-256: `722183fd96a237fcb81050cb122f0cdb6bb8871a023eccf0b06558ee600b0ff6`.

## Checklist de cobertura

- **Respondido:** REA baixada, CLI verificada, capturas reais e análise estática executadas.
- **Respondido parcialmente:** padrões de editor, documentos, seleção, transformações, texto e exportação; sustentados por documentação pública e ilustração oficial, não por observação autenticada.
- **Não resolvido:** detalhe de cada tela do editor atual, algoritmos internos, formatos privados, infraestrutura, colaboração ao vivo, busca de assets, vídeo avançado, IA, billing e catálogo de templates. Nenhuma conclusão de paridade completa foi produzida.
- **Decisão independente:** implementação local pode adotar esses padrões funcionais sem reaproveitar fontes, assets ou templates proprietários.

## Comandos e reprodução

Executados de `D:\AxisDesing` no PowerShell. Os scripts `rea-*` desta investigação contêm todos os URLs e transformações usados.

```powershell
git clone --depth 1 https://github.com/morluto/rea.git .tools/rea
git -C .tools/rea rev-parse HEAD
npx.cmd -y rea-agents@6.5.0 doctor --client codex --json > research/rea-doctor.json
npx.cmd -y rea-agents@6.5.0 capture-browser-scenario --help
npx.cmd -y rea-agents@6.5.0 analyze-javascript-application --help
npx.cmd -y rea-agents@6.5.0 capture-browser-scenario research/canva-public-scenario.json --json > research/canva-public-capture.json 2> research/canva-public-capture.stderr.txt
node scripts/rea-summarize.cjs
node scripts/rea-acquire-public.cjs
node scripts/rea-inspect-html.cjs
node scripts/rea-acquire-details.cjs
npx.cmd -y rea-agents@6.5.0 analyze-javascript-application 'D:/AxisDesing/research/canva-docs-bundles' --json > research/canva-docs-static-analysis.json 2> research/canva-docs-static-analysis.stderr.txt
npx.cmd -y rea-agents@6.5.0 capture-browser-scenario research/canva-docs-scenario.json --json > research/canva-docs-capture.json 2> research/canva-docs-capture.stderr.txt
node scripts/rea-summarize-docs.cjs
node scripts/rea-acquire-layout.cjs
npm.cmd view rea-agents@6.5.0 dist --json > research/rea-package-dist.json
```

`canva-public-scenario.json` e `canva-docs-scenario.json` preservam os inputs declarados. A identidade futura dos sites pode mudar; repetir a coleta pode gerar bytes e evidências diferentes. `SHA256SUMS.json` registra os arquivos desta entrega.
