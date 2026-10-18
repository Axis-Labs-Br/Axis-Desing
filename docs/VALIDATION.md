# Validação do Axis Design

Resultado em **17/10/2026** (America/Sao_Paulo): **build aprovado, 53 testes de modelo/catálogos aprovados e 22 testes de interface aprovados**. A rodada final de interface terminou em **54,2 s**, sem falhas.

## Ambiente e reprodução

Windows x64, Node 22.23.2, Vitest 5.0.5, Playwright 1.64.1 e Chrome instalado em `C:/Program Files/Google/Chrome/Application/chrome.exe` (Chromium 155). Cada teste usa contexto de navegador independente; não utiliza contas ou perfis existentes.

```powershell
npm run build
npm test
npm run test:e2e
```

A configuração principal inclui `tests/editor.spec.ts`, `tests/canvas.spec.ts` e `tests/libraries.spec.ts`. O Playwright constrói o projeto e inicia **preview de produção em http://127.0.0.1:4173**, separado do servidor de desenvolvimento em 4332. Assim, alterações observadas pelo Vite durante desenvolvimento não reiniciam a aplicação em teste. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permite selecionar outro executável; fora do Windows, a configuração usa o Chromium do Playwright se a variável não estiver definida.

A entrega local permanece aberta em **http://127.0.0.1:4332**; resposta HTTP **200** confirmada após a rodada. A porta 4173 foi usada pelo servidor temporário de produção dos testes.

Identidade do artefato desta rodada:

- SHA-256 de `dist/index.html`: `f6c0fbf3f546d25c70366a59d444dae8fcd7efa2c4184a661c1febe1f64418de`.
- SHA-256 de `package-lock.json`: `986ba01ae1ef44753b686c1d8565e20941b6d064b2370742960c814977618194`.

## Modelo e catálogos: 53 casos

`tests/model.test.ts` verifica isolamento entre documentos, páginas e elementos; geração de novas identidades ao duplicar/importar; normalização de fontes sem mutar o objeto recebido; clonagem de grupos preservando membros e separando identidades entre cópias e páginas; roundtrip de dados editáveis.

Os casos de entrada inválida incluem raiz e estrutura malformadas, versão desconhecida, dimensões fora dos limites, coordenadas não finitas, tamanho inválido, opacidade inválida, conteúdo de texto inválido e imagem externa não permitida. Um elemento inválido em página posterior invalida a importação inteira. PNG incorporado permanece aceito e preservado. Esses casos são validação de invariantes de importação, não uma auditoria completa de segurança.

Os 14 casos adicionais em `tests/libraries.test.ts` verificam a integridade das 2.095 famílias e dos 1.594 vetores distribuídos, IDs únicos, atributos SVG permitidos, rejeição de atributos executáveis/externos, preservação de fontes conhecidas/personalizadas e limites dos metadados das fontes incorporadas.

## Interface: 22 fluxos

| Suíte     | Fluxo verificado                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas 1  | Arrastar em coordenadas do design, desfazer o gesto inteiro, redimensionar e girar.                                                                                                                                     |
| Canvas 2  | Shift para seleção múltipla, seleção por área, mover somente elementos editáveis e limpar a seleção.                                                                                                                    |
| Canvas 3  | Duplo clique para editar texto; Escape cancela; Ctrl+Enter salva; perder foco preserva a edição antes de arrastar.                                                                                                      |
| Canvas 4  | Agrupar/desagrupar por atalhos, seleção persistente e transformação de vários elementos como unidade.                                                                                                                   |
| Editor 1  | Criar tamanho personalizado, adicionar forma e texto, editar, desfazer/refazer, adicionar/duplicar/excluir página, salvar, recarregar e reabrir o mesmo conteúdo.                                                       |
| Editor 2  | Enviar PNG, adicionar imagem editável, mover com teclado e baixar PNG real: assinatura válida, 640×480 pixels e mais de 1.000 pixels coloridos.                                                                         |
| Editor 3  | Baixar PDF real de duas páginas e verificar cabeçalho e dois objetos de página.                                                                                                                                         |
| Editor 4  | Exportar/importar `.axis` com PNG enviado e JPEG da biblioteca; converter `/photos/…` para bytes incorporados; preservar propriedades e imagens; regenerar IDs; continuar editando.                                     |
| Dashboard | Abrir modelos pela aba inicial, criar a partir de modelo, digitar novo nome caractere a caractere sem perder foco, favoritar, mover para lixeira, restaurar e reabrir.                                                  |
| Mobile    | 390×844: ausência de overflow horizontal do documento, criação personalizada, fechar painel Design, adicionar texto via T e baixar PNG 600×600.                                                                         |
| JPG e SVG | JPEG real com assinatura, dimensões 640×480 e pixels escuros do texto renderizado. SVG como XML válido, imagem e fontes incorporadas, texto preservado, forma mantida e fundo da página removido na opção transparente. |

A suíte adicional cobre:

- Catálogo completo de fontes, busca, favoritos, foco inicial na busca e aplicação de Montserrat com a rede externa bloqueada; os bytes WOFF2 reais acompanham `.axis` e SVG.
- Aquisição de ABeeZee por API/CDN e importação do documento em um contexto de navegador novo, sem rede externa. O teste usa respostas determinísticas com um WOFF2 autêntico do CDN oficial para verificar transporte e cache sem depender da disponibilidade do provedor.
- Edição em negrito de uma fonte regular incorporada, com a variante adicional indisponível, preservando a exportação offline.
- Upload de fonte própria: rejeição de binário inválido, instalação de um WOFF2 válido e incorporação no projeto.
- Biblioteca vetorial completa: busca por “coração”, favoritos, recoloração e preservação de paths após exportação SVG e reimportação `.axis`.
- Seis cenários de página inicial: **360×800, 390×844, 768×1024, 1366×768, 1440×1000 e 1920×1080**. Ausência de overflow horizontal, cinco destinos de navegação, áreas de navegação com no mínimo 44 px, barra inferior no mobile, busca sem acentos e criação de novo design.

Um smoke separado, com acesso real à rede, verificou a API Fontsource e o CDN jsDelivr para ABeeZee (HTTP 200 e FontFace carregada). A saída está em `docs/live-font-check.json`; esse smoke é separado dos testes determinísticos.

O teste de texto SVG considera os `tspan` que representam linhas: quebras visuais não adicionam espaços ao `textContent` bruto. O roundtrip `.axis` também compara o conteúdo armazenado, evitando depender somente dessa representação visual.

## Inspeção visual

Capturas verificadas em navegador real:

- [Página inicial desktop, 1440 px](screenshots/home-1440.png).
- [Notebook, 1366×768](screenshots/home-1366.png).
- [Página inicial mobile, 390 px](screenshots/home-390.png).
- [Página inicial compacta, 360 px](screenshots/home-360.png).
- [Catálogo de fontes](screenshots/font-library.png).
- [Catálogo de elementos](screenshots/elements-library.png).
- [Editor, 1440×1000](screenshots/editor.png).
- [Editor mobile, 390×844](screenshots/mobile-editor.png).

A inspeção confirmou imagens e fontes locais carregadas, painel e prancheta visíveis, controles de navegação organizados e layout mobile sem overflow horizontal do documento. As capturas desktop foram atualizadas após o fechamento das mudanças de interface; a captura mobile foi produzida pela rodada final no preview de produção.

## Cobertura delimitada

Esta rodada verifica a implementação local no Chrome, com arquivos de projeto e downloads produzidos pela própria aplicação. Não estabelece paridade com cada recurso do Canva, compatibilidade em outros navegadores/dispositivos, carga máxima de documentos ou equivalência pixel a pixel entre fontes em ambientes diferentes. Os testes não usam backend remoto ou colaboração entre contas.
