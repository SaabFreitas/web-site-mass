import type { Tema } from '../engine/types';

export interface InfoTema {
  rotulo: string;
  icone: string;
  manchetes: string[];
  manchetesCrise: string[];
}

export const TEMAS: Record<Tema, InfoTema> = {
  saude: {
    rotulo: 'Saúde',
    icone: '🏥',
    manchetes: ['Fila no posto de saúde vira assunto na padaria', 'Campanha de vacinação começa na cidade'],
    manchetesCrise: ['Surto de dengue lota o único hospital da cidade!', 'Posto de saúde fica sem médico há duas semanas!'],
  },
  seguranca: {
    rotulo: 'Segurança',
    icone: '🚓',
    manchetes: ['Moradores pedem mais iluminação nas ruas', 'Guarda municipal ganha novas viaturas'],
    manchetesCrise: ['Onda de assaltos assusta o centro!', 'Comerciantes fecham as portas mais cedo por medo!'],
  },
  economia: {
    rotulo: 'Economia',
    icone: '💰',
    manchetes: ['Feira livre bate recorde de movimento', 'Nova fábrica estuda se instalar na região'],
    manchetesCrise: ['Fábrica de calçados anuncia 300 demissões!', 'Preço da cesta básica dispara na cidade!'],
  },
  educacao: {
    rotulo: 'Educação',
    icone: '📚',
    manchetes: ['Escola municipal ganha horta comunitária', 'Pais cobram vagas na creche'],
    manchetesCrise: ['Teto de escola desaba durante a madrugada!', 'Professores entram em greve!'],
  },
  transporte: {
    rotulo: 'Transporte',
    icone: '🚌',
    manchetes: ['Ônibus novo começa a circular no bairro Alto', 'Prefeitura estuda ciclovia na avenida'],
    manchetesCrise: ['Tarifa de ônibus sobe 30% e revolta usuários!', 'Buraco gigante engole carro na avenida principal!'],
  },
  meioambiente: {
    rotulo: 'Meio ambiente',
    icone: '🌳',
    manchetes: ['Mutirão limpa as margens do rio', 'Praça central ganha novas árvores'],
    manchetesCrise: ['Rio da cidade amanhece cheio de peixes mortos!', 'Lixão a céu aberto pega fogo!'],
  },
  corrupcao: {
    rotulo: 'Transparência',
    icone: '🕵️',
    manchetes: ['Câmara publica gastos no site oficial', 'ONG lança ranking de transparência'],
    manchetesCrise: ['Operação policial na prefeitura choca a cidade!', 'Licitação da merenda é investigada!'],
  },
  pessoal: {
    rotulo: 'Vida pessoal',
    icone: '👀',
    manchetes: ['Colunista social comenta o look dos vereadores', 'Políticos da cidade nas redes sociais'],
    manchetesCrise: ['Foto polêmica de vereador viraliza!', 'Fofoca sobre a Câmara domina o grupo da família!'],
  },
};
