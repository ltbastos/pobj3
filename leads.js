/* ===== Leads propensos (oportunidades) ===== */
let leadsTemplatePromise = null;

function ensureLeadsTemplate(){
  const existing = document.getElementById("leads-modal");
  if (existing) return Promise.resolve(existing);
  if (leadsTemplatePromise) return leadsTemplatePromise;

  leadsTemplatePromise = fetch("leads.html")
    .then(res => {
      if (!res.ok) throw new Error(`Falha ao carregar leads.html: ${res.status}`);
      return res.text();
    })
    .then(html => {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html.trim();
      const fragment = document.createDocumentFragment();
      while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
      document.body.appendChild(fragment);
      return document.getElementById("leads-modal");
    })
    .catch(err => {
      console.error("Não foi possível carregar o template de leads:", err);
      leadsTemplatePromise = null;
      throw err;
    });

  return leadsTemplatePromise;
}

const OPPORTUNITY_LEVEL_SEQUENCE = ["diretoria","gerencia","agencia","gGestao","gerente","secao","familia","prodsub"];
const OPPORTUNITY_LEVEL_ORDER = new Map(OPPORTUNITY_LEVEL_SEQUENCE.map((key, index) => [key, index]));
const OPPORTUNITY_LEVEL_OPTIONS = [
  { key:"prodsub", label:"Indicador" },
  { key:"familia", label:"Família" },
  { key:"secao", label:"Seção" },
];
const OPPORTUNITY_LEVEL_LABELS = {
  diretoria:"Diretoria",
  gerencia:"Regional",
  agencia:"Agência",
  gGestao:"Gerente de gestão",
  gerente:"Gerente",
  secao:"Seção",
  familia:"Família",
  prodsub:"Indicador",
  contrato:"Contrato",
};
const OPPORTUNITY_LEVEL_PRIORITY = ["prodsub","familia","secao"];
const OPPORTUNITY_MODAL_ALLOWED_LEVELS = new Set(OPPORTUNITY_LEVEL_PRIORITY);
const OPPORTUNITY_DIMENSION_FIELD = {
  diretoria:"diretoria",
  gerencia:"gerenciaRegional",
  agencia:"agencia",
  gGestao:"gerenteGestao",
  gerente:"gerente",
  secao:"secaoId",
  familia:"familia",
  prodsub:"prodOrSub",
};

const LEAD_CONTACT_CHANNELS = ["Telefone","WhatsApp","E-mail","Visita presencial","Videochamada"];
const LEAD_CONTACT_OUTCOMES = [
  "Retorno agendado",
  "Negociação em andamento",
  "Cliente pediu proposta",
  "Sem contato - deixou recado",
  "Interesse alto no produto"
];
const LEAD_CONTACT_USERS = [
  "Marina Prado",
  "Thiago Azevedo",
  "Fernanda Mota",
  "Ricardo Fontes",
  "Larissa Galvão",
  "Paulo Mendes",
  "Camila Ribeiro",
  "Júlio Santana",
  "Beatriz Antunes",
  "André Figueiredo"
];
const LEAD_HISTORY_SAMPLE_COMMENTS = [
  "Cliente solicitou nova simulação e aguarda retorno.",
  "Contato positivo: encaminhamos proposta revisada por e-mail.",
  "Responsável financeiro prefere avançar após aprovação interna.",
  "Lead pediu tempo para comparar ofertas com a concorrência.",
  "Reunião presencial agendada para reforçar benefícios do produto."
];

let OPPORTUNITY_LEADS_RAW = [];
let OPPORTUNITY_LEADS = [];
let OPPORTUNITY_LEADS_MAP = new Map();
let opportunityModalBound = false;
const LEAD_CONTACT_UI = {
  drawer: null,
  form: null,
  company: null,
  product: null,
  credit: null,
  origin: null,
  context: null,
  dateInput: null,
  commentInput: null,
  responsavelInput: null,
  idInput: null,
};

function ensureOpportunityDataset(){
  if (!OPPORTUNITY_LEADS.length && OPPORTUNITY_LEADS_RAW.length) {
    ingestOpportunityLeadRows(OPPORTUNITY_LEADS_RAW);
  }
  return OPPORTUNITY_LEADS;
}

function rebuildOpportunityLeads(rows = OPPORTUNITY_LEADS_RAW){
  try {
    OPPORTUNITY_LEADS_RAW = Array.isArray(rows) ? rows : [];
    ingestOpportunityLeadRows(OPPORTUNITY_LEADS_RAW);
  } catch (err) {
    console.warn("Falha ao gerar leads propensos:", err);
    OPPORTUNITY_LEADS = [];
    OPPORTUNITY_LEADS_MAP.clear();
  }
}

function ingestOpportunityLeadRows(rows = []){
  OPPORTUNITY_LEADS = normalizarLinhasLeads(rows);
  OPPORTUNITY_LEADS_MAP = new Map(OPPORTUNITY_LEADS.map(lead => [lead.id, lead]));
  return OPPORTUNITY_LEADS;
}

function normalizarLinhasLeads(rows = []){
  if (!Array.isArray(rows)) return [];
  const dataset = [];

  rows.forEach((raw, index) => {
    const empresa = lerCelula(raw, ["Nome da empresa", "Empresa", "Lead", "Razao Social"]);
    if (!empresa) return;

    const produtoTexto = lerCelula(raw, ["Indicador ID", "Produto propenso", "Produto", "Indicador"]);
    const produtoIdBase = resolverIndicadorPorAlias(produtoTexto) || lerCelula(raw, ["Produto propenso ID", "Produto ID"]);
    const produtoId = produtoIdBase || (simplificarTexto(produtoTexto).replace(/[^a-z0-9]+/g, "_") || `produto_${index + 1}`);
    const produtoMeta = PRODUTO_TO_FAMILIA.get(produtoId) || null;
    const produtoNome = produtoMeta?.nome || PRODUCT_INDEX.get(produtoId)?.name || produtoTexto || produtoId;

    const familiaTexto = lerCelula(raw, ["Familia do produto propenso", "Família do produto propenso", "Familia", "Família"]);
    let familiaId = produtoMeta?.id || resolverIndicadorPorAlias(familiaTexto) || simplificarTexto(familiaTexto).replace(/[^a-z0-9]+/g, "_") || produtoId;
    let familiaNome = produtoMeta?.nome || familiaTexto || familiaId;
    if (!familiaNome) familiaNome = familiaId;

    const secaoTexto = lerCelula(raw, ["Secao do produto propenso", "Seção do produto propenso", "Secao", "Seção"]);
    const secaoResolved = resolveSectionFromText(secaoTexto, produtoMeta?.secaoId || PRODUCT_INDEX.get(produtoId)?.sectionId || "");
    const secaoId = secaoResolved.id;
    const secaoNome = secaoResolved.nome || secaoId;

    const diretoriaNomeCsv = lerCelula(raw, ["Diretoria do cliente", "Diretoria"]);
    const diretoriaIdCsv = lerCelula(raw, ["Diretoria do cliente ID", "Diretoria ID"]);
    const diretoriaMeta = findDiretoriaMeta(diretoriaIdCsv || diretoriaNomeCsv) || {};
    const diretoriaId = diretoriaMeta?.id || diretoriaIdCsv || diretoriaNomeCsv || "";
    const diretoriaNome = diretoriaMeta?.nome || diretoriaNomeCsv || diretoriaId;

    const regionalNomeCsv = lerCelula(raw, ["Regional do cliente", "Regional"]);
    const regionalIdCsv = lerCelula(raw, ["Regional do cliente ID", "Id Gerencia Regional"]);
    const gerenciaMeta = findGerenciaMeta(regionalIdCsv || regionalNomeCsv) || {};
    const gerenciaId = gerenciaMeta?.id || regionalIdCsv || regionalNomeCsv || "";
    const regionalNome = gerenciaMeta?.nome || gerenciaMeta?.regional || regionalNomeCsv || gerenciaId;

    const agenciaNomeCsv = lerCelula(raw, ["Agencia do cliente", "Agência do cliente", "Agencia"]);
    const agenciaIdCsv = lerCelula(raw, ["Agencia do cliente ID", "Agencia ID"]);
    const agenciaMeta = findAgenciaMeta(agenciaIdCsv || agenciaNomeCsv) || {};
    const agenciaId = agenciaMeta?.agenciaId || agenciaMeta?.id || agenciaIdCsv || agenciaNomeCsv || "";
    const agenciaNome = agenciaMeta?.agenciaNome || agenciaNomeCsv || agenciaId;
    const agenciaCodigo = agenciaMeta?.agenciaCodigo || agenciaId;

    const ggestaoNomeCsv = lerCelula(raw, ["Gerente de gestao do cliente", "Gerente de gestão do cliente", "Gerente de gestao"]);
    const ggestaoIdCsv = lerCelula(raw, ["Gerente de gestao do cliente ID", "Id Gerente de Gestao"]);
    const ggestaoMeta = findGerenteGestaoMeta(ggestaoIdCsv || ggestaoNomeCsv) || {};
    const gerenteGestaoId = ggestaoMeta?.id || ggestaoIdCsv || ggestaoNomeCsv || "";
    const gerenteGestaoNome = ggestaoMeta?.nome || ggestaoNomeCsv || gerenteGestaoId;

    const gerenteNomeCsv = lerCelula(raw, ["Gerente do cliente", "Gerente"]);
    const gerenteIdCsv = lerCelula(raw, ["Gerente do cliente ID", "Gerente ID"]);
    const gerenteMeta = findGerenteMeta(gerenteIdCsv || gerenteNomeCsv) || {};
    const gerenteId = gerenteMeta?.id || gerenteIdCsv || gerenteNomeCsv || "";
    const gerenteNome = gerenteMeta?.nome || gerenteNomeCsv || gerenteId;

    const responsavelContato = lerCelula(raw, ["Responsavel pelo contato", "Responsável pelo contato"]);
    const comentarioBruto = lerCelula(raw, ["Comentario", "Comentário"]);
    const comentario = typeof comentarioBruto === "string" ? comentarioBruto.trim() : "";
    const origemTexto = lerCelula(raw, ["Origem do lead", "Origem"]);
    const origemKey = simplificarTexto(origemTexto) || "smart";
    const origemLabel = origemTexto || (origemKey === "link" ? "Link" : "Smart");

    const dataBase = converterDataISO(lerCelula(raw, ["Database", "Data base", "Data modelo"])) || todayISO();
    const contatoISO = converterDataISO(lerCelula(raw, ["Data do contato", "Data contato", "Último contato"])) || todayISO();

    const creditoPreAprovado = Math.max(0, parseLeadCurrency(lerCelula(raw, ["Credito pre aprovado", "Crédito pre aprovado", "Credito", "Crédito pré aprovado"])));

    const lead = {
      id: makeLeadId(empresa, produtoId, index + 1),
      empresa,
      segmento: secaoNome || familiaNome,
      diretoria: diretoriaId,
      diretoriaNome,
      gerenciaRegional: gerenciaId,
      regional: regionalNome,
      agencia: agenciaId,
      agenciaNome,
      agenciaCodigo,
      gerenteGestao: gerenteGestaoId,
      gerenteGestaoNome,
      gerente: gerenteId,
      gerenteNome,
      secaoId,
      secaoNome,
      familia: familiaId,
      familiaNome,
      prodOrSub: produtoId,
      produtoId,
      produtoNome,
      dataBase,
      ultimoComentario: comentario,
      ultimoUsuario: responsavelContato || gerenteNome,
      ultimoContatoData: contatoISO,
      creditoPreAprovado,
      origem: origemKey,
      origemLabel,
      score: 0.65 + ((index % 7) * 0.03),
    };

    const historySeed = index + 1;
    const baseHistory = contatoISO || dataBase;
    const olderHistory = buildLeadHistory(baseHistory, historySeed).slice(0, 2);
    const canalLabel = origemKey === "link" ? "Origem Link" : origemKey === "smart" ? "Smart Lead" : "Contato";
    const latestEntry = {
      data: contatoISO,
      canal: canalLabel,
      resultado: comentario ? "Comentário registrado" : "Contato registrado",
      usuario: lead.ultimoUsuario || LEAD_CONTACT_USERS[historySeed % LEAD_CONTACT_USERS.length],
      comentario,
    };
    const historico = [latestEntry, ...olderHistory].filter(entry => entry && entry.data);
    historico.sort((a, b) => (a.data > b.data ? -1 : 1));
    lead.historico = historico.slice(0, 3);

    dataset.push(lead);
  });

  dataset.sort((a, b) => (b.creditoPreAprovado || 0) - (a.creditoPreAprovado || 0));
  return dataset;
}

function parseLeadCurrency(value){
  const text = limparTexto(value);
  if (!text) return 0;
  const normalized = text.replace(/\./g, "").replace(",", ".");
  return toNumber(normalized);
}

function resolveSectionFromText(text, fallbackId = "") {
  const normalized = simplificarTexto(text);
  if (normalized) {
    for (const [id, sec] of SECTION_BY_ID.entries()) {
      if (simplificarTexto(id) === normalized || simplificarTexto(sec.label) === normalized) {
        return { id, nome: sec.label };
      }
    }
  }
  if (fallbackId) {
    const section = SECTION_BY_ID.get(fallbackId);
    if (section) {
      return { id: section.id, nome: section.label };
    }
    return { id: fallbackId, nome: getSectionLabel(fallbackId) || fallbackId };
  }
  if (text) {
    const id = simplificarTexto(text).replace(/[^a-z0-9]+/g, "_") || text;
    return { id, nome: text };
  }
  return { id: "", nome: "" };
}

function getOpportunityLeadById(id){
  if (!id) return null;
  if (OPPORTUNITY_LEADS_MAP.has(id)) return OPPORTUNITY_LEADS_MAP.get(id);
  const dataset = ensureOpportunityDataset();
  return dataset.find(lead => lead.id === id) || null;
}

function makeLeadId(name, prodKey, index){
  const base = simplificarTexto(name).replace(/\s+/g, "-") || "lead";
  const prod = simplificarTexto(prodKey).replace(/\s+/g, "-") || "produto";
  return `lead-${base.slice(0,18)}-${prod.slice(0,18)}-${index}`;
}

function buildLeadHistory(baseISO, seed = 0){
  const base = dateUTCFromISO(baseISO || todayISO());
  const anchor = base instanceof Date && !Number.isNaN(base) ? base : dateUTCFromISO(todayISO());
  const history = [];
  for (let i = 0; i < 3; i++) {
    const dt = new Date(anchor);
    const offset = (seed % 5) * 2 + i * 3 + 1;
    dt.setUTCDate(dt.getUTCDate() - offset);
    const data = isoFromUTCDate(dt);
    const canal = LEAD_CONTACT_CHANNELS[(seed + i) % LEAD_CONTACT_CHANNELS.length];
    const resultado = LEAD_CONTACT_OUTCOMES[(seed + i) % LEAD_CONTACT_OUTCOMES.length];
    const usuario = LEAD_CONTACT_USERS[(seed + i) % LEAD_CONTACT_USERS.length];
    const hasComment = ((seed + i) % 3) === 0;
    const comentario = hasComment
      ? LEAD_HISTORY_SAMPLE_COMMENTS[(seed + i) % LEAD_HISTORY_SAMPLE_COMMENTS.length]
      : "";
    history.push({ data, canal, resultado, usuario, comentario });
  }
  history.sort((a, b) => (a.data > b.data ? -1 : 1));
  return history;
}

function shiftISODate(baseISO, delta = 0){
  const base = dateUTCFromISO(baseISO || todayISO());
  if (!(base instanceof Date) || Number.isNaN(base)) return baseISO;
  base.setUTCDate(base.getUTCDate() + delta);
  return isoFromUTCDate(base);
}

function resolveOpportunityTargetLevel(lineage = [], baseFilters = new Map()){
  const path = Array.isArray(lineage) ? lineage : [];
  for (let i = path.length - 1; i >= 0; i--) {
    const key = path[i]?.levelKey;
    if (OPPORTUNITY_MODAL_ALLOWED_LEVELS.has(key)) return key;
  }
  const filters = baseFilters instanceof Map ? baseFilters : new Map();
  for (const key of OPPORTUNITY_LEVEL_PRIORITY) {
    if (filters.has(key)) return key;
  }
  return OPPORTUNITY_LEVEL_PRIORITY[OPPORTUNITY_LEVEL_PRIORITY.length - 1] || "secao";
}

function defaultOpportunityLevel(lineage = [], baseFilters = new Map()){
  return resolveOpportunityTargetLevel(lineage, baseFilters);
}

function sanitizeOpportunityLevel(levelKey, lineage = [], baseFilters = new Map()){
  if (OPPORTUNITY_MODAL_ALLOWED_LEVELS.has(levelKey)) return levelKey;
  return resolveOpportunityTargetLevel(lineage, baseFilters);
}

function opportunityFilterKeysForLevel(levelKey){
  const targetIndex = OPPORTUNITY_LEVEL_ORDER.has(levelKey)
    ? OPPORTUNITY_LEVEL_ORDER.get(levelKey)
    : OPPORTUNITY_LEVEL_ORDER.get("prodsub");
  if (targetIndex == null) return [];
  return OPPORTUNITY_LEVEL_SEQUENCE.filter(key => (OPPORTUNITY_LEVEL_ORDER.get(key) ?? Infinity) <= targetIndex);
}

function leadMatchesDimension(lead = {}, levelKey, expected){
  if (!expected) return true;
  const normalizedExpected = simplificarTexto(expected);
  if (!normalizedExpected) return true;
  const field = OPPORTUNITY_DIMENSION_FIELD[levelKey];
  const check = (value) => simplificarTexto(value) === normalizedExpected;
  if (field && check(lead[field])) return true;
  switch (levelKey) {
    case "diretoria": return check(lead.diretoriaNome);
    case "gerencia": return check(lead.regional);
    case "agencia": return check(lead.agenciaNome);
    case "gGestao": return check(lead.gerenteGestaoNome);
    case "gerente": return check(lead.gerenteNome);
    case "secao": return check(lead.secaoNome);
    case "familia": return check(lead.familiaNome);
    case "prodsub": return check(lead.produtoNome);
    default: return false;
  }
}

function filterOpportunityLeads(levelKey, dataset = [], baseFilters = new Map()){
  const keys = opportunityFilterKeysForLevel(levelKey);
  return dataset.filter(lead => keys.every(key => {
    const expected = baseFilters instanceof Map ? baseFilters.get(key) : null;
    if (!expected) return true;
    return leadMatchesDimension(lead, key, expected);
  }));
}

function renderLeadHistoryList(history = []){
  if (!Array.isArray(history) || !history.length) {
    return `<p class="lead-detail__history-empty">Nenhum contato registrado até o momento.</p>`;
  }
  return `<ul class="lead-history">${history.slice(0, 3).map(entry => {
    const data = formatBRDate(entry?.data) || "—";
    const canal = escapeHTML(entry?.canal || "—");
    const status = escapeHTML(entry?.resultado || "");
    const usuario = limparTexto(entry?.usuario) ? escapeHTML(entry.usuario) : "";
    const comentario = limparTexto(entry?.comentario) ? escapeHTML(entry.comentario) : "";
    const userBlock = usuario ? `<span class="lead-history__user"><strong>Responsável:</strong> ${usuario}</span>` : "";
    const commentBlock = comentario ? `<p class="lead-history__comment">${comentario}</p>` : "";
    return `<li class="lead-history__item">
      <div class="lead-history__meta">
        <span class="lead-history__date">${data}</span>
        <span class="lead-history__channel">${canal}</span>
        <span class="lead-history__status">${status}</span>
      </div>
      ${userBlock}
      ${commentBlock}
    </li>`;
  }).join("")}</ul>`;
}

function renderLeadComment(lead = {}, { includeDate = true } = {}){
  const comment = limparTexto(lead?.ultimoComentario) ? escapeHTML(lead.ultimoComentario) : "Sem comentários registrados.";
  const usuario = lead?.ultimoUsuario ? escapeHTML(lead.ultimoUsuario) : "";
  const data = includeDate && lead?.ultimoContatoData ? formatBRDate(lead.ultimoContatoData) : "";
  const metaParts = [];
  if (usuario) metaParts.push(usuario);
  if (includeDate && data) metaParts.push(data);
  const meta = metaParts.length ? metaParts.join(" • ") : "—";
  return `<div class="lead-comment"><p class="lead-comment__text">${comment}</p><span class="lead-comment__meta">${meta}</span></div>`;
}

function renderOpportunityTable(leads = []){
  const selectedId = state.opportunities?.detail?.selectedId || "";
  const rows = leads.map(lead => {
    const isActive = selectedId && lead.id === selectedId;
    const databaseLabel = formatBRDate(lead.dataBase) || "—";
    const empresaHtml = `<div class="lead-company"><strong>${escapeHTML(lead.empresa || "—")}</strong>${lead.segmento ? `<span>${escapeHTML(lead.segmento)}</span>` : ""}<small>Database ${escapeHTML(databaseLabel)}</small>${lead.agenciaNome ? `<span class="lead-company__tag">${escapeHTML(lead.agenciaNome)}</span>` : ""}</div>`;
    const produtoLabel = escapeHTML(lead.produtoNome || lead.prodOrSub || "—");
    const familiaLabel = limparTexto(lead.familiaNome || lead.familia) ? escapeHTML(lead.familiaNome || lead.familia) : "";
    const secaoLabel = limparTexto(lead.secaoNome || lead.secaoId) ? escapeHTML(lead.secaoNome || lead.secaoId) : "";
    const propHtml = `<div class="lead-propensity"><strong>${produtoLabel}</strong>${familiaLabel ? `<span>${familiaLabel}</span>` : ""}${secaoLabel ? `<small>${secaoLabel}</small>` : ""}</div>`;
    const lastContactStamp = formatBRDate(lead.ultimoContatoData) || "Sem contato registrado";
    const comentarioHtml = renderLeadComment(lead, { includeDate: false });
    const lastContactHtml = `<div class="lead-last-contact"><span class="lead-last-contact__stamp">${escapeHTML(lastContactStamp)}</span>${comentarioHtml}</div>`;
    const credito = fmtBRL.format(lead.creditoPreAprovado || 0);
    const actionButton = `<div class="lead-actions"><button type="button" class="icon-btn lead-action-btn" data-lead-action="add-contact" data-lead-id="${escapeHTML(lead.id)}" aria-label="Registrar contato"><i class="ti ti-user-plus"></i><span>Registrar contato</span></button></div>`;
    const rowClass = isActive ? " class=\"is-active-row\"" : "";
    return `<tr${rowClass} data-lead-id="${escapeHTML(lead.id)}">
      <td>${empresaHtml}</td>
      <td>${propHtml}</td>
      <td>${lastContactHtml}</td>
      <td><span class="lead-credit">${credito}</span></td>
      <td>${actionButton}</td>
    </tr>`;
  }).join("");

  return `<div class="lead-table-wrapper">
    <table class="lead-table">
      <thead>
        <tr>
          <th>Empresa</th>
          <th>Propensão</th>
          <th>Último contato</th>
          <th>Crédito pré-aprovado</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}
function renderLeadDetailPanel(lead){
  if (!lead) {
    return `<p class="lead-detail__empty">Selecione um lead para ver o histórico e os detalhes completos.</p>`;
  }

  const databaseLabel = formatBRDate(lead.dataBase) || "—";
  const empresa = escapeHTML(lead.empresa || "—");
  const produto = escapeHTML(lead.produtoNome || lead.prodOrSub || "—");
  const familiaLabel = limparTexto(lead.familiaNome || lead.familia) ? escapeHTML(lead.familiaNome || lead.familia) : "";
  const secaoLabel = limparTexto(lead.secaoNome || lead.secaoId) ? escapeHTML(lead.secaoNome || lead.secaoId) : "";
  const contexto = [
    { label:"Diretoria", value: lead.diretoriaNome || lead.diretoria },
    { label:"Regional", value: lead.regional || lead.gerenciaRegional },
    { label:"Agência", value: lead.agenciaNome || lead.agencia },
    { label:"Gerente de gestão", value: lead.gerenteGestaoNome || lead.gerenteGestao },
    { label:"Gerente", value: lead.gerenteNome || lead.gerente },
  ].filter(item => limparTexto(item.value));
  const contextHtml = contexto.length
    ? contexto.map(item => `<span><strong>${escapeHTML(item.label)}:</strong> ${escapeHTML(item.value)}</span>`).join("")
    : `<span class="lead-detail__empty">Contexto não disponível.</span>`;

  const credit = fmtBRL.format(lead.creditoPreAprovado || 0);
  const originKey = simplificarTexto(lead.origem || lead.origemLabel || "");
  const originLabel = escapeHTML(lead.origemLabel || (originKey === "link" ? "Link" : originKey === "smart" ? "Smart" : (lead.origem || "—")));
  const responsavel = lead.ultimoUsuario ? escapeHTML(lead.ultimoUsuario) : "—";
  const ultimoContato = lead.ultimoContatoData ? formatBRDate(lead.ultimoContatoData) : "Sem contato registrado";
  const historyHtml = renderLeadHistoryList(lead.historico);
  const commentHtml = renderLeadComment(lead);

  return `
    <div class="lead-detail__header">
      <span class="lead-detail__eyebrow">Database ${escapeHTML(databaseLabel)}</span>
      <h5>${empresa}</h5>
      <p class="lead-detail__product">${produto}${familiaLabel ? ` • ${familiaLabel}` : ""}${secaoLabel ? ` • ${secaoLabel}` : ""}</p>
    </div>
    <div class="lead-detail__meta">
      <div class="lead-detail__meta-item">
        <span class="lead-detail__label">Crédito pré-aprovado</span>
        <strong>${credit}</strong>
      </div>
      <div class="lead-detail__meta-item">
        <span class="lead-detail__label">Origem do lead</span>
        <span class="lead-origin-badge" data-origin="${escapeHTML(originKey || "outro")}">${originLabel}</span>
      </div>
      <div class="lead-detail__meta-item">
        <span class="lead-detail__label">Último contato</span>
        <strong>${escapeHTML(ultimoContato)}</strong>
      </div>
      <div class="lead-detail__meta-item">
        <span class="lead-detail__label">Responsável</span>
        <strong>${responsavel}</strong>
      </div>
    </div>
    <div class="lead-detail__context">${contextHtml}</div>
    <div class="lead-detail__block">
      <h6>Histórico de contatos</h6>
      ${historyHtml}
    </div>
    <div class="lead-detail__block">
      <h6>Último comentário</h6>
      ${commentHtml}
    </div>
  `;
}

function updateLeadDetailPanel(lead){
  const modal = document.getElementById("leads-modal");
  if (!modal) return;
  const detail = modal.querySelector("#lead-detail-panel");
  if (!detail) return;
  detail.innerHTML = renderLeadDetailPanel(lead);
}

function applyLeadRowSelection(leadId, { scrollIntoView = false } = {}){
  const modal = document.getElementById("leads-modal");
  if (!modal) return;
  const rows = modal.querySelectorAll(".lead-table tbody tr");
  rows.forEach(row => {
    const match = leadId && row.getAttribute("data-lead-id") === leadId;
    row.classList.toggle("is-active-row", Boolean(match));
    if (match && scrollIntoView) {
      row.scrollIntoView({ block: "nearest" });
    }
  });
}

function setOpportunitySelectedLead(leadId, { focusRow = false, silent = false } = {}){
  if (!state.opportunities.open) return;
  if (!state.opportunities.detail) state.opportunities.detail = { selectedId:null };
  const lead = leadId ? getOpportunityLeadById(leadId) : null;
  if (!lead) {
    state.opportunities.detail.selectedId = null;
    applyLeadRowSelection("");
    updateLeadDetailPanel(null);
    if (!silent && state.opportunities.contact?.open) {
      closeLeadContactDrawer({ silent: true });
    }
    return null;
  }

  state.opportunities.detail.selectedId = lead.id;
  applyLeadRowSelection(lead.id, { scrollIntoView: focusRow });
  updateLeadDetailPanel(lead);

  if (state.opportunities.contact?.open) {
    if (state.opportunities.contact.leadId !== lead.id) {
      state.opportunities.contact.leadId = lead.id;
      if (!silent) {
        populateLeadContactDrawer(lead);
      }
    } else if (!silent) {
      populateLeadContactDrawer(lead, { preserveInputs: true });
    }
  }

  return lead;
}

function renderOpportunityModal(){
  const modal = document.getElementById("leads-modal");
  if (!modal || !state.opportunities.open) return;

  const dataset = ensureOpportunityDataset();
  const lineage = Array.isArray(state.opportunities.lineage) ? state.opportunities.lineage : [];
  const baseFilters = state.opportunities.baseFilters instanceof Map ? state.opportunities.baseFilters : new Map();
  const level = sanitizeOpportunityLevel(state.opportunities.selectedLevel, lineage, baseFilters);
  state.opportunities.selectedLevel = level;
  const filtered = filterOpportunityLeads(level, dataset, baseFilters);
  state.opportunities.filtered = filtered;

  const subtitleEl = modal.querySelector("#leads-modal-subtitle");
  const contextWrap = modal.querySelector("#leads-modal-context");
  const summaryEl = modal.querySelector("#leads-modal-summary");
  const listWrap = modal.querySelector("#leads-modal-list");
  if (!state.opportunities.detail) state.opportunities.detail = { selectedId:null };
  const detailState = state.opportunities.detail;
  let selectedLead = null;
  if (detailState.selectedId) {
    selectedLead = filtered.find(lead => lead.id === detailState.selectedId) || null;
    if (!selectedLead) {
      detailState.selectedId = null;
    }
  }
  if (!selectedLead && state.opportunities.contact?.leadId) {
    selectedLead = filtered.find(lead => lead.id === state.opportunities.contact.leadId) || null;
    if (selectedLead) {
      detailState.selectedId = selectedLead.id;
    }
  }
  if (!filtered.length) {
    detailState.selectedId = null;
  }

  const levelLabel = OPPORTUNITY_LEVEL_LABELS[level] || "Contexto";
  const lineageMap = new Map(lineage.map(entry => [entry.levelKey, entry]));
  const focusEntry = lineageMap.get(level) || lineage[lineage.length - 1] || null;
  const focusLabel = focusEntry ? (focusEntry.label || focusEntry.value || "") : "";

  if (subtitleEl) {
    if (focusEntry && focusLabel) {
      subtitleEl.textContent = `${levelLabel} selecionado: ${focusLabel}. Os leads exibidos respeitam o contexto atual dos filtros.`;
    } else {
      subtitleEl.textContent = "Empresas com maior propensão considerando o contexto atual dos filtros aplicados.";
    }
  }

  if (contextWrap) {
    if (lineage.length) {
      contextWrap.innerHTML = lineage
        .map(entry => {
          const label = entry?.label || entry?.value || "";
          if (!label) return "";
          const levelText = OPPORTUNITY_LEVEL_LABELS[entry.levelKey] || entry.levelKey || "";
          return `<span class="lead-context-badge"><strong>${escapeHTML(levelText)}:</strong> ${escapeHTML(label)}</span>`;
        })
        .filter(Boolean)
        .join("");
    } else {
      contextWrap.innerHTML = `<p class="lead-empty">Contexto geral do funil selecionado.</p>`;
    }
  }

  if (summaryEl) {
    const totalCredit = filtered.reduce((acc, lead) => acc + (lead.creditoPreAprovado || 0), 0);
    const countLabel = filtered.length === 1 ? "1 lead propenso" : `${fmtINT.format(filtered.length)} leads propensos`;
    summaryEl.innerHTML = `<strong>${countLabel}</strong> no nível <strong>${levelLabel}</strong> • Crédito pré-aprovado total: <strong>${fmtBRL.format(totalCredit)}</strong>`;
  }

  if (listWrap) {
    if (!filtered.length) {
      listWrap.innerHTML = `<p class="lead-empty">Nenhum lead propenso encontrado para o nível selecionado com os filtros atuais.</p>`;
      if (state.opportunities.contact?.open) {
        closeLeadContactDrawer({ silent: true });
      }
    } else {
      listWrap.innerHTML = renderOpportunityTable(filtered);
      if (state.opportunities.contact?.open) {
        const activeLead = filtered.find(lead => lead.id === state.opportunities.contact.leadId) || null;
        if (activeLead) {
          populateLeadContactDrawer(activeLead, { preserveInputs: true });
        } else {
          closeLeadContactDrawer({ silent: true });
        }
      }
    }
  }

  if (filtered.length) {
    applyLeadRowSelection(detailState.selectedId || "");
    updateLeadDetailPanel(selectedLead || null);
  } else {
    applyLeadRowSelection("");
    updateLeadDetailPanel(null);
  }
}

function setOpportunityLevel(levelKey){
  const modal = document.getElementById("leads-modal");
  if (!modal || !state.opportunities.open) return;
  const lineage = Array.isArray(state.opportunities.lineage) ? state.opportunities.lineage : [];
  const baseFilters = state.opportunities.baseFilters instanceof Map ? state.opportunities.baseFilters : new Map();
  const sanitized = sanitizeOpportunityLevel(levelKey, lineage, baseFilters);
  if (state.opportunities.selectedLevel === sanitized) return;
  state.opportunities.selectedLevel = sanitized;
  renderOpportunityModal();
}

function closeOpportunityModal(){
  const modal = document.getElementById("leads-modal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  modal.hidden = true;
  document.body.classList.remove("has-modal-open");
  closeLeadContactDrawer({ silent: true });
  state.opportunities.open = false;
  state.opportunities.node = null;
  state.opportunities.lineage = [];
  state.opportunities.baseFilters = new Map();
  state.opportunities.filtered = [];
  state.opportunities.selectedLevel = defaultOpportunityLevel([], new Map());
  state.opportunities.trail = [];
  state.opportunities.contact = { open:false, leadId:null, trigger:null };
  state.opportunities.detail = { selectedId:null };
}

async function openOpportunityModal(detail = {}){
  await ensureLeadsTemplate().catch(() => null);
  await setupOpportunityModal();
  const modal = document.getElementById("leads-modal");
  if (!modal) return;

  const node = detail?.node || {};
  const lineage = Array.isArray(detail?.lineage) ? detail.lineage.map(entry => ({ ...entry })) : [];
  const baseFilters = new Map();
  lineage.forEach(entry => {
    if (entry?.levelKey && entry.value != null && entry.value !== "") {
      baseFilters.set(entry.levelKey, entry.value);
    }
  });

  state.opportunities.open = true;
  state.opportunities.node = node;
  state.opportunities.lineage = lineage;
  state.opportunities.baseFilters = baseFilters;
  state.opportunities.trail = Array.isArray(detail?.trail) ? [...detail.trail] : [];
  state.opportunities.selectedLevel = defaultOpportunityLevel(lineage, baseFilters);
  state.opportunities.contact = { open:false, leadId:null, trigger:null };
  state.opportunities.detail = { selectedId:null };

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("is-open");
  document.body.classList.add("has-modal-open");

  const panel = modal.querySelector(".leads-modal__panel");
  if (panel && !panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");

  renderOpportunityModal();

  requestAnimationFrame(() => {
    panel?.focus({ preventScroll: true });
  });
}
async function setupOpportunityModal(){
  if (opportunityModalBound) return;
  const modal = await ensureLeadsTemplate().catch(() => null);
  if (!modal) return;

  const listWrap = modal.querySelector("#leads-modal-list");
  if (listWrap && !listWrap.dataset.wired) {
    listWrap.addEventListener("click", handleOpportunityTableClick);
    listWrap.dataset.wired = "1";
  }

  const drawer = modal.querySelector("#lead-contact-drawer");
  if (drawer) {
    LEAD_CONTACT_UI.drawer = drawer;
    LEAD_CONTACT_UI.form = drawer.querySelector("#lead-contact-form");
    LEAD_CONTACT_UI.company = drawer.querySelector("#lead-contact-company");
    LEAD_CONTACT_UI.product = drawer.querySelector("#lead-contact-product");
    LEAD_CONTACT_UI.credit = drawer.querySelector("#lead-contact-credit");
    LEAD_CONTACT_UI.origin = drawer.querySelector("#lead-contact-origin");
    LEAD_CONTACT_UI.context = drawer.querySelector("#lead-contact-context");
    LEAD_CONTACT_UI.dateInput = drawer.querySelector("#lead-contact-date");
    LEAD_CONTACT_UI.commentInput = drawer.querySelector("#lead-contact-comment");
    LEAD_CONTACT_UI.responsavelInput = drawer.querySelector("#lead-contact-responsavel");
    LEAD_CONTACT_UI.idInput = drawer.querySelector("#lead-contact-id");

    drawer.querySelectorAll('[data-lead-contact-cancel]').forEach(btn => {
      btn.addEventListener("click", () => closeLeadContactDrawer());
    });

    if (LEAD_CONTACT_UI.form && !LEAD_CONTACT_UI.form.dataset.wired) {
      LEAD_CONTACT_UI.form.addEventListener("submit", submitLeadContactForm);
      LEAD_CONTACT_UI.form.dataset.wired = "1";
    }
  }

  modal.querySelectorAll("[data-leads-close]").forEach(btn => {
    btn.addEventListener("click", closeOpportunityModal);
  });

  modal.addEventListener("click", (event) => {
    if (event.target?.hasAttribute?.("data-leads-close")) closeOpportunityModal();
  });

  document.addEventListener("keydown", (event) => {
    if (!state.opportunities.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (state.opportunities.contact?.open) {
        closeLeadContactDrawer();
        return;
      }
      closeOpportunityModal();
    }
  });

  opportunityModalBound = true;
}
function escapeLeadIdSelector(value = ""){
  if (!value) return "";
  return window.CSS?.escape ? CSS.escape(value) : value.replace(/([\W_])/g, '\\$1');
}

function handleOpportunityTableClick(event){
  const button = event.target?.closest?.('[data-lead-action="add-contact"]');
  if (button) {
    event.preventDefault();
    const leadId = button.getAttribute('data-lead-id');
    if (!leadId) return;
    const lead = getOpportunityLeadById(leadId);
    if (!lead) return;
    setOpportunitySelectedLead(lead.id, { focusRow:false, silent:true });
    openLeadContactDrawer(lead, button);
    return;
  }

  const row = event.target?.closest?.('tr[data-lead-id]');
  if (!row) return;
  const leadId = row.getAttribute('data-lead-id');
  if (!leadId) return;
  setOpportunitySelectedLead(leadId, { focusRow:true });
}

function openLeadContactDrawer(lead, trigger){
  if (!lead || !LEAD_CONTACT_UI.drawer) return;
  state.opportunities.contact = { open:true, leadId: lead.id, trigger: trigger || null };
  setOpportunitySelectedLead(lead.id, { focusRow:false, silent:true });
  populateLeadContactDrawer(lead);
  LEAD_CONTACT_UI.drawer.setAttribute('aria-hidden', 'false');
  LEAD_CONTACT_UI.drawer.classList.add('is-open');
  requestAnimationFrame(() => {
    LEAD_CONTACT_UI.commentInput?.focus({ preventScroll: true });
  });
}

function closeLeadContactDrawer(options = {}){
  if (!LEAD_CONTACT_UI.drawer) return;
  LEAD_CONTACT_UI.drawer.classList.remove('is-open');
  LEAD_CONTACT_UI.drawer.setAttribute('aria-hidden', 'true');
  if (LEAD_CONTACT_UI.form) {
    LEAD_CONTACT_UI.form.reset();
  }
  const previousTrigger = state.opportunities.contact?.trigger;
  const previousLeadId = state.opportunities.contact?.leadId;
  state.opportunities.contact = { open:false, leadId:null, trigger:null };
  applyLeadRowSelection(state.opportunities.detail?.selectedId || "");
  if (!options.silent && previousTrigger && typeof previousTrigger.focus === 'function') {
    requestAnimationFrame(() => previousTrigger.focus());
  }
}

function populateLeadContactDrawer(lead, { preserveInputs = false } = {}){
  if (!lead || !LEAD_CONTACT_UI.drawer) return;
  const today = todayISO();
  const defaultDate = preserveInputs ? (LEAD_CONTACT_UI.dateInput?.value || today) : today;
  const defaultComment = preserveInputs ? (LEAD_CONTACT_UI.commentInput?.value || "") : "";
  const defaultResponsavel = preserveInputs ? (LEAD_CONTACT_UI.responsavelInput?.value || getCurrentUserDisplayName()) : getCurrentUserDisplayName();

  if (LEAD_CONTACT_UI.company) LEAD_CONTACT_UI.company.textContent = lead.empresa || "—";
  if (LEAD_CONTACT_UI.product) LEAD_CONTACT_UI.product.textContent = `${lead.produtoNome || lead.prodOrSub || "—"} • ${lead.familiaNome || lead.familia || "—"}`;
  if (LEAD_CONTACT_UI.credit) LEAD_CONTACT_UI.credit.textContent = fmtBRL.format(lead.creditoPreAprovado || 0);
  if (LEAD_CONTACT_UI.origin) {
    const originKey = simplificarTexto(lead.origem || lead.origemLabel || "");
    const originLabel = lead.origemLabel || (originKey === "link" ? "Link" : originKey === "smart" ? "Smart" : (lead.origem || "—"));
    LEAD_CONTACT_UI.origin.textContent = originLabel;
    LEAD_CONTACT_UI.origin.dataset.origin = originKey || "outro";
  }
  if (LEAD_CONTACT_UI.context) {
    const badges = [
      { label: "Diretoria", value: lead.diretoriaNome || lead.diretoria },
      { label: "Regional", value: lead.regional || lead.gerenciaRegional },
      { label: "Agência", value: lead.agenciaNome || lead.agencia },
      { label: "Gerente", value: lead.gerenteNome || lead.gerente },
    ].filter(item => limparTexto(item.value));
    LEAD_CONTACT_UI.context.innerHTML = badges.map(item => `<span><strong>${escapeHTML(item.label)}:</strong> ${escapeHTML(item.value)}</span>`).join("");
  }
  if (LEAD_CONTACT_UI.dateInput) LEAD_CONTACT_UI.dateInput.value = defaultDate;
  if (LEAD_CONTACT_UI.commentInput) LEAD_CONTACT_UI.commentInput.value = defaultComment;
  if (LEAD_CONTACT_UI.responsavelInput) LEAD_CONTACT_UI.responsavelInput.value = defaultResponsavel;
  if (LEAD_CONTACT_UI.idInput) LEAD_CONTACT_UI.idInput.value = lead.id;
}

function submitLeadContactForm(event){
  event.preventDefault();
  const leadId = LEAD_CONTACT_UI.idInput?.value;
  const lead = getOpportunityLeadById(leadId);
  if (!lead) {
    closeLeadContactDrawer({ silent: true });
    renderOpportunityModal();
    return;
  }
  const contatoData = LEAD_CONTACT_UI.dateInput?.value || todayISO();
  const comentario = LEAD_CONTACT_UI.commentInput?.value?.trim() || "";
  const responsavel = LEAD_CONTACT_UI.responsavelInput?.value?.trim() || getCurrentUserDisplayName();

  lead.ultimoContatoData = contatoData;
  lead.ultimoComentario = comentario;
  lead.ultimoUsuario = responsavel;

  const canalLabel = lead.origem === "link" ? "Origem Link" : lead.origem === "smart" ? "Smart Lead" : "Contato";
  const latestEntry = {
    data: contatoData,
    canal: canalLabel,
    resultado: comentario ? "Comentário atualizado" : "Contato registrado",
    usuario: responsavel,
    comentario,
  };
  const historicoAtual = Array.isArray(lead.historico) ? lead.historico.slice() : [];
  const combinado = [latestEntry, ...historicoAtual.filter(entry => entry && entry.data !== contatoData)];
  combinado.sort((a, b) => (a.data > b.data ? -1 : 1));
  lead.historico = combinado.slice(0, 3);

  OPPORTUNITY_LEADS_MAP.set(lead.id, lead);

  closeLeadContactDrawer({ silent: true });
  renderOpportunityModal();

  const escapedId = escapeLeadIdSelector(lead.id);
  requestAnimationFrame(() => {
    const focusTarget = document.querySelector(`[data-lead-action="add-contact"][data-lead-id="${escapedId}"]`);
    focusTarget?.focus();
  });
}


ensureLeadsTemplate()
  .then(() => setupOpportunityModal())
  .catch(err => console.warn("Não foi possível inicializar o modal de leads:", err));
