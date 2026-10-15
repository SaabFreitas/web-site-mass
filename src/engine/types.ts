export type Tom = 'honesta' | 'evasiva' | 'populista' | 'agressiva';
export type PerfilJornalista = 'hostil' | 'neutro' | 'amigo' | 'sensacionalista';
export type Tema =
  | 'saude'
  | 'seguranca'
  | 'economia'
  | 'educacao'
  | 'transporte'
  | 'meioambiente'
  | 'corrupcao'
  | 'pessoal';
export type Nivel = 'cidade';

export type ResourceKey =
  | 'dinheiro'
  | 'aprovacao'
  | 'capitalPolitico'
  | 'midia'
  | 'reputacao'
  | 'riscoInvestigacao';
export type Resources = Record<ResourceKey, number>;
export type Deltas = Partial<Resources>;

// ---------- Conteúdo (dados) ----------

export interface Resposta {
  texto: string;
  tom: Tom;
  /** Se presente, a resposta é uma mentira; o texto vira a manchete do escândalo. */
  mentira?: string;
}

export interface Pergunta {
  id: string;
  tema: Tema;
  texto: string;
  respostas: Resposta[];
}

export interface Jornalista {
  id: string;
  nome: string;
  veiculo: string;
  perfil: PerfilJornalista;
  descricao: string;
  dica: string;
  aparencia: AparenciaAvatar;
  reacoes: Record<Tom | 'tempo', string>;
}

export interface AparenciaAvatar {
  pele: string;
  cabelo: string;
  estiloCabelo: 'curto' | 'longo' | 'careca' | 'coque' | 'topete' | 'cacheado';
  roupa: string;
  acessorios: Array<'oculos' | 'bigode' | 'gravata' | 'microfone' | 'brinco' | 'colar'>;
}

export type Faixa = [number, number];

export interface AcaoMensal {
  id: string;
  nome: string;
  icone: string;
  descricao: string;
  custo?: { dinheiro?: number; capitalPolitico?: number };
  efeitos: Partial<Record<ResourceKey, Faixa>>;
  maxPorMes: number;
  /** Ação suja: gera escândalo pendente com essa manchete. */
  suja?: { manchete: string; gravidade: 1 | 2 | 3 };
  /** Ação especial que abre o mini game de entrevista. */
  especial?: 'entrevista';
}

export interface Cidade {
  nome: string;
  populacao: number;
  eleitores: number;
  descricao: string;
  /** Multiplicador regional de aprovação por tom de resposta. */
  afinidadeTom: Record<Tom, number>;
}

export interface Partido {
  sigla: string;
  nome: string;
  cor: string;
}

// ---------- Estado ----------

export interface Pauta {
  tema: Tema;
  emCrise: boolean;
  manchete: string;
}

export interface EscandaloPendente {
  id: string;
  manchete: string;
  gravidade: 1 | 2 | 3;
  mesCriado: number;
}

export interface LogEntry {
  mes: number;
  texto: string;
  tipo: 'info' | 'bom' | 'ruim' | 'alerta';
}

export interface Rival {
  nome: string;
  partido: string;
  aprovacao: number;
  midia: number;
  reputacao: number;
}

export interface LinhaRelatorio {
  rotulo: string;
  valor: string;
  tipo: 'bom' | 'ruim' | 'info';
}

export interface RelatorioMes {
  mes: number;
  linhas: LinhaRelatorio[];
  manchetes: string[];
}

export interface EntrevistaAtiva {
  jornalistaId: string;
  perguntaIds: string[];
  /** Ordem embaralhada das respostas de cada pergunta (índices originais). */
  ordens: number[][];
  /** Respostas já dadas (gravadas uma a uma, para o save não permitir refazer). */
  respostas: RespostaJogador[];
}

export interface RespostaJogador {
  perguntaId: string;
  /** Índice na lista original de respostas; null = tempo esgotado. */
  indice: number | null;
  tempoRestante: number;
}

export interface PontuacaoResposta {
  perguntaId: string;
  tom: Tom | null;
  aprovacao: number;
  midia: number;
  combo: number;
  mentira: boolean;
  tempoEsgotado: boolean;
  reacao: string;
  bom: boolean;
}

export interface ResumoEntrevista {
  jornalistaId: string;
  linhas: PontuacaoResposta[];
  aprovacao: number;
  midia: number;
  melhorCombo: number;
  mentiras: number;
}

export interface ResultadoEleicao {
  cargo: string;
  eleitores: number;
  comparecimento: number;
  votosJogador: number;
  votosRival: number;
  brancosNulos: number;
  percentualJogador: number;
  percentualRival: number;
  venceu: boolean;
}

export type StatusJogo = 'jogando' | 'eleicao' | 'fim';

export interface FimDeJogo {
  vitoria: boolean;
  titulo: string;
  motivo: string;
}

export interface Estatisticas {
  entrevistas: number;
  mentiras: number;
  escandalosExplodidos: number;
  melhorCombo: number;
  acoesRealizadas: number;
}

export interface GameState {
  version: 1;
  seed: string;
  rngState: number;
  mes: number;
  nivel: Nivel;
  jogador: { nome: string; partido: string; avatar: number };
  res: Resources;
  acoesRestantes: number;
  usoAcoesMes: Record<string, number>;
  pauta: Pauta;
  rival: Rival;
  mesEleicao: number;
  escandalos: EscandaloPendente[];
  perguntasFeitas: string[];
  entrevista: EntrevistaAtiva | null;
  ultimaEntrevista: ResumoEntrevista | null;
  relatorio: RelatorioMes | null;
  eleicao: ResultadoEleicao | null;
  status: StatusJogo;
  fim: FimDeJogo | null;
  log: LogEntry[];
  stats: Estatisticas;
  proximoId: number;
}
