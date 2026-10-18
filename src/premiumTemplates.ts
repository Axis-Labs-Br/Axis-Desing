import { element, uid } from './model';
import type { DesignElement, DesignPage, Template } from './model';

const text = (value: string, x: number, y: number, width: number, size: number, ink: string,
  extra: Partial<DesignElement> = {}) => element('text', {
  name: value.split('\n')[0], text: value, x, y, width,
  height: size * 1.4 * value.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length * size * 0.58 / width)), 0),
  fontSize: size, fontFamily: 'Manrope', fontWeight: 400, lineHeight: 1.12, fill: ink, ...extra,
});
const rect = (x: number, y: number, width: number, height: number, fill: string, extra: Partial<DesignElement> = {}) =>
  element('rect', { x, y, width, height, fill, ...extra });
const photo = (id: string, x: number, y: number, width: number, height: number) =>
  element('image', { name: 'Fotografia da coleção', src: `/photos/${id}.jpg`, x, y, width, height });

interface Collection {
  id: string; name: string; brand: string; heading: string; detail: string;
  image: string; paper: string; ink: string; accent: string; font: string;
}

const collections: Collection[] = [
  { id: 'architecture', name: 'Arquitetura essencial', brand: 'FORMA / ARQUITETURA', heading: 'Espaços para\nviver melhor.', detail: 'Arquitetura que traduz o seu jeito de viver.\nConheça nossos projetos.', image: 'editorial-architecture', paper: '#eeeae0', ink: '#303e31', accent: '#7b8965', font: 'Georgia' },
  { id: 'skincare', name: 'Beleza natural', brand: 'ESSENZA / CUIDADO NATURAL', heading: 'O essencial\npara sua pele.', detail: 'Rituais simples. Ingredientes essenciais.\nConheça a nova coleção.', image: 'editorial-skincare', paper: '#f3ede3', ink: '#584636', accent: '#9d8364', font: 'Playfair Display' },
  { id: 'coffee', name: 'Café de origem', brand: 'ORIGEM / CAFÉ & ENCONTROS', heading: 'Bom café.\nBoas histórias.', detail: 'Café de origem e tempo para aproveitar.\nEsperamos por você.', image: 'editorial-cafe', paper: '#eee0ce', ink: '#483124', accent: '#9e6d43', font: 'Georgia' },
  { id: 'wellness', name: 'Retiro & bem-estar', brand: 'SERENO / TEMPO PARA VOCÊ', heading: 'Desacelere.\nReconecte.', detail: 'Um encontro com a natureza e com você.\nDescubra sua próxima pausa.', image: 'editorial-wellness', paper: '#e8eddf', ink: '#344b3f', accent: '#718a68', font: 'Lora' },
  { id: 'gastronomy', name: 'Gastronomia de estação', brand: 'MESA / COZINHA DE ESTAÇÃO', heading: 'À mesa,\ncom tempo.', detail: 'Sabores frescos e encontros especiais.\nExperimente nosso novo menu.', image: 'cuisine', paper: '#f1ecd9', ink: '#41452d', accent: '#8d9251', font: 'Playfair Display' },
  { id: 'travel', name: 'Destinos & descobertas', brand: 'HORIZONTE / NOVOS CAMINHOS', heading: 'O mundo\nchama.', detail: 'Lugares para sentir e histórias para levar.\nEncontre o seu próximo destino.', image: 'coast', paper: '#e8eff0', ink: '#294852', accent: '#608b96', font: 'Lora' },
  { id: 'floral', name: 'Flores & celebrações', brand: 'FLORA / ENCONTROS ESPECIAIS', heading: 'Celebre os\nbons encontros.', detail: 'Flores, afeto e momentos inesquecíveis.\nUma composição para o seu dia.', image: 'flowers', paper: '#f3eee4', ink: '#4e583a', accent: '#959a67', font: 'Georgia' },
  { id: 'atelier', name: 'Ateliê autoral', brand: 'ATELIÊ / FEITO À MÃO', heading: 'Objetos com\nsignificado.', detail: 'Peças autorais e materiais que contam histórias.\nDescubra nossa edição limitada.', image: 'deck-craft', paper: '#eee3d7', ink: '#5d4032', accent: '#ae7854', font: 'Lora' },
  { id: 'business', name: 'Estratégia de marca', brand: 'NORTE / VISÃO & ESTRATÉGIA', heading: 'Clareza para\nir além.', detail: 'Estratégia, design e decisões com propósito.\nVamos construir o próximo capítulo.', image: 'deck-workspace', paper: '#edf1f6', ink: '#223c56', accent: '#587fa4', font: 'Manrope' },
  { id: 'interior', name: 'Interiores contemporâneos', brand: 'CASA / LUZ & MATÉRIA', heading: 'Seu espaço.\nSua essência.', detail: 'Luz natural, texturas e novas possibilidades.\nInspire-se para transformar.', image: 'interior', paper: '#eeeae1', ink: '#3e4035', accent: '#8e8c71', font: 'Playfair Display' },
  { id: 'creative', name: 'Estúdio em movimento', brand: 'ESTÚDIO / EXPRESSÃO CRIATIVA', heading: 'Ideias que\nganham forma.', detail: 'Explore possibilidades e encontre sua linguagem.\nCrie algo que faça sentido.', image: 'art-studio', paper: '#ece9e1', ink: '#354b4b', accent: '#708f87', font: 'Space Grotesk' },
  { id: 'fresh', name: 'Coleção solar', brand: 'SOLAR / NOVOS FAVORITOS', heading: 'Dias leves.\nNovas cores.', detail: 'Uma seleção para acompanhar seus melhores dias.\nConheça os novos favoritos.', image: 'orange', paper: '#f7eddb', ink: '#813f28', accent: '#c47a36', font: 'Georgia' },
];

function makeTemplate(c: Collection, index: number, format: 'post' | 'story' | 'poster' | 'cover'): Template {
  let width = 1080, height = 1080;
  let elements: DesignElement[];
  const variant = index % 4;
  const header = (ink = c.ink, x = 64, y = 64, w = 952) =>
    text(w < 600 ? c.brand.split(' / ')[0] : c.brand, x, y, w, 18, ink,
      { fontWeight: 700, letterSpacing: 2 });
  const heading = (x: number, y: number, w: number, size: number, ink = c.ink,
    align: 'left' | 'center' = 'left') =>
    text(c.heading, x, y, w, size, ink, { fontFamily: c.font,
      fontWeight: c.font === 'Manrope' || c.font === 'Space Grotesk' ? 700 : 400,
      letterSpacing: -1.5, lineHeight: 1.08, textAlign: align });
  const signature = (x: number, y: number, w: number, color = c.accent) =>
    text('CONHEÇA A NOSSA HISTÓRIA  ↗', x, y, w, 16, color, { letterSpacing: 1.5, fontWeight: 700 });
  if (format === 'post') {
    if (variant === 0) elements = [
      header(), rect(64, 122, 952, 2, c.accent, { opacity: 0.5 }),
      heading(58, 182, 964, 84), photo(c.image, 64, 440, 952, 440),
      text(c.detail, 64, 930, 952, 24, c.ink),
      signature(64, 1030, 952),
    ];
    else if (variant === 1) elements = [
      photo(c.image, 0, 0, 1080, 1080), rect(48, 48, 540, 984, c.paper),
      header(c.ink, 88, 92, 460),
      text('EDIÇÃO / 01', 88, 192, 460, 15, c.accent, { letterSpacing: 2 }),
      heading(80, 284, 476, 66), rect(88, 596, 64, 2, c.accent),
      text(c.detail, 88, 654, 454, 24, c.ink, { lineHeight: 1.4 }),
      signature(88, 960, 454),
    ];
    else if (variant === 2) elements = [
      photo(c.image, 0, 0, 1080, 1080), rect(0, 0, 1080, 1080, '#10251f', { opacity: 0.42 }),
      header('#ffffff', 64, 64, 952),
      rect(48, 530, 984, 502, c.paper), heading(82, 594, 916, 80),
      rect(88, 824, 68, 2, c.accent), text(c.detail, 88, 880, 904, 25, c.ink),
      signature(88, 986, 904),
    ];
    else elements = [
      rect(0, 0, 1080, 1080, c.ink), header('#ffffff', 64, 64, 952),
      heading(58, 176, 964, 88, '#ffffff'),
      photo(c.image, 64, 454, 952, 430),
      text(c.detail, 64, 934, 952, 24, '#ffffff'), signature(64, 1030, 952, '#ffffff'),
    ];
  } else if (format === 'story') {
    height = 1920;
    if (index % 3 === 0) elements = [
      photo(c.image, 0, 0, 1080, 1920), rect(0, 0, 1080, 1920, '#10251f', { opacity: 0.15 }),
      header('#ffffff', 72, 106, 936),
      rect(48, 1060, 984, 812, c.paper),
      text('TEMPO PARA NOVAS PERSPECTIVAS', 96, 1130, 888, 18, c.accent, { letterSpacing: 2 }),
      heading(88, 1250, 904, 104), rect(96, 1536, 80, 2, c.accent),
      text(c.detail, 96, 1600, 888, 28, c.ink, { lineHeight: 1.4 }),
      signature(96, 1814, 888),
    ];
    else if (index % 3 === 1) elements = [
      header(c.ink, 72, 106, 936), rect(72, 182, 936, 2, c.accent, { opacity: 0.45 }),
      heading(64, 292, 952, 104), photo(c.image, 72, 630, 936, 826),
      text(c.detail, 72, 1530, 936, 32, c.ink, { lineHeight: 1.4 }),
      rect(72, 1744, 936, 2, c.accent, { opacity: 0.45 }), signature(72, 1812, 936),
    ];
    else elements = [
      rect(0, 0, 1080, 1920, c.ink), photo(c.image, 0, 0, 1080, 1020),
      rect(0, 0, 1080, 1020, '#10251f', { opacity: 0.24 }), header('#ffffff', 72, 106, 936),
      heading(64, 1120, 952, 108, '#ffffff'), rect(72, 1436, 80, 2, '#ffffff'),
      text(c.detail, 72, 1510, 936, 32, '#ffffff', { lineHeight: 1.4 }),
      rect(72, 1752, 936, 2, '#ffffff', { opacity: 0.3 }), signature(72, 1820, 936, '#ffffff'),
    ];
  } else if (format === 'poster') {
    width = 1240; height = 1754;
    if (index % 3 === 0) elements = [
      header(c.ink, 80, 72, 1080), rect(80, 142, 1080, 2, c.accent, { opacity: 0.45 }),
      heading(72, 238, 1096, 114), photo(c.image, 80, 586, 1080, 700),
      text(c.detail, 80, 1380, 1080, 31, c.ink, { lineHeight: 1.4 }),
      rect(80, 1594, 1080, 2, c.accent, { opacity: 0.45 }), signature(80, 1666, 1080),
    ];
    else if (index % 3 === 1) elements = [
      photo(c.image, 0, 0, 1240, 1754), rect(0, 0, 1240, 1754, '#10251f', { opacity: 0.17 }),
      header('#ffffff', 80, 72, 1080), rect(64, 946, 1112, 744, c.paper),
      heading(104, 1020, 1032, 106), rect(112, 1322, 80, 2, c.accent),
      text(c.detail, 112, 1394, 1016, 30, c.ink, { lineHeight: 1.4 }), signature(112, 1620, 1016),
    ];
    else elements = [
      rect(0, 0, 1240, 1754, c.ink), header('#ffffff', 80, 72, 1080),
      photo(c.image, 80, 190, 1080, 790), heading(72, 1064, 1096, 108, '#ffffff'),
      rect(80, 1378, 80, 2, '#ffffff'),
      text(c.detail, 80, 1444, 1080, 30, '#ffffff', { lineHeight: 1.4 }), signature(80, 1666, 1080, '#ffffff'),
    ];
  } else {
    width = 1920; height = 1080;
    if (index % 3 === 0) elements = [
      photo(c.image, 1080, 0, 840, 1080), header(c.ink, 96, 80, 888),
      rect(96, 154, 888, 2, c.accent, { opacity: 0.4 }),
      heading(88, 312, 904, 108), rect(96, 636, 80, 2, c.accent),
      text(c.detail, 96, 710, 888, 30, c.ink, { lineHeight: 1.4 }), signature(96, 970, 888),
    ];
    else if (index % 3 === 1) elements = [
      photo(c.image, 0, 0, 1920, 1080), rect(0, 0, 1920, 1080, '#10251f', { opacity: 0.2 }),
      rect(64, 64, 1040, 952, c.paper), header(c.ink, 112, 112, 944),
      heading(104, 316, 960, 110), rect(112, 644, 80, 2, c.accent),
      text(c.detail, 112, 716, 944, 30, c.ink, { lineHeight: 1.4 }), signature(112, 948, 944),
    ];
    else elements = [
      rect(0, 0, 1920, 1080, c.ink), photo(c.image, 64, 64, 724, 952),
      header('#ffffff', 884, 96, 940), heading(876, 316, 956, 112, '#ffffff'),
      rect(884, 644, 80, 2, '#ffffff'),
      text(c.detail, 884, 716, 940, 31, '#ffffff', { lineHeight: 1.4 }), signature(884, 970, 940, '#ffffff'),
    ];
  }
  const category = { post: 'Redes sociais', story: 'Stories', poster: 'Cartazes', cover: 'Apresentações' }[format];
  const label = { post: 'Post editorial', story: 'Story', poster: 'Cartaz', cover: 'Capa de apresentação' }[format];
  const title = `${c.name} · ${label}`;
  return { id: `collection-${c.id}-${format}`, title, category, width, height, color: c.paper,
    page: { id: uid(), name: title, background: c.paper, elements } };
}

export const premiumTemplates: Template[] = (['post', 'story', 'poster', 'cover'] as const)
  .flatMap((format) => collections.map((collection, index) => makeTemplate(collection, index, format)));

export const premiumPresentationTemplates: Template[] = collections.filter((_, index) => index % 2 === 0)
  .map((c) => {
    const cover = makeTemplate(c, collections.indexOf(c), 'cover');
    const page = (name: string, elements: DesignElement[]): DesignPage => ({
      id: uid(), name, background: c.paper, elements,
    });
    const pages = [cover.page,
      page('Visão geral', [
        text(c.brand, 100, 76, 1720, 22, c.accent, { fontWeight: 700, letterSpacing: 3 }),
        text('Uma visão clara.\nUm próximo passo.', 100, 206, 970, 94, c.ink, { fontFamily: c.font }),
        photo(c.image, 1240, 0, 680, 1080),
        ...['Contexto & oportunidade', 'Nossa abordagem', 'O que vamos construir'].flatMap((title, item) => [
          text(`0${item + 1}`, 100, 560 + item * 122, 90, 32, c.accent, { fontWeight: 700 }),
          text(title, 220, 560 + item * 122, 900, 34, c.ink),
          rect(220, 620 + item * 122, 860, 1, c.accent, { opacity: 0.4 }),
        ]),
      ]),
      page('Plano de ação', [
        photo(c.image, 0, 0, 1920, 1080), rect(0, 0, 1920, 1080, c.ink, { opacity: 0.92 }),
        text('DA IDEIA À PRÁTICA', 100, 86, 1720, 22, '#ffffff', { fontWeight: 700, letterSpacing: 3 }),
        text('Cada etapa importa.', 100, 210, 1720, 98, '#ffffff', { fontFamily: c.font }),
        ...['Descobrir', 'Desenvolver', 'Transformar'].flatMap((title, item) => [
          text(`0${item + 1}`, 100 + item * 585, 470, 490, 32, '#ffffff'),
          rect(100 + item * 585, 540, 480, 2, '#ffffff', { opacity: 0.4 }),
          text(title, 100 + item * 585, 600, 490, 48, '#ffffff', { fontWeight: 700 }),
          text(['Ouvir, observar e entender\no que realmente importa.', 'Explorar caminhos e definir\nas melhores possibilidades.', 'Colocar em prática, aprender\ne evoluir continuamente.'][item],
            100 + item * 585, 720, 490, 27, '#ffffff'),
        ]),
      ]),
      page('Vamos conversar', [
        photo(c.image, 1180, 0, 740, 1080),
        text(c.brand, 100, 80, 980, 22, c.accent, { fontWeight: 700, letterSpacing: 2 }),
        text('O próximo\ncapítulo começa\naqui.', 100, 268, 980, 104, c.ink, { fontFamily: c.font, lineHeight: 1.06 }),
        rect(100, 730, 90, 3, c.accent),
        text('Vamos transformar essa ideia em realidade.', 100, 796, 980, 30, c.ink),
        text('SEU NOME  /  CONTATO@SUAEMPRESA.COM', 100, 964, 980, 21, c.accent, { fontWeight: 700, letterSpacing: 1 }),
      ]),
    ];
    return { ...cover, id: `collection-${c.id}-deck`, title: `${c.name} · Apresentação completa`, pages };
  });

export const editorialPhotos = [
  { id: 'editorial-skincare', title: 'Cosméticos naturais em pedra e linho', author: 'Axis Design · Imagem gerada', source: 'Imagem criada para a biblioteca Axis Design' },
  { id: 'editorial-cafe', title: 'Café, croissant e luz da manhã', author: 'Axis Design · Imagem gerada', source: 'Imagem criada para a biblioteca Axis Design' },
  { id: 'editorial-architecture', title: 'Arquitetura mediterrânea e luz natural', author: 'Axis Design · Imagem gerada', source: 'Imagem criada para a biblioteca Axis Design' },
  { id: 'editorial-wellness', title: 'Refúgio nas montanhas ao amanhecer', author: 'Axis Design · Imagem gerada', source: 'Imagem criada para a biblioteca Axis Design' },
  ...['workspace', 'workshop', 'project', 'planning', 'partnership', 'office', 'meeting', 'desk', 'data', 'craft', 'city', 'boardroom', 'architecture']
    .map((id) => ({ id: `deck-${id}`, title: ({ workspace: 'Mesa de trabalho criativa', workshop: 'Workshop e colaboração', project: 'Projeto em desenvolvimento', planning: 'Planejamento de ideias', partnership: 'Parceria e conexão', office: 'Escritório contemporâneo', meeting: 'Reunião de equipe', desk: 'Detalhes da mesa de trabalho', data: 'Dados e resultados', craft: 'Artesanato e matéria', city: 'Cidade e arquitetura', boardroom: 'Ambiente de negócios', architecture: 'Arquitetura urbana' } as Record<string, string>)[id], author: 'Unsplash', source: 'Biblioteca de fotografias local' })),
];
