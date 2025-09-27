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

const OMEGA_QUEUE_OPTIONS = [
  "Encarteiramento",
  "Meta",
  "Orçamento",
  "POBJ",
  "Matriz",
  "Outros",
];

const OMEGA_TICKET_TYPES_BY_DEPARTMENT = {
  Encarteiramento: [
    "Inclusão - Conta Empresas",
    "Inclusão - Conta Varejo",
    "Transferência - Empresas para Empresas",
    "Transferência - Empresas para Varejo",
    "Transferência - Mesma Agência",
    "Transferência - Varejo para Empresas",
  ],
  Meta: ["Contestar Meta"],
  Metas: ["Contestar Meta"],
  "Orçamento": ["A construir"],
  POBJ: [
    "Adicionais",
    "Financeiro",
    "Melhoria de Processos",
    "Negócios",
    "Relacionamento",
  ],
  Matriz: [
    "Relatório/Dashboard",
    "Bases",
    "Estudos",
    "Portal PJ",
  ],
  Outros: ["A construir"],
};

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
  "usr-01": { avatar: "https://i.pravatar.cc/160?img=47", queue: null, teamId: "sudeste" },
  "usr-02": { avatar: "https://i.pravatar.cc/160?img=12", queue: "POBJ Produções", teamId: "sudeste" },
  "usr-03": { avatar: "https://i.pravatar.cc/160?img=32", queue: "POBJ Produções", teamId: "sudeste" },
  "usr-04": { avatar: "https://i.pravatar.cc/160?img=8", queue: null, teamId: null },
  "usr-05": { avatar: "https://i.pravatar.cc/160?img=21", queue: "POBJ Norte", teamId: "norte" },
  "usr-06": { avatar: "https://i.pravatar.cc/160?img=36", queue: null, teamId: "norte" },
  "usr-07": { avatar: "https://i.pravatar.cc/160?img=55", queue: null, teamId: "sudeste" },
  "usr-08": { avatar: "https://i.pravatar.cc/160?img=41", queue: "Mesa Corporate", teamId: "corporate" },
};

let OMEGA_USERS = [];

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
  status: "todos",
  search: "",
  contextDetail: null,
  selectedTicketId: null,
  drawerOpen: false,
  formAttachments: [],
};

let OMEGA_TICKETS = [];
let omegaTicketCounter = 0;
let omegaDataPromise = null;
let omegaUsersPromise = null;
const OMEGA_TICKETS_SOURCE = "Bases/omega_chamados.csv";

function ensureOmegaData(){
  if (OMEGA_TICKETS.length) return Promise.resolve(OMEGA_TICKETS);
  if (omegaDataPromise) return omegaDataPromise;

  const loader = (typeof loadCSVAuto === 'function')
    ? loadCSVAuto(OMEGA_TICKETS_SOURCE).catch((err) => {
        console.warn('Falha ao carregar CSV da Omega via loader principal:', err);
        return fallbackLoadCsv(OMEGA_TICKETS_SOURCE);
      })
    : fallbackLoadCsv(OMEGA_TICKETS_SOURCE);

  omegaDataPromise = loader
    .then((rows) => {
      OMEGA_TICKETS = normalizeOmegaTicketRows(Array.isArray(rows) ? rows : []);
      omegaTicketCounter = OMEGA_TICKETS.reduce((max, ticket) => {
        const raw = String(ticket.id || '').split('-').pop();
        const seq = parseInt(raw, 10);
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

function fallbackLoadCsv(path){
  return fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then((text) => simpleCsvParse(text));
}

function simpleCsvParse(text){
  if (!text) return [];
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  if (!lines.length) return [];
  const header = lines.shift().split(',').map((cell) => cell.trim());
  return lines.map((line) => {
    const cells = [];
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
      } else if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);
    const row = {};
    header.forEach((key, idx) => {
      row[key] = (cells[idx] ?? '').trim();
    });
    return row;
  });
}

function normalizeOmegaUserRows(rows){
  return rows.map((row) => {
    const id = (row.id || row.ID || '').trim();
    const name = (row.nome || row.name || '').trim();
    if (!id || !name) return null;
    const roles = {
      usuario: parseOmegaBoolean(row.usuario),
      atendente: parseOmegaBoolean(row.atendente),
      supervisor: parseOmegaBoolean(row.supervisor),
      admin: parseOmegaBoolean(row.admin),
    };
    const primaryRole = resolvePrimaryRole(roles);
    const meta = OMEGA_USER_METADATA[id] || {};
    return {
      id,
      name,
      role: primaryRole,
      roles,
      avatar: meta.avatar || `https://i.pravatar.cc/160?u=${encodeURIComponent(id)}`,
      queue: meta.queue ?? null,
      teamId: meta.teamId ?? null,
    };
  }).filter(Boolean).sort((a, b) => {
    const orderMap = { usuario: 0, atendente: 1, supervisor: 2, admin: 3 };
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
  const priority = ['admin', 'supervisor', 'atendente', 'usuario'];
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
  const order = ['usuario', 'atendente', 'supervisor', 'admin'];
  return roles.sort((a, b) => (order.indexOf(a) - order.indexOf(b)));
}

function getUserRoleLabel(user){
  if (!user) return 'Usuário';
  const roles = getUserRoles(user);
  if (!roles.length) return OMEGA_ROLE_LABELS[user.role] || 'Usuário';
  if (roles.length === 1) return OMEGA_ROLE_LABELS[roles[0]] || roles[0];
  return roles.map((role) => OMEGA_ROLE_LABELS[role] || role).join(' • ');
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
    const category = (row.category || row.tipo || '').trim();
    const dueDate = (row.due_date || row.prazo || '').trim();
    const historyRaw = row.history || '';
    const history = parseOmegaHistory(historyRaw);
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
      company: (row.company || row.empresa || '').trim(),
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
  Promise.all([ensureOmegaTemplate(), ensureOmegaData(), ensureOmegaUsers()])
    .then(([root]) => {
      if (!root) return;
      setupOmegaModule(root);
      populateUserSelect(root);
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
      /* erros já registrados em ensureOmegaTemplate/ensureOmegaData */
    });
}

function closeOmega(){
  const root = document.getElementById("omega-modal");
  if (!root) return;
  setDrawerOpen(false);
  const shell = root.querySelector('.omega-body');
  if (shell) delete shell.dataset.detailOpen;
  const detail = root.querySelector('#omega-detail');
  if (detail) detail.classList.remove('is-visible');
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

  const departmentSelect = root.querySelector('#omega-form-department');
  const typeSelect = root.querySelector('#omega-form-type');
  const companyInput = root.querySelector('#omega-form-company');
  const fileInput = root.querySelector('#omega-form-file');
  const addFileBtn = root.querySelector('[data-omega-add-file]');
  const attachmentsList = root.querySelector('#omega-form-attachments');
  departmentSelect?.addEventListener('change', (ev) => {
    syncTicketTypeOptions(root, ev.target.value);
    updateOmegaFormSubject(root);
  });
  typeSelect?.addEventListener('change', () => updateOmegaFormSubject(root));
  companyInput?.addEventListener('input', () => updateOmegaFormSubject(root));
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
  renderBreadcrumb(root, user);
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
  if (roleLabel) roleLabel.textContent = getUserRoleLabel(user);
  const select = root.querySelector('#omega-user-select');
  if (select && select.value !== user?.id) select.value = user?.id || '';
}

function renderPermissions(root, user){
  const list = root.querySelector('#omega-permissions-list');
  if (!list) return;
  const roles = getUserRoles(user);
  const unique = [];
  roles.forEach((role) => {
    (OMEGA_ROLE_PERMISSIONS[role] || []).forEach((permission) => {
      if (!unique.includes(permission)) unique.push(permission);
    });
  });
  list.innerHTML = unique.length
    ? unique.map((item) => `<li>${escapeHTML(item)}</li>`).join('')
    : '<li>Sem permissões registradas.</li>';
}

function renderBreadcrumb(root, user){
  const host = root.querySelector('#omega-breadcrumb');
  if (!host) return;
  const view = OMEGA_NAV_ITEMS.find((item) => item.id === omegaState.view);
  const viewLabel = view?.label || 'Visão atual';
  const userLabel = user?.name || 'Usuário';
  host.innerHTML = `
    <span class="omega-breadcrumb__item"><i class="ti ti-user"></i>${escapeHTML(userLabel)}</span>
    <span class="omega-breadcrumb__sep"><i class="ti ti-chevron-right"></i></span>
    <span class="omega-breadcrumb__item">${escapeHTML(viewLabel)}</span>
  `;
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
    omegaState.selectedTicketId = null;
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
  const shell = root.querySelector('.omega-body');
  if (!host) return;
  if (!tickets.length) {
    host.classList.remove('is-visible');
    if (shell) shell.dataset.detailOpen = 'false';
    if (baseTickets.length) {
      host.innerHTML = `<div class="omega-detail__empty"><i class="ti ti-info-circle"></i><span>Ajuste os filtros para visualizar os chamados desta visão.</span></div>`;
    } else {
      host.innerHTML = `<div class="omega-detail__empty"><i class="ti ti-ticket"></i><span>Nenhum chamado disponível para o recorte atual.</span></div>`;
    }
    return;
  }
  const ticket = tickets.find((item) => item.id === omegaState.selectedTicketId) || null;
  if (!ticket) {
    host.classList.remove('is-visible');
    if (shell) shell.dataset.detailOpen = 'false';
    host.innerHTML = `<div class="omega-detail__empty"><i class="ti ti-ticket"></i><span>Selecione um chamado na lista ao lado.</span></div>`;
    return;
  }
  host.classList.add('is-visible');
  if (shell) shell.dataset.detailOpen = 'true';
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

function createLocalId(prefix = 'id'){
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
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

function syncTicketTypeOptions(container, department){
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
    resetFormAttachments(root);
    clearFormFeedback(root);
  }
}

function populateUserSelect(root){
  const select = root.querySelector('#omega-user-select');
  if (!select) return;
  if (!OMEGA_USERS.length) {
    select.innerHTML = '';
    return;
  }
  const order = { usuario: 0, atendente: 1, supervisor: 2, admin: 3 };
  const options = [...OMEGA_USERS].sort((a, b) => {
    const roleDiff = (order[a.role] ?? 10) - (order[b.role] ?? 10);
    if (roleDiff !== 0) return roleDiff;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  select.innerHTML = options.map((user) => {
    const label = getUserRoleLabel(user);
    return `<option value="${user.id}">${escapeHTML(user.name)} — ${escapeHTML(label)}</option>`;
  }).join('');
  const defaultId = omegaState.currentUserId || options[0]?.id || '';
  select.value = defaultId;
  omegaState.currentUserId = defaultId || null;
}

function populateFormOptions(root){
  const form = root.querySelector('#omega-form');
  if (!form) return;
  const departmentSelect = form.querySelector('#omega-form-department');
  if (departmentSelect && !departmentSelect.options.length) {
    departmentSelect.innerHTML = OMEGA_QUEUE_OPTIONS.map((item) => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join('');
    if (OMEGA_QUEUE_OPTIONS.length) {
      departmentSelect.value = OMEGA_QUEUE_OPTIONS[0];
    }
  }
  const department = departmentSelect?.value || OMEGA_QUEUE_OPTIONS[0] || '';
  syncTicketTypeOptions(form, department);
  renderFormAttachments(root);
}

function buildOmegaSubject({ typeLabel = '', productLabel = '', company = '' } = {}){
  const parts = [];
  if (typeLabel) parts.push(typeLabel);
  if (productLabel && !parts.includes(productLabel)) parts.push(productLabel);
  if (company) parts.push(company);
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
  const company = form.querySelector('#omega-form-company')?.value?.trim() || '';
  subjectInput.value = buildOmegaSubject({
    typeLabel,
    productLabel: productMeta?.label || '',
    company,
  });
}

function prefillTicketForm(root){
  const form = root.querySelector('#omega-form');
  if (!form) return;
  resetFormAttachments(root);
  const productInput = form.querySelector('#omega-form-product');
  const departmentSelect = form.querySelector('#omega-form-department');
  const companyInput = form.querySelector('#omega-form-company');
  const observationInput = form.querySelector('#omega-form-observation');
  const contextList = form.querySelector('#omega-form-context');

  const detail = omegaState.contextDetail;
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
    const user = getCurrentUser();
    if (user?.queue && OMEGA_QUEUE_OPTIONS.includes(user.queue)) {
      departmentSelect.value = user.queue;
    } else {
      departmentSelect.selectedIndex = 0;
    }
    syncTicketTypeOptions(form, departmentSelect.value || OMEGA_QUEUE_OPTIONS[0] || '');
  } else {
    syncTicketTypeOptions(form, OMEGA_QUEUE_OPTIONS[0] || '');
  }
  if (companyInput) {
    companyInput.value = detail?.label && (detail.levelKey === 'contrato' || detail.levelKey === 'cliente') ? detail.label : '';
  }
  updateOmegaFormSubject(root);
  if (observationInput) {
    observationInput.value = '';
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
    contextList.innerHTML = chips.length
      ? chips.map((chip) => `<li>${escapeHTML(chip)}</li>`).join('')
      : '<li>Nenhum contexto detectado</li>';
  }
  clearFormFeedback(root);
}

function handleNewTicketSubmit(form){
  const root = document.getElementById('omega-modal');
  if (!root) return;
  updateOmegaFormSubject(root);
  const company = form.querySelector('#omega-form-company')?.value?.trim();
  const productId = form.querySelector('#omega-form-product')?.value;
  const category = form.querySelector('#omega-form-type')?.value;
  const queue = form.querySelector('#omega-form-department')?.value;
  const subject = form.querySelector('#omega-form-subject')?.value?.trim();
  const description = form.querySelector('#omega-form-observation')?.value?.trim();
  const attachments = Array.isArray(omegaState.formAttachments)
    ? omegaState.formAttachments.map((item) => item.name)
    : [];
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
    company,
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
    ownerId: ['atendente', 'supervisor', 'admin'].includes(user.role) ? user.id : null,
    teamId: user.teamId || null,
    context,
    attachments,
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
