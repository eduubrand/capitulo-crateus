// Dados de exemplo usados no MODO DEMONSTRAÇÃO (baseados nas artes do projeto).

const MEMBROS = [
  ['Arthur Lima', 'Mestre Conselheiro'],
  ['Bruno Sales', '1º Conselheiro'],
  ['Caio Ferreira', '2º Conselheiro'],
  ['Gabriel Sousa', 'Escrivão'],
  ['Rafael Monteiro', 'Tesoureiro'],
  ['Davi Rocha', 'Capelão'],
  ['Enzo Martins', 'Mestre de Cerimônias'],
  ['Felipe Araújo', '1º Diácono'],
  ['Heitor Alves', 'Sentinela'],
  ['Igor Bezerra', 'Membro'],
  ['João Pedro Melo', 'Membro'],
  ['Lucas Farias', 'Membro'],
  ['Mateus Cavalcante', 'Membro'],
  ['Natan Oliveira', 'Membro'],
  ['Pedro Henrique Costa', 'Membro'],
  ['Samuel Vieira', 'Membro'],
];

// Seniores DeMolay e consultores (fora do quórum)
const APOIO = [
  ['Thiago Nogueira', 'Sênior DeMolay', 'senior'],
  ['Vinícius Prado', 'Sênior DeMolay', 'senior'],
  ['Antônio Carlos Mendes', 'Presidente do Conselho Consultivo', 'consultor'],
  ['José Ribamar Lopes', 'Consultor do Capítulo', 'consultor'],
];
const HIST_APOIO = ['PFPPP', 'FFPFP', 'PPPPP', 'PFPFP'];

// Histórico de presença nas sessões 10/10, 17/10, 24/10, 31/10 e 07/11
const HIST = [
  'PPPPP', 'PPPPP', 'PPPPP', 'PPPPP', 'PPPPP', 'FPPPP', 'PPPFP', 'PFPPP',
  'PPPFP', 'FFPFF', 'PPPPP', 'PJPPJ', 'PFPPP', 'FFPFF', 'PPPPP', 'FPPPP',
];

// Meses em aberto (o resto de jul–nov está pago)
const ABERTO = {
  'Davi Rocha': ['2026-11'],
  'Igor Bezerra': ['2026-10', '2026-11'],
  'Lucas Farias': ['2026-11'],
  'Natan Oliveira': ['2026-09', '2026-10', '2026-11'],
  'Samuel Vieira': ['2026-11'],
};

export function gerarSeed() {
  const membros = MEMBROS.map(([nome, cargo], i) => ({
    id: i + 1, nome, cargo, categoria: 'demolay', ativo: true, ordem: i + 1,
  })).concat(APOIO.map(([nome, cargo, categoria], i) => ({
    id: MEMBROS.length + i + 1, nome, cargo, categoria, ativo: true, ordem: 100 + i,
  })));

  let eid = 0;
  const ev = (titulo, tipo, data, hora = '19:30', local = 'Templo Maçônico de Crateús', descricao = '') =>
    ({ id: ++eid, titulo, tipo, data, hora, local, descricao });

  const eventos = [
    ev('Sessão ordinária', 'sessao', '2026-10-10'),
    ev('Sessão ordinária', 'sessao', '2026-10-17'),
    ev('Cerimônia de Instalação', 'cerimonia', '2026-10-24', '19:00', 'Templo Maçônico de Crateús', 'Instalação da nova gestão 2026.2'),
    ev('Sessão ordinária', 'sessao', '2026-10-31'),
    ev('Sessão ordinária', 'sessao', '2026-11-07'),
    ev('Reunião de diretoria', 'reuniao', '2026-11-11', '20:00', 'Online (Google Meet)', 'Planejamento da campanha de Natal'),
    ev('Sessão ordinária', 'sessao', '2026-11-14'),
    ev('Sessão ordinária', 'sessao', '2026-11-21'),
    ev('Campanha do Agasalho', 'evento', '2026-11-22', '08:00', 'Praça da Matriz', 'Arrecadação de roupas e alimentos'),
    ev('Sessão ordinária', 'sessao', '2026-11-28'),
    ev('Sessão ordinária', 'sessao', '2026-12-05'),
    ev('Confraternização de fim de ano', 'evento', '2026-12-12', '18:00', 'Sede social', ''),
  ];

  const sessoesHist = [1, 2, 3, 4, 5]; // ids dos eventos com chamada
  const presencas = [];
  HIST.forEach((h, mi) => {
    [...h].forEach((st, si) => presencas.push({ evento_id: sessoesHist[si], membro_id: mi + 1, status: st }));
  });
  HIST_APOIO.forEach((h, i) => {
    [...h].forEach((st, si) => presencas.push({ evento_id: sessoesHist[si], membro_id: MEMBROS.length + i + 1, status: st }));
  });

  let lid = 0;
  const l = (data, descricao, categoria, tipo, valor) =>
    ({ id: ++lid, data, descricao, categoria, tipo, valor, criado_por: 'Rafael Monteiro', created_at: data + 'T12:00:00Z' });
  const lancamentos = [
    l('2026-07-01', 'Saldo anterior (gestão 2026.1)', 'Saldo inicial', 'entrada', 820),
    l('2026-07-08', 'Mensalidades de julho (16 membros)', 'Mensalidades', 'entrada', 320),
    l('2026-07-20', 'Material de secretaria', 'Materiais', 'saida', 95),
    l('2026-08-08', 'Mensalidades de agosto (16 membros)', 'Mensalidades', 'entrada', 320),
    l('2026-08-16', 'Lanche — sessão magna', 'Eventos', 'saida', 180),
    l('2026-08-30', 'Taxa anual do Supremo Conselho', 'Taxas', 'saida', 260),
    l('2026-09-08', 'Mensalidades de setembro (15 membros)', 'Mensalidades', 'entrada', 300),
    l('2026-09-21', 'Faixas para a cerimônia de iniciação', 'Materiais', 'saida', 84),
    l('2026-10-02', 'Impressão de certificados', 'Materiais', 'saida', 45),
    l('2026-10-08', 'Mensalidades de outubro (14 membros)', 'Mensalidades', 'entrada', 280),
    l('2026-10-20', 'Taxa de regularização de membros', 'Taxas', 'saida', 120),
    l('2026-10-22', 'Doação — Loja patrocinadora', 'Doações', 'entrada', 300),
    l('2026-10-24', 'Coffee break — Cerimônia de Instalação', 'Eventos', 'saida', 215),
    l('2026-10-31', 'Rifa beneficente — Dia das Crianças', 'Eventos', 'entrada', 350),
    l('2026-11-05', 'Velas e material ritualístico', 'Materiais', 'saida', 68.5),
    l('2026-11-06', 'Mensalidades de novembro (11 membros)', 'Mensalidades', 'entrada', 220),
  ];

  const mensalidades = [];
  membros.filter((m) => m.categoria === 'demolay').forEach((m) => {
    ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].forEach((c) => {
      if ((ABERTO[m.nome] || []).includes(c)) return;
      mensalidades.push({ membro_id: m.id, competencia: c, valor: 20, pago_em: c + '-08', lancamento_id: null });
    });
  });

  return {
    membros, eventos, presencas, lancamentos, mensalidades,
    config: [{ chave: 'valor_mensalidade', valor: '20' }],
  };
}
