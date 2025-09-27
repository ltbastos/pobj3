/* =========================================================
   Omega • Central de chamados para o POBJ
   ========================================================= */
let omegaTemplatePromise = null;
let omegaInitialized = false;

const OMEGA_ROLE_LABELS = {
  usuario: "Usuário",
  atendente: "Atendente",
  supervisor: "Supervisor",
  admin: "Administrador",
};

const OMEGA_ROLE_PERMISSIONS = {
  usuario: [
    "Abrir chamados para a própria carteira",
    "Visualizar andamento das solicitações criadas",
    "Receber alertas quando um atendente atualizar o chamado",
  ],
  atendente: [
    "Executar tudo que um usuário pode fazer",
    "Assumir chamados da fila da equipe",
    "Registrar interações e anexar comentários internos",
    "Sinalizar chamados críticos para supervisão",
  ],
  supervisor: [
    "Executar tudo que um atendente pode fazer",
    "Redistribuir chamados entre atendentes",
    "Definir prioridades e prazos por fila",
    "Atribuir perfis de atendente para novos usuários",
  ],
  admin: [
    "Executar tudo que um supervisor pode fazer",
    "Criar filas e equipes Omega",
    "Gerenciar perfis e permissões avançadas",
    "Consultar logs e métricas de SLA",
  ],
};

const OMEGA_NAV_ITEMS = [
  { id: "my", label: "Meus chamados", icon: "ti ti-user", roles: ["usuario", "atendente", "supervisor", "admin"] },
  { id: "queue", label: "Fila da equipe", icon: "ti ti-inbox", roles: ["atendente", "supervisor", "admin"] },
  { id: "team", label: "Visão da supervisão", icon: "ti ti-users", roles: ["supervisor", "admin"] },
  { id: "admin", label: "Administração", icon: "ti ti-shield-lock", roles: ["admin"] },
];

const OMEGA_STATUS_ORDER = ["todos", "aberto", "aguardando", "em_atendimento", "resolvido", "cancelado"];

const OMEGA_STATUS_META = {
  aberto: { label: "Aberto", tone: "neutral" },
  aguardando: { label: "Aguardando", tone: "warning" },
  em_atendimento: { label: "Em atendimento", tone: "progress" },
  resolvido: { label: "Resolvido", tone: "success" },
  cancelado: { label: "Cancelado", tone: "danger" },
};

const OMEGA_PRIORITY_META = {
  baixa: { label: "Baixa", tone: "neutral", icon: "ti ti-arrow-down" },
  media: { label: "Média", tone: "progress", icon: "ti ti-arrows-up-down" },
  alta: { label: "Alta", tone: "warning", icon: "ti ti-arrow-up" },
  critica: { label: "Crítica", tone: "danger", icon: "ti ti-alert-octagon" },
};

const OMEGA_PRIORITY_OPTIONS = [
  { id: "baixa", label: "Baixa" },
  { id: "media", label: "Média" },
  { id: "alta", label: "Alta" },
  { id: "critica", label: "Crítica" },
];

const OMEGA_QUEUE_OPTIONS = [
  "POBJ Produções",
  "POBJ Norte",
  "Sprint PJ",
  "Mesa Corporate",
];

const OMEGA_TICKET_CATEGORIES = [
  "Análise de elegibilidade",
  "Cadastro e manutenção",
  "Ajuste de meta",
  "Contestação de pontuação",
  "Suporte técnico",
  "Integração com sistemas",
];

const OMEGA_LEVEL_LABELS = {
  diretoria: "Diretoria",
  gerencia: "Regional",
  agencia: "Agência",
  ggestao: "Gerente de gestão",
  gerente: "Gerente",
  secao: "Seção",
  familia: "Família",
  prodsub: "Indicador",
  contrato: "Contrato",
};

const OMEGA_USERS = [
  { id: "usr-01", name: "Juliana Nogueira", role: "usuario", avatar: "https://i.pravatar.cc/160?img=47", queue: null, teamId: "sudeste" },
  { id: "usr-02", name: "Thiago Azevedo", role: "atendente", avatar: "https://i.pravatar.cc/160?img=12", queue: "POBJ Produções", teamId: "sudeste" },
  { id: "usr-03", name: "Sofia Martins", role: "supervisor", avatar: "https://i.pravatar.cc/160?img=32", queue: "POBJ Produções", teamId: "sudeste" },
  { id: "usr-04", name: "Carlos Lima", role: "admin", avatar: "https://i.pravatar.cc/160?img=8", queue: null, teamId: null },
  { id: "usr-05", name: "Larissa Galvão", role: "atendente", avatar: "https://i.pravatar.cc/160?img=21", queue: "POBJ Norte", teamId: "norte" },
  { id: "usr-06", name: "Gabriel Figueiredo", role: "usuario", avatar: "https://i.pravatar.cc/160?img=36", queue: null, teamId: "norte" },
  { id: "usr-07", name: "Renata Campos", role: "usuario", avatar: "https://i.pravatar.cc/160?img=55", queue: null, teamId: "sudeste" },
];

const OMEGA_PRODUCT_CATALOG = [
  { id: "capital_giro_flex", label: "Capital de Giro Flex", family: "Crédito PJ", section: "Crédito" },
  { id: "maquininha_plus", label: "Maquininha Plus", family: "Meios de pagamento", section: "Recebíveis" },
  { id: "plataforma_pix", label: "Plataforma PIX Empresas", family: "Pagamentos digitais", section: "Recebíveis" },
  { id: "cobranca_digital", label: "Cobrança Digital PJ", family: "Recebíveis", section: "Recebíveis" },
  { id: "seguros_empresariais", label: "Seguros Empresariais", family: "Seguros e proteção", section: "Seguros" },
  { id: "consorcio_imobiliario", label: "Consórcio Imobiliário PJ", family: "Investimentos", section: "Patrimônio" },
  { id: "gestao_folha", label: "Gestão de Folha PJ", family: "Serviços financeiros", section: "Serviços" },
  { id: "credito_agro", label: "Crédito Agro Clima", family: "Crédito PJ", section: "Crédito" },
  { id: "antecipacao_recebiveis", label: "Antecipação de Recebíveis PJ", family: "Recebíveis", section: "Recebíveis" },
];

const omegaState = {
  currentUserId: OMEGA_USERS[1]?.id || OMEGA_USERS[0]?.id || null,
  view: "my",
  status: "todos",
  search: "",
  contextDetail: null,
  selectedTicketId: null,
  drawerOpen: false,
};

let OMEGA_TICKETS = [
  {
    id: "OME-2025-0048",
    subject: "Atualizar limite de Capital de Giro",
    company: "Café Encantado Ltda",
    productId: "capital_giro_flex",
    product: "Capital de Giro Flex",
    family: "Crédito PJ",
    section: "Crédito",
    queue: "POBJ Produções",
    status: "em_atendimento",
    category: "Ajuste de meta",
    priority: "alta",
    opened: "2025-03-01T09:20:00",
    updated: "2025-03-05T14:45:00",
    requesterId: "usr-01",
    ownerId: "usr-02",
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Sudeste",
      gerencia: "Regional Campinas",
      gerente: "Ana Paula Prado",
      familia: "Crédito PJ",
      secao: "Crédito",
      prodsub: "Capital de Giro Flex",
    },
    history: [
      {
        date: "2025-03-05T14:45:00",
        actorId: "usr-02",
        action: "Contato com gerente PJ",
        comment: "Solicitou última DRE e anexou documentação no chamado.",
        status: "em_atendimento",
      },
      {
        date: "2025-03-02T11:05:00",
        actorId: "usr-02",
        action: "Análise inicial",
        comment: "Validou elegibilidade e encaminhou proposta à mesa de crédito.",
        status: "aguardando",
      },
      {
        date: "2025-03-01T09:20:00",
        actorId: "usr-01",
        action: "Abertura do chamado",
        comment: "Gerente reportou necessidade de ampliar limite para rodada de capital de giro.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0049",
    subject: "Solicitar kit adicional da Maquininha Plus",
    company: "Mercado Estrela do Sul Ltda",
    productId: "maquininha_plus",
    product: "Maquininha Plus",
    family: "Meios de pagamento",
    section: "Recebíveis",
    queue: "POBJ Produções",
    status: "aguardando",
    category: "Suporte técnico",
    priority: "media",
    opened: "2025-02-27T16:18:00",
    updated: "2025-03-04T10:12:00",
    requesterId: "usr-07",
    ownerId: "usr-02",
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Sudeste",
      gerencia: "Regional São Paulo",
      gerente: "Bruno Mesquita",
      familia: "Meios de pagamento",
      secao: "Recebíveis",
      prodsub: "Maquininha Plus",
    },
    history: [
      {
        date: "2025-03-04T10:12:00",
        actorId: "usr-02",
        action: "Aguardando retorno do parceiro",
        comment: "Solicitação enviada à fornecedora, previsão de entrega em 3 dias úteis.",
        status: "aguardando",
      },
      {
        date: "2025-02-27T16:18:00",
        actorId: "usr-07",
        action: "Abertura do chamado",
        comment: "Cliente pediu dois terminais extras para nova filial.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0050",
    subject: "Erro de integração com PIX Empresas",
    company: "Tech Valley Solutions",
    productId: "plataforma_pix",
    product: "Plataforma PIX Empresas",
    family: "Pagamentos digitais",
    section: "Recebíveis",
    queue: "Sprint PJ",
    status: "resolvido",
    category: "Integração com sistemas",
    priority: "alta",
    opened: "2025-02-18T08:40:00",
    updated: "2025-02-25T17:35:00",
    requesterId: "usr-02",
    ownerId: "usr-02",
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Sudeste",
      gerencia: "Regional Campinas",
      gerente: "Ana Paula Prado",
      familia: "Pagamentos digitais",
      secao: "Recebíveis",
      prodsub: "Plataforma PIX Empresas",
    },
    history: [
      {
        date: "2025-02-25T17:35:00",
        actorId: "usr-02",
        action: "Encerramento",
        comment: "Integração estabilizada após ajuste de webhook. Cliente homologou o fluxo.",
        status: "resolvido",
      },
      {
        date: "2025-02-23T15:28:00",
        actorId: "usr-03",
        action: "Escalonamento para tecnologia",
        comment: "Chamado direcionado à equipe de APIs para análise profunda.",
        status: "em_atendimento",
      },
      {
        date: "2025-02-18T08:40:00",
        actorId: "usr-02",
        action: "Abertura do chamado",
        comment: "Cliente relata falhas intermitentes ao registrar cobranças via PIX.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0051",
    subject: "Incluir seguro empresarial na carteira",
    company: "Rede Hotel Prime",
    productId: "seguros_empresariais",
    product: "Seguros Empresariais",
    family: "Seguros e proteção",
    section: "Seguros",
    queue: "Mesa Corporate",
    status: "aberto",
    category: "Análise de elegibilidade",
    priority: "media",
    opened: "2025-03-06T11:12:00",
    updated: "2025-03-06T11:12:00",
    requesterId: "usr-03",
    ownerId: null,
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Centro",
      gerencia: "Regional Goiânia",
      gerente: "Patrícia Lemos",
      familia: "Seguros e proteção",
      secao: "Seguros",
      prodsub: "Seguros Empresariais",
    },
    history: [
      {
        date: "2025-03-06T11:12:00",
        actorId: "usr-03",
        action: "Abertura do chamado",
        comment: "Gerente solicita apoio para incluir seguro patrimonial na carteira PJ.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0052",
    subject: "Contestação de pontos Sprint PJ",
    company: "Transportes Amazônia Norte",
    productId: "antecipacao_recebiveis",
    product: "Antecipação de Recebíveis PJ",
    family: "Recebíveis",
    section: "Recebíveis",
    queue: "POBJ Norte",
    status: "em_atendimento",
    category: "Contestação de pontuação",
    priority: "critica",
    opened: "2025-03-03T13:05:00",
    updated: "2025-03-05T19:10:00",
    requesterId: "usr-06",
    ownerId: "usr-05",
    teamId: "norte",
    context: {
      diretoria: "Diretoria Norte",
      gerencia: "Regional Belém",
      gerente: "Camila Lopes",
      familia: "Recebíveis",
      secao: "Recebíveis",
      prodsub: "Antecipação de Recebíveis PJ",
    },
    history: [
      {
        date: "2025-03-05T19:10:00",
        actorId: "usr-05",
        action: "Contato com mesa Sprint",
        comment: "Repassou evidências ao comitê e aguarda revisão da pontuação.",
        status: "em_atendimento",
      },
      {
        date: "2025-03-04T08:30:00",
        actorId: "usr-05",
        action: "Validação inicial",
        comment: "Pontuação divergente confirmada com o gerente regional.",
        status: "aguardando",
      },
      {
        date: "2025-03-03T13:05:00",
        actorId: "usr-06",
        action: "Abertura do chamado",
        comment: "Empresa não recebeu pontos da antecipação homologada em fevereiro.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0053",
    subject: "Cancelar contrato duplicado",
    company: "AgroVale Distribuição",
    productId: "credito_agro",
    product: "Crédito Agro Clima",
    family: "Crédito PJ",
    section: "Crédito",
    queue: "POBJ Produções",
    status: "cancelado",
    category: "Cadastro e manutenção",
    priority: "media",
    opened: "2025-02-20T09:18:00",
    updated: "2025-02-28T17:45:00",
    requesterId: "usr-02",
    ownerId: "usr-02",
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Sudeste",
      gerencia: "Regional Ribeirão Preto",
      gerente: "Eduardo Matos",
      familia: "Crédito PJ",
      secao: "Crédito",
      prodsub: "Crédito Agro Clima",
    },
    history: [
      {
        date: "2025-02-28T17:45:00",
        actorId: "usr-02",
        action: "Cancelamento confirmado",
        comment: "Contrato duplicado removido a pedido do cliente. Nenhum impacto financeiro.",
        status: "cancelado",
      },
      {
        date: "2025-02-21T10:12:00",
        actorId: "usr-03",
        action: "Validação com jurídico",
        comment: "Equipe jurídica aprovou o cancelamento sem custos.",
        status: "em_atendimento",
      },
      {
        date: "2025-02-20T09:18:00",
        actorId: "usr-02",
        action: "Abertura do chamado",
        comment: "Detectado contrato Agro duplicado após importação do legado.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0054",
    subject: "Dúvida sobre meta acumulada",
    company: "Inova Logística Express",
    productId: "capital_giro_flex",
    product: "Capital de Giro Flex",
    family: "Crédito PJ",
    section: "Crédito",
    queue: "POBJ Produções",
    status: "aguardando",
    category: "Ajuste de meta",
    priority: "baixa",
    opened: "2025-03-04T15:42:00",
    updated: "2025-03-04T15:42:00",
    requesterId: "usr-01",
    ownerId: null,
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Sudeste",
      gerencia: "Regional Campinas",
      gerente: "Ana Paula Prado",
      familia: "Crédito PJ",
      secao: "Crédito",
      prodsub: "Capital de Giro Flex",
    },
    history: [
      {
        date: "2025-03-04T15:42:00",
        actorId: "usr-01",
        action: "Abertura do chamado",
        comment: "Solicita planilha da meta acumulada para validar projeções.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0055",
    subject: "Falha no dashboard da campanha",
    company: "Grupo Horizonte Financeiro",
    productId: "cobranca_digital",
    product: "Cobrança Digital PJ",
    family: "Recebíveis",
    section: "Recebíveis",
    queue: "Sprint PJ",
    status: "em_atendimento",
    category: "Suporte técnico",
    priority: "critica",
    opened: "2025-03-05T07:58:00",
    updated: "2025-03-06T09:25:00",
    requesterId: "usr-03",
    ownerId: "usr-02",
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Centro",
      gerencia: "Regional Goiânia",
      gerente: "Patrícia Lemos",
      familia: "Recebíveis",
      secao: "Recebíveis",
      prodsub: "Cobrança Digital PJ",
    },
    history: [
      {
        date: "2025-03-06T09:25:00",
        actorId: "usr-02",
        action: "Reprocesso agendado",
        comment: "Dados serão republicados até 12h. Cliente informado por telefone.",
        status: "em_atendimento",
      },
      {
        date: "2025-03-05T08:22:00",
        actorId: "usr-03",
        action: "Escalonamento crítico",
        comment: "Dashboard apresenta valores zerados para toda a carteira.",
        status: "aguardando",
      },
      {
        date: "2025-03-05T07:58:00",
        actorId: "usr-03",
        action: "Abertura do chamado",
        comment: "Supervisora detectou inconsistência na visão executiva.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0056",
    subject: "Treinamento gestão de folha",
    company: "Hospital Vida Plena",
    productId: "gestao_folha",
    product: "Gestão de Folha PJ",
    family: "Serviços financeiros",
    section: "Serviços",
    queue: "POBJ Norte",
    status: "resolvido",
    category: "Suporte técnico",
    priority: "media",
    opened: "2025-02-10T10:10:00",
    updated: "2025-02-14T17:45:00",
    requesterId: "usr-05",
    ownerId: "usr-05",
    teamId: "norte",
    context: {
      diretoria: "Diretoria Norte",
      gerencia: "Regional Belém",
      gerente: "Camila Lopes",
      familia: "Serviços financeiros",
      secao: "Serviços",
      prodsub: "Gestão de Folha PJ",
    },
    history: [
      {
        date: "2025-02-14T17:45:00",
        actorId: "usr-05",
        action: "Treinamento concluído",
        comment: "Sessão online realizada com equipe do hospital.",
        status: "resolvido",
      },
      {
        date: "2025-02-12T09:00:00",
        actorId: "usr-05",
        action: "Agenda confirmada",
        comment: "Treinamento agendado para 14/02 às 15h.",
        status: "em_atendimento",
      },
      {
        date: "2025-02-10T10:10:00",
        actorId: "usr-05",
        action: "Abertura do chamado",
        comment: "Hospital solicitou onboarding para novo módulo.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0057",
    subject: "Atualizar dados cadastrais",
    company: "Cooperativa Verdejar",
    productId: "capital_giro_flex",
    product: "Capital de Giro Flex",
    family: "Crédito PJ",
    section: "Crédito",
    queue: "POBJ Produções",
    status: "aberto",
    category: "Cadastro e manutenção",
    priority: "baixa",
    opened: "2025-03-07T09:32:00",
    updated: "2025-03-07T09:32:00",
    requesterId: "usr-01",
    ownerId: null,
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Sudeste",
      gerencia: "Regional Campinas",
      gerente: "Ana Paula Prado",
      familia: "Crédito PJ",
      secao: "Crédito",
      prodsub: "Capital de Giro Flex",
    },
    history: [
      {
        date: "2025-03-07T09:32:00",
        actorId: "usr-01",
        action: "Abertura do chamado",
        comment: "Solicita atualização de CNAE no cadastro do cliente.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0058",
    subject: "Acompanhar aprovação de consórcio",
    company: "Construtora Horizonte Azul",
    productId: "consorcio_imobiliario",
    product: "Consórcio Imobiliário PJ",
    family: "Investimentos",
    section: "Patrimônio",
    queue: "Mesa Corporate",
    status: "aguardando",
    category: "Análise de elegibilidade",
    priority: "alta",
    opened: "2025-02-28T12:05:00",
    updated: "2025-03-03T18:32:00",
    requesterId: "usr-03",
    ownerId: "usr-03",
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Centro",
      gerencia: "Regional Goiânia",
      gerente: "Patrícia Lemos",
      familia: "Investimentos",
      secao: "Patrimônio",
      prodsub: "Consórcio Imobiliário PJ",
    },
    history: [
      {
        date: "2025-03-03T18:32:00",
        actorId: "usr-03",
        action: "Aguardando resposta da administradora",
        comment: "Processo enviado para análise de crédito da parceira.",
        status: "aguardando",
      },
      {
        date: "2025-02-28T12:05:00",
        actorId: "usr-03",
        action: "Abertura do chamado",
        comment: "Cliente solicitou acompanhamento de consórcio imobiliário de alto valor.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0059",
    subject: "Resgatar histórico de cobranças",
    company: "Serviços Contábeis Norte",
    productId: "cobranca_digital",
    product: "Cobrança Digital PJ",
    family: "Recebíveis",
    section: "Recebíveis",
    queue: "POBJ Norte",
    status: "em_atendimento",
    category: "Suporte técnico",
    priority: "media",
    opened: "2025-03-01T08:18:00",
    updated: "2025-03-05T10:04:00",
    requesterId: "usr-06",
    ownerId: "usr-05",
    teamId: "norte",
    context: {
      diretoria: "Diretoria Norte",
      gerencia: "Regional Belém",
      gerente: "Camila Lopes",
      familia: "Recebíveis",
      secao: "Recebíveis",
      prodsub: "Cobrança Digital PJ",
    },
    history: [
      {
        date: "2025-03-05T10:04:00",
        actorId: "usr-05",
        action: "Processo de restauração",
        comment: "Exportação iniciada. Arquivo será entregue via S3.",
        status: "em_atendimento",
      },
      {
        date: "2025-03-02T09:12:00",
        actorId: "usr-05",
        action: "Contato com TI",
        comment: "Acionada equipe de dados para restaurar histórico de cobranças.",
        status: "aguardando",
      },
      {
        date: "2025-03-01T08:18:00",
        actorId: "usr-06",
        action: "Abertura do chamado",
        comment: "Cliente precisa do histórico completo de cobranças para auditoria.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0060",
    subject: "Divergência no repasse da Maquininha",
    company: "Empório do Campo",
    productId: "maquininha_plus",
    product: "Maquininha Plus",
    family: "Meios de pagamento",
    section: "Recebíveis",
    queue: "POBJ Produções",
    status: "resolvido",
    category: "Contestação de pontuação",
    priority: "media",
    opened: "2025-02-05T11:30:00",
    updated: "2025-02-09T16:10:00",
    requesterId: "usr-07",
    ownerId: "usr-02",
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Sudeste",
      gerencia: "Regional São Paulo",
      gerente: "Bruno Mesquita",
      familia: "Meios de pagamento",
      secao: "Recebíveis",
      prodsub: "Maquininha Plus",
    },
    history: [
      {
        date: "2025-02-09T16:10:00",
        actorId: "usr-02",
        action: "Repasse confirmado",
        comment: "Crédito reprocessado e ajustes registrados no extrato.",
        status: "resolvido",
      },
      {
        date: "2025-02-07T13:45:00",
        actorId: "usr-02",
        action: "Validação de comprovantes",
        comment: "Cliente enviou comprovantes de vendas. Divergência confirmada.",
        status: "em_atendimento",
      },
      {
        date: "2025-02-05T11:30:00",
        actorId: "usr-07",
        action: "Abertura do chamado",
        comment: "Repasse creditado abaixo do esperado para as vendas da semana.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0061",
    subject: "Integração PIX com ERP interno",
    company: "Metalúrgica Horizonte",
    productId: "plataforma_pix",
    product: "Plataforma PIX Empresas",
    family: "Pagamentos digitais",
    section: "Recebíveis",
    queue: "Sprint PJ",
    status: "aguardando",
    category: "Integração com sistemas",
    priority: "alta",
    opened: "2025-03-02T14:22:00",
    updated: "2025-03-06T08:55:00",
    requesterId: "usr-03",
    ownerId: "usr-02",
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Centro",
      gerencia: "Regional Goiânia",
      gerente: "Patrícia Lemos",
      familia: "Pagamentos digitais",
      secao: "Recebíveis",
      prodsub: "Plataforma PIX Empresas",
    },
    history: [
      {
        date: "2025-03-06T08:55:00",
        actorId: "usr-02",
        action: "Aguardando homologação",
        comment: "Cliente testará novo certificado até 08/03.",
        status: "aguardando",
      },
      {
        date: "2025-03-02T14:22:00",
        actorId: "usr-03",
        action: "Abertura do chamado",
        comment: "Integração apresentou erro ao autenticar via certificado A3.",
        status: "aberto",
      },
    ],
  },
  {
    id: "OME-2025-0062",
    subject: "Priorizar renegociação PJ",
    company: "Rede Atacadista Unidos",
    productId: "capital_giro_flex",
    product: "Capital de Giro Flex",
    family: "Crédito PJ",
    section: "Crédito",
    queue: "Mesa Corporate",
    status: "em_atendimento",
    category: "Ajuste de meta",
    priority: "critica",
    opened: "2025-03-05T18:40:00",
    updated: "2025-03-06T12:18:00",
    requesterId: "usr-03",
    ownerId: "usr-03",
    teamId: "sudeste",
    context: {
      diretoria: "Diretoria Centro",
      gerencia: "Regional Goiânia",
      gerente: "Patrícia Lemos",
      familia: "Crédito PJ",
      secao: "Crédito",
      prodsub: "Capital de Giro Flex",
    },
    history: [
      {
        date: "2025-03-06T12:18:00",
        actorId: "usr-03",
        action: "Negociação em andamento",
        comment: "Mesa retornou com proposta revisada. Aguardando aceite do cliente.",
        status: "em_atendimento",
      },
      {
        date: "2025-03-05T18:40:00",
        actorId: "usr-03",
        action: "Abertura do chamado",
        comment: "Cliente solicitou renegociação urgente antes do fechamento do trimestre.",
        status: "aberto",
      },
    ],
  },
];
let omegaTicketCounter = OMEGA_TICKETS.reduce((max, ticket) => {
  const seq = parseInt(String(ticket.id || "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(seq) ? Math.max(max, seq) : max;
}, 0);

function ensureOmegaTemplate(){
  const existing = document.getElementById("omega-modal");
  if (existing) return Promise.resolve(existing);
  if (omegaTemplatePromise) return omegaTemplatePromise;

  omegaTemplatePromise = fetch("omega.html")
    .then((res) => {
      if (!res.ok) throw new Error(`Falha ao carregar omega.html: ${res.status}`);
      return res.text();
    })
    .then((html) => {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html.trim();
      const fragment = document.createDocumentFragment();
      while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
      document.body.appendChild(fragment);
      return document.getElementById("omega-modal");
    })
    .catch((err) => {
      console.error("Não foi possível carregar o template da Omega:", err);
      omegaTemplatePromise = null;
      throw err;
    });

  return omegaTemplatePromise;
}

function openOmega(detail = null){
  ensureOmegaTemplate()
    .then((root) => {
      if (!root) return;
      setupOmegaModule(root);
      omegaState.contextDetail = detail || null;
      omegaState.search = "";
      omegaState.status = "todos";
      omegaState.selectedTicketId = null;
      enforceViewForRole();
      root.hidden = false;
      document.body.classList.add("has-omega-open");
      renderOmega();
      const searchInput = root.querySelector("#omega-search");
      if (searchInput) {
        requestAnimationFrame(() => {
          try { searchInput.focus(); } catch (err) { /* ignore focus errors */ }
        });
      }
    })
    .catch(() => {
      /* erro já registrado em ensureOmegaTemplate */
    });
}

function closeOmega(){
  const root = document.getElementById("omega-modal");
  if (!root) return;
  setDrawerOpen(false);
  root.hidden = true;
  document.body.classList.remove("has-omega-open");
}

function setupOmegaModule(root){
  if (omegaInitialized) return;

  root.querySelectorAll('[data-omega-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeOmega());
  });
  const overlay = root.querySelector('.omega-modal__overlay');
  overlay?.addEventListener('click', () => closeOmega());

  root.querySelectorAll('[data-omega-drawer-close]').forEach((btn) => {
    btn.addEventListener('click', () => setDrawerOpen(false));
  });

  const resetBtn = root.querySelector('#omega-reset-filters');
  resetBtn?.addEventListener('click', () => {
    omegaState.search = "";
    omegaState.status = "todos";
    renderOmega();
  });

  const searchInput = root.querySelector('#omega-search');
  searchInput?.addEventListener('input', (ev) => {
    omegaState.search = ev.target.value || "";
    renderOmega();
  });

  const statusHost = root.querySelector('#omega-status');
  statusHost?.addEventListener('click', (ev) => {
    const btn = ev.target.closest?.('.omega-status__btn');
    if (!btn) return;
    const status = btn.dataset.status;
    if (!status) return;
    omegaState.status = status;
    renderOmega();
  });

  const navHost = root.querySelector('#omega-nav');
  navHost?.addEventListener('click', (ev) => {
    const item = ev.target.closest?.('.omega-nav__item');
    if (!item) return;
    const view = item.dataset.view;
    if (!view || omegaState.view === view) return;
    omegaState.view = view;
    omegaState.selectedTicketId = null;
    renderOmega();
  });

  const tableBody = root.querySelector('#omega-ticket-rows');
  tableBody?.addEventListener('click', (ev) => {
    const row = ev.target.closest?.('tr[data-ticket-id]');
    if (!row) return;
    const ticketId = row.dataset.ticketId;
    if (!ticketId) return;
    omegaState.selectedTicketId = ticketId;
    renderOmega();
  });

  const newTicketBtn = root.querySelector('#omega-new-ticket');
  newTicketBtn?.addEventListener('click', () => setDrawerOpen(true));

  const form = root.querySelector('#omega-form');
  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    handleNewTicketSubmit(form);
  });

  const userSelect = root.querySelector('#omega-user-select');
  userSelect?.addEventListener('change', (ev) => {
    const nextId = ev.target.value || null;
    if (!nextId) return;
    if (nextId === omegaState.currentUserId) return;
    omegaState.currentUserId = nextId;
    enforceViewForRole();
    omegaState.selectedTicketId = null;
    renderOmega();
  });

  populateUserSelect(root);
  populateFormOptions(root);

  document.addEventListener('keydown', handleOmegaKeydown);

  omegaInitialized = true;
}

function handleOmegaKeydown(ev){
  const root = document.getElementById('omega-modal');
  if (!root || root.hidden) return;
  if (ev.key === 'Escape') {
    if (omegaState.drawerOpen) {
      setDrawerOpen(false);
      ev.stopPropagation();
    } else {
      closeOmega();
      ev.stopPropagation();
    }
  }
}

function renderOmega(){
  const root = document.getElementById('omega-modal');
  if (!root || root.hidden) return;
  const user = getCurrentUser();
  const contextTickets = filterTicketsByContext();
  const viewTicketsBase = filterTicketsByView(contextTickets, user);
  const filteredTickets = applyStatusAndSearch(viewTicketsBase);

  renderProfile(root, user);
  renderPermissions(root, user);
  renderNav(root, user);
  renderContextBar(root, omegaState.contextDetail, contextTickets);
  renderStatusChips(root, viewTicketsBase);
  renderSummary(root, contextTickets, filteredTickets, user);
  renderTable(root, filteredTickets);
  renderDetail(root, filteredTickets, viewTicketsBase, user);
  updateEmptyState(root, filteredTickets);
}

function renderProfile(root, user){
  const avatar = root.querySelector('#omega-avatar');
  const nameLabel = root.querySelector('#omega-user-name');
  const roleLabel = root.querySelector('#omega-user-role');
  if (avatar && user?.avatar) avatar.src = user.avatar;
  if (nameLabel) nameLabel.textContent = user?.name || '—';
  if (roleLabel) roleLabel.textContent = OMEGA_ROLE_LABELS[user?.role] || '—';
  const select = root.querySelector('#omega-user-select');
  if (select && select.value !== user?.id) select.value = user?.id || '';
}

function renderPermissions(root, user){
  const list = root.querySelector('#omega-permissions-list');
  if (!list) return;
  const permissions = OMEGA_ROLE_PERMISSIONS[user?.role] || [];
  list.innerHTML = permissions.map((item) => `<li>${escapeHTML(item)}</li>`).join('');
}

function renderNav(root, user){
  const nav = root.querySelector('#omega-nav');
  if (!nav) return;
  const available = OMEGA_NAV_ITEMS.filter((item) => item.roles.includes(user?.role || 'usuario'));
  if (!available.some((item) => item.id === omegaState.view)) {
    omegaState.view = available[0]?.id || 'my';
  }
  nav.innerHTML = available.map((item) => {
    const activeClass = item.id === omegaState.view ? ' is-active' : '';
    return `<button type="button" class="omega-nav__item${activeClass}" data-view="${item.id}"><i class="${item.icon}"></i><span>${escapeHTML(item.label)}</span></button>`;
  }).join('');
}

function renderContextBar(root, detail, tickets){
  const host = root.querySelector('#omega-context');
  if (!host) return;
  if (!detail || (!detail.label && !(Array.isArray(detail.lineage) && detail.lineage.length))) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  const lineage = Array.isArray(detail.lineage) ? detail.lineage : [];
  const pieces = lineage.map((entry) => {
    const label = entry?.label || entry?.value;
    if (!label) return null;
    const prefix = OMEGA_LEVEL_LABELS[entry?.levelKey] || 'Nível';
    return `${prefix}: ${escapeHTML(label)}`;
  }).filter(Boolean);
  if (detail.label) {
    const prefix = OMEGA_LEVEL_LABELS[detail.levelKey] || 'Foco';
    const finalLabel = `${prefix}: ${escapeHTML(detail.label)}`;
    if (!pieces.includes(finalLabel)) pieces.push(finalLabel);
  }
  const countText = tickets.length === 1
    ? '1 chamado dentro do recorte'
    : `${tickets.length} chamados dentro do recorte`;
  host.innerHTML = `<i class="ti ti-filter"></i><div><strong>Recorte ativo</strong><p>${pieces.join(' • ')}</p><small>${escapeHTML(countText)}</small></div>`;
  host.hidden = false;
}

function renderStatusChips(root, tickets){
  const host = root.querySelector('#omega-status');
  if (!host) return;
  const counts = tickets.reduce((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1;
    return acc;
  }, {});
  const buttons = OMEGA_STATUS_ORDER.map((status) => {
    if (status === 'todos') {
      const total = tickets.length;
      const active = omegaState.status === 'todos';
      return `<button type="button" class="omega-status__btn" data-status="todos" data-active="${active}">Todos (${total})</button>`;
    }
    const meta = OMEGA_STATUS_META[status] || { label: status, tone: 'neutral' };
    const total = counts[status] || 0;
    const active = omegaState.status === status;
    return `<button type="button" class="omega-status__btn" data-status="${status}" data-active="${active}">${escapeHTML(meta.label)} (${total})</button>`;
  }).join('');
  host.innerHTML = buttons;
}

function renderSummary(root, contextTickets, viewTickets, user){
  const host = root.querySelector('#omega-summary');
  if (!host) return;
  const total = viewTickets.length;
  const inProgress = viewTickets.filter((t) => t.status === 'em_atendimento').length;
  const awaiting = viewTickets.filter((t) => t.status === 'aguardando').length;
  const critical = viewTickets.filter((t) => t.priority === 'critica' && t.status !== 'resolvido').length;
  const parts = [
    `<div class="omega-summary__item"><strong>${total}</strong><span>Chamados na visão</span></div>`,
    `<div class="omega-summary__item"><strong>${inProgress}</strong><span>Em atendimento</span></div>`,
    `<div class="omega-summary__item"><strong>${awaiting}</strong><span>Aguardando resposta</span></div>`,
    `<div class="omega-summary__item"><strong>${critical}</strong><span>Críticos</span></div>`,
  ];
  host.innerHTML = parts.join('');
}

function renderTable(root, tickets){
  const body = root.querySelector('#omega-ticket-rows');
  if (!body) return;
  if (!tickets.length) {
    body.innerHTML = '';
    return;
  }
  if (!tickets.some((ticket) => ticket.id === omegaState.selectedTicketId)) {
    omegaState.selectedTicketId = tickets[0]?.id || null;
  }
  const rows = tickets.map((ticket) => {
    const meta = OMEGA_STATUS_META[ticket.status] || { label: ticket.status, tone: 'neutral' };
    const requesterName = resolveUserName(ticket.requesterId);
    const ownerName = resolveUserName(ticket.ownerId);
    const priorityMeta = OMEGA_PRIORITY_META[ticket.priority] || OMEGA_PRIORITY_META.media;
    const activeClass = ticket.id === omegaState.selectedTicketId ? ' class="is-active"' : '';
    return `<tr data-ticket-id="${ticket.id}"${activeClass}>
      <td>
        <div class="omega-ticket__title">${escapeHTML(ticket.subject)}</div>
        <div class="omega-ticket__meta"><span><i class="ti ti-ticket"></i>${escapeHTML(ticket.id)}</span><span><i class="ti ${priorityMeta.icon}"></i>${escapeHTML(priorityMeta.label)}</span></div>
      </td>
      <td>
        <div class="omega-ticket__company">${escapeHTML(ticket.company)}</div>
        <div class="omega-ticket__meta"><span><i class="ti ti-user"></i>${escapeHTML(requesterName)}</span><span><i class="ti ti-user-check"></i>${escapeHTML(ownerName)}</span></div>
      </td>
      <td>${escapeHTML(ticket.product)}</td>
      <td>${escapeHTML(ticket.queue || '—')}</td>
      <td>${formatDateTime(ticket.opened)}</td>
      <td>${formatDateTime(ticket.updated, { withTime: false })}</td>
      <td><span class="omega-status-badge" data-tone="${meta.tone}">${escapeHTML(meta.label)}</span></td>
    </tr>`;
  }).join('');
  body.innerHTML = rows;
}

function renderDetail(root, tickets, baseTickets, user){
  const host = root.querySelector('#omega-detail');
  if (!host) return;
  if (!tickets.length) {
    if (baseTickets.length) {
      host.innerHTML = `<div class="omega-detail__empty"><i class="ti ti-info-circle"></i><span>Ajuste os filtros para visualizar os chamados desta visão.</span></div>`;
    } else {
      host.innerHTML = `<div class="omega-detail__empty"><i class="ti ti-ticket"></i><span>Nenhum chamado disponível para o recorte atual.</span></div>`;
    }
    return;
  }
  const ticket = tickets.find((item) => item.id === omegaState.selectedTicketId) || tickets[0];
  omegaState.selectedTicketId = ticket?.id || null;
  if (!ticket) {
    host.innerHTML = `<div class="omega-detail__empty"><i class="ti ti-ticket"></i><span>Selecione um chamado na lista ao lado.</span></div>`;
    return;
  }
  const statusMeta = OMEGA_STATUS_META[ticket.status] || { label: ticket.status, tone: 'neutral' };
  const requester = resolveUserName(ticket.requesterId);
  const owner = resolveUserName(ticket.ownerId) || 'Sem responsável';
  const priorityMeta = OMEGA_PRIORITY_META[ticket.priority] || OMEGA_PRIORITY_META.media;
  const timeline = Array.isArray(ticket.history) ? ticket.history : [];
  const timelineHtml = timeline.length
    ? timeline.map((entry) => {
        const actor = resolveUserName(entry.actorId);
        const label = OMEGA_STATUS_META[entry.status]?.label || entry.status;
        return `<li class="omega-timeline__item">
          <span class="omega-timeline__marker"></span>
          <div class="omega-timeline__body">
            <strong>${escapeHTML(actor)}</strong>
            <time datetime="${escapeHTML(entry.date)}">${formatDateTime(entry.date, { withTime: true })}</time>
            <p>${escapeHTML(entry.action)} — ${escapeHTML(label)}</p>
            ${entry.comment ? `<p>${escapeHTML(entry.comment)}</p>` : ''}
          </div>
        </li>`;
      }).join('')
    : '<li class="omega-timeline__item"><span class="omega-timeline__marker"></span><div class="omega-timeline__body"><p>Ainda não há histórico registrado.</p></div></li>';
  const contextChips = Object.entries(ticket.context || {})
    .filter(([, value]) => !!value)
    .map(([key, value]) => {
      const label = OMEGA_LEVEL_LABELS[key] || key;
      return `<span class="omega-tag">${escapeHTML(label)}: ${escapeHTML(value)}</span>`;
    }).join('');

  const canAssign = ['atendente', 'supervisor', 'admin'].includes(user.role);
  const canClose = ['supervisor', 'admin'].includes(user.role);
  const canComment = user.role !== 'usuario' || ticket.requesterId === user.id;

  const actions = [];
  if (canAssign) {
    actions.push({ id: 'assign', label: ticket.ownerId === user.id ? 'Acompanhar' : 'Assumir chamado', primary: ticket.ownerId !== user.id });
  }
  if (canComment) {
    actions.push({ id: 'progress', label: 'Registrar atualização', primary: true });
  }
  if (canClose) {
    actions.push({ id: ticket.status === 'resolvido' ? 'reopen' : 'close', label: ticket.status === 'resolvido' ? 'Reabrir chamado' : 'Encerrar chamado', primary: ticket.status !== 'resolvido' });
  }

  const actionsHtml = actions.length
    ? `<div class="omega-detail__actions">${actions.map((action) => `<button type="button" class="omega-btn${action.primary ? ' omega-btn--primary' : ''}" data-omega-action="${action.id}">${escapeHTML(action.label)}</button>`).join('')}</div>`
    : '';

  host.innerHTML = `
    <header class="omega-detail__head">
      <span class="omega-status-badge" data-tone="${statusMeta.tone}">${escapeHTML(statusMeta.label)}</span>
      <button type="button" class="omega-icon-btn" aria-label="Fechar Omega" data-omega-close><i class="ti ti-x"></i></button>
    </header>
    <div class="omega-detail__title">
      <h3>${escapeHTML(ticket.subject)}</h3>
      <p>${escapeHTML(ticket.company)} • ${escapeHTML(ticket.product)}</p>
    </div>
    <div class="omega-detail__meta">
      <span><i class="ti ti-user"></i>${escapeHTML(requester)}</span>
      <span><i class="ti ti-user-check"></i>${escapeHTML(owner)}</span>
      <span><i class="ti ti-flag-3"></i>${escapeHTML(priorityMeta.label)}</span>
      <span><i class="ti ti-clock-hour-5"></i>Atualizado ${formatDateTime(ticket.updated, { withTime: true })}</span>
      ${ticket.dueDate ? `<span><i class="ti ti-calendar-event"></i>Prazo ${formatDateTime(ticket.dueDate)}</span>` : ''}
      <span><i class="ti ti-building-bank"></i>${escapeHTML(ticket.queue || 'Sem fila')}</span>
    </div>
    <div class="omega-detail__tags">${contextChips}</div>
    <section>
      <h4 class="sr-only">Histórico</h4>
      <ol class="omega-timeline">${timelineHtml}</ol>
    </section>
    ${actionsHtml}
  `;

  host.querySelectorAll('[data-omega-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleDetailAction(btn.dataset.omegaAction, ticket, user));
  });
  host.querySelectorAll('[data-omega-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeOmega());
  });
}

function updateEmptyState(root, tickets){
  const wrapper = root.querySelector('#omega-table-wrapper');
  const empty = root.querySelector('#omega-empty');
  if (!wrapper || !empty) return;
  if (!tickets.length) {
    wrapper.hidden = true;
    empty.hidden = false;
  } else {
    wrapper.hidden = false;
    empty.hidden = true;
  }
}

function filterTicketsByContext(){
  if (!omegaState.contextDetail) return [...OMEGA_TICKETS];
  return OMEGA_TICKETS.filter((ticket) => ticketMatchesContext(ticket, omegaState.contextDetail));
}

function filterTicketsByView(tickets, user){
  const role = user?.role || 'usuario';
  if (role === 'admin') return [...tickets];
  if (omegaState.view === 'my') {
    return tickets.filter((ticket) => ticket.requesterId === user.id || ticket.ownerId === user.id);
  }
  if (omegaState.view === 'queue') {
    if (role === 'atendente') {
      return tickets.filter((ticket) => ticket.queue === user.queue || ticket.ownerId === user.id);
    }
    return tickets.filter((ticket) => ticket.queue === user.queue || ticket.teamId === user.teamId);
  }
  if (omegaState.view === 'team') {
    return tickets.filter((ticket) => ticket.teamId === user.teamId || ticket.ownerId === user.id);
  }
  return [...tickets];
}

function applyStatusAndSearch(tickets){
  let output = [...tickets];
  if (omegaState.status !== 'todos') {
    output = output.filter((ticket) => ticket.status === omegaState.status);
  }
  const term = normalizeText(omegaState.search);
  if (term) {
    output = output.filter((ticket) => matchesSearch(ticket, term));
  }
  output.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
  return output;
}

function matchesSearch(ticket, term){
  const values = [
    ticket.id,
    ticket.company,
    ticket.product,
    ticket.queue,
    ticket.subject,
    resolveUserName(ticket.requesterId),
    resolveUserName(ticket.ownerId),
  ];
  return values.some((value) => normalizeText(value).includes(term));
}

function enforceViewForRole(){
  const user = getCurrentUser();
  const available = OMEGA_NAV_ITEMS.filter((item) => item.roles.includes(user?.role || 'usuario'));
  if (!available.some((item) => item.id === omegaState.view)) {
    omegaState.view = available[0]?.id || 'my';
  }
}

function getCurrentUser(){
  return OMEGA_USERS.find((user) => user.id === omegaState.currentUserId) || OMEGA_USERS[0];
}

function resolveUserName(userId){
  if (!userId) return '—';
  const user = OMEGA_USERS.find((item) => item.id === userId);
  return user?.name || '—';
}

function ticketMatchesContext(ticket, detail){
  const tokens = gatherContextTokens(detail);
  if (!tokens.length) return true;
  const values = gatherTicketTokens(ticket);
  if (!values.length) return true;
  return tokens.some((token) => values.some((value) => value.includes(token)));
}

function gatherContextTokens(detail){
  const tokens = [];
  if (!detail) return tokens;
  if (detail.label) tokens.push(normalizeText(detail.label));
  if (Array.isArray(detail.trail)) {
    detail.trail.forEach((entry) => {
      if (entry) tokens.push(normalizeText(entry));
    });
  }
  if (Array.isArray(detail.lineage)) {
    detail.lineage.forEach((entry) => {
      if (entry?.label) tokens.push(normalizeText(entry.label));
      else if (entry?.value) tokens.push(normalizeText(entry.value));
    });
  }
  return tokens.filter(Boolean);
}

function gatherTicketTokens(ticket){
  const ctx = ticket.context || {};
  const values = [
    ticket.company,
    ticket.product,
    ticket.family,
    ticket.section,
    ticket.queue,
    ctx.diretoria,
    ctx.gerencia,
    ctx.gerente,
    ctx.familia,
    ctx.secao,
    ctx.prodsub,
  ];
  return values.map((value) => normalizeText(value)).filter(Boolean);
}

function normalizeText(value){
  return (value ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function escapeHTML(value){
  if (value == null) return '';
  return value.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value, { withTime = false } = {}){
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  if (withTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return new Intl.DateTimeFormat('pt-BR', options).format(date);
}

function setDrawerOpen(open){
  const root = document.getElementById('omega-modal');
  const drawer = root?.querySelector('#omega-drawer');
  if (!drawer) return;
  omegaState.drawerOpen = !!open;
  drawer.hidden = !open;
  if (open) {
    prefillTicketForm(root);
  } else {
    const form = root.querySelector('#omega-form');
    if (form) form.reset();
    clearFormFeedback(root);
  }
}

function populateUserSelect(root){
  const select = root.querySelector('#omega-user-select');
  if (!select || select.options.length) return;
  const order = { usuario: 0, atendente: 1, supervisor: 2, admin: 3 };
  const options = [...OMEGA_USERS].sort((a, b) => {
    const roleDiff = (order[a.role] ?? 10) - (order[b.role] ?? 10);
    if (roleDiff !== 0) return roleDiff;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  select.innerHTML = options.map((user) => `<option value="${user.id}">${escapeHTML(user.name)} — ${escapeHTML(OMEGA_ROLE_LABELS[user.role] || user.role)}</option>`).join('');
  select.value = omegaState.currentUserId || options[0]?.id || '';
}

function populateFormOptions(root){
  const productSelect = root.querySelector('#omega-form-product');
  const categorySelect = root.querySelector('#omega-form-category');
  const queueSelect = root.querySelector('#omega-form-queue');
  const prioritySelect = root.querySelector('#omega-form-priority');
  if (productSelect && !productSelect.options.length) {
    productSelect.innerHTML = OMEGA_PRODUCT_CATALOG.map((item) => `<option value="${item.id}">${escapeHTML(item.label)}</option>`).join('');
  }
  if (categorySelect && !categorySelect.options.length) {
    categorySelect.innerHTML = OMEGA_TICKET_CATEGORIES.map((item) => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join('');
  }
  if (queueSelect && !queueSelect.options.length) {
    queueSelect.innerHTML = OMEGA_QUEUE_OPTIONS.map((item) => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join('');
  }
  if (prioritySelect && !prioritySelect.options.length) {
    prioritySelect.innerHTML = OMEGA_PRIORITY_OPTIONS.map((item) => `<option value="${item.id}">${escapeHTML(item.label)}</option>`).join('');
  }
}

function prefillTicketForm(root){
  const form = root.querySelector('#omega-form');
  if (!form) return;
  const productSelect = form.querySelector('#omega-form-product');
  const queueSelect = form.querySelector('#omega-form-queue');
  const prioritySelect = form.querySelector('#omega-form-priority');
  const dueInput = form.querySelector('#omega-form-due');
  const companyInput = form.querySelector('#omega-form-company');
  const subjectInput = form.querySelector('#omega-form-subject');
  const contextList = form.querySelector('#omega-form-context');

  const detail = omegaState.contextDetail;
  const productMeta = detail?.levelKey === 'prodsub'
    ? OMEGA_PRODUCT_CATALOG.find((item) => normalizeText(item.label) === normalizeText(detail.label))
    : null;
  if (productSelect) {
    if (productMeta) productSelect.value = productMeta.id;
    else if (!productSelect.value) productSelect.selectedIndex = 0;
  }
  if (queueSelect) {
    const user = getCurrentUser();
    if (user?.queue && OMEGA_QUEUE_OPTIONS.includes(user.queue)) queueSelect.value = user.queue;
    else queueSelect.selectedIndex = 0;
  }
  if (prioritySelect) {
    prioritySelect.value = 'media';
  }
  if (dueInput) {
    const now = new Date();
    now.setDate(now.getDate() + 3);
    dueInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (companyInput) {
    companyInput.value = detail?.label && (detail.levelKey === 'contrato' || detail.levelKey === 'cliente') ? detail.label : '';
  }
  if (subjectInput) {
    const base = detail?.label ? `Atendimento ${detail.label}` : '';
    subjectInput.value = base;
  }
  if (contextList) {
    const user = getCurrentUser();
    const chips = [];
    if (detail?.label) chips.push(detail.label);
    if (Array.isArray(detail?.lineage)) {
      detail.lineage.forEach((entry) => {
        if (entry?.label) chips.push(entry.label);
      });
    }
    if (user?.queue) chips.push(`Fila ${user.queue}`);
    contextList.innerHTML = chips.map((chip) => `<li>${escapeHTML(chip)}</li>`).join('');
  }
  clearFormFeedback(root);
}

function handleNewTicketSubmit(form){
  const root = document.getElementById('omega-modal');
  if (!root) return;
  const company = form.querySelector('#omega-form-company')?.value?.trim();
  const productId = form.querySelector('#omega-form-product')?.value;
  const category = form.querySelector('#omega-form-category')?.value;
  const queue = form.querySelector('#omega-form-queue')?.value;
  const priority = form.querySelector('#omega-form-priority')?.value || 'media';
  const due = form.querySelector('#omega-form-due')?.value;
  const subject = form.querySelector('#omega-form-subject')?.value?.trim();
  const description = form.querySelector('#omega-form-description')?.value?.trim();
  if (!company || !productId || !category || !queue || !subject || !description) {
    showFormFeedback(root, 'Preencha todos os campos obrigatórios para registrar o chamado.', 'warning');
    return;
  }
  const productMeta = OMEGA_PRODUCT_CATALOG.find((item) => item.id === productId) || { label: productId, family: '', section: '' };
  const now = new Date();
  omegaTicketCounter += 1;
  const ticketId = `OME-${now.getFullYear()}-${String(omegaTicketCounter).padStart(4, '0')}`;
  const user = getCurrentUser();
  const detail = omegaState.contextDetail;
  const context = {
    diretoria: detail?.lineage?.find?.((entry) => entry.levelKey === 'diretoria')?.label || '',
    gerencia: detail?.lineage?.find?.((entry) => entry.levelKey === 'gerencia')?.label || '',
    gerente: detail?.lineage?.find?.((entry) => entry.levelKey === 'gerente')?.label || '',
    familia: productMeta.family,
    secao: productMeta.section,
    prodsub: productMeta.label,
  };
  const newTicket = {
    id: ticketId,
    subject,
    company,
    productId,
    product: productMeta.label,
    family: productMeta.family,
    section: productMeta.section,
    queue,
    status: 'aberto',
    category,
    priority,
    dueDate: due || null,
    opened: now.toISOString(),
    updated: now.toISOString(),
    requesterId: user.id,
    ownerId: ['atendente', 'supervisor', 'admin'].includes(user.role) ? user.id : null,
    teamId: user.teamId || null,
    context,
    history: [
      {
        date: now.toISOString(),
        actorId: user.id,
        action: 'Abertura do chamado',
        comment: description,
        status: 'aberto',
      },
    ],
  };
  OMEGA_TICKETS.unshift(newTicket);
  omegaState.selectedTicketId = newTicket.id;
  omegaState.view = 'my';
  omegaState.status = 'todos';
  omegaState.search = '';
  setDrawerOpen(false);
  renderOmega();
}

function showFormFeedback(root, message, tone = 'info'){
  const feedback = root.querySelector('#omega-form-feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.hidden = false;
  feedback.className = `omega-feedback omega-feedback--${tone}`;
}

function clearFormFeedback(root){
  const feedback = root.querySelector('#omega-form-feedback');
  if (!feedback) return;
  feedback.hidden = true;
  feedback.textContent = '';
  feedback.className = 'omega-feedback';
}

function handleDetailAction(action, ticket, user){
  if (!ticket) return;
  if (action === 'assign') {
    ticket.ownerId = user.id;
    appendTicketHistory(ticket, {
      actorId: user.id,
      action: 'Chamado assumido',
      comment: 'Responsável atualizado automaticamente.',
      status: 'em_atendimento',
    });
    ticket.status = 'em_atendimento';
  } else if (action === 'progress') {
    appendTicketHistory(ticket, {
      actorId: user.id,
      action: 'Atualização registrada',
      comment: 'Contato realizado com o cliente para avanço do caso.',
      status: 'em_atendimento',
    });
    ticket.status = ticket.status === 'resolvido' ? 'em_atendimento' : ticket.status;
  } else if (action === 'close') {
    ticket.status = 'resolvido';
    appendTicketHistory(ticket, {
      actorId: user.id,
      action: 'Chamado encerrado',
      comment: 'Solicitação concluída e validada com o solicitante.',
      status: 'resolvido',
    });
  } else if (action === 'reopen') {
    ticket.status = 'em_atendimento';
    appendTicketHistory(ticket, {
      actorId: user.id,
      action: 'Chamado reaberto',
      comment: 'Reaberto pela supervisão para nova análise.',
      status: 'em_atendimento',
    });
  }
  renderOmega();
}

function appendTicketHistory(ticket, entry){
  const now = new Date().toISOString();
  const historyEntry = {
    date: entry.date || now,
    actorId: entry.actorId,
    action: entry.action,
    comment: entry.comment,
    status: entry.status,
  };
  ticket.history = [historyEntry, ...(Array.isArray(ticket.history) ? ticket.history : [])];
  ticket.updated = historyEntry.date;
}

document.addEventListener('detail:open-ticket', (event) => {
  try {
    event.preventDefault();
  } catch (err) {
    /* ignore preventDefault failures */
  }
  openOmega(event.detail || null);
});

document.addEventListener('DOMContentLoaded', () => {
  const menuItem = document.querySelector('.userbox__menu-item[data-action="omega"]');
  if (menuItem && !menuItem.dataset.omegaBound) {
    menuItem.dataset.omegaBound = '1';
    menuItem.addEventListener('click', (ev) => {
      ev.preventDefault();
      openOmega();
    });
  }
});

window.openOmegaModule = openOmega;
