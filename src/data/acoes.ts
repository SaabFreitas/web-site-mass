import type { AcaoMensal } from '../engine/types';

export const ACOES: AcaoMensal[] = [
  {
    id: 'entrevista',
    nome: 'Dar entrevista',
    icone: '🎤',
    descricao: 'Encare um jornalista ao vivo. Pode render muito... ou virar meme.',
    efeitos: {},
    maxPorMes: 2,
    especial: 'entrevista',
  },
  {
    id: 'visitar',
    nome: 'Visitar bairros',
    icone: '🏘️',
    descricao: 'Corpo a corpo, aperto de mão e cafezinho na casa dos eleitores.',
    custo: { dinheiro: 300 },
    efeitos: { aprovacao: [1, 2] },
    maxPorMes: 2,
  },
  {
    id: 'gabinete',
    nome: 'Atender no gabinete',
    icone: '🗂️',
    descricao: 'Resolve pedidos de moradores e faz favores a colegas da Câmara.',
    efeitos: { capitalPolitico: [2, 4], aprovacao: [0, 1] },
    maxPorMes: 1,
  },
  {
    id: 'projeto',
    nome: 'Propor projeto de lei',
    icone: '📜',
    descricao: 'Gasta capital político para aprovar algo que o povo vê.',
    custo: { capitalPolitico: 6 },
    efeitos: { aprovacao: [3, 5], midia: [1, 3], reputacao: [0, 2] },
    maxPorMes: 1,
  },
  {
    id: 'comerciantes',
    nome: 'Jantar com comerciantes',
    icone: '🍝',
    descricao: 'Arrecadação legal de doações. Dinheiro limpo, mas pouco.',
    efeitos: { dinheiro: [1500, 3000], capitalPolitico: [0, 1] },
    maxPorMes: 1,
  },
  {
    id: 'beneficente',
    nome: 'Evento beneficente',
    icone: '🎪',
    descricao: 'Quermesse com bingo e pastel. Caro, mas o povo lembra.',
    custo: { dinheiro: 1800 },
    efeitos: { aprovacao: [2, 4], midia: [1, 3], reputacao: [1, 2] },
    maxPorMes: 1,
  },
  {
    id: 'panfletos',
    nome: 'Panfletagem',
    icone: '📣',
    descricao: 'Santinhos e carro de som. Quanto mais perto da eleição, melhor.',
    custo: { dinheiro: 1000 },
    efeitos: { aprovacao: [1, 3] },
    maxPorMes: 1,
  },
  {
    id: 'caixa2',
    nome: 'Aceitar doação "por fora"',
    icone: '💼',
    descricao: 'Um empresário oferece uma mala de dinheiro. Ninguém precisa saber... certo?',
    efeitos: { dinheiro: [5000, 7000], riscoInvestigacao: [15, 25] },
    maxPorMes: 1,
    suja: { manchete: 'Empresário revela "doação por fora" para vereador!', gravidade: 2 },
  },
];

export function getAcao(id: string): AcaoMensal | undefined {
  return ACOES.find((a) => a.id === id);
}
