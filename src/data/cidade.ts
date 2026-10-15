import type { Cidade, Partido } from '../engine/types';

export const CIDADE: Cidade = {
  nome: 'Vila Esperança',
  populacao: 62000,
  eleitores: 48000,
  descricao:
    'Cidade pequena do interior, conhecida pela festa do milho e pela fofoca rápida. O eleitor gosta de promessa, mas desconfia de quem fala grosso.',
  afinidadeTom: {
    honesta: 1.0,
    evasiva: 1.0,
    populista: 1.2,
    agressiva: 0.85,
  },
};

export const PARTIDOS: Partido[] = [
  { sigla: 'PVP', nome: 'Partido da Voz do Povo', cor: '#ff5d5d' },
  { sigla: 'MNA', nome: 'Movimento Novo Amanhã', cor: '#4a8cff' },
  { sigla: 'PTV', nome: 'Partido Terra Verde', cor: '#3ccf7a' },
  { sigla: 'UPL', nome: 'União pelo Progresso Local', cor: '#ff9f43' },
];

export const RIVAL_BASE = {
  nome: 'Otávio Ramalho',
  partido: 'PCT – Partido da Continuidade Tradicional',
};
