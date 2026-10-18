import { element, uid } from './model';
import type { DesignPage } from './model';

export interface TextPreset {
  id: string;
  title: string;
  category: string;
  page: DesignPage;
}

interface Composition {
  id: string; title: string; category: string; heading: string; subtitle: string;
  font: string; body?: string; ink: string; paper: string; accent?: string;
  centered?: boolean; italic?: boolean; weight?: number; size?: number; eyebrow?: string;
}

function composition(c: Composition): TextPreset {
  const align = c.centered ? 'center' : 'left';
  const size = c.size ?? 76;
  const body = c.body ?? 'Inter';
  return {
    id: c.id, title: c.title, category: c.category,
    page: {
      id: uid(), name: c.title, background: c.paper,
      elements: [
        element('text', { name: 'Chamada', text: c.eyebrow ?? c.category.toUpperCase(), x: 64, y: 60,
          width: 672, height: 30, fontFamily: body, fontSize: 17, fontWeight: 700,
          letterSpacing: 3, fill: c.accent ?? c.ink, textAlign: align }),
        element('text', { name: c.title, text: c.heading, x: 64, y: 130,
          width: 672, height: 205, fontFamily: c.font, fontSize: size, fontWeight: c.weight ?? 400,
          fontStyle: c.italic ? 'italic' : 'normal', lineHeight: 1.08, letterSpacing: -1,
          fill: c.ink, textAlign: align }),
        element('rect', { name: 'Detalhe', x: c.centered ? 365 : 64, y: 350, width: 70,
          height: 3, fill: c.accent ?? c.ink }),
        element('text', { name: 'Complemento', text: c.subtitle, x: 64, y: 386,
          width: 672, height: 70, fontFamily: body, fontSize: 24, fontWeight: 400,
          lineHeight: 1.35, fill: c.ink, textAlign: align }),
      ],
    },
  };
}

export const textPresets: TextPreset[] = [
  { id: 'editorial-essence', title: 'Essência editorial', category: 'Editorial', heading: 'Menos,\nmas melhor.', subtitle: 'O essencial também surpreende.', font: 'Playfair Display', ink: '#2b352e', paper: '#f4f0e7', accent: '#74816a', italic: true, eyebrow: 'ESTÚDIO / NOTA 01' },
  { id: 'modern-strategy', title: 'Estratégia contemporânea', category: 'Negócios', heading: 'Clareza gera\nmovimento.', subtitle: 'Uma nova perspectiva para a sua marca.', font: 'Manrope', weight: 700, ink: '#1e3450', paper: '#eef3f8', accent: '#416a9a', eyebrow: 'VISÃO & ESTRATÉGIA' },
  { id: 'quiet-luxury', title: 'Elegância natural', category: 'Editorial', heading: 'Feito com\nintenção.', subtitle: 'Detalhes que fazem a diferença.', font: 'Lora', italic: true, ink: '#514138', paper: '#eee7dc', accent: '#9a7963', centered: true, eyebrow: 'DESIGN AUTORAL' },
  { id: 'bold-sale', title: 'Campanha de lançamento', category: 'Promoções', heading: 'NOVOS\nFAVORITOS.', subtitle: 'Nova coleção. Novas possibilidades.', font: 'Anton', size: 82, ink: '#983d2c', paper: '#faede6', accent: '#c76943', eyebrow: 'CHEGOU POR AQUI' },
  { id: 'creative-studio', title: 'Estúdio criativo', category: 'Criativo', heading: 'Ideias que\nconectam.', subtitle: 'Design para colocar o mundo em movimento.', font: 'Space Grotesk', weight: 700, ink: '#294747', paper: '#eaf1ee', accent: '#537e6d', eyebrow: 'ESTÚDIO CRIATIVO' },
  { id: 'wedding-note', title: 'Convite elegante', category: 'Celebrações', heading: 'O começo\nde nós.', subtitle: 'Um dia para guardar para sempre.', font: 'Playfair Display', italic: true, ink: '#624b43', paper: '#f5eeea', accent: '#a38170', centered: true, eyebrow: 'VOCÊ FAZ PARTE DA HISTÓRIA' },
  { id: 'architecture-title', title: 'Arquitetura editorial', category: 'Editorial', heading: 'Espaços\npara sentir.', subtitle: 'Arquitetura, luz e novas formas de viver.', font: 'Georgia', ink: '#363f33', paper: '#eeeee4', accent: '#7d8763', eyebrow: 'ARQUITETURA & INTERIORES' },
  { id: 'brand-direction', title: 'Direção de marca', category: 'Negócios', heading: 'Sua próxima\ngrande ideia.', subtitle: 'Da intenção ao impacto.', font: 'Montserrat', weight: 700, size: 68, ink: '#28394f', paper: '#edf0f5', accent: '#5d769c', eyebrow: 'PLANEJAR. CRIAR. EVOLUIR.' },
  { id: 'atelier-signature', title: 'Assinatura do ateliê', category: 'Criativo', heading: 'Objetos com\nsignificado.', subtitle: 'Peças autorais, feitas para durar.', font: 'Lora', ink: '#663f31', paper: '#f0e5da', accent: '#ad6c47', eyebrow: 'ATELIÊ / EDIÇÃO LIMITADA' },
  { id: 'discount-editorial', title: 'Oferta com presença', category: 'Promoções', heading: '50% OFF', subtitle: 'Uma seleção especial, por tempo limitado.', font: 'Bebas Neue', size: 120, ink: '#252e31', paper: '#eeeae3', accent: '#b36b46', centered: true, eyebrow: 'SEUS NOVOS ESSENCIAIS' },
  { id: 'birthday-script', title: 'Celebração delicada', category: 'Celebrações', heading: 'Celebre\na vida.', subtitle: 'Um novo ciclo. Muitas histórias.', font: 'Dancing Script', weight: 700, size: 86, ink: '#814d60', paper: '#f7ecf0', accent: '#ac7685', centered: true, eyebrow: 'PARA UM DIA ESPECIAL' },
  { id: 'portfolio-direct', title: 'Portfólio de autor', category: 'Criativo', heading: 'DESIGN EM\nMOVIMENTO.', subtitle: 'Trabalhos selecionados · Portfólio criativo', font: 'Space Grotesk', weight: 700, size: 66, ink: '#30394a', paper: '#efedf5', accent: '#7a719b', eyebrow: 'FORMA / FUNÇÃO / EXPRESSÃO' },
  { id: 'wellness-note', title: 'Bem-estar essencial', category: 'Editorial', heading: 'Uma pausa\npara você.', subtitle: 'Encontre tempo para o que importa.', font: 'Playfair Display', italic: true, ink: '#3c5746', paper: '#eaf0e5', accent: '#76916b', centered: true, eyebrow: 'PRESENÇA & EQUILÍBRIO' },
  { id: 'coffee-letter', title: 'Café de origem', category: 'Editorial', heading: 'Bom café.\nBoas histórias.', subtitle: 'Um convite para desacelerar.', font: 'Georgia', ink: '#513c2d', paper: '#efe4d6', accent: '#9c734c', eyebrow: 'TORRA LOCAL / FEITO COM TEMPO' },
  { id: 'product-launch', title: 'Lançamento minimalista', category: 'Promoções', heading: 'Uma nova\nforma de ser.', subtitle: 'Descubra a coleção que acaba de chegar.', font: 'Raleway', weight: 700, ink: '#39423b', paper: '#e9ede7', accent: '#778579', centered: true, eyebrow: 'NOVA COLEÇÃO' },
  { id: 'business-report', title: 'Relatório executivo', category: 'Negócios', heading: 'RESULTADOS\nQUE IMPORTAM.', subtitle: 'Uma visão clara para as próximas decisões.', font: 'Oswald', weight: 700, size: 68, ink: '#273b56', paper: '#edf1f6', accent: '#537795', eyebrow: 'PANORAMA / EDIÇÃO 01' },
  { id: 'thank-you', title: 'Agradecimento especial', category: 'Celebrações', heading: 'Um carinho\nem palavras.', subtitle: 'Sua presença faz toda a diferença.', font: 'Lora', italic: true, ink: '#705443', paper: '#f4ece3', accent: '#b58f6a', centered: true, eyebrow: 'COM GRATIDÃO' },
  { id: 'design-manifesto', title: 'Manifesto criativo', category: 'Criativo', heading: 'QUESTIONE.\nCRIE. REPITA.', subtitle: 'O próximo passo começa com uma ideia.', font: 'Anton', size: 76, ink: '#393c5a', paper: '#eeedf5', accent: '#7b75a4', eyebrow: 'PENSAMENTO EM CONSTRUÇÃO' },
  { id: 'gourmet-editorial', title: 'Gastronomia de autor', category: 'Editorial', heading: 'À mesa,\ncom tempo.', subtitle: 'Ingredientes honestos. Encontros especiais.', font: 'Playfair Display', ink: '#454c34', paper: '#f2f0e4', accent: '#8a925b', eyebrow: 'COZINHA DE ESTAÇÃO' },
  { id: 'workshop', title: 'Workshop contemporâneo', category: 'Negócios', heading: 'Aprenda.\nTransforme.', subtitle: 'Conhecimento que se transforma em prática.', font: 'Poppins', weight: 700, size: 69, ink: '#2f4c53', paper: '#eaf2f1', accent: '#5b8e8c', eyebrow: 'WORKSHOP / INSCRIÇÕES ABERTAS' },
  { id: 'seasonal-sale', title: 'Seleção da estação', category: 'Promoções', heading: 'ESSENCIAIS\nDA ESTAÇÃO.', subtitle: 'Escolhas para acompanhar os seus dias.', font: 'Bebas Neue', size: 86, ink: '#724230', paper: '#f5e9dc', accent: '#ad7345', eyebrow: 'CURADORIA ESPECIAL' },
  { id: 'event-invitation', title: 'Encontro memorável', category: 'Celebrações', heading: 'Vamos criar\nmemórias.', subtitle: 'Música, encontros e bons momentos.', font: 'Georgia', italic: true, ink: '#6d4352', paper: '#f1e7ed', accent: '#a76d83', centered: true, eyebrow: 'RESERVE ESSE DIA' },
  { id: 'travel-editorial', title: 'Diário de viagem', category: 'Editorial', heading: 'O mundo\nchama.', subtitle: 'Novos caminhos. Histórias para levar.', font: 'Lora', italic: true, ink: '#354c51', paper: '#e8eff0', accent: '#6b8e93', eyebrow: 'DIÁRIO / LUGARES PARA SENTIR' },
  { id: 'ideas-lab', title: 'Laboratório de ideias', category: 'Criativo', heading: 'Faça espaço\npara o novo.', subtitle: 'Pequenas experiências. Grandes descobertas.', font: 'Manrope', weight: 700, size: 70, ink: '#3c4a39', paper: '#edf0e5', accent: '#829269', eyebrow: 'EXPLORE / EXPERIMENTE / CRIE' },
].map(composition);
