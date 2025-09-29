/* =========================================================
   Omega • Central de chamados para o POBJ
   ========================================================= */
let omegaTemplatePromise = null;
let omegaInitialized = false;

const OMEGA_ROLE_LABELS = {
  usuario: "Usuário",
  analista: "Analista",
  supervisor: "Supervisor",
  admin: "Administrador",
};

const OMEGA_NAV_ITEMS = [
  { id: "my", label: "Meus chamados", icon: "ti ti-user", roles: ["usuario", "analista", "supervisor", "admin"] },
  { id: "assigned", label: "Meus atendimentos", icon: "ti ti-clipboard-check", roles: ["analista", "supervisor", "admin"] },
  { id: "queue", label: "Fila da equipe", icon: "ti ti-inbox", roles: ["analista", "supervisor", "admin"] },
  {
    id: "team",
    label: "Visão da supervisão",
    icon: "ti ti-users",
    roles: ["supervisor", "admin"],
    children: [
      { id: "team-edit-analyst", label: "Editar analista", icon: "ti ti-user-cog" },
      { id: "team-edit-status", label: "Editar status", icon: "ti ti-adjustments-alt" },
    ],
  },
  { id: "admin", label: "Administração", icon: "ti ti-shield-lock", roles: ["admin"] },
];

const OMEGA_NAV_PARENT_MAP = {};
const OMEGA_NAV_LOOKUP = new Map();
OMEGA_NAV_ITEMS.forEach((item) => {
  OMEGA_NAV_LOOKUP.set(item.id, item);
  if (Array.isArray(item.children)) {
    item.children.forEach((child) => {
      OMEGA_NAV_PARENT_MAP[child.id] = item.id;
    });
  }
});

let OMEGA_STATUS_ORDER = ["todos"];
let OMEGA_STATUS_META = {};
const OMEGA_STATUS_SOURCE = "Bases/dStatus.csv";
let OMEGA_STATUS_CATALOG = [];
let omegaStatusPromise = null;

const OMEGA_PRIORITY_META = {
  baixa: { label: "Baixa", tone: "neutral", icon: "ti ti-arrow-down" },
  media: { label: "Média", tone: "progress", icon: "ti ti-arrows-up-down" },
  alta: { label: "Alta", tone: "warning", icon: "ti ti-arrow-up" },
  critica: { label: "Crítica", tone: "danger", icon: "ti ti-alert-octagon" },
};

const OMEGA_TOAST_ICONS = {
  success: "ti ti-check",
  info: "ti ti-info-circle",
  warning: "ti ti-alert-triangle",
  danger: "ti ti-alert-circle",
};

const OMEGA_STATUS_GLOBAL_DEPARTMENT = "0";

const OMEGA_DEFAULT_STATUSES = [
  { id: "aberto", label: "Aberto", tone: "neutral", departmentId: OMEGA_STATUS_GLOBAL_DEPARTMENT },
  { id: "aguardando", label: "Aguardando", tone: "warning", departmentId: OMEGA_STATUS_GLOBAL_DEPARTMENT },
  { id: "em_atendimento", label: "Em atendimento", tone: "progress", departmentId: OMEGA_STATUS_GLOBAL_DEPARTMENT },
  { id: "resolvido", label: "Resolvido", tone: "success", departmentId: OMEGA_STATUS_GLOBAL_DEPARTMENT },
  { id: "cancelado", label: "Cancelado", tone: "danger", departmentId: OMEGA_STATUS_GLOBAL_DEPARTMENT },
];

const OMEGA_STATUS_TONE_OPTIONS = ["neutral", "info", "progress", "success", "warning", "danger"];

const OMEGA_STATUS_TONE_LABELS = {
  neutral: "Neutro",
  info: "Informativo",
  progress: "Em andamento",
  success: "Sucesso",
  warning: "Alerta",
  danger: "Crítico",
};

const OMEGA_STRUCTURE_SOURCE = "Bases/dEstruturaChamados.csv";

const OMEGA_TRANSFER_EMPRESAS_LABEL = "Transferência - Empresas para Empresas";

const OMEGA_QUEUE_FIELD_MAP = {
  Encarteiramento: "encarteiramento",
  Metas: "meta",
  "Orçamento": "orcamento",
  POBJ: "pobj",
  Matriz: "matriz",
  Outros: "outros",
};

const OMEGA_FALLBACK_DEPARTMENT_IDS = {
  Encarteiramento: "1",
  Metas: "2",
  "Orçamento": "3",
  POBJ: "4",
  Matriz: "5",
  Outros: "6",
};

const OMEGA_DEPARTMENT_META = new Map();

const OMEGA_STRUCTURE_FALLBACK = {
  Encarteiramento: [
    OMEGA_TRANSFER_EMPRESAS_LABEL,
    "Transferência - Empresas para Varejo",
    "Transferência - Mesma Agência",
    "Transferência - Varejo para Empresas",
  ],
  Metas: [
    "Ajuste de meta",
    "Contestação de meta",
    "Acompanhamento de indicadores",
  ],
  "Orçamento": [
    "Revisão orçamentária",
    "Reserva de verba",
    "Redistribuição de verba",
  ],
  POBJ: [
    "Recuperação de Vencidos até 59 dias",
    "Recuperação de Vencidos acima 59 dias",
    "Recuperação de Crédito",
    "Captação Bruta (CDB, Isentos, Fundos, Corretora e Previdência)",
    "Captação Líquida (Todos os Produtos)",
    "Isentos",
    "Fundos",
    "Previdência Privada",
    "Portabilidade de Previdência Privada",
    "Corretora",
    "COE",
    "Depósito a Prazo",
    "InvestFácil",
    "Poupança",
    "Depósito à Vista",
    "Centralização de Caixa (Cash)",
    "Contas a Receber (vol)",
    "Contas a Pagar (vol)",
    "Centralização de Caixa PF (Qtd)",
    "Produção de Crédito PJ",
    "Produção de Crédito - Spread PF",
    "Produção de Crédito Total",
    "Limite Rotativo PF + PJ (Volume)",
    "Cheque Especial PF - volume",
    "Cheque Empresarial - volume",
    "Limite Rotativo PF + PJ (Qtd)",
    "Cheque Empresarial - qtd",
    "Cartões",
    "Consórcios",
    "Seguros",
    "Sucesso de Equipe Crédito",
    "Conquista Qualificada Gerenciado PF",
    "Conquista Qualificada Gerenciado PJ",
    "Conquista de Clientes Folha de Pagamento",
    "Abertura de Contas PF - Folha de Pagamento Privada",
    "Bradesco Expresso",
  ],
  Matriz: [
    "Relatório/Dashboard",
    "Bases",
    "Estudos",
    "Portal PJ",
  ],
  Outros: ["A construir"],
};

let OMEGA_TICKET_TYPES_BY_DEPARTMENT = Object.fromEntries(
  Object.entries(OMEGA_STRUCTURE_FALLBACK).map(([queue, items]) => [queue, [...items]])
);
let OMEGA_QUEUE_OPTIONS = Object.keys(OMEGA_TICKET_TYPES_BY_DEPARTMENT);
let omegaStructurePromise = null;
let omegaStructureReady = false;

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

const OMEGA_USERS_SOURCE = "Bases/omega_usuarios.csv";
const OMEGA_USER_METADATA = {
  "usr-01": { teamId: "pobj" },
  "usr-02": { teamId: "orcamento" },
  "usr-03": { teamId: "matriz" },
  "usr-04": { teamId: "matriz" },
  "usr-05": { teamId: "metas" },
  "usr-06": { teamId: "metas" },
  "usr-07": { teamId: "orcamento" },
  "usr-08": { teamId: "corporate" },
  "usr-09": { teamId: "corporate" },
  "usr-10": { teamId: "pobj" },
  "usr-11": { teamId: "orcamento" },
  "usr-12": { teamId: "matriz" },
  "usr-13": { teamId: "pobj" },
};

let OMEGA_USERS = [];

const OMEGA_EXTERNAL_CONTACTS = new Map();

const OMEGA_MESU_SOURCE = "Bases/mesu.csv";
let OMEGA_MESU_DATA = [];
let omegaMesuPromise = null;
const OMEGA_MESU_BY_AGENCY = new Map();
const OMEGA_MESU_BY_MANAGER = new Map();
const OMEGA_MESU_BY_GESTAO = new Map();

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
  currentUserId: null,
  view: "my",
  search: "",
  contextDetail: null,
  selectedTicketId: null,
  selectedTicketIds: new Set(),
  openNavParents: new Set(),
  drawerOpen: false,
  sidebarCollapsed: false,
  manageAnalystOpen: false,
  manageStatusOpen: false,
  manageAnalystId: null,
  manageStatus: {
    departmentId: "",
    statusId: "",
  },
  pendingNewTicket: null,
  prefillDepartment: "",
  ticketModalOpen: false,
  tablePage: 1,
  ticketsPerPage: 15,
  formAttachments: [],
  ticketUpdate: {
    comment: "",
    status: "",
    priority: "",
    queue: "",
    owner: "",
    category: "",
    due: "",
    attachments: [],
  },
  ticketUpdateTicketId: null,
  cancelDialogOpen: false,
  formFlow: {
    department: "",
    departmentValue: "",
    type: "",
    typeValue: "",
    targetManagerName: "",
    targetManagerEmail: "",
    requesterManagerName: "",
    requesterManagerEmail: "",
  },
  filters: {
    id: "",
    departments: [],
    type: "",
    requester: "",
    statuses: [],
    openedFrom: "",
    openedTo: "",
    priority: "",
  },
  filterPanelOpen: false,
  bulkPanelOpen: false,
  bulkStatus: "",
  notifications: [],
  notificationPanelOpen: false,
};

let OMEGA_TICKETS = [];
let omegaTicketCounter = 0;
let omegaDataPromise = null;
let omegaUsersPromise = null;
const OMEGA_TICKETS_SOURCE = "Bases/omega_chamados.csv";

let OMEGA_COMMENT_FACT = [];
let OMEGA_NOTIFICATION_FACT = [];
let OMEGA_COMMENT_COUNTER = 0;
let OMEGA_NOTIFICATION_COUNTER = 0;

function resetOmegaFacts(){
  OMEGA_COMMENT_FACT = [];
  OMEGA_NOTIFICATION_FACT = [];
  OMEGA_COMMENT_COUNTER = 0;
  OMEGA_NOTIFICATION_COUNTER = 0;
  if (!Array.isArray(omegaState.notifications)) omegaState.notifications = [];
  else omegaState.notifications.length = 0;
  omegaState.notificationPanelOpen = false;
}

function ensureOmegaData(){
  if (OMEGA_TICKETS.length) return Promise.resolve(OMEGA_TICKETS);
  if (omegaDataPromise) return omegaDataPromise;

  resetOmegaFacts();
  const loader = (typeof loadCSVAuto === 'function')
    ? loadCSVAuto(OMEGA_TICKETS_SOURCE).catch((err) => {
        console.warn('Falha ao carregar CSV da Omega via loader principal:', err);
        return fallbackLoadCsv(OMEGA_TICKETS_SOURCE);
      })
    : fallbackLoadCsv(OMEGA_TICKETS_SOURCE);

  omegaDataPromise = loader
    .then((rows) => {
      OMEGA_TICKETS = normalizeOmegaTicketRows(Array.isArray(rows) ? rows : []);
      OMEGA_TICKETS.forEach((ticket) => ingestHistoryFacts(ticket, { initial: true }));
      omegaTicketCounter = OMEGA_TICKETS.reduce((max, ticket) => {
        const seq = parseInt(ticket.id, 10);
        return Number.isFinite(seq) ? Math.max(max, seq) : max;
      }, 0);
      return OMEGA_TICKETS;
    })
    .catch((err) => {
      console.error('Não foi possível carregar os chamados Omega:', err);
      omegaDataPromise = null;
      OMEGA_TICKETS = [];
      return [];
    });

  return omegaDataPromise;
}

function reloadOmegaTickets(){
  omegaDataPromise = null;
  OMEGA_TICKETS = [];
  omegaTicketCounter = 0;
  return ensureOmegaData();
}

function ensureOmegaUsers(){
  if (OMEGA_USERS.length) return Promise.resolve(OMEGA_USERS);
  if (omegaUsersPromise) return omegaUsersPromise;

  const loader = (typeof loadCSVAuto === 'function')
    ? loadCSVAuto(OMEGA_USERS_SOURCE).catch((err) => {
        console.warn('Falha ao carregar usuários Omega via loader principal:', err);
        return fallbackLoadCsv(OMEGA_USERS_SOURCE);
      })
    : fallbackLoadCsv(OMEGA_USERS_SOURCE);

  omegaUsersPromise = loader
    .then((rows) => {
      OMEGA_USERS = normalizeOmegaUserRows(Array.isArray(rows) ? rows : []);
      if (!OMEGA_USERS.length) throw new Error('Nenhum usuário disponível para o Omega');
      if (!OMEGA_USERS.some((user) => user.id === omegaState.currentUserId)) {
        omegaState.currentUserId = OMEGA_USERS[0]?.id || null;
      }
      return OMEGA_USERS;
    })
    .catch((err) => {
      console.error('Não foi possível carregar os usuários Omega:', err);
      omegaUsersPromise = null;
      OMEGA_USERS = [];
      omegaState.currentUserId = null;
      return [];
    });

  return omegaUsersPromise;
}

function setButtonLoading(button, loading){
  if (!button) return;
  button.disabled = !!loading;
  if (loading) button.dataset.loading = 'true';
  else delete button.dataset.loading;
  const icon = button.querySelector('i');
  if (!icon) return;
  if (loading) {
    icon.dataset.originalIcon = icon.className;
    icon.className = 'ti ti-loader-2';
  } else if (icon.dataset.originalIcon) {
    icon.className = icon.dataset.originalIcon;
    delete icon.dataset.originalIcon;
  }
}

function refreshTicketList(button){
  setButtonLoading(button, true);
  reloadOmegaTickets()
    .catch((err) => {
      console.warn('Falha ao atualizar chamados Omega:', err);
      return [];
    })
    .then(() => {
      renderOmega();
    })
    .finally(() => {
      setButtonLoading(button, false);
    });
}

function ensureOmegaStatuses(){
  if (OMEGA_STATUS_CATALOG.length) return Promise.resolve(OMEGA_STATUS_CATALOG);
  if (omegaStatusPromise) return omegaStatusPromise;

  const loader = (typeof loadCSVAuto === 'function')
    ? loadCSVAuto(OMEGA_STATUS_SOURCE).catch((err) => {
        console.warn('Falha ao carregar status via loader principal:', err);
        return fallbackLoadCsv(OMEGA_STATUS_SOURCE);
      })
    : fallbackLoadCsv(OMEGA_STATUS_SOURCE);

  omegaStatusPromise = loader
    .then((rows) => {
      const normalized = normalizeOmegaStatusRows(Array.isArray(rows) ? rows : []);
      if (!normalized.length) throw new Error('Nenhum status cadastrado');
      applyStatusCatalog(normalized);
      return OMEGA_STATUS_CATALOG;
    })
    .catch((err) => {
      console.warn('Aplicando status padrão da Omega:', err);
      applyStatusCatalog(OMEGA_DEFAULT_STATUSES);
      return OMEGA_STATUS_CATALOG;
    });

  return omegaStatusPromise;
}

function applyStatusCatalog(entries){
  const catalog = Array.isArray(entries) ? entries : [];
  let normalized = catalog
    .map((item, index) => {
      if (!item) return null;
      const rawId = (item.id || item.status_id || item.ID || item.codigo || '').toString().trim();
      const id = rawId ? normalizeStatusId(rawId) : '';
      if (!id) return null;
      const label = (item.label || item.nome || item.descricao || rawId || id).toString().trim() || id;
      const toneRaw = (item.tone || item.cor || '').toString().trim().toLowerCase();
      const tone = OMEGA_STATUS_TONE_OPTIONS.includes(toneRaw) ? toneRaw : 'neutral';
      const orderValue = Number.parseFloat(item.order ?? item.ordem ?? item.posicao ?? index + 1);
      const order = Number.isFinite(orderValue) ? orderValue : index + 1;
      const description = (item.description || item.descricao || '').toString().trim();
      const departmentIdRaw = (item.departmentId || item.departamento_id || item.queue_id || '').toString().trim();
      const departmentId = departmentIdRaw || OMEGA_STATUS_GLOBAL_DEPARTMENT;
      return { id, label, tone, description, order, departmentId };
    })
    .filter(Boolean);

  if (!normalized.length) {
    normalized = OMEGA_DEFAULT_STATUSES.map((item, index) => ({
      id: item.id,
      label: item.label,
      tone: item.tone || 'neutral',
      description: item.description || '',
      order: index + 1,
      departmentId: item.departmentId || OMEGA_STATUS_GLOBAL_DEPARTMENT,
    }));
  } else {
    normalized.sort((a, b) => {
      const diff = (a.order ?? 0) - (b.order ?? 0);
      if (diff !== 0) return diff;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
  }

  OMEGA_STATUS_CATALOG = normalized;
  const meta = {};
  const order = ['todos'];
  const seen = new Set();
  normalized.forEach((entry) => {
    if (!entry?.id) return;
    meta[entry.id] = {
      label: entry.label,
      tone: entry.tone || 'neutral',
      description: entry.description || '',
      departmentId: entry.departmentId || OMEGA_STATUS_GLOBAL_DEPARTMENT,
    };
    if (!seen.has(entry.id)) {
      order.push(entry.id);
      seen.add(entry.id);
    }
  });
  OMEGA_STATUS_META = meta;
  OMEGA_STATUS_ORDER = order;
}

function normalizeOmegaStatusRows(rows){
  return rows
    .map((row, index) => {
      const rawId = (row.status_id || row.id || row.ID || row.codigo || '').toString().trim();
      const id = rawId ? normalizeStatusId(rawId) : '';
      if (!id) return null;
      const label = (row.label || row.nome || row.descricao || rawId || id).toString().trim() || id;
      const toneRaw = (row.tone || row.cor || '').toString().trim().toLowerCase();
      const tone = OMEGA_STATUS_TONE_OPTIONS.includes(toneRaw) ? toneRaw : 'neutral';
      const ordem = Number.parseInt(row.ordem || row.order || row.posicao || index + 1, 10);
      const order = Number.isFinite(ordem) ? ordem : index + 1;
      const description = (row.descricao || row.description || '').toString().trim();
      const departmentIdRaw = (row.departamento_id || row.department_id || row.queue_id || '').toString().trim();
      const departmentId = departmentIdRaw || OMEGA_STATUS_GLOBAL_DEPARTMENT;
      return { id, label, tone, order, description, departmentId };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const diff = (a.order ?? 0) - (b.order ?? 0);
      if (diff !== 0) return diff;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
}

function normalizeStatusId(value){
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'aberto';
}

function getDepartmentIdByName(name){
  if (!name) return '';
  const meta = OMEGA_DEPARTMENT_META.get(name);
  return (meta?.id || '').toString();
}

function getDepartmentNameById(id){
  if (!id) return '';
  const target = id.toString();
  for (const [name, meta] of OMEGA_DEPARTMENT_META.entries()) {
    if ((meta?.id || '').toString() === target) return name;
  }
  return '';
}

function getOrderedStatuses(){
  const statuses = Array.isArray(OMEGA_STATUS_ORDER)
    ? OMEGA_STATUS_ORDER.filter((status) => status && status !== 'todos')
    : [];
  return statuses.length ? statuses : OMEGA_DEFAULT_STATUSES.map((item) => item.id);
}

function getSelection(){
  if (!(omegaState.selectedTicketIds instanceof Set)) {
    const seed = Array.isArray(omegaState.selectedTicketIds) ? omegaState.selectedTicketIds : [];
    omegaState.selectedTicketIds = new Set(seed);
  }
  return omegaState.selectedTicketIds;
}

function getOpenNavSet(){
  if (!(omegaState.openNavParents instanceof Set)) {
    const seed = Array.isArray(omegaState.openNavParents) ? omegaState.openNavParents : [];
    omegaState.openNavParents = new Set(seed);
  }
  return omegaState.openNavParents;
}

function clearSelection(){
  const selection = getSelection();
  selection.clear();
  omegaState.bulkStatus = "";
}

function updateSelection(ticketId, selected){
  const selection = getSelection();
  if (!ticketId) return;
  if (selected) selection.add(ticketId);
  else selection.delete(ticketId);
}

function normalizeViewId(viewId){
  if (!viewId) return viewId;
  if (viewId === 'team-edit-analyst' || viewId === 'team-edit-status') return 'team';
  return viewId;
}

function expandNavForView(viewId){
  if (!viewId) return;
  const openSet = getOpenNavSet();
  const normalized = normalizeViewId(viewId);
  const item = OMEGA_NAV_LOOKUP.get(viewId);
  if (item && Array.isArray(item.children) && item.children.length) {
    openSet.add(item.id);
  }
  const parentId = OMEGA_NAV_PARENT_MAP[viewId];
  if (parentId) openSet.add(parentId);
  if (normalized !== viewId) {
    const normalizedItem = OMEGA_NAV_LOOKUP.get(normalized);
    if (normalizedItem && Array.isArray(normalizedItem.children) && normalizedItem.children.length) {
      openSet.add(normalizedItem.id);
    }
    const normalizedParent = OMEGA_NAV_PARENT_MAP[normalized];
    if (normalizedParent) openSet.add(normalizedParent);
  }
}

function shouldAllowSelection(user){
  if (!user) return false;
  const view = normalizeViewId(omegaState.view);
  const privilegedRoles = ['analista', 'supervisor', 'admin'];
  if (!privilegedRoles.includes(user.role)) return false;
  if (view === 'team') return ['supervisor', 'admin'].includes(user.role);
  const allowedViews = ['my', 'assigned', 'queue', 'admin'];
  return allowedViews.includes(view);
}

function fallbackLoadCsv(path){
  return fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then((text) => simpleCsvParse(text));
}

function detectCsvDelimiter(headerLine){
  if (!headerLine) return ',';
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  if (semicolonCount && semicolonCount >= commaCount) return ';';
  return ',';
}

function splitCsvLine(line, delimiter){
  const cells = [];
  if (line == null) return cells;
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function simpleCsvParse(text){
  if (!text) return [];
  const lines = text.replace(/\r/g, '').split('\n').filter((line) => line.trim().length);
  if (!lines.length) return [];
  const headerLine = lines.shift();
  const delimiter = detectCsvDelimiter(headerLine);
  const header = splitCsvLine(headerLine, delimiter).map((cell) => cell.trim());
  return lines.map((line) => {
    const cells = splitCsvLine(line, delimiter);
    const row = {};
    header.forEach((key, idx) => {
      row[key] = (cells[idx] ?? '').trim();
    });
    return row;
  });
}

function applyOmegaStructureCatalog(rows){
  const normalized = Array.isArray(rows) ? rows : [];
  OMEGA_DEPARTMENT_META.clear();
  const departmentMap = new Map();
  normalized.forEach((row) => {
    const department = (row.departamento || row.department || row.queue || '').trim();
    if (!department) return;
    const departmentOrderRaw = Number.parseFloat(row.ordem_departamento ?? row.departamento_ordem ?? row.order_department ?? '');
    const typeLabel = (row.tipo || row.type || row.category || '').trim();
    const typeOrderRaw = Number.parseFloat(row.ordem_tipo ?? row.order_tipo ?? row.ordem_type ?? '');
    const departmentIdRaw = (row.departamento_id || row.department_id || row.queue_id || row.id || '').toString().trim();
    const departmentId = departmentIdRaw || OMEGA_FALLBACK_DEPARTMENT_IDS[department] || '';
    let entry = departmentMap.get(department);
    if (!entry) {
      entry = {
        order: Number.isFinite(departmentOrderRaw) ? departmentOrderRaw : Number.POSITIVE_INFINITY,
        types: [],
        seen: new Set(),
        id: departmentId,
      };
      departmentMap.set(department, entry);
    } else {
      if (Number.isFinite(departmentOrderRaw) && departmentOrderRaw < entry.order) {
        entry.order = departmentOrderRaw;
      }
      if (departmentId && !entry.id) entry.id = departmentId;
    }
    if (!typeLabel) return;
    const typeKey = normalizeText(typeLabel);
    if (entry.seen.has(typeKey)) return;
    entry.seen.add(typeKey);
    const typeOrder = Number.isFinite(typeOrderRaw) ? typeOrderRaw : entry.types.length;
    entry.types.push({ label: typeLabel, order: typeOrder });
  });

  if (!departmentMap.size) {
    OMEGA_TICKET_TYPES_BY_DEPARTMENT = Object.fromEntries(
      Object.entries(OMEGA_STRUCTURE_FALLBACK).map(([queue, items]) => [queue, [...items]])
    );
    OMEGA_QUEUE_OPTIONS = Object.keys(OMEGA_TICKET_TYPES_BY_DEPARTMENT);
    OMEGA_QUEUE_OPTIONS.forEach((queue, index) => {
      const fallbackId = OMEGA_FALLBACK_DEPARTMENT_IDS[queue] ?? String(index + 1);
      OMEGA_DEPARTMENT_META.set(queue, { id: fallbackId });
    });
    omegaStructureReady = true;
    reconcileTicketsWithCatalog();
    return;
  }

  const sortedDepartments = Array.from(departmentMap.entries()).sort((a, b) => {
    const [deptA, metaA] = a;
    const [deptB, metaB] = b;
    const orderA = Number.isFinite(metaA.order) ? metaA.order : Number.POSITIVE_INFINITY;
    const orderB = Number.isFinite(metaB.order) ? metaB.order : Number.POSITIVE_INFINITY;
    if (orderA !== orderB) return orderA - orderB;
    return deptA.localeCompare(deptB, 'pt-BR');
  });

  OMEGA_QUEUE_OPTIONS = sortedDepartments.map(([department]) => department);
  OMEGA_TICKET_TYPES_BY_DEPARTMENT = Object.fromEntries(
    sortedDepartments.map(([department, meta], index) => {
      const types = meta.types
        .sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.label.localeCompare(b.label, 'pt-BR');
        })
        .map((item) => item.label);
      const fallbackId = OMEGA_FALLBACK_DEPARTMENT_IDS[department] ?? String(index + 1);
      const departmentId = meta.id || fallbackId;
      OMEGA_DEPARTMENT_META.set(department, { id: departmentId });
      return [department, types];
    })
  );
  omegaStructureReady = true;
  reconcileTicketsWithCatalog();
}

function ensureOmegaStructure(){
  if (omegaStructureReady) return Promise.resolve(OMEGA_TICKET_TYPES_BY_DEPARTMENT);
  if (omegaStructurePromise) return omegaStructurePromise;

  const loader = (typeof loadCSVAuto === 'function')
    ? loadCSVAuto(OMEGA_STRUCTURE_SOURCE).catch((err) => {
        console.warn('Falha ao carregar estrutura Omega via loader principal:', err);
        return fallbackLoadCsv(OMEGA_STRUCTURE_SOURCE);
      })
    : fallbackLoadCsv(OMEGA_STRUCTURE_SOURCE);

  omegaStructurePromise = loader
    .then((rows) => {
      if (!Array.isArray(rows) || !rows.length) throw new Error('Base de estrutura vazia');
      applyOmegaStructureCatalog(rows);
      return OMEGA_TICKET_TYPES_BY_DEPARTMENT;
    })
    .catch((err) => {
      console.warn('Aplicando estrutura padrão da Omega:', err);
      applyOmegaStructureCatalog(null);
      return OMEGA_TICKET_TYPES_BY_DEPARTMENT;
    })
    .finally(() => {
      omegaStructurePromise = null;
    });

  return omegaStructurePromise;
}

function normalizeOmegaUserRows(rows){
  return rows.map((row) => {
    const id = (row.id || row.ID || '').trim();
    const name = (row.nome || row.name || '').trim();
    if (!id || !name) return null;
    const functionalRaw = (row.funcional || row.matricula || row.juncao || row.juncao_id || '').toString().trim();
    const functionalDigits = functionalRaw.replace(/[^0-9]/g, '');
    const functional = functionalDigits ? functionalDigits.padStart(7, '0').slice(-7) : '';
    const roles = {
      usuario: parseOmegaBoolean(row.usuario),
      analista: parseOmegaBoolean(row.analista),
      supervisor: parseOmegaBoolean(row.supervisor),
      admin: parseOmegaBoolean(row.admin),
    };
    const primaryRole = resolvePrimaryRole(roles);
    const meta = OMEGA_USER_METADATA[id] || {};
    const queues = Object.entries(OMEGA_QUEUE_FIELD_MAP).reduce((acc, [label, field]) => {
      if (parseOmegaBoolean(row[field])) acc.push(label);
      return acc;
    }, []);
    const matrixAccess = queues.includes('Matriz') || parseOmegaBoolean(row.matriz);
    const positionRaw = (row.cargo || row.funcao || row.cargo_principal || '').trim();
    const junction = functional || (row.juncao || row.juncao_id || row.matricula || '').toString().trim();
    const position = positionRaw || (OMEGA_ROLE_LABELS[primaryRole] || 'Usuário');
    return {
      id,
      name,
      role: primaryRole,
      roles,
      matrixAccess,
      avatar: meta.avatar || null,
      position,
      junction,
      functional,
      queues,
      defaultQueue: queues[0] || null,
      teamId: meta.teamId ?? null,
    };
  }).filter(Boolean).sort((a, b) => {
    const orderMap = { usuario: 0, analista: 1, supervisor: 2, admin: 3 };
    const diff = (orderMap[a.role] ?? 10) - (orderMap[b.role] ?? 10);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

function parseOmegaBoolean(value){
  if (value == null) return false;
  const normalized = value.toString().trim().toLowerCase();
  return ['1', 'true', 'sim', 'yes', 'y', 'x'].includes(normalized);
}

function resolvePrimaryRole(roles){
  const priority = ['admin', 'supervisor', 'analista', 'usuario'];
  const match = priority.find((role) => roles?.[role]);
  return match || 'usuario';
}

function getUserRoles(user){
  if (!user) return [];
  const roles = Object.entries(user.roles || {})
    .filter(([, value]) => !!value)
    .map(([role]) => role);
  if (!roles.length && user.role) roles.push(user.role);
  if (user.role && !roles.includes(user.role)) roles.push(user.role);
  const order = ['usuario', 'analista', 'supervisor', 'admin'];
  return roles.sort((a, b) => (order.indexOf(a) - order.indexOf(b)));
}

function getUserRoleLabel(user){
  if (!user) return 'Usuário';
  const roles = getUserRoles(user);
  if (!roles.length) return OMEGA_ROLE_LABELS[user.role] || 'Usuário';
  if (roles.length === 1) return OMEGA_ROLE_LABELS[roles[0]] || roles[0];
  return roles.map((role) => OMEGA_ROLE_LABELS[role] || role).join(' • ');
}

function resolveCatalogCategory(queue, rawCategory){
  const label = (rawCategory || '').trim();
  if (!label) return '';
  const normalizedLabel = normalizeText(label);
  if (queue && Array.isArray(OMEGA_TICKET_TYPES_BY_DEPARTMENT[queue])) {
    const match = OMEGA_TICKET_TYPES_BY_DEPARTMENT[queue].find((item) => normalizeText(item) === normalizedLabel);
    if (match) return match;
  }
  for (const list of Object.values(OMEGA_TICKET_TYPES_BY_DEPARTMENT)) {
    if (!Array.isArray(list)) continue;
    const match = list.find((item) => normalizeText(item) === normalizedLabel);
    if (match) return match;
  }
  return label;
}

function reconcileTicketsWithCatalog(){
  if (!Array.isArray(OMEGA_TICKETS) || !OMEGA_TICKETS.length) return;
  OMEGA_TICKETS.forEach((ticket) => {
    if (!ticket) return;
    ticket.category = resolveCatalogCategory(ticket.queue, ticket.category);
  });
}

function normalizeOmegaTicketRows(rows){
  return rows.map((row) => {
    const id = (row.id || row.ID || '').trim();
    if (!id) return null;
    const opened = (row.opened || row.abertura || '').trim();
    const updated = (row.updated || row.atualizacao || opened || '').trim();
    const productId = (row.product_id || row.produto_id || '').trim();
    const productLabel = (row.product_label || row.produto || '').trim();
    const family = (row.family || row.familia || '').trim();
    const section = (row.section || row.secao || '').trim();
    const queue = (row.queue || row.departamento || '').trim();
    const rawCategory = (row.category || row.tipo || '').trim();
    const category = resolveCatalogCategory(queue, rawCategory);
    const dueDate = (row.due_date || row.prazo || '').trim();
    const historyRaw = row.history || '';
    const history = parseOmegaHistory(historyRaw);
    const requesterDisplay = (row.usuario || row.user || row.requester_name || row.company || row.empresa || '').trim();
    const context = {
      diretoria: (row.diretoria || '').trim(),
      gerencia: (row.gerencia || '').trim(),
      agencia: (row.agencia || '').trim(),
      ggestao: (row.gerente_gestao || row.gestor_gestao || '').trim(),
      gerente: (row.gerente || '').trim(),
      familia: family,
      secao: section,
      prodsub: productLabel,
    };
    return {
      id,
      subject: (row.subject || row.assunto || '').trim() || `${category || 'Chamado'} — ${productLabel || productId || 'Produto'}`,
      company: requesterDisplay,
      requesterName: requesterDisplay,
      productId,
      product: productLabel,
      family,
      section,
      queue,
      status: (row.status || '').trim().toLowerCase() || 'aberto',
      category,
      priority: (row.priority || row.prioridade || '').trim().toLowerCase() || 'media',
      opened,
      updated,
      dueDate: dueDate || null,
      requesterId: (row.requester_id || row.solicitante || '').trim() || null,
      ownerId: (row.owner_id || row.responsavel || '').trim() || null,
      teamId: (row.team_id || row.time || '').trim() || null,
      context,
      history,
      credit: (row.credit || row.credito || '').trim(),
      attachments: (row.attachment || row.arquivo || '').trim() ? [ (row.attachment || row.arquivo || '').trim() ] : [],
    };
  }).filter(Boolean);
}

function parseOmegaHistory(raw){
  if (!raw) return [];
  return String(raw).split('||').map((chunk) => chunk.trim()).filter(Boolean).map((chunk) => {
    const [date, actorId, action, comment, status] = chunk.split('::');
    return {
      date: (date || '').trim(),
      actorId: (actorId || '').trim(),
      action: (action || '').trim() || 'Atualização do chamado',
      comment: (comment || '').trim(),
      status: (status || '').trim().toLowerCase() || 'aberto',
    };
  }).filter((entry) => entry.date && entry.actorId);
}

function classifyHistoryEntry(entry){
  if (!entry) return 'atualizacao';
  const action = normalizePlain(entry.action);
  const status = normalizePlain(entry.status);
  const comment = (entry.comment || '').trim();
  if (action.includes('aprov')) return 'aprovacao';
  if (action.includes('status') || action.includes('cancel') || action.includes('resolvid')) return 'status';
  if (comment) return 'comentario';
  if (status && ['cancelado', 'resolvido'].includes(status)) return 'status';
  return 'atualizacao';
}

function shouldNotifyForHistory(type){
  return ['comentario', 'status', 'aprovacao'].includes(type);
}

function registerCommentFact(ticket, entry, type, { initial = false, sequence = null } = {}){
  if (!ticket || !entry) return null;
  OMEGA_COMMENT_COUNTER += 1;
  const record = {
    id: `cmt-${OMEGA_COMMENT_COUNTER.toString().padStart(4, '0')}`,
    ticketId: ticket.id,
    ticketSubject: ticket.subject || `Chamado ${ticket.id}`,
    sequence: sequence ?? (Array.isArray(ticket.history) ? ticket.history.length : 0),
    date: entry.date || new Date().toISOString(),
    actorId: entry.actorId || '',
    action: entry.action || 'Atualização do chamado',
    comment: entry.comment || '',
    status: entry.status || ticket.status || 'aberto',
    type: type || classifyHistoryEntry(entry),
    initial,
  };
  OMEGA_COMMENT_FACT.push(record);
  return record;
}

function registerNotification(ticket, entry, type, { initial = false } = {}){
  if (!ticket || !entry || !shouldNotifyForHistory(type)) return null;
  OMEGA_NOTIFICATION_COUNTER += 1;
  const record = {
    id: `ntf-${OMEGA_NOTIFICATION_COUNTER.toString().padStart(4, '0')}`,
    ticketId: ticket.id,
    ticketSubject: ticket.subject || `Chamado ${ticket.id}`,
    date: entry.date || new Date().toISOString(),
    actorId: entry.actorId || '',
    action: entry.action || '',
    comment: entry.comment || '',
    status: entry.status || ticket.status || 'aberto',
    type,
    read: !!initial,
  };
  OMEGA_NOTIFICATION_FACT.push(record);
  if (!Array.isArray(omegaState.notifications)) omegaState.notifications = [];
  const stateRecord = { ...record };
  if (initial) omegaState.notifications.push(stateRecord);
  else omegaState.notifications.unshift(stateRecord);
  omegaState.notifications.sort((a, b) => {
    const aTime = new Date(a.date || 0).getTime();
    const bTime = new Date(b.date || 0).getTime();
    return bTime - aTime;
  });
  if (omegaState.notificationPanelOpen) {
    markNotificationsAsRead();
    const root = document.getElementById('omega-modal');
    if (root) renderNotificationCenter(root);
  }
  return record;
}

function appendTicketHistory(ticket, entry, { type, notify = true } = {}){
  if (!ticket || !entry) return null;
  if (!Array.isArray(ticket.history)) ticket.history = [];
  const payload = {
    date: entry.date || new Date().toISOString(),
    actorId: entry.actorId || '',
    action: entry.action || 'Atualização do chamado',
    comment: entry.comment || '',
    status: (entry.status || ticket.status || 'aberto').toLowerCase(),
    attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
  };
  ticket.history.push(payload);
  const resolvedType = type || classifyHistoryEntry(payload);
  registerCommentFact(ticket, payload, resolvedType, { sequence: ticket.history.length });
  if (notify && shouldNotifyForHistory(resolvedType)) {
    registerNotification(ticket, payload, resolvedType);
  }
  return payload;
}

function ingestHistoryFacts(ticket, { initial = false } = {}){
  if (!ticket) return;
  const history = Array.isArray(ticket.history) ? ticket.history : [];
  history.forEach((entry, index) => {
    const normalized = {
      date: entry.date || ticket.opened || new Date().toISOString(),
      actorId: entry.actorId || '',
      action: entry.action || 'Atualização do chamado',
      comment: entry.comment || '',
      status: entry.status || ticket.status || 'aberto',
    };
    const type = classifyHistoryEntry(normalized);
    registerCommentFact(ticket, normalized, type, { initial, sequence: index + 1 });
    if (shouldNotifyForHistory(type)) {
      registerNotification(ticket, normalized, type, { initial });
    }
  });
}

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
      wrapper.innerHTML = html;
      const templateRoot = wrapper.querySelector("#omega-modal");
      if (!templateRoot) throw new Error("Template Omega não encontrado em omega.html");
      const clone = templateRoot.cloneNode(true);
      clone.removeAttribute("data-omega-standalone");
      clone.hidden = true;
      document.body.appendChild(clone);
      return clone;
    })
    .catch((err) => {
      console.error("Não foi possível carregar o template da Omega:", err);
      omegaTemplatePromise = null;
      throw err;
    });

  return omegaTemplatePromise;
}

function openOmega(detail = null){
  ensureDefaultExternalContacts();
  Promise.all([
    ensureOmegaTemplate(),
    ensureOmegaStructure(),
    ensureOmegaData(),
    ensureOmegaUsers(),
    ensureOmegaStatuses(),
    ensureOmegaMesu(),
  ])
    .then(([root]) => {
      if (!root) return;
      setupOmegaModule(root);
      populateUserSelect(root);
      applySidebarState(root);
      const shouldOpenDrawer = detail?.openDrawer || detail?.intent === 'new-ticket';
      const preferredQueue = detail?.preferredQueue || detail?.queue || '';
      omegaState.pendingNewTicket = shouldOpenDrawer
        ? { queue: preferredQueue || 'POBJ' }
        : null;
      omegaState.prefillDepartment = '';
      omegaState.contextDetail = detail || null;
      omegaState.search = "";
      omegaState.selectedTicketId = null;
      getOpenNavSet().clear();
      resetAdvancedFilters();
      setFilterPanelOpen(false);
      setTicketModalOpen(false);
      enforceViewForRole();
      root.hidden = false;
      document.body.classList.add("has-omega-open");
      renderOmega();
      const hadPendingNewTicket = !!omegaState.pendingNewTicket;
      applyPendingIntents(root);
      if (!hadPendingNewTicket) {
        const searchInput = root.querySelector("#omega-search");
        if (searchInput) {
          requestAnimationFrame(() => {
            try { searchInput.focus(); } catch (err) { /* ignore focus errors */ }
          });
        }
      }
    })
    .catch(() => {
      /* erros já registrados em ensureOmegaTemplate/ensureOmegaData */
    });
}

function closeOmega(){
  const root = document.getElementById("omega-modal");
  if (!root) return;
  setDrawerOpen(false);
  setTicketModalOpen(false);
  setFilterPanelOpen(false);
  setManageAnalystOpen(false);
  setManageStatusOpen(false);
  omegaState.pendingNewTicket = null;
  omegaState.prefillDepartment = '';
  omegaState.cancelDialogOpen = false;
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

  const notificationsBtn = root.querySelector('#omega-notifications');
  const notificationsClose = root.querySelector('#omega-notification-close');
  notificationsBtn?.addEventListener('click', () => toggleNotificationPanel());
  notificationsClose?.addEventListener('click', () => setNotificationPanelOpen(false));

  root.querySelectorAll('[data-omega-ticket-close]').forEach((btn) => {
    btn.addEventListener('click', () => setTicketModalOpen(false));
  });
  const ticketOverlay = root.querySelector('.omega-ticket-modal__overlay');
  ticketOverlay?.addEventListener('click', () => setTicketModalOpen(false));

  root.querySelectorAll('[data-omega-drawer-close]').forEach((btn) => {
    btn.addEventListener('click', () => setDrawerOpen(false));
  });

  root.querySelectorAll('[data-omega-manage-analyst-close]').forEach((btn) => {
    btn.addEventListener('click', () => setManageAnalystOpen(false));
  });
  const manageAnalystOverlay = root.querySelector('#omega-manage-analyst .omega-manage-modal__overlay');
  manageAnalystOverlay?.addEventListener('click', () => setManageAnalystOpen(false));

  root.querySelectorAll('[data-omega-manage-status-close]').forEach((btn) => {
    btn.addEventListener('click', () => setManageStatusOpen(false));
  });
  const manageStatusOverlay = root.querySelector('#omega-manage-status .omega-manage-modal__overlay');
  manageStatusOverlay?.addEventListener('click', () => setManageStatusOpen(false));

  const sidebarToggle = root.querySelector('#omega-sidebar-toggle');
  sidebarToggle?.addEventListener('click', () => {
    setSidebarCollapsed(!omegaState.sidebarCollapsed);
    renderOmega();
  });

  const clearFiltersTop = root.querySelector('#omega-clear-filters-top');
  clearFiltersTop?.addEventListener('click', () => {
    resetAdvancedFilters();
    syncFilterFormState(root);
    resetTablePage();
    renderOmega();
  });

  const searchInput = root.querySelector('#omega-search');
  searchInput?.addEventListener('input', (ev) => {
    omegaState.search = ev.target.value || "";
    resetTablePage();
    renderOmega();
  });

  const refreshBtn = root.querySelector('#omega-refresh');
  refreshBtn?.addEventListener('click', () => {
    refreshTicketList(refreshBtn);
  });

  const statusFilterHost = root.querySelector('#omega-filter-status');
  statusFilterHost?.addEventListener('change', (ev) => {
    const input = ev.target;
    if (!input || input.type !== 'checkbox') return;
    const option = input.closest?.('.omega-filter-status__option');
    if (!option) return;
    option.dataset.checked = input.checked ? 'true' : 'false';
  });

  const navHost = root.querySelector('#omega-nav');
  navHost?.addEventListener('click', (ev) => {
    const button = ev.target.closest?.('.omega-nav__item');
    if (!button) return;
    const view = button.dataset.view;
    if (!view) return;
    const hasChildren = button.dataset.hasChildren === 'true';
    const parentId = button.dataset.parent || '';
    const openSet = getOpenNavSet();
    let shouldRender = false;

    if (view === 'team-edit-analyst') {
      if (parentId) openSet.add(parentId);
      setManageAnalystOpen(true);
      omegaState.view = 'team';
      omegaState.selectedTicketId = null;
      clearSelection();
      omegaState.bulkPanelOpen = false;
      expandNavForView('team');
      resetTablePage();
      renderOmega();
      return;
    }

    if (view === 'team-edit-status') {
      if (parentId) openSet.add(parentId);
      setManageStatusOpen(true);
      omegaState.view = 'team';
      omegaState.selectedTicketId = null;
      clearSelection();
      omegaState.bulkPanelOpen = false;
      expandNavForView('team');
      resetTablePage();
      renderOmega();
      return;
    }

    if (hasChildren) {
      const isExpanded = openSet.has(view);
      if (!isExpanded) {
        openSet.add(view);
        shouldRender = true;
      } else if (omegaState.view === view) {
        openSet.delete(view);
        shouldRender = true;
      }
    } else if (parentId) {
      openSet.add(parentId);
    }

    if (omegaState.view !== view) {
      setManageAnalystOpen(false);
      setManageStatusOpen(false);
      omegaState.view = view;
      omegaState.selectedTicketId = null;
      clearSelection();
      omegaState.bulkPanelOpen = false;
      resetTablePage();
      expandNavForView(view);
      shouldRender = true;
    }

    if (shouldRender || hasChildren) {
      renderOmega();
    }
  });

  const tableBody = root.querySelector('#omega-ticket-rows');
  tableBody?.addEventListener('click', (ev) => {
    const checkbox = ev.target.closest?.('input[data-omega-select]');
    if (checkbox) {
      updateSelection(checkbox.value, checkbox.checked);
      omegaState.bulkPanelOpen = omegaState.bulkPanelOpen && getSelection().size > 0;
      ev.stopPropagation();
      renderOmega();
      return;
    }
    if (ev.target.closest?.('td.col-select')) {
      ev.preventDefault();
      return;
    }
    const row = ev.target.closest?.('tr[data-ticket-id]');
    if (!row) return;
    const ticketId = row.dataset.ticketId;
    if (!ticketId) return;
    openTicketDetail(ticketId);
  });

  const paginationNav = root.querySelector('#omega-pagination');
  paginationNav?.addEventListener('click', (ev) => {
    const button = ev.target.closest?.('.omega-pagination__button[data-omega-page]');
    if (!button) return;
    if (button.disabled) return;
    const targetPage = Number.parseInt(button.dataset.omegaPage, 10);
    if (!Number.isFinite(targetPage) || targetPage < 1) return;
    if (goToTablePage(targetPage)) {
      renderOmega();
    }
  });

  const selectAll = root.querySelector('#omega-select-all');
  selectAll?.addEventListener('change', (ev) => {
    const checked = !!ev.target.checked;
    const selection = getSelection();
    if (!checked) {
      selection.clear();
      omegaState.bulkStatus = "";
    } else {
      root.querySelectorAll('#omega-ticket-rows tr[data-ticket-id]').forEach((row) => {
        if (row?.dataset?.ticketId) selection.add(row.dataset.ticketId);
      });
    }
    omegaState.bulkPanelOpen = checked ? omegaState.bulkPanelOpen : false;
    renderOmega();
  });

  const newTicketBtn = root.querySelector('#omega-new-ticket');
  newTicketBtn?.addEventListener('click', () => setDrawerOpen(true));

  const form = root.querySelector('#omega-form');
  form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    handleNewTicketSubmit(form);
  });

  const departmentSelect = root.querySelector('#omega-form-department');
  const typeSelect = root.querySelector('#omega-form-type');
  const fileInput = root.querySelector('#omega-form-file');
  const addFileBtn = root.querySelector('[data-omega-add-file]');
  const attachmentsList = root.querySelector('#omega-form-attachments');
  departmentSelect?.addEventListener('change', (ev) => {
    syncTicketTypeOptions(root, ev.target.value);
    updateOmegaFormSubject(root);
    renderFormFlowExtras(root);
  });
  typeSelect?.addEventListener('change', (ev) => {
    const flow = getFormFlowState();
    const selectedLabel = ev.target?.selectedOptions?.[0]?.textContent?.trim()
      || ev.target.value
      || '';
    const selectedValue = ev.target?.value || '';
    const previousLabel = flow.type;
    const previousValue = flow.typeValue;
    flow.type = selectedLabel;
    flow.typeValue = selectedValue || selectedLabel;
    if (flow.type !== previousLabel || flow.typeValue !== previousValue) {
      flow.targetManagerName = '';
      flow.targetManagerEmail = '';
      flow.requesterManagerName = '';
      flow.requesterManagerEmail = '';
    }
    updateOmegaFormSubject(root);
    renderFormFlowExtras(root);
  });
  addFileBtn?.addEventListener('click', () => {
    if (fileInput) fileInput.click();
  });
  fileInput?.addEventListener('change', () => {
    addFormAttachments(root, fileInput.files);
    try {
      fileInput.value = '';
    } catch (err) {
      /* noop */
    }
  });
  attachmentsList?.addEventListener('click', (ev) => {
    const btn = ev.target.closest?.('[data-omega-remove-attachment]');
    if (!btn) return;
    const id = btn.dataset.omegaRemoveAttachment;
    if (!id) return;
    removeFormAttachment(root, id);
  });

  const flowNameInput = root.querySelector('#omega-flow-target-name');
  const flowEmailInput = root.querySelector('#omega-flow-target-email');
  const flowRequesterNameInput = root.querySelector('#omega-flow-requester-name');
  const flowRequesterEmailInput = root.querySelector('#omega-flow-requester-email');
  flowNameInput?.addEventListener('input', (ev) => {
    const flow = getFormFlowState();
    flow.targetManagerName = ev.target.value || '';
  });
  flowEmailInput?.addEventListener('input', (ev) => {
    const flow = getFormFlowState();
    flow.targetManagerEmail = ev.target.value || '';
  });
  flowRequesterNameInput?.addEventListener('input', (ev) => {
    const flow = getFormFlowState();
    flow.requesterManagerName = ev.target.value || '';
  });
  flowRequesterEmailInput?.addEventListener('input', (ev) => {
    const flow = getFormFlowState();
    flow.requesterManagerEmail = ev.target.value || '';
  });
  root.querySelectorAll('[data-omega-cancel-dismiss]')?.forEach((btn) => {
    btn.addEventListener('click', () => dismissTicketCancelDialog());
  });
  const cancelOverlay = root.querySelector('[data-omega-cancel-close]');
  cancelOverlay?.addEventListener('click', () => dismissTicketCancelDialog());
  const cancelConfirm = root.querySelector('[data-omega-cancel-confirm]');
  cancelConfirm?.addEventListener('click', () => confirmTicketCancel());

  const bulkBtn = root.querySelector('#omega-bulk-status');
  bulkBtn?.addEventListener('click', () => {
    const user = getCurrentUser();
    if (!shouldAllowSelection(user)) return;
    if (!getSelection().size) return;
    omegaState.bulkPanelOpen = !omegaState.bulkPanelOpen;
    renderOmega();
  });

  const bulkClose = root.querySelector('#omega-bulk-close');
  bulkClose?.addEventListener('click', () => {
    omegaState.bulkPanelOpen = false;
    renderOmega();
  });

  const bulkCancel = root.querySelector('#omega-bulk-cancel');
  bulkCancel?.addEventListener('click', () => {
    omegaState.bulkPanelOpen = false;
    renderOmega();
  });

  const bulkStatusSelect = root.querySelector('#omega-bulk-status-select');
  bulkStatusSelect?.addEventListener('change', (ev) => {
    omegaState.bulkStatus = ev.target.value || '';
  });

  const bulkForm = root.querySelector('#omega-bulk-form');
  bulkForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const status = root.querySelector('#omega-bulk-status-select')?.value || '';
    handleBulkStatusSubmit(status);
  });

  const ticketUpdateForm = root.querySelector('#omega-ticket-update-form');
  ticketUpdateForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    handleTicketUpdateSubmit(ticketUpdateForm);
  });

  const ticketUpdateReset = root.querySelector('#omega-ticket-update-reset');
  ticketUpdateReset?.addEventListener('click', () => {
    const ticket = OMEGA_TICKETS.find((item) => item.id === omegaState.selectedTicketId);
    if (!ticket) return;
    initializeTicketUpdateDraft(ticket);
    const modal = root.querySelector('#omega-ticket-modal');
    configureTicketActions(modal, ticket, getCurrentUser());
  });

  const manageAnalystForm = root.querySelector('#omega-manage-analyst-form');
  manageAnalystForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    handleManageAnalystSubmit(manageAnalystForm);
  });
  const manageAnalystSelect = root.querySelector('#omega-manage-analyst-select');
  manageAnalystSelect?.addEventListener('change', (ev) => {
    omegaState.manageAnalystId = ev.target.value || null;
    populateManageAnalystModal(root, getCurrentUser());
  });

  const manageStatusForm = root.querySelector('#omega-manage-status-form');
  manageStatusForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    handleManageStatusSubmit(manageStatusForm);
  });
  const manageStatusDepartment = root.querySelector('#omega-manage-status-department');
  manageStatusDepartment?.addEventListener('change', (ev) => {
    if (!omegaState.manageStatus || typeof omegaState.manageStatus !== 'object') {
      omegaState.manageStatus = { departmentId: '', statusId: '' };
    }
    omegaState.manageStatus.departmentId = ev.target.value || '';
    omegaState.manageStatus.statusId = '';
    populateManageStatusModal(root, getCurrentUser());
  });
  const manageStatusSelect = root.querySelector('#omega-manage-status-select');
  manageStatusSelect?.addEventListener('change', (ev) => {
    if (!omegaState.manageStatus || typeof omegaState.manageStatus !== 'object') {
      omegaState.manageStatus = { departmentId: '', statusId: '' };
    }
    omegaState.manageStatus.statusId = ev.target.value || '';
    populateManageStatusModal(root, getCurrentUser());
  });

  const ticketComment = root.querySelector('#omega-ticket-update-comment');
  ticketComment?.addEventListener('input', (ev) => {
    if (!omegaState.ticketUpdate) omegaState.ticketUpdate = {};
    omegaState.ticketUpdate.comment = ev.target.value || '';
  });

  const ticketStatusSelect = root.querySelector('#omega-ticket-update-status');
  ticketStatusSelect?.addEventListener('change', (ev) => {
    if (!omegaState.ticketUpdate) omegaState.ticketUpdate = {};
    omegaState.ticketUpdate.status = ev.target.value || '';
  });

  const ticketPrioritySelect = root.querySelector('#omega-ticket-update-priority');
  ticketPrioritySelect?.addEventListener('change', (ev) => {
    if (!omegaState.ticketUpdate) omegaState.ticketUpdate = {};
    omegaState.ticketUpdate.priority = ev.target.value || '';
  });

  const ticketQueueSelect = root.querySelector('#omega-ticket-update-queue');
  ticketQueueSelect?.addEventListener('change', (ev) => {
    if (!omegaState.ticketUpdate) omegaState.ticketUpdate = {};
    omegaState.ticketUpdate.queue = ev.target.value || '';
    refreshTicketUpdateOwners(root);
    refreshTicketUpdateCategories(root);
  });

  const ticketOwnerSelect = root.querySelector('#omega-ticket-update-owner');
  ticketOwnerSelect?.addEventListener('change', (ev) => {
    if (!omegaState.ticketUpdate) omegaState.ticketUpdate = {};
    omegaState.ticketUpdate.owner = ev.target.value || '';
  });

  const ticketCategorySelect = root.querySelector('#omega-ticket-update-category');
  ticketCategorySelect?.addEventListener('change', (ev) => {
    if (!omegaState.ticketUpdate) omegaState.ticketUpdate = {};
    omegaState.ticketUpdate.category = ev.target.value || '';
  });

  const ticketDueInput = root.querySelector('#omega-ticket-update-due');
  ticketDueInput?.addEventListener('change', (ev) => {
    if (!omegaState.ticketUpdate) omegaState.ticketUpdate = {};
    omegaState.ticketUpdate.due = ev.target.value || '';
  });

  const ticketAddFileBtn = root.querySelector('[data-omega-ticket-add-file]');
  const ticketFileInput = root.querySelector('#omega-ticket-update-file');
  const ticketAttachmentList = root.querySelector('#omega-ticket-update-attachments');
  ticketAddFileBtn?.addEventListener('click', () => {
    ticketFileInput?.click();
  });
  ticketFileInput?.addEventListener('change', () => {
    const modal = root.querySelector('#omega-ticket-modal');
    addTicketUpdateAttachments(modal, ticketFileInput.files);
    try {
      ticketFileInput.value = '';
    } catch (err) {
      /* noop */
    }
  });
  ticketAttachmentList?.addEventListener('click', (ev) => {
    const btn = ev.target.closest?.('[data-omega-remove-update-attachment]');
    if (!btn) return;
    const id = btn.dataset.omegaRemoveUpdateAttachment;
    if (!id) return;
    const modal = root.querySelector('#omega-ticket-modal');
    removeTicketUpdateAttachment(modal, id);
  });

  const cancelTicketBtn = root.querySelector('#omega-ticket-cancel');
  cancelTicketBtn?.addEventListener('click', () => {
    handleTicketCancel();
  });

  const filterToggle = root.querySelector('#omega-filters-toggle');
  const filterForm = root.querySelector('#omega-filter-form');
  const clearFiltersBtn = root.querySelector('#omega-clear-filters');
  filterToggle?.addEventListener('click', () => {
    toggleFilterPanel();
  });
  filterForm?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    resetTablePage();
    applyFiltersFromForm(root);
  });
  clearFiltersBtn?.addEventListener('click', () => {
    resetAdvancedFilters();
    syncFilterFormState(root);
    resetTablePage();
    renderOmega();
  });
  const filterDepartmentSelect = root.querySelector('#omega-filter-department');
  filterDepartmentSelect?.addEventListener('change', () => {
    const department = filterDepartmentSelect.value || '';
    const typeSelect = root.querySelector('#omega-filter-type');
    const currentType = typeSelect?.value || '';
    populateFilterTypeOptions(root, { department, selected: currentType, preserveSelected: false });
  });

  const userSelect = root.querySelector('#omega-user-select');
  userSelect?.addEventListener('change', (ev) => {
    const nextId = ev.target.value || null;
    if (!nextId) return;
    if (nextId === omegaState.currentUserId) return;
    omegaState.currentUserId = nextId;
    enforceViewForRole();
    omegaState.selectedTicketId = null;
    resetAdvancedFilters();
    setFilterPanelOpen(false);
    clearSelection();
    omegaState.bulkPanelOpen = false;
    resetTablePage();
    renderOmega();
    populateFormOptions(root);
  });

  populateUserSelect(root);
  populateFormOptions(root);

  document.addEventListener('click', handleOmegaDocumentClick, true);

  document.addEventListener('keydown', handleOmegaKeydown);

  omegaInitialized = true;
}

function handleOmegaKeydown(ev){
  const root = document.getElementById('omega-modal');
  if (!root || root.hidden) return;
  if (ev.key === 'Escape') {
    if (omegaState.cancelDialogOpen) {
      dismissTicketCancelDialog();
      ev.stopPropagation();
    } else if (omegaState.manageStatusOpen) {
      setManageStatusOpen(false);
      ev.stopPropagation();
    } else if (omegaState.manageAnalystOpen) {
      setManageAnalystOpen(false);
      ev.stopPropagation();
    } else if (omegaState.drawerOpen) {
      setDrawerOpen(false);
      ev.stopPropagation();
    } else if (omegaState.ticketModalOpen) {
      setTicketModalOpen(false);
      ev.stopPropagation();
    } else if (omegaState.notificationPanelOpen) {
      setNotificationPanelOpen(false);
      ev.stopPropagation();
    } else if (omegaState.filterPanelOpen) {
      toggleFilterPanel(false);
      ev.stopPropagation();
    } else {
      closeOmega();
      ev.stopPropagation();
    }
  }
}

function handleOmegaDocumentClick(ev){
  const root = document.getElementById('omega-modal');
  if (!root || root.hidden) return;

  if (omegaState.notificationPanelOpen) {
    const notificationPanel = root.querySelector('#omega-notification-panel');
    const notificationButton = root.querySelector('#omega-notifications');
    const panelVisible = notificationPanel && !notificationPanel.hidden;
    const insidePanel = panelVisible && typeof notificationPanel.contains === 'function' && notificationPanel.contains(ev.target);
    const clickedButton = notificationButton && typeof notificationButton.contains === 'function'
      && notificationButton.contains(ev.target);
    if (panelVisible && !insidePanel && !clickedButton) {
      setNotificationPanelOpen(false);
    }
  }

  if (!omegaState.filterPanelOpen) return;
  const panel = root.querySelector('#omega-filter-panel');
  const toggle = root.querySelector('#omega-filters-toggle');
  if (!panel || panel.hidden) return;
  const clickedInsidePanel = typeof panel.contains === 'function' && panel.contains(ev.target);
  const clickedToggle = toggle && typeof toggle.contains === 'function' && toggle.contains(ev.target);
  if (clickedInsidePanel || clickedToggle) return;
  toggleFilterPanel(false);
}

function getTicketsPerPage(){
  const raw = parseInt(omegaState.ticketsPerPage, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
}

function resetTablePage(){
  omegaState.tablePage = 1;
}

function goToTablePage(page){
  const target = Number.parseInt(page, 10);
  const next = Number.isFinite(target) && target > 0 ? target : 1;
  if (next === omegaState.tablePage) return false;
  omegaState.tablePage = next;
  return true;
}

function buildPaginationSequence(current, total){
  if (!Number.isFinite(total) || total <= 0) return [];
  const safeTotal = Math.max(1, Math.floor(total));
  const safeCurrent = Math.min(Math.max(1, Math.floor(current || 1)), safeTotal);
  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, index) => ({ type: 'page', value: index + 1 }));
  }
  const sequence = [];
  sequence.push({ type: 'page', value: 1 });
  const start = Math.max(2, safeCurrent - 1);
  const end = Math.min(safeTotal - 1, safeCurrent + 1);
  if (start > 2) sequence.push({ type: 'gap' });
  for (let page = start; page <= end; page += 1) {
    sequence.push({ type: 'page', value: page });
  }
  if (end < safeTotal - 1) sequence.push({ type: 'gap' });
  sequence.push({ type: 'page', value: safeTotal });
  return sequence;
}

function renderOmega(){
  const root = document.getElementById('omega-modal');
  if (!root || root.hidden) return;
  applySidebarState(root);
  const user = getCurrentUser();
  const navStructure = ensureValidViewForUser(user);
  expandNavForView(omegaState.view);
  reconcileFiltersForUser(user);
  const contextTickets = filterTicketsByContext();
  const viewTicketsBase = filterTicketsByView(contextTickets, user);
  const filteredTickets = applyStatusAndSearch(viewTicketsBase);
  const pageSize = getTicketsPerPage();
  let currentPage = Number.isFinite(omegaState.tablePage) && omegaState.tablePage > 0
    ? Math.floor(omegaState.tablePage)
    : 1;
  if (filteredTickets.length) {
    const selectedIndex = filteredTickets.findIndex((ticket) => ticket.id === omegaState.selectedTicketId);
    if (selectedIndex >= 0) {
      const targetPage = Math.floor(selectedIndex / pageSize) + 1;
      currentPage = targetPage;
    }
  }
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  omegaState.tablePage = currentPage;
  const pageStart = (currentPage - 1) * pageSize;
  const pageTickets = filteredTickets.slice(pageStart, pageStart + pageSize);
  const selectionAllowed = shouldAllowSelection(user);
  if (!selectionAllowed && getSelection().size) {
    clearSelection();
    omegaState.bulkPanelOpen = false;
  }

  renderProfile(root, user);
  renderNotificationCenter(root);
  renderNav(root, user, navStructure);
  renderBreadcrumb(root, user);
  renderContextBar(root, omegaState.contextDetail, contextTickets);
  updateFilterButtonState(root);
  if (omegaState.filterPanelOpen) {
    populateFilterPanelOptions(root);
    syncFilterFormState(root);
  }
  renderSummary(root, contextTickets, filteredTickets, user);
  renderTable(root, pageTickets, user);
  renderPagination(root, {
    page: currentPage,
    pageSize,
    totalItems: filteredTickets.length,
    totalPages,
  });
  renderTicketModal(root, filteredTickets, viewTicketsBase, user);
  renderBulkControls(root, user, filteredTickets);
  updateEmptyState(root, filteredTickets);
  renderFormFlowExtras(root);
  renderCancelDialog(root);
  if (omegaState.manageAnalystOpen) populateManageAnalystModal(root, user);
  if (omegaState.manageStatusOpen) populateManageStatusModal(root, user);
}

function renderProfile(root, user){
  const avatar = root.querySelector('#omega-avatar');
  const nameLabel = root.querySelector('#omega-user-name');
  if (avatar) {
    const hasAvatar = Boolean(user?.avatar);
    if (hasAvatar) {
      avatar.src = user.avatar;
      avatar.alt = user?.name ? `Foto de ${user.name}` : '';
      avatar.hidden = false;
    } else {
      avatar.removeAttribute('src');
      avatar.alt = '';
      avatar.hidden = true;
    }
  }
  if (nameLabel) nameLabel.textContent = user?.name || '—';
  const select = root.querySelector('#omega-user-select');
  if (select && select.value !== user?.id) select.value = user?.id || '';
}

function getUnreadNotificationCount(){
  if (!Array.isArray(omegaState.notifications)) return 0;
  return omegaState.notifications.reduce((count, item) => count + (!item.read ? 1 : 0), 0);
}

function markNotificationsAsRead(){
  if (!Array.isArray(omegaState.notifications)) return;
  let updated = false;
  omegaState.notifications.forEach((notification) => {
    if (!notification.read) {
      notification.read = true;
      updated = true;
    }
  });
  if (!updated) return;
  OMEGA_NOTIFICATION_FACT = OMEGA_NOTIFICATION_FACT.map((record) => {
    if (!record || record.read) return record;
    const hasMatch = omegaState.notifications.some((notification) => notification.id === record.id);
    return hasMatch ? { ...record, read: true } : record;
  });
}

function setNotificationPanelOpen(open){
  omegaState.notificationPanelOpen = !!open;
  if (omegaState.notificationPanelOpen) {
    markNotificationsAsRead();
  }
  const root = document.getElementById('omega-modal');
  if (root) renderNotificationCenter(root);
}

function toggleNotificationPanel(force){
  const next = typeof force === 'boolean' ? force : !omegaState.notificationPanelOpen;
  setNotificationPanelOpen(next);
}

function renderNotificationCenter(root){
  if (!root) return;
  const button = root.querySelector('#omega-notifications');
  const badge = root.querySelector('#omega-notification-badge');
  const panel = root.querySelector('#omega-notification-panel');
  const list = root.querySelector('#omega-notification-list');
  const empty = root.querySelector('#omega-notification-empty');
  const notifications = Array.isArray(omegaState.notifications) ? omegaState.notifications : [];
  const unread = getUnreadNotificationCount();
  if (badge) {
    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : String(unread);
      badge.hidden = false;
    } else {
      badge.textContent = '0';
      badge.hidden = true;
    }
  }
  if (button) button.setAttribute('aria-expanded', omegaState.notificationPanelOpen ? 'true' : 'false');
  if (panel) panel.hidden = !omegaState.notificationPanelOpen;
  if (list) {
    if (notifications.length) {
      list.innerHTML = notifications.map((notification) => {
        const classes = ['omega-notification-item'];
        if (!notification.read) classes.push('omega-notification-item--unread');
        const ticket = OMEGA_TICKETS.find((item) => item.id === notification.ticketId) || null;
        const subject = ticket?.subject || notification.ticketSubject || `Chamado ${notification.ticketId}`;
        const actor = resolveUserName(notification.actorId);
        const actorLabel = actor && actor !== '—' ? actor : 'Equipe Omega';
        const time = formatDateTime(notification.date, { withTime: true });
        const statusLabel = OMEGA_STATUS_META[notification.status]?.label || notification.status || '';
        let title = `Atualização • ${subject}`;
        let message = notification.action || '';
        if (notification.type === 'comentario') {
          title = `Novo comentário • ${subject}`;
          message = notification.comment || notification.action || 'Comentário registrado.';
        } else if (notification.type === 'status') {
          title = `Status atualizado • ${subject}`;
          message = notification.action || (statusLabel ? `Status atualizado para ${statusLabel}.` : 'Status atualizado.');
          if (notification.comment) {
            message = `${message} ${notification.comment}`.trim();
          }
        } else if (notification.type === 'aprovacao') {
          title = `Aprovação registrada • ${subject}`;
          message = notification.action || 'Aprovação registrada.';
          if (notification.comment) {
            message = `${message} ${notification.comment}`.trim();
          }
        }
        const metaParts = [];
        if (actorLabel) metaParts.push(actorLabel);
        if (time && time !== '—') metaParts.push(time);
        const meta = metaParts.join(' • ');
        return `<li class="${classes.join(' ')}">`
          + `<span class="omega-notification-item__title">${escapeHTML(title)}</span>`
          + `<p class="omega-notification-item__message">${escapeHTML(message)}</p>`
          + (meta ? `<span class="omega-notification-item__meta">${escapeHTML(meta)}</span>` : '')
          + `</li>`;
      }).join('');
    } else {
      list.innerHTML = '';
    }
  }
  if (empty) empty.hidden = notifications.length > 0;
}

function findNavEntry(viewId){
  for (const item of OMEGA_NAV_ITEMS){
    if (item.id === viewId) return { entry: item, parent: null };
    if (Array.isArray(item.children)){
      const child = item.children.find((option) => option.id === viewId);
      if (child) return { entry: child, parent: item };
    }
  }
  return null;
}

function renderBreadcrumb(root, user){
  const host = root.querySelector('#omega-breadcrumb');
  if (!host) return;
  const info = findNavEntry(omegaState.view);
  const viewLabel = info?.entry?.label || 'Visão atual';
  const parentLabel = info?.parent?.label;
  const userLabel = user?.name || 'Usuário';
  const pieces = [
    `<span class="omega-breadcrumb__item"><i class="ti ti-user"></i>${escapeHTML(userLabel)}</span>`,
  ];
  if (parentLabel && parentLabel !== viewLabel){
    pieces.push('<span class="omega-breadcrumb__sep"><i class="ti ti-chevron-right"></i></span>');
    pieces.push(`<span class="omega-breadcrumb__item">${escapeHTML(parentLabel)}</span>`);
  }
  pieces.push('<span class="omega-breadcrumb__sep"><i class="ti ti-chevron-right"></i></span>');
  pieces.push(`<span class="omega-breadcrumb__item">${escapeHTML(viewLabel)}</span>`);
  host.innerHTML = pieces.join('');
}

function getNavStructureForUser(user){
  const role = user?.role || 'usuario';
  return OMEGA_NAV_ITEMS
    .filter((item) => Array.isArray(item.roles) && item.roles.includes(role))
    .map((item) => {
      const children = Array.isArray(item.children)
        ? item.children.filter((child) => {
            const roles = Array.isArray(child.roles) ? child.roles : item.roles;
            return Array.isArray(roles) && roles.includes(role);
          })
        : [];
      return { ...item, children };
    });
}

function getAccessibleViewIdsFromNav(structure){
  const views = [];
  (structure || []).forEach((item) => {
    views.push(item.id);
    if (Array.isArray(item.children)) {
      item.children.forEach((child) => views.push(child.id));
    }
  });
  return views;
}

function ensureValidViewForUser(user){
  const structure = getNavStructureForUser(user);
  const accessible = getAccessibleViewIdsFromNav(structure);
  if (!accessible.includes(omegaState.view)) {
    omegaState.view = accessible[0] || 'my';
  }
  return structure;
}

function renderNav(root, user, structure){
  const nav = root.querySelector('#omega-nav');
  if (!nav) return;
  const collapsed = !!omegaState.sidebarCollapsed;
  nav.dataset.collapsed = collapsed ? 'true' : 'false';
  const openSet = getOpenNavSet();
  const available = Array.isArray(structure) ? structure : ensureValidViewForUser(user);
  const markup = available.map((item) => {
    const children = Array.isArray(item.children) ? item.children : [];
    const hasChildren = children.length > 0;
    const parentActive = item.id === omegaState.view || children.some((child) => child.id === omegaState.view);
    const expanded = hasChildren && (openSet.has(item.id) || parentActive);
    const childMarkup = hasChildren && expanded
      ? `<div class="omega-nav__submenu">${children.map((child) => {
          const icon = child.icon || item.icon;
          const childActive = child.id === omegaState.view;
          const childClass = `omega-nav__item omega-nav__item--sub${childActive ? ' is-active' : ''}`;
          const childLabel = escapeHTML(child.label);
          const childAttrs = [
            'type="button"',
            `class="${childClass}"`,
            `data-view="${child.id}"`,
            `aria-label="${childLabel}"`,
            `data-parent="${item.id}"`,
          ];
          if (collapsed) childAttrs.push(`title="${childLabel}"`);
          return `<button ${childAttrs.join(' ')}><i class="${icon}"></i><span>${childLabel}</span></button>`;
        }).join('')}</div>`
      : '';
    const parentClasses = `omega-nav__item${hasChildren ? ' omega-nav__item--parent' : ''}${parentActive ? ' is-active' : ''}`;
    const parentLabel = escapeHTML(item.label);
    const parentAttrs = [
      'type="button"',
      `class="${parentClasses}"`,
      `data-view="${item.id}"`,
      `aria-label="${parentLabel}"`,
      `data-has-children="${hasChildren ? 'true' : 'false'}"`,
    ];
    if (hasChildren) parentAttrs.push(`aria-expanded="${expanded ? 'true' : 'false'}"`);
    if (collapsed) parentAttrs.push(`title="${parentLabel}"`);
    const parentButton = `<button ${parentAttrs.join(' ')}><i class="${item.icon}"></i><span>${parentLabel}</span></button>`;
    return `<div class="omega-nav__block">${parentButton}${childMarkup}</div>`;
  }).join('');
  nav.innerHTML = markup;
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

function populateFilterPanelOptions(root){
  if (!root) return;
  const departmentSelect = root.querySelector('#omega-filter-department');
  if (departmentSelect) {
    const user = getCurrentUser();
    const available = getAvailableDepartmentsForUser(user);
    const departments = available.length ? available : [...OMEGA_QUEUE_OPTIONS];
    const options = ['<option value="">Todos os departamentos</option>'];
    departments.forEach((dept) => {
      options.push(`<option value="${escapeHTML(dept)}">${escapeHTML(dept)}</option>`);
    });
    departmentSelect.innerHTML = options.join('');
    const selected = (omegaState.filters.departments || []).filter((dept) => departments.includes(dept));
    departmentSelect.value = selected[0] || '';
  }
  const typeSelect = root.querySelector('#omega-filter-type');
  if (typeSelect) {
    const department = root.querySelector('#omega-filter-department')?.value || '';
    populateFilterTypeOptions(root, { department, selected: omegaState.filters.type || '' });
  }
  const prioritySelect = root.querySelector('#omega-filter-priority');
  if (prioritySelect) {
    const current = omegaState.filters.priority || '';
    const options = ['<option value="">Todas</option>'];
    Object.entries(OMEGA_PRIORITY_META).forEach(([value, meta]) => {
      options.push(`<option value="${value}">${escapeHTML(meta.label)}</option>`);
    });
    prioritySelect.innerHTML = options.join('');
    prioritySelect.value = current;
  }
  const statusHost = root.querySelector('#omega-filter-status');
  if (statusHost) {
    const selected = Array.isArray(omegaState.filters.statuses) ? omegaState.filters.statuses : [];
    const statuses = OMEGA_STATUS_ORDER.filter((status) => status !== 'todos');
    statusHost.innerHTML = statuses.map((status) => {
      const meta = OMEGA_STATUS_META[status] || { label: status };
      const checked = selected.includes(status);
      const checkedAttr = checked ? ' data-checked="true"' : '';
      const inputChecked = checked ? ' checked' : '';
      return `<label class="omega-filter-status__option"${checkedAttr}><input type="checkbox" value="${status}"${inputChecked}/><span>${escapeHTML(meta.label)}</span></label>`;
    }).join('');
  }
}

function populateFilterTypeOptions(root, { department = '', selected = '', preserveSelected = true } = {}){
  if (!root) return;
  const typeSelect = root.querySelector('#omega-filter-type');
  if (!typeSelect) return;
  const categoriesSource = department ? getTicketTypesForDepartment(department) : getAllTicketCategories();
  const categorySet = new Set((categoriesSource || []).filter(Boolean));
  if (preserveSelected && selected) categorySet.add(selected);
  const options = ['<option value="">Todos os tipos</option>'];
  Array.from(categorySet).forEach((category) => {
    options.push(`<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`);
  });
  typeSelect.innerHTML = options.join('');
  if (selected && categorySet.has(selected)) {
    typeSelect.value = selected;
  } else {
    typeSelect.value = '';
  }
}

function getAllTicketCategories(){
  const categories = new Set();
  Object.values(OMEGA_TICKET_TYPES_BY_DEPARTMENT || {}).forEach((list) => {
    if (Array.isArray(list)) {
      list.forEach((item) => { if (item) categories.add(item); });
    }
  });
  OMEGA_TICKETS.forEach((ticket) => {
    if (ticket?.category) categories.add(ticket.category);
  });
  return Array.from(categories);
}

function syncFilterFormState(root){
  if (!root) return;
  const filters = omegaState.filters || {};
  const idInput = root.querySelector('#omega-filter-id');
  if (idInput) idInput.value = filters.id || '';
  const userInput = root.querySelector('#omega-filter-user');
  if (userInput) userInput.value = filters.requester || '';
  const fromInput = root.querySelector('#omega-filter-from');
  if (fromInput) fromInput.value = filters.openedFrom || '';
  const toInput = root.querySelector('#omega-filter-to');
  if (toInput) toInput.value = filters.openedTo || '';
  const prioritySelect = root.querySelector('#omega-filter-priority');
  if (prioritySelect) prioritySelect.value = filters.priority || '';
  const departmentSelect = root.querySelector('#omega-filter-department');
  if (departmentSelect) {
    const selected = Array.isArray(filters.departments) ? filters.departments[0] || '' : '';
    departmentSelect.value = selected;
  }
  populateFilterTypeOptions(root, { department: departmentSelect?.value || '', selected: filters.type || '' });
  const statusHost = root.querySelector('#omega-filter-status');
  if (statusHost) {
    const selected = Array.isArray(filters.statuses) ? filters.statuses : [];
    statusHost.querySelectorAll('.omega-filter-status__option').forEach((option) => {
      const input = option.querySelector('input[type="checkbox"]');
      if (!input) return;
      const checked = selected.includes(input.value);
      input.checked = checked;
      option.dataset.checked = checked ? 'true' : 'false';
    });
  }
}

function applyFiltersFromForm(root){
  if (!root) return;
  const form = root.querySelector('#omega-filter-form');
  if (!form) return;
  const id = form.querySelector('#omega-filter-id')?.value?.trim() || '';
  const requester = form.querySelector('#omega-filter-user')?.value?.trim() || '';
  const type = form.querySelector('#omega-filter-type')?.value || '';
  const priority = form.querySelector('#omega-filter-priority')?.value || '';
  const statuses = Array.from(form.querySelectorAll('#omega-filter-status input[type="checkbox"]:checked'))
    .map((input) => input.value)
    .filter(Boolean);
  const departmentValue = form.querySelector('#omega-filter-department')?.value || '';
  const departments = departmentValue ? [departmentValue] : [];
  const openedFrom = form.querySelector('#omega-filter-from')?.value || '';
  const openedTo = form.querySelector('#omega-filter-to')?.value || '';
  omegaState.filters = {
    id,
    requester,
    type,
    priority,
    statuses,
    departments,
    openedFrom,
    openedTo,
  };
  resetTablePage();
  toggleFilterPanel(false);
  renderOmega();
}

function resetAdvancedFilters(){
  omegaState.filters = {
    id: '',
    requester: '',
    type: '',
    statuses: [],
    departments: [],
    openedFrom: '',
    openedTo: '',
    priority: '',
  };
  resetTablePage();
}

function reconcileFiltersForUser(user){
  const available = getAvailableDepartmentsForUser(user);
  if (!Array.isArray(available) || !omegaState.filters) return;
  const current = Array.isArray(omegaState.filters.departments) ? omegaState.filters.departments : [];
  const filtered = current.filter((dept) => available.includes(dept));
  const normalized = filtered.slice(0, 1);
  if (normalized.length !== current.length || normalized[0] !== current[0]) {
    omegaState.filters.departments = normalized;
  }
}

function hasActiveFilters(){
  const filters = omegaState.filters || {};
  if (filters.id) return true;
  if (filters.requester) return true;
  if (filters.type) return true;
  if (filters.priority) return true;
  if (Array.isArray(filters.statuses) && filters.statuses.length) return true;
  if (filters.openedFrom || filters.openedTo) return true;
  if (Array.isArray(filters.departments) && filters.departments.length) return true;
  return false;
}

function updateFilterButtonState(root){
  if (!root) return;
  const button = root.querySelector('#omega-filters-toggle');
  if (!button) return;
  button.dataset.active = hasActiveFilters() ? 'true' : 'false';
}

function renderSummary(root, contextTickets, viewTickets, user){
  const host = root.querySelector('#omega-summary');
  if (!host) return;
  const summaryStatuses = ['aberto', 'aguardando', 'em_atendimento', 'resolvido', 'cancelado'];
  const fallbackStatusMeta = Object.fromEntries(OMEGA_DEFAULT_STATUSES.map((item) => [item.id, item]));
  const parts = summaryStatuses.map((status) => {
    const meta = OMEGA_STATUS_META[status] || fallbackStatusMeta[status] || { label: status };
    const count = viewTickets.filter((ticket) => ticket.status === status).length;
    return `<div class="omega-summary__item"><strong>${count}</strong><span>${escapeHTML(meta.label)}</span></div>`;
  });
  host.innerHTML = parts.join('');
}

function renderTable(root, tickets, user){
  const body = root.querySelector('#omega-ticket-rows');
  if (!body) return;
  const wrapper = root.querySelector('#omega-table-wrapper');
  const selectionAllowed = shouldAllowSelection(user);
  if (wrapper) wrapper.dataset.selectionEnabled = selectionAllowed ? 'true' : 'false';
  if (!tickets.length) {
    body.innerHTML = '';
    return;
  }
  if (!tickets.some((ticket) => ticket.id === omegaState.selectedTicketId)) {
    omegaState.selectedTicketId = null;
    if (omegaState.ticketModalOpen) setTicketModalOpen(false);
  }
  const selection = getSelection();
  const rows = tickets.map((ticket) => {
    const meta = OMEGA_STATUS_META[ticket.status] || { label: ticket.status, tone: 'neutral' };
    const requesterDisplay = resolveRequesterDisplay(ticket) || '—';
    const ownerName = resolveUserName(ticket.ownerId);
    const resolvedOwner = ownerName && ownerName !== '—' ? ownerName : 'Sem responsável';
    const ownerTooltip = resolvedOwner === 'Sem responsável' ? 'Responsável não atribuído' : `Responsável: ${resolvedOwner}`;
    const priorityKey = OMEGA_PRIORITY_META[ticket.priority] ? ticket.priority : 'media';
    const priorityMeta = OMEGA_PRIORITY_META[priorityKey] || OMEGA_PRIORITY_META.media;
    const categoryLabel = ticket.category || 'Tipo não informado';
    const activeClass = ticket.id === omegaState.selectedTicketId ? ' class="is-active"' : '';
    const isSelected = selectionAllowed && selection.has(ticket.id);
    const selectCell = `<td class="col-select">${selectionAllowed ? `<input type="checkbox" data-omega-select value="${ticket.id}"${isSelected ? ' checked' : ''}/>` : ''}</td>`;
    const selectedAttr = isSelected ? ' data-selected="true"' : '';
    const priorityBadge = `<span class="omega-priority-badge" data-priority="${priorityKey}"><span class="omega-priority-dot" data-priority="${priorityKey}"></span>${escapeHTML(priorityMeta.label)}</span>`;
    return `<tr data-ticket-id="${ticket.id}"${activeClass}${selectedAttr}>
      ${selectCell}
      <td><span class="omega-ticket__id"><i class="ti ti-ticket"></i>${escapeHTML(ticket.id)}</span></td>
      <td><div class="omega-ticket__title">${escapeHTML(ticket.subject)}</div></td>
      <td>${escapeHTML(categoryLabel)}</td>
      <td><div class="omega-ticket__user" title="${escapeHTML(ownerTooltip)}">${escapeHTML(requesterDisplay)}</div></td>
      <td>${priorityBadge}</td>
      <td>${escapeHTML(ticket.product || '—')}</td>
      <td>${escapeHTML(ticket.queue || '—')}</td>
      <td>${formatDateTime(ticket.opened)}</td>
      <td>${formatDateTime(ticket.updated, { withTime: false })}</td>
      <td><span class="omega-status-badge" data-tone="${meta.tone}">${escapeHTML(meta.label)}</span></td>
    </tr>`;
  }).join('');
  body.innerHTML = rows;
}

function renderPagination(root, meta){
  if (!root) return;
  const footer = root.querySelector('.omega-table-footer');
  const nav = root.querySelector('#omega-pagination');
  const rangeLabel = root.querySelector('#omega-table-range');
  if (!footer || !nav || !rangeLabel) return;
  const totalItemsRaw = meta && typeof meta.totalItems === 'number' ? meta.totalItems : 0;
  const pageSizeRaw = meta && typeof meta.pageSize === 'number' ? meta.pageSize : getTicketsPerPage();
  const totalPagesRaw = meta && typeof meta.totalPages === 'number' ? meta.totalPages : Math.ceil(totalItemsRaw / pageSizeRaw);
  const currentPageRaw = meta && typeof meta.page === 'number' ? meta.page : (omegaState.tablePage || 1);
  const totalItems = Math.max(0, totalItemsRaw);
  const pageSize = Math.max(1, pageSizeRaw);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize), Math.floor(totalPagesRaw) || 1);
  const currentPage = Math.min(Math.max(1, Math.floor(currentPageRaw)), totalPages);
  if (!totalItems) {
    footer.hidden = true;
    nav.innerHTML = '';
    rangeLabel.textContent = 'Nenhum chamado encontrado';
    return;
  }
  footer.hidden = false;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, start + pageSize - 1);
  rangeLabel.textContent = `${start} – ${end} de ${totalItems} chamados`;
  const pieces = [];
  const prevDisabled = currentPage <= 1;
  pieces.push(paginationButtonMarkup({
    label: 'Anterior',
    page: currentPage - 1,
    disabled: prevDisabled,
    ariaLabel: 'Página anterior',
  }));
  const sequence = buildPaginationSequence(currentPage, totalPages);
  sequence.forEach((entry) => {
    if (entry.type === 'gap') {
      pieces.push('<span class="omega-pagination__gap">…</span>');
      return;
    }
    const isCurrent = entry.value === currentPage;
    pieces.push(paginationButtonMarkup({
      label: String(entry.value),
      page: entry.value,
      current: isCurrent,
      ariaLabel: `Ir para a página ${entry.value}`,
    }));
  });
  const nextDisabled = currentPage >= totalPages;
  pieces.push(paginationButtonMarkup({
    label: 'Próxima',
    page: currentPage + 1,
    disabled: nextDisabled,
    ariaLabel: 'Próxima página',
  }));
  nav.innerHTML = pieces.join('');
}

function paginationButtonMarkup({ label, page, disabled = false, current = false, ariaLabel = '' }){
  const attrs = ['class="omega-pagination__button"', 'type="button"'];
  if (page != null) attrs.push(`data-omega-page="${page}"`);
  if (ariaLabel) attrs.push(`aria-label="${escapeHTML(ariaLabel)}"`);
  if (current) attrs.push('aria-current="page"');
  if (disabled) attrs.push('disabled');
  return `<button ${attrs.join(' ')}>${escapeHTML(label)}</button>`;
}

function renderTicketModal(root, tickets, baseTickets, user){
  const modal = root.querySelector('#omega-ticket-modal');
  if (!modal) return;
  if (!omegaState.ticketModalOpen || !omegaState.selectedTicketId) {
    modal.hidden = true;
    return;
  }
  const pool = Array.isArray(baseTickets) && baseTickets.length ? baseTickets : tickets;
  const lookup = Array.isArray(pool) ? pool : [];
  const ticket = lookup.find((item) => item.id === omegaState.selectedTicketId)
    || OMEGA_TICKETS.find((item) => item.id === omegaState.selectedTicketId);
  if (!ticket) {
    setTicketModalOpen(false);
    return;
  }

  const statusMeta = OMEGA_STATUS_META[ticket.status] || { label: ticket.status, tone: 'neutral' };
  const priorityMeta = OMEGA_PRIORITY_META[ticket.priority] || OMEGA_PRIORITY_META.media;
  const requesterDisplay = resolveRequesterDisplay(ticket) || '—';
  const requesterMetaValue = resolveUserMeta(ticket.requesterId);
  const requesterMeta = requesterMetaValue && requesterMetaValue !== '—' ? requesterMetaValue : requesterDisplay;
  const ownerResolvedName = resolveUserName(ticket.ownerId);
  const ownerName = ownerResolvedName && ownerResolvedName !== '—' ? ownerResolvedName : 'Sem responsável';
  const ownerMetaValue = resolveUserMeta(ticket.ownerId);
  const ownerMeta = ownerMetaValue && ownerMetaValue !== '—' ? ownerMetaValue : '—';
  const productLabel = ticket.product || '—';
  const queueLabel = ticket.queue ? `Fila ${ticket.queue}` : 'Sem fila atribuída';
  const openedDate = formatDateTime(ticket.opened);
  const openedDateTime = formatDateTime(ticket.opened, { withTime: true });
  const updatedDateTime = formatDateTime(ticket.updated, { withTime: true });
  const dueDateLabel = ticket.dueDate ? formatDateTime(ticket.dueDate) : 'Sem prazo definido';

  const title = modal.querySelector('#omega-ticket-modal-title');
  if (title) title.textContent = `Detalhe do chamado ${ticket.id}`;
  const metaLabel = modal.querySelector('#omega-ticket-modal-meta');
  if (metaLabel) metaLabel.textContent = buildTicketMeta(ticket);
  const idLabel = modal.querySelector('#omega-ticket-id');
  if (idLabel) idLabel.textContent = ticket.id;
  const requesterLabel = modal.querySelector('#omega-ticket-requester');
  if (requesterLabel) requesterLabel.textContent = requesterDisplay;
  const requesterMetaLabel = modal.querySelector('#omega-ticket-requester-meta');
  if (requesterMetaLabel) requesterMetaLabel.textContent = requesterMeta;
  const ownerLabel = modal.querySelector('#omega-ticket-owner');
  if (ownerLabel) ownerLabel.textContent = ownerName;
  const ownerMetaLabel = modal.querySelector('#omega-ticket-owner-meta');
  if (ownerMetaLabel) ownerMetaLabel.textContent = ownerName === 'Sem responsável'
    ? 'Sem responsável'
    : ownerMeta !== '—' ? ownerMeta : 'Sem identificação';
  const productField = modal.querySelector('#omega-ticket-product');
  if (productField) productField.textContent = productLabel;
  const queueField = modal.querySelector('#omega-ticket-queue');
  if (queueField) queueField.textContent = queueLabel;
  const openedField = modal.querySelector('#omega-ticket-opened');
  if (openedField) openedField.textContent = openedDate;
  const openedTimeField = modal.querySelector('#omega-ticket-opened-time');
  if (openedTimeField) openedTimeField.textContent = openedDateTime;
  const statusField = modal.querySelector('#omega-ticket-status');
  if (statusField) statusField.textContent = statusMeta.label;
  const updatedField = modal.querySelector('#omega-ticket-updated');
  if (updatedField) updatedField.textContent = `Última atualização em ${updatedDateTime}`;
  const priorityField = modal.querySelector('#omega-ticket-priority');
  if (priorityField) priorityField.textContent = priorityMeta.label;
  const dueField = modal.querySelector('#omega-ticket-due');
  if (dueField) dueField.textContent = dueDateLabel;

  const descriptionField = modal.querySelector('#omega-ticket-description');
  if (descriptionField) {
    const timeline = Array.isArray(ticket.history) ? [...ticket.history] : [];
    const originEntry = timeline.length
      ? [...timeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
      : null;
    const descriptionParts = [];
    if (originEntry?.action) descriptionParts.push(originEntry.action);
    if (originEntry?.comment && originEntry.comment !== originEntry.action) descriptionParts.push(originEntry.comment);
    descriptionField.innerHTML = descriptionParts.length
      ? descriptionParts.map((part) => `<p>${escapeHTML(part)}</p>`).join('')
      : '<p>Sem observações registradas.</p>';
  }

  const progressHost = modal.querySelector('#omega-ticket-progress');
  if (progressHost) progressHost.innerHTML = buildTicketProgress(ticket.status);

  const timelineHost = modal.querySelector('#omega-ticket-timeline');
  if (timelineHost) timelineHost.innerHTML = buildTicketTimeline(ticket);

  configureTicketActions(modal, ticket, user);

  modal.hidden = false;
}

function renderBulkControls(root, user, tickets){
  const selectionAllowed = shouldAllowSelection(user);
  const selection = getSelection();
  if (selectionAllowed) {
    const visible = new Set((tickets || []).map((ticket) => ticket.id));
    Array.from(selection).forEach((id) => {
      if (!visible.has(id)) selection.delete(id);
    });
  }
  const selectedIds = Array.from(selection);
  const hasSelection = selectionAllowed && selectedIds.length > 0;
  const bulkBtn = root.querySelector('#omega-bulk-status');
  if (bulkBtn) {
    bulkBtn.hidden = !selectionAllowed;
    bulkBtn.disabled = !hasSelection;
  }
  const panel = root.querySelector('#omega-bulk-panel');
  if (!selectionAllowed) {
    omegaState.bulkPanelOpen = false;
    if (panel) panel.hidden = true;
  } else {
    if (!hasSelection) omegaState.bulkPanelOpen = false;
    if (panel) {
      const shouldShow = omegaState.bulkPanelOpen && hasSelection;
      panel.hidden = !shouldShow;
      if (shouldShow) {
        populateBulkStatusOptions(root);
        const hint = panel.querySelector('#omega-bulk-hint');
        if (hint) {
          const count = selectedIds.length;
          hint.textContent = count === 1 ? '1 chamado selecionado' : `${count} chamados selecionados`;
        }
      }
    }
  }
  const selectAll = root.querySelector('#omega-select-all');
  if (selectAll) {
    if (!selectionAllowed || !tickets.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      selectAll.disabled = true;
    } else {
      const selectedCount = tickets.filter((ticket) => selection.has(ticket.id)).length;
      selectAll.disabled = false;
      selectAll.checked = selectedCount > 0 && selectedCount === tickets.length;
      selectAll.indeterminate = selectedCount > 0 && selectedCount < tickets.length;
    }
  }
}

function populateBulkStatusOptions(root){
  const select = root.querySelector('#omega-bulk-status-select');
  if (!select) return;
  const statuses = getOrderedStatuses();
  select.innerHTML = statuses.map((status) => {
    const meta = OMEGA_STATUS_META[status] || { label: status };
    return `<option value="${status}">${escapeHTML(meta.label)}</option>`;
  }).join('');
  const current = omegaState.bulkStatus && statuses.includes(omegaState.bulkStatus)
    ? omegaState.bulkStatus
    : (statuses[0] || '');
  select.value = current;
  omegaState.bulkStatus = current;
}

function configureTicketActions(modal, ticket, user){
  if (!modal) return;
  const section = modal.querySelector('#omega-ticket-actions');
  if (!section) return;
  const canEdit = ['analista', 'supervisor', 'admin'].includes(user?.role);
  const canCancel = user?.id && user.id === ticket.requesterId && !['cancelado', 'resolvido'].includes(ticket.status);
  const advanced = section.querySelector('#omega-ticket-actions-advanced');
  const cancelBtn = section.querySelector('#omega-ticket-cancel');
  const commentInput = section.querySelector('#omega-ticket-update-comment');
  section.hidden = false;
  if (advanced) advanced.hidden = !canEdit;
  if (cancelBtn) {
    cancelBtn.hidden = !canCancel;
    cancelBtn.disabled = !canCancel;
  }
  if (omegaState.ticketUpdateTicketId !== ticket.id) {
    initializeTicketUpdateDraft(ticket);
  }
  if (!omegaState.ticketUpdate) resetTicketUpdateState();
  const draft = omegaState.ticketUpdate;
  if (!draft.status) draft.status = ticket.status || (getOrderedStatuses()[0] || 'aberto');
  if (!draft.priority) draft.priority = ticket.priority || 'media';
  if (draft.queue == null) draft.queue = ticket.queue || '';
  if (draft.owner == null) draft.owner = ticket.ownerId || '';
  if (draft.category == null) draft.category = ticket.category || '';
  if (!draft.due) draft.due = formatDateInput(ticket.dueDate);
  if (!Array.isArray(draft.attachments)) draft.attachments = [];

  const statusSelect = section.querySelector('#omega-ticket-update-status');
  if (statusSelect) {
    const statuses = getOrderedStatuses();
    statusSelect.innerHTML = statuses.map((status) => {
      const meta = OMEGA_STATUS_META[status] || { label: status };
      return `<option value="${status}">${escapeHTML(meta.label)}</option>`;
    }).join('');
    if (!statuses.includes(draft.status)) draft.status = statuses[0] || draft.status;
    statusSelect.value = draft.status;
    statusSelect.disabled = !canEdit;
  }

  const prioritySelect = section.querySelector('#omega-ticket-update-priority');
  if (prioritySelect) {
    prioritySelect.innerHTML = Object.entries(OMEGA_PRIORITY_META).map(([value, meta]) => {
      return `<option value="${value}">${escapeHTML(meta.label)}</option>`;
    }).join('');
    if (!Object.prototype.hasOwnProperty.call(OMEGA_PRIORITY_META, draft.priority)) {
      draft.priority = ticket.priority || 'media';
    }
    prioritySelect.value = draft.priority;
    prioritySelect.disabled = !canEdit;
  }

  const queueSelect = section.querySelector('#omega-ticket-update-queue');
  if (queueSelect) {
    const departments = Array.from(new Set([
      ...(getAvailableDepartmentsForUser(user) || []),
      ticket.queue,
    ].filter(Boolean)));
    queueSelect.innerHTML = departments.map((dept) => `<option value="${escapeHTML(dept)}">${escapeHTML(dept)}</option>`).join('');
    if (departments.length && !departments.includes(draft.queue)) {
      draft.queue = ticket.queue && departments.includes(ticket.queue) ? ticket.queue : departments[0];
    }
    queueSelect.value = draft.queue || '';
    queueSelect.disabled = !canEdit;
  }

  refreshTicketUpdateOwners(modal);
  refreshTicketUpdateCategories(modal);

  const dueInput = section.querySelector('#omega-ticket-update-due');
  if (dueInput) {
    dueInput.value = draft.due || '';
    dueInput.disabled = !canEdit;
  }

  if (commentInput && commentInput.value !== draft.comment) {
    commentInput.value = draft.comment || '';
  }

  renderTicketUpdateAttachments(section);
}

function refreshTicketUpdateOwners(root){
  if (!root) return;
  const section = root.querySelector('#omega-ticket-actions');
  if (!section) return;
  const ownerSelect = section.querySelector('#omega-ticket-update-owner');
  const queueSelect = section.querySelector('#omega-ticket-update-queue');
  if (!ownerSelect || !queueSelect) return;
  if (!omegaState.ticketUpdate) omegaState.ticketUpdate = {};
  const draft = omegaState.ticketUpdate;
  const queue = queueSelect.value || '';
  const ticketId = omegaState.ticketUpdateTicketId;
  const ticket = ticketId ? OMEGA_TICKETS.find((item) => item.id === ticketId) : null;
  const user = getCurrentUser();
  const canEdit = ['analista', 'supervisor', 'admin'].includes(user?.role);
  const baseList = canEdit ? getAssignableAnalystsForQueue(queue, user) : [];
  const combined = [...baseList];
  const extras = new Set([ticket?.ownerId, draft.owner].filter(Boolean));
  extras.forEach((id) => {
    if (!combined.some((person) => person.id === id)) {
      const person = OMEGA_USERS.find((entry) => entry.id === id);
      if (person) combined.push(person);
    }
  });
  combined.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const options = [
    { value: '', label: 'Sem responsável' },
    ...combined.map((person) => ({ value: person.id, label: person.name })),
  ];
  ownerSelect.innerHTML = options
    .map((option) => `<option value="${escapeHTML(option.value)}">${escapeHTML(option.label)}</option>`)
    .join('');
  const availableValues = options.map((option) => option.value);
  if (!availableValues.includes(draft.owner || '')) {
    draft.owner = ticket?.ownerId || '';
  }
  ownerSelect.value = draft.owner || '';
  ownerSelect.disabled = !canEdit || !options.length;
}

function refreshTicketUpdateCategories(root){
  if (!root) return;
  const section = root.querySelector('#omega-ticket-actions');
  if (!section) return;
  const categorySelect = section.querySelector('#omega-ticket-update-category');
  const queueSelect = section.querySelector('#omega-ticket-update-queue');
  if (!categorySelect || !queueSelect) return;
  const queue = queueSelect.value || '';
  const ticketId = omegaState.ticketUpdateTicketId;
  const ticket = ticketId ? OMEGA_TICKETS.find((item) => item.id === ticketId) : null;
  if (!omegaState.ticketUpdate) omegaState.ticketUpdate = {};
  const draft = omegaState.ticketUpdate;
  const baseCategories = getTicketTypesForDepartment(queue) || [];
  const options = Array.from(new Set([
    ...baseCategories,
    ticket?.category,
    draft.category,
  ].filter(Boolean)));
  if (!options.length) {
    categorySelect.innerHTML = '<option value="">Tipo não disponível</option>';
    draft.category = '';
    categorySelect.value = '';
  } else {
    categorySelect.innerHTML = options
      .map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`)
      .join('');
    if (!options.includes(draft.category)) {
      draft.category = options[0];
    }
    categorySelect.value = draft.category || '';
  }
  const user = getCurrentUser();
  const canEdit = ['analista', 'supervisor', 'admin'].includes(user?.role);
  categorySelect.disabled = !canEdit || !options.length;
}

function handleTicketUpdateSubmit(form){
  const ticketId = omegaState.selectedTicketId;
  if (!ticketId) return;
  const ticket = OMEGA_TICKETS.find((item) => item.id === ticketId);
  if (!ticket) return;
  const user = getCurrentUser();
  const draft = omegaState.ticketUpdate || {};
  const commentInput = form.querySelector('#omega-ticket-update-comment');
  const comment = commentInput?.value?.trim() || '';
  if (!comment) {
    commentInput?.focus();
    return;
  }
  const canEdit = ['analista', 'supervisor', 'admin'].includes(user?.role);
  const statuses = getOrderedStatuses();
  const newStatus = draft.status && statuses.includes(draft.status) ? draft.status : ticket.status;
  const newPriority = draft.priority && OMEGA_PRIORITY_META[draft.priority] ? draft.priority : ticket.priority;
  const newQueue = draft.queue || ticket.queue;
  const newCategory = draft.category || ticket.category;
  const newDue = draft.due ? `${draft.due}T00:00:00` : null;
  const newOwner = draft.owner ? draft.owner : '';
  const attachments = Array.isArray(draft.attachments) ? draft.attachments : [];
  const now = new Date().toISOString();

  const previousStatus = ticket.status;
  const previousOwner = ticket.ownerId || '';
  if (canEdit) {
    ticket.status = newStatus;
    ticket.priority = newPriority;
    ticket.queue = newQueue;
    ticket.category = newCategory;
    ticket.dueDate = newDue;
    ticket.ownerId = newOwner || null;
  }
  ticket.updated = now;
  if (!Array.isArray(ticket.history)) ticket.history = [];
  const statusMeta = OMEGA_STATUS_META[ticket.status] || { label: ticket.status };
  const statusChanged = canEdit && draft.status && draft.status !== previousStatus;
  const ownerChanged = canEdit && newOwner !== previousOwner;
  let actionLabel = 'Atualização registrada';
  if (statusChanged) {
    actionLabel = `Status atualizado para ${statusMeta.label}`;
  } else if (ownerChanged) {
    const ownerName = resolveUserName(newOwner);
    const ownerLabel = newOwner && ownerName && ownerName !== '—' ? ownerName : 'Sem responsável';
    actionLabel = newOwner ? `Responsável atualizado para ${ownerLabel}` : 'Responsável removido';
  }
  appendTicketHistory(ticket, {
    date: now,
    actorId: user?.id || '',
    action: actionLabel,
    comment,
    status: ticket.status,
    attachments: attachments.map((item) => ({ id: item.id, name: item.name })),
  });
  if (attachments.length) {
    const names = attachments.map((item) => item.name);
    ticket.attachments = Array.isArray(ticket.attachments)
      ? [...ticket.attachments, ...names]
      : [...names];
  }
  initializeTicketUpdateDraft(ticket);
  renderOmega();
  showOmegaToast('Atualização registrada com sucesso.', 'success');
}

function getCancellableTicket(){
  const ticketId = omegaState.selectedTicketId;
  if (!ticketId) return null;
  const ticket = OMEGA_TICKETS.find((item) => item.id === ticketId);
  if (!ticket) return null;
  const user = getCurrentUser();
  if (!user || user.id !== ticket.requesterId) return null;
  if (['cancelado', 'resolvido'].includes(ticket.status)) return null;
  return { ticket, user };
}

function handleTicketCancel(){
  const data = getCancellableTicket();
  if (!data) return;
  omegaState.cancelDialogOpen = true;
  renderOmega();
}

function dismissTicketCancelDialog(){
  if (!omegaState.cancelDialogOpen) return;
  omegaState.cancelDialogOpen = false;
  renderOmega();
}

function confirmTicketCancel(){
  const data = getCancellableTicket();
  omegaState.cancelDialogOpen = false;
  if (!data) {
    renderOmega();
    return;
  }
  const { ticket, user } = data;
  const now = new Date().toISOString();
  ticket.status = 'cancelado';
  ticket.updated = now;
  if (!Array.isArray(ticket.history)) ticket.history = [];
  appendTicketHistory(ticket, {
    date: now,
    actorId: user.id,
    action: 'Chamado cancelado pelo solicitante',
    comment: '',
    status: 'cancelado',
    attachments: [],
  });
  initializeTicketUpdateDraft(ticket);
  renderOmega();
  showOmegaToast('Chamado cancelado.', 'info');
}

function handleBulkStatusSubmit(status){
  const statuses = getOrderedStatuses();
  if (!status || !statuses.includes(status)) return;
  const selection = Array.from(getSelection());
  if (!selection.length) return;
  const user = getCurrentUser();
  const now = new Date().toISOString();
  const statusMeta = OMEGA_STATUS_META[status] || { label: status };
  selection.forEach((id) => {
    const ticket = OMEGA_TICKETS.find((item) => item.id === id);
    if (!ticket) return;
    ticket.status = status;
    ticket.updated = now;
    if (!Array.isArray(ticket.history)) ticket.history = [];
    appendTicketHistory(ticket, {
      date: now,
      actorId: user?.id || '',
      action: `Status atualizado em lote para ${statusMeta.label}`,
      comment: '',
      status,
      attachments: [],
    });
  });
  omegaState.bulkPanelOpen = false;
  renderOmega();
  showOmegaToast(`Status atualizado para ${statusMeta.label}.`, 'success');
}

function buildTicketMeta(ticket){
  const pieces = [];
  const opened = formatDateTime(ticket.opened, { withTime: true });
  if (opened && opened !== '—') pieces.push(`Aberto em ${opened}`);
  if (ticket.queue) pieces.push(`Fila ${ticket.queue}`);
  if (ticket.product) pieces.push(ticket.product);
  return pieces.length ? pieces.join(' • ') : `Chamado ${ticket.id}`;
}

function buildTicketProgress(status){
  const order = getOrderedStatuses();
  const currentIndex = order.indexOf(status);
  return order.map((step, index) => {
    let state = 'pending';
    if (currentIndex === -1) {
      state = index === 0 ? 'current' : 'pending';
    } else if (index < currentIndex) {
      state = 'complete';
    } else if (index === currentIndex) {
      state = 'current';
    }
    const meta = OMEGA_STATUS_META[step] || { label: step };
    return `<li class="omega-progress__step" data-state="${state}"><span class="omega-progress__marker">${index + 1}</span><span class="omega-progress__label">${escapeHTML(meta.label)}</span></li>`;
  }).join('');
}

function renderCancelDialog(root){
  const dialog = root?.querySelector?.('#omega-cancel-dialog');
  if (!dialog) return;
  const open = !!omegaState.cancelDialogOpen;
  dialog.hidden = !open;
  if (!open) return;
  const ticket = OMEGA_TICKETS.find((item) => item.id === omegaState.selectedTicketId) || null;
  const title = dialog.querySelector('#omega-cancel-title');
  const message = dialog.querySelector('#omega-cancel-message');
  const ticketIdEl = dialog.querySelector('#omega-cancel-ticket-id');
  const ticketSubjectEl = dialog.querySelector('#omega-cancel-ticket-subject');
  const ticketStatusEl = dialog.querySelector('#omega-cancel-ticket-status');
  const ticketRequesterEl = dialog.querySelector('#omega-cancel-ticket-requester');
  if (title) {
    title.textContent = ticket ? `Cancelar chamado ${ticket.id}` : 'Cancelar chamado';
  }
  if (message) {
    const subject = ticket?.subject || 'este chamado';
    message.textContent = `Tem certeza de que deseja cancelar ${subject}? Essa ação não poderá ser desfeita.`;
  }
  if (ticketIdEl) {
    ticketIdEl.textContent = ticket?.id ? `#${ticket.id}` : '—';
  }
  if (ticketSubjectEl) {
    ticketSubjectEl.textContent = ticket?.subject || 'Sem assunto';
  }
  if (ticketStatusEl) {
    const statusMeta = ticket?.status ? (OMEGA_STATUS_META[ticket.status] || { label: ticket.status }) : null;
    ticketStatusEl.textContent = statusMeta?.label || '—';
  }
  if (ticketRequesterEl) {
    ticketRequesterEl.textContent = ticket?.requesterId ? resolveUserName(ticket.requesterId) : '—';
  }
  const confirmBtn = dialog.querySelector('[data-omega-cancel-confirm]');
  if (confirmBtn) confirmBtn.disabled = !ticket;
}

function buildTicketTimeline(ticket){
  const entries = Array.isArray(ticket.history) ? [...ticket.history] : [];
  if (!entries.length) {
    return '<li class="omega-timeline__item" data-side="usuario"><div class="omega-timeline__content"><p>Ainda não há histórico registrado.</p></div></li>';
  }
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return entries.map((entry) => {
    const actorName = resolveUserName(entry.actorId);
    const side = resolveTimelineSide(ticket, entry.actorId);
    const statusMeta = OMEGA_STATUS_META[entry.status] || { label: entry.status, tone: 'neutral' };
    const action = entry.action ? `<p>${escapeHTML(entry.action)}</p>` : '';
    const comment = entry.comment ? `<p>${escapeHTML(entry.comment)}</p>` : '';
    const attachments = Array.isArray(entry.attachments) && entry.attachments.length
      ? `<ul class="omega-timeline__attachments">${entry.attachments.map((item) => {
          const name = typeof item === 'string' ? item : (item?.name || 'Arquivo');
          return `<li><i class="ti ti-paperclip"></i>${escapeHTML(name)}</li>`;
        }).join('')}</ul>`
      : '';
    return `<li class="omega-timeline__item" data-side="${side}">
      <div class="omega-timeline__content">
        <div class="omega-timeline__heading"><strong>${escapeHTML(actorName)}</strong><span class="omega-status-badge" data-tone="${statusMeta.tone}">${escapeHTML(statusMeta.label)}</span></div>
        <time datetime="${escapeHTML(entry.date)}">${formatDateTime(entry.date, { withTime: true })}</time>
        ${action}${comment}${attachments}
      </div>
    </li>`;
  }).join('');
}

function resolveTimelineSide(ticket, actorId){
  if (!ticket || !actorId) return 'analista';
  if (actorId === ticket.requesterId) return 'usuario';
  const user = OMEGA_USERS.find((item) => item.id === actorId);
  if (!user) {
    const contact = OMEGA_EXTERNAL_CONTACTS.get(actorId);
    if (contact?.side === 'usuario') return 'usuario';
    return 'analista';
  }
  const isOnlyUser = user.roles?.usuario && !user.roles.analista && !user.roles.supervisor && !user.roles.admin;
  return isOnlyUser ? 'usuario' : 'analista';
}

function openTicketDetail(ticketId){
  if (!ticketId) return;
  omegaState.selectedTicketId = ticketId;
  omegaState.cancelDialogOpen = false;
  setTicketModalOpen(true);
  renderOmega();
}

function updateEmptyState(root, tickets){
  const wrapper = root.querySelector('#omega-table-wrapper');
  if (!wrapper) return;
  wrapper.hidden = false;
  wrapper.dataset.empty = tickets.length ? 'false' : 'true';
}

function getUserQueues(user){
  if (!user) return [];
  return Array.isArray(user.queues) ? user.queues.filter(Boolean) : [];
}

function getManagedQueues(user){
  if (!user) return [];
  if (user.role === 'admin') return [...OMEGA_QUEUE_OPTIONS];
  const queues = getUserQueues(user);
  if (user.roles?.supervisor) {
    return queues.length ? queues : [...OMEGA_QUEUE_OPTIONS];
  }
  return queues;
}

function getManagedDepartments(user){
  const queues = getManagedQueues(user);
  const seen = new Set();
  const departments = [];
  queues.forEach((queue) => {
    if (!queue) return;
    const id = getDepartmentIdByName(queue) || queue;
    if (seen.has(id)) return;
    seen.add(id);
    departments.push({ id: id.toString(), name: queue });
  });
  return departments;
}

function getManagedDepartmentIds(user){
  return getManagedDepartments(user).map((entry) => entry.id).filter(Boolean);
}

function getManageableAnalysts(user){
  if (!user) return [];
  if (user.role === 'usuario') return [];
  const managedQueues = new Set(getManagedQueues(user));
  if (user.role !== 'admin' && !managedQueues.size) return [];
  return OMEGA_USERS.filter((person) => {
    if (!person || person.id === user.id) return false;
    const isAnalyst = !!(person.roles?.analista || person.role === 'analista');
    if (!isAnalyst) return false;
    if (user.role === 'admin') return true;
    const personQueues = Array.isArray(person.queues) ? person.queues : [];
    if (!personQueues.length) return true;
    return personQueues.some((queue) => managedQueues.has(queue));
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function getStatusesForDepartment(departmentId){
  const target = (departmentId || OMEGA_STATUS_GLOBAL_DEPARTMENT).toString();
  const map = new Map();
  OMEGA_STATUS_CATALOG.forEach((entry) => {
    const entryDepartment = (entry.departmentId || OMEGA_STATUS_GLOBAL_DEPARTMENT).toString();
    if (entryDepartment === OMEGA_STATUS_GLOBAL_DEPARTMENT && !map.has(entry.id)) {
      map.set(entry.id, entry);
    }
  });
  OMEGA_STATUS_CATALOG.forEach((entry) => {
    const entryDepartment = (entry.departmentId || OMEGA_STATUS_GLOBAL_DEPARTMENT).toString();
    if (entryDepartment === target) {
      map.set(entry.id, entry);
    }
  });
  return Array.from(map.values());
}

function getUsersByQueues(queues, predicate){
  if (!Array.isArray(queues) || !queues.length) return [];
  const queueSet = new Set(queues);
  return OMEGA_USERS.filter((person) => {
    const personQueues = Array.isArray(person.queues) ? person.queues : [];
    if (!personQueues.some((queue) => queueSet.has(queue))) return false;
    if (typeof predicate === 'function' && !predicate(person)) return false;
    return true;
  }).map((person) => person.id);
}

function getAssignableAnalystsForQueue(queue, user){
  if (!queue) return [];
  const canEdit = ['analista', 'supervisor', 'admin'].includes(user?.role);
  if (!canEdit) return [];
  const candidateIds = getUsersByQueues([queue], (person) => {
    if (!person) return false;
    return !!(person.roles?.analista || person.roles?.supervisor || person.roles?.admin);
  });
  if (user && getUserQueues(user).includes(queue) && !candidateIds.includes(user.id)) {
    candidateIds.push(user.id);
  }
  const uniqueIds = Array.from(new Set(candidateIds));
  return uniqueIds
    .map((id) => OMEGA_USERS.find((person) => person.id === id))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function filterTicketsByContext(){
  if (!omegaState.contextDetail) return [...OMEGA_TICKETS];
  return OMEGA_TICKETS.filter((ticket) => ticketMatchesContext(ticket, omegaState.contextDetail));
}

function filterTicketsByView(tickets, user){
  if (!user) return [...tickets];
  const role = user.role || 'usuario';
  if (role === 'admin') return [...tickets];
  const currentView = normalizeViewId(omegaState.view);
  const queues = getUserQueues(user);
  const queueSet = new Set(queues);
  if (currentView === 'my') {
    return tickets.filter((ticket) => ticket.requesterId === user.id || ticket.ownerId === user.id);
  }
  if (currentView === 'assigned') {
    return tickets.filter((ticket) => ticket.ownerId === user.id);
  }
  if (currentView === 'queue') {
    if (!queues.length) {
      return tickets.filter((ticket) => ticket.ownerId === user.id || (user.teamId && ticket.teamId === user.teamId));
    }
    return tickets.filter((ticket) => {
      if (queueSet.has(ticket.queue)) return true;
      if (ticket.ownerId === user.id) return true;
      if (user.teamId && ticket.teamId === user.teamId) return true;
      return false;
    });
  }
  if (currentView === 'team') {
    const managedQueues = queues.length ? queues : [...OMEGA_QUEUE_OPTIONS];
    const managedSet = new Set(managedQueues);
    const memberIds = new Set(getUsersByQueues(managedQueues));
    const analystIds = new Set(getUsersByQueues(managedQueues, (person) => person.roles?.analista || person.roles?.supervisor));
    return tickets.filter((ticket) => {
      if (ticket.ownerId === user.id) return true;
      if (user.teamId && ticket.teamId === user.teamId) return true;
      if (ticket.queue && managedSet.has(ticket.queue)) return true;
      if (ticket.requesterId && memberIds.has(ticket.requesterId)) return true;
      if (ticket.ownerId && analystIds.has(ticket.ownerId)) return true;
      return false;
    });
  }
  return [...tickets];
}

function applyStatusAndSearch(tickets){
  let output = [...tickets];
  const filters = omegaState.filters || {};
  const statusFilters = Array.isArray(filters.statuses) ? filters.statuses.filter(Boolean) : [];
  if (statusFilters.length) {
    output = output.filter((ticket) => statusFilters.includes(ticket.status));
  }
  output = applyAdvancedFilters(output);
  const term = normalizeText(omegaState.search);
  if (term) {
    output = output.filter((ticket) => matchesSearch(ticket, term));
  }
  output.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
  return output;
}

function applyAdvancedFilters(tickets){
  const filters = omegaState.filters || {};
  const idTerm = normalizeText(filters.id || '');
  const requesterTerm = normalizeText(filters.requester || '');
  const typeTerm = normalizeText(filters.type || '');
  const priorityTerm = (filters.priority || '').trim();
  const departments = Array.isArray(filters.departments) ? filters.departments.filter(Boolean) : [];
  const openedFrom = filters.openedFrom ? new Date(`${filters.openedFrom}T00:00:00`) : null;
  const openedTo = filters.openedTo ? new Date(`${filters.openedTo}T23:59:59`) : null;
  const fromTime = openedFrom && Number.isFinite(openedFrom.getTime()) ? openedFrom.getTime() : null;
  const toTime = openedTo && Number.isFinite(openedTo.getTime()) ? openedTo.getTime() : null;

  return tickets.filter((ticket) => {
    if (idTerm && !normalizeText(ticket.id).includes(idTerm)) return false;
    if (departments.length && !departments.includes(ticket.queue)) return false;
    if (typeTerm && normalizeText(ticket.category) !== typeTerm) return false;
    if (priorityTerm && ticket.priority !== priorityTerm) return false;
    if (requesterTerm) {
      const requesterTokens = [
        normalizeText(resolveRequesterDisplay(ticket)),
        normalizeText(resolveUserName(ticket.requesterId)),
        normalizeText(ticket.requesterId || ''),
      ].filter(Boolean);
      if (!requesterTokens.some((token) => token.includes(requesterTerm))) return false;
    }
    if (fromTime || toTime) {
      const openedTime = ticket.opened ? new Date(ticket.opened).getTime() : NaN;
      if (fromTime && (!Number.isFinite(openedTime) || openedTime < fromTime)) return false;
      if (toTime && (!Number.isFinite(openedTime) || openedTime > toTime)) return false;
    }
    return true;
  });
}

function matchesSearch(ticket, term){
  const values = [
    ticket.id,
    ticket.requesterName,
    ticket.product,
    ticket.queue,
    ticket.subject,
    resolveRequesterDisplay(ticket),
    resolveUserName(ticket.requesterId),
    ticket.requesterId,
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
  expandNavForView(omegaState.view);
}

function getCurrentUser(){
  if (!OMEGA_USERS.length) return null;
  const user = OMEGA_USERS.find((item) => item.id === omegaState.currentUserId) || OMEGA_USERS[0];
  if (user && omegaState.currentUserId !== user.id) {
    omegaState.currentUserId = user.id;
  }
  return user;
}

function resolveUserName(userId){
  if (!userId) return '—';
  const user = OMEGA_USERS.find((item) => item.id === userId);
  if (user?.name) return user.name;
  const contact = OMEGA_EXTERNAL_CONTACTS.get(userId);
  return contact?.name || '—';
}

function resolveUserMeta(userId){
  if (!userId) return '—';
  const user = OMEGA_USERS.find((item) => item.id === userId);
  if (user) {
    const parts = [];
    if (user.position) parts.push(user.position);
    if (user.junction) parts.push(user.junction);
    if (!parts.length) parts.push(getUserRoleLabel(user));
    return parts.join(' • ');
  }
  const contact = OMEGA_EXTERNAL_CONTACTS.get(userId);
  if (!contact) return '—';
  const parts = [];
  if (contact.position) parts.push(contact.position);
  if (contact.agency) parts.push(contact.agency);
  if (contact.email) parts.push(contact.email);
  return parts.join(' • ') || 'Contato externo';
}

function resolveRequesterDisplay(ticket){
  if (!ticket) return '';
  if (ticket.requesterName) return ticket.requesterName;
  const userName = resolveUserName(ticket.requesterId);
  return userName === '—' ? '' : userName;
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
    ticket.requesterName,
    ticket.product,
    ticket.family,
    ticket.section,
    ticket.queue,
    ctx.diretoria,
    ctx.gerencia,
    ctx.agencia,
    ctx.ggestao,
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

function showOmegaToast(message, tone = 'success'){
  if (!message) return;
  const root = document.getElementById('omega-modal');
  if (!root) return;
  const container = root.querySelector('#omega-toast-stack');
  if (!container) return;
  const toneKey = Object.prototype.hasOwnProperty.call(OMEGA_TOAST_ICONS, tone) ? tone : 'info';
  const icon = OMEGA_TOAST_ICONS[toneKey] || OMEGA_TOAST_ICONS.info;
  const toast = document.createElement('div');
  toast.className = `omega-toast omega-toast--${toneKey}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.dataset.visible = 'true';
  });
  const lifetime = 3600;
  window.setTimeout(() => {
    toast.dataset.visible = 'false';
    window.setTimeout(() => {
      if (toast.parentElement === container) toast.remove();
    }, 220);
  }, lifetime);
  while (container.children.length > 3) {
    const first = container.firstElementChild;
    if (!first || first === toast) break;
    first.remove();
  }
}

function createLocalId(prefix = 'id'){
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function normalizePlain(value){
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeToSlug(value){
  return normalizePlain(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function registerExternalContact(id, meta = {}){
  const contactId = id || createLocalId('contact');
  const existing = OMEGA_EXTERNAL_CONTACTS.get(contactId) || {};
  const next = { ...existing };
  if (meta.name) next.name = meta.name;
  if (meta.position) next.position = meta.position;
  if (meta.email) next.email = meta.email;
  if (meta.agency) next.agency = meta.agency;
  if (meta.type) next.type = meta.type;
  if (meta.segment) next.segment = meta.segment;
  if (meta.region) next.region = meta.region;
  if (meta.side) next.side = meta.side;
  if (!next.name) next.name = 'Contato externo';
  if (!next.side) next.side = 'analista';
  OMEGA_EXTERNAL_CONTACTS.set(contactId, next);
  return contactId;
}

function ensureDefaultExternalContacts(){
  registerExternalContact('omega-flow', {
    name: 'Fluxo Omega',
    position: 'Orquestração de processos',
    email: 'omega@omega.com.br',
    type: 'system',
    side: 'analista',
  });
}

function buildCorporateEmail(name, domain = 'omega.com.br'){
  const slug = normalizeToSlug(name).replace(/-/g, '.');
  if (!slug) return '';
  return `${slug}@${domain}`;
}

function isValidEmail(value){
  if (!value) return false;
  const normalized = value.toString().trim();
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function createMesuContactId(type, code, name){
  if (code && String(code).trim()) {
    return `mesu-${type}-${String(code).trim()}`;
  }
  const slug = normalizeToSlug(name);
  if (slug) return `mesu-${type}-${slug}`;
  return createLocalId(`mesu-${type}`);
}

function applyMesuCatalog(rows){
  OMEGA_MESU_DATA = [];
  OMEGA_MESU_BY_AGENCY.clear();
  OMEGA_MESU_BY_MANAGER.clear();
  OMEGA_MESU_BY_GESTAO.clear();
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    if (!row) return;
    const segment = (row.Segmento || row.segmento || '').trim();
    const segmentId = (row['Id Segmento'] || row['ID Segmento'] || '').toString().trim();
    const diretoria = (row['Diretoria Regional'] || row.Diretoria || '').trim();
    const diretoriaId = (row['ID Diretoria'] || row['Id Diretoria'] || '').toString().trim();
    const gerencia = (row['Gerencia Regional'] || row['Gerência Regional'] || row.Gerencia || '').trim();
    const gerenciaId = (row['Id Gerencia Regional'] || row['ID Gerencia Regional'] || '').toString().trim();
    const agencyName = (row.Agencia || row['Agência'] || '').trim();
    const agencyId = (row['Id Agencia'] || row['ID Agencia'] || row['Id Agência'] || '').toString().trim();
    const gestorName = (row['Gerente de Gestao'] || row['Gerente de Gestão'] || '').trim();
    const gestorId = (row['Id Gerente de Gestao'] || row['Id Gerente de Gestão'] || '').toString().trim();
    const managerName = (row.Gerente || '').trim();
    const managerId = (row['Id Gerente'] || '').toString().trim();
    const managerEmail = managerName ? buildCorporateEmail(managerName) : '';
    const record = {
      segment,
      segmentId,
      diretoria,
      diretoriaId,
      gerencia,
      gerenciaId,
      agencyName,
      agencyId,
      managerGestaoName: gestorName,
      managerGestaoId: gestorId,
      managerName,
      managerId,
      managerEmail,
    };
    OMEGA_MESU_DATA.push(record);
    if (agencyName) {
      OMEGA_MESU_BY_AGENCY.set(normalizePlain(agencyName), record);
    }
    if (managerName) {
      OMEGA_MESU_BY_MANAGER.set(normalizePlain(managerName), record);
      const contactId = registerExternalContact(
        createMesuContactId('manager', managerId, managerName),
        {
          name: managerName,
          position: 'Gerente da agência',
          email: managerEmail,
          agency: agencyName,
          segment,
          region: gerencia,
          type: 'manager',
          side: 'analista',
        },
      );
      record.managerContactId = contactId;
    }
    if (gestorName) {
      OMEGA_MESU_BY_GESTAO.set(normalizePlain(gestorName), record);
    }
  });
}

function ensureOmegaMesu(){
  if (OMEGA_MESU_DATA.length) return Promise.resolve(OMEGA_MESU_DATA);
  if (omegaMesuPromise) return omegaMesuPromise;

  const loader = (typeof loadCSVAuto === 'function')
    ? loadCSVAuto(OMEGA_MESU_SOURCE).catch((err) => {
        console.warn('Falha ao carregar MESU via loader principal:', err);
        return fallbackLoadCsv(OMEGA_MESU_SOURCE);
      })
    : fallbackLoadCsv(OMEGA_MESU_SOURCE);

  omegaMesuPromise = loader
    .then((rows) => {
      applyMesuCatalog(Array.isArray(rows) ? rows : []);
      return OMEGA_MESU_DATA;
    })
    .catch((err) => {
      console.warn('Não foi possível carregar a base MESU:', err);
      OMEGA_MESU_DATA = [];
      return [];
    })
    .finally(() => {
      omegaMesuPromise = null;
    });

  return omegaMesuPromise;
}

function getMesuRecordForUser(user){
  if (!user || !user.name) return null;
  const key = normalizePlain(user.name);
  if (!key) return null;
  return OMEGA_MESU_BY_GESTAO.get(key) || OMEGA_MESU_BY_MANAGER.get(key) || null;
}

function getMesuManagerForUser(user){
  const record = getMesuRecordForUser(user);
  if (!record || !record.managerName) return null;
  const contactId = record.managerContactId
    || registerExternalContact(createMesuContactId('manager', record.managerId, record.managerName), {
      name: record.managerName,
      position: 'Gerente da agência',
      email: buildCorporateEmail(record.managerName),
      agency: record.agencyName,
      segment: record.segment,
      region: record.gerencia,
      type: 'manager',
      side: 'analista',
    });
  record.managerContactId = contactId;
  return {
    record,
    contactId,
    name: record.managerName,
    email: record.managerEmail || buildCorporateEmail(record.managerName),
  };
}

function formatFileSize(bytes){
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getTicketTypesForDepartment(department){
  if (!department) return OMEGA_TICKET_TYPES_BY_DEPARTMENT.Outros || ['A construir'];
  const list = OMEGA_TICKET_TYPES_BY_DEPARTMENT[department];
  if (Array.isArray(list) && list.length) return list;
  return OMEGA_TICKET_TYPES_BY_DEPARTMENT.Outros || ['A construir'];
}

function getAvailableDepartmentsForUser(user){
  const base = Array.isArray(OMEGA_QUEUE_OPTIONS) ? [...OMEGA_QUEUE_OPTIONS] : [];
  if (!base.length) return base;
  if (!user) return base;
  if (user.roles?.admin || user.role === 'admin') return base;
  const role = user.role || 'usuario';
  if (role === 'usuario') {
    return user.matrixAccess ? base : base.filter((item) => item !== 'Matriz');
  }
  const queues = Array.isArray(user.queues) ? user.queues.filter((queue) => base.includes(queue)) : [];
  if (queues.length) return queues;
  if (user.matrixAccess) return base;
  return base.filter((item) => item !== 'Matriz');
}

function syncTicketTypeOptions(container, department){
  const departmentSelect = container?.querySelector?.('#omega-form-department');
  const typeSelect = container?.querySelector?.('#omega-form-type');
  if (!typeSelect) return;
  const options = getTicketTypesForDepartment(department);
  typeSelect.innerHTML = options
    .map((item) => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`)
    .join('');
  typeSelect.disabled = !options.length;
  if (options.length) {
    typeSelect.selectedIndex = 0;
  }
  const flow = getFormFlowState();
  const previousDepartment = flow.department;
  const previousType = flow.type;
  const previousDepartmentValue = flow.departmentValue;
  const previousTypeValue = flow.typeValue;
  const selectedDepartmentLabel = departmentSelect?.selectedOptions?.[0]?.textContent?.trim()
    || departmentSelect?.value
    || department
    || '';
  const selectedTypeLabel = typeSelect?.selectedOptions?.[0]?.textContent?.trim()
    || typeSelect?.value
    || options[0]
    || '';
  const selectedDepartmentValue = departmentSelect?.value || department || '';
  const selectedTypeValue = typeSelect?.value || options[0] || '';
  flow.department = selectedDepartmentLabel;
  flow.type = selectedTypeLabel;
  flow.departmentValue = selectedDepartmentValue;
  flow.typeValue = selectedTypeValue;
  if (
    previousDepartment !== flow.department
    || previousType !== flow.type
    || previousDepartmentValue !== flow.departmentValue
    || previousTypeValue !== flow.typeValue
  ) {
    flow.targetManagerName = '';
    flow.targetManagerEmail = '';
    flow.requesterManagerName = '';
    flow.requesterManagerEmail = '';
  }
  renderFormFlowExtras(container);
}

function getFormFlowState(){
  if (!omegaState.formFlow || typeof omegaState.formFlow !== 'object') {
    omegaState.formFlow = {
      department: '',
      departmentValue: '',
      type: '',
      typeValue: '',
      targetManagerName: '',
      targetManagerEmail: '',
      requesterManagerName: '',
      requesterManagerEmail: '',
    };
  }
  return omegaState.formFlow;
}

function resetFormFlowState({ department = '', type = '', departmentValue = '', typeValue = '' } = {}){
  const flow = getFormFlowState();
  flow.department = department;
  flow.departmentValue = departmentValue || department;
  flow.type = type;
  flow.typeValue = typeValue || type;
  flow.targetManagerName = '';
  flow.targetManagerEmail = '';
  flow.requesterManagerName = '';
  flow.requesterManagerEmail = '';
}

function isTransferEmpresasFlow(flow){
  if (!flow) return false;
  const department = normalizePlain(flow.department || flow.departmentValue);
  const type = normalizePlain(flow.type || flow.typeValue);
  return department === normalizePlain('Encarteiramento') && type === normalizePlain(OMEGA_TRANSFER_EMPRESAS_LABEL);
}

function renderFormFlowExtras(context){
  const scope = context?.querySelector ? context : document;
  const container = scope?.querySelector?.('#omega-form-flow') || document.getElementById('omega-form-flow');
  if (!container) return;
  const flow = getFormFlowState();
  const departmentSelect = scope?.querySelector?.('#omega-form-department') || document.getElementById('omega-form-department');
  const typeSelect = scope?.querySelector?.('#omega-form-type') || document.getElementById('omega-form-type');
  const departmentValue = departmentSelect?.value || flow.departmentValue || '';
  const typeValue = typeSelect?.value || flow.typeValue || '';
  const departmentLabel = departmentSelect?.selectedOptions?.[0]?.textContent?.trim()
    || departmentValue
    || flow.department
    || '';
  const typeLabel = typeSelect?.selectedOptions?.[0]?.textContent?.trim()
    || typeValue
    || flow.type
    || '';
  if (departmentSelect) {
    flow.department = departmentLabel;
    flow.departmentValue = departmentValue;
  }
  if (typeSelect) {
    flow.type = typeLabel;
    flow.typeValue = typeValue;
  }
  const hasExplicitSelection = !!departmentValue && !!typeValue && !!departmentSelect && !!typeSelect;
  const shouldShow = hasExplicitSelection
    ? isTransferEmpresasFlow({ department: departmentValue, type: typeValue })
    : false;
  container.hidden = !shouldShow;
  container.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  if (!shouldShow) {
    flow.targetManagerName = '';
    flow.targetManagerEmail = '';
    flow.requesterManagerName = '';
    flow.requesterManagerEmail = '';
  }
  const nameInput = container.querySelector('#omega-flow-target-name');
  const emailInput = container.querySelector('#omega-flow-target-email');
  const requesterNameInput = container.querySelector('#omega-flow-requester-name');
  const requesterEmailInput = container.querySelector('#omega-flow-requester-email');
  if (nameInput) {
    if (shouldShow) nameInput.value = flow.targetManagerName || '';
    nameInput.required = shouldShow;
    if (!shouldShow) nameInput.value = '';
  }
  if (emailInput) {
    if (shouldShow) emailInput.value = flow.targetManagerEmail || '';
    emailInput.required = shouldShow;
    if (!shouldShow) emailInput.value = '';
  }
  if (requesterNameInput) {
    if (shouldShow) requesterNameInput.value = flow.requesterManagerName || '';
    requesterNameInput.required = shouldShow;
    if (!shouldShow) requesterNameInput.value = '';
  }
  if (requesterEmailInput) {
    if (shouldShow) requesterEmailInput.value = flow.requesterManagerEmail || '';
    requesterEmailInput.required = shouldShow;
    if (!shouldShow) requesterEmailInput.value = '';
  }
}

function renderFormAttachments(root){
  const list = root?.querySelector?.('#omega-form-attachments');
  if (!list) return;
  const attachments = Array.isArray(omegaState.formAttachments) ? omegaState.formAttachments : [];
  if (!attachments.length) {
    list.innerHTML = '<li class="omega-attachments__empty">Nenhum arquivo adicionado</li>';
    return;
  }
  list.innerHTML = attachments.map((item) => {
    const size = item.size ? `<span class="omega-attachments__size">${escapeHTML(formatFileSize(item.size))}</span>` : '';
    return `<li class="omega-attachments__item" data-attachment-id="${escapeHTML(item.id)}">
      <div class="omega-attachments__meta">
        <i class="ti ti-paperclip" aria-hidden="true"></i>
        <span class="omega-attachments__name">${escapeHTML(item.name)}</span>
        ${size}
      </div>
      <button type="button" class="omega-attachments__remove" data-omega-remove-attachment="${escapeHTML(item.id)}" aria-label="Remover ${escapeHTML(item.name)}">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
    </li>`;
  }).join('');
}

function resetFormAttachments(root){
  omegaState.formAttachments = [];
  const fileInput = root?.querySelector?.('#omega-form-file');
  if (fileInput) {
    try {
      fileInput.value = '';
    } catch (err) {
      /* noop */
    }
  }
  renderFormAttachments(root);
}

function addFormAttachments(root, fileList){
  if (!fileList || !fileList.length) return;
  if (!Array.isArray(omegaState.formAttachments)) {
    omegaState.formAttachments = [];
  }
  const entries = Array.from(fileList).filter(Boolean).map((file) => ({
    id: createLocalId('att'),
    name: file.name || 'Arquivo sem nome',
    size: Number.isFinite(file.size) ? file.size : null,
    file,
  }));
  if (!entries.length) return;
  omegaState.formAttachments = [...omegaState.formAttachments, ...entries];
  renderFormAttachments(root);
}

function removeFormAttachment(root, attachmentId){
  if (!attachmentId || !Array.isArray(omegaState.formAttachments)) return;
  omegaState.formAttachments = omegaState.formAttachments.filter((item) => item.id !== attachmentId);
  renderFormAttachments(root);
}

function resetTicketUpdateState(){
  omegaState.ticketUpdate = {
    comment: '',
    status: '',
    priority: '',
    queue: '',
    owner: '',
    category: '',
    due: '',
    attachments: [],
  };
  omegaState.ticketUpdateTicketId = null;
}

function initializeTicketUpdateDraft(ticket){
  if (!ticket) {
    resetTicketUpdateState();
    return;
  }
  const statuses = getOrderedStatuses();
  omegaState.ticketUpdateTicketId = ticket.id;
  omegaState.ticketUpdate = {
    comment: '',
    status: ticket.status && statuses.includes(ticket.status) ? ticket.status : (statuses[0] || 'aberto'),
    priority: ticket.priority || 'media',
    queue: ticket.queue || '',
    owner: ticket.ownerId || '',
    category: ticket.category || '',
    due: formatDateInput(ticket.dueDate),
    attachments: [],
  };
}

function renderTicketUpdateAttachments(container){
  if (!container) return;
  const list = container.querySelector('#omega-ticket-update-attachments');
  if (!list) return;
  const attachments = Array.isArray(omegaState.ticketUpdate?.attachments) ? omegaState.ticketUpdate.attachments : [];
  if (!attachments.length) {
    list.innerHTML = '<li class="omega-attachments__empty">Nenhum arquivo anexado</li>';
    return;
  }
  list.innerHTML = attachments.map((item) => {
    const size = item.size ? `<span class="omega-attachments__size">${escapeHTML(formatFileSize(item.size))}</span>` : '';
    return `<li class="omega-attachments__item" data-attachment-id="${escapeHTML(item.id)}">
      <div class="omega-attachments__meta">
        <i class="ti ti-paperclip" aria-hidden="true"></i>
        <span class="omega-attachments__name">${escapeHTML(item.name)}</span>
        ${size}
      </div>
      <button type="button" class="omega-attachments__remove" data-omega-remove-update-attachment="${escapeHTML(item.id)}" aria-label="Remover ${escapeHTML(item.name)}">
        <i class="ti ti-x" aria-hidden="true"></i>
      </button>
    </li>`;
  }).join('');
}

function addTicketUpdateAttachments(container, fileList){
  if (!fileList || !fileList.length) return;
  if (!Array.isArray(omegaState.ticketUpdate?.attachments)) {
    if (!omegaState.ticketUpdate) omegaState.ticketUpdate = {};
    omegaState.ticketUpdate.attachments = [];
  }
  const entries = Array.from(fileList).filter(Boolean).map((file) => ({
    id: createLocalId('upd'),
    name: file.name || 'Arquivo sem nome',
    size: Number.isFinite(file.size) ? file.size : null,
    file,
  }));
  if (!entries.length) return;
  omegaState.ticketUpdate.attachments = [...omegaState.ticketUpdate.attachments, ...entries];
  renderTicketUpdateAttachments(container);
}

function removeTicketUpdateAttachment(container, attachmentId){
  if (!attachmentId || !Array.isArray(omegaState.ticketUpdate?.attachments)) return;
  omegaState.ticketUpdate.attachments = omegaState.ticketUpdate.attachments.filter((item) => item.id !== attachmentId);
  renderTicketUpdateAttachments(container);
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

function formatDateInput(value){
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const direct = value.toString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(direct) ? direct : '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function applyPendingIntents(root){
  if (!root) return;
  const intent = omegaState.pendingNewTicket;
  if (!intent) return;
  const queue = intent.queue || '';
  if (queue) omegaState.prefillDepartment = queue;
  setDrawerOpen(true);
  const form = root.querySelector('#omega-form');
  if (form && queue) {
    const departmentSelect = form.querySelector('#omega-form-department');
    const options = Array.from(departmentSelect?.options || []).map((option) => option.value);
    if (departmentSelect && options.includes(queue) && departmentSelect.value !== queue) {
      departmentSelect.value = queue;
      syncTicketTypeOptions(form, queue);
    }
  }
  const firstField = root.querySelector('#omega-form-type') || root.querySelector('#omega-form-product');
  if (firstField) {
    requestAnimationFrame(() => {
      try { firstField.focus(); } catch (err) { /* noop */ }
    });
  }
  omegaState.pendingNewTicket = null;
}

function setDrawerOpen(open){
  const root = document.getElementById('omega-modal');
  const drawer = root?.querySelector('#omega-drawer');
  if (!drawer) return;
  omegaState.drawerOpen = !!open;
  drawer.hidden = !open;
  if (open) {
    populateFormOptions(root);
    prefillTicketForm(root);
  } else {
    const form = root.querySelector('#omega-form');
    if (form) form.reset();
    resetFormAttachments(root);
    clearFormFeedback(root);
    omegaState.prefillDepartment = '';
  }
}

function setSidebarCollapsed(collapsed){
  omegaState.sidebarCollapsed = !!collapsed;
  applySidebarState();
}

function initializeManageAnalystState(user){
  const analysts = getManageableAnalysts(user);
  if (!analysts.length) {
    omegaState.manageAnalystId = null;
    return;
  }
  if (!analysts.some((analyst) => analyst.id === omegaState.manageAnalystId)) {
    omegaState.manageAnalystId = analysts[0].id;
  }
}

function setManageAnalystOpen(open){
  const root = document.getElementById('omega-modal');
  if (!root) return;
  const modal = root.querySelector('#omega-manage-analyst');
  if (!modal) return;
  omegaState.manageAnalystOpen = !!open;
  modal.hidden = !omegaState.manageAnalystOpen;
  if (omegaState.manageAnalystOpen) {
    const user = getCurrentUser();
    initializeManageAnalystState(user);
    populateManageAnalystModal(root, user);
    const focusTarget = modal.querySelector('#omega-manage-analyst-select');
    if (focusTarget) {
      requestAnimationFrame(() => {
        try { focusTarget.focus(); } catch (err) { /* noop */ }
      });
    }
  }
}

function initializeManageStatusState(user){
  if (!omegaState.manageStatus || typeof omegaState.manageStatus !== 'object') {
    omegaState.manageStatus = { departmentId: '', statusId: '' };
  }
  const departments = getManagedDepartments(user);
  if (!departments.length) {
    omegaState.manageStatus.departmentId = '';
    omegaState.manageStatus.statusId = '';
    return;
  }
  if (!departments.some((dept) => dept.id === omegaState.manageStatus.departmentId)) {
    omegaState.manageStatus.departmentId = departments[0].id;
  }
  const statuses = getStatusesForDepartment(omegaState.manageStatus.departmentId);
  if (!statuses.length) {
    omegaState.manageStatus.statusId = '';
  } else if (!statuses.some((status) => status.id === omegaState.manageStatus.statusId)) {
    omegaState.manageStatus.statusId = statuses[0].id;
  }
}

function setManageStatusOpen(open){
  const root = document.getElementById('omega-modal');
  if (!root) return;
  const modal = root.querySelector('#omega-manage-status');
  if (!modal) return;
  omegaState.manageStatusOpen = !!open;
  modal.hidden = !omegaState.manageStatusOpen;
  if (omegaState.manageStatusOpen) {
    const user = getCurrentUser();
    initializeManageStatusState(user);
    populateManageStatusModal(root, user);
    const focusTarget = modal.querySelector('#omega-manage-status-department');
    if (focusTarget) {
      requestAnimationFrame(() => {
        try { focusTarget.focus(); } catch (err) { /* noop */ }
      });
    }
  }
}

function applySidebarState(root = document.getElementById('omega-modal')){
  if (!root) return;
  const collapsed = !!omegaState.sidebarCollapsed;
  const body = root.querySelector('.omega-body');
  const sidebar = root.querySelector('#omega-sidebar');
  const toggle = root.querySelector('#omega-sidebar-toggle');
  if (body) body.dataset.sidebarCollapsed = collapsed ? 'true' : 'false';
  if (sidebar) sidebar.dataset.collapsed = collapsed ? 'true' : 'false';
  if (toggle) {
    toggle.dataset.collapsed = collapsed ? 'true' : 'false';
    toggle.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    const label = collapsed ? 'Expandir menu' : 'Recolher menu';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    const icon = toggle.querySelector('i');
    if (icon) {
      icon.className = collapsed ? 'ti ti-chevron-right' : 'ti ti-chevron-left';
    }
  }
}

function populateManageAnalystModal(root, user){
  const modal = root.querySelector('#omega-manage-analyst');
  if (!modal) return;
  const form = modal.querySelector('#omega-manage-analyst-form');
  const select = modal.querySelector('#omega-manage-analyst-select');
  const queueHost = modal.querySelector('#omega-manage-analyst-queues');
  const empty = modal.querySelector('#omega-manage-analyst-empty');
  const managedQueues = getManagedQueues(user);
  const analysts = getManageableAnalysts(user);
  const hasQueues = managedQueues.length > 0;
  const hasAnalysts = analysts.length > 0;

  if (!hasQueues || !hasAnalysts) {
    if (form) form.hidden = true;
    if (empty) {
      empty.hidden = false;
      empty.textContent = hasQueues
        ? 'Não há analistas disponíveis para a sua equipe.'
        : 'Nenhuma fila disponível para gerenciamento.';
    }
    if (queueHost) queueHost.innerHTML = '';
    if (select) select.innerHTML = '';
    omegaState.manageAnalystId = null;
    return;
  }

  if (form) form.hidden = false;
  if (empty) empty.hidden = true;
  initializeManageAnalystState(user);
  if (select) {
    select.innerHTML = analysts
      .map((analyst) => {
        const role = getUserRoleLabel(analyst);
        return `<option value="${analyst.id}">${escapeHTML(`${analyst.name} — ${role}`)}</option>`;
      })
      .join('');
    if (omegaState.manageAnalystId) select.value = omegaState.manageAnalystId;
  }
  const target = analysts.find((item) => item.id === omegaState.manageAnalystId) || analysts[0];
  const assigned = new Set(Array.isArray(target?.queues) ? target.queues : []);
  if (queueHost) {
    queueHost.innerHTML = managedQueues
      .map((queue) => {
        const queueId = `omega-manage-analyst-queue-${normalizeStatusId(queue)}`;
        const checked = assigned.has(queue) ? ' checked' : '';
        return `<label class="omega-manage-list__option" for="${queueId}">`
          + `<input type="checkbox" id="${queueId}" name="omega-manage-analyst-queue" value="${escapeHTML(queue)}"${checked}/>`
          + `<span>${escapeHTML(queue)}</span>`
          + `</label>`;
      })
      .join('');
  }
}

function handleManageAnalystSubmit(form){
  if (!form) return;
  const root = document.getElementById('omega-modal');
  if (!root) return;
  const user = getCurrentUser();
  const managedQueues = new Set(getManagedQueues(user));
  const analystId = omegaState.manageAnalystId;
  if (!analystId) {
    showOmegaToast('Selecione um analista para atualizar.', 'warning');
    return;
  }
  const analyst = OMEGA_USERS.find((person) => person.id === analystId);
  if (!analyst) {
    showOmegaToast('Analista não encontrado.', 'danger');
    return;
  }
  const inputs = form.querySelectorAll('input[name="omega-manage-analyst-queue"]');
  const selectedQueues = Array.from(inputs)
    .filter((input) => input.checked && managedQueues.has(input.value))
    .map((input) => input.value);
  analyst.queues = selectedQueues;
  analyst.defaultQueue = selectedQueues[0] || null;
  analyst.matrixAccess = selectedQueues.includes('Matriz');
  renderOmega();
  populateManageAnalystModal(root, getCurrentUser());
  showOmegaToast('Filas do analista atualizadas.', 'success');
}

function populateManageStatusModal(root, user){
  const modal = root.querySelector('#omega-manage-status');
  if (!modal) return;
  const form = modal.querySelector('#omega-manage-status-form');
  const empty = modal.querySelector('#omega-manage-status-empty');
  const departmentSelect = modal.querySelector('#omega-manage-status-department');
  const statusSelect = modal.querySelector('#omega-manage-status-select');
  const labelField = modal.querySelector('#omega-manage-status-label');
  const toneSelect = modal.querySelector('#omega-manage-status-tone');
  const descriptionField = modal.querySelector('#omega-manage-status-description');
  const departments = getManagedDepartments(user);

  if (!departments.length) {
    if (form) form.hidden = true;
    if (empty) {
      empty.hidden = false;
      empty.textContent = 'Nenhuma fila disponível para gerenciamento.';
    }
    omegaState.manageStatus.departmentId = '';
    omegaState.manageStatus.statusId = '';
    return;
  }

  if (form) form.hidden = false;
  if (empty) empty.hidden = true;
  initializeManageStatusState(user);

  if (departmentSelect) {
    departmentSelect.innerHTML = departments
      .map((dept) => `<option value="${dept.id}">${escapeHTML(dept.name)}</option>`)
      .join('');
    departmentSelect.value = omegaState.manageStatus.departmentId || departments[0].id;
  }

  if (toneSelect) {
    toneSelect.innerHTML = OMEGA_STATUS_TONE_OPTIONS
      .map((tone) => `<option value="${tone}">${escapeHTML(OMEGA_STATUS_TONE_LABELS[tone] || tone)}</option>`)
      .join('');
  }

  const statuses = getStatusesForDepartment(omegaState.manageStatus.departmentId);
  if (!statuses.length) {
    if (statusSelect) statusSelect.innerHTML = '';
    if (labelField) labelField.value = '';
    if (toneSelect) toneSelect.value = 'neutral';
    if (descriptionField) descriptionField.value = '';
    omegaState.manageStatus.statusId = '';
    return;
  }

  if (!statuses.some((status) => status.id === omegaState.manageStatus.statusId)) {
    omegaState.manageStatus.statusId = statuses[0].id;
  }

  if (statusSelect) {
    statusSelect.innerHTML = statuses
      .map((status) => `<option value="${status.id}">${escapeHTML(status.label)}</option>`)
      .join('');
    statusSelect.value = omegaState.manageStatus.statusId || statuses[0].id;
  }

  const activeStatus = statuses.find((status) => status.id === omegaState.manageStatus.statusId) || statuses[0];
  if (labelField) labelField.value = activeStatus?.label || '';
  if (toneSelect) toneSelect.value = activeStatus?.tone || 'neutral';
  if (descriptionField) descriptionField.value = activeStatus?.description || '';
}

function handleManageStatusSubmit(form){
  if (!form) return;
  const departmentId = (form.querySelector('#omega-manage-status-department')?.value || '').toString();
  const statusId = form.querySelector('#omega-manage-status-select')?.value || '';
  const label = form.querySelector('#omega-manage-status-label')?.value?.trim() || '';
  const toneRaw = form.querySelector('#omega-manage-status-tone')?.value || 'neutral';
  const description = form.querySelector('#omega-manage-status-description')?.value?.trim() || '';
  if (!departmentId) {
    showOmegaToast('Selecione uma fila para editar.', 'warning');
    return;
  }
  if (!statusId) {
    showOmegaToast('Selecione um status para atualizar.', 'warning');
    return;
  }
  const tone = OMEGA_STATUS_TONE_OPTIONS.includes(toneRaw) ? toneRaw : 'neutral';
  let index = OMEGA_STATUS_CATALOG.findIndex((entry) => {
    if (!entry) return false;
    if (entry.id !== statusId) return false;
    const entryDepartment = (entry.departmentId || OMEGA_STATUS_GLOBAL_DEPARTMENT).toString();
    return entryDepartment === departmentId;
  });
  if (index === -1) {
    index = OMEGA_STATUS_CATALOG.findIndex((entry) => entry?.id === statusId);
  }
  if (index === -1) {
    showOmegaToast('Status não encontrado.', 'danger');
    return;
  }
  const updated = { ...OMEGA_STATUS_CATALOG[index] };
  if (label) updated.label = label;
  updated.tone = tone;
  updated.description = description;
  updated.departmentId = departmentId.toString();
  OMEGA_STATUS_CATALOG[index] = updated;
  if (!omegaState.manageStatus || typeof omegaState.manageStatus !== 'object') {
    omegaState.manageStatus = { departmentId, statusId };
  } else {
    omegaState.manageStatus.departmentId = departmentId;
    omegaState.manageStatus.statusId = statusId;
  }
  applyStatusCatalog(OMEGA_STATUS_CATALOG);
  renderOmega();
  const root = document.getElementById('omega-modal');
  if (root) populateManageStatusModal(root, getCurrentUser());
  showOmegaToast('Status atualizado.', 'success');
}

function setTicketModalOpen(open){
  omegaState.ticketModalOpen = !!open;
  if (!open) omegaState.cancelDialogOpen = false;
  const modal = document.getElementById('omega-ticket-modal');
  if (!modal) return;
  if (!omegaState.ticketModalOpen) {
    modal.hidden = true;
    resetTicketUpdateState();
  }
}

function setFilterPanelOpen(open){
  omegaState.filterPanelOpen = !!open;
  const root = document.getElementById('omega-modal');
  if (!root) return;
  const panel = root.querySelector('#omega-filter-panel');
  const toggle = root.querySelector('#omega-filters-toggle');
  if (panel) panel.hidden = !open;
  if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    populateFilterPanelOptions(root);
    syncFilterFormState(root);
  }
  updateFilterButtonState(root);
}

function toggleFilterPanel(force){
  const next = typeof force === 'boolean' ? force : !omegaState.filterPanelOpen;
  setFilterPanelOpen(next);
}

function populateUserSelect(root){
  const select = root.querySelector('#omega-user-select');
  if (!select) return;
  if (!OMEGA_USERS.length) {
    select.innerHTML = '';
    return;
  }
  const order = { usuario: 0, analista: 1, supervisor: 2, admin: 3 };
  const options = [...OMEGA_USERS].sort((a, b) => {
    const roleDiff = (order[a.role] ?? 10) - (order[b.role] ?? 10);
    if (roleDiff !== 0) return roleDiff;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  select.innerHTML = options.map((user) => {
    const roleLabel = getUserRoleLabel(user);
    const meta = [];
    if (user.position) meta.push(user.position);
    if (user.functional) meta.push(user.functional);
    else if (user.junction) meta.push(user.junction);
    const descriptor = meta.length ? meta.join(' • ') : roleLabel;
    return `<option value="${user.id}">${escapeHTML(user.name)} — ${escapeHTML(descriptor)}</option>`;
  }).join('');
  const defaultId = omegaState.currentUserId || options[0]?.id || '';
  select.value = defaultId;
  omegaState.currentUserId = defaultId || null;
  select.disabled = false;
  select.removeAttribute('aria-disabled');
  const currentUser = options.find((user) => user.id === defaultId) || options[0] || null;
  renderProfile(root, currentUser);
}

function populateFormOptions(root){
  const form = root.querySelector('#omega-form');
  if (!form) return;
  const departmentSelect = form.querySelector('#omega-form-department');
  const user = getCurrentUser();
  const departments = getAvailableDepartmentsForUser(user);
  const requesterDisplay = form.querySelector('#omega-form-requester');
  if (requesterDisplay) {
    requesterDisplay.textContent = user?.name || '—';
  }
  if (departmentSelect) {
    const previous = departmentSelect.value;
    if (departments.length) {
      departmentSelect.innerHTML = departments
        .map((item) => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`)
        .join('');
      if (previous && departments.includes(previous)) {
        departmentSelect.value = previous;
      } else {
        departmentSelect.value = departments[0];
      }
    } else {
      departmentSelect.innerHTML = '<option value="" disabled>Nenhum departamento disponível</option>';
      departmentSelect.value = '';
    }
    departmentSelect.disabled = !departments.length;
  }
  const department = departmentSelect?.value || departments[0] || '';
  syncTicketTypeOptions(form, department);
  const typeSelect = form.querySelector('#omega-form-type');
  const selectedType = typeSelect?.value || '';
  const departmentLabel = departmentSelect?.selectedOptions?.[0]?.textContent?.trim() || department;
  const typeLabel = typeSelect?.selectedOptions?.[0]?.textContent?.trim() || selectedType;
  resetFormFlowState({
    department: departmentLabel,
    type: typeLabel,
    departmentValue: department,
    typeValue: selectedType,
  });
  renderFormFlowExtras(form);
  renderFormAttachments(root);
}

function buildOmegaSubject({ typeLabel = '', productLabel = '', requester = '' } = {}){
  const parts = [];
  if (typeLabel) parts.push(typeLabel);
  if (productLabel && !parts.includes(productLabel)) parts.push(productLabel);
  if (requester) parts.push(requester);
  return parts.length ? parts.join(' • ') : 'Chamado Omega';
}

function updateOmegaFormSubject(root){
  const form = root.querySelector('#omega-form');
  if (!form) return;
  const subjectInput = form.querySelector('#omega-form-subject');
  if (!subjectInput) return;
  const typeSelect = form.querySelector('#omega-form-type');
  const productId = form.querySelector('#omega-form-product')?.value;
  const productMeta = OMEGA_PRODUCT_CATALOG.find((item) => item.id === productId) || null;
  const typeLabel = typeSelect?.selectedOptions?.[0]?.textContent?.trim() || '';
  const requester = getCurrentUser()?.name || '';
  subjectInput.value = buildOmegaSubject({
    typeLabel,
    productLabel: productMeta?.label || '',
    requester,
  });
}

function prefillTicketForm(root){
  const form = root.querySelector('#omega-form');
  if (!form) return;
  resetFormAttachments(root);
  const productInput = form.querySelector('#omega-form-product');
  const departmentSelect = form.querySelector('#omega-form-department');
  const requesterDisplay = form.querySelector('#omega-form-requester');
  const observationInput = form.querySelector('#omega-form-observation');

  const detail = omegaState.contextDetail;
  const user = getCurrentUser();
  const availableDepartments = getAvailableDepartmentsForUser(user);
  const fallbackDepartment = availableDepartments[0] || '';
  const requestedDepartment = omegaState.prefillDepartment && availableDepartments.includes(omegaState.prefillDepartment)
    ? omegaState.prefillDepartment
    : '';
  let productMeta = null;
  if (detail?.levelKey === 'prodsub') {
    productMeta = OMEGA_PRODUCT_CATALOG.find((item) => normalizeText(item.label) === normalizeText(detail.label)) || null;
  } else if (detail?.levelKey === 'familia') {
    productMeta = OMEGA_PRODUCT_CATALOG.find((item) => normalizeText(item.family) === normalizeText(detail.label)) || null;
  } else if (detail?.levelKey === 'secao') {
    productMeta = OMEGA_PRODUCT_CATALOG.find((item) => normalizeText(item.section) === normalizeText(detail.label)) || null;
  }
  if (!productMeta) {
    const trailProduct = detail?.trail?.find?.((entry) => !!entry && typeof entry === 'string') || '';
    productMeta = OMEGA_PRODUCT_CATALOG.find((item) => normalizeText(item.label) === normalizeText(trailProduct)) || null;
  }
  if (!productMeta) productMeta = OMEGA_PRODUCT_CATALOG[0] || null;

  if (productInput) {
    productInput.value = productMeta?.id || '';
  }
  if (departmentSelect) {
    const preferred = user?.defaultQueue && availableDepartments.includes(user.defaultQueue)
      ? user.defaultQueue
      : fallbackDepartment;
    if (requestedDepartment) {
      departmentSelect.value = requestedDepartment;
    } else if (!availableDepartments.includes(departmentSelect.value)) {
      departmentSelect.value = preferred;
    }
    const effective = departmentSelect.value || requestedDepartment || preferred;
    syncTicketTypeOptions(form, effective);
  } else {
    syncTicketTypeOptions(form, requestedDepartment || fallbackDepartment);
  }
  const typeSelect = form.querySelector('#omega-form-type');
  const currentDepartment = departmentSelect?.value || requestedDepartment || fallbackDepartment || '';
  const currentType = typeSelect?.value || '';
  const currentDepartmentLabel = departmentSelect?.selectedOptions?.[0]?.textContent?.trim() || currentDepartment;
  const currentTypeLabel = typeSelect?.selectedOptions?.[0]?.textContent?.trim() || currentType;
  resetFormFlowState({
    department: currentDepartmentLabel,
    type: currentTypeLabel,
    departmentValue: currentDepartment,
    typeValue: currentType,
  });
  renderFormFlowExtras(form);
  if (requesterDisplay) {
    requesterDisplay.textContent = user?.name || '—';
  }
  updateOmegaFormSubject(root);
  if (observationInput) {
    observationInput.value = '';
  }
  clearFormFeedback(root);
  omegaState.prefillDepartment = '';
}

function applyTransferEmpresasFlow(ticket, extras, user){
  if (!ticket) return;
  if (!Array.isArray(ticket.history)) ticket.history = [];
  const now = new Date();
  const baseTime = now.getTime();
  const minute = 60000;
  let step = 1;
  const addHistory = (entry, options = {}) => {
    const date = new Date(baseTime + step * minute).toISOString();
    step += 1;
    return appendTicketHistory(ticket, { ...entry, date }, options);
  };
  const approvals = [];
  const requesterInfo = extras?.requester || {};
  const targetInfo = extras?.target || {};
  let requesterContactId = null;
  if (requesterInfo.name) {
    requesterContactId = registerExternalContact(createLocalId('mesu-requester'), {
      name: requesterInfo.name,
      email: requesterInfo.email,
      position: 'Gerente da agência solicitante',
      type: 'manager',
      side: 'solicitante',
    });
    approvals.push({
      role: 'solicitante',
      contactId: requesterContactId,
      name: requesterInfo.name,
      email: requesterInfo.email,
    });
    addHistory({
      actorId: 'omega-flow',
      action: `Notificação enviada para ${requesterInfo.name}`,
      comment: `O gerente da agência solicitante (${requesterInfo.email || 'contato indisponível'}) recebeu o pedido de aprovação.`,
      status: 'aguardando',
    });
    addHistory({
      actorId: requesterContactId,
      action: 'Agência solicitante aprovou a transferência',
      comment: `${requesterInfo.name} concedeu o de acordo da agência solicitante.`,
      status: 'aguardando',
    });
  }
  const targetContactId = registerExternalContact(createLocalId('mesu-target'), {
    name: targetInfo.name,
    email: targetInfo.email,
    position: 'Gerente da agência cedente',
    type: 'manager',
    side: 'analista',
  });
  approvals.push({
    role: 'cedente',
    contactId: targetContactId,
    name: targetInfo.name,
    email: targetInfo.email,
  });
  addHistory({
    actorId: 'omega-flow',
    action: `Solicitação enviada para ${targetInfo.name}`,
    comment: `Convite encaminhado para ${targetInfo.email || 'contato indisponível'} validar a transferência.`,
    status: 'aguardando',
  });
  addHistory({
    actorId: targetContactId,
    action: 'Agência cedente aprovou a transferência',
    comment: `${targetInfo.name} autorizou a transferência da carteira.`,
    status: 'aguardando',
  });
  const analyst = getAssignableAnalystsForQueue(ticket.queue, user)[0] || null;
  if (analyst) {
    approvals.push({
      role: 'analista',
      contactId: analyst.id,
      name: analyst.name,
      email: analyst.functional ? `${analyst.functional}@omega.com.br` : '',
    });
    addHistory({
      actorId: analyst.id,
      action: 'Chamado encaminhado para análise de encarteiramento',
      comment: `${analyst.name} receberá o chamado após os de acordo registrados.`,
      status: 'aguardando',
    });
    ticket.ownerId = analyst.id;
  } else {
    addHistory({
      actorId: 'omega-flow',
      action: 'Chamado aguardando distribuição na fila de encarteiramento',
      comment: 'Assim que um analista estiver disponível, o chamado será atribuído automaticamente.',
      status: 'aguardando',
    });
  }
  ticket.status = 'aguardando';
  const lastEntry = ticket.history[ticket.history.length - 1];
  ticket.updated = lastEntry?.date || ticket.updated;
  ticket.flow = {
    type: 'encarteiramento-transfer-empresas',
    targetManager: { name: targetInfo.name, email: targetInfo.email, contactId: targetContactId },
    requesterManager: requesterContactId
      ? { name: requesterInfo.name, email: requesterInfo.email, contactId: requesterContactId }
      : null,
    approvals,
  };
}

function handleNewTicketSubmit(form){
  const root = document.getElementById('omega-modal');
  if (!root) return;
  updateOmegaFormSubject(root);
  const user = getCurrentUser();
  const requesterName = user?.name?.trim() || '';
  const productId = form.querySelector('#omega-form-product')?.value;
  const category = form.querySelector('#omega-form-type')?.value;
  const queue = form.querySelector('#omega-form-department')?.value;
  const subject = form.querySelector('#omega-form-subject')?.value?.trim();
  const description = form.querySelector('#omega-form-observation')?.value?.trim();
  const attachments = Array.isArray(omegaState.formAttachments)
    ? omegaState.formAttachments.map((item) => item.name)
    : [];
  if (!user || !requesterName || !productId || !category || !queue || !subject || !description) {
    showFormFeedback(root, 'Preencha todos os campos obrigatórios para registrar o chamado.', 'warning');
    return;
  }
  const requiresTransferFlow = isTransferEmpresasFlow({ department: queue, type: category });
  let flowTargetName = '';
  let flowTargetEmail = '';
  let flowRequesterName = '';
  let flowRequesterEmail = '';
  if (requiresTransferFlow) {
    const flow = getFormFlowState();
    flowTargetName = (flow.targetManagerName || '').trim();
    flowTargetEmail = (flow.targetManagerEmail || '').trim();
    flowRequesterName = (flow.requesterManagerName || '').trim();
    flowRequesterEmail = (flow.requesterManagerEmail || '').trim();
    if (!flowRequesterName || !flowRequesterEmail) {
      showFormFeedback(root, 'Informe o nome e o e-mail do gerente da agência solicitante para concluir a transferência.', 'warning');
      const focusInput = !flowRequesterName
        ? root.querySelector('#omega-flow-requester-name')
        : root.querySelector('#omega-flow-requester-email');
      if (focusInput) {
        requestAnimationFrame(() => {
          try { focusInput.focus(); } catch (err) { /* noop */ }
        });
      }
      return;
    }
    if (!isValidEmail(flowRequesterEmail)) {
      showFormFeedback(root, 'Informe um e-mail corporativo válido para o gerente da agência solicitante.', 'warning');
      const emailInput = root.querySelector('#omega-flow-requester-email');
      if (emailInput) {
        requestAnimationFrame(() => {
          try { emailInput.focus(); emailInput.select(); } catch (err) { /* noop */ }
        });
      }
      return;
    }
    if (!flowTargetName || !flowTargetEmail) {
      showFormFeedback(root, 'Informe o nome e o e-mail do gerente da agência cedente para concluir a transferência.', 'warning');
      const focusInput = !flowTargetName
        ? root.querySelector('#omega-flow-target-name')
        : root.querySelector('#omega-flow-target-email');
      if (focusInput) {
        requestAnimationFrame(() => {
          try { focusInput.focus(); } catch (err) { /* noop */ }
        });
      }
      return;
    }
    if (!isValidEmail(flowTargetEmail)) {
      showFormFeedback(root, 'Informe um e-mail corporativo válido para o gerente da agência cedente.', 'warning');
      const emailInput = root.querySelector('#omega-flow-target-email');
      if (emailInput) {
        requestAnimationFrame(() => {
          try { emailInput.focus(); emailInput.select(); } catch (err) { /* noop */ }
        });
      }
      return;
    }
  }
  const productMeta = OMEGA_PRODUCT_CATALOG.find((item) => item.id === productId) || { label: productId, family: '', section: '' };
  const now = new Date();
  omegaTicketCounter += 1;
  const ticketId = String(omegaTicketCounter);
  const detail = omegaState.contextDetail;
  const context = {
    diretoria: detail?.lineage?.find?.((entry) => entry.levelKey === 'diretoria')?.label || '',
    gerencia: detail?.lineage?.find?.((entry) => entry.levelKey === 'gerencia')?.label || '',
    agencia: detail?.lineage?.find?.((entry) => entry.levelKey === 'agencia')?.label || '',
    ggestao: detail?.lineage?.find?.((entry) => entry.levelKey === 'ggestao')?.label || '',
    gerente: detail?.lineage?.find?.((entry) => entry.levelKey === 'gerente')?.label || '',
    familia: productMeta.family,
    secao: productMeta.section,
    prodsub: productMeta.label,
  };
  const newTicket = {
    id: ticketId,
    subject,
    company: requesterName,
    requesterName,
    productId,
    product: productMeta.label,
    family: productMeta.family,
    section: productMeta.section,
    queue,
    status: 'aberto',
    category,
    priority: 'media',
    dueDate: null,
    opened: now.toISOString(),
    updated: now.toISOString(),
    requesterId: user.id,
    ownerId: ['analista', 'supervisor', 'admin'].includes(user.role) ? user.id : null,
    teamId: user.teamId || null,
    context,
    attachments,
    history: [],
    flow: null,
  };
  appendTicketHistory(
    newTicket,
    {
      date: now.toISOString(),
      actorId: user.id,
      action: 'Abertura do chamado',
      comment: description,
      status: 'aberto',
    },
    { notify: false }
  );
  if (requiresTransferFlow) {
    applyTransferEmpresasFlow(
      newTicket,
      {
        target: { name: flowTargetName, email: flowTargetEmail },
        requester: { name: flowRequesterName, email: flowRequesterEmail },
      },
      user
    );
  }
  OMEGA_TICKETS.unshift(newTicket);
  omegaState.selectedTicketId = newTicket.id;
  omegaState.view = 'my';
  omegaState.search = '';
  resetTablePage();
  setDrawerOpen(false);
  resetFormFlowState();
  renderFormFlowExtras(root);
  renderOmega();
  showOmegaToast('Chamado registrado com sucesso.', 'success');
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
