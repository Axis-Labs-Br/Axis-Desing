# Axis Design

Editor visual em português para transformar ideias em posts, apresentações, stories, cartazes e outros formatos. Inclui contas com projetos privados por usuário e links de visualização. Interface e modelos originais; investigação de referências públicas do Canva feita com REA.

## Abrir

O servidor de desenvolvimento está em **http://127.0.0.1:4332/** enquanto esta sessão estiver ativa.

Para iniciar novamente, abra um terminal em `D:\AxisDesing`:

```powershell
npm ci
npm run dev
```

Requer Node.js 22.19+ e npm. Para gerar a aplicação de produção:

```powershell
npm run build
npm run preview
```

O resultado da interface fica em `dist/`. A API de contas também precisa rodar para login, persistência e compartilhamento; `npm run preview` inclui essa API. O servidor usa loopback por padrão.

## O que funciona

- **Espaço de projetos:** criar, pesquisar, ordenar, renomear, duplicar, favoritar, mover à lixeira e restaurar. Exclusão permanente exige confirmação dentro da aplicação.
- **Contas:** cadastro com nome de usuário, e-mail e senha; login e saída. Senhas são armazenadas com scrypt e as sessões usam cookie HTTP-only.
- **Privacidade e links:** cada projeto novo começa privado. O proprietário pode permitir visualização para qualquer pessoa com link ou publicar um endereço público. A prévia compartilhada é somente leitura; voltar para privado revoga o acesso.
- **Formatos:** seis tamanhos predefinidos e dimensões personalizadas de 100 a 8.000 px. Redimensionamento de todas as páginas com ajuste opcional dos elementos.
- **Modelos:** 12 composições originais editáveis, com categorias e busca. Aplicação adaptada ao tamanho do documento e confirmação antes de substituir uma página preenchida.
- **Texto:** edição por duplo clique, tamanho, negrito, itálico, alinhamento, entrelinhas, espaçamento, cor e opacidade. Catálogo de **2.095 famílias Fontsource**, busca, categorias, prévia e favoritos; 16 famílias populares incluídas localmente e upload de WOFF2/WOFF/TTF/OTF.
- **Elementos:** biblioteca local de **1.544 ícones Lucide e 50 gráficos originais**, além das formas básicas. Busca em português/inglês, categorias e favoritos. Cor, tamanho e rotação editáveis; a geometria acompanha o projeto e a exportação vetorial.
- **Formas e fotos:** retângulo, círculo, triângulo, estrela, linha, cartões e contornos. Oito fotos locais e upload de PNG/JPG/WebP/GIF de até 15 MB. Imagens grandes são reduzidas para até 3.000 px.
- **Transformações:** arrastar, oito alças de tamanho, rotação, encaixe ao centro da página, seleção por área, seleção múltipla, agrupamento e transformação conjunta.
- **Organização:** camadas com ordem, visibilidade e bloqueio; duplicação, copiar/colar elementos dentro do editor e alinhamento à página pelo inspetor.
- **Páginas:** adicionar, duplicar, excluir e navegar; visualização de todas as páginas com teclado.
- **Marca:** nome e paleta próprios, guardados no navegador.
- **Histórico:** desfazer/refazer com até 80 operações. Um arrasto corresponde a uma operação.
- **Exportação real:** PNG/JPG em 1×, 2× ou 3×, SVG, PDF com várias páginas e `.axis` editável. Fundo transparente em PNG/SVG. Arquivos `.axis` incluem as imagens, permitindo transporte entre navegadores.
- **Importação de documentos:** PDF, DOCX, PPTX, ODT, TXT, Markdown, HTML, SVG e imagens, além de projetos `.axis`. O PDF abre página por página; texto selecionável fica editável, e traços/fotos/gráficos permanecem preservados na imagem de fundo. Word e PowerPoint trazem texto e imagens/formatos básicos para objetos do editor.
- **Desbloqueio no canvas:** elementos bloqueados continuam selecionáveis; o botão de cadeado na moldura e as camadas permitem desbloqueá-los sem precisar recriar o texto.
- **Persistência:** documentos e contas são salvos pela API local em `.axis-data/`, separados pelo identificador da conta. Os projetos antigos do IndexedDB são migrados para a primeira conta que entrar neste navegador.
- **Responsividade:** interface adaptada para desktop e telas estreitas, com atalhos, rótulos acessíveis e navegação de diálogos por teclado.
- **Página inicial:** busca global sem distinção de acentos, layout para monitores amplos e notebooks, barra inferior com cinco destinos no celular, criação no cabeçalho e controles organizados para toque.

Os modelos ficam na galeria; usar um deles cria uma cópia privada na conta atual.

## Atalhos do editor

| Ação                                                  | Atalho                                |
| ----------------------------------------------------- | ------------------------------------- |
| Texto / retângulo / círculo / linha                   | `T` / `R` / `C` / `L`                 |
| Editar texto                                          | Duplo clique                          |
| Salvar / cancelar edição de texto                     | `Ctrl Enter` / `Esc`                  |
| Desfazer / refazer                                    | `Ctrl Z` / `Ctrl Shift Z`             |
| Duplicar / selecionar tudo                            | `Ctrl D` / `Ctrl A`                   |
| Copiar / recortar / colar no editor                   | `Ctrl C` / `Ctrl X` / `Ctrl V`        |
| Agrupar / desagrupar                                  | `Ctrl G` / `Ctrl Shift G`             |
| Selecionar vários                                     | `Shift` + clique, ou arraste no fundo |
| Mover com precisão / mover 10 px                      | Setas / `Shift` + setas               |
| Proporção ao redimensionar / rotação em passos de 15° | `Shift`                               |
| Salvar agora                                          | `Ctrl S`                              |
| Excluir / limpar seleção                              | `Delete` / `Esc`                      |

No macOS, `Cmd` substitui `Ctrl`.

## Dados e limites desta versão

Contas, sessões e projetos ficam em `.axis-data/` no servidor AxisDesign. Defina `AXIS_DATA_DIR` para usar outro diretório persistente. Faça cópias desse diretório para backup. Preferências de marca e favoritos de bibliotecas continuam no navegador. A biblioteca de uploads é mantida durante a edição; imagens usadas ficam incorporadas ao projeto.

O compartilhamento funciona para qualquer pessoa que consiga acessar o mesmo endereço do servidor. O padrão local é `127.0.0.1:4332`, acessível apenas na máquina em que o AxisDesign roda. Para compartilhar pela internet, publique a aplicação junto com a API em um servidor acessível e use armazenamento persistente. A versão local não envia e-mails de confirmação ou recuperação de senha; configure um serviço de e-mail antes de oferecer cadastro público na internet.

O PDF exportado contém imagens renderizadas das páginas. Na importação de PDF, textos são convertidos em caixas editáveis com fontes próximas (Arial, Georgia ou Courier New); a composição original de traços, fotos, cores de fundo e gráficos fica agrupada em uma imagem bloqueada por página. PDFs digitalizados e texto OCR invisível entram como imagem; não há OCR. Recortes tipográficos especiais também são preservados como imagem. Até 50 páginas e 50 MB por arquivo; o Axis reduz a resolução total se necessário. É possível abrir uma senha conhecida e escolher páginas específicas. O SVG enviado é rasterizado após remover conteúdo ativo. GIFs não recebem uma linha do tempo de animação.

DOCX e PPTX preservam texto, imagens raster e formas básicas, mas podem simplificar paginação do Word, efeitos, SmartArt, animações, transições e gráficos avançados. ODT traz títulos e texto; imagens incorporadas ainda não são incluídas. HTML importa texto, sem scripts, estilos ou imagens externas. TXT e Markdown viram texto editável. A importação acontece localmente no navegador.

O catálogo de fontes fica no projeto; famílias além da seleção local precisam de internet no primeiro uso. As variantes baixadas ficam em IndexedDB e as utilizadas são incorporadas ao `.axis`, permitindo reabrir o projeto em outro navegador sem baixar a mesma fonte. A seleção local inclui 49 arquivos de 16 famílias. O carregamento prioriza o subconjunto latino; cobertura de outros sistemas de escrita depende dos subconjuntos disponíveis. Fontes personalizadas aceitam arquivos de até 10 MB e são validadas pelo navegador.

Sincronização em nuvem gerenciada, confirmação e recuperação por e-mail, colaboração simultânea, comentários compartilhados, vídeo, IA, catálogo remoto e impressão comercial permanecem fora desta versão. A paridade integral com o Canva não foi estabelecida. A edição de texto usa uma formatação por caixa; rich text por trecho exige evolução do modelo.

## Verificação

```powershell
npm test
npm run test:e2e
npm run build
npm audit
```

Os testes de navegador usam Chrome instalado no caminho padrão do Windows, quando disponível. Para outro executável, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; alternativamente instale o Chromium de testes com `npx playwright install chromium`.

Veja [docs/VALIDATION.md](docs/VALIDATION.md) para a execução verificada e [docs/screenshots](docs/screenshots) para as capturas.

## Engenharia reversa e estrutura

A REA foi clonada de `morluto/rea` em `.tools/rea`. A CLI `rea-agents@6.5.0` foi executada com capturas de navegador e análise estática. Evidências, hashes, fontes e limites estão em [research/REA.md](research/REA.md). A página do Canva apresentou proteção Cloudflare; a documentação oficial acessível forneceu referências verificáveis. Nenhum código privado ou backend foi recuperado.

| Arquivo                   | Responsabilidade                                                   |
| ------------------------- | ------------------------------------------------------------------ |
| `src/model.ts`            | Documento, páginas, objetos, identidades e validação de importação |
| `server/api.mjs`          | Cadastro, sessões, isolamento de projetos e permissões de link     |
| `src/accountApi.ts`       | Cliente da API de conta e projetos                                  |
| `src/AuthScreen.tsx`      | Cadastro e login                                                     |
| `src/ShareDialog.tsx`     | Privacidade, links e publicação                                      |
| `src/SharedView.tsx`      | Visualização somente leitura de designs compartilhados              |
| `src/storage.ts`          | Leitura única de projetos legados para migração                      |
| `src/history.ts`          | Snapshots e histórico de edição                                    |
| `src/Scene.tsx`           | Renderização vetorial compartilhada entre prévia e exportação      |
| `src/CanvasStage.tsx`     | Seleção, gestos, transformações e edição direta                    |
| `src/Editor.tsx`          | Coordenação do editor, propriedades, páginas e exportação          |
| `src/EditorPanels.tsx`    | Bibliotecas, uploads, marca e camadas                              |
| `src/export.tsx`          | Arquivos portáteis, SVG, raster e PDF carregado sob demanda        |
| `src/templates.ts`        | Composições e catálogo local                                       |
| `src/Dashboard.tsx`       | Espaço de projetos e modelos                                       |
| `src/FontPicker.tsx`      | Catálogo pesquisável, prévias, favoritos e upload de fontes        |
| `src/fontLibrary.ts`      | Carregamento, cache, validação e incorporação de fontes            |
| `src/ElementsLibrary.tsx` | Catálogo vetorial com busca, categorias e favoritos                |
| `src/vectorTypes.ts`      | Limites de geometria e atributos permitidos na importação          |

Catálogos e proveniência: [fontes](docs/FONT_CATALOG.md) e [elementos](docs/ELEMENT_CATALOG.md). Para atualizá-los, execute `node scripts/update-font-catalog.mjs` e `node scripts/build-element-catalog.mjs`.

As imagens de referência do Canva ficam apenas em `research/`; a interface usa identidade, modelos e recursos próprios. Proveniência e licenças dos recursos: [THIRD_PARTY.md](THIRD_PARTY.md).
