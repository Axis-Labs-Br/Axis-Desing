# Catálogo de elementos vetoriais

Gerado por `node scripts/build-element-catalog.mjs`. O script lê a árvore sintática do pacote instalado, sem executar os arquivos dos ícones.

- `public/elements/lucide.json`: **1544 ícones canônicos** de lucide-react **0.468.0**, todos os ícones com geometria real do pacote instalado. 204 módulos de reexportação/apelidos foram omitidos para evitar duplicação.
- `public/elements/graphics.json`: **50 ilustrações e formas originais Axis**, desenhadas para este projeto; geometria editável, com preenchimento sólido.
- Os catálogos são locais e funcionam sem serviço externo. A biblioteca é ampla, mas não representa o catálogo proprietário do Canva.

## Proveniência e licença

Lucide: código em `node_modules/lucide-react/dist/esm/icons`, pacote https://www.npmjs.com/package/lucide-react, projeto https://lucide.dev/. Licença ISC preservada em `public/licenses/Lucide-ISC.txt`. As formas `axis-*` são originais deste projeto e seguem sua licença. Não contêm arte extraída do Canva.

## Contrato JSON

Cada arquivo contém uma lista de objetos `{ id, name, category, tags, paths }`. Cada item de `paths` é `{ tag, attrs }`. `tag` está limitado a path, circle, rect, ellipse, line, polyline e polygon. `attrs` aceita somente strings/números nas propriedades de geometria d, cx, cy, r, x, y, x1, x2, y1, y2, width, height, rx, ry, points, fillRule, clipRule e fill (somente none/currentColor). A chave React `key` é removida. Sem HTML bruto, eventos, URLs ou recursos externos.

Os desenhos originais incluem `viewBox: [24, 24]` e `style: "solid"`. Os ícones Lucide usam viewBox 24×24, fill none, stroke currentColor, strokeWidth 2, strokeLinecap round e strokeLinejoin round. Nomes comuns e tags semânticas são em português; os demais nomes continuam legíveis, com palavras traduzidas quando disponíveis. IDs estáveis identificam a origem.

## Categorias Lucide

- Alimentos: 55
- Educação: 53
- Esportes: 10
- Interface: 515
- Música e mídia: 73
- Natureza: 71
- Negócios: 97
- Outros: 270
- Pessoas: 45
- Saúde: 35
- Setas: 144
- Tecnologia: 117
- Viagem: 59

A classificação é determinística a partir de palavras do nome do ícone. A busca deve normalizar acentos e procurar em name, category e tags.
