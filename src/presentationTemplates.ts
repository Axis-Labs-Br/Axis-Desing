import { element, uid } from './model';
import type { DesignElement, DesignPage, Template } from './model';
import { premiumPresentationTemplates } from './premiumTemplates';

const W = 1920;
const H = 1080;

const txt = (
  value: string,
  x: number,
  y: number,
  width: number,
  fontSize: number,
  fill: string,
  extra: Partial<DesignElement> = {},
) =>
  element('text', {
    text: value,
    name: value.split('\n')[0].slice(0, 30),
    x,
    y,
    width,
    height: fontSize * (1.35 + (extra.lineHeight ?? 1.18) *
      (value.split('\n').reduce((count, line) => count + Math.max(1,
        Math.ceil((line.length * fontSize * 0.6 + Math.max(0, line.length - 1) * (extra.letterSpacing ?? 0)) / width)), 0) - 1)),
    fontSize,
    fontFamily: 'Manrope',
    fontWeight: 400,
    lineHeight: 1.18,
    fill,
    ...extra,
  });
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  radius = 0,
  extra: Partial<DesignElement> = {},
) => element('rect', { x, y, width, height, fill, radius, ...extra });
const circle = (x: number, y: number, size: number, fill: string, opacity = 1) =>
  element('ellipse', { x, y, width: size, height: size, fill, opacity });
const rule = (x: number, y: number, width: number, fill: string, height = 2) =>
  rect(x, y, width, height, fill);
const photo = (id: string, x: number, y: number, width: number, height: number) =>
  element('image', { name: 'Fotografia editorial', src: `/photos/${id}.jpg`, x, y, width, height, imageFit: 'cover' });
const page = (
  name: string,
  background: string,
  elements: DesignElement[],
  photo: string,
  washOpacity = 0.74,
): DesignPage => ({
  id: uid(),
  name,
  background,
  elements: [
    element('image', {
      name: 'Imagem de fundo',
      src: `/photos/${photo}.jpg`,
      x: 0,
      y: 0,
      width: W,
      height: H,
      imageFit: 'cover',
    }),
    rect(0, 0, W, H, background, 0, { opacity: washOpacity }),
    ...elements,
  ],
});
const deck = (id: string, title: string, color: string, pages: DesignPage[]): Template => ({
  id,
  title,
  category: 'Apresentações',
  width: W,
  height: H,
  color,
  page: pages[0],
  pages,
});

const executive = {
  ink: '#142238',
  inkSoft: '#223750',
  blue: '#315FEA',
  mint: '#66D3B7',
  paper: '#F4F6F9',
  white: '#FFFFFF',
  muted: '#637187',
  line: '#DCE3EB',
  paleBlue: '#E9EFFB',
};

const executivePages: DesignPage[] = [
  page('01 — Capa', executive.ink, [
    rect(0, 0, 1350, H, executive.ink, 0, { opacity: 0.94 }),
    photo('deck-city', 1362, 0, 558, H),
    rect(1362, 0, 558, H, executive.ink, 0, { opacity: 0.5 }),
    rect(1350, 0, 6, H, executive.mint),
    txt('AXIS  /  ESTRATÉGIA', 104, 76, 780, 24, executive.white, {
      letterSpacing: 5,
      fontWeight: 700,
    }),
    txt('APRESENTAÇÃO EXECUTIVA  ·  2026', 106, 254, 1080, 20, executive.mint, {
      letterSpacing: 3,
      fontWeight: 700,
    }),
    txt('Crescer com\nclareza e direção.', 96, 334, 1190, 98, executive.white, {
      fontWeight: 700,
      lineHeight: 1.04,
      letterSpacing: -3,
    }),
    txt('Plano de crescimento, prioridades e próximos passos.', 106, 620, 1060, 32, '#C5CFDC'),
    rule(106, 894, 1120, '#425168'),
    txt('PLANEJAMENTO ESTRATÉGICO', 106, 936, 640, 17, '#D6DEEA', {
      letterSpacing: 3,
      fontWeight: 700,
    }),
    txt('NOVEMBRO 2026', 848, 936, 378, 17, '#D6DEEA', {
      textAlign: 'right',
      letterSpacing: 3,
      fontWeight: 700,
    }),
    txt('2026', 1414, 440, 462, 132, executive.white, {
      textAlign: 'center',
      fontWeight: 700,
      letterSpacing: -4,
    }),
    txt('FOCO  ·  VALOR  ·  MOVIMENTO', 1428, 608, 436, 18, '#C4D2E2', {
      textAlign: 'center',
      letterSpacing: 2,
      fontWeight: 600,
    }),
    txt('DOCUMENTO 01  /  08', 1436, 978, 420, 17, '#C4D2E2', {
      textAlign: 'center',
      letterSpacing: 3,
    }),
  ], 'deck-city', 0.46),
  page('02 — Visão geral', executive.paper, [
    txt('ESTRATÉGIA 2026  /  VISÃO GERAL', 100, 70, 1720, 18, executive.blue, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('A estratégia em quatro\nmovimentos claros.', 92, 148, 1120, 75, executive.ink, {
      fontWeight: 700,
      lineHeight: 1.05,
      letterSpacing: -2,
    }),
    txt('Uma direção comum ajuda cada equipe a transformar prioridade em resultado.', 100, 352, 1380, 27, executive.muted),
    ...[
      ['01', 'Entender', 'Ler o contexto, ouvir clientes e escolher onde concentrar energia.'],
      ['02', 'Priorizar', 'Direcionar recursos às oportunidades com maior potencial de valor.'],
      ['03', 'Executar', 'Definir responsáveis, ritmo de acompanhamento e entregas concretas.'],
      ['04', 'Aprender', 'Medir avanços, ajustar o plano e compartilhar o que funciona.'],
    ].flatMap(([number, title, body], index) => {
      const x = 100 + index * 445;
      return [
        rect(x, 500, 405, 365, executive.white, 14, { stroke: executive.line, strokeWidth: 2 }),
        txt(number, x + 30, 535, 110, 25, executive.blue, { fontWeight: 700, letterSpacing: 2 }),
        rule(x + 30, 593, 345, executive.line),
        txt(title, x + 30, 638, 345, 34, executive.ink, { fontWeight: 700 }),
        txt(body, x + 30, 708, 340, 23, executive.muted, { lineHeight: 1.45 }),
      ];
    }),
    txt('01', 100, 972, 90, 18, executive.muted, { letterSpacing: 2, fontWeight: 700 }),
    txt('AXIS  /  ESTRATÉGIA', 1450, 972, 370, 18, executive.muted, {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
  ], 'deck-office', 0.82),
  page('03 — Contexto', executive.white, [
    txt('01  /  CONTEXTO', 100, 70, 900, 18, executive.blue, { letterSpacing: 4, fontWeight: 700 }),
    txt('O cenário muda.\nNossa resposta também.', 92, 142, 1280, 72, executive.ink, {
      fontWeight: 700,
      lineHeight: 1.07,
      letterSpacing: -2,
    }),
    txt('Três sinais ajudam a orientar as decisões deste ciclo.', 100, 335, 1180, 27, executive.muted),
    ...[
      ['CLIENTES', 'Expectativas mais altas', 'Experiências simples, relevantes e consistentes ganham espaço.'],
      ['MERCADO', 'Mudança mais rápida', 'Novos hábitos e soluções exigem atenção e capacidade de adaptação.'],
      ['OPERAÇÃO', 'Foco como vantagem', 'Processos claros liberam tempo para o trabalho que gera valor.'],
    ].flatMap(([label, title, body], index) => {
      const x = 100 + index * 575;
      return [
        rect(x, 465, 525, 328, index === 1 ? executive.ink : executive.paper, 14),
        txt(label, x + 32, 500, 460, 18, index === 1 ? executive.mint : executive.blue, {
          letterSpacing: 3,
          fontWeight: 700,
        }),
        txt(title, x + 32, 561, 460, 31, index === 1 ? executive.white : executive.ink, {
          fontWeight: 700,
        }),
        txt(body, x + 32, 625, 455, 23, index === 1 ? '#CAD4E0' : executive.muted, {
          lineHeight: 1.45,
        }),
      ];
    }),
    rect(100, 844, 1720, 104, executive.paleBlue, 12),
    txt('OPORTUNIDADE', 132, 879, 260, 18, executive.blue, { letterSpacing: 3, fontWeight: 700 }),
    txt('Unir proximidade com clientes e excelência operacional.', 440, 877, 1310, 25, executive.ink, { fontWeight: 600 }),
    txt('02', 100, 990, 90, 18, executive.muted, { letterSpacing: 2, fontWeight: 700 }),
    txt('AXIS  /  ESTRATÉGIA', 1450, 990, 370, 18, executive.muted, {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
  ], 'deck-workshop', 0.80),
  page('04 — Prioridades', executive.paper, [
    txt('02  /  ESCOLHAS ESTRATÉGICAS', 100, 70, 1100, 18, executive.blue, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('Três escolhas para\nchegar mais longe.', 92, 142, 1100, 75, executive.ink, {
      fontWeight: 700,
      lineHeight: 1.05,
      letterSpacing: -2,
    }),
    ...[
      ['01', 'Atrair clientes certos', 'Aprimorar posicionamento, canais e qualidade da experiência.'],
      ['02', 'Aumentar valor entregue', 'Conectar cada solução a necessidades reais e resultados claros.'],
      ['03', 'Operar com simplicidade', 'Reduzir atritos, fortalecer colaboração e ganhar previsibilidade.'],
    ].flatMap(([number, title, body], index) => {
      const x = 100 + index * 580;
      const accent = [executive.blue, '#28A58D', '#D38B4A'][index];
      return [
        rect(x, 425, 530, 410, executive.white, 16, { stroke: executive.line, strokeWidth: 2 }),
        rect(x, 425, 530, 10, accent),
        txt(number, x + 34, 476, 450, 23, accent, { letterSpacing: 3, fontWeight: 700 }),
        txt(title, x + 34, 545, 455, 31, executive.ink, { fontWeight: 700, lineHeight: 1.2 }),
        rule(x + 34, 622, 460, executive.line),
        txt(body, x + 34, 673, 455, 23, executive.muted, { lineHeight: 1.48 }),
      ];
    }),
    txt('Prioridades revisáveis conforme evidências, capacidade e impacto.', 100, 915, 1400, 21, executive.muted),
    txt('03', 100, 990, 90, 18, executive.muted, { letterSpacing: 2, fontWeight: 700 }),
    txt('AXIS  /  ESTRATÉGIA', 1450, 990, 370, 18, executive.muted, {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
  ], 'deck-architecture', 0.84),
  page('05 — Roteiro', executive.ink, [
    txt('03  /  ROTEIRO DE EXECUÇÃO', 100, 70, 1100, 18, executive.mint, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('Da decisão à entrega.', 92, 145, 1430, 82, executive.white, {
      fontWeight: 700,
      letterSpacing: -2,
    }),
    txt('Um ritmo trimestral transforma intenção em progresso visível.', 100, 278, 1380, 27, '#B8C5D4'),
    rule(156, 554, 1335, '#50627A', 4),
    ...[
      ['T1', 'Preparar', 'Alinhar metas,\nresponsáveis e linha\nde base.'],
      ['T2', 'Construir', 'Testar iniciativas\ne remover os principais\nentraves.'],
      ['T3', 'Expandir', 'Ampliar o que funciona\ne corrigir desvios\ncom rapidez.'],
      ['T4', 'Consolidar', 'Avaliar resultados,\nregistrar aprendizados\ne planejar o próximo ciclo.'],
    ].flatMap(([quarter, title, body], index) => {
      const x = 156 + index * 445;
      return [
        circle(x - 17, 538, 36, index === 0 ? executive.mint : executive.blue),
        txt(quarter, x - 32, 472, 160, 22, executive.mint, { letterSpacing: 3, fontWeight: 700 }),
        txt(title, x - 32, 612, 340, 29, executive.white, { fontWeight: 700 }),
        txt(body, x - 32, 670, 365, 22, '#C4CFDC', { lineHeight: 1.48 }),
      ];
    }),
    rule(100, 900, 1720, '#35475E'),
    txt('MARCOS, RESPONSÁVEIS E DATAS PODEM SER AJUSTADOS PELO TIME.', 100, 936, 1500, 17, '#AEBBCC', {
      letterSpacing: 2,
      fontWeight: 600,
    }),
    txt('04', 100, 1000, 90, 18, '#AEBBCC', { letterSpacing: 2, fontWeight: 700 }),
    txt('AXIS  /  ESTRATÉGIA', 1450, 1000, 370, 18, '#AEBBCC', {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
  ], 'coast', 0.69),
  page('06 — Indicadores', executive.white, [
    txt('04  /  INDICADORES DE SUCESSO', 100, 70, 1100, 18, executive.blue, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('O que vamos acompanhar.', 92, 145, 1430, 76, executive.ink, {
      fontWeight: 700,
      letterSpacing: -2,
    }),
    txt('Defina uma linha de base, uma meta e uma pessoa responsável por cada indicador.', 100, 273, 1560, 25, executive.muted),
    ...[
      ['R$ —', 'Receita recorrente', 'META  /  [VALOR]'],
      ['—%', 'Retenção de clientes', 'META  /  [PERCENTUAL]'],
      ['—', 'Novos clientes', 'META  /  [QUANTIDADE]'],
      ['— / 10', 'Satisfação', 'META  /  [NOTA]'],
    ].flatMap(([value, label, meta], index) => {
      const x = 100 + index * 445;
      const accent = index % 2 === 0 ? executive.blue : '#249B83';
      return [
        rect(x, 420, 405, 360, executive.paper, 14),
        rect(x, 420, 405, 8, accent),
        txt(value, x + 28, 470, 350, 67, executive.ink, { fontWeight: 700, letterSpacing: -2 }),
        txt(label, x + 28, 578, 350, 24, executive.ink, { fontWeight: 700 }),
        rule(x + 28, 638, 348, executive.line),
        txt(meta, x + 28, 683, 350, 16, executive.muted, { letterSpacing: 2, fontWeight: 700 }),
      ];
    }),
    rect(100, 840, 1720, 86, executive.ink, 10),
    txt('RITMO DE REVISÃO', 130, 870, 300, 17, executive.mint, { letterSpacing: 3, fontWeight: 700 }),
    txt('Semanal  /  Mensal  /  Trimestral', 520, 868, 1220, 22, executive.white, { fontWeight: 600 }),
    txt('05', 100, 990, 90, 18, executive.muted, { letterSpacing: 2, fontWeight: 700 }),
    txt('AXIS  /  ESTRATÉGIA', 1450, 990, 370, 18, executive.muted, {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
  ], 'deck-data', 0.80),
  page('07 — Modelo operacional', executive.paper, [
    txt('05  /  MODELO OPERACIONAL', 100, 70, 1100, 18, executive.blue, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('Clareza para executar\nem conjunto.', 92, 145, 1120, 75, executive.ink, {
      fontWeight: 700,
      lineHeight: 1.05,
      letterSpacing: -2,
    }),
    txt('Papéis simples e um ciclo de gestão consistente mantêm o plano em movimento.', 100, 350, 1500, 25, executive.muted),
    ...[
      ['DIREÇÃO', 'Escolher', 'Prioridades, limites\ne resultados esperados.', executive.blue],
      ['EXECUÇÃO', 'Entregar', 'Responsáveis, cadência\ne decisões próximas do trabalho.', '#249B83'],
      ['APRENDIZADO', 'Ajustar', 'Indicadores, conversas\ne melhorias contínuas.', '#D38B4A'],
    ].flatMap(([label, title, body, accent], index) => {
      const x = 100 + index * 580;
      return [
        circle(x, 500, 58, String(accent)),
        txt(`0${index + 1}`, x + 14, 516, 34, 17, executive.white, { fontWeight: 700 }),
        txt(String(label), x, 598, 500, 17, String(accent), { letterSpacing: 3, fontWeight: 700 }),
        txt(String(title), x, 650, 500, 32, executive.ink, { fontWeight: 700 }),
        txt(String(body), x, 713, 500, 22, executive.muted, { lineHeight: 1.48 }),
      ];
    }),
    rule(100, 858, 1720, executive.line),
    txt('FÓRUM DE DECISÃO  ·  [FREQUÊNCIA]  ·  [RESPONSÁVEIS]', 100, 901, 1700, 18, executive.muted, {
      letterSpacing: 2,
      fontWeight: 700,
    }),
    txt('06', 100, 990, 90, 18, executive.muted, { letterSpacing: 2, fontWeight: 700 }),
    txt('AXIS  /  ESTRATÉGIA', 1450, 990, 370, 18, executive.muted, {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
  ], 'deck-planning', 0.83),
  page('08 — Encerramento', executive.ink, [
    rect(1420, 0, 500, H, executive.inkSoft),
    rect(1400, 0, 12, H, executive.mint),
    circle(1530, 178, 260, executive.blue, 0.35),
    circle(1585, 235, 145, executive.mint, 0.86),
    txt('ESTRATÉGIA 2026  /  ENCERRAMENTO', 104, 82, 1180, 18, executive.mint, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('O próximo ciclo\ncomeça agora.', 96, 286, 1210, 94, executive.white, {
      fontWeight: 700,
      lineHeight: 1.04,
      letterSpacing: -3,
    }),
    txt('Uma direção clara. Um time alinhado.\nProgresso que podemos acompanhar.', 106, 565, 1080, 31, '#C5CFDC', {
      lineHeight: 1.45,
    }),
    rect(106, 770, 358, 66, executive.mint, 33),
    txt('PRÓXIMOS PASSOS', 126, 791, 318, 18, executive.ink, {
      textAlign: 'center',
      letterSpacing: 2,
      fontWeight: 700,
    }),
    rule(106, 916, 1150, '#425168'),
    txt('[NOME]  ·  [CARGO]  ·  [CONTATO]', 106, 952, 1150, 17, '#D6DEEA', { letterSpacing: 2 }),
    txt('OBRIGADO', 1440, 450, 460, 24, executive.white, {
      textAlign: 'center',
      letterSpacing: 7,
      fontWeight: 700,
    }),
    txt('08  /  08', 1440, 980, 460, 17, '#C4D2E2', { textAlign: 'center', letterSpacing: 3 }),
  ], 'deck-workspace', 0.52),
];

const proposal = {
  ink: '#202C31',
  olive: '#637665',
  terracotta: '#B8664C',
  paper: '#F4F0E7',
  white: '#FFFEFB',
  muted: '#6D756E',
  line: '#DCD8CE',
  paleGreen: '#E2E8DE',
  sand: '#D9C5A5',
};

const proposalPages: DesignPage[] = [
  page('01 — Capa da proposta', proposal.paper, [
    rect(0, 0, 1312, H, proposal.paper, 0, { opacity: 0.96 }),
    photo('deck-office', 1330, 0, 590, H),
    rect(1330, 0, 590, H, proposal.olive, 0, { opacity: 0.48 }),
    rect(1312, 0, 6, H, proposal.terracotta),
    txt('ESTÚDIO NORTE  /  PROPOSTA', 100, 80, 1080, 20, proposal.olive, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('APRESENTAÇÃO COMERCIAL', 104, 265, 1040, 18, proposal.terracotta, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('Uma parceria\npara crescer.', 94, 350, 1120, 99, proposal.ink, {
      fontFamily: 'Georgia',
      lineHeight: 1.04,
    }),
    txt('Estratégia, criação e execução para [NOME DO CLIENTE].', 104, 628, 1050, 28, proposal.ink, {
      fontWeight: 500,
    }),
    rule(104, 888, 1080, '#C8C8BD'),
    txt('PREPARADO PARA  [CLIENTE]', 104, 930, 500, 16, proposal.muted, {
      letterSpacing: 2,
      fontWeight: 700,
    }),
    txt('[DATA]  /  VERSÃO 01', 708, 930, 476, 16, proposal.muted, {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
    txt('01', 1400, 423, 450, 150, proposal.white, {
      textAlign: 'center',
      fontFamily: 'Georgia',
      fontStyle: 'italic',
      fontSize: 142,
    }),
    txt('PROPOSTA\nPERSONALIZADA', 1420, 615, 410, 22, proposal.white, {
      textAlign: 'center',
      letterSpacing: 4,
      lineHeight: 1.5,
      fontWeight: 700,
    }),
    txt('ESTRATÉGIA  ·  DESIGN  ·  CRESCIMENTO', 1380, 976, 490, 16, '#E7ECE4', {
      textAlign: 'center',
      letterSpacing: 2,
    }),
  ], 'deck-desk', 0.58),
  page('02 — O desafio', proposal.white, [
    txt('01  /  PONTO DE PARTIDA', 100, 70, 1100, 18, proposal.terracotta, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('Uma oportunidade\npara fazer melhor.', 92, 150, 1120, 75, proposal.ink, {
      fontFamily: 'Georgia',
      lineHeight: 1.06,
    }),
    rect(100, 385, 1720, 154, proposal.paper, 12),
    txt('O DESAFIO', 134, 420, 270, 17, proposal.terracotta, { letterSpacing: 3, fontWeight: 700 }),
    txt('[Descreva aqui o desafio principal e o impacto que ele tem no negócio.]', 470, 417, 1280, 25, proposal.ink, {
      lineHeight: 1.4,
      fontWeight: 600,
    }),
    ...[
      ['01', 'O que precisa mudar', 'Contexto e necessidade prioritária.'],
      ['02', 'Quem queremos atender', 'Públicos, clientes e suas expectativas.'],
      ['03', 'Como reconhecer sucesso', 'Resultados observáveis e critérios claros.'],
    ].flatMap(([number, title, body], index) => {
      const x = 100 + index * 580;
      return [
        txt(number, x, 640, 500, 20, proposal.olive, { letterSpacing: 3, fontWeight: 700 }),
        rule(x, 690, 500, proposal.line),
        txt(title, x, 730, 500, 25, proposal.ink, { fontWeight: 700 }),
        txt(body, x, 790, 490, 21, proposal.muted, { lineHeight: 1.45 }),
      ];
    }),
    txt('02', 100, 990, 90, 18, proposal.muted, { letterSpacing: 2, fontWeight: 700 }),
    txt('[CLIENTE]  /  PROPOSTA COMERCIAL', 1250, 990, 570, 18, proposal.muted, {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
  ], 'deck-meeting', 0.82),
  page('03 — Abordagem', proposal.paper, [
    txt('02  /  NOSSA ABORDAGEM', 100, 70, 1100, 18, proposal.terracotta, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('Um processo simples,\nfeito para gerar valor.', 92, 148, 1260, 75, proposal.ink, {
      fontFamily: 'Georgia',
      lineHeight: 1.06,
    }),
    ...[
      ['01', 'Descobrir', 'Imersão, pesquisa e alinhamento sobre objetivos.'],
      ['02', 'Definir', 'Direção estratégica, escopo e critérios de sucesso.'],
      ['03', 'Desenvolver', 'Criação, revisão e validação com as pessoas certas.'],
      ['04', 'Evoluir', 'Entrega, acompanhamento e recomendações de continuidade.'],
    ].flatMap(([number, title, body], index) => {
      const x = 100 + index * 445;
      const accent = index % 2 === 0 ? proposal.olive : proposal.terracotta;
      return [
        rect(x, 470, 405, 355, proposal.white, 14, { stroke: proposal.line, strokeWidth: 2 }),
        txt(number, x + 28, 505, 340, 21, accent, { letterSpacing: 3, fontWeight: 700 }),
        circle(x + 28, 568, 42, accent),
        txt(String(index + 1), x + 39, 579, 24, 16, proposal.white, { fontWeight: 700 }),
        txt(title, x + 28, 650, 345, 27, proposal.ink, { fontWeight: 700 }),
        txt(body, x + 28, 704, 345, 20, proposal.muted, { lineHeight: 1.45 }),
      ];
    }),
    txt('Cada etapa inclui pontos de revisão e aprovação definidos em conjunto.', 100, 900, 1550, 21, proposal.muted),
    txt('03', 100, 990, 90, 18, proposal.muted, { letterSpacing: 2, fontWeight: 700 }),
    txt('[CLIENTE]  /  PROPOSTA COMERCIAL', 1250, 990, 570, 18, proposal.muted, {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
  ], 'deck-craft', 0.82),
  page('04 — Escopo e entregas', proposal.white, [
    txt('03  /  ESCOPO DE TRABALHO', 100, 70, 1100, 18, proposal.terracotta, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('O que será entregue.', 92, 150, 1320, 72, proposal.ink, {
      fontFamily: 'Georgia',
    }),
    rect(100, 340, 1720, 60, proposal.ink, 8),
    txt('ETAPA', 130, 360, 300, 16, proposal.white, { letterSpacing: 2, fontWeight: 700 }),
    txt('ENTREGA', 500, 360, 660, 16, proposal.white, { letterSpacing: 2, fontWeight: 700 }),
    txt('PRAZO', 1450, 360, 300, 16, proposal.white, { textAlign: 'right', letterSpacing: 2, fontWeight: 700 }),
    ...[
      ['01', 'Diagnóstico e alinhamento', '[Relatório / reunião de partida]', '[X] dias'],
      ['02', 'Direção estratégica', '[Recomendações e prioridades]', '[X] semanas'],
      ['03', 'Criação e desenvolvimento', '[Peças / protótipos / materiais]', '[X] semanas'],
      ['04', 'Entrega e transferência', '[Arquivos finais / orientação]', '[DATA]'],
    ].flatMap(([number, title, deliverable, timing], index) => {
      const y = 424 + index * 120;
      return [
        txt(number, 130, y + 8, 250, 17, proposal.terracotta, { letterSpacing: 2, fontWeight: 700 }),
        txt(title, 130, y + 40, 340, 21, proposal.ink, { fontWeight: 700 }),
        txt(deliverable, 500, y + 38, 770, 20, proposal.muted),
        txt(timing, 1400, y + 38, 350, 20, proposal.olive, { textAlign: 'right', fontWeight: 700 }),
        rule(130, y + 94, 1620, proposal.line),
      ];
    }),
    rect(100, 925, 1720, 62, proposal.paleGreen, 10),
    txt('ESCOPO, CRITÉRIOS DE ACEITE E RESPONSÁVEIS SÃO CONFIRMADOS NA PARTIDA.', 130, 947, 1660, 16, proposal.olive, {
      letterSpacing: 2,
      fontWeight: 700,
    }),
    txt('04', 100, 1025, 90, 17, proposal.muted, { letterSpacing: 2, fontWeight: 700 }),
    txt('[CLIENTE]  /  PROPOSTA COMERCIAL', 1250, 1025, 570, 17, proposal.muted, {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
  ], 'deck-project', 0.83),
  page('05 — Investimento e agenda', proposal.ink, [
    txt('04  /  CONDIÇÕES DA PROPOSTA', 100, 70, 1100, 18, '#D9B99B', {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('Investimento e agenda.', 92, 150, 1450, 75, proposal.white, {
      fontFamily: 'Georgia',
    }),
    txt('Uma visão transparente de valores, etapas e condições.', 100, 276, 1450, 24, '#BDC4BD'),
    rect(100, 400, 770, 420, '#2B3939', 14),
    txt('INVESTIMENTO TOTAL', 140, 448, 680, 18, '#D9B99B', { letterSpacing: 3, fontWeight: 700 }),
    txt('R$ —', 134, 510, 680, 84, proposal.white, { fontWeight: 700, letterSpacing: -2 }),
    rule(140, 626, 685, '#52605C'),
    txt('Forma de pagamento', 140, 666, 320, 18, '#BDC4BD'),
    txt('[CONDIÇÃO]', 500, 666, 325, 18, proposal.white, { textAlign: 'right', fontWeight: 700 }),
    txt('Validade da proposta', 140, 724, 320, 18, '#BDC4BD'),
    txt('[DATA]', 500, 724, 325, 18, proposal.white, { textAlign: 'right', fontWeight: 700 }),
    txt('AGENDA ESTIMADA', 1000, 414, 700, 18, '#D9B99B', { letterSpacing: 3, fontWeight: 700 }),
    ...[
      ['SEMANA 01', 'Partida e alinhamento'],
      ['SEMANA 02—03', 'Pesquisa e direção'],
      ['SEMANA 04—06', 'Desenvolvimento e validação'],
      ['SEMANA 07', 'Entrega e próximos passos'],
    ].flatMap(([when, what], index) => {
      const y = 480 + index * 87;
      return [
        rect(1000, y, 150, 38, index === 0 ? proposal.terracotta : '#3A4947', 19),
        txt(when, 1013, y + 10, 124, 14, proposal.white, {
          textAlign: 'center',
          letterSpacing: 1,
          fontWeight: 700,
        }),
        txt(what, 1190, y + 7, 570, 20, proposal.white, { fontWeight: 600 }),
      ];
    }),
    txt('Prazos contam a partir da aprovação e do recebimento dos materiais necessários.', 1000, 864, 760, 18, '#BDC4BD', { lineHeight: 1.4 }),
    txt('05', 100, 1000, 90, 18, '#BDC4BD', { letterSpacing: 2, fontWeight: 700 }),
    txt('[CLIENTE]  /  PROPOSTA COMERCIAL', 1250, 1000, 570, 18, '#BDC4BD', {
      textAlign: 'right',
      letterSpacing: 2,
      fontWeight: 700,
    }),
  ], 'deck-boardroom', 0.58),
  page('06 — Próximos passos', proposal.paper, [
    rect(1320, 0, 600, H, proposal.olive),
    rect(1300, 0, 12, H, proposal.terracotta),
    txt('ESTÚDIO NORTE  /  ENCERRAMENTO', 100, 78, 1080, 18, proposal.terracotta, {
      letterSpacing: 4,
      fontWeight: 700,
    }),
    txt('Prontos para\ncomeçar?', 92, 235, 1110, 100, proposal.ink, {
      fontFamily: 'Georgia',
      lineHeight: 1.05,
    }),
    txt('Se esta proposta fizer sentido, alinhamos os detalhes e iniciamos a primeira etapa.', 100, 535, 1050, 26, proposal.muted, {
      lineHeight: 1.45,
    }),
    rule(100, 770, 1080, '#C8C8BD'),
    txt('[NOME DO CONTATO]', 100, 814, 520, 19, proposal.ink, { fontWeight: 700, letterSpacing: 1 }),
    txt('[E-MAIL]  ·  [TELEFONE]  ·  [SITE]', 100, 858, 1080, 17, proposal.muted, { letterSpacing: 1 }),
    txt('OBRIGADO', 1390, 435, 460, 26, proposal.white, {
      textAlign: 'center',
      letterSpacing: 7,
      fontWeight: 700,
    }),
    rule(1485, 500, 270, '#AAB7A8'),
    txt('Uma boa parceria começa\ncom uma boa conversa.', 1380, 548, 480, 24, proposal.white, {
      textAlign: 'center',
      lineHeight: 1.5,
    }),
    txt('06  /  06', 1390, 978, 460, 17, '#E7ECE4', { textAlign: 'center', letterSpacing: 3 }),
  ], 'deck-partnership', 0.50),
];

export const presentationTemplates: Template[] = [
  ...premiumPresentationTemplates,
  deck('executive-strategy-2026', 'Estratégia 2026 · Deck executivo', executive.ink, executivePages),
  deck('commercial-proposal-premium', 'Proposta comercial · Deck premium', proposal.paper, proposalPages),
];
