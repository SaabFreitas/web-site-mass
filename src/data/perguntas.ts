import type { Pergunta } from '../engine/types';

/**
 * Banco de perguntas da entrevista.
 * Cada resposta tem um tom (escondido do jogador até ele responder).
 * Respostas com `mentira` dão bônus imediato, mas viram escândalo pendente.
 */
export const PERGUNTAS: Pergunta[] = [
  // ---------- Saúde ----------
  {
    id: 'sau01',
    tema: 'saude',
    texto: 'O posto de saúde do bairro Alto está sem médico há semanas. O que o senhor fez a respeito?',
    respostas: [
      { texto: 'Ainda pouco. Já cobrei a Secretaria e vou levar o caso à tribuna nesta semana.', tom: 'honesta' },
      { texto: 'Esse é um problema complexo, que envolve várias esferas de governo.', tom: 'evasiva' },
      { texto: 'Já consegui dois médicos novos, começam na segunda-feira!', tom: 'populista', mentira: 'Os "dois médicos novos" prometidos pelo vereador nunca existiram' },
      { texto: 'Pergunte ao prefeito, que é quem deveria cuidar disso!', tom: 'agressiva' },
    ],
  },
  {
    id: 'sau02',
    tema: 'saude',
    texto: 'A cidade vive um surto de dengue. A culpa não é também da Câmara?',
    respostas: [
      { texto: 'Em parte, sim. Faltou cobrar o mutirão de limpeza a tempo. Vou propor um agora.', tom: 'honesta' },
      { texto: 'Vou pessoalmente acabar com todos os focos do mosquito em um mês!', tom: 'populista' },
      { texto: 'Culpa da Câmara? Culpa de quem joga lixo na rua!', tom: 'agressiva' },
    ],
  },
  {
    id: 'sau03',
    tema: 'saude',
    texto: 'O senhor usa o SUS ou tem plano de saúde particular?',
    respostas: [
      { texto: 'Tenho plano, como muita gente. Mas defendo um SUS que funcione para todos.', tom: 'honesta' },
      { texto: 'Só uso o SUS, igualzinho ao povo!', tom: 'populista', mentira: 'Vereador que "só usa o SUS" é flagrado em hospital particular de luxo' },
      { texto: 'Isso é assunto da minha vida privada.', tom: 'evasiva' },
      { texto: 'Que pergunta mais baixa. Próxima!', tom: 'agressiva' },
    ],
  },
  {
    id: 'sau04',
    tema: 'saude',
    texto: 'Faltam remédios na farmácia municipal. Qual a sua proposta concreta?',
    respostas: [
      { texto: 'Um painel público com o estoque, atualizado toda semana. Transparência resolve metade.', tom: 'honesta' },
      { texto: 'Remédio de graça para todo mundo, sem fila!', tom: 'populista' },
      { texto: 'Estamos estudando alternativas junto aos órgãos competentes.', tom: 'evasiva' },
    ],
  },

  // ---------- Segurança ----------
  {
    id: 'seg01',
    tema: 'seguranca',
    texto: 'Os assaltos no centro aumentaram. O senhor tem coragem de andar sozinho por lá à noite?',
    respostas: [
      { texto: 'Ando, mas com medo, como todo mundo. Por isso quero iluminação nova e ronda fixa.', tom: 'honesta' },
      { texto: 'Bandido em Vila Esperança vai ter que se mudar!', tom: 'populista' },
      { texto: 'Segurança pública é competência do Estado, não do município.', tom: 'evasiva' },
      { texto: 'Mais coragem do que quem fica escrevendo atrás de uma tela!', tom: 'agressiva' },
    ],
  },
  {
    id: 'seg02',
    tema: 'seguranca',
    texto: 'O senhor é a favor de armar a guarda municipal?',
    respostas: [
      { texto: 'Antes de armar, quero treinar. Arma sem preparo aumenta a violência.', tom: 'honesta' },
      { texto: 'Armar todo mundo e acabar com a bandidagem!', tom: 'populista' },
      { texto: 'É um debate que a sociedade precisa amadurecer.', tom: 'evasiva' },
    ],
  },
  {
    id: 'seg03',
    tema: 'seguranca',
    texto: 'Câmeras de monitoramento prometidas há dois anos nunca foram instaladas. Por quê?',
    respostas: [
      { texto: 'A licitação travou e eu não acompanhei como devia. Vou cobrar o cronograma em público.', tom: 'honesta' },
      { texto: 'Mas já estão instaladas! Só não estão ligadas ainda.', tom: 'evasiva', mentira: 'As câmeras "instaladas" nunca saíram da caixa, revela reportagem' },
      { texto: 'Pergunte à gestão anterior, que deixou tudo bagunçado!', tom: 'agressiva' },
    ],
  },
  {
    id: 'seg04',
    tema: 'seguranca',
    texto: 'Um parente seu foi visto com um conhecido traficante. Pode explicar?',
    respostas: [
      { texto: 'Não controlo as amizades de todos os meus parentes, mas apoio qualquer investigação.', tom: 'honesta' },
      { texto: 'Isso é fake news plantada pelos meus adversários!', tom: 'agressiva' },
      { texto: 'Nunca vi esse parente na minha vida.', tom: 'evasiva', mentira: 'Foto mostra vereador em churrasco com o parente que "nunca viu"' },
      { texto: 'Minha família é trabalhadora e honesta como a de vocês!', tom: 'populista' },
    ],
  },

  // ---------- Economia ----------
  {
    id: 'eco01',
    tema: 'economia',
    texto: 'A fábrica de calçados vai demitir 300 pessoas. O que o senhor pode fazer?',
    respostas: [
      { texto: 'Pouca coisa sozinho. Mas posso propor curso gratuito e prioridade nas obras da cidade.', tom: 'honesta' },
      { texto: 'Já liguei para o dono, e ninguém vai ser demitido!', tom: 'populista', mentira: 'Demissões confirmadas desmentem o "acordo" anunciado pelo vereador' },
      { texto: 'O mercado é cíclico; precisamos olhar o cenário macroeconômico.', tom: 'evasiva' },
      { texto: 'Empresário ganancioso não vai mandar nesta cidade!', tom: 'agressiva' },
    ],
  },
  {
    id: 'eco02',
    tema: 'economia',
    texto: 'Os vereadores aumentaram o próprio salário. O senhor votou a favor?',
    respostas: [
      { texto: 'Votei, e me arrependo. Vou doar a diferença para a creche municipal.', tom: 'honesta' },
      { texto: 'Votei contra, claro!', tom: 'populista', mentira: 'Ata da Câmara mostra que o vereador votou A FAVOR do próprio aumento' },
      { texto: 'Foi uma recomposição inflacionária técnica.', tom: 'evasiva' },
    ],
  },
  {
    id: 'eco03',
    tema: 'economia',
    texto: 'Como o senhor vai atrair empregos para Vila Esperança?',
    respostas: [
      { texto: 'Desburocratizando o alvará. Hoje um comerciante espera seis meses para abrir as portas.', tom: 'honesta' },
      { texto: 'Vou trazer uma montadora de carros para cá!', tom: 'populista' },
      { texto: 'Com diálogo e muita parceria.', tom: 'evasiva' },
    ],
  },
  {
    id: 'eco04',
    tema: 'economia',
    texto: 'A feira livre reclama de taxas altas. O senhor vai baixar o imposto?',
    respostas: [
      { texto: 'Dá para reduzir a taxa da feira, sim. Imposto em geral não depende só de mim.', tom: 'honesta' },
      { texto: 'Imposto zero para quem trabalha na feira!', tom: 'populista' },
      { texto: 'Feirante também tem que pagar a conta, como todo mundo.', tom: 'agressiva' },
      { texto: 'Vamos analisar com carinho.', tom: 'evasiva' },
    ],
  },

  // ---------- Educação ----------
  {
    id: 'edu01',
    tema: 'educacao',
    texto: 'O teto de uma escola desabou. O senhor sabia dos problemas na estrutura?',
    respostas: [
      { texto: 'Recebi um alerta há meses e não insisti o suficiente. Erro meu. Vou fiscalizar todas as escolas.', tom: 'honesta' },
      { texto: 'Nunca recebi nenhum alerta.', tom: 'evasiva', mentira: 'Ofício protocolado prova que o vereador foi avisado sobre o teto da escola' },
      { texto: 'Vou reformar todas as escolas da cidade este ano!', tom: 'populista' },
    ],
  },
  {
    id: 'edu02',
    tema: 'educacao',
    texto: 'Os professores estão em greve. De que lado o senhor está?',
    respostas: [
      { texto: 'Do lado dos alunos: quero negociação já, com reajuste possível e reposição das aulas.', tom: 'honesta' },
      { texto: 'Do lado dos professores, sempre! Aumento de 50% já!', tom: 'populista' },
      { texto: 'Greve prejudica as crianças. Tem que cortar o ponto!', tom: 'agressiva' },
      { texto: 'Estou do lado do diálogo.', tom: 'evasiva' },
    ],
  },
  {
    id: 'edu03',
    tema: 'educacao',
    texto: 'Seus filhos estudam em escola pública ou particular?',
    respostas: [
      { texto: 'Particular. E é exatamente por isso que preciso melhorar a pública: todo pai deveria poder escolher.', tom: 'honesta' },
      { texto: 'Pública, com muito orgulho!', tom: 'populista', mentira: 'Filhos do vereador estudam no colégio mais caro da região' },
      { texto: 'Deixe minha família fora disso!', tom: 'agressiva' },
    ],
  },
  {
    id: 'edu04',
    tema: 'educacao',
    texto: 'Faltam 400 vagas na creche municipal. Qual o plano?',
    respostas: [
      { texto: 'Convênio com creches comunitárias já, e uma creche nova no orçamento do ano que vem.', tom: 'honesta' },
      { texto: 'Vaga em creche para todas as crianças até o Natal!', tom: 'populista' },
      { texto: 'É uma demanda histórica, que vem de outras gestões.', tom: 'evasiva' },
    ],
  },

  // ---------- Transporte ----------
  {
    id: 'tra01',
    tema: 'transporte',
    texto: 'A tarifa de ônibus subiu 30%. O senhor vai fazer algo?',
    respostas: [
      { texto: 'Vou pedir a planilha de custos da empresa. Se o aumento não se justificar, vou à Justiça.', tom: 'honesta' },
      { texto: 'Tarifa zero já!', tom: 'populista' },
      { texto: 'A empresa tem contrato, não há o que fazer.', tom: 'evasiva' },
      { texto: 'Essa empresa é uma máfia e eu vou provar!', tom: 'agressiva' },
    ],
  },
  {
    id: 'tra02',
    tema: 'transporte',
    texto: 'A avenida principal está cheia de buracos. O senhor passa por lá?',
    respostas: [
      { texto: 'Todo dia, e meu carro sente. Já pedi a operação tapa-buraco com prazo.', tom: 'honesta' },
      { texto: 'Recapeamento total da avenida no mês que vem!', tom: 'populista', mentira: 'O "recapeamento total" anunciado nunca entrou no orçamento' },
      { texto: 'A chuva atrapalha qualquer planejamento.', tom: 'evasiva' },
    ],
  },
  {
    id: 'tra03',
    tema: 'transporte',
    texto: 'É verdade que o senhor usa carro oficial nos fins de semana?',
    respostas: [
      { texto: 'Usei duas vezes para eventos oficiais. Vou publicar todos os registros de uso.', tom: 'honesta' },
      { texto: 'Nunca! Ando de ônibus como todo trabalhador!', tom: 'populista', mentira: 'Carro oficial do vereador é fotografado na praia num domingo' },
      { texto: 'Quem anda espalhando isso deveria se preocupar com a própria vida!', tom: 'agressiva' },
      { texto: 'O uso de veículos segue a regulamentação vigente.', tom: 'evasiva' },
    ],
  },
  {
    id: 'tra04',
    tema: 'transporte',
    texto: 'O senhor apoia a ciclovia na avenida, mesmo tirando vagas de estacionamento?',
    respostas: [
      { texto: 'Apoio, mas com teste de três meses e ouvindo os comerciantes antes.', tom: 'honesta' },
      { texto: 'Ciclovia e estacionamento para todos, dá para ter os dois!', tom: 'populista' },
      { texto: 'Precisamos de mais estudos técnicos.', tom: 'evasiva' },
    ],
  },

  // ---------- Meio ambiente ----------
  {
    id: 'amb01',
    tema: 'meioambiente',
    texto: 'Peixes mortos apareceram no rio. A empresa suspeita doou para a sua campanha?',
    respostas: [
      { texto: 'Doou, e está declarado. Isso não vai me impedir de pedir uma investigação.', tom: 'honesta' },
      { texto: 'Nunca recebi um centavo dessa empresa.', tom: 'evasiva', mentira: 'Prestação de contas revela doação da empresa poluidora ao vereador' },
      { texto: 'Você está insinuando o quê? Cuidado com o que fala!', tom: 'agressiva' },
    ],
  },
  {
    id: 'amb02',
    tema: 'meioambiente',
    texto: 'O lixão da cidade pegou fogo de novo. Quando vai existir um aterro de verdade?',
    respostas: [
      { texto: 'Um aterro sozinho a cidade não banca. Proponho um consórcio com os municípios vizinhos.', tom: 'honesta' },
      { texto: 'Vou fechar o lixão amanhã mesmo!', tom: 'populista' },
      { texto: 'É uma questão regional complexa.', tom: 'evasiva' },
      { texto: 'Pergunta para o povo que joga lixo em qualquer lugar!', tom: 'agressiva' },
    ],
  },
  {
    id: 'amb03',
    tema: 'meioambiente',
    texto: 'O senhor já plantou alguma árvore na vida?',
    respostas: [
      { texto: 'Para ser honesto, não. Mas vou participar do mutirão do parque no sábado.', tom: 'honesta' },
      { texto: 'Plantei mil árvores no ano passado!', tom: 'populista', mentira: 'As "mil árvores" do vereador nunca foram plantadas, aponta levantamento' },
      { texto: 'Essa pergunta é irrelevante.', tom: 'agressiva' },
    ],
  },
  {
    id: 'amb04',
    tema: 'meioambiente',
    texto: 'Uma mineradora quer explorar a serra da cidade. Gera emprego, mas destrói a mata. E aí?',
    respostas: [
      { texto: 'Só com estudo de impacto independente e audiência pública. Emprego não pode custar a água da cidade.', tom: 'honesta' },
      { texto: 'Mil empregos já! A serra não paga as contas de ninguém!', tom: 'populista' },
      { texto: 'Estamos acompanhando o processo de licenciamento.', tom: 'evasiva' },
    ],
  },

  // ---------- Transparência ----------
  {
    id: 'cor01',
    tema: 'corrupcao',
    texto: 'Seu assessor foi preso numa operação da polícia. O senhor sabia de algo?',
    respostas: [
      { texto: 'Não sabia. Ele foi exonerado hoje e eu entrego à polícia tudo o que tenho.', tom: 'honesta' },
      { texto: 'Nem conheço esse rapaz direito.', tom: 'evasiva', mentira: 'Fotos mostram o vereador e o assessor preso juntos em viagem' },
      { texto: 'Isso é perseguição política contra mim!', tom: 'agressiva' },
      { texto: 'Bandido tem que ir para a cadeia, seja quem for!', tom: 'populista' },
    ],
  },
  {
    id: 'cor02',
    tema: 'corrupcao',
    texto: 'O senhor publicaria todos os seus gastos de gabinete na internet?',
    respostas: [
      { texto: 'Publico, sim. A partir do mês que vem, com nota fiscal.', tom: 'honesta' },
      { texto: 'Já publico tudo, centavo por centavo!', tom: 'populista', mentira: 'Site de gastos do vereador está fora do ar desde que foi criado' },
      { texto: 'Os gastos já são auditados pelos órgãos de controle.', tom: 'evasiva' },
    ],
  },
  {
    id: 'cor03',
    tema: 'corrupcao',
    texto: 'Há rumores de que o senhor recebeu presentes de uma empreiteira. Confirma?',
    respostas: [
      { texto: 'Recebi uma cesta de Natal e devolvi. Posso mostrar o recibo.', tom: 'honesta' },
      { texto: 'Rumores são rumores. Não comento boatos.', tom: 'evasiva' },
      { texto: 'Quem espalha boato vai responder na Justiça!', tom: 'agressiva' },
    ],
  },
  {
    id: 'cor04',
    tema: 'corrupcao',
    texto: 'A licitação da merenda escolar está sob suspeita. O senhor votou a favor do contrato?',
    respostas: [
      { texto: 'Votei, com base no parecer técnico. Se houve fraude, quero CPI.', tom: 'honesta' },
      { texto: 'Fui o único que votou contra!', tom: 'populista', mentira: 'Registro de votação mostra o vereador aprovando o contrato da merenda' },
      { texto: 'O contrato seguiu todos os trâmites legais.', tom: 'evasiva' },
      { texto: 'Isso é sensacionalismo barato!', tom: 'agressiva' },
    ],
  },

  // ---------- Vida pessoal ----------
  {
    id: 'pes01',
    tema: 'pessoal',
    texto: 'Uma foto sua dançando no carnaval viralizou. Arrependido?',
    respostas: [
      { texto: 'Nenhum pouco! Político também é gente. Mas prometo treinar o passinho.', tom: 'honesta' },
      { texto: 'Aquilo foi montagem.', tom: 'evasiva', mentira: 'Vídeo original prova que a "montagem" do carnaval era real' },
      { texto: 'Dancei com o povo, como sempre faço!', tom: 'populista' },
      { texto: 'Vocês não têm notícia de verdade, não?', tom: 'agressiva' },
    ],
  },
  {
    id: 'pes02',
    tema: 'pessoal',
    texto: 'Qual foi o último livro que o senhor leu?',
    respostas: [
      { texto: 'Faz tempo, confesso. Comecei um de história da cidade, mas parei na metade.', tom: 'honesta' },
      { texto: 'A Bíblia e a Constituição, todo dia!', tom: 'populista' },
      { texto: 'Leio muitos relatórios técnicos.', tom: 'evasiva' },
    ],
  },
  {
    id: 'pes03',
    tema: 'pessoal',
    texto: 'O senhor pretende ser prefeito um dia?',
    respostas: [
      { texto: 'Pretendo, sim. Mas primeiro preciso provar que sei ser um bom vereador.', tom: 'honesta' },
      { texto: 'Meu único projeto é servir ao povo!', tom: 'populista' },
      { texto: 'O futuro a Deus pertence.', tom: 'evasiva' },
      { texto: 'E por que não? Alguém tem que consertar essa bagunça!', tom: 'agressiva' },
    ],
  },
  {
    id: 'pes04',
    tema: 'pessoal',
    texto: 'Dizem que o senhor quase nunca aparece nas sessões da Câmara. É verdade?',
    respostas: [
      { texto: 'Faltei mais do que devia neste semestre. Vou publicar minha presença toda semana.', tom: 'honesta' },
      { texto: 'Tenho 100% de presença!', tom: 'populista', mentira: 'Lista oficial mostra que o vereador faltou a metade das sessões' },
      { texto: 'Trabalho mais na rua do que no plenário.', tom: 'evasiva' },
    ],
  },
  {
    id: 'pes05',
    tema: 'pessoal',
    texto: 'O seu rival, Otávio Ramalho, diz que o senhor é "inexperiente". Responda.',
    respostas: [
      { texto: 'Tenho menos experiência, sim. E menos vícios também.', tom: 'honesta' },
      { texto: 'Experiente em quê? Em não fazer nada há vinte anos?', tom: 'agressiva' },
      { texto: 'Minha experiência é a vida do povo simples!', tom: 'populista' },
      { texto: 'Não vou entrar em ataques pessoais.', tom: 'evasiva' },
    ],
  },
];

export function getPergunta(id: string): Pergunta {
  const p = PERGUNTAS.find((q) => q.id === id);
  if (!p) throw new Error(`Pergunta desconhecida: ${id}`);
  return p;
}
