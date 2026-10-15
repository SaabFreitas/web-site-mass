import type { AparenciaAvatar } from '../engine/types';

/** Aparências que o jogador pode escolher. */
export const AVATARES_JOGADOR: AparenciaAvatar[] = [
  { pele: '#f1c27d', cabelo: '#3b2414', estiloCabelo: 'topete', roupa: '#2f4b9c', acessorios: ['gravata'] },
  { pele: '#c68642', cabelo: '#1b1b1b', estiloCabelo: 'longo', roupa: '#e0475b', acessorios: ['brinco'] },
  { pele: '#8d5524', cabelo: '#1b1b1b', estiloCabelo: 'cacheado', roupa: '#2a9d8f', acessorios: ['colar'] },
  { pele: '#ffdbac', cabelo: '#b5651d', estiloCabelo: 'curto', roupa: '#6c4ab6', acessorios: ['oculos', 'gravata'] },
];

export const AVATAR_RIVAL: AparenciaAvatar = {
  pele: '#e8b98f',
  cabelo: '#9a9a9a',
  estiloCabelo: 'curto',
  roupa: '#3a3a4a',
  acessorios: ['bigode', 'gravata'],
};
