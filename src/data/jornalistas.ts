import type { Jornalista, PerfilJornalista, Tom } from '../engine/types';

/**
 * Tabela perfil × tom: pontos base de aprovação e mídia.
 * Positivo = o público gostou; negativo = pegou mal.
 */
export const MATRIZ_TOM: Record<PerfilJornalista, Record<Tom, { aprovacao: number; midia: number }>> = {
  hostil: {
    honesta: { aprovacao: 2, midia: 2 },
    evasiva: { aprovacao: -2, midia: -2 },
    populista: { aprovacao: -1, midia: -1 },
    agressiva: { aprovacao: 1, midia: -3 },
  },
  neutro: {
    honesta: { aprovacao: 2, midia: 1 },
    evasiva: { aprovacao: -1, midia: 0 },
    populista: { aprovacao: 1, midia: 0 },
    agressiva: { aprovacao: -1, midia: -1 },
  },
  amigo: {
    honesta: { aprovacao: 1, midia: 1 },
    evasiva: { aprovacao: 0, midia: 0 },
    populista: { aprovacao: 2, midia: 1 },
    agressiva: { aprovacao: -1, midia: -1 },
  },
  sensacionalista: {
    honesta: { aprovacao: 0, midia: -1 },
    evasiva: { aprovacao: -2, midia: -1 },
    populista: { aprovacao: 2, midia: 2 },
    agressiva: { aprovacao: 1, midia: 2 },
  },
};

export const ROTULO_PERFIL: Record<PerfilJornalista, string> = {
  hostil: 'Hostil',
  neutro: 'Neutro',
  amigo: 'Amigo',
  sensacionalista: 'Sensacionalista',
};

export const ROTULO_TOM: Record<Tom, string> = {
  honesta: 'Honesta',
  evasiva: 'Evasiva',
  populista: 'Populista',
  agressiva: 'Agressiva',
};

export const JORNALISTAS: Jornalista[] = [
  {
    id: 'vera',
    nome: 'Vera Matos',
    veiculo: 'Jornal O Fiscal',
    perfil: 'hostil',
    descricao: 'Repórter investigativa. Tem uma pasta com o seu nome.',
    dica: 'Odeia enrolação. Franqueza é respeitada; fugir da pergunta é suicídio.',
    aparencia: {
      pele: '#e9b48a',
      cabelo: '#2b1d14',
      estiloCabelo: 'coque',
      roupa: '#5b5f97',
      acessorios: ['oculos', 'microfone'],
    },
    reacoes: {
      honesta: 'Hm. Pelo menos foi direto. Anotado.',
      evasiva: 'Isso não é uma resposta, vereador.',
      populista: 'Bonito discurso. E os números?',
      agressiva: 'Ah, então é assim que o senhor trata a imprensa?',
      tempo: 'O silêncio também diz muita coisa...',
    },
  },
  {
    id: 'paulo',
    nome: 'Paulo Siqueira',
    veiculo: 'Rádio Cidade FM',
    perfil: 'neutro',
    descricao: 'Locutor do programa da manhã. Ouvido em toda padaria.',
    dica: 'Equilibrado. Respostas claras funcionam; agressividade soa mal no rádio.',
    aparencia: {
      pele: '#c98b5e',
      cabelo: '#6b6b6b',
      estiloCabelo: 'careca',
      roupa: '#3ccf7a',
      acessorios: ['bigode', 'microfone'],
    },
    reacoes: {
      honesta: 'Resposta clara para o ouvinte. Obrigado!',
      evasiva: 'Hmm, acho que o ouvinte ficou na dúvida...',
      populista: 'O povo gosta de ouvir isso, hein!',
      agressiva: 'Calma, vereador, estamos ao vivo!',
      tempo: 'Parece que caiu a ligação... alô?',
    },
  },
  {
    id: 'celeste',
    nome: 'Dona Celeste Amaral',
    veiculo: 'TV Comunitária',
    perfil: 'amigo',
    descricao: 'Apresentadora querida. Conhece sua mãe desde a escola.',
    dica: 'Simpática. Promessas emocionantes rendem muito; ser grosso com ela pega mal.',
    aparencia: {
      pele: '#f3c9a8',
      cabelo: '#d9d9e3',
      estiloCabelo: 'cacheado',
      roupa: '#ff7eb6',
      acessorios: ['colar', 'microfone'],
    },
    reacoes: {
      honesta: 'Que sinceridade bonita, meu filho.',
      evasiva: 'Tudo bem, a gente fala disso outro dia.',
      populista: 'Ai, que lindo! O povo vai adorar!',
      agressiva: 'Nossa... não precisava falar assim.',
      tempo: 'Ficou nervoso? Respira, querido.',
    },
  },
  {
    id: 'kaio',
    nome: 'Kaio Brito',
    veiculo: 'Portal Bafafá',
    perfil: 'sensacionalista',
    descricao: 'Influenciador de notícias. Vive de clique e de treta.',
    dica: 'Quer manchete. Polêmica e frase de efeito rendem; sinceridade morna não viraliza.',
    aparencia: {
      pele: '#8d5a3b',
      cabelo: '#ff9f43',
      estiloCabelo: 'topete',
      roupa: '#9b6bff',
      acessorios: ['brinco', 'microfone'],
    },
    reacoes: {
      honesta: 'Tá... mas isso não dá clique, né?',
      evasiva: 'Fugiu! Isso vai virar meme!',
      populista: 'ISSO! Frase de efeito! Já tô postando!',
      agressiva: 'Treta! Treta! O engajamento explodiu!',
      tempo: 'Travou ao vivo?! Já tá no corte!',
    },
  },
];

export function getJornalista(id: string): Jornalista {
  const j = JORNALISTAS.find((x) => x.id === id);
  if (!j) throw new Error(`Jornalista desconhecido: ${id}`);
  return j;
}
