/** Rebuild local, editable vectors from the installed Lucide package and original Axis geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'node_modules/lucide-react');
const output = path.join(root, 'public/elements');
const shapeTags = new Set(['path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon']);
const attributeNames = new Set(['d', 'cx', 'cy', 'r', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'width', 'height', 'rx', 'ry', 'points', 'fillRule', 'clipRule', 'fill']);

// This evaluates only JSON-like AST nodes. No source code is executed.
function literal(node) {
  if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(node.type)) return node.value;
  if (node.type === 'ArrayExpression') return node.elements.map(literal);
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(property => {
    if (property.type !== 'ObjectProperty' || property.computed || property.method) throw new Error('Non-literal object');
    return [property.key.name ?? property.key.value, literal(property.value)];
  }));
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'NumericLiteral') return -node.argument.value;
  throw new Error(`Unsupported AST node: ${node.type}`);
}

const translations = {
  activity: 'Atividade', airplay: 'Transmitir tela', alarm: 'Alarme', 'alarm-clock': 'Despertador', album: 'Álbum', ambulance: 'Ambulância', anchor: 'Âncora', angry: 'Raiva', apple: 'Maçã', archive: 'Arquivo', armchair: 'Poltrona', award: 'Prêmio', axe: 'Machado', baby: 'Bebê', backpack: 'Mochila', banana: 'Banana', banknote: 'Dinheiro', bath: 'Banheira', battery: 'Bateria', bean: 'Feijão', bed: 'Cama', beef: 'Carne', beer: 'Cerveja', bell: 'Sino', bike: 'Bicicleta', binoculars: 'Binóculos', bird: 'Pássaro', bluetooth: 'Bluetooth', bone: 'Osso', book: 'Livro', bookmark: 'Marcador', bot: 'Robô', box: 'Caixa', brain: 'Cérebro', briefcase: 'Maleta', brush: 'Pincel', bug: 'Inseto', building: 'Edifício', bus: 'Ônibus', cake: 'Bolo', calculator: 'Calculadora', calendar: 'Calendário', camera: 'Câmera', candy: 'Doce', car: 'Carro', carrot: 'Cenoura', cat: 'Gato', check: 'Confirmar', cherry: 'Cereja', church: 'Igreja', circle: 'Círculo', clapperboard: 'Cinema', clipboard: 'Prancheta', clock: 'Relógio', cloud: 'Nuvem', clover: 'Trevo', code: 'Código', coffee: 'Café', cog: 'Engrenagem', coins: 'Moedas', compass: 'Bússola', computer: 'Computador', cookie: 'Biscoito', copy: 'Copiar', copyright: 'Direitos autorais', creditcard: 'Cartão', 'credit-card': 'Cartão de crédito', crop: 'Recortar', crown: 'Coroa', cup: 'Copo', database: 'Banco de dados', diamond: 'Diamante', dice: 'Dado', dog: 'Cachorro', dollar: 'Dólar', door: 'Porta', download: 'Baixar', droplet: 'Gota', drum: 'Tambor', dumbbell: 'Halteres', earth: 'Terra', egg: 'Ovo', elephant: 'Elefante', eraser: 'Borracha', euro: 'Euro', eye: 'Olho', factory: 'Fábrica', feather: 'Pena', fence: 'Cerca', file: 'Documento', film: 'Filme', filter: 'Filtro', fingerprint: 'Impressão digital', fish: 'Peixe', flag: 'Bandeira', flame: 'Chama', flashlight: 'Lanterna', flask: 'Frasco', flower: 'Flor', focus: 'Foco', folder: 'Pasta', footprints: 'Pegadas', frame: 'Moldura', frown: 'Tristeza', fuel: 'Combustível', gamepad: 'Controle de jogo', gauge: 'Medidor', gem: 'Pedra preciosa', ghost: 'Fantasma', gift: 'Presente', glasses: 'Óculos', globe: 'Globo', graduation: 'Formatura', grape: 'Uva', grid: 'Grade', guitar: 'Guitarra', hammer: 'Martelo', hand: 'Mão', handshake: 'Aperto de mãos', harddrive: 'Disco rígido', hash: 'Hashtag', headphones: 'Fones de ouvido', heart: 'Coração', heater: 'Aquecedor', hexagon: 'Hexágono', home: 'Casa', hop: 'Lúpulo', hospital: 'Hospital', hotel: 'Hotel', house: 'Casa', icecream: 'Sorvete', image: 'Imagem', inbox: 'Caixa de entrada', infinity: 'Infinito', info: 'Informação', key: 'Chave', keyboard: 'Teclado', lamp: 'Luminária', laptop: 'Notebook', layers: 'Camadas', leaf: 'Folha', library: 'Biblioteca', lifebuoy: 'Boia', lightbulb: 'Lâmpada', link: 'Link', list: 'Lista', lock: 'Cadeado', luggage: 'Mala', magnet: 'Ímã', mail: 'Envelope', map: 'Mapa', medal: 'Medalha', megaphone: 'Megafone', menu: 'Menu', message: 'Mensagem', mic: 'Microfone', microphone: 'Microfone', milestone: 'Marco', milk: 'Leite', monitor: 'Monitor', moon: 'Lua', mountain: 'Montanha', mouse: 'Mouse', music: 'Música', network: 'Rede', newspaper: 'Jornal', notebook: 'Caderno', nut: 'Porca', octagon: 'Octógono', package: 'Pacote', palette: 'Paleta', paperclip: 'Clipe', party: 'Festa', pause: 'Pausar', pawprint: 'Pata', 'paw-print': 'Pata', pen: 'Caneta', pencil: 'Lápis', pentagon: 'Pentágono', percent: 'Porcentagem', person: 'Pessoa', phone: 'Telefone', piano: 'Piano', picture: 'Retrato', piggybank: 'Cofrinho', 'piggy-bank': 'Cofrinho', pill: 'Comprimido', pin: 'Alfinete', pizza: 'Pizza', plane: 'Avião', play: 'Reproduzir', plug: 'Tomada', plus: 'Mais', pointer: 'Ponteiro', popcorn: 'Pipoca', power: 'Ligar', printer: 'Impressora', puzzle: 'Quebra-cabeça', rabbit: 'Coelho', radio: 'Rádio', rat: 'Rato', receipt: 'Recibo', rectangle: 'Retângulo', recycle: 'Reciclagem', redo: 'Refazer', refresh: 'Atualizar', ribbon: 'Laço', rocket: 'Foguete', rockingchair: 'Cadeira de balanço', ruler: 'Régua', sailboat: 'Veleiro', salad: 'Salada', sandwich: 'Sanduíche', save: 'Salvar', scale: 'Balança', school: 'Escola', scissors: 'Tesoura', search: 'Buscar', send: 'Enviar', server: 'Servidor', settings: 'Configurações', share: 'Compartilhar', shell: 'Concha', shield: 'Escudo', ship: 'Navio', shirt: 'Camiseta', shopping: 'Compras', shovel: 'Pá', shower: 'Chuveiro', shrimp: 'Camarão', signpost: 'Placa', skull: 'Caveira', slash: 'Barra', smartphone: 'Celular', smile: 'Sorriso', snail: 'Caracol', snowflake: 'Floco de neve', sofa: 'Sofá', soup: 'Sopa', sparkle: 'Brilho', sparkles: 'Brilhos', speaker: 'Alto-falante', sprout: 'Broto', square: 'Quadrado', squirrel: 'Esquilo', star: 'Estrela', stethoscope: 'Estetoscópio', sticker: 'Adesivo', store: 'Loja', sun: 'Sol', sunset: 'Pôr do sol', syringe: 'Seringa', table: 'Tabela', tablet: 'Tablet', tag: 'Etiqueta', target: 'Alvo', telescope: 'Telescópio', tent: 'Barraca', terminal: 'Terminal', thermometer: 'Termômetro', thumbsup: 'Curtir', 'thumbs-up': 'Curtir', ticket: 'Ingresso', timer: 'Temporizador', tornado: 'Tornado', toy: 'Brinquedo', tractor: 'Trator', train: 'Trem', trash: 'Lixeira', tree: 'Árvore', triangle: 'Triângulo', trophy: 'Troféu', truck: 'Caminhão', turtle: 'Tartaruga', tv: 'Televisão', umbrella: 'Guarda-chuva', undo: 'Desfazer', unlink: 'Desvincular', unlock: 'Destrancar', upload: 'Enviar arquivo', usb: 'USB', user: 'Usuário', users: 'Pessoas', utensils: 'Talheres', vegan: 'Vegano', video: 'Vídeo', voicemail: 'Correio de voz', volume: 'Volume', wallet: 'Carteira', wand: 'Varinha', watch: 'Relógio de pulso', waves: 'Ondas', webcam: 'Webcam', weight: 'Peso', wheat: 'Trigo', wifi: 'Wi-Fi', wind: 'Vento', wine: 'Vinho', wrench: 'Chave inglesa', zoom: 'Zoom', zap: 'Raio', arrows: 'Setas', arrow: 'Seta', chevron: 'Chevron', chevrons: 'Chevrons', up: 'Cima', down: 'Baixo', left: 'Esquerda', right: 'Direita', horizontal: 'Horizontal', vertical: 'Vertical', align: 'Alinhar', text: 'Texto', heading: 'Título', bold: 'Negrito', italic: 'Itálico', underline: 'Sublinhado', strikethrough: 'Tachado', 'a-arrow-down': 'Diminuir texto', 'a-arrow-up': 'Aumentar texto', 'a-large-small': 'Tamanho do texto', accessibility: 'Acessibilidade', accessible: 'Acessível', 'graduation-cap': 'Chapéu de formatura', 'ice-cream-bowl': 'Taça de sorvete', 'ice-cream-cone': 'Casquinha de sorvete', 'map-pin': 'Localização', 'party-popper': 'Confete', 'message-circle': 'Balão de conversa', 'message-square': 'Balão de mensagem', 'speech': 'Conversa', 'chart-column': 'Gráfico de barras', 'chart-pie': 'Gráfico de pizza', 'chart-line': 'Gráfico de linha', 'circle-check': 'Confirmação', 'circle-x': 'Fechar círculo', 'circle-help': 'Ajuda', 'badge-check': 'Selo de verificado', 'shield-check': 'Proteção verificada', 'heart-handshake': 'Solidariedade', 'hand-heart': 'Carinho', 'heart-pulse': 'Batimento cardíaco', 'house-plus': 'Adicionar casa', 'flower-2': 'Flor delicada', 'tree-pine': 'Pinheiro', 'tree-deciduous': 'Árvore de folhas', 'trees': 'Floresta', 'fish-symbol': 'Símbolo de peixe', 'satellite': 'Satélite', 'satellite-dish': 'Antena parabólica', 'circle-user': 'Perfil', 'circle-user-round': 'Perfil redondo'
};
const semanticRules = [
  ['Setas', /(^|-)(arrow|arrows|chevron|chevrons|corner|move|redo|undo|rotate|refresh|repeat|shuffle|step|navigation)(-|$)/, ['direção', 'direcao', 'seta', 'navegação']],
  ['Alimentos', /(^|-)(apple|banana|bean|beef|beer|cake|candy|carrot|chef|cherry|citrus|coffee|cookie|cooking|croissant|cup|donut|drumstick|egg|fish|fork|grape|ham|hop|ice|lollipop|martini|milk|nut|pizza|popcorn|popsicle|salad|sandwich|shrimp|soup|utensils|vegan|wheat|wine)(-|$)/, ['comida', 'alimento', 'cozinha', 'bebida', 'restaurante']],
  ['Natureza', /(^|-)(bird|bug|cat|clover|cloud|dog|droplet|earth|feather|flame|flower|footprints|leaf|moon|mountain|paw|rabbit|rat|shell|snail|snowflake|sprout|squirrel|sun|sunrise|sunset|tornado|tree|trees|turtle|umbrella|waves|wind|worm)(-|$)/, ['natureza', 'animal', 'planta', 'clima', 'ambiente']],
  ['Saúde', /(^|-)(activity|ambulance|bandage|bone|brain|cross|dna|heart|hospital|microscope|pill|siren|stethoscope|syringe|test|thermometer|tooth)(-|$)/, ['saúde', 'saude', 'medicina', 'cuidado', 'bem-estar']],
  ['Pessoas', /(^|-)(accessibility|accessible|angry|annoyed|baby|frown|hand|handshake|laugh|meh|person|smile|speech|thumbs|user|users|contact)(-|$)/, ['pessoa', 'humano', 'social', 'emoção', 'emocao']],
  ['Educação', /(^|-)(atom|backpack|book|booklet|bookmark|flask|graduation|languages|library|notebook|notepad|pencil|ruler|school|spell|telescope)(-|$)/, ['educação', 'educacao', 'estudo', 'ciência', 'ciencia', 'escola']],
  ['Esportes', /(^|-)(bike|biceps|dumbbell|goal|medal|swords|target|trophy|volleyball|weight)(-|$)/, ['esporte', 'academia', 'exercício', 'exercicio', 'vitória']],
  ['Viagem', /(^|-)(anchor|bus|cable|car|caravan|compass|construction|ferris|flag|fuel|globe|hotel|landmark|luggage|map|milestone|motorbike|plane|rail|road|rocket|route|sailboat|ship|signpost|tent|tractor|traffic|train|tram|truck|waypoints)(-|$)/, ['viagem', 'transporte', 'localização', 'localizacao', 'turismo']],
  ['Música e mídia', /(^|-)(airplay|album|audio|camera|cassette|cast|clapperboard|drama|drum|film|guitar|headphone|headphones|image|images|mic|music|pause|piano|play|podcast|projector|radio|rewind|speaker|tv|video|videotape|volume|webcam)(-|$)/, ['música', 'musica', 'mídia', 'midia', 'foto', 'som', 'vídeo']],
  ['Tecnologia', /(^|-)(binary|bluetooth|bot|braces|brackets|bug|circuit|cloud|code|computer|cpu|database|ethernet|gamepad|git|github|gpu|hard|hdmi|joystick|keyboard|laptop|memory|microchip|monitor|mouse|network|pc|plug|printer|qr|scan|screen|server|smartphone|tablet|terminal|touchpad|usb|webhook|wifi)(-|$)/, ['tecnologia', 'digital', 'computador', 'internet', 'software']],
  ['Negócios', /(^|-)(badge|banknote|bitcoin|boxes|briefcase|building|calculator|chart|coins|credit|currency|dollar|euro|factory|gem|hand|indian|japanese|percent|piggy|pound|receipt|russian|scale|shopping|store|swiss|trending|wallet|warehouse)(-|$)/, ['negócios', 'negocios', 'empresa', 'dinheiro', 'finanças', 'financas', 'comércio']],
  ['Interface', /(^|-)(a|align|archive|at|baseline|bell|between|blend|bold|border|box|bring|case|check|circle|clipboard|clock|cog|columns|copy|crop|delete|diamond|diff|download|ellipsis|equal|expand|eye|file|files|filter|focus|fold|folder|folders|frame|fullscreen|gallery|grid|grip|group|hash|heading|hexagon|highlighter|history|home|house|inbox|indent|info|inspection|italic|key|layers|layout|letter|ligature|link|list|loader|locate|lock|log|mail|maximize|menu|merge|message|minimize|minus|more|octagon|option|package|paint|palette|panel|panels|paperclip|parentheses|pen|pentagon|pin|pipette|plus|pointer|power|proportions|radius|rectangle|remove|replace|rows|save|scaling|scissors|search|section|send|separator|settings|shapes|share|shield|shrink|signature|sliders|space|split|square|squares|stamp|stretch|strikethrough|subscript|superscript|swatch|switch|table|tag|tags|text|toggle|trash|triangle|type|underline|ungroup|unfold|unlink|unlock|upload|variable|view|whole|wrap|x|zoom)(-|$)/, ['interface', 'aplicativo', 'controle', 'design', 'ferramenta']]
];
const humanize = id => id.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
function metadata(id) {
  const [category, , semanticTags] = semanticRules.find(([, pattern]) => pattern.test(id)) ?? ['Outros', null, ['objeto', 'símbolo', 'simbolo']];
  const name = translations[id] ?? id.split('-').map(word => translations[word] ?? humanize(word)).join(' ');
  return { name, category, tags: [...new Set([id, id.replaceAll('-', ' '), name.toLowerCase(), ...id.split('-').map(word => translations[word]?.toLowerCase()).filter(Boolean), ...semanticTags])] };
}
function validatePaths(paths, id) {
  if (!paths.length) throw new Error(`${id}: empty geometry`);
  for (const shape of paths) {
    if (!shapeTags.has(shape.tag)) throw new Error(`${id}: unsupported tag ${shape.tag}`);
    for (const [key, value] of Object.entries(shape.attrs)) {
      if (!attributeNames.has(key)) throw new Error(`${id}: unsupported attr ${key}`);
      if (key === 'fill' && !['none', 'currentColor'].includes(value)) throw new Error(`${id}: invalid fill`);
      if (!['string', 'number'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`${id}: invalid attribute value`);
      if (typeof value === 'string' && /[<>]|javascript:|url\(/i.test(value)) throw new Error(`${id}: unsafe geometry`);
    }
  }
}
await fs.mkdir(output, { recursive: true });
const files = (await fs.readdir(path.join(packageRoot, 'dist/esm/icons'))).filter(file => file.endsWith('.js')).sort();
const icons = [];
let aliasCount = 0;
const names = new Set();
for (const file of files) {
  const source = await fs.readFile(path.join(packageRoot, 'dist/esm/icons', file), 'utf8');
  const ast = parse(source, { sourceType: 'module' });
  const initializers = ast.program.body.flatMap(node => node.type === 'VariableDeclaration' ? node.declarations.map(declaration => declaration.init) : []);
  const call = initializers.find(node => node?.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'createLucideIcon');
  if (!call) { aliasCount++; continue; }
  const canonicalName = literal(call.arguments[0]);
  if (names.has(canonicalName)) throw new Error(`Duplicate canonical name ${canonicalName}`);
  names.add(canonicalName);
  const id = file.slice(0, -3);
  const paths = literal(call.arguments[1]).map(([tag, attrs]) => ({ tag, attrs: Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== 'key')) }));
  validatePaths(paths, id);
  icons.push({ id: `lucide-${id}`, ...metadata(id), paths });
}

// Original Axis drawings: silhouettes and geometric decorations, never copied from Canva.
const P = d => ({ tag: 'path', attrs: { d } });
const C = (cx, cy, r) => ({ tag: 'circle', attrs: { cx, cy, r } });
const R = (x, y, width, height, rx = 0) => ({ tag: 'rect', attrs: { x, y, width, height, rx } });
const polygon = points => ({ tag: 'polygon', attrs: { points } });
function radial(points, radius = 10, inner = radius, rotation = -Math.PI / 2) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const angle = rotation + i * Math.PI / points;
    const r = i % 2 ? inner : radius;
    return `${(12 + Math.cos(angle) * r).toFixed(3)},${(12 + Math.sin(angle) * r).toFixed(3)}`;
  }).join(' ');
}
const originals = [
  ['circle', 'Círculo cheio', 'Formas', ['círculo', 'redondo', 'geometria'], [C(12, 12, 10)]],
  ['square', 'Quadrado cheio', 'Formas', ['quadrado', 'geometria'], [R(2, 2, 20, 20)]],
  ['rounded-square', 'Quadrado arredondado', 'Formas', ['quadrado', 'cantos', 'arredondado'], [R(2, 2, 20, 20, 5)]],
  ['pill', 'Cápsula', 'Formas', ['pílula', 'capsula', 'retângulo'], [R(1, 6, 22, 12, 6)]],
  ['triangle', 'Triângulo cheio', 'Formas', ['triângulo', 'geometria'], [polygon('12,2 23,22 1,22')]],
  ['diamond', 'Losango', 'Formas', ['losango', 'diamante', 'geometria'], [polygon('12,1 23,12 12,23 1,12')]],
  ['pentagon', 'Pentágono cheio', 'Formas', ['pentágono', 'geometria'], [polygon(radial(5))]],
  ['hexagon', 'Hexágono cheio', 'Formas', ['hexágono', 'geometria'], [polygon(radial(6))]],
  ['octagon', 'Octógono cheio', 'Formas', ['octógono', 'geometria'], [polygon(radial(8))]],
  ['semicircle', 'Semicírculo', 'Formas', ['semicírculo', 'arco'], [P('M2 17 A10 10 0 0 1 22 17 Z')]],
  ['quarter-circle', 'Quarto de círculo', 'Formas', ['arco', 'canto', 'círculo'], [P('M2 22 V2 A20 20 0 0 1 22 22 Z')]],
  ['parallelogram', 'Paralelogramo', 'Formas', ['paralelogramo', 'geometria'], [polygon('6,4 23,4 18,20 1,20')]],
  ['trapezoid', 'Trapézio', 'Formas', ['trapézio', 'geometria'], [polygon('7,4 17,4 23,20 1,20')]],
  ['star', 'Estrela de cinco pontas', 'Adesivos', ['estrela', 'favorito', 'destaque'], [polygon(radial(5, 11, 5))]],
  ['star-six', 'Estrela de seis pontas', 'Adesivos', ['estrela', 'destaque'], [polygon(radial(6, 11, 6))]],
  ['burst', 'Selo de destaque', 'Adesivos', ['selo', 'promoção', 'oferta'], [polygon(radial(12, 11, 9))]],
  ['burst-pointed', 'Explosão pontuda', 'Adesivos', ['explosão', 'promoção', 'selo'], [polygon(radial(16, 11, 6.8))]],
  ['heart', 'Coração cheio', 'Adesivos', ['coração', 'amor', 'carinho'], [P('M12 22 C8 18 1 13 1 7 C1 0 9 0 12 5 C15 0 23 0 23 7 C23 13 16 18 12 22 Z')]],
  ['speech', 'Balão de conversa cheio', 'Adesivos', ['balão', 'conversa', 'mensagem'], [P('M5 2 H19 Q23 2 23 6 V14 Q23 18 19 18 H10 L3 23 L4 18 Q1 18 1 14 V6 Q1 2 5 2 Z')]],
  ['thought', 'Balão de pensamento', 'Adesivos', ['balão', 'pensamento', 'nuvem'], [P('M5 17 C0 17 0 10 3 9 C0 4 7 0 10 4 C12 -1 19 1 19 5 C25 5 25 13 21 15 C21 19 14 20 12 17 C9 20 6 20 5 17 Z'), C(5, 21, 1.5), C(1.5, 23, 0.7)]],
  ['ticket', 'Ingresso recortado', 'Adesivos', ['ingresso', 'bilhete', 'cupom'], [P('M2 4 H22 V9 C17 9 17 15 22 15 V20 H2 V15 C7 15 7 9 2 9 Z')]],
  ['bookmark', 'Fita de marcador', 'Adesivos', ['fita', 'marcador', 'bandeira'], [polygon('5,1 19,1 19,23 12,18 5,23')]],
  ['ribbon', 'Faixa de celebração', 'Adesivos', ['faixa', 'fita', 'celebração'], [polygon('1,6 7,6 7,3 17,3 17,6 23,6 20,12 23,18 17,18 17,21 7,21 7,18 1,18 4,12')]],
  ['bolt', 'Raio cheio', 'Adesivos', ['raio', 'energia', 'elétrico'], [polygon('13,1 3,14 11,14 9,23 22,9 14,9 17,1')]],
  ['sparkle', 'Brilho de quatro pontas', 'Adesivos', ['brilho', 'estrela', 'mágica'], [P('M12 1 Q13 11 23 12 Q13 13 12 23 Q11 13 1 12 Q11 11 12 1 Z')]],
  ['cloud', 'Nuvem cheia', 'Adesivos', ['nuvem', 'clima', 'céu'], [P('M6 20 C-1 20 -1 10 5 10 C4 2 16 0 18 9 C25 8 27 20 19 20 Z')]],
  ['flower', 'Flor com seis pétalas', 'Adesivos', ['flor', 'planta', 'natureza'], [C(12, 5.5, 4.5), C(17.6, 8.8, 4.5), C(17.6, 15.2, 4.5), C(12, 18.5, 4.5), C(6.4, 15.2, 4.5), C(6.4, 8.8, 4.5)]],
  ['leaf', 'Folha tropical', 'Adesivos', ['folha', 'tropical', 'natureza', 'planta'], [P('M3 22 C0 11 5 1 22 1 C23 13 17 23 5 21 L18 6 L3 22 Z')]],
  ['sprig', 'Ramo botânico', 'Adesivos', ['ramo', 'folhas', 'botânico', 'planta'], [P('M10 23 L13 1 L14 1 L12 23 Z M12 7 C4 8 2 3 3 1 C8 0 12 3 12 7 Z M12 13 C3 14 1 9 2 7 C8 6 12 9 12 13 Z M13 10 C20 10 23 5 22 3 C17 2 14 6 13 10 Z M12 18 C19 20 23 15 22 12 C17 11 13 14 12 18 Z')]],
  ['arrow-right', 'Seta sólida para direita', 'Formas', ['seta', 'direita', 'direção'], [polygon('1,8 13,8 13,2 23,12 13,22 13,16 1,16')]],
  ['arrow-left', 'Seta sólida para esquerda', 'Formas', ['seta', 'esquerda', 'direção'], [polygon('23,8 11,8 11,2 1,12 11,22 11,16 23,16')]],
  ['arrow-up', 'Seta sólida para cima', 'Formas', ['seta', 'cima', 'direção'], [polygon('8,23 8,11 2,11 12,1 22,11 16,11 16,23')]],
  ['arrow-down', 'Seta sólida para baixo', 'Formas', ['seta', 'baixo', 'direção'], [polygon('8,1 8,13 2,13 12,23 22,13 16,13 16,1')]],
  ['arrow-double', 'Seta de duas pontas', 'Formas', ['seta', 'dupla', 'horizontal'], [polygon('1,12 7,5 7,9 17,9 17,5 23,12 17,19 17,15 7,15 7,19')]],
  ['blob-soft', 'Mancha orgânica suave', 'Abstratos', ['mancha', 'orgânico', 'fundo', 'fluido'], [P('M3 5 C7 -1 12 5 17 2 C24 -1 26 11 20 15 C20 24 8 26 5 19 C-1 17 -1 9 3 5 Z')]],
  ['blob-bean', 'Mancha em feijão', 'Abstratos', ['mancha', 'orgânico', 'feijão', 'fluido'], [P('M2 7 C5 -1 16 -1 21 5 C26 11 22 23 16 23 C9 23 14 14 9 13 C5 13 -1 15 2 7 Z')]],
  ['blob-wave', 'Onda orgânica', 'Abstratos', ['onda', 'mancha', 'orgânico', 'fundo'], [P('M1 14 C5 0 7 18 12 7 C18 -5 25 1 23 14 C21 24 17 15 11 21 C5 26 -1 23 1 14 Z')]],
  ['blob-pebble', 'Pedra suave', 'Abstratos', ['pedra', 'mancha', 'orgânico'], [P('M7 1 C17 -1 25 7 23 15 C21 23 10 26 4 20 C-2 14 -1 4 7 1 Z')]],
  ['wave-stripe', 'Faixa ondulada', 'Abstratos', ['onda', 'faixa', 'linha', 'decoração'], [P('M0 7 C4 0 8 14 12 7 C16 0 20 14 24 7 V15 C20 22 16 8 12 15 C8 22 4 8 0 15 Z')]],
  ['checker', 'Xadrez geométrico', 'Abstratos', ['xadrez', 'quadriculado', 'padrão'], Array.from({length: 16}, (_, i) => (Math.floor(i / 4) + i % 4) % 2 === 0 ? R(i % 4 * 6, Math.floor(i / 4) * 6, 6, 6) : null).filter(Boolean)],
  ['dots', 'Grade de bolinhas', 'Abstratos', ['bolinhas', 'pontos', 'padrão'], Array.from({length: 16}, (_, i) => C(3 + i % 4 * 6, 3 + Math.floor(i / 4) * 6, 1.5))],
  ['diagonals', 'Listras diagonais', 'Abstratos', ['listras', 'diagonal', 'padrão'], [polygon('0,6 6,0 10,0 0,10'), polygon('0,16 16,0 20,0 0,20'), polygon('6,24 24,6 24,10 10,24'), polygon('16,24 24,16 24,20 20,24')]],
  ['arch', 'Moldura em arco', 'Molduras', ['moldura', 'arco', 'janela'], [P('M2 23 V11 A10 10 0 0 1 22 11 V23 H19 V11 A7 7 0 0 0 5 11 V23 Z')]],
  ['square-frame', 'Moldura quadrada', 'Molduras', ['moldura', 'quadro', 'quadrado'], [R(1, 1, 22, 2), R(1, 21, 22, 2), R(1, 3, 2, 18), R(21, 3, 2, 18)]],
  ['corner-frame', 'Cantos de moldura', 'Molduras', ['moldura', 'cantos', 'quadro'], [P('M1 9 V1 H9 V3 H3 V9 Z M15 1 H23 V9 H21 V3 H15 Z M23 15 V23 H15 V21 H21 V15 Z M9 23 H1 V15 H3 V21 H9 Z')]],
  ['oval-frame', 'Moldura oval', 'Molduras', ['moldura', 'oval', 'quadro'], [{ tag: 'path', attrs: { d: 'M12 0 A10 12 0 1 1 12 24 A10 12 0 1 1 12 0 Z M12 3 A7 9 0 1 0 12 21 A7 9 0 1 0 12 3 Z', fillRule: 'evenodd' } }]],
  ['scallop-frame', 'Moldura de borda ondulada', 'Molduras', ['moldura', 'ondulado', 'selo'], [{ tag: 'path', attrs: { d: 'M12 1 Q15 -1 17 3 Q22 2 21 7 Q26 10 22 13 Q24 18 19 19 Q18 24 13 22 Q9 26 7 21 Q2 22 3 17 Q-2 14 2 11 Q0 6 5 5 Q6 0 12 1 Z M12 5 A7 7 0 1 0 12 19 A7 7 0 1 0 12 5 Z', fillRule: 'evenodd' } }]],
  ['sunburst', 'Sol geométrico', 'Adesivos', ['sol', 'estrela', 'brilho'], [polygon(radial(16, 11, 7)), C(12, 12, 7)]],
  ['rainbow', 'Arco-íris geométrico', 'Abstratos', ['arco-íris', 'arcos', 'alegria'], [P('M1 22 V12 A11 11 0 0 1 23 12 V22 H20 V12 A8 8 0 0 0 4 12 V22 Z M6 22 V12 A6 6 0 0 1 18 12 V22 H15 V12 A3 3 0 0 0 9 12 V22 Z')]],
  ['confetti', 'Confetes de festa', 'Abstratos', ['confete', 'festa', 'celebração'], [polygon('2,2 6,1 8,5 4,6'), polygon('16,2 20,3 19,7 15,6'), polygon('9,11 12,8 15,11 12,14'), polygon('1,16 5,15 6,19 2,20'), polygon('17,17 21,15 23,19 19,21'), C(12, 21, 1.5), C(3, 10, 1.2), C(21, 11, 1.2)]]
];
const graphics = originals.map(([id, name, category, tags, paths]) => ({ id: `axis-${id}`, name, category, tags, paths, viewBox: [24, 24], style: 'solid' }));
for (const graphic of graphics) validatePaths(graphic.paths, graphic.id);
for (const [filename, data] of [['lucide.json', icons], ['graphics.json', graphics]]) {
  await fs.writeFile(path.join(output, filename), JSON.stringify(data) + '\n');
}
const pkg = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const counts = Object.fromEntries([...new Set(icons.map(icon => icon.category))].sort().map(category => [category, icons.filter(icon => icon.category === category).length]));
const docs = `# Catálogo de elementos vetoriais\n\nGerado por \`node scripts/build-element-catalog.mjs\`. O script lê a árvore sintática do pacote instalado, sem executar os arquivos dos ícones.\n\n- \`public/elements/lucide.json\`: **${icons.length} ícones canônicos** de lucide-react **${pkg.version}**, todos os ícones com geometria real do pacote instalado. ${aliasCount} módulos de reexportação/apelidos foram omitidos para evitar duplicação.\n- \`public/elements/graphics.json\`: **${graphics.length} ilustrações e formas originais Axis**, desenhadas para este projeto; geometria editável, com preenchimento sólido.\n- Os catálogos são locais e funcionam sem serviço externo. A biblioteca é ampla, mas não representa o catálogo proprietário do Canva.\n\n## Proveniência e licença\n\nLucide: código em \`node_modules/lucide-react/dist/esm/icons\`, pacote https://www.npmjs.com/package/lucide-react, projeto https://lucide.dev/. Licença ISC preservada em \`public/licenses/Lucide-ISC.txt\`. As formas \`axis-*\` são originais deste projeto e seguem sua licença. Não contêm arte extraída do Canva.\n\n## Contrato JSON\n\nCada arquivo contém uma lista de objetos \`{ id, name, category, tags, paths }\`. Cada item de \`paths\` é \`{ tag, attrs }\`. \`tag\` está limitado a path, circle, rect, ellipse, line, polyline e polygon. \`attrs\` aceita somente strings/números nas propriedades de geometria d, cx, cy, r, x, y, x1, x2, y1, y2, width, height, rx, ry, points, fillRule, clipRule e fill (somente none/currentColor). A chave React \`key\` é removida. Sem HTML bruto, eventos, URLs ou recursos externos.\n\nOs desenhos originais incluem \`viewBox: [24, 24]\` e \`style: "solid"\`. Os ícones Lucide usam viewBox 24×24, fill none, stroke currentColor, strokeWidth 2, strokeLinecap round e strokeLinejoin round. Nomes comuns e tags semânticas são em português; os demais nomes continuam legíveis, com palavras traduzidas quando disponíveis. IDs estáveis identificam a origem.\n\n## Categorias Lucide\n\n${Object.entries(counts).map(([category, count]) => `- ${category}: ${count}`).join('\n')}\n\nA classificação é determinística a partir de palavras do nome do ícone. A busca deve normalizar acentos e procurar em name, category e tags.\n`;
await fs.mkdir(path.join(root, 'docs'), {recursive: true});
await fs.writeFile(path.join(root, 'docs/ELEMENT_CATALOG.md'), docs);
console.log(JSON.stringify({ version: pkg.version, icons: icons.length, aliasesSkipped: aliasCount, graphics: graphics.length, categories: counts, geometryTags: [...new Set(icons.flatMap(icon => icon.paths.map(shape => shape.tag)))].sort(), geometryAttributes: [...new Set(icons.flatMap(icon => icon.paths.flatMap(shape => Object.keys(shape.attrs))))].sort() }, null, 2));
