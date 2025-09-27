// BEGIN script.js
/* =========================================================
   POBJ • script.js  —  cards, tabela em árvore, ranking e visão executiva
   (com fixes: svh/topbar, z-index, listeners únicos, a11y)
   ========================================================= */

/* ===== Aqui eu organizo as configurações base do painel ===== */
const DATA_SOURCE = "csv";
const API_URL = "/api";
const TICKET_URL = "https://botpj.com/index.php?class=LoginForm";

/* ===== Aqui eu deixo separado tudo que envolve o chat embutido ===== */
// MODO 1 (recomendado): "iframe" — cole a URL do seu agente (Copilot Studio / SharePoint)
// MODO 2 (alternativo): "http"  — envia para um endpoint seu que responde { answer }
const CHAT_MODE = "iframe";  // "iframe" | "http"
const CHAT_IFRAME_URL = "";  // cole aqui a URL do canal "Website" do seu agente (se usar iframe)
const AGENT_ENDPOINT = "/api/agent"; // seu endpoint (se usar http)


// Aqui eu criei atalhos para querySelector e querySelectorAll porque uso isso o tempo todo.
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
// Aqui eu preparo alguns formatadores (moeda, inteiro, número com 1 casa) para reaproveitar sem recalcular.
const fmtBRL = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" });
const fmtINT = new Intl.NumberFormat("pt-BR");
const fmtONE = new Intl.NumberFormat("pt-BR", { minimumFractionDigits:1, maximumFractionDigits:1 });
// Aqui eu defino as cores padrão da visão executiva para manter identidade visual.
const EXEC_BAR_FILL = "#93c5fd";
const EXEC_BAR_STROKE = "#60a5fa";
const EXEC_META_COLOR = "#fca5a5";
const EXEC_SERIES_PALETTE = [
  "#2563eb", "#9333ea", "#0ea5e9", "#16a34a", "#f97316",
  "#ef4444", "#14b8a6", "#d946ef", "#f59e0b", "#22d3ee"
];
// Aqui eu deixo claro para mim que essa função só serve para trocar a aba visível e manter o botão certo destacado.
const definirAbaAtiva = (viewId = "cards") => {
  const tabs = Array.from($$(".tab"));
  const target = tabs.some(tab => (tab.dataset.view || "") === viewId) ? viewId : "cards";
  tabs.forEach(tab => {
    const expected = tab.dataset.view || "";
    tab.classList.toggle("is-active", expected === target);
  });
};
// Aqui eu extraio o símbolo da moeda para usar em componentes customizados.
const fmtBRLParts = fmtBRL.formatToParts(1);
const CURRENCY_SYMBOL = fmtBRLParts.find(p => p.type === "currency")?.value || "R$";
const CURRENCY_LITERAL = fmtBRLParts.find(p => p.type === "literal")?.value || " ";
// Aqui eu defino as regras de sufixo (mil, milhão...) para simplificar valores grandes.
const SUFFIX_RULES = [
  { value: 1_000_000_000_000, singular: "trilhão", plural: "trilhões" },
  { value: 1_000_000_000,     singular: "bilhão",  plural: "bilhões" },
  { value: 1_000_000,         singular: "milhão",  plural: "milhões" },
  { value: 1_000,             singular: "mil",     plural: "mil" }
];
// Aqui eu deixo uma lista padrão de motivos para simulação de cancelamento quando a base não traz o detalhe.
const MOTIVOS_CANCELAMENTO = [
  "Solicitação do cliente",
  "Inadimplência",
  "Renovação antecipada",
  "Ajuste comercial",
  "Migração de produto"
];

let MESU_DATA = [];
let PRODUTOS_DATA = [];
// Aqui eu mapeio as chaves de status para nomes amigáveis que vão aparecer nos filtros e cards.
const STATUS_LABELS = {
  todos: "Todos",
  atingidos: "Atingidos",
  nao: "Não atingidos",
};
// Aqui eu defino uma ordem padrão de status caso o CSV não traga essa informação.
const DEFAULT_STATUS_ORDER = ["todos", "atingidos", "nao"];
const DEFAULT_STATUS_INDICADORES = DEFAULT_STATUS_ORDER.map((key, idx) => ({
  id: key,
  codigo: key,
  nome: STATUS_LABELS[key] || key,
  key,
  ordem: idx,
}));
let STATUS_INDICADORES_DATA = DEFAULT_STATUS_INDICADORES.map(item => ({ ...item }));
// Aqui eu mantenho um Map para buscar status pelo código sem precisar ficar percorrendo arrays.
let STATUS_BY_KEY = new Map(DEFAULT_STATUS_INDICADORES.map(entry => [entry.key, { ...entry }]));

// Aqui eu preparo vários mapas auxiliares para navegar na hierarquia (diretoria → gerente) sem sofrimento.
let MESU_BY_AGENCIA = new Map();
let MESU_FALLBACK_ROWS = [];
let DIRETORIA_INDEX = new Map();
let GERENCIA_INDEX = new Map();
let AGENCIA_INDEX = new Map();
let GGESTAO_INDEX = new Map();
let GERENTE_INDEX = new Map();
let GERENCIAS_BY_DIRETORIA = new Map();
let AGENCIAS_BY_GERENCIA = new Map();
let GGESTAO_BY_AGENCIA = new Map();
let GERENTES_BY_AGENCIA = new Map();
let DIRETORIA_LABEL_INDEX = new Map();
let GERENCIA_LABEL_INDEX = new Map();
let AGENCIA_LABEL_INDEX = new Map();
let GGESTAO_LABEL_INDEX = new Map();
let GERENTE_LABEL_INDEX = new Map();
let SEGMENTO_INDEX = new Map();
let SEGMENTO_LABEL_INDEX = new Map();

const SELECT_SEARCH_DATA = new WeakMap();
const SELECT_SEARCH_REGISTRY = new Set();
let SELECT_SEARCH_GLOBAL_LISTENERS = false;

// Aqui eu guardo os dados calculados de ranking para não refazer o trabalho sempre que a tela muda.
let RANKING_DIRECTORIAS = [];
let RANKING_GERENCIAS = [];
let RANKING_AGENCIAS = [];
let RANKING_GERENTES = [];
let GERENTES_GESTAO = [];
let SEGMENTOS_DATA = [];

// Aqui eu tenho mapas auxiliares para ligar produto, família e seção.
let PRODUTOS_BY_FAMILIA = new Map();
let FAMILIA_DATA = [];
let FAMILIA_BY_ID = new Map();
let PRODUTO_TO_FAMILIA = new Map();

// Aqui eu deixo caches das bases fact/dim para usar em várias telas.
let fDados = [];
let fCampanhas = [];
let fVariavel = [];
let FACT_REALIZADOS = [];
let FACT_METAS = [];
let FACT_VARIAVEL = [];
let FACT_CAMPANHAS = [];
let DIM_CALENDARIO = [];
let AVAILABLE_DATE_MAX = "";

// Aqui eu guardo qual recorte o usuário escolheu para conseguir lembrar quando mudar de aba.
let CURRENT_USER_CONTEXT = {
  diretoria: "",
  gerencia: "",
  agencia: "",
  gerenteGestao: "",
  gerente: ""
};

function getCurrentUserDisplayName(){
  const name = document.querySelector('.userbox__name')?.textContent?.trim();
  return name || 'Equipe Comercial';
}

// Aqui eu aponto onde normalmente ficam os CSVs e guardo a Promise de carregamento para evitar múltiplos downloads.
const BASE_CSV_PATH = "Base";
let baseDataPromise = null;

// Aqui eu limpo qualquer valor que vem das bases porque sei que sempre chega com espaços e formatos diferentes.
function limparTexto(value){
  if (value == null) return "";
  return String(value).trim();
}

function simplificarTexto(value){
  const texto = limparTexto(value);
  if (!texto) return "";
  const semAcento = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const comConectivo = semAcento.replace(/&/g, " e ");
  return comConectivo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DEFAULT_SELECTION_MARKERS = new Set(["", "todos", "todas", "todes", "all"]);

// Aqui eu vou manter um catálogo de aliases dos indicadores para conseguir resolver filtros por nome, código ou subproduto.
const CARD_ALIAS_INDEX = new Map(); // cardId -> Set(alias)
const CARD_SLUG_TO_ID = new Map();  // slug -> cardId
const CARD_ID_SET = new Set();      // conjunto rápido dos ids oficiais
const SUBPRODUTO_TO_INDICADOR = new Map(); // slug do subproduto -> cardId

function registrarAliasIndicador(cardId, alias){
  const seguroId = limparTexto(cardId);
  if (!seguroId) return;
  CARD_ID_SET.add(seguroId);
  const slug = simplificarTexto(alias);
  if (!slug) return;
  let aliases = CARD_ALIAS_INDEX.get(seguroId);
  if (!aliases){
    aliases = new Set();
    CARD_ALIAS_INDEX.set(seguroId, aliases);
  }
  if (!aliases.has(slug)) aliases.add(slug);
  CARD_SLUG_TO_ID.set(slug, seguroId);
}

function resolverIndicadorPorAlias(valor){
  const texto = limparTexto(valor);
  if (!texto) return "";
  if (CARD_ID_SET.has(texto)) return texto;
  const slug = simplificarTexto(texto);
  if (CARD_SLUG_TO_ID.has(slug)) return CARD_SLUG_TO_ID.get(slug);
  return "";
}

function selecaoPadrao(value){
  return DEFAULT_SELECTION_MARKERS.has(simplificarTexto(value));
}

function matchesSelection(filterValue, ...candidates){
  const esperado = limparTexto(filterValue);
  if (!esperado) return false;
  const esperadoSimple = simplificarTexto(esperado);
  const lista = [];
  candidates.forEach(item => {
    if (Array.isArray(item)) lista.push(...item);
    else lista.push(item);
  });
  return lista.some(candidate => {
    const valor = limparTexto(candidate);
    if (!valor) return false;
    if (valor === esperado) return true;
    return simplificarTexto(valor) === esperadoSimple;
  });
}

function optionMatchesValue(option, desired){
  const alvo = limparTexto(desired);
  if (!alvo) return false;
  const candidatos = [option.value];
  if (Array.isArray(option.aliases)) candidatos.push(...option.aliases);
  return candidatos.some(candidate => {
    const valor = limparTexto(candidate);
    if (!valor) return false;
    if (valor === alvo) return true;
    return simplificarTexto(valor) === simplificarTexto(alvo);
  });
}

function registerLabelIndexEntry(map, entry, ...values){
  values.forEach(value => {
    const normal = simplificarTexto(value);
    if (!normal) return;
    if (!map.has(normal)) map.set(normal, entry);
  });
}

function findEntryInIndexes(idMap, labelMap, value){
  const direto = limparTexto(value);
  if (direto && idMap?.has(direto)) return idMap.get(direto);
  const simples = simplificarTexto(value);
  if (simples && labelMap?.has(simples)) return labelMap.get(simples);
  return null;
}

function findSegmentoMeta(value){
  return findEntryInIndexes(SEGMENTO_INDEX, SEGMENTO_LABEL_INDEX, value);
}

function findDiretoriaMeta(value){
  return findEntryInIndexes(DIRETORIA_INDEX, DIRETORIA_LABEL_INDEX, value);
}

function findGerenciaMeta(value){
  return findEntryInIndexes(GERENCIA_INDEX, GERENCIA_LABEL_INDEX, value);
}

function findGerenteGestaoMeta(value){
  return findEntryInIndexes(GGESTAO_INDEX, GGESTAO_LABEL_INDEX, value);
}

function findGerenteMeta(value){
  return findEntryInIndexes(GERENTE_INDEX, GERENTE_LABEL_INDEX, value);
}

function findAgenciaMeta(value){
  const direto = findEntryInIndexes(AGENCIA_INDEX, AGENCIA_LABEL_INDEX, value);
  if (direto) return direto;
  const chave = limparTexto(value);
  if (chave && MESU_BY_AGENCIA.has(chave)) return MESU_BY_AGENCIA.get(chave);
  const simples = simplificarTexto(value);
  if (!simples) return null;
  for (const meta of MESU_BY_AGENCIA.values()){
    if (simplificarTexto(meta.agenciaId) === simples) return meta;
    if (simplificarTexto(meta.agenciaNome) === simples) return meta;
    if (simplificarTexto(meta.agenciaCodigo) === simples) return meta;
  }
  return null;
}

// Aqui eu tento ler uma célula usando várias chaves possíveis porque cada base vem com um nome diferente.
function lerCelula(raw, keys){
  if (!raw) return "";
  for (const key of keys){
    if (Object.prototype.hasOwnProperty.call(raw, key)){
      const val = limparTexto(raw[key]);
      if (val !== "") return val;
    }
  }
  return "";
}

// Aqui eu garanto que qualquer data vira formato ISO (aaaa-mm-dd) porque isso evita dor de cabeça com ordenação.
function converterDataISO(value) {
  const text = limparTexto(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/");
    return `${year}-${month}-${day}`;
  }
  return text;
}

// Aqui eu transformo valores variados (1, sim, true...) em booleanos para padronizar as checagens depois.
function converterBooleano(value, fallback = false) {
  const text = limparTexto(value).toLowerCase();
  if (!text) return fallback;
  if (/^(?:1|true|sim|yes|ativo|active|on)$/i.test(text)) return true;
  if (/^(?:0|false|nao|não|inativo|inactive|off)$/i.test(text)) return false;
  return fallback;
}

// Aqui eu pego o primeiro valor que realmente veio preenchido porque as bases mandam duplicado em várias colunas.
function pegarPrimeiroPreenchido(...values) {
  for (const val of values) {
    if (val !== undefined && val !== null && val !== "") {
      return val;
    }
  }
  return "";
}
// Aqui eu garanto que todos os objetos usem o novo padrão id_indicador/ds_indicador e mantenham compatibilidade com produtoId.
function aplicarIndicadorAliases(target = {}, idBruto = "", nomeBruto = "") {
  const idTexto = limparTexto(idBruto || "");
  const nomeTexto = limparTexto(nomeBruto || "");
  const resolvedCard = resolverIndicadorPorAlias(idTexto) || resolverIndicadorPorAlias(nomeTexto);
  if (resolvedCard) {
    registrarAliasIndicador(resolvedCard, idTexto);
    registrarAliasIndicador(resolvedCard, nomeTexto);
  }
  const indicadorCodigo = idTexto || resolvedCard || nomeTexto;
  const indicadorNome = nomeTexto || resolvedCard || indicadorCodigo;
  if (resolvedCard && !idTexto) {
    registrarAliasIndicador(resolvedCard, indicadorCodigo);
  }
  target.id_indicador = indicadorCodigo;
  target.ds_indicador = indicadorNome;
  target.indicadorId = indicadorCodigo;
  target.indicadorNome = indicadorNome;
  target.produtoId = resolvedCard || indicadorCodigo;
  target.produtoNome = indicadorNome;
  if (resolvedCard && indicadorCodigo && indicadorCodigo !== resolvedCard) {
    target.indicadorCodigo = indicadorCodigo;
  }
  return target;
}

// Aqui eu converto o texto do status para um formato previsível (sem acento e em minúsculas) para montar os filtros.
function normalizarChaveStatus(value) {
  const text = limparTexto(value);
  if (!text) return "";
  const ascii = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = ascii.toLowerCase().replace(/\s+/g, " ").trim();
  if (!lower) return "";
  if (/^(?:1|todos?)$/.test(lower) || lower.includes("todos")) return "todos";
  if (/^(?:2)$/.test(lower)) return "atingidos";
  if (/^(?:3)$/.test(lower)) return "nao";
  if (/(?:^|\b)(?:nao|na|no)\s+atingid/.test(lower)) return "nao";
  if (lower.includes("atingid")) return "atingidos";
  if (lower.includes("nao")) return "nao";
  const slug = lower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (slug === "no_atingidos") return "nao";
  return slug;
}

// Aqui eu traduzo a chave do status para o rótulo certo exibido na tela, sempre tentando usar as descrições oficiais.
function obterRotuloStatus(key, fallback = "") {
  const normalized = normalizarChaveStatus(key);
  if (normalized && STATUS_BY_KEY.has(normalized)) {
    const entry = STATUS_BY_KEY.get(normalized);
    if (entry?.nome) return entry.nome;
  }
  if (normalized && STATUS_LABELS[normalized]) return STATUS_LABELS[normalized];
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  const fallbackText = limparTexto(fallback);
  if (fallbackText) return fallbackText;
  return normalized || key;
}

// Aqui eu faço uma gambiarra controlada para descobrir qual separador o CSV está usando (vírgula, ponto e vírgula, tab...).
function descobrirDelimitadorCsv(headerLine, sampleLines = []){
  const lines = [headerLine].concat(Array.isArray(sampleLines) ? sampleLines.slice(0, 5) : []).filter(Boolean);
  if (!lines.length) return ",";
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestScore = -1;
  candidates.forEach(delim => {
    let score = 0;
    lines.forEach(line => {
      const pieces = line.split(delim);
      if (pieces.length > 1){
        score += pieces.length - 1;
      }
    });
    if (score > bestScore){
      best = delim;
      bestScore = score;
    }
  });
  if (bestScore <= 0){
    if (headerLine?.includes(";")) return ";";
    if (headerLine?.includes("\t")) return "\t";
    if (headerLine?.includes("|")) return "|";
  }
  return best;
}

// Aqui eu separo uma linha de CSV respeitando aspas duplas porque algumas colunas trazem vírgula dentro do texto.
function dividirLinhaCsv(line, delimiter){
  const cols = [];
  let current = "";
  let insideQuotes = false;
  for (let i = 0; i < line.length; i++){
    const ch = line[i];
    if (ch === '"'){
      if (insideQuotes && line[i + 1] === '"'){
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (ch === delimiter && !insideQuotes){
      cols.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

// Aqui eu transformo o texto cru do CSV em uma lista de objetos bonitinha, sempre limpando a sujeira de BOM e quebras.
function converterCSV(text){
  if (!text) return [];
  const normalized = text.replace(/\uFEFF/g, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n").filter(line => line.trim() !== "");
  if (!lines.length) return [];
  const header = lines.shift();
  if (!header) return [];
  const delimiter = descobrirDelimitadorCsv(header, lines);
  const headers = dividirLinhaCsv(header, delimiter).map(h => limparTexto(h));
  const rows = [];
  for (const line of lines){
    const cols = dividirLinhaCsv(line, delimiter);
    if (!cols.length) continue;
    const obj = {};
    headers.forEach((key, idx) => {
      obj[key] = limparTexto(idx < cols.length ? cols[idx] : "");
    });
    rows.push(obj);
  }
  return rows;
}

const SCRIPT_BASE_URL = (() => {
  const current = document.currentScript;
  if (current?.src) {
    return new URL('.', current.src).href;
  }
  const fallback = Array.from(document.getElementsByTagName('script'))
    .map(el => el.src)
    .filter(Boolean)[0];
  if (fallback) {
    return new URL('.', fallback).href;
  }
  return new URL('.', window.location.href).href;
})();

const PAGE_BASE_URL = new URL('.', window.location.href).href;
const PAGE_PATH_DEPTH = (() => {
  try {
    const path = new URL(PAGE_BASE_URL).pathname || '/';
    return path.split('/').filter(Boolean).length;
  } catch (err) {
    const fallback = (window.location.pathname || '/').replace(/[^/]*$/, '');
    return fallback.split('/').filter(Boolean).length;
  }
})();

// Aqui eu gero uma lista de caminhos alternativos porque cada ambiente hospeda os CSVs em pastas diferentes.
function montarTentativasCsvUrl(path){
  if (!path) return [];
  if (/^(?:https?|data|blob):/i.test(path)) {
    return [path];
  }

  const raw = String(path);
  const clean = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  const baseLess = clean.replace(/^Base\//i, '');
  const filename = clean.split('/').filter(Boolean).pop() || '';

  const variants = new Set([raw, clean]);
  if (clean && !clean.startsWith('./')) variants.add(`./${clean}`);
  if (clean && !clean.startsWith('/')) variants.add(`/${clean}`);
  if (baseLess && baseLess !== clean) {
    variants.add(baseLess);
    variants.add(`./${baseLess}`);
    variants.add(`/${baseLess}`);
  } else if (clean && !/^Base\//i.test(clean)) {
    variants.add(`Base/${clean}`);
  }
  if (filename) variants.add(filename);

  for (let i = 1; i <= Math.min(5, PAGE_PATH_DEPTH); i += 1) {
    const prefix = '../'.repeat(i);
    variants.add(`${prefix}${clean}`);
    if (baseLess && baseLess !== clean) {
      variants.add(`${prefix}${baseLess}`);
    }
  }

  const attempts = new Set();
  const bases = [SCRIPT_BASE_URL, PAGE_BASE_URL];
  const origin = window.location.origin || '';
  if (origin) {
    bases.push(origin.endsWith('/') ? origin : `${origin}/`);
  }

  variants.forEach(candidate => {
    if (!candidate) return;
    const normalized = candidate.startsWith('./') ? candidate.slice(2) : candidate;
    bases.forEach(base => {
      if (!base) return;
      try {
        attempts.add(new URL(normalized, base).href);
      } catch (err) {
        // ignore
      }
    });
    if (!/^(?:https?|data|blob):/i.test(candidate)) {
      attempts.add(candidate);
    }
  });

  return [...attempts];
}

async function loadCsvFile(path){
  const attempts = montarTentativasCsvUrl(path);
  let lastError = null;
  for (const attempt of attempts){
    try {
      const response = await fetch(attempt, { cache: 'no-store' });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const text = await response.text();
      return converterCSV(text);
    } catch (err) {
      lastError = err;
    }
  }
  const attemptList = attempts.join(', ');
  if (lastError) {
    console.error(`Falha ao carregar CSV em ${path}. Tentativas: ${attemptList}`, lastError);
  } else {
    console.error(`Falha ao carregar CSV em ${path}. Tentativas: ${attemptList}`);
  }
  return [];
}

// Aqui eu pego os dados MESU brutos e padronizo os campos para facilitar os filtros hierárquicos depois.
function normalizarLinhasMesu(rows){
  return rows.map(raw => {
    const segmentoNome = lerCelula(raw, ["Segmento", "segmento"]);
    const segmentoId = lerCelula(raw, ["Id Segmento", "ID Segmento", "id segmento", "Id segmento", "segmento_id"]) || segmentoNome;
    const diretoriaNome = lerCelula(raw, ["Diretoria", "Diretoria Regional", "diretoria", "Diretoria regional"]);
    const diretoriaId = lerCelula(raw, ["Id Diretoria", "ID Diretoria", "Diretoria ID", "Id Diretoria Regional", "id diretoria"]) || diretoriaNome;
    const regionalNome = lerCelula(raw, ["Regional", "Gerencia Regional", "Gerência Regional", "Gerencia regional", "Regional Nome"]);
    const regionalId = lerCelula(raw, ["Id Regional", "ID Regional", "Id Gerencia Regional", "Id Gerência Regional", "Gerencia ID"]) || regionalNome;
    const agenciaNome = lerCelula(raw, ["Agencia", "Agência", "Agencia Nome", "Agência Nome"]);
    const agenciaId = lerCelula(raw, ["Id Agencia", "ID Agencia", "Id Agência", "Agencia ID", "Agência ID"]) || agenciaNome;
    const gerenteGestaoNome = lerCelula(raw, ["Gerente de Gestao", "Gerente de Gestão", "Gerente Gestao", "Gerente Geral", "Gerente geral"]);
    const gerenteGestaoId = lerCelula(raw, ["Id Gerente de Gestao", "ID Gerente de Gestao", "Id Gerente de Gestão", "Gerente de Gestao Id", "gerenteGestaoId"]) || gerenteGestaoNome;
    const gerenteNome = lerCelula(raw, ["Gerente", "Gerente Nome", "Nome Gerente"]);
    const gerenteId = lerCelula(raw, ["Id Gerente", "ID Gerente", "Gerente Id"]) || gerenteNome;

    return {
      segmentoNome,
      segmentoId,
      diretoriaNome,
      diretoriaId,
      regionalNome,
      regionalId,
      agenciaNome,
      agenciaId,
      gerenteGestaoNome,
      gerenteGestaoId,
      gerenteNome,
      gerenteId
    };
  }).filter(row => row.diretoriaId || row.regionalId || row.agenciaId);
}

// Aqui eu aproveito os dados MESU já limpos para montar índices (diretoria → gerência → agência...) e acelerar os combos.
function montarHierarquiaMesu(rows){
  const dirMap = new Map();
  const regMap = new Map();
  const agMap = new Map();
  const ggMap = new Map();
  const gerMap = new Map();
  const segMap = new Map();

  MESU_DATA = Array.isArray(rows) ? rows.map(row => ({ ...row })) : [];
  MESU_FALLBACK_ROWS = [];
  MESU_BY_AGENCIA = new Map();
  GERENCIAS_BY_DIRETORIA = new Map();
  AGENCIAS_BY_GERENCIA = new Map();
  GGESTAO_BY_AGENCIA = new Map();
  GERENTES_BY_AGENCIA = new Map();

  rows.forEach(row => {
    const segmentoId = limparTexto(row.segmentoId);
    const segmentoNome = limparTexto(row.segmentoNome) || segmentoId;
    const diretoriaId = limparTexto(row.diretoriaId);
    const diretoriaNome = limparTexto(row.diretoriaNome) || diretoriaId;
    const regionalId = limparTexto(row.regionalId);
    const regionalNome = limparTexto(row.regionalNome) || regionalId;
    const agenciaId = limparTexto(row.agenciaId);
    const agenciaNome = limparTexto(row.agenciaNome) || agenciaId;
    const agenciaCodigo = limparTexto(row.agenciaCodigo || row.agencia);
    const gerenteGestaoId = limparTexto(row.gerenteGestaoId);
    const gerenteGestaoNome = limparTexto(row.gerenteGestaoNome) || gerenteGestaoId;
    const gerenteId = limparTexto(row.gerenteId);
    const gerenteNome = limparTexto(row.gerenteNome) || gerenteId;

    row.segmentoId = segmentoId;
    row.segmentoNome = segmentoNome;
    row.diretoriaId = diretoriaId;
    row.diretoriaNome = diretoriaNome;
    row.regionalId = regionalId;
    row.regionalNome = regionalNome;
    row.agenciaId = agenciaId;
    row.agenciaNome = agenciaNome;
    row.gerenteGestaoId = gerenteGestaoId;
    row.gerenteGestaoNome = gerenteGestaoNome;
    row.gerenteId = gerenteId;
    row.gerenteNome = gerenteNome;

    if (segmentoNome){
      const key = segmentoId || segmentoNome;
      if (!segMap.has(key)) {
        segMap.set(key, { id: segmentoId || segmentoNome, nome: segmentoNome || segmentoId || 'Segmento' });
      }
    }

    if (diretoriaId){
      const dirEntry = dirMap.get(diretoriaId) || {
        id: diretoriaId,
        nome: diretoriaNome || diretoriaId,
        segmento: segmentoId || ''
      };
      if (!dirEntry.nome && diretoriaNome) dirEntry.nome = diretoriaNome;
      if (!dirEntry.segmento && segmentoId) dirEntry.segmento = segmentoId;
      dirMap.set(diretoriaId, dirEntry);
    }

    if (regionalId){
      const regEntry = regMap.get(regionalId) || {
        id: regionalId,
        nome: regionalNome || regionalId,
        diretoria: diretoriaId || '',
        segmentoId: segmentoId || ''
      };
      if (!regEntry.nome && regionalNome) regEntry.nome = regionalNome;
      if (!regEntry.diretoria && diretoriaId) regEntry.diretoria = diretoriaId;
      if (!regEntry.segmentoId && segmentoId) regEntry.segmentoId = segmentoId;
      regMap.set(regionalId, regEntry);
      if (diretoriaId){
        if (!GERENCIAS_BY_DIRETORIA.has(diretoriaId)) GERENCIAS_BY_DIRETORIA.set(diretoriaId, new Set());
        GERENCIAS_BY_DIRETORIA.get(diretoriaId).add(regionalId);
      }
    }

    if (agenciaId){
      const agEntry = agMap.get(agenciaId) || {
        id: agenciaId,
        nome: agenciaNome || agenciaId,
        gerencia: regionalId || '',
        diretoria: diretoriaId || '',
        segmento: segmentoId || '',
        codigo: agenciaCodigo || agenciaId
      };
      if (!agEntry.nome && agenciaNome) agEntry.nome = agenciaNome;
      if (!agEntry.gerencia && regionalId) agEntry.gerencia = regionalId;
      if (!agEntry.diretoria && diretoriaId) agEntry.diretoria = diretoriaId;
      if (!agEntry.segmento && segmentoId) agEntry.segmento = segmentoId;
      if (!agEntry.codigo && agenciaCodigo) agEntry.codigo = agenciaCodigo;
      agMap.set(agenciaId, agEntry);

      if (!MESU_BY_AGENCIA.has(agenciaId)){
        MESU_BY_AGENCIA.set(agenciaId, {
          segmentoId,
          segmentoNome,
          diretoriaId,
          diretoriaNome,
          regionalId,
          regionalNome,
          agenciaId,
          agenciaNome,
          agenciaCodigo,
          gerenteGestaoId,
          gerenteGestaoNome,
          gerenteId,
          gerenteNome,
          gerenteGestaoIds: new Set(),
          gerenteIds: new Set()
        });
      }
      const agencyMeta = MESU_BY_AGENCIA.get(agenciaId);
      if (segmentoId && !agencyMeta.segmentoId) agencyMeta.segmentoId = segmentoId;
      if (segmentoNome && !agencyMeta.segmentoNome) agencyMeta.segmentoNome = segmentoNome;
      if (diretoriaId && !agencyMeta.diretoriaId) agencyMeta.diretoriaId = diretoriaId;
      if (diretoriaNome && !agencyMeta.diretoriaNome) agencyMeta.diretoriaNome = diretoriaNome;
      if (regionalId && !agencyMeta.regionalId) agencyMeta.regionalId = regionalId;
      if (regionalNome && !agencyMeta.regionalNome) agencyMeta.regionalNome = regionalNome;
      if (agenciaCodigo && !agencyMeta.agenciaCodigo) agencyMeta.agenciaCodigo = agenciaCodigo;
      if (gerenteGestaoId){
        agencyMeta.gerenteGestaoId = agencyMeta.gerenteGestaoId || gerenteGestaoId;
        agencyMeta.gerenteGestaoNome = agencyMeta.gerenteGestaoNome || gerenteGestaoNome;
        agencyMeta.gerenteGestaoIds.add(gerenteGestaoId);
      }
      if (gerenteId){
        agencyMeta.gerenteId = agencyMeta.gerenteId || gerenteId;
        agencyMeta.gerenteNome = agencyMeta.gerenteNome || gerenteNome;
        agencyMeta.gerenteIds.add(gerenteId);
      }
      if (regionalId){
        if (!AGENCIAS_BY_GERENCIA.has(regionalId)) AGENCIAS_BY_GERENCIA.set(regionalId, new Set());
        AGENCIAS_BY_GERENCIA.get(regionalId).add(agenciaId);
      }
    }

    if (gerenteGestaoId){
      const ggEntry = ggMap.get(gerenteGestaoId) || {
        id: gerenteGestaoId,
        nome: gerenteGestaoNome || gerenteGestaoId,
        agencia: agenciaId || '',
        gerencia: regionalId || '',
        diretoria: diretoriaId || ''
      };
      if (!ggEntry.nome && gerenteGestaoNome) ggEntry.nome = gerenteGestaoNome;
      if (!ggEntry.agencia && agenciaId) ggEntry.agencia = agenciaId;
      if (!ggEntry.gerencia && regionalId) ggEntry.gerencia = regionalId;
      if (!ggEntry.diretoria && diretoriaId) ggEntry.diretoria = diretoriaId;
      ggMap.set(gerenteGestaoId, ggEntry);

      if (agenciaId){
        if (!GGESTAO_BY_AGENCIA.has(agenciaId)) GGESTAO_BY_AGENCIA.set(agenciaId, new Set());
        GGESTAO_BY_AGENCIA.get(agenciaId).add(gerenteGestaoId);
      }
    }

    if (gerenteId){
      const gerenteEntry = gerMap.get(gerenteId) || {
        id: gerenteId,
        nome: gerenteNome || gerenteId,
        agencia: agenciaId || '',
        gerencia: regionalId || '',
        diretoria: diretoriaId || ''
      };
      if (!gerenteEntry.nome && gerenteNome) gerenteEntry.nome = gerenteNome;
      if (!gerenteEntry.agencia && agenciaId) gerenteEntry.agencia = agenciaId;
      if (!gerenteEntry.gerencia && regionalId) gerenteEntry.gerencia = regionalId;
      if (!gerenteEntry.diretoria && diretoriaId) gerenteEntry.diretoria = diretoriaId;
      gerMap.set(gerenteId, gerenteEntry);

      if (agenciaId){
        if (!GERENTES_BY_AGENCIA.has(agenciaId)) GERENTES_BY_AGENCIA.set(agenciaId, new Set());
        GERENTES_BY_AGENCIA.get(agenciaId).add(gerenteId);
      }
    }
  });

  RANKING_DIRECTORIAS = Array.from(dirMap.values());
  RANKING_GERENCIAS = Array.from(regMap.values());
  RANKING_AGENCIAS = Array.from(agMap.values());
  GERENTES_GESTAO = Array.from(ggMap.values());
  RANKING_GERENTES = Array.from(gerMap.values());
  SEGMENTOS_DATA = Array.from(segMap.values());

  MESU_BY_AGENCIA.forEach(meta => {
    if (meta.gerenteGestaoIds instanceof Set) {
      meta.gerenteGestaoLista = Array.from(meta.gerenteGestaoIds);
      delete meta.gerenteGestaoIds;
    }
    if (meta.gerenteIds instanceof Set) {
      meta.gerenteLista = Array.from(meta.gerenteIds);
      delete meta.gerenteIds;
    }
  });

  const localeCompare = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });

  RANKING_DIRECTORIAS.sort((a,b) => localeCompare(a.nome, b.nome));
  RANKING_GERENCIAS.sort((a,b) => localeCompare(a.nome, b.nome));
  RANKING_AGENCIAS.sort((a,b) => localeCompare(a.nome, b.nome));
  GERENTES_GESTAO.sort((a,b) => localeCompare(a.nome, b.nome));
  RANKING_GERENTES.sort((a,b) => localeCompare(a.nome, b.nome));
  SEGMENTOS_DATA.sort((a,b) => localeCompare(a.nome, b.nome));

  DIRETORIA_INDEX = new Map();
  RANKING_DIRECTORIAS.forEach(dir => {
    const key = limparTexto(dir.id || dir.nome);
    if (key) DIRETORIA_INDEX.set(key, dir);
  });
  GERENCIA_INDEX = new Map();
  RANKING_GERENCIAS.forEach(ger => {
    const key = limparTexto(ger.id || ger.nome);
    if (key) GERENCIA_INDEX.set(key, ger);
  });
  AGENCIA_INDEX = new Map();
  RANKING_AGENCIAS.forEach(ag => {
    const key = limparTexto(ag.id || ag.nome);
    if (key) AGENCIA_INDEX.set(key, ag);
  });
  GGESTAO_INDEX = new Map();
  GERENTES_GESTAO.forEach(gg => {
    const key = limparTexto(gg.id || gg.nome);
    if (key) GGESTAO_INDEX.set(key, gg);
  });
  GERENTE_INDEX = new Map();
  RANKING_GERENTES.forEach(ge => {
    const key = limparTexto(ge.id || ge.nome);
    if (key) GERENTE_INDEX.set(key, ge);
  });
  SEGMENTO_INDEX = new Map();
  SEGMENTOS_DATA.forEach(seg => {
    const key = limparTexto(seg.id || seg.nome);
    if (key) SEGMENTO_INDEX.set(key, seg);
  });

  DIRETORIA_LABEL_INDEX = new Map();
  RANKING_DIRECTORIAS.forEach(dir => registerLabelIndexEntry(DIRETORIA_LABEL_INDEX, dir, dir.id, dir.nome));
  GERENCIA_LABEL_INDEX = new Map();
  RANKING_GERENCIAS.forEach(ger => registerLabelIndexEntry(GERENCIA_LABEL_INDEX, ger, ger.id, ger.nome));
  AGENCIA_LABEL_INDEX = new Map();
  RANKING_AGENCIAS.forEach(ag => registerLabelIndexEntry(AGENCIA_LABEL_INDEX, ag, ag.id, ag.nome, ag.codigo));
  MESU_BY_AGENCIA.forEach(meta => {
    registerLabelIndexEntry(AGENCIA_LABEL_INDEX, meta, meta.agenciaId, meta.agenciaNome, meta.agenciaCodigo);
  });
  GGESTAO_LABEL_INDEX = new Map();
  GERENTES_GESTAO.forEach(gg => registerLabelIndexEntry(GGESTAO_LABEL_INDEX, gg, gg.id, gg.nome));
  GERENTE_LABEL_INDEX = new Map();
  RANKING_GERENTES.forEach(ger => registerLabelIndexEntry(GERENTE_LABEL_INDEX, ger, ger.id, ger.nome));
  SEGMENTO_LABEL_INDEX = new Map();
  SEGMENTOS_DATA.forEach(seg => registerLabelIndexEntry(SEGMENTO_LABEL_INDEX, seg, seg.id, seg.nome));

  if (!CURRENT_USER_CONTEXT.diretoria && rows.length){
    const first = rows[0];
    CURRENT_USER_CONTEXT = {
      diretoria: first.diretoriaId || '',
      gerencia: first.regionalId || '',
      agencia: first.agenciaId || '',
      gerenteGestao: first.gerenteGestaoId || '',
      gerente: first.gerenteId || ''
    };
  }
}
function normalizarLinhasProdutos(rows){
  return rows.map(raw => {
    const secaoId = lerCelula(raw, ["id_secao", "Id secao", "ID secao", "Seção ID", "secao_id", "secaoId"]);
    const secaoNome = lerCelula(raw, ["secao", "Seção", "Nome secao", "Nome seção"]) || secaoId;
    const familiaNome = lerCelula(raw, ["Familia de produtos", "Família de produtos", "Familia", "família", "familia"]);
    const familiaId = lerCelula(raw, ["Id familia", "ID familia", "Familia Id", "id familia"]) || familiaNome;
    const produtoNome = lerCelula(raw, ["ds_indicador", "Produto", "produto", "Produto Nome"]);
    const produtoId = lerCelula(raw, ["id_indicador", "Id produto", "ID produto", "Produto Id", "id produto"]) || produtoNome;
    const base = {
      secaoId,
      secaoNome,
      familiaNome,
      familiaId,
    };
    const resultado = aplicarIndicadorAliases(base, produtoId, produtoNome);
    const familiaAlias = resolverIndicadorPorAlias(familiaNome) || resolverIndicadorPorAlias(familiaId);
    if (familiaAlias) {
      const candidatos = [produtoNome, produtoId];
      candidatos.forEach(alias => {
        const texto = limparTexto(alias);
        if (!texto) return;
        registrarAliasIndicador(familiaAlias, texto);
        SUBPRODUTO_TO_INDICADOR.set(simplificarTexto(texto), familiaAlias);
      });
    }
    return resultado;
  }).filter(row => row.familiaId && row.produtoId);
}

// Aqui eu crio mapas rápidos (produto → família/seção) para não ficar caçando informação na hora de renderizar.
function montarDadosProdutos(rows){
  const famMap = new Map();
  const byFamilia = new Map();
  PRODUTO_TO_FAMILIA = new Map();
  SUBPRODUTO_TO_INDICADOR.clear();

  rows.forEach(row => {
    const familiaId = row.familiaId;
    const produtoId = row.produtoId;
    if (!familiaId || !produtoId) return;

    const familiaNome = row.familiaNome || familiaId;
    const entry = famMap.get(familiaId) || {
      id: familiaId,
      nome: familiaNome,
      secaoId: row.secaoId || "",
      secaoNome: row.secaoNome || ""
    };
    if (!entry.nome || entry.nome === entry.id) entry.nome = familiaNome;
    if (!entry.secaoId && row.secaoId) entry.secaoId = row.secaoId;
    if (!entry.secaoNome && row.secaoNome) entry.secaoNome = row.secaoNome;
    famMap.set(familiaId, entry);

    const list = byFamilia.get(familiaId) || [];
    if (!list.some(prod => prod.id === produtoId)) {
      list.push({ id: produtoId, nome: row.produtoNome || produtoId, familiaId, secaoId: entry.secaoId });
    }
    byFamilia.set(familiaId, list);

    if (!PRODUTO_TO_FAMILIA.has(produtoId)) {
      PRODUTO_TO_FAMILIA.set(produtoId, {
        id: familiaId,
        nome: familiaNome,
        secaoId: entry.secaoId,
        secaoNome: entry.secaoNome || entry.secaoId || ""
      });
    }
  });

  CARD_SECTIONS_DEF.forEach(sec => {
    sec.items.forEach(item => {
      const familiaId = item.id;
      const familiaNome = item.nome || item.id;
      const entry = famMap.get(familiaId) || {
        id: familiaId,
        nome: familiaNome,
        secaoId: sec.id,
        secaoNome: sec.label
      };
      if (!entry.nome || entry.nome === entry.id) entry.nome = familiaNome;
      if (!entry.secaoId) entry.secaoId = sec.id;
      if (!entry.secaoNome) entry.secaoNome = sec.label;
      famMap.set(familiaId, entry);

      const list = byFamilia.get(familiaId) || [];
      if (!list.some(prod => prod.id === item.id)) {
        list.push({ id: item.id, nome: item.nome || item.id, familiaId, secaoId: sec.id });
      }
      list.sort((a,b) => String(a.nome).localeCompare(String(b.nome), "pt-BR", { sensitivity: "base" }));
      byFamilia.set(familiaId, list);

      PRODUTO_TO_FAMILIA.set(item.id, {
        id: familiaId,
        nome: familiaNome,
        secaoId: sec.id,
        secaoNome: sec.label
      });
    });
  });

  famMap.forEach((value, key) => {
    const arr = byFamilia.get(key) || [];
    arr.sort((a,b) => String(a.nome).localeCompare(String(b.nome), "pt-BR", { sensitivity: "base" }));
    byFamilia.set(key, arr);
  });

  FAMILIA_DATA = Array.from(famMap.values()).sort((a,b) => String(a.nome).localeCompare(String(b.nome), "pt-BR", { sensitivity: "base" }));
  FAMILIA_BY_ID = new Map(FAMILIA_DATA.map(f => [f.id, f]));
  PRODUTOS_BY_FAMILIA = byFamilia;
  PRODUTOS_DATA = rows;

  CAMPAIGN_UNIT_DATA.forEach(unit => {
    const prodMeta = unit.produtoId ? PRODUTO_TO_FAMILIA.get(unit.produtoId) : null;
    if (prodMeta) {
      if (!unit.familiaId) unit.familiaId = prodMeta.id;
      if (!unit.familia) unit.familia = prodMeta.nome || prodMeta.id;
      if (!unit.familiaNome) unit.familiaNome = prodMeta.nome || prodMeta.id;
      if (!unit.secaoId) unit.secaoId = prodMeta.secaoId;
      if (!unit.secao) unit.secao = prodMeta.secaoId;
      if (!unit.secaoNome) unit.secaoNome = prodMeta.secaoNome || getSectionLabel(prodMeta.secaoId);
    } else if (unit.familiaId) {
      const fam = FAMILIA_BY_ID.get(unit.familiaId);
      if (fam) {
        unit.familia = fam.nome || unit.familiaId;
        unit.familiaNome = fam.nome || unit.familiaId;
        if (!unit.secaoId) unit.secaoId = fam.secaoId;
        if (!unit.secaoNome) unit.secaoNome = fam.secaoNome || getSectionLabel(fam.secaoId);
      }
    }
  });
}

// Aqui eu trato o fato de realizados para garantir que datas e números fiquem com tipos corretos.
function normalizarLinhasFatoRealizados(rows){
  return rows.map(raw => {
    const registroId = lerCelula(raw, ["Registro ID", "ID", "registro", "registro_id"]);
    if (!registroId) return null;

    const segmento = lerCelula(raw, ["Segmento"]);
    const segmentoId = lerCelula(raw, ["Segmento ID", "Id Segmento"]);
    const diretoria = lerCelula(raw, ["Diretoria ID", "Diretoria", "Id Diretoria", "Diretoria Codigo"]);
    const diretoriaNome = lerCelula(raw, ["Diretoria Nome", "Diretoria Regional"]) || diretoria;
    const gerencia = lerCelula(raw, ["Gerencia ID", "Gerencia Regional", "Id Gerencia Regional"]);
    const gerenciaNome = lerCelula(raw, ["Gerencia Nome", "Gerencia Regional", "Regional Nome"]) || gerencia;
    const regionalNome = lerCelula(raw, ["Regional Nome", "Regional"]) || gerenciaNome;
    const agenciaId = lerCelula(raw, ["Agencia ID", "Id Agencia", "Agência ID", "Agencia"]);
    const agenciaNome = lerCelula(raw, ["Agencia Nome", "Agência Nome", "Agencia"]);
    const agenciaCodigo = lerCelula(raw, ["Agencia Codigo", "Código Agência", "Codigo Agencia"]) || agenciaId || agenciaNome;
    const gerenteGestao = lerCelula(raw, ["Gerente Gestao ID", "Gerente Gestao", "Id Gerente de Gestao"]);
    const gerenteGestaoNome = lerCelula(raw, ["Gerente Gestao Nome", "Gerente de Gestao", "Gerente Gestao"]) || gerenteGestao;
    const gerente = lerCelula(raw, ["Gerente ID", "Gerente"]);
    const gerenteNome = lerCelula(raw, ["Gerente Nome", "Gerente"]) || gerente;
    const familiaId = lerCelula(raw, ["Familia ID", "Familia", "Família ID"]) || "";
    const familiaNome = lerCelula(raw, ["Familia Nome", "Família", "Familia"]) || familiaId;
    const produtoId = lerCelula(raw, ["id_indicador", "Produto ID", "Produto", "Id Produto"]);
    if (!produtoId) return null;
    const produtoNome = lerCelula(raw, ["ds_indicador", "Produto Nome", "Produto"]) || produtoId;
    const subproduto = lerCelula(raw, ["Subproduto", "Sub produto", "Sub-Produto"]);
    const carteira = lerCelula(raw, ["Carteira"]);
    const canalVenda = lerCelula(raw, ["Canal Venda", "Canal"]);
    const tipoVenda = lerCelula(raw, ["Tipo Venda", "Tipo"]);
    const modalidadePagamento = lerCelula(raw, ["Modalidade Pagamento", "Modalidade"]);
    let data = converterDataISO(lerCelula(raw, ["Data", "Data Movimento", "Data Movimentacao", "Data Movimentação"]));
    let competencia = converterDataISO(lerCelula(raw, ["Competencia", "Competência"]));
    if (!data && competencia) {
      data = competencia;
    }
    if (!competencia && data) {
      competencia = `${data.slice(0, 7)}-01`;
    }
    const realizadoMens = toNumber(lerCelula(raw, ["Realizado Mensal", "Realizado"]));
    const realizadoAcum = toNumber(lerCelula(raw, ["Realizado Acumulado", "Realizado Acum"]));
    const quantidade = toNumber(lerCelula(raw, ["Quantidade", "Qtd"]));
    const variavelReal = toNumber(lerCelula(raw, ["Variavel Real", "Variável Real"]));

    const base = {
      registroId,
      segmento,
      segmentoId,
      diretoria,
      diretoriaNome,
      gerenciaRegional: gerencia,
      gerenciaNome,
      regional: regionalNome,
      agencia: agenciaId || agenciaCodigo || agenciaNome,
      agenciaNome: agenciaNome || agenciaId || agenciaCodigo,
      agenciaCodigo: agenciaCodigo || agenciaId || agenciaNome,
      gerenteGestao,
      gerenteGestaoNome,
      gerente,
      gerenteNome,
      familiaId,
      familiaNome,
      subproduto,
      carteira,
      canalVenda,
      tipoVenda,
      modalidadePagamento,
      data,
      competencia,
      realizado: realizadoMens,
      real_mens: realizadoMens,
      real_acum: realizadoAcum || realizadoMens,
      qtd: quantidade,
      variavelReal,
    };
    aplicarIndicadorAliases(base, produtoId, produtoNome);
    base.prodOrSub = subproduto || base.produtoNome || base.produtoId;
    return base;
  }).filter(Boolean);
}

// Aqui eu deixo o fato de metas com os mesmos padrões de datas e chaves dos realizados para facilitar os cruzamentos.
function normalizarLinhasFatoMetas(rows){
  return rows.map(raw => {
    const registroId = lerCelula(raw, ["Registro ID", "ID", "registro"]);
    if (!registroId) return null;
    const segmento = lerCelula(raw, ["Segmento"]);
    const segmentoId = lerCelula(raw, ["Segmento ID", "Id Segmento"]);
    const diretoria = lerCelula(raw, ["Diretoria ID", "Diretoria", "Id Diretoria"]);
    const diretoriaNome = lerCelula(raw, ["Diretoria Nome", "Diretoria Regional"]) || diretoria;
    const gerencia = lerCelula(raw, ["Gerencia ID", "Gerencia Regional", "Id Gerencia Regional"]);
    const gerenciaNome = lerCelula(raw, ["Gerencia Nome", "Gerencia Regional", "Regional Nome"]) || gerencia;
    const regionalNome = lerCelula(raw, ["Regional Nome", "Regional"]) || gerenciaNome;
    const agenciaId = lerCelula(raw, ["Agencia ID", "Agência ID", "Id Agencia"]);
    const agenciaCodigo = lerCelula(raw, ["Agencia Codigo", "Agência Codigo", "Codigo Agencia"]);
    const agenciaNome = lerCelula(raw, ["Agencia Nome", "Agência Nome", "Agencia"])
      || agenciaCodigo
      || agenciaId;
    const gerenteGestao = lerCelula(raw, ["Gerente Gestao ID", "Gerente Gestao", "Id Gerente de Gestao"]);
    const gerenteGestaoNome = lerCelula(raw, ["Gerente Gestao Nome", "Gerente de Gestao", "Gerente Gestao"]) || gerenteGestao;
    const gerente = lerCelula(raw, ["Gerente ID", "Gerente"]);
    const gerenteNome = lerCelula(raw, ["Gerente Nome", "Gerente"]) || gerente;
    const familiaId = lerCelula(raw, ["Familia ID", "Familia", "Família ID"]);
    const familiaNome = lerCelula(raw, ["Familia Nome", "Família Nome", "Familia"]) || familiaId;
    const produtoId = lerCelula(raw, ["id_indicador", "Produto ID", "Produto", "Id Produto"]);
    const produtoNome = lerCelula(raw, ["ds_indicador", "Produto Nome", "Produto"]) || produtoId;
    const subproduto = lerCelula(raw, ["Subproduto", "Sub produto", "Sub-Produto"]);
    const carteira = lerCelula(raw, ["Carteira"]);
    const canalVenda = lerCelula(raw, ["Canal Venda", "Canal"]);
    const tipoVenda = lerCelula(raw, ["Tipo Venda", "Tipo"]);
    const modalidadePagamento = lerCelula(raw, ["Modalidade Pagamento", "Modalidade"]);
    const metaMens = toNumber(lerCelula(raw, ["Meta Mensal", "Meta"]));
    const metaAcum = toNumber(lerCelula(raw, ["Meta Acumulada", "Meta Acum"]));
    const variavelMeta = toNumber(lerCelula(raw, ["Variavel Meta", "Variável Meta"]));
    const peso = toNumber(lerCelula(raw, ["Peso"]));
    let data = converterDataISO(lerCelula(raw, ["Data", "Data Competencia", "Data da Meta"]));
    let competencia = converterDataISO(lerCelula(raw, ["Competencia", "Competência"]));
    if (!data && competencia) {
      data = competencia;
    }
    if (!competencia && data) {
      competencia = `${data.slice(0, 7)}-01`;
    }
    const base = {
      registroId,
      segmento,
      segmentoId,
      diretoria,
      diretoriaNome,
      gerenciaRegional: gerencia,
      gerenciaNome,
      regional: regionalNome,
      agencia: agenciaId || agenciaCodigo || agenciaNome,
      agenciaNome,
      agenciaCodigo: agenciaCodigo || agenciaId,
      gerenteGestao,
      gerenteGestaoNome,
      gerente,
      gerenteNome,
      familiaId,
      familiaNome,
      subproduto,
      carteira,
      canalVenda,
      tipoVenda,
      modalidadePagamento,
      data,
      competencia,
      meta: metaMens,
      meta_mens: metaMens,
      meta_acum: metaAcum || metaMens,
      variavelMeta,
      peso,
    };
    aplicarIndicadorAliases(base, produtoId, produtoNome);
    base.prodOrSub = subproduto || base.produtoNome || base.produtoId;
    return base;
  }).filter(Boolean);
}

// Aqui eu trato o fato variável (pontos) porque ele vem com os nomes de colunas diferentes das outras bases.
function normalizarLinhasFatoVariavel(rows){
  return rows.map(raw => {
    const registroId = lerCelula(raw, ["Registro ID", "ID", "registro"]);
    if (!registroId) return null;
    const produtoId = lerCelula(raw, ["id_indicador", "Produto ID", "Produto", "Id Produto"]);
    const produtoNome = lerCelula(raw, ["ds_indicador", "Produto Nome", "Produto"]) || produtoId;
    const familiaId = lerCelula(raw, ["Familia ID", "Familia", "Família ID"]);
    const familiaNome = lerCelula(raw, ["Familia Nome", "Família Nome", "Familia"]) || familiaId;
    const variavelMeta = toNumber(lerCelula(raw, ["Variavel Meta", "Variável Meta"]));
    const variavelReal = toNumber(lerCelula(raw, ["Variavel Real", "Variável Real"]));
    let data = converterDataISO(lerCelula(raw, ["Data"]));
    let competencia = converterDataISO(lerCelula(raw, ["Competencia", "Competência"]));
    if (!data && competencia) {
      data = competencia;
    }
    if (!competencia && data) {
      competencia = `${data.slice(0, 7)}-01`;
    }
    const base = {
      registroId,
      familiaId,
      familiaNome,
      data,
      competencia,
      variavelMeta,
      variavelReal,
    };
    aplicarIndicadorAliases(base, produtoId, produtoNome);
    return base;
  }).filter(Boolean);
}

// Aqui eu padronizo os dados das campanhas porque preciso ligar sprint, unidade e indicadores rapidamente.
function normalizarLinhasFatoCampanhas(rows){
  return rows.map(raw => {
    const id = lerCelula(raw, ["Campanha ID", "ID"]);
    if (!id) return null;
    const sprintId = lerCelula(raw, ["Sprint ID", "Sprint"]);
    const diretoria = lerCelula(raw, ["Diretoria", "Diretoria ID", "Id Diretoria"]);
    const diretoriaNome = lerCelula(raw, ["Diretoria Nome", "Diretoria Regional"]) || diretoria;
    const gerencia = lerCelula(raw, ["Gerencia Regional", "Gerencia ID", "Id Gerencia"]);
    const regionalNome = lerCelula(raw, ["Regional Nome", "Regional"]) || gerencia;
    const agenciaCodigo = lerCelula(raw, ["Agencia Codigo", "Agencia ID", "Código Agência", "Agência Codigo"]);
    const agenciaNome = lerCelula(raw, ["Agencia Nome", "Agência Nome", "Agencia"]) || agenciaCodigo;
    const gerenteGestao = lerCelula(raw, ["Gerente Gestao", "Gerente Gestao ID", "Gerente de Gestao"]);
    const gerenteGestaoNome = lerCelula(raw, ["Gerente Gestao Nome", "Gerente de Gestao Nome"]) || gerenteGestao;
    const gerente = lerCelula(raw, ["Gerente", "Gerente ID"]);
    const gerenteNome = lerCelula(raw, ["Gerente Nome"]) || gerente;
    const segmento = lerCelula(raw, ["Segmento"]);
    const familiaId = lerCelula(raw, ["Familia ID", "Família ID", "Familia"]);
    const familiaNome = lerCelula(raw, ["Familia Nome", "Família Nome"]) || familiaId;
    const produtoId = lerCelula(raw, ["id_indicador", "Produto ID", "Produto"]);
    if (!produtoId) return null;
    const produtoNome = lerCelula(raw, ["ds_indicador", "Produto Nome", "Produto"]) || produtoId;
    const subproduto = lerCelula(raw, ["Subproduto", "Sub produto"]);
    const carteira = lerCelula(raw, ["Carteira"]);
    const linhas = toNumber(lerCelula(raw, ["Linhas"]));
    const cash = toNumber(lerCelula(raw, ["Cash"]));
    const conquista = toNumber(lerCelula(raw, ["Conquista"]));
    const atividade = converterBooleano(lerCelula(raw, ["Atividade", "Ativo", "Status"]), true);
    let data = converterDataISO(lerCelula(raw, ["Data"]));
    let competencia = converterDataISO(lerCelula(raw, ["Competencia", "Competência"]));
    if (!data && competencia) {
      data = competencia;
    }
    if (!competencia && data) {
      competencia = `${data.slice(0, 7)}-01`;
    }

    const base = {
      id,
      sprintId,
      diretoria,
      diretoriaNome,
      gerenciaRegional: gerencia,
      regional: regionalNome,
      agenciaCodigo: agenciaCodigo || agenciaNome,
      agencia: agenciaNome || agenciaCodigo,
      agenciaNome: agenciaNome || agenciaCodigo,
      gerenteGestao,
      gerenteGestaoNome,
      gerente,
      gerenteNome,
      segmento,
      familiaId,
      familiaNome,
      subproduto,
      carteira,
      linhas,
      cash,
      conquista,
      atividade,
      data,
      competencia,
    };
    aplicarIndicadorAliases(base, produtoId, produtoNome);
    return base;
  }).filter(Boolean);
}

// Aqui eu organizo o calendário corporativo (competências) para usar nas telas de período.
function normalizarLinhasCalendario(rows){
  return rows.map(raw => {
    const data = converterDataISO(lerCelula(raw, ["Data"]));
    if (!data) return null;
    const competencia = converterDataISO(lerCelula(raw, ["Competencia", "Competência"])) || `${data.slice(0, 7)}-01`;
    const ano = lerCelula(raw, ["Ano"]) || data.slice(0, 4);
    const mes = lerCelula(raw, ["Mes", "Mês"]) || data.slice(5, 7);
    const mesNome = lerCelula(raw, ["Mes Nome", "Mês Nome"]);
    const dia = lerCelula(raw, ["Dia"]) || data.slice(8, 10);
    const diaSemana = lerCelula(raw, ["Dia da Semana"]);
    const semana = lerCelula(raw, ["Semana"]);
    const trimestre = lerCelula(raw, ["Trimestre"]);
    const semestre = lerCelula(raw, ["Semestre"]);
    const ehDiaUtil = converterBooleano(lerCelula(raw, ["Eh Dia Util", "É Dia Útil", "Dia Util"]), false) ? 1 : 0;
    return { data, competencia, ano, mes, mesNome, dia, diaSemana, semana, trimestre, semestre, ehDiaUtil };
  }).filter(Boolean).sort((a, b) => (a.data || "").localeCompare(b.data || ""));
}

// Aqui eu trato a base de status dos indicadores para poder exibir os nomes amigáveis e a ordem certa.
function normalizarLinhasStatus(rows){
  const normalized = [];
  const seen = new Set();
  const missing = new Set();
  const list = Array.isArray(rows) ? rows : [];

  if (!list.length) {
    console.warn("Status_Indicadores.csv não encontrado ou vazio; aplicando valores padrão.");
  }

  const register = (candidate = {}) => {
    const rawKey = pegarPrimeiroPreenchido(
      candidate.key,
      candidate.slug,
      candidate.id,
      candidate.codigo,
      candidate.nome
    );
    const resolvedKey = normalizarChaveStatus(rawKey);
    if (!resolvedKey) return false;
    if (seen.has(resolvedKey)) return true;

    const codigo = limparTexto(candidate.codigo)
      || limparTexto(candidate.id)
      || resolvedKey;
    const nome = limparTexto(candidate.nome)
      || STATUS_LABELS[resolvedKey]
      || limparTexto(candidate.label)
      || codigo
      || resolvedKey;
    const originalId = limparTexto(candidate.id) || codigo || resolvedKey;
    const ordemRaw = limparTexto(candidate.ordem);
    const ordemNum = Number(ordemRaw);
    const ordem = ordemRaw !== "" && Number.isFinite(ordemNum) ? ordemNum : undefined;

    const entry = { id: originalId, codigo, nome, key: resolvedKey };
    if (ordem !== undefined) entry.ordem = ordem;

    normalized.push(entry);
    seen.add(resolvedKey);
    return true;
  };

  list.forEach(raw => {
    if (!raw || typeof raw !== "object") return;
    const nome = lerCelula(raw, ["Status Nome", "Status", "Nome", "Descrição", "Descricao"]);
    const codigo = lerCelula(raw, ["Status Id", "StatusID", "id", "ID", "Codigo", "Código"]);
    const chave = lerCelula(raw, ["Status Chave", "Status Key", "Chave", "Slug"]);
    const ordem = lerCelula(raw, ["Ordem", "Order", "Posicao", "Posição", "Sequencia", "Sequência"]);
    const key = pegarPrimeiroPreenchido(chave, codigo, nome);
    const ok = register({ id: codigo || key, codigo, nome, key, ordem });
    if (!ok) {
      const fallback = pegarPrimeiroPreenchido(nome, codigo, chave);
      if (fallback) missing.add(fallback);
    }
  });

  DEFAULT_STATUS_INDICADORES.forEach(item => register(item));

  if (missing.size) {
    console.warn(`Status sem identificador válido: ${Array.from(missing).join(", ")}`);
  }

  return normalized;
}

function rebuildStatusIndex(rows) {
  const cleaned = [];
  const map = new Map();
  const source = Array.isArray(rows) ? rows : [];

  source.forEach(item => {
    if (!item || typeof item !== "object") return;
    const key = item.key || normalizarChaveStatus(item.id ?? item.codigo ?? item.nome);
    if (!key || map.has(key)) return;
    const ordemRaw = limparTexto(item.ordem);
    const ordemNum = Number(ordemRaw);
    const ordem = ordemRaw !== "" && Number.isFinite(ordemNum) ? ordemNum : undefined;
    const entry = { ...item, key };
    if (ordem !== undefined) entry.ordem = ordem;
    cleaned.push(entry);
    map.set(key, entry);
  });

  DEFAULT_STATUS_INDICADORES.forEach(defaultItem => {
    if (map.has(defaultItem.key)) return;
    const entry = { ...defaultItem };
    cleaned.push(entry);
    map.set(entry.key, entry);
  });

  cleaned.sort((a, b) => {
    if (a.key === "todos") return -1;
    if (b.key === "todos") return 1;
    const ordA = Number.isFinite(a.ordem) ? a.ordem : Number.MAX_SAFE_INTEGER;
    const ordB = Number.isFinite(b.ordem) ? b.ordem : Number.MAX_SAFE_INTEGER;
    if (ordA !== ordB) return ordA - ordB;
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" });
  });

  STATUS_INDICADORES_DATA = cleaned;
  STATUS_BY_KEY = map;
  updateStatusFilterOptions();
}

function getStatusEntry(key) {
  const normalized = normalizarChaveStatus(key);
  if (!normalized) return null;
  return STATUS_BY_KEY.get(normalized) || null;
}

function buildStatusFilterEntries() {
  const base = Array.isArray(STATUS_INDICADORES_DATA) ? STATUS_INDICADORES_DATA : [];
  const entries = base.map(st => {
    const key = st?.key || normalizarChaveStatus(st?.id ?? st?.codigo ?? st?.nome);
    if (!key) return null;
    const label = st?.nome || obterRotuloStatus(key, st?.codigo ?? st?.id ?? key);
    const codigo = st?.codigo ?? st?.id ?? key;
    let ordem = st?.ordem;
    if (typeof ordem === "string" && ordem !== "") {
      const parsed = Number(ordem);
      ordem = Number.isFinite(parsed) ? parsed : undefined;
    }
    if (!Number.isFinite(ordem)) {
      ordem = Number.isFinite(st?.ordem) ? st.ordem : Number.MAX_SAFE_INTEGER;
    }
    return {
      key,
      value: key,
      label,
      codigo,
      id: st?.id ?? codigo,
      ordem,
    };
  }).filter(Boolean);

  if (!entries.some(entry => entry.key === "todos")) {
    entries.unshift({
      key: "todos",
      value: "todos",
      label: STATUS_LABELS.todos,
      codigo: "todos",
      id: "todos",
      ordem: -Infinity,
    });
  }

  entries.sort((a, b) => {
    if (a.key === "todos") return -1;
    if (b.key === "todos") return 1;
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return String(a.label || "").localeCompare(String(b.label || ""), "pt-BR", { sensitivity: "base" });
  });

  return entries;
}

function updateStatusFilterOptions(preserveSelection = true) {
  const select = document.getElementById("f-status-kpi");
  if (!select) return;

  const previousOption = select.selectedOptions?.[0] || null;
  const previousKey = preserveSelection
    ? (previousOption?.dataset.statusKey || normalizarChaveStatus(select.value) || "")
    : "";

  const entries = buildStatusFilterEntries();
  select.innerHTML = "";

  entries.forEach(entry => {
    const opt = document.createElement("option");
    opt.value = entry.value;
    opt.textContent = entry.label;
    opt.dataset.statusKey = entry.key;
    if (entry.codigo !== undefined) opt.dataset.statusCodigo = entry.codigo;
    if (entry.id !== undefined) opt.dataset.statusId = entry.id;
    select.appendChild(opt);
  });

  if (preserveSelection && previousKey) {
    const match = entries.find(entry => entry.key === previousKey);
    if (match) {
      select.value = match.value;
    }
  }

  if (!entries.some(entry => entry.value === select.value)) {
    const fallback = entries.find(entry => entry.key === "todos") || entries[0];
    if (fallback) {
      select.value = fallback.value;
    }
  }
}

// Carrega os CSVs da pasta "Bases" usando o loader tolerante
async function loadBaseData(){
  showLoader("Carregando dados…");
  try {
    const basePath = "Bases/";

    const [
      mesuRaw,
      produtoRaw,
      statusRaw,
      realizadosRaw,
      metasRaw,
      variavelRaw,
      campanhasRaw,
      calendarioRaw,
      leadsRaw,
    ] = await Promise.all([
      loadCSVAuto(`${basePath}mesu.csv`),
      loadCSVAuto(`${basePath}Produto.csv`),
      loadCSVAuto(`${basePath}Status_Indicadores.csv`),
      loadCSVAuto(`${basePath}fRealizados.csv`).catch(() => []),
      loadCSVAuto(`${basePath}fMetas.csv`).catch(() => []),
      loadCSVAuto(`${basePath}fVariavel.csv`).catch(() => []),
      loadCSVAuto(`${basePath}fCampanhas.csv`).catch(() => []),
      loadCSVAuto(`${basePath}dCalendario.csv`).catch(() => []),
      loadCSVAuto(`${basePath}leads_propensos.csv`).catch(() => []),
    ]);

    const mesuRows = normalizarLinhasMesu(mesuRaw);
    const produtoRows = normalizarLinhasProdutos(produtoRaw);
    const statusRows = normalizarLinhasStatus(statusRaw);
    if (statusRows.length) {
      rebuildStatusIndex(statusRows);
    } else {
      rebuildStatusIndex(DEFAULT_STATUS_INDICADORES);
    }

    montarDadosProdutos(produtoRows);
    montarHierarquiaMesu(mesuRows);

    FACT_REALIZADOS = normalizarLinhasFatoRealizados(realizadosRaw);
    FACT_METAS = normalizarLinhasFatoMetas(metasRaw);
    FACT_VARIAVEL = normalizarLinhasFatoVariavel(variavelRaw);
    FACT_CAMPANHAS = normalizarLinhasFatoCampanhas(campanhasRaw);
    if (FACT_CAMPANHAS.length) {
      replaceCampaignUnitData(FACT_CAMPANHAS);
    }
    DIM_CALENDARIO = normalizarLinhasCalendario(calendarioRaw);
    updateCampaignSprintsUnits();

    OPPORTUNITY_LEADS_RAW = Array.isArray(leadsRaw) ? leadsRaw : [];
    ingestOpportunityLeadRows(OPPORTUNITY_LEADS_RAW);

    const availableDatesSource = (DIM_CALENDARIO.length
      ? DIM_CALENDARIO.map(row => row.data)
      : [
          ...FACT_REALIZADOS.flatMap(row => [row.data, row.competencia]),
          ...FACT_METAS.flatMap(row => [row.data, row.competencia]),
          ...FACT_VARIAVEL.flatMap(row => [row.data, row.competencia]),
        ]
    );
    const availableDates = availableDatesSource.filter(Boolean).sort();
    AVAILABLE_DATE_MAX = availableDates[availableDates.length - 1] || "";
    state.period = getDefaultPeriodRange();

    state._raw = {
      mesu: mesuRows,
      produto: produtoRows,
      status: STATUS_INDICADORES_DATA,
      dados: FACT_REALIZADOS,
      realizados: FACT_REALIZADOS,
      metas: FACT_METAS,
      variavel: FACT_VARIAVEL,
      campanhas: FACT_CAMPANHAS,
      calendario: DIM_CALENDARIO,
    };
  } finally {
    hideLoader();
  }
}



/* ===== Aqui eu ajusto a altura da topbar para o CSS responsivo funcionar ===== */
// Aqui eu calculo a altura real da topbar e jogo no CSS para o layout não quebrar ao abrir menus.
const setTopbarH = () => {
  const h = document.querySelector('.topbar')?.offsetHeight || 56;
  document.documentElement.style.setProperty('--topbar-h', `${h}px`);
};
window.addEventListener('load', setTopbarH);
window.addEventListener('resize', setTopbarH);
setTopbarH();

/* ===== Aqui eu defino as visões (chips) que aparecem acima da tabela detalhada ===== */
// Aqui eu descrevo as visões possíveis da tabela para alternar entre diretoria, gerente etc.
const TABLE_VIEWS = [
  { id:"diretoria", label:"Diretoria", key:"diretoria" },
  { id:"gerencia",  label:"Regional",  key:"gerenciaRegional" },
  { id:"agencia",   label:"Agência",            key:"agencia" },
  { id:"gGestao",   label:"Gerente de gestão",  key:"gerenteGestao" },
  { id:"gerente",   label:"Gerente",            key:"gerente" },
  { id:"secao",    label:"Seção",             key:"secao" },
  { id:"familia",   label:"Família",            key:"familia" },
  { id:"prodsub",   label:"Indicador",          key:"prodOrSub" },
  { id:"contrato",  label:"Contratos",          key:"contrato" },
];

/* === Seções e cards === */
// Aqui eu defino os grupos de indicadores que viram cards no resumo.
const CARD_SECTIONS_DEF = [
  { id:"captacao", label:"CAPTAÇÃO", items:[
    { id:"captacao_bruta",   nome:"Captação Bruta",                           icon:"ti ti-pig-money",       peso:4, metric:"valor" },
    { id:"captacao_liquida", nome:"Captação Líquida",                         icon:"ti ti-arrows-exchange", peso:4, metric:"valor" },
    { id:"portab_prev",      nome:"Portabilidade de Previdência Privada",     icon:"ti ti-shield-check",    peso:3, metric:"valor" },
    { id:"centralizacao",    nome:"Centralização de Caixa",                   icon:"ti ti-briefcase",       peso:3, metric:"valor" },
  ]},
  { id:"financeiro", label:"FINANCEIRO", items:[
    { id:"rec_vencidos_59",     nome:"Recuperação de Vencidos até 59 dias",      icon:"ti ti-rotate-rectangle", peso:6, metric:"valor" },
    { id:"rec_vencidos_50mais", nome:"Recuperação de Vencidos acima de 50 dias", icon:"ti ti-rotate-rectangle", peso:5, metric:"valor" },
    { id:"rec_credito",         nome:"Recuperação de Crédito",                    icon:"ti ti-cash",             peso:5, metric:"valor" },
  ]},
  { id:"credito", label:"CRÉDITO", items:[
    { id:"prod_credito_pj", nome:"Produção de Crédito PJ",               icon:"ti ti-building-bank",  peso:8, metric:"valor" },
    { id:"rotativo_pj_vol", nome:"Limite Rotativo PJ (Volume)",          icon:"ti ti-wallet",         peso:3, metric:"valor" },
    { id:"rotativo_pj_qtd", nome:"Limite Rotativo PJ (Quantidade)",      icon:"ti ti-list-numbers",   peso:3, metric:"qtd" },
  ]},
  { id:"ligadas", label:"LIGADAS", items:[
    { id:"cartoes",    nome:"Cartões",    icon:"ti ti-credit-card",   peso:4, metric:"perc" },
    { id:"consorcios", nome:"Consórcios", icon:"ti ti-building-bank", peso:3, metric:"perc" },
    { id:"seguros",    nome:"Seguros",    icon:"ti ti-shield-lock",   peso:5, metric:"perc" },
  ]},
  { id:"produtividade", label:"PRODUTIVIDADE", items:[
    { id:"sucesso_equipe_credito", nome:"Sucesso de Equipe Crédito", icon:"ti ti-activity", peso:10, metric:"perc" },
  ]},
  { id:"clientes", label:"CLIENTES", items:[
    { id:"conquista_qualif_pj", nome:"Conquista Qualificada Gerenciado PJ",      icon:"ti ti-user-star",   peso:3, metric:"qtd" },
    { id:"conquista_folha",     nome:"Conquista de Clientes Folha de Pagamento", icon:"ti ti-users-group", peso:3, metric:"qtd" },
    { id:"bradesco_expresso",   nome:"Bradesco Expresso",                        icon:"ti ti-bolt",        peso:2, metric:"perc" },
  ]},
];

CARD_SECTIONS_DEF.forEach(sec => {
  sec.items.forEach(item => {
    registrarAliasIndicador(item.id, item.id);
    registrarAliasIndicador(item.id, item.nome);
  });
});

const SECTION_IDS = new Set(CARD_SECTIONS_DEF.map(sec => sec.id));
const SECTION_BY_ID = new Map(CARD_SECTIONS_DEF.map(sec => [sec.id, sec]));

// Aqui eu deixo prontas as opções de visão acumulada para mudar o período sem ter que mexer no calendário manualmente.
const ACCUMULATED_VIEW_OPTIONS = [
  { value: "mensal",      label: "Mensal",      monthsBack: 0 },
  { value: "trimestral",  label: "Trimestral",  monthsBack: 2 },
  { value: "semestral",   label: "Semestral",   monthsBack: 5 },
  { value: "anual",       label: "Anual",       monthsBack: 11 },
];

// Aqui eu busco o nome bonitinho da seção pelo id.
function getSectionLabel(id) {
  if (!id) return "";
  return SECTION_BY_ID.get(id)?.label || id;
}

// Aqui eu tento descobrir a seção de um indicador olhando tanto a linha quanto a relação produto → seção.
function resolveSectionMetaFromRow(row) {
  if (!row) return { id: "", label: "" };
  const prodMeta = row.produtoId ? PRODUTO_TO_FAMILIA.get(row.produtoId) : null;
  const fromRow = row.secaoId || row.secao || row.familiaSecaoId;
  const fromProd = prodMeta?.secaoId || PRODUCT_INDEX.get(row.produtoId)?.sectionId || "";
  const sectionId = fromRow || fromProd || "";
  const label = row.secaoNome
    || prodMeta?.secaoNome
    || getSectionLabel(sectionId)
    || sectionId;
  return { id: sectionId, label: label || sectionId };
}

// Aqui eu garanto que cada linha tenha uma família associada, buscando informações extras quando necessário.
function resolveFamilyMetaFromRow(row) {
  if (!row) return { id: "", label: "" };
  const prodMeta = row.produtoId ? PRODUTO_TO_FAMILIA.get(row.produtoId) : null;
  let familiaId = row.familiaId || row.familia || prodMeta?.id || "";
  let familiaLabel = row.familiaNome || prodMeta?.nome || "";

  if (familiaId && !familiaLabel) {
    const famRow = FAMILIA_BY_ID.get(familiaId);
    if (famRow?.nome) familiaLabel = famRow.nome;
  }

  if (!familiaId) {
    const sectionMeta = resolveSectionMetaFromRow(row);
    familiaId = sectionMeta.id || "";
    familiaLabel = sectionMeta.label || familiaId;
  }

  if (!familiaLabel) familiaLabel = familiaId;

  return { id: familiaId, label: familiaLabel };
}

/* Aqui eu monto um índice de produto para descobrir família/seção sem ficar recalculando */
const PRODUCT_INDEX = (() => {
  const map = new Map();
  CARD_SECTIONS_DEF.forEach(sec => {
    sec.items.forEach(it => {
      map.set(it.id, { sectionId: sec.id, name: it.nome, icon: it.icon, metric: it.metric, peso: it.peso });
    });
  });
  return map;
})();

const DEFAULT_CAMPAIGN_UNIT_DATA = [
  { id: "nn-atlas", diretoria: "DR 01", diretoriaNome: "Norte & Nordeste", gerenciaRegional: "GR 01", regional: "Regional Fortaleza", gerenteGestao: "GG 01", agenciaCodigo: "Ag 1001", agencia: "Agência 1001 • Fortaleza Centro", segmento: "Negócios", produtoId: "captacao_bruta", subproduto: "Aplicação", gerente: "Gerente 1", gerenteNome: "Ana Lima", carteira: "Carteira Atlas", linhas: 132.4, cash: 118.2, conquista: 112.6, atividade: true, data: "2025-09-15" },
  { id: "nn-delta", diretoria: "DR 01", diretoriaNome: "Norte & Nordeste", gerenciaRegional: "GR 01", regional: "Regional Fortaleza", gerenteGestao: "GG 01", agenciaCodigo: "Ag 1001", agencia: "Agência 1001 • Fortaleza Centro", segmento: "Negócios", produtoId: "captacao_liquida", subproduto: "Resgate", gerente: "Gerente 1", gerenteNome: "Ana Lima", carteira: "Carteira Delta", linhas: 118.3, cash: 109.5, conquista: 104.1, atividade: true, data: "2025-09-16" },
  { id: "nn-iguatu", diretoria: "DR 01", diretoriaNome: "Norte & Nordeste", gerenciaRegional: "GR 02", regional: "Regional Recife", gerenteGestao: "GG 02", agenciaCodigo: "Ag 1002", agencia: "Agência 1002 • Recife Boa Vista", segmento: "Empresas", produtoId: "prod_credito_pj", subproduto: "À vista", gerente: "Gerente 2", gerenteNome: "Paulo Nunes", carteira: "Carteira Iguatu", linhas: 124.2, cash: 110.3, conquista: 102.1, atividade: true, data: "2025-09-12" },
  { id: "nn-sertao", diretoria: "DR 01", diretoriaNome: "Norte & Nordeste", gerenciaRegional: "GR 02", regional: "Regional Recife", gerenteGestao: "GG 02", agenciaCodigo: "Ag 1002", agencia: "Agência 1002 • Recife Boa Vista", segmento: "Empresas", produtoId: "centralizacao", subproduto: "Parcelado", gerente: "Gerente 2", gerenteNome: "Paulo Nunes", carteira: "Carteira Sertão", linhas: 98.4, cash: 94.6, conquista: 96.8, atividade: false, data: "2025-09-09" },
  { id: "sd-horizonte", diretoria: "DR 02", diretoriaNome: "Sudeste", gerenciaRegional: "GR 03", regional: "Regional São Paulo", gerenteGestao: "GG 03", agenciaCodigo: "Ag 1004", agencia: "Agência 1004 • Avenida Paulista", segmento: "Empresas", produtoId: "rotativo_pj_vol", subproduto: "Aplicação", gerente: "Gerente 3", gerenteNome: "Juliana Prado", carteira: "Carteira Horizonte", linhas: 115.2, cash: 120.5, conquista: 108.4, atividade: true, data: "2025-09-14" },
  { id: "sd-paulista", diretoria: "DR 02", diretoriaNome: "Sudeste", gerenciaRegional: "GR 03", regional: "Regional São Paulo", gerenteGestao: "GG 03", agenciaCodigo: "Ag 1004", agencia: "Agência 1004 • Avenida Paulista", segmento: "Empresas", produtoId: "rotativo_pj_qtd", subproduto: "Resgate", gerente: "Gerente 3", gerenteNome: "Juliana Prado", carteira: "Carteira Paulista", linhas: 104.8, cash: 99.1, conquista: 101.3, atividade: true, data: "2025-09-06" },
  { id: "sd-bandeirantes", diretoria: "DR 02", diretoriaNome: "Sudeste", gerenciaRegional: "GR 03", regional: "Regional São Paulo", gerenteGestao: "GG 03", agenciaCodigo: "Ag 1004", agencia: "Agência 1004 • Avenida Paulista", segmento: "Negócios", produtoId: "consorcios", subproduto: "Parcelado", gerente: "Gerente 4", gerenteNome: "Bruno Garcia", carteira: "Carteira Bandeirantes", linhas: 92.7, cash: 88.6, conquista: 94.2, atividade: true, data: "2025-09-10" },
  { id: "sd-capital", diretoria: "DR 02", diretoriaNome: "Sudeste", gerenciaRegional: "GR 03", regional: "Regional São Paulo", gerenteGestao: "GG 03", agenciaCodigo: "Ag 1004", agencia: "Agência 1004 • Avenida Paulista", segmento: "Negócios", produtoId: "cartoes", subproduto: "À vista", gerente: "Gerente 4", gerenteNome: "Bruno Garcia", carteira: "Carteira Capital", linhas: 105.6, cash: 102.4, conquista: 100.2, atividade: true, data: "2025-09-18" },
  { id: "sc-curitiba", diretoria: "DR 03", diretoriaNome: "Sul & Centro-Oeste", gerenciaRegional: "GR 04", regional: "Regional Curitiba", gerenteGestao: "GG 02", agenciaCodigo: "Ag 1003", agencia: "Agência 1003 • Curitiba Batel", segmento: "MEI", produtoId: "seguros", subproduto: "Aplicação", gerente: "Gerente 5", gerenteNome: "Carla Menezes", carteira: "Carteira Curitiba", linhas: 109.6, cash: 101.2, conquista: 98.5, atividade: true, data: "2025-09-11" },
  { id: "sc-litoral", diretoria: "DR 03", diretoriaNome: "Sul & Centro-Oeste", gerenciaRegional: "GR 04", regional: "Regional Curitiba", gerenteGestao: "GG 02", agenciaCodigo: "Ag 1003", agencia: "Agência 1003 • Curitiba Batel", segmento: "MEI", produtoId: "bradesco_expresso", subproduto: "Resgate", gerente: "Gerente 5", gerenteNome: "Carla Menezes", carteira: "Carteira Litoral", linhas: 95.4, cash: 90.1, conquista: 92.8, atividade: true, data: "2025-09-07" },
  { id: "sc-vale", diretoria: "DR 03", diretoriaNome: "Sul & Centro-Oeste", gerenciaRegional: "GR 04", regional: "Regional Curitiba", gerenteGestao: "GG 02", agenciaCodigo: "Ag 1003", agencia: "Agência 1003 • Curitiba Batel", segmento: "MEI", produtoId: "rec_credito", subproduto: "À vista", gerente: "Gerente 5", gerenteNome: "Carla Menezes", carteira: "Carteira Vale", linhas: 120.2, cash: 115.6, conquista: 110.4, atividade: true, data: "2025-09-17" },
  { id: "nn-manaus", diretoria: "DR 01", diretoriaNome: "Norte & Nordeste", gerenciaRegional: "GR 05", regional: "Regional Manaus", gerenteGestao: "GG 05", agenciaCodigo: "Ag 2001", agencia: "Agência 2001 • Manaus Centro", segmento: "Negócios", produtoId: "captacao_bruta", subproduto: "Aplicação", gerente: "Lara Costa", gerenteNome: "Lara Costa", carteira: "Carteira Amazônia", linhas: 119.4, cash: 111.8, conquista: 103.2, atividade: true, data: "2025-09-12" },
  { id: "sc-floripa", diretoria: "DR 03", diretoriaNome: "Sul & Centro-Oeste", gerenciaRegional: "GR 06", regional: "Regional Florianópolis", gerenteGestao: "GG 06", agenciaCodigo: "Ag 2002", agencia: "Agência 2002 • Florianópolis Beira-Mar", segmento: "Empresas", produtoId: "rotativo_pj_vol", subproduto: "Volume", gerente: "Sofia Martins", gerenteNome: "Sofia Martins", carteira: "Carteira Litoral", linhas: 108.6, cash: 116.3, conquista: 105.5, atividade: true, data: "2025-09-16" },
  { id: "sc-goiania", diretoria: "DR 03", diretoriaNome: "Sul & Centro-Oeste", gerenciaRegional: "GR 07", regional: "Regional Goiânia", gerenteGestao: "GG 07", agenciaCodigo: "Ag 2003", agencia: "Agência 2003 • Goiânia Setor Bueno", segmento: "MEI", produtoId: "bradesco_expresso", subproduto: "Expresso", gerente: "Tiago Andrade", gerenteNome: "Tiago Andrade", carteira: "Carteira Centro-Oeste", linhas: 102.5, cash: 94.2, conquista: 97.1, atividade: true, data: "2025-09-15" },
  { id: "sd-campinas", diretoria: "DR 02", diretoriaNome: "Sudeste", gerenciaRegional: "GR 05", regional: "Regional Campinas", gerenteGestao: "GG 05", agenciaCodigo: "Ag 2004", agencia: "Agência 2004 • Campinas Tech", segmento: "Negócios", produtoId: "centralizacao", subproduto: "Cash", gerente: "Eduardo Freitas", gerenteNome: "Eduardo Freitas", carteira: "Carteira Inovação", linhas: 123.1, cash: 129.4, conquista: 111.7, atividade: true, data: "2025-09-09" }
];
DEFAULT_CAMPAIGN_UNIT_DATA.forEach(unit => aplicarIndicadorAliases(unit, unit.produtoId, unit.produtoNome || unit.produtoId));

const CAMPAIGN_UNIT_DATA = [];

function replaceCampaignUnitData(rows = []) {
  CAMPAIGN_UNIT_DATA.length = 0;
  const source = Array.isArray(rows) && rows.length ? rows : DEFAULT_CAMPAIGN_UNIT_DATA;
  source.forEach(item => {
    const dataISO = converterDataISO(item.data);
    let competencia = converterDataISO(item.competencia);
    const resolvedData = dataISO || "";
    if (!competencia && resolvedData) {
      competencia = `${resolvedData.slice(0, 7)}-01`;
    }
    CAMPAIGN_UNIT_DATA.push({ ...item, data: resolvedData, competencia: competencia || "" });
  });
}

replaceCampaignUnitData(DEFAULT_CAMPAIGN_UNIT_DATA);

CAMPAIGN_UNIT_DATA.forEach(unit => {
  const meta = PRODUCT_INDEX.get(unit.produtoId);
  const familiaMeta = PRODUTO_TO_FAMILIA.get(unit.produtoId);
  if (familiaMeta) {
    if (!unit.familiaId) unit.familiaId = familiaMeta.id;
    if (!unit.familia) unit.familia = familiaMeta.nome || familiaMeta.id;
    if (!unit.familiaNome) unit.familiaNome = familiaMeta.nome || familiaMeta.id;
    if (!unit.secaoId) unit.secaoId = familiaMeta.secaoId || meta?.sectionId;
    if (!unit.secao) unit.secao = familiaMeta.secaoId || meta?.sectionId;
    if (!unit.secaoNome) unit.secaoNome = familiaMeta.secaoNome || meta?.sectionLabel || getSectionLabel(familiaMeta.secaoId);
  } else if (meta?.sectionId) {
    if (!unit.familiaId) unit.familiaId = meta.sectionId;
    if (!unit.familia) unit.familia = meta.sectionId;
    if (!unit.secaoId) unit.secaoId = meta.sectionId;
    if (!unit.secao) unit.secao = meta.sectionId;
    if (!unit.secaoNome) unit.secaoNome = meta.sectionLabel || meta.sectionId;
    if (!unit.familiaNome) unit.familiaNome = meta.sectionLabel || meta.sectionId;
  }
  if (!unit.produtoNome) unit.produtoNome = meta?.name || unit.produto || unit.produtoId || "Indicador";
  if (!unit.gerenteGestaoNome) {
    const numeric = (unit.gerenteGestao || "").replace(/[^0-9]/g, "");
    unit.gerenteGestaoNome = numeric ? `Gerente geral ${numeric}` : "Gerente geral";
  }
  if (!unit.familiaNome && unit.familia) unit.familiaNome = unit.familia;
  if (!unit.subproduto) unit.subproduto = "";
  if (unit.subproduto) registrarAliasIndicador(unit.produtoId, unit.subproduto);
});
const CAMPAIGN_SPRINTS = [
  {
    id: "sprint-pj-2025",
    label: "Sprint PJ 2025",
    cycle: "Sprint PJ • Setembro a Dezembro 2025",
    period: { start: "2025-09-01", end: "2025-12-31" },
    note: "Projete cenários e acompanhe apenas as unidades visíveis nos filtros atuais.",
    headStats: [
      { label: "Meta mínima", value: "100 pts" },
      { label: "Indicador mínimo", value: "90%" },
      { label: "Teto considerado", value: "150%" }
    ],
    summary: [
      { id: "equipes", label: "Equipes elegíveis", value: CAMPAIGN_UNIT_DATA.length, total: CAMPAIGN_UNIT_DATA.length },
      { id: "media", label: "Pontuação média", value: 0, unit: "pts" },
      { id: "recorde", label: "Maior pontuação", value: 0, unit: "pts", complement: "" },
      { id: "atualizacao", label: "Atualização", text: "20/09/2025 08:30" }
    ],
    team: {
      minThreshold: 90,
      superThreshold: 120,
      cap: 150,
      eligibilityMinimum: 100,
      defaultPreset: "meta",
      indicators: [
        { id: "linhas", label: "Linhas governamentais", short: "Linhas", weight: 40, hint: "Operações direcionadas, BB Giro e BNDES.", default: 100 },
        { id: "cash", label: "Cash (TPV)", short: "Cash", weight: 30, hint: "Centralização de caixa e TPV eletrônico.", default: 100 },
        { id: "conquista", label: "Conquista cliente PJ", short: "Conquista", weight: 30, hint: "Abertura de contas e ativação digital.", default: 100 }
      ],
      presets: [
        { id: "minimo", label: "Mínimo obrigatório (90%)", values: { linhas: 90, cash: 90, conquista: 90 } },
        { id: "meta", label: "Meta do sprint (100%)", values: { linhas: 100, cash: 100, conquista: 100 } },
        { id: "stretch", label: "Meta esticada (120%)", values: { linhas: 120, cash: 120, conquista: 120 } }
      ]
    },
    individual: {
      profiles: [
        {
          id: "negocios",
          label: "Negócios",
          description: "Carteiras MPE com foco em relacionamento consultivo.",
          minThreshold: 90,
          superThreshold: 120,
          cap: 150,
          eligibilityMinimum: 100,
          defaultPreset: "meta",
          indicators: [
            { id: "linhas", label: "Linhas governamentais", short: "Linhas", weight: 40, default: 100 },
            { id: "cash", label: "Cash (TPV)", short: "Cash", weight: 30, default: 100 },
            { id: "conquista", label: "Conquista cliente PJ", short: "Conquista", weight: 30, default: 100 }
          ],
          presets: [
            { id: "minimo", label: "90% em todos", values: { linhas: 90, cash: 90, conquista: 90 } },
            { id: "meta", label: "Meta (100%)", values: { linhas: 100, cash: 100, conquista: 100 } },
            { id: "destaque", label: "Stretch (120%)", values: { linhas: 120, cash: 120, conquista: 120 } }
          ],
          scenarios: [
            { id: "full", label: "100% em todas as linhas", values: { linhas: 100, cash: 100, conquista: 100 }, note: "Parabéns" },
            { id: "linhas120", label: "Linhas 120%, Cash 100%, Conquista 90%", values: { linhas: 120, cash: 100, conquista: 90 }, note: "Elegível" },
            { id: "cash115", label: "Linhas 95%, Cash 115%, Conquista 130%", values: { linhas: 95, cash: 115, conquista: 130 }, note: "Elegível" },
            { id: "ajuste", label: "Linhas 85%, Cash 80%, Conquista 110%", values: { linhas: 85, cash: 80, conquista: 110 }, note: "Ajustar" }
          ]
        },
        {
          id: "empresas",
          label: "Empresas",
          description: "Grandes empresas e governo com foco em volume.",
          minThreshold: 90,
          superThreshold: 120,
          cap: 150,
          eligibilityMinimum: 100,
          defaultPreset: "meta",
          indicators: [
            { id: "linhas", label: "Linhas governamentais", short: "Linhas", weight: 45, default: 100 },
            { id: "cash", label: "Cash (TPV)", short: "Cash", weight: 35, default: 100 },
            { id: "conquista", label: "Conquista cliente PJ", short: "Conquista", weight: 20, default: 100 }
          ],
          presets: [
            { id: "minimo", label: "90% em todos", values: { linhas: 90, cash: 90, conquista: 90 } },
            { id: "meta", label: "Meta (100%)", values: { linhas: 100, cash: 100, conquista: 100 } },
            { id: "stretch", label: "Stretch (120%)", values: { linhas: 120, cash: 120, conquista: 120 } }
          ],
          scenarios: [
            { id: "volume", label: "Linhas 130%, Cash 115%, Conquista 95%", values: { linhas: 130, cash: 115, conquista: 95 }, note: "Parabéns" },
            { id: "equilibrio", label: "Linhas 110%, Cash 105%, Conquista 100%", values: { linhas: 110, cash: 105, conquista: 100 }, note: "Elegível" },
            { id: "alerta", label: "Linhas 92%, Cash 88%, Conquista 96%", values: { linhas: 92, cash: 88, conquista: 96 }, note: "Ajustar" },
            { id: "critico", label: "Linhas 80%, Cash 78%, Conquista 85%", values: { linhas: 80, cash: 78, conquista: 85 }, note: "Não elegível" }
          ]
        }
      ]
    },
    units: CAMPAIGN_UNIT_DATA
  }
];

function updateCampaignSprintsUnits() {
  CAMPAIGN_SPRINTS.forEach(sprint => {
    const filtered = CAMPAIGN_UNIT_DATA.filter(unit => !unit.sprintId || unit.sprintId === sprint.id);
    const effectiveUnits = filtered.length ? filtered : CAMPAIGN_UNIT_DATA;
    sprint.units = effectiveUnits;

    const summaryList = Array.isArray(sprint.summary) ? sprint.summary : [];
    const summaryById = new Map(summaryList.map(item => [item.id, item]));
    const totalUnits = effectiveUnits.length;

    const equipesItem = summaryById.get("equipes");
    if (equipesItem) {
      equipesItem.value = totalUnits;
      equipesItem.total = totalUnits;
    }

    const scores = effectiveUnits.map(unit => computeCampaignScore(sprint.team, {
      linhas: unit.linhas,
      cash: unit.cash,
      conquista: unit.conquista,
    }));

    const mediaItem = summaryById.get("media");
    if (mediaItem) {
      const sum = scores.reduce((acc, score) => acc + (score?.totalPoints || 0), 0);
      mediaItem.value = totalUnits ? sum / totalUnits : 0;
    }

    const recordItem = summaryById.get("recorde");
    if (recordItem) {
      let maxPoints = -Infinity;
      let destaque = "";
      effectiveUnits.forEach((unit, idx) => {
        const pts = scores[idx]?.totalPoints ?? 0;
        if (pts > maxPoints) {
          maxPoints = pts;
          destaque = unit.agenciaNome || unit.agencia || unit.regional || unit.diretoriaNome || "";
        }
      });
      recordItem.value = maxPoints > 0 ? maxPoints : 0;
      if (destaque) recordItem.complement = destaque;
    }
  });
}

updateCampaignSprintsUnits();

const CAMPAIGN_LEVEL_META = {
  diretoria:     { groupField: "diretoria", displayField: "diretoriaNome", singular: "Diretoria", plural: "diretorias" },
  regional:      { groupField: "gerenciaRegional", displayField: "regional", singular: "Regional", plural: "regionais" },
  agencia:       { groupField: "agenciaCodigo", displayField: "agencia", singular: "Agência", plural: "agências" },
  gerenteGestao: { groupField: "gerenteGestao", displayField: "gerenteGestaoNome", singular: "Gerente geral", plural: "gerentes gerais" },
  gerente:       { groupField: "gerente", displayField: "gerenteNome", singular: "Gerente", plural: "gerentes" },
  produto:       { groupField: "produtoId", displayField: "produtoNome", singular: "Indicador", plural: "indicadores" },
  carteira:      { groupField: "carteira", displayField: "carteira", singular: "Carteira", plural: "carteiras" }
};

function determineCampaignDisplayLevel(filters = getFilterValues()) {
  if (filters.produtoId && filters.produtoId !== "Todos" && filters.produtoId !== "Todas") {
    return { level: "produto", meta: CAMPAIGN_LEVEL_META.produto };
  }
  if (filters.familiaId && filters.familiaId !== "Todas") {
    return { level: "produto", meta: CAMPAIGN_LEVEL_META.produto };
  }
  if (filters.secaoId && filters.secaoId !== "Todas") {
    return { level: "produto", meta: CAMPAIGN_LEVEL_META.produto };
  }
  if (filters.gerente && filters.gerente !== "Todos") {
    return { level: "produto", meta: CAMPAIGN_LEVEL_META.produto };
  }
  if (filters.ggestao && filters.ggestao !== "Todos") {
    return { level: "gerente", meta: CAMPAIGN_LEVEL_META.gerente };
  }
  if (filters.agencia && filters.agencia !== "Todas") {
    return { level: "gerenteGestao", meta: CAMPAIGN_LEVEL_META.gerenteGestao };
  }
  if (filters.gerencia && filters.gerencia !== "Todas") {
    return { level: "agencia", meta: CAMPAIGN_LEVEL_META.agencia };
  }
  if (filters.diretoria && filters.diretoria !== "Todas") {
    return { level: "regional", meta: CAMPAIGN_LEVEL_META.regional };
  }
  return { level: "diretoria", meta: CAMPAIGN_LEVEL_META.diretoria };
}

function filterCampaignUnits(sprint, filters = getFilterValues()) {
  const startISO = state.period.start;
  const endISO = state.period.end;
  const factRows = Array.isArray(state.facts?.campanhas) && state.facts.campanhas.length
    ? state.facts.campanhas
    : fCampanhas;
  const base = sprint
    ? (factRows.filter(row => row.sprintId === sprint.id) || [])
    : [];
  const units = base.length ? base : (sprint?.units || []);
  return units.filter(unit => {
    const okSegmento = (!filters.segmento || filters.segmento === "Todos" || unit.segmento === filters.segmento);
    const okDiretoria = (!filters.diretoria || filters.diretoria === "Todas" || unit.diretoria === filters.diretoria);
    const okGerencia = (!filters.gerencia || filters.gerencia === "Todas" || unit.gerenciaRegional === filters.gerencia);
    const okAgencia = (!filters.agencia || filters.agencia === "Todas" || unit.agenciaCodigo === filters.agencia);
    const okGG = (!filters.ggestao || filters.ggestao === "Todos" || unit.gerenteGestao === filters.ggestao);
    const okGerente = (!filters.gerente || filters.gerente === "Todos" || unit.gerente === filters.gerente);
    const okFamilia = (!filters.familiaId || filters.familiaId === "Todas" || unit.familiaId === filters.familiaId || unit.familia === filters.familiaId);
    const okProduto = (!filters.produtoId || filters.produtoId === "Todas" || filters.produtoId === "Todos" || unit.produtoId === filters.produtoId);
    const prodSecao = unit.produtoId ? (PRODUCT_INDEX.get(unit.produtoId)?.sectionId || PRODUTO_TO_FAMILIA.get(unit.produtoId)?.secaoId) : "";
    const unitSecaoId = unit.secaoId || prodSecao || "";
    const okSecao = (!filters.secaoId || filters.secaoId === "Todas" || unitSecaoId === filters.secaoId || unit.familiaId === filters.secaoId || unit.familia === filters.secaoId);
    const okDate = (!startISO || unit.data >= startISO) && (!endISO || unit.data <= endISO);
    return okSegmento && okDiretoria && okGerencia && okAgencia && okGG && okGerente && okSecao && okFamilia && okProduto && okDate;
  });
}

function campaignStatusMatches(score, statusFilter = "todos") {
  const normalized = normalizarChaveStatus(statusFilter) || "todos";
  if (normalized === "todos") return true;
  const elegivel = score.finalStatus === "Parabéns" || score.finalStatus === "Elegível";
  if (normalized === "atingidos") return elegivel;
  if (normalized === "nao") return !elegivel;
  return true;
}

function aggregateCampaignUnitResults(unitResults, level, teamConfig) {
  const meta = CAMPAIGN_LEVEL_META[level] || CAMPAIGN_LEVEL_META.diretoria;
  const field = meta.groupField;
  const nameField = meta.displayField || field;
  const buckets = new Map();

  unitResults.forEach(({ unit }) => {
    const key = unit[field] || unit[nameField] || "—";
    const bucket = buckets.get(key) || {
      key,
      name: unit[nameField] || key,
      linhas: 0,
      cash: 0,
      conquista: 0,
      count: 0,
      atividadeHits: 0
    };
    bucket.name = unit[nameField] || key;
    bucket.linhas += toNumber(unit.linhas);
    bucket.cash += toNumber(unit.cash);
    bucket.conquista += toNumber(unit.conquista);
    bucket.count += 1;
    bucket.atividadeHits += unit.atividade ? 1 : 0;
    buckets.set(key, bucket);
  });

  return [...buckets.values()].map(bucket => {
    const linhas = bucket.count ? bucket.linhas / bucket.count : 0;
    const cash = bucket.count ? bucket.cash / bucket.count : 0;
    const conquista = bucket.count ? bucket.conquista / bucket.count : 0;
    const result = computeCampaignScore(teamConfig, { linhas, cash, conquista });
    const atividade = bucket.atividadeHits >= Math.ceil(bucket.count / 2);
    return {
      key: bucket.key,
      name: bucket.name,
      linhas,
      cash,
      conquista,
      atividade,
      finalStatus: result.finalStatus,
      finalClass: result.finalClass,
      totalPoints: result.totalPoints,
      result
    };
  });
}

function summarizeCampaignUnitResults(unitResults) {
  const total = unitResults.length;
  if (!total) {
    return { total: 0, elegiveis: 0, media: 0, recorde: 0, destaque: "" };
  }

  let soma = 0;
  let elegiveis = 0;
  let recorde = -Infinity;
  let destaque = "";

  unitResults.forEach(({ unit, score }) => {
    soma += score.totalPoints;
    if (score.finalStatus === "Parabéns" || score.finalStatus === "Elegível") elegiveis += 1;
    if (score.totalPoints > recorde) {
      recorde = score.totalPoints;
      destaque = unit.regional || unit.agencia || unit.gerenteNome || unit.carteira || unit.diretoriaNome || "";
    }
  });

  return {
    total,
    elegiveis,
    media: soma / total,
    recorde: recorde > 0 ? recorde : 0,
    destaque
  };
}

function buildCampaignRankingContext(sprint) {
  if (!sprint) {
    const levelInfo = determineCampaignDisplayLevel();
    return { unitResults: [], aggregated: [], levelInfo };
  }

  const filters = getFilterValues();
  const filteredUnits = filterCampaignUnits(sprint, filters);
  const unitResults = filteredUnits.map(unit => {
    const score = unit.score || computeCampaignScore(sprint.team, {
      linhas: unit.linhas,
      cash: unit.cash,
      conquista: unit.conquista
    });
    return { unit, score };
  }).filter(({ score }) => campaignStatusMatches(score, filters.status || "todos"));

  const levelInfo = determineCampaignDisplayLevel(filters);
  const aggregated = aggregateCampaignUnitResults(unitResults, levelInfo.level, sprint.team);

  return { unitResults, aggregated, levelInfo };
}

/* ===== Aqui eu concentro tudo que mexe com datas e horários em UTC ===== */
// Aqui eu gero o primeiro dia do mês atual em formato ISO.
function firstDayOfMonthISO(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }
// Aqui eu gero a data de hoje em ISO (aaaa-mm-dd).
function todayISO(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
// Aqui eu defino o período padrão que uso ao abrir o painel.
function getDefaultPeriodRange(){
  const capISO = AVAILABLE_DATE_MAX || todayISO();
  const bounds = getMonthBoundsForISO(capISO);
  return {
    start: bounds.start,
    end: capISO,
  };
}
// Aqui eu descubro os limites (início e fim) do mês referente a uma data ISO qualquer.
function getMonthBoundsForISO(baseISO){
  const fallbackToday = todayISO();
  const iso = baseISO || fallbackToday;
  const ref = dateUTCFromISO(iso);
  if (!(ref instanceof Date) || Number.isNaN(ref?.getTime?.())) {
    const todayRef = dateUTCFromISO(fallbackToday);
    const startFallback = `${todayRef.getUTCFullYear()}-${String(todayRef.getUTCMonth()+1).padStart(2,"0")}-01`;
    const endFallbackDate = new Date(Date.UTC(todayRef.getUTCFullYear(), todayRef.getUTCMonth()+1, 0));
    return { start:startFallback, end: isoFromUTCDate(endFallbackDate) };
  }
  const start = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth()+1).padStart(2,"0")}-01`;
  const endDate = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth()+1, 0));
  const end = isoFromUTCDate(endDate);
  return { start, end };
}
// Aqui eu calculo um panorama rápido de dias úteis do mês corrente usando o calendário completo.
function getCurrentMonthBusinessSnapshot(){
  const today = todayISO();
  const { start: monthStart, end: monthEnd } = getMonthBoundsForISO(today);
  const monthKey = today.slice(0,7);
  let total = 0;
  let elapsed = 0;
  if (Array.isArray(DIM_CALENDARIO) && DIM_CALENDARIO.length) {
    const entries = DIM_CALENDARIO.filter(entry => {
      const data = entry.data || entry.dt || "";
      return typeof data === "string" && data.startsWith(monthKey);
    });
    const businessEntries = entries.filter(entry => {
      const utilFlag = entry.ehDiaUtil ?? entry.util ?? entry.diaUtil ?? "";
      const value = typeof utilFlag === "string" ? utilFlag.trim() : utilFlag;
      if (value === true || value === 1 || value === "1") return true;
      if (typeof value === "string" && value.toLowerCase() === "sim") return true;
      return false;
    });
    total = businessEntries.length;
    const todayFiltered = businessEntries.filter(entry => (entry.data || entry.dt || "") <= today);
    elapsed = todayFiltered.length;
  }
  if (!total) {
    total = businessDaysBetweenInclusive(monthStart, monthEnd);
    const cappedToday = today < monthStart ? monthStart : (today > monthEnd ? monthEnd : today);
    elapsed = businessDaysBetweenInclusive(monthStart, cappedToday);
  }
  const remaining = Math.max(0, total - elapsed);
  return { total, elapsed, remaining, monthStart, monthEnd };
}
// Aqui eu descubro rapidamente quantos meses devo voltar em cada visão acumulada.
function getAccumulatedViewMonths(view){
  const match = ACCUMULATED_VIEW_OPTIONS.find(opt => opt.value === view);
  return match ? match.monthsBack : 0;
}
// Aqui eu calculo o período inicial/final com base na visão acumulada escolhida.
function computeAccumulatedPeriod(view = state.accumulatedView || "mensal", referenceEndISO = ""){
  const today = todayISO();
  const datasetMax = AVAILABLE_DATE_MAX || "";
  const cap = datasetMax || today;
  let endISO = referenceEndISO || state.period?.end || cap;
  if (!endISO) endISO = cap;
  if (datasetMax && endISO > datasetMax) {
    endISO = datasetMax;
  } else if (!datasetMax && endISO > today) {
    endISO = today;
  }
  let endDate = dateUTCFromISO(endISO);
  if (!(endDate instanceof Date) || Number.isNaN(endDate?.getTime?.())) {
    endDate = dateUTCFromISO(cap);
    endISO = isoFromUTCDate(endDate);
  }
  const monthsBack = getAccumulatedViewMonths(view);
  let startDate;
  if (view === "anual") {
    startDate = new Date(Date.UTC(endDate.getUTCFullYear(), 0, 1));
  } else {
    startDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - monthsBack, 1));
  }
  const startISO = isoFromUTCDate(startDate);
  const endIsoFinal = isoFromUTCDate(endDate);
  return { start: startISO, end: endIsoFinal };
}
// Aqui eu aplico a visão acumulada escolhida direto no estado e atualizo o rótulo do período.
function syncPeriodFromAccumulatedView(view = state.accumulatedView || "mensal", referenceEndISO = ""){
  const period = computeAccumulatedPeriod(view, referenceEndISO);
  state.period.start = period.start;
  state.period.end = period.end;
  updatePeriodLabels();
  return period;
}
// Aqui eu atualizo os textos "De xx/xx/xxxx até yy/yy/yyyy" sempre que o período mudar.
function updatePeriodLabels(){
  const startEl = document.getElementById("lbl-periodo-inicio");
  const endEl = document.getElementById("lbl-periodo-fim");
  if (startEl) startEl.textContent = formatBRDate(state.period.start);
  if (endEl) endEl.textContent = formatBRDate(state.period.end);
}
// Aqui eu calculo o período que alimenta os gráficos mensais da visão executiva.
function getExecutiveMonthlyPeriod(){
  const today = todayISO();
  const datasetMax = AVAILABLE_DATE_MAX || "";
  const datasetYear = datasetMax ? datasetMax.slice(0,4) : "";
  const currentYear = today.slice(0,4);
  const useCurrentYear = !datasetYear || datasetYear === currentYear;
  let end = useCurrentYear ? today : (datasetMax || today);
  if (!end) end = today;
  let year = useCurrentYear ? currentYear : (datasetYear || currentYear);
  let start = `${year}-01-01`;
  if (end && start && start > end) {
    start = `${end.slice(0,7)}-01`;
  }
  return { start, end };
}
// Aqui eu formato uma data ISO para o padrão BR.
function formatBRDate(iso){ if(!iso) return ""; const [y,m,day]=iso.split("-"); return `${day}/${m}/${y}`; }
// Aqui eu converto uma data ISO para um Date em UTC.
function dateUTCFromISO(iso){ const [y,m,d]=iso.split("-").map(Number); return new Date(Date.UTC(y,m-1,d)); }
// Aqui eu faço o caminho inverso: Date UTC para string ISO.
function isoFromUTCDate(d){ return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`; }
// Aqui eu mantenho um conjunto fixo de colunas que aparecem quando o usuário abre o detalhe de um contrato.
const DETAIL_SUBTABLE_COLUMNS = [
  { id: "canal",       label: "Canal da venda",         render: (group = {}) => escapeHTML(group.canal || "—") },
  { id: "tipo",        label: "Tipo da venda",          render: (group = {}) => escapeHTML(group.tipo || "—") },
  { id: "gerente",     label: "Gerente",                render: (group = {}) => escapeHTML(group.gerente || "—") },
  { id: "modalidade",  label: "Condição de pagamento",  render: (group = {}) => escapeHTML(group.modalidade || "—") },
  { id: "vencimento",  label: "Data de vencimento",     render: (group = {}) => renderDetailDateCell(group.dataVencimento) },
  { id: "cancelamento",label: "Data de cancelamento",   render: (group = {}) => renderDetailDateCell(group.dataCancelamento) },
  { id: "motivo",      label: "Motivo do cancelamento", render: (group = {}) => escapeHTML(group.motivoCancelamento || "—") },
];

// Aqui eu montei os metadados das colunas da tabela principal para poder ligar/desligar conforme a visão escolhida.
const DETAIL_COLUMNS = [
  { id: "quantidade",    label: "Quantidade",          cellClass: "", render: renderDetailQtyCell, sortType: "number", getValue: (node = {}) => toNumber(node.qtd) },
  { id: "realizado",     label: "Realizado (R$)",      cellClass: "", render: renderDetailRealizadoCell, sortType: "number", getValue: (node = {}) => toNumber(node.realizado) },
  { id: "meta",          label: "Meta (R$)",           cellClass: "", render: renderDetailMetaCell, sortType: "number", getValue: (node = {}) => toNumber(node.meta) },
  { id: "atingimento_v", label: "Atingimento (R$)",    cellClass: "", render: renderDetailAchievementValueCell, sortType: "number", getValue: (node = {}) => {
    const realizado = toNumber(node.realizado);
    const meta = toNumber(node.meta);
    if (meta > 0) return Math.max(0, Math.min(realizado, meta));
    return Math.max(0, realizado);
  } },
  { id: "atingimento_p", label: "Atingimento (%)",     cellClass: "", render: renderDetailAchievementPercentCell, sortType: "number", getValue: (node = {}) => Number(node.ating || 0) },
  { id: "pontos",        label: "Pontos (pts)",        cellClass: "", render: renderDetailPointsCell, sortType: "number", getValue: (node = {}) => toNumber(node.pontos ?? node.pontosCumpridos) },
  { id: "peso",          label: "Peso (pts)",          cellClass: "", render: renderDetailPesoCell, sortType: "number", getValue: (node = {}) => toNumber(node.peso ?? node.pontosMeta) },
  { id: "data",          label: "Data",                cellClass: "", render: renderDetailDateCellFromNode, sortType: "date", getValue: (node = {}) => node.data || "" },
  { id: "meta_diaria",   label: "Meta diária total (R$)",    cellClass: "", render: renderDetailMetaDiariaCell, sortType: "number", getValue: (node = {}) => toNumber(node.metaDiaria) },
  { id: "referencia_hoje", label: "Referência para hoje (R$)", cellClass: "", render: renderDetailReferenciaHojeCell, sortType: "number", getValue: (node = {}) => toNumber(node.referenciaHoje) },
  { id: "meta_diaria_necessaria", label: "Meta diária necessária (R$)", cellClass: "", render: renderDetailMetaDiariaNecessariaCell, sortType: "number", getValue: (node = {}) => toNumber(node.metaDiariaNecessaria) },
  { id: "projecao",      label: "Projeção (R$)",       cellClass: "", render: renderDetailProjecaoCell, sortType: "number", getValue: (node = {}) => toNumber(node.projecao) },
];
const DETAIL_DEFAULT_COLUMNS = [
  "quantidade",
  "realizado",
  "meta",
  "atingimento_v",
  "atingimento_p",
  "pontos",
  "peso",
  "data",
];
const DETAIL_DEFAULT_VIEW = {
  id: "default",
  name: "Visão padrão",
  columns: [...DETAIL_DEFAULT_COLUMNS],
};
const DETAIL_MAX_CUSTOM_VIEWS = 5;
const DETAIL_VIEW_STORAGE_KEY = "pobj3:detailViews";
const DETAIL_VIEW_ACTIVE_KEY = "pobj3:detailActiveView";
const DETAIL_VIEW_CUSTOM_KEY = "pobj3:detailCustomView";
const DETAIL_CUSTOM_DEFAULT_LABEL = "Visão atual";

function renderDetailDateCell(iso){
  if (!iso) return "—";
  const label = formatBRDate(iso);
  if (!label) return "—";
  const safe = escapeHTML(label);
  return `<span class="detail-date" title="${safe}">${safe}</span>`;
}

function renderDetailQtyCell(node = {}){
  const qty = toNumber(node.qtd);
  const rounded = Math.round(qty);
  const full = fmtINT.format(rounded);
  const display = formatIntReadable(qty);
  return `<span title="${full}">${display}</span>`;
}

function renderDetailRealizadoCell(node = {}){
  const value = toNumber(node.realizado);
  const rounded = Math.round(value);
  const full = fmtBRL.format(rounded);
  const display = formatBRLReadable(value);
  return `<span title="${full}">${display}</span>`;
}

function renderDetailMetaCell(node = {}){
  const value = toNumber(node.meta);
  const rounded = Math.round(value);
  const full = fmtBRL.format(rounded);
  const display = formatBRLReadable(value);
  return `<span title="${full}">${display}</span>`;
}

function renderDetailAchievementValueCell(node = {}){
  return renderDetailAchievementCurrency(node.realizado, node.meta);
}

function renderDetailAchievementPercentCell(node = {}){
  const ratio = Number(node.ating || 0);
  return renderDetailAchievementPercent(ratio);
}

function renderDetailPointsCell(node = {}){
  const pontos = Math.max(0, toNumber(node.pontos ?? node.pontosCumpridos ?? 0));
  const formatted = formatPoints(pontos, { withUnit: true });
  return `<span title="${formatted}">${formatted}</span>`;
}

function renderDetailPesoCell(node = {}){
  const peso = Math.max(0, toNumber(node.peso ?? node.pontosMeta ?? 0));
  const formatted = formatPoints(peso, { withUnit: true });
  return `<span title="${formatted}">${formatted}</span>`;
}

function renderDetailDateCellFromNode(node = {}){
  return renderDetailDateCell(node.data);
}

function renderDetailCurrencyValue(amount){
  const value = toNumber(amount);
  const rounded = Math.round(value);
  const full = fmtBRL.format(rounded);
  const display = formatBRLReadable(value);
  return `<span title="${full}">${display}</span>`;
}

function renderDetailMetaDiariaCell(node = {}){
  return renderDetailCurrencyValue(node.metaDiaria);
}

function renderDetailReferenciaHojeCell(node = {}){
  return renderDetailCurrencyValue(node.referenciaHoje);
}

function renderDetailMetaDiariaNecessariaCell(node = {}){
  return renderDetailCurrencyValue(node.metaDiariaNecessaria);
}

function renderDetailProjecaoCell(node = {}){
  return renderDetailCurrencyValue(node.projecao);
}

function renderDetailAchievementCurrency(realizado, meta){
  const r = toNumber(realizado);
  const m = toNumber(meta);
  const hasMeta = m > 0;
  const achieved = hasMeta ? Math.max(0, Math.min(r, m)) : Math.max(0, r);
  const cls = hasMeta ? (r >= m ? "def-pos" : "def-neg") : "def-pos";
  const full = fmtBRL.format(Math.round(achieved));
  const display = formatBRLReadable(achieved);
  return `<span class="def-badge ${cls}" title="${full}">${display}</span>`;
}

function renderDetailAchievementPercent(ratio){
  const pct = Number.isFinite(ratio) ? ratio * 100 : 0;
  const safe = Math.max(0, pct);
  const cls = safe < 50 ? "att-low" : (safe < 100 ? "att-warn" : "att-ok");
  return `<span class="att-badge ${cls}">${safe.toFixed(1)}%</span>`;
}
function getDetailColumnMeta(id){
  return DETAIL_COLUMNS.find(col => col.id === id) || null;
}

const DETAIL_LABEL_SORT_META = {
  id: "__label__",
  sortType: "string",
  defaultDirection: "asc",
  getValue: (node = {}) => node.label || "",
};

function getDetailSortMeta(sortId){
  if (!sortId) return null;
  if (sortId === "__label__") return DETAIL_LABEL_SORT_META;
  const col = getDetailColumnMeta(sortId);
  if (!col) return null;
  const sortType = col.sortType || "string";
  const getValue = typeof col.getValue === "function"
    ? col.getValue
    : ((node = {}) => node[col.id]);
  const defaultDirection = col.defaultDirection || (sortType === "string" ? "asc" : "desc");
  return { id: col.id, sortType, getValue, defaultDirection };
}

function compareDetailSortValues(a, b, sortType){
  if (sortType === "number") {
    const diff = toNumber(a) - toNumber(b);
    if (diff < 0) return -1;
    if (diff > 0) return 1;
    return 0;
  }
  const strA = String(a ?? "");
  const strB = String(b ?? "");
  if (sortType === "date") {
    return strA.localeCompare(strB);
  }
  return strA.localeCompare(strB, "pt-BR", { sensitivity: "base" });
}

function applyDetailSort(nodes, sortMeta, direction){
  if (!Array.isArray(nodes) || !nodes.length) return;
  const dir = direction === "asc" || direction === "desc" ? direction : null;
  if (sortMeta && dir) {
    const multiplier = dir === "asc" ? 1 : -1;
    nodes.sort((a, b) => {
      const va = sortMeta.getValue ? sortMeta.getValue(a) : undefined;
      const vb = sortMeta.getValue ? sortMeta.getValue(b) : undefined;
      const cmp = compareDetailSortValues(va, vb, sortMeta.sortType);
      if (cmp !== 0) return cmp * multiplier;
      return compareDetailSortValues(a.label || "", b.label || "", "string");
    });
  }
  nodes.forEach(node => {
    if (Array.isArray(node.children) && node.children.length) {
      applyDetailSort(node.children, sortMeta, direction);
    }
  });
}
function sanitizeDetailColumns(columns = []){
  const valid = [];
  columns.forEach(id => {
    const meta = getDetailColumnMeta(id);
    if (!meta) return;
    if (!valid.includes(meta.id)) valid.push(meta.id);
  });
  return valid.length ? valid : [...DETAIL_DEFAULT_VIEW.columns];
}
function detailColumnsEqual(a = [], b = []){
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
function normalizeDetailViewPayload(payload){
  if (!payload || typeof payload !== "object") return null;
  const rawId = typeof payload.id === "string" ? payload.id.trim() : payload.id;
  const id = rawId || null;
  if (!id) return null;
  const name = limparTexto(payload.name || "");
  const columns = sanitizeDetailColumns(Array.isArray(payload.columns) ? payload.columns : []);
  return { id, name: name || "Visão personalizada", columns };
}
function readLocalStorageItem(key){
  try{
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  }catch(err){
    console.warn("Não consegui ler preferências de coluna:", err);
    return null;
  }
}
function writeLocalStorageItem(key, value){
  if (typeof window === "undefined" || !window.localStorage) return;
  try{
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  }catch(err){
    console.warn("Não consegui salvar preferências de coluna:", err);
  }
}
function readLocalStorageJSON(key){
  const raw = readLocalStorageItem(key);
  if (!raw) return null;
  try{
    return JSON.parse(raw);
  }catch(err){
    console.warn("JSON inválido para", key, err);
    return null;
  }
}
function writeLocalStorageJSON(key, value){
  if (value == null) writeLocalStorageItem(key, null);
  else writeLocalStorageItem(key, JSON.stringify(value));
}
function generateDetailViewId(){
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
}
// Aqui eu conto quantos dias úteis existem entre duas datas (inclusive).
function businessDaysBetweenInclusive(startISO,endISO){
  if(!startISO || !endISO) return 0;
  let s = dateUTCFromISO(startISO), e = dateUTCFromISO(endISO);
  if(s > e) return 0;
  let cnt=0;
  for(let d=new Date(s); d<=e; d.setUTCDate(d.getUTCDate()+1)){
    const wd = d.getUTCDay(); if(wd!==0 && wd!==6) cnt++;
  }
  return cnt;
}
// Aqui eu calculo quantos dias úteis já se passaram dentro do intervalo até hoje (incluindo hoje).
function businessDaysElapsedUntilToday(startISO,endISO){
  if(!startISO || !endISO) return 0;
  const todayISOValue = todayISO();
  let start = dateUTCFromISO(startISO), end = dateUTCFromISO(endISO), today = dateUTCFromISO(todayISOValue);
  if(!start || !end || !today) return 0;
  if(today < start) return 0;
  if(today > end) today = end;
  return businessDaysBetweenInclusive(startISO, isoFromUTCDate(today));
}
// Aqui eu calculo quantos dias úteis ainda faltam a partir de hoje até o fim de um período.
function businessDaysRemainingFromToday(startISO,endISO){
  if(!startISO || !endISO) return 0;
  const total = businessDaysBetweenInclusive(startISO, endISO);
  const elapsed = businessDaysElapsedUntilToday(startISO, endISO);
  return Math.max(0, total - elapsed);
}

/* ===== Aqui eu deixo funções auxiliares para métricas e números ===== */
// Aqui eu converto qualquer valor para número sem deixar NaN escapar.
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Aqui eu fujo de problemas de XSS escapando HTML sempre que crio strings manualmente.
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (ch) => ({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#39;"
}[ch]));

// Aqui eu deixo um formatador genérico para exibir números grandes com sufixo (mil, milhão...).
function formatNumberWithSuffix(value, { currency = false } = {}) {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return currency ? fmtBRL.format(0) : fmtINT.format(0);
  const abs = Math.abs(n);
  if (abs < 1000) {
    return currency ? fmtBRL.format(n) : fmtINT.format(Math.round(n));
  }
  const rule = SUFFIX_RULES.find(r => abs >= r.value);
  if (!rule) {
    return currency ? fmtBRL.format(n) : fmtINT.format(Math.round(n));
  }
  const absScaled = abs / rule.value;
  const nearInteger = Math.abs(absScaled - Math.round(absScaled)) < 0.05;
  let digits;
  if (absScaled >= 100) digits = 0;
  else if (absScaled >= 10) digits = nearInteger ? 0 : 1;
  else digits = nearInteger ? 0 : 1;
  const numberFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const formatted = numberFmt.format(absScaled);
  const isSingular = Math.abs(absScaled - 1) < 0.05;
  const label = isSingular ? rule.singular : rule.plural;
  if (currency) {
    const sign = n < 0 ? "-" : "";
    return `${sign}${CURRENCY_SYMBOL}${CURRENCY_LITERAL}${formatted} ${label}`;
  }
  const sign = n < 0 ? "-" : "";
  return `${sign}${formatted} ${label}`;
}

// Aqui eu reaproveito o formatador para mostrar números grandes sem estourar layout.
function formatIntReadable(value){
  return formatNumberWithSuffix(value, { currency: false });
}
function formatBRLReadable(value){
  return formatNumberWithSuffix(value, { currency: true });
}

function formatPoints(value, { withUnit = false } = {}) {
  const n = Math.round(toNumber(value));
  const formatted = fmtINT.format(n);
  return withUnit ? `${formatted} pts` : formatted;
}

function formatMetricFull(metric, value){
  const n = Math.round(toNumber(value));
  if(metric === "perc") return `${toNumber(value).toFixed(1)}%`;
  if(metric === "qtd")  return fmtINT.format(n);
  return fmtBRL.format(n);
}
function formatByMetric(metric, value){
  if(metric === "perc") return `${toNumber(value).toFixed(1)}%`;
  if(metric === "qtd")  return formatIntReadable(value);
  return formatBRLReadable(value);
}
function formatCompactBRL(value){
  return formatNumberWithSuffix(value, { currency: true });
}
function makeRandomForMetric(metric){
  if(metric === "perc"){
    const meta = 100;
    const realizado = Math.round(45 + Math.random()*75);
    const variavelMeta = Math.round(160_000 + Math.random()*180_000);
    return { meta, realizado, variavelMeta };
  }
  if(metric === "qtd"){
    const meta = Math.round(1_000 + Math.random()*19_000);
    const realizado = Math.round(meta * (0.75 + Math.random()*0.6));
    const variavelMeta = Math.round(150_000 + Math.random()*220_000);
    return { meta, realizado, variavelMeta };
  }
  const meta = Math.round(4_000_000 + Math.random()*16_000_000);
  const realizado = Math.round(meta * (0.75 + Math.random()*0.6));
  const variavelMeta = Math.round(320_000 + Math.random()*420_000);
  return { meta, realizado, variavelMeta };
}

/* ===== Aqui eu centralizo o carregamento de dados (API ou CSV local) ===== */
// Aqui eu faço uma chamada GET simples contra a API com tratamento básico de erro.
async function apiGet(path, params){
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const r = await fetch(`${API_URL}${path}${qs}`); if(!r.ok) throw new Error("Falha ao carregar dados");
  return r.json();
}
// Aqui eu faço todo o processo de montar os dados consolidados (fatos + metas + campanhas) usados nas telas.
async function getData(){
  const period = state.period || { start:firstDayOfMonthISO(), end: todayISO() };

  const calendarioByDate = new Map(DIM_CALENDARIO.map(entry => [entry.data, entry]));
  const calendarioByCompetencia = new Map(DIM_CALENDARIO.map(entry => [entry.competencia, entry]));

  // Aqui eu gero linhas sintéticas das campanhas para reaproveitar no ranking e nos simuladores.
  const buildCampanhaFacts = () => {
    const campanhaFacts = [];
    CAMPAIGN_SPRINTS.forEach(sprint => {
      const units = CAMPAIGN_UNIT_DATA.filter(unit => !unit.sprintId || unit.sprintId === sprint.id);
      const effectiveUnits = units.length ? units : sprint.units || CAMPAIGN_UNIT_DATA;
      effectiveUnits.forEach(unit => {
        const unitData = unit.data || "";
        const unitCompetencia = unit.competencia || (unitData ? `${unitData.slice(0, 7)}-01` : "");
        const score = computeCampaignScore(sprint.team, {
          linhas: unit.linhas,
          cash: unit.cash,
          conquista: unit.conquista,
        });
        campanhaFacts.push({
          ...unit,
          data: unitData,
          competencia: unitCompetencia,
          sprintId: unit.sprintId || sprint.id,
          sprintLabel: sprint.label,
          realizado: score.totalPoints,
          meta: score.eligibilityMinimum,
          pontos: score.totalPoints,
          finalStatus: score.finalStatus,
          finalClass: score.finalClass,
          score,
        });
      });
    });
    return campanhaFacts;
  };

  if (FACT_REALIZADOS.length) {
    const metasMap = new Map(FACT_METAS.map(entry => [entry.registroId, entry]));
    const variavelMap = new Map(FACT_VARIAVEL.map(entry => [entry.registroId, entry]));

    let factRows = FACT_REALIZADOS.map(row => {
      const meta = metasMap.get(row.registroId) || {};
      const variavel = variavelMap.get(row.registroId) || {};
      const produtoMeta = PRODUCT_INDEX.get(row.produtoId) || {};
      const familiaMeta = PRODUTO_TO_FAMILIA.get(row.produtoId);
      const secaoIdRaw = produtoMeta.sectionId || familiaMeta?.secaoId || row.secaoId || row.sectionId || "";
      const secaoLabelRaw = produtoMeta.sectionLabel || familiaMeta?.secaoNome || row.secaoNome || row.secao || "";
      const familiaIdRaw = row.familiaId || row.familia || "";
      const familiaNomeRaw = row.familiaNome || row.familia || "";
      const resolvedSecaoId = secaoIdRaw || familiaMeta?.secaoId || familiaIdRaw || "";
      const resolvedSecaoNome = secaoLabelRaw || getSectionLabel(resolvedSecaoId) || familiaNomeRaw || familiaIdRaw || resolvedSecaoId;
      let resolvedFamiliaId = familiaIdRaw;
      let resolvedFamiliaNome = familiaNomeRaw;
      if (!resolvedFamiliaId || SECTION_IDS.has(resolvedFamiliaId)) {
        resolvedFamiliaId = familiaMeta?.id || row.produtoId || resolvedSecaoId;
      }
      if (!resolvedFamiliaNome || resolvedFamiliaNome === familiaIdRaw || resolvedFamiliaNome === resolvedSecaoNome || SECTION_IDS.has(resolvedFamiliaId)) {
        resolvedFamiliaNome = familiaMeta?.nome || row.produtoNome || resolvedFamiliaNome || resolvedSecaoNome;
      }
      const peso = toNumber(meta.peso ?? produtoMeta.peso ?? 1);
      const metaMens = toNumber(meta.meta_mens ?? meta.meta ?? 0);
      const metaAcum = toNumber(meta.meta_acum ?? meta.meta ?? metaMens);
      const realizadoMens = toNumber(row.real_mens ?? row.realizado ?? 0);
      const realizadoAcum = toNumber(row.real_acum ?? row.realizadoAcumulado ?? realizadoMens);
      const variavelMeta = toNumber(variavel.variavelMeta ?? meta.variavelMeta ?? row.variavelMeta ?? 0);
      const variavelReal = toNumber(variavel.variavelReal ?? row.variavelReal ?? 0);
      const qtd = toNumber(row.qtd ?? row.quantidade ?? 0);
      let dataISO = row.data || meta.data || variavel.data || "";
      let competencia = row.competencia || meta.competencia || variavel.competencia || "";
      if (!competencia && dataISO) {
        competencia = `${dataISO.slice(0, 7)}-01`;
      }
      if (!dataISO && competencia) {
        dataISO = competencia;
      }
      const calendario = calendarioByDate.get(dataISO) || calendarioByCompetencia.get(competencia);
      const ating = metaMens ? (realizadoMens / metaMens) : 0;
      const pontos = Math.round(Math.max(0, ating) * peso);

      const base = {
        registroId: row.registroId,
        segmento: row.segmento,
        segmentoId: row.segmentoId,
        diretoria: row.diretoria,
        diretoriaNome: row.diretoriaNome,
        gerenciaRegional: row.gerenciaRegional,
        gerenciaNome: row.gerenciaNome,
        regional: row.regional,
        agencia: row.agencia,
        agenciaNome: row.agenciaNome,
        agenciaCodigo: row.agenciaCodigo || row.agencia,
        gerenteGestao: row.gerenteGestao,
        gerenteGestaoNome: row.gerenteGestaoNome,
        gerente: row.gerente,
        gerenteNome: row.gerenteNome,
        secaoId: resolvedSecaoId,
        secao: resolvedSecaoNome,
        secaoNome: resolvedSecaoNome,
        familiaId: resolvedFamiliaId,
        familia: resolvedFamiliaNome,
        familiaNome: resolvedFamiliaNome,
        prodOrSub: row.prodOrSub || row.subproduto || row.produtoNome || row.produtoId,
        subproduto: row.subproduto || "",
        carteira: row.carteira,
        canalVenda: row.canalVenda,
        tipoVenda: row.tipoVenda,
        modalidadePagamento: row.modalidadePagamento,
        data: dataISO,
        competencia,
        realizado: realizadoMens,
        real_mens: realizadoMens,
        real_acum: realizadoAcum,
        meta: metaMens,
        meta_mens: metaMens,
        meta_acum: metaAcum,
        qtd,
        peso,
        pontos,
        variavelMeta,
        variavelReal,
        ating,
        atingVariavel: variavelMeta ? variavelReal / variavelMeta : 0,
      };

      aplicarIndicadorAliases(base, row.produtoId, row.produtoNome || row.produtoId);

      if (calendario) {
        base.ano = calendario.ano;
        base.mes = calendario.mes;
        base.mesNome = calendario.mesNome;
        base.dia = calendario.dia;
        base.diaSemana = calendario.diaSemana;
        base.ehDiaUtil = calendario.ehDiaUtil;
      }

      return base;
    });

    if (FACT_VARIAVEL.length) {
      const variavelIds = new Set(FACT_VARIAVEL.map(row => row?.registroId || row?.registroid));
      const novosVariavel = factRows.filter(row => row?.registroId && !variavelIds.has(row.registroId)).map(row => ({
        registroId: row.registroId,
        produtoId: row.produtoId,
        produtoNome: row.produtoNome,
        familiaId: row.familiaId,
        familiaNome: row.familiaNome,
        variavelMeta: row.variavelMeta,
        variavelReal: row.variavelReal,
        data: row.data,
        competencia: row.competencia,
      }));
      if (novosVariavel.length) {
        novosVariavel.forEach(item => aplicarIndicadorAliases(item, item.produtoId, item.produtoNome));
        FACT_VARIAVEL.push(...novosVariavel);
      }
    }

    const baseByRegistro = new Map(factRows.map(row => [row.registroId, row]));
    const variavelFacts = (FACT_VARIAVEL.length ? FACT_VARIAVEL : factRows).map(source => {
      const registroId = source.registroId || source.registroid;
      const base = baseByRegistro.get(registroId) || {};
      if (!registroId || !base.registroId) return null;

      let dataISO = pegarPrimeiroPreenchido(source.data, base.data, source.competencia, base.competencia);
      let competencia = pegarPrimeiroPreenchido(source.competencia, base.competencia);
      if (!competencia && dataISO) {
        competencia = `${String(dataISO).slice(0, 7)}-01`;
      }
      if (!dataISO && competencia) {
        dataISO = competencia;
      }
      const calendario = calendarioByDate.get(dataISO) || calendarioByCompetencia.get(competencia);
      const variavelMeta = toNumber(source.variavelMeta ?? base.variavelMeta ?? 0);
      const variavelReal = toNumber(source.variavelReal ?? base.variavelReal ?? 0);
      const ating = variavelMeta ? (variavelReal / variavelMeta) : (base.atingVariavel ?? base.ating ?? 0);

      const item = {
        registroId,
        segmento: base.segmento,
        segmentoId: base.segmentoId,
        diretoria: base.diretoria,
        diretoriaNome: base.diretoriaNome,
        gerenciaRegional: base.gerenciaRegional,
        gerenciaNome: base.gerenciaNome,
        regional: base.regional,
        agencia: base.agencia,
        agenciaNome: base.agenciaNome,
        agenciaCodigo: base.agenciaCodigo,
        gerenteGestao: base.gerenteGestao,
        gerenteGestaoNome: base.gerenteGestaoNome,
        gerente: base.gerente,
        gerenteNome: base.gerenteNome,
        secaoId: base.secaoId,
        secao: base.secao,
        secaoNome: base.secaoNome,
        familiaId: base.familiaId,
        familia: base.familia,
        familiaNome: base.familiaNome,
        produtoId: base.produtoId,
        produto: base.produtoNome,
        produtoNome: base.produtoNome,
        prodOrSub: base.prodOrSub,
        data: dataISO,
        competencia,
        realizado: variavelReal,
        meta: variavelMeta,
        real_mens: variavelReal,
        meta_mens: variavelMeta,
        real_acum: variavelReal,
        meta_acum: variavelMeta,
        variavelMeta,
        variavelReal,
        peso: base.peso,
        pontos: base.pontos,
        ating,
      };

      aplicarIndicadorAliases(item, base.produtoId, base.produtoNome);

      if (calendario) {
        item.ano = calendario.ano;
        item.mes = calendario.mes;
        item.mesNome = calendario.mesNome;
        item.dia = calendario.dia;
        item.diaSemana = calendario.diaSemana;
        item.ehDiaUtil = calendario.ehDiaUtil;
      } else if (dataISO) {
        item.ano = String(dataISO).slice(0, 4);
        item.mes = String(dataISO).slice(5, 7);
        item.dia = String(dataISO).slice(8, 10);
      }

      return item;
    }).filter(Boolean);

    fDados = factRows;
    fVariavel = variavelFacts;

    const campanhaFacts = buildCampanhaFacts();
    fCampanhas = campanhaFacts;

    const baseDashboard = buildDashboardDatasetFromRows(factRows, period);
    const ranking = factRows.map(row => ({ ...row }));

    return {
      sections: baseDashboard.sections,
      summary: baseDashboard.summary,
      ranking,
      period,
      facts: { dados: factRows, variavel: fVariavel, campanhas: campanhaFacts }
    };
  }

  const startDt = dateUTCFromISO(period.start);
  const endDt = dateUTCFromISO(period.end);
  let startRef = startDt;
  let endRef = endDt;
  if (startRef && endRef && startRef > endRef) [startRef, endRef] = [endRef, startRef];
  const defaultISO = period.end || period.start || todayISO();
  const randomPeriodISO = () => {
    if (!startRef || !endRef) return defaultISO;
    const spanDays = Math.max(0, Math.round((endRef - startRef) / (24 * 60 * 60 * 1000)));
    const offset = spanDays > 0 ? Math.floor(Math.random() * (spanDays + 1)) : 0;
    const dt = new Date(startRef.getTime());
    dt.setUTCDate(dt.getUTCDate() + offset);
    return isoFromUTCDate(dt);
  };

  const periodYear = Number((period.start || todayISO()).slice(0, 4)) || new Date().getFullYear();
  const productDefs = CARD_SECTIONS_DEF.flatMap(sec =>
    sec.items.map(item => ({
      ...item,
      sectionId: sec.id,
      sectionLabel: sec.label
    }))
  );

  const segsBase = SEGMENTOS_DATA.length
    ? SEGMENTOS_DATA.map(seg => seg.nome || seg.id).filter(Boolean)
    : ["Empresas","Negócios","MEI"];
  const segs = segsBase.length ? segsBase : ["Empresas"];

  const diretoriasBase = RANKING_DIRECTORIAS.length ? RANKING_DIRECTORIAS : [{ id: "DR 01", nome: "Diretoria" }];
  const gerenciasBase = RANKING_GERENCIAS.length ? RANKING_GERENCIAS : [{ id: "GR 01", nome: "Regional", diretoria: diretoriasBase[0]?.id || "" }];
  const agenciasBase = RANKING_AGENCIAS.length ? RANKING_AGENCIAS : [{ id: "Ag 1001", nome: "Agência", gerencia: gerenciasBase[0]?.id || "" }];
  const gerentesBase = RANKING_GERENTES.length ? RANKING_GERENTES : [{ id: "Gerente 1", nome: "Gerente" }];
  const gerentesGestaoBase = GERENTES_GESTAO.length ? GERENTES_GESTAO : [{ id: "GG 01", nome: "Gestão 01" }];

  let agenciesList = Array.from(MESU_BY_AGENCIA.values());
  if (!agenciesList.length) {
    const gerMap = new Map(gerenciasBase.map(g => [g.id, g]));
    const dirMap = new Map(diretoriasBase.map(d => [d.id, d]));
    agenciesList = agenciasBase.map((ag, idx) => {
      const gerMeta = gerMap.get(ag.gerencia) || gerenciasBase[idx % gerenciasBase.length] || {};
      const dirMeta = dirMap.get(gerMeta.diretoria) || diretoriasBase[idx % diretoriasBase.length] || {};
      const gerenteMeta = gerentesBase[idx % gerentesBase.length] || {};
      const ggMeta = gerentesGestaoBase.find(gg => gg.agencia === ag.id) || gerentesGestaoBase[idx % gerentesGestaoBase.length] || {};
      const segmentoNome = segs[idx % segs.length] || segs[0];
      return {
        segmentoId: segmentoNome,
        segmentoNome,
        diretoriaId: dirMeta.id || `DR ${String(idx + 1).padStart(2, "0")}`,
        diretoriaNome: dirMeta.nome || `Diretoria ${idx + 1}`,
        regionalId: gerMeta.id || `GR ${String(idx + 1).padStart(2, "0")}`,
        regionalNome: gerMeta.nome || `Regional ${idx + 1}`,
        agenciaId: ag.id || `Ag ${String(idx + 1).padStart(2, "0")}`,
        agenciaNome: ag.nome || ag.id || `Agência ${idx + 1}`,
        gerenteGestaoId: ggMeta.id || `GG ${String(idx + 1).padStart(2, "0")}`,
        gerenteGestaoNome: ggMeta.nome || ggMeta.id || `Gerente geral ${idx + 1}`,
        gerenteId: gerenteMeta.id || `Gerente ${idx + 1}`,
        gerenteNome: gerenteMeta.nome || gerenteMeta.id || `Gerente ${idx + 1}`
      };
    });
  }
  if (!agenciesList.length) {
    agenciesList = [{
      segmentoId: segs[0] || "Segmento",
      segmentoNome: segs[0] || "Segmento",
      diretoriaId: diretoriasBase[0]?.id || "DR 01",
      diretoriaNome: diretoriasBase[0]?.nome || "Diretoria",
      regionalId: gerenciasBase[0]?.id || "GR 01",
      regionalNome: gerenciasBase[0]?.nome || "Regional",
      agenciaId: agenciasBase[0]?.id || "Ag 1001",
      agenciaNome: agenciasBase[0]?.nome || "Agência",
      gerenteGestaoId: gerentesGestaoBase[0]?.id || "GG 01",
      gerenteGestaoNome: gerentesGestaoBase[0]?.nome || "Gerente geral",
      gerenteId: gerentesBase[0]?.id || "Gerente 1",
      gerenteNome: gerentesBase[0]?.nome || "Gerente 1"
    }];
  }

  const canaisVenda = ["Agência física","Digital","Correspondente","APP Empresas"];
  const tiposVenda = ["Venda consultiva","Venda direta","Cross-sell","Pós-venda"];
  const modalidadesVenda = ["À vista","Parcelado"];

  const factRows = [];
  agenciesList.forEach((agency, agencyIndex) => {
    productDefs.forEach((prod, prodIndex) => {
      const iterations = 1 + ((agencyIndex + prodIndex) % 2);
      for (let iter = 0; iter < iterations; iter += 1) {
        const { meta, realizado, variavelMeta } = makeRandomForMetric(prod.metric);
        const metaMens = prod.metric === "perc" ? Math.min(150, meta) : meta;
        const realMens = prod.metric === "perc" ? Math.min(150, realizado) : realizado;
        const dataISO = randomPeriodISO();
        const competenciaMes = dataISO ? `${dataISO.slice(0, 7)}-01` : `${periodYear}-${String(((agencyIndex + prodIndex) % 12) + 1).padStart(2, "0")}-01`;
        const realAcum = Math.round(realMens * (1.15 + Math.random() * 0.4));
        const metaAcum = Math.round(metaMens * (1.2 + Math.random() * 0.45));
        const ating = metaMens ? (realMens / metaMens) : 0;
        const variavelReal = Math.max(0, Math.round((variavelMeta || 0) * Math.max(0.6, Math.min(1.25, ating))));
        const peso = prod.peso || 1;
        const pontos = Math.round(Math.max(0, ating) * peso);
        const qtd = prod.metric === "qtd"
          ? Math.max(1, Math.round(realMens))
          : Math.round(80 + Math.random() * 2200);

        const familiaMeta = PRODUTO_TO_FAMILIA.get(prod.id) || {
          id: prod.id,
          nome: prod.nome,
          secaoId: prod.sectionId,
          secaoNome: prod.sectionLabel
        };

        factRows.push({
          segmento: agency.segmentoNome || agency.segmentoId || segs[agencyIndex % segs.length] || "Segmento",
          diretoria: agency.diretoriaId || diretoriasBase[agencyIndex % diretoriasBase.length]?.id || `DR ${String(agencyIndex + 1).padStart(2, "0")}`,
          diretoriaNome: agency.diretoriaNome || diretoriasBase[agencyIndex % diretoriasBase.length]?.nome || `Diretoria ${agencyIndex + 1}`,
          gerenciaRegional: agency.regionalId || gerenciasBase[agencyIndex % gerenciasBase.length]?.id || `GR ${String(agencyIndex + 1).padStart(2, "0")}`,
          gerenciaNome: agency.regionalNome || gerenciasBase[agencyIndex % gerenciasBase.length]?.nome || `Regional ${agencyIndex + 1}`,
          regional: agency.regionalNome || gerenciasBase[agencyIndex % gerenciasBase.length]?.nome || `Regional ${agencyIndex + 1}`,
          agencia: agency.agenciaId || agenciasBase[agencyIndex % agenciasBase.length]?.id || `Ag ${String(agencyIndex + 1).padStart(2, "0")}`,
          agenciaNome: agency.agenciaNome || agenciasBase[agencyIndex % agenciasBase.length]?.nome || `Agência ${agencyIndex + 1}`,
          agenciaCodigo: agency.agenciaId || agenciasBase[agencyIndex % agenciasBase.length]?.id || `Ag ${String(agencyIndex + 1).padStart(2, "0")}`,
          gerenteGestao: agency.gerenteGestaoId || gerentesGestaoBase[agencyIndex % gerentesGestaoBase.length]?.id || `GG ${String(agencyIndex + 1).padStart(2, "0")}`,
          gerenteGestaoNome: agency.gerenteGestaoNome || gerentesGestaoBase[agencyIndex % gerentesGestaoBase.length]?.nome || `Gerente geral ${agencyIndex + 1}`,
          gerente: agency.gerenteId || gerentesBase[agencyIndex % gerentesBase.length]?.id || `Gerente ${agencyIndex + 1}`,
          gerenteNome: agency.gerenteNome || gerentesBase[agencyIndex % gerentesBase.length]?.nome || `Gerente ${agencyIndex + 1}`,
          segmentoNome: agency.segmentoNome || agency.segmentoId || segs[agencyIndex % segs.length] || "Segmento",
          secaoId: familiaMeta.secaoId || prod.sectionId,
          secao: familiaMeta.secaoNome || prod.sectionLabel,
          secaoNome: familiaMeta.secaoNome || prod.sectionLabel,
          familiaId: familiaMeta.id,
          familia: familiaMeta.nome || familiaMeta.id,
          familiaNome: familiaMeta.nome || familiaMeta.id,
          produtoId: prod.id,
          produto: prod.nome,
          produtoNome: prod.nome,
          prodOrSub: prod.nome,
          subproduto: prod.nome,
          carteira: `${agency.agenciaNome || agency.agenciaId || "Carteira"} ${String.fromCharCode(65 + iter)}`,
          canalVenda: canaisVenda[(agencyIndex + prodIndex + iter) % canaisVenda.length],
          tipoVenda: tiposVenda[(agencyIndex + iter) % tiposVenda.length],
          modalidadePagamento: modalidadesVenda[(prodIndex + iter) % modalidadesVenda.length],
          realizado: realMens,
          meta: metaMens,
          real_mens: realMens,
          meta_mens: metaMens,
          real_acum: realAcum,
          meta_acum: metaAcum,
          qtd,
          data: dataISO,
          competencia: competenciaMes,
          peso,
          pontos,
          variavelMeta,
          variavelReal,
          ating
        });
      }
    });
  });

  factRows.forEach(row => {
    row.ating = row.meta ? (row.realizado / row.meta) : 0;
  });

  fDados = factRows;
  fVariavel = factRows.map(row => ({
    segmento: row.segmento,
    diretoria: row.diretoria,
    diretoriaNome: row.diretoriaNome,
    gerenciaRegional: row.gerenciaRegional,
    gerenciaNome: row.gerenciaNome,
    agencia: row.agencia,
    agenciaNome: row.agenciaNome,
    gerenteGestao: row.gerenteGestao,
    gerenteGestaoNome: row.gerenteGestaoNome,
    gerente: row.gerente,
    gerenteNome: row.gerenteNome,
    secaoId: row.secaoId,
    secao: row.secao,
    secaoNome: row.secaoNome,
    familiaId: row.familiaId,
    familia: row.familia,
    produtoId: row.produtoId,
    produto: row.produto,
    realizado: row.variavelReal,
    meta: row.variavelMeta,
    pontos: row.pontos,
    data: row.data,
    competencia: row.competencia
  }));

  const campanhaFacts = buildCampanhaFacts();
  fCampanhas = campanhaFacts;

  const baseDashboard = buildDashboardDatasetFromRows(fDados, period);
  const ranking = fDados.map(row => ({ ...row }));

  return {
    sections: baseDashboard.sections,
    summary: baseDashboard.summary,
    ranking,
    period,
    facts: { dados: fDados, variavel: fVariavel, campanhas: fCampanhas }
  };
}

/* ===== Aqui eu monto a sidebar retrátil direto via JS, sem depender do CSS ===== */
/* ===== Aqui eu guardo e manipulo o estado geral da aplicação ===== */
const state = {
  _dataset:null,
  _rankingRaw:[],
  facts:{ dados:[], campanhas:[], variavel:[] },
  dashboard:{ sections:[], summary:{} },
  activeView:"cards",
  tableView:"diretoria",
  tableRendered:false,
  isAnimating:false,
  period: getDefaultPeriodRange(),
  accumulatedView:"mensal",
  datePopover:null,
  compact:false,
  contractIndex:[],
  lastNonContractView:"diretoria",

  // ranking
  rk:{
    level:"agencia",
    type:"pobj",
    product:"",
    productMode:"melhores",
  },

  detailSort:{ id:null, direction:null },

  // busca por contrato (usa o input #busca)
  tableSearchTerm:"",

  campanhas:{
    sprintId: CAMPAIGN_SPRINTS[0]?.id || null,
    teamValues:{},
    teamPreset:{},
    individualProfile: CAMPAIGN_SPRINTS[0]?.individual?.profiles?.[0]?.id || null,
    individualValues:{},
    individualPreset:{},
  },

  details:{
    activeViewId: DETAIL_DEFAULT_VIEW.id,
    activeColumns: [...DETAIL_DEFAULT_VIEW.columns],
    savedViews: [],
    customView: null,
    designerDraft: null,
    designerMessage: "",
  },

  opportunities:{
    open:false,
    node:null,
    lineage:[],
    baseFilters:new Map(),
    selectedLevel:"secao",
    filtered:[],
    trail:[],
    contact:{ open:false, leadId:null, trigger:null },
    detail:{ selectedId:null },
  },

  animations:{
    resumo:{
      kpiKey:null,
      varRatios:new Map(),
    },
    campanhas:{
      team:new Map(),
      individual:new Map(),
      ranking:new Map(),
    },
  }
};

hydrateDetailViewsFromStorage();

function hydrateDetailViewsFromStorage(){
  const savedRaw = readLocalStorageJSON(DETAIL_VIEW_STORAGE_KEY);
  const savedList = Array.isArray(savedRaw)
    ? savedRaw.map(normalizeDetailViewPayload).filter(Boolean)
    : [];
  state.details.savedViews = savedList.slice(0, DETAIL_MAX_CUSTOM_VIEWS);

  const customRaw = readLocalStorageJSON(DETAIL_VIEW_CUSTOM_KEY);
  if (customRaw && Array.isArray(customRaw.columns)) {
    const label = limparTexto(customRaw.name || "") || DETAIL_CUSTOM_DEFAULT_LABEL;
    state.details.customView = {
      name: label,
      columns: sanitizeDetailColumns(customRaw.columns),
    };
  } else {
    state.details.customView = null;
  }

  const activeId = readLocalStorageItem(DETAIL_VIEW_ACTIVE_KEY) || DETAIL_DEFAULT_VIEW.id;
  const candidate = detailViewById(activeId);
  if (candidate) {
    state.details.activeViewId = candidate.id;
    state.details.activeColumns = sanitizeDetailColumns(candidate.columns);
    if (candidate.id === "__custom__") {
      state.details.customView = {
        name: candidate.name || DETAIL_CUSTOM_DEFAULT_LABEL,
        columns: [...state.details.activeColumns],
      };
    }
  } else {
    state.details.activeViewId = DETAIL_DEFAULT_VIEW.id;
    state.details.activeColumns = [...DETAIL_DEFAULT_VIEW.columns];
  }
  persistDetailState();
}

function getAllDetailViews(){
  const saved = Array.isArray(state.details.savedViews) ? state.details.savedViews : [];
  const base = [DETAIL_DEFAULT_VIEW, ...saved.map(view => ({
    id: view.id,
    name: limparTexto(view.name || "") || "Visão personalizada",
    columns: sanitizeDetailColumns(view.columns),
  }))];
  const custom = state.details.customView;
  if (custom && Array.isArray(custom.columns) && custom.columns.length) {
    base.push({
      id: "__custom__",
      name: limparTexto(custom.name || "") || DETAIL_CUSTOM_DEFAULT_LABEL,
      columns: sanitizeDetailColumns(custom.columns),
    });
  }
  return base;
}

function getActiveDetailColumns(){
  const ids = sanitizeDetailColumns(state.details.activeColumns || DETAIL_DEFAULT_VIEW.columns);
  return ids.map(id => getDetailColumnMeta(id)).filter(Boolean);
}

function detailViewById(viewId){
  if (!viewId) return null;
  if (viewId === DETAIL_DEFAULT_VIEW.id) return { ...DETAIL_DEFAULT_VIEW };
  if (viewId === "__custom__") {
    const custom = state.details.customView;
    if (custom && Array.isArray(custom.columns) && custom.columns.length) {
      return {
        id: "__custom__",
        name: limparTexto(custom.name || "") || DETAIL_CUSTOM_DEFAULT_LABEL,
        columns: sanitizeDetailColumns(custom.columns),
      };
    }
    return null;
  }
  const saved = Array.isArray(state.details.savedViews) ? state.details.savedViews : [];
  const match = saved.find(v => v.id === viewId);
  return match ? {
    id: match.id,
    name: limparTexto(match.name || "") || "Visão personalizada",
    columns: sanitizeDetailColumns(match.columns),
  } : null;
}

function persistDetailViews(){
  const payload = (Array.isArray(state.details.savedViews) ? state.details.savedViews : []).map(view => ({
    id: view.id,
    name: limparTexto(view.name || "") || "Visão personalizada",
    columns: sanitizeDetailColumns(view.columns),
  }));
  writeLocalStorageJSON(DETAIL_VIEW_STORAGE_KEY, payload.length ? payload : null);
}

function persistActiveDetailState(){
  writeLocalStorageItem(DETAIL_VIEW_ACTIVE_KEY, state.details.activeViewId || DETAIL_DEFAULT_VIEW.id);
  if (state.details.customView && Array.isArray(state.details.customView.columns) && state.details.customView.columns.length) {
    writeLocalStorageJSON(DETAIL_VIEW_CUSTOM_KEY, {
      name: limparTexto(state.details.customView.name || "") || DETAIL_CUSTOM_DEFAULT_LABEL,
      columns: sanitizeDetailColumns(state.details.customView.columns),
    });
  } else {
    writeLocalStorageItem(DETAIL_VIEW_CUSTOM_KEY, null);
  }
}

function persistDetailState(){
  persistDetailViews();
  persistActiveDetailState();
}

function updateActiveDetailConfiguration(viewId, columns, options = {}){
  const sanitized = sanitizeDetailColumns(columns);
  const label = limparTexto(options.label || "");
  if (viewId === "__custom__") {
    const name = label || state.details.customView?.name || DETAIL_CUSTOM_DEFAULT_LABEL;
    state.details.customView = {
      name,
      columns: [...sanitized],
    };
  }
  state.details.activeViewId = viewId;
  state.details.activeColumns = [...sanitized];
  persistDetailState();
  return [...sanitized];
}

function updateSavedDetailView(viewId, columns){
  if (!viewId) return null;
  const saved = Array.isArray(state.details.savedViews) ? state.details.savedViews : [];
  const idx = saved.findIndex(v => v.id === viewId);
  if (idx < 0) return null;
  const next = {
    id: saved[idx].id,
    name: saved[idx].name,
    columns: sanitizeDetailColumns(columns),
  };
  saved[idx] = next;
  persistDetailViews();
  return next;
}

function createDetailView(columns, name){
  const saved = Array.isArray(state.details.savedViews) ? state.details.savedViews : [];
  if (saved.length >= DETAIL_MAX_CUSTOM_VIEWS) return null;
  const sanitized = sanitizeDetailColumns(columns);
  const label = limparTexto(name || "") || `Visão ${saved.length + 1}`;
  const view = { id: generateDetailViewId(), name: label, columns: sanitized };
  saved.push(view);
  state.details.savedViews = saved;
  persistDetailViews();
  return view;
}

function deleteDetailView(viewId){
  if (!viewId || viewId === DETAIL_DEFAULT_VIEW.id) return false;
  const saved = Array.isArray(state.details.savedViews) ? state.details.savedViews : [];
  const idx = saved.findIndex(v => v.id === viewId);
  if (idx < 0) return false;
  saved.splice(idx, 1);
  state.details.savedViews = saved;
  persistDetailViews();
  if (state.details.activeViewId === viewId) {
    updateActiveDetailConfiguration(DETAIL_DEFAULT_VIEW.id, DETAIL_DEFAULT_VIEW.columns);
  } else {
    persistActiveDetailState();
  }
  return true;
}

function prefersReducedMotion(){
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (err) {
    return false;
  }
}

function isDOMElement(value){
  return !!value && typeof value === 'object' && 'classList' in value;
}

function triggerBarAnimation(targets, shouldAnimate, className = 'is-animating'){
  const iterable = targets && typeof targets[Symbol.iterator] === 'function';
  const list = !targets ? [] : (Array.isArray(targets) ? targets : (iterable && !isDOMElement(targets) ? Array.from(targets) : [targets]));
  list.forEach(el => {
    if (!isDOMElement(el)) return;
    el.classList.remove(className);
    if (!shouldAnimate || prefersReducedMotion()) return;
    void el.offsetWidth;
    el.classList.add(className);
    const cleanup = () => el.classList.remove(className);
    el.addEventListener('animationend', cleanup, { once:true });
    el.addEventListener('animationcancel', cleanup, { once:true });
  });
}

function shouldAnimateDelta(prev, next, tolerance = 0.1){
  if (prev == null || !Number.isFinite(prev)) return true;
  if (next == null || !Number.isFinite(next)) return false;
  return Math.abs(prev - next) > tolerance;
}

let __varTrackResizeBound = false;
function positionVarTrackLabel(trackEl){
  if (!trackEl) return;
  const label = trackEl.querySelector('.prod-card__var-label');
  if (!label) return;
  const trackWidth = trackEl.clientWidth;
  if (!trackWidth) return;

  const ratio = Number(trackEl.dataset?.ratio);
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(100, ratio)) : 0;
  const padding = 6;
  const maxWidth = Math.max(trackWidth - (padding * 2), 0);
  label.style.maxWidth = `${maxWidth}px`;

  const labelWidth = label.offsetWidth;
  const tip = (safeRatio / 100) * trackWidth;
  const half = labelWidth / 2;
  const minLeft = padding + half;
  const maxLeft = Math.max(minLeft, trackWidth - padding - half);
  let left = tip;
  if (left < minLeft) left = minLeft;
  if (left > maxLeft) left = maxLeft;

  label.style.left = `${left}px`;
}

function layoutProdVarTracks(){
  $$('.prod-card__var-track').forEach(track => {
    if (!track?.offsetParent) return;
    positionVarTrackLabel(track);
  });
}

function ensureVarLabelResizeListener(){
  if (typeof window === 'undefined') return;
  if (__varTrackResizeBound) return;
  __varTrackResizeBound = true;
  window.addEventListener('resize', () => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(layoutProdVarTracks);
    } else {
      layoutProdVarTracks();
    }
  });
}

const contractSuggestState = { items: [], highlight: -1, open: false, term: "", pending: null };
let contractSuggestDocBound = false;
let contractSuggestPanelBound = false;

/* ===== Aqui eu junto utilidades de interface que reaproveito em várias telas ===== */
function injectStyles(){
  if(document.getElementById("dynamic-styles")) return;
  const style = document.createElement("style");
  style.id = "dynamic-styles";
  style.textContent = `
  .view-panel{ opacity:1; transform:translateY(0); transition:opacity .28s ease, transform .28s ease; will-change:opacity, transform; }
  .view-panel.is-exit{ opacity:0; transform:translateY(8px); }
  .view-panel.is-enter{ opacity:0; transform:translateY(-6px); }
  .view-panel.is-enter-active{ opacity:1; transform:translateY(0); }
  .hidden{ display:none; }

  /* ===== KPI topo: versão ajustada ===== */
  #kpi-summary.kpi-summary{
    display:flex !important;
    flex-wrap:wrap;
    gap:18px;
    margin:8px 0 14px;
    align-items:flex-start;
  }
  #kpi-summary .kpi-pill{
    flex:1 1 320px;
    min-width:280px;
    padding:24px 26px;
    gap:14px;
  }
  #kpi-summary .kpi-strip__main{ gap:14px; }
  #kpi-summary .kpi-icon{ width:42px; height:42px; font-size:18px; }
  #kpi-summary .kpi-strip__label{ font-size:13.5px; max-width:220px; }
  #kpi-summary .kpi-stat{ font-size:12.5px; }

  #kpi-summary .hitbar{
    width:100%;
    gap:12px;
  }
  #kpi-summary .hitbar__track{
    min-width:0;
    height:9px;
    border-width:1.5px;
  }
  #kpi-summary .hitbar strong{
    font-size:12.5px;
  }

  @media (max-width: 720px){
    #kpi-summary .kpi-pill{ min-width:100%; }
  }
`;
  document.head.appendChild(style);
  ["#view-cards", "#view-table"].forEach(sel => $(sel)?.classList.add("view-panel"));
}

/* ===== Aqui eu trato o popover de data para facilitar a seleção de período ===== */
function openDatePopover(anchor){
  closeDatePopover();

  const pop = document.createElement("div");
  pop.className = "date-popover";
  pop.id = "date-popover";
  pop.innerHTML = `
    <h4>Alterar data</h4>
    <div class="row" style="margin-bottom:8px">
      <input id="inp-start" type="date" value="${state.period.start}" aria-label="Data inicial">
      <input id="inp-end"   type="date" value="${state.period.end}"   aria-label="Data final">
    </div>
    <div class="actions">
      <button type="button" class="btn-sec" id="btn-cancelar">Cancelar</button>
      <button type="button" class="btn-pri" id="btn-salvar">Salvar</button>
    </div>
  `;
  document.body.appendChild(pop);

  // Posiciona relativo à viewport (o popover é FIXO)
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth || 340;
  const h = pop.offsetHeight || 170;
  const pad = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top  = r.bottom + 8;
  let left = r.right - w;
  if (top + h + pad > vh) top = Math.max(pad, r.top - h - 8);
  if (left < pad) left = pad;
  if (left + w + pad > vw) left = Math.max(pad, vw - w - pad);

  pop.style.top  = `${top}px`;
  pop.style.left = `${left}px`;

  pop.querySelector("#btn-cancelar").addEventListener("click", closeDatePopover);
  pop.querySelector("#btn-salvar").addEventListener("click", ()=>{
    const s = document.getElementById("inp-start").value;
    const e = document.getElementById("inp-end").value;
    if(!s || !e || new Date(s) > new Date(e)){ alert("Período inválido."); return; }
    state.period.start = s;
    state.period.end   = e;
    state.accumulatedView = "mensal";
    const visaoSelect = document.getElementById("f-visao");
    if (visaoSelect) visaoSelect.value = "mensal";
    document.getElementById("lbl-periodo-inicio").textContent = formatBRDate(s);
    document.getElementById("lbl-periodo-fim").textContent    = formatBRDate(e);
    closeDatePopover();
    refresh();
  });

  const outside = (ev)=>{ if(ev.target===pop || pop.contains(ev.target) || ev.target===anchor) return; closeDatePopover(); };
  const esc     = (ev)=>{ if(ev.key==="Escape") closeDatePopover(); };
  document.addEventListener("mousedown", outside, { once:true });
  document.addEventListener("keydown", esc, { once:true });

  state.datePopover = pop;
}
function closeDatePopover(){
  if(state.datePopover?.parentNode) state.datePopover.parentNode.removeChild(state.datePopover);
  state.datePopover = null;
}

/* ===== Aqui eu configuro o botão de limpar filtros e mantenho o fluxo claro ===== */
function wireClearFiltersButton() {
  const btn = $("#btn-limpar");
  if (!btn || btn.dataset.wired === "1") return;
  btn.dataset.wired = "1";
  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    btn.disabled = true;
    try { await clearFilters(); } finally { setTimeout(() => (btn.disabled = false), 250); }
  });
}
async function clearFilters() {
  [
    "#f-segmento","#f-diretoria","#f-gerencia","#f-gerente",
    "#f-agencia","#f-ggestao","#f-secao","#f-familia","#f-produto",
    "#f-status-kpi","#f-visao"
  ].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    if (el.tagName === "SELECT") el.selectedIndex = 0;
    if (el.tagName === "INPUT")  el.value = "";
  });

  // valores padrão explícitos
  const st = $("#f-status-kpi"); if (st) st.value = "todos";
  const visaoSelect = $("#f-visao");
  if (visaoSelect) visaoSelect.value = "mensal";
  state.accumulatedView = "mensal";
  const secaoSelect = $("#f-secao");
  if (secaoSelect) secaoSelect.dispatchEvent(new Event("change"));
  const familiaSelect = $("#f-familia");
  if (familiaSelect) familiaSelect.dispatchEvent(new Event("change"));

  refreshHierarchyCombos();

  // limpa busca (contrato) e estado
  state.tableSearchTerm = "";
  if ($("#busca")) $("#busca").value = "";
  refreshContractSuggestions("");
  const defaultPeriod = getDefaultPeriodRange();
  state.period = defaultPeriod;
  syncPeriodFromAccumulatedView(state.accumulatedView, defaultPeriod.end);
  if (state.tableView === "contrato") {
    state.tableView = "diretoria";
    state.lastNonContractView = "diretoria";
    setActiveChip("diretoria");
  }

  await withSpinner(async () => {
    applyFiltersAndRender();
    renderAppliedFilters();
    renderCampanhasView();
    if (state.activeView === "ranking") renderRanking();
  }, "Limpando filtros…");
  closeMobileFilters();
}

function setMobileFiltersState(open) {
  const card = document.querySelector(".card--filters");
  if (!card) return;
  card.classList.toggle("is-mobile-open", open);
  card.setAttribute("aria-expanded", open ? "true" : "false");
  document.body.classList.toggle("filters-open", open);

  const hamburger = document.querySelector(".topbar-hamburger");
  if (hamburger) hamburger.setAttribute("aria-expanded", open ? "true" : "false");

  const backdrop = document.getElementById("filters-backdrop");
  if (backdrop) {
    if (open) {
      backdrop.hidden = false;
      backdrop.classList.add("is-show");
    } else {
      backdrop.classList.remove("is-show");
      backdrop.hidden = true;
    }
  }

  const carousel = document.getElementById("mobile-carousel");
  if (carousel) {
    carousel.classList.toggle("mobile-carousel--hidden", open);
    carousel.setAttribute("aria-hidden", open ? "true" : "false");
    const ctrl = carousel._carouselControl;
    if (ctrl) {
      if (open && typeof ctrl.stop === "function") ctrl.stop();
      if (!open && typeof ctrl.start === "function") ctrl.start();
    }
  }

  const toggle = document.getElementById("btn-mobile-filtros");
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function openMobileFilters(){ setMobileFiltersState(true); }
function closeMobileFilters(){ setMobileFiltersState(false); }

function setupMobileFilters(){
  const openBtn = document.getElementById("btn-mobile-filtros");
  const closeBtn = document.getElementById("btn-fechar-filtros");
  const backdrop = document.getElementById("filters-backdrop");

  if (openBtn && !openBtn.dataset.bound) {
    openBtn.dataset.bound = "1";
    openBtn.addEventListener("click", () => openMobileFilters());
  }
  if (closeBtn && !closeBtn.dataset.bound) {
    closeBtn.dataset.bound = "1";
    closeBtn.addEventListener("click", () => closeMobileFilters());
  }
  if (backdrop && !backdrop.dataset.bound) {
    backdrop.dataset.bound = "1";
    backdrop.addEventListener("click", () => closeMobileFilters());
  }

  if (!setupMobileFilters._escBound) {
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeMobileFilters();
    });
    setupMobileFilters._escBound = true;
  }
}

let userMenuBound = false;
function setupUserMenu(){
  if (userMenuBound) return;
  const trigger = document.getElementById("btn-user-menu");
  const menu = document.getElementById("user-menu");
  if (!trigger || !menu) return;

  const subToggle = menu.querySelector('[data-submenu="manuais"]');
  const subList = document.getElementById("user-submenu-manuais");

  const closeSubmenu = () => {
    if (!subToggle || !subList) return;
    subToggle.setAttribute("aria-expanded", "false");
    subList.hidden = true;
    subList.classList.remove("is-open");
  };

  const closeMenu = () => {
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    trigger.setAttribute("aria-expanded", "false");
    closeSubmenu();
  };

  const openMenu = () => {
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    trigger.setAttribute("aria-expanded", "true");
  };

  trigger.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const isOpen = menu.classList.contains("is-open");
    if (isOpen) closeMenu(); else openMenu();
  });

  if (subToggle && subList) {
    subToggle.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const expanded = subToggle.getAttribute("aria-expanded") === "true";
      const next = !expanded;
      subToggle.setAttribute("aria-expanded", String(next));
      if (next) {
        subList.hidden = false;
        subList.classList.add("is-open");
      } else {
        subList.classList.remove("is-open");
        subList.hidden = true;
      }
    });
  }

  menu.addEventListener("click", (ev) => {
    const item = ev.target?.closest?.(".userbox__menu-item");
    if (!item || item.hasAttribute("data-submenu")) return;
    closeMenu();
  });

  document.addEventListener("click", (ev) => {
    if (!menu.contains(ev.target) && !trigger.contains(ev.target)) {
      closeMenu();
    }
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeMenu();
  });

  userMenuBound = true;
}

function initMobileCarousel(){
  const host = document.getElementById("mobile-carousel");
  if (!host) return;
  const slides = Array.from(host.querySelectorAll(".mobile-carousel__slide"));
  const dots = Array.from(host.querySelectorAll(".mobile-carousel__dot"));
  if (slides.length <= 1) {
    slides.forEach(slide => slide.classList.add("is-active"));
    dots.forEach(dot => dot.setAttribute("aria-current", "true"));
    return;
  }

  let current = 0;
  let timer = null;
  let pointerStart = null;

  const activate = (idx) => {
    if (!slides.length) return;
    const next = (idx + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === next);
      slide.setAttribute("aria-hidden", i === next ? "false" : "true");
    });
    dots.forEach((dot, i) => {
      dot.setAttribute("aria-current", i === next ? "true" : "false");
    });
    current = next;
  };

  const goTo = (idx) => {
    stop();
    activate(idx);
    start();
  };

  const start = () => {
    if (timer) return;
    timer = setInterval(() => activate(current + 1), 6000);
  };

  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };

  dots.forEach((dot, idx) => {
    if (dot.dataset.bound) return;
    dot.dataset.bound = "1";
    dot.addEventListener("click", () => {
      goTo(idx);
    });
  });

  const handlePointerDown = (ev) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    pointerStart = ev.clientX;
    stop();
  };

  const handlePointerUp = (ev) => {
    if (pointerStart === null) return;
    const delta = ev.clientX - pointerStart;
    pointerStart = null;
    if (Math.abs(delta) > 30) {
      goTo(delta < 0 ? current + 1 : current - 1);
    } else {
      start();
    }
  };

  const handlePointerCancel = () => {
    pointerStart = null;
    start();
  };

  host.addEventListener("pointerdown", handlePointerDown);
  host.addEventListener("pointerup", handlePointerUp);
  host.addEventListener("pointercancel", handlePointerCancel);
  host.addEventListener("pointerleave", () => {
    pointerStart = null;
  });

  host.addEventListener("pointerenter", stop, { passive: true });
  host.addEventListener("pointerleave", start, { passive: true });
  host.addEventListener("focusin", stop);
  host.addEventListener("focusout", start);

  activate(0);
  start();

  host._carouselControl = {
    start,
    stop
  };
}

/* ===== Aqui eu descrevo as opções avançadas de filtro que ficam escondidas ===== */
function ensureStatusFilterInAdvanced() {
  const adv = $("#advanced-filters");
  if (!adv) return;
  const host = adv.querySelector(".adv__grid") || adv;

  if (!$("#f-status-kpi")) {
    const wrap = document.createElement("div");
    wrap.className = "filters__group";
    wrap.innerHTML = `
      <label for="f-status-kpi">Status dos indicadores</label>
      <select id="f-status-kpi" class="input"></select>`;
    host.appendChild(wrap);
    $("#f-status-kpi").addEventListener("change", async () => {
      await withSpinner(async () => {
        applyFiltersAndRender();
        renderAppliedFilters();
        renderCampanhasView();
        if (state.activeView === "ranking") renderRanking();
      }, "Atualizando filtros…");
    });
  }

  updateStatusFilterOptions();

  const gStart = $("#f-inicio")?.closest(".filters__group");
  if (gStart) gStart.remove();
}

/* ===== Aqui eu monto os chips da tabela e a toolbar com as ações rápidas ===== */
function ensureChipBarAndToolbar() {
  if ($("#table-controls")) return;
  const card = $("#table-section"); if (!card) return;

  const holder = document.createElement("div");
  holder.id = "table-controls";
  holder.innerHTML = `
    <div id="applied-bar" class="applied-bar"></div>
    <div id="chipbar" class="chipbar"></div>
    <div id="tt-toolbar" class="table-toolbar"></div>
    <div id="detail-view-bar" class="detail-view-bar">
      <div class="detail-view-bar__left">
        <span class="detail-view-bar__label">Visões da tabela</span>
        <div id="detail-view-chips" class="detail-view-chips"></div>
      </div>
    </div>`;
  const header = card.querySelector(".card__header") || card;
  header.insertAdjacentElement("afterend", holder);


  const chipbar = $("#chipbar");
  TABLE_VIEWS.forEach(v => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.view = v.id;
    chip.textContent = v.label;
    if (v.id === state.tableView) chip.classList.add("is-active");
    chip.addEventListener("click", () => {
      if (state.tableView === v.id) return;
      if (v.id === "contrato" && state.tableView !== "contrato") {
        state.lastNonContractView = state.tableView;
      }
      state.tableView = v.id;
      setActiveChip(v.id);
      renderTreeTable();
    });
    chipbar.appendChild(chip);
  });

  $("#tt-toolbar").innerHTML = `
    <button type="button" id="btn-expandir" class="btn btn--sm"><i class="ti ti-chevrons-down"></i> Expandir tudo</button>
    <button type="button" id="btn-recolher" class="btn btn--sm"><i class="ti ti-chevrons-up"></i> Recolher tudo</button>
    <button type="button" id="btn-compacto" class="btn btn--sm"><i class="ti ti-layout-collage"></i> Modo compacto</button>
    <button type="button" id="btn-manage-detail-columns" class="btn btn--ghost btn--sm detail-view-manage"><i class="ti ti-columns"></i> Personalizar colunas</button>`;
  $("#btn-expandir").addEventListener("click", expandAllRows);
  $("#btn-recolher").addEventListener("click", collapseAllRows);
  $("#btn-compacto").addEventListener("click", () => {
    state.compact = !state.compact;
    $("#table-section")?.classList.toggle("is-compact", state.compact);
  });

  const detailChips = document.getElementById("detail-view-chips");
  if (detailChips && !detailChips.dataset.bound) {
    detailChips.dataset.bound = "1";
    detailChips.addEventListener("click", handleDetailViewChipClick);
  }

  const manageBtn = document.getElementById("btn-manage-detail-columns");
  if (manageBtn && !manageBtn.dataset.bound) {
    manageBtn.dataset.bound = "1";
    manageBtn.addEventListener("click", () => openDetailDesigner());
  }

  renderDetailViewBar();
  initDetailDesigner();

  const headerSearch = $("#busca");
  if (headerSearch) headerSearch.placeholder = "Contrato (Ex.: CT-AAAA-999999)";
  $$('#table-section input[placeholder*="Contrato" i]').forEach(el => { if (el !== headerSearch) el.remove(); });

  renderAppliedFilters();
}

function renderDetailViewBar(){
  const chipsHolder = document.getElementById("detail-view-chips");
  if (!chipsHolder) return;
  const views = getAllDetailViews();
  if (!views.length) {
    chipsHolder.innerHTML = `<span class="detail-view-empty">Sem visões disponíveis</span>`;
    return;
  }
  const activeId = state.details.activeViewId || DETAIL_DEFAULT_VIEW.id;
  chipsHolder.innerHTML = views.map(view => {
    const isActive = view.id === activeId;
    const safeId = escapeHTML(view.id);
    const safeName = escapeHTML(view.name || "Visão");
    return `<button type="button" class="detail-chip${isActive ? " is-active" : ""}" data-view-id="${safeId}"><span>${safeName}</span></button>`;
  }).join("");
}

function handleDetailViewChipClick(ev){
  const chip = ev.target.closest(".detail-chip");
  if (!chip) return;
  const viewId = chip.dataset.viewId;
  if (!viewId || viewId === state.details.activeViewId) return;
  const view = detailViewById(viewId);
  if (!view) return;
  updateActiveDetailConfiguration(view.id, view.columns, { label: view.name });
  if (state.tableRendered) renderTreeTable();
  else renderDetailViewBar();
}

let detailDesignerInitialized = false;
let detailDesignerDragState = null;
let detailDesignerFeedbackTimer = null;

function initDetailDesigner(){
  if (detailDesignerInitialized) return;
  const host = document.getElementById("detail-designer");
  if (!host) return;
  detailDesignerInitialized = true;

  host.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-designer-close]")) {
      ev.preventDefault();
      closeDetailDesigner();
    }
  });

  host.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeDetailDesigner();
  });

  host.querySelectorAll(".detail-designer__items").forEach(list => {
    list.addEventListener("click", handleDetailDesignerListClick);
    list.addEventListener("dragover", handleDetailDesignerDragOver);
    list.addEventListener("drop", handleDetailDesignerDrop);
    list.addEventListener("dragleave", handleDetailDesignerDragLeave);
  });

  const viewsContainer = document.getElementById("detail-designer-views");
  if (viewsContainer) viewsContainer.addEventListener("click", handleDetailDesignerViewClick);

  document.getElementById("detail-apply-columns")?.addEventListener("click", handleDetailDesignerApply);
  document.getElementById("detail-save-view")?.addEventListener("click", handleDetailDesignerSave);
  document.getElementById("detail-view-name")?.addEventListener("input", () => updateDetailDesignerControls());
}

function openDetailDesigner(){
  const host = document.getElementById("detail-designer");
  if (!host) return;
  const current = detailViewById(state.details.activeViewId) || DETAIL_DEFAULT_VIEW;
  const baseColumns = sanitizeDetailColumns(current.columns);
  state.details.designerDraft = {
    viewId: current.id,
    name: current.name,
    columns: [...baseColumns],
    original: [...baseColumns],
    modified: false,
  };
  state.details.designerMessage = "";

  const nameInput = document.getElementById("detail-view-name");
  if (nameInput) nameInput.value = "";

  renderDetailDesigner();
  host.hidden = false;
  host.setAttribute("aria-hidden", "false");
  host.classList.add("is-open");
  document.body.classList.add("has-modal-open");
  const panel = host.querySelector(".detail-designer__panel");
  if (panel) {
    if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    panel.focus({ preventScroll: true });
  }
}

function closeDetailDesigner(){
  const host = document.getElementById("detail-designer");
  if (!host) return;
  host.classList.remove("is-open");
  host.setAttribute("aria-hidden", "true");
  host.hidden = true;
  document.body.classList.remove("has-modal-open");
  state.details.designerDraft = null;
  state.details.designerMessage = "";
  if (detailDesignerFeedbackTimer) {
    clearTimeout(detailDesignerFeedbackTimer);
    detailDesignerFeedbackTimer = null;
  }
  const nameInput = document.getElementById("detail-view-name");
  if (nameInput) nameInput.value = "";
}

function renderDetailDesigner(){
  const host = document.getElementById("detail-designer");
  const draft = state.details.designerDraft;
  if (!host || !draft) return;

  const selectedWrap = host.querySelector('[data-items="selected"]');
  const availableWrap = host.querySelector('[data-items="available"]');
  if (!selectedWrap || !availableWrap) return;

  const selectedIds = sanitizeDetailColumns(draft.columns);
  if (!detailColumnsEqual(selectedIds, draft.columns)) draft.columns = [...selectedIds];
  draft.modified = !detailColumnsEqual(selectedIds, draft.original || []);

  const available = DETAIL_COLUMNS.filter(col => !selectedIds.includes(col.id));
  const canRemove = selectedIds.length > 1;

  selectedWrap.innerHTML = selectedIds.length
    ? selectedIds.map(id => {
        const meta = getDetailColumnMeta(id);
        if (!meta) return "";
        const safeId = escapeHTML(meta.id);
        const safeLabel = escapeHTML(meta.label);
        const disabledAttr = canRemove ? "" : " disabled";
        const disabledClass = canRemove ? "" : " is-disabled";
        return `
          <div class="detail-item" data-col="${safeId}" draggable="true">
            <span class="detail-item__handle" aria-hidden="true"><i class="ti ti-grip-vertical"></i></span>
            <span class="detail-item__label">${safeLabel}</span>
            <button type="button" class="detail-item__remove${disabledClass}" data-action="remove" aria-label="Remover ${safeLabel}"${disabledAttr}><i class="ti ti-x"></i></button>
          </div>`;
      }).join("")
    : `<p class="detail-designer__empty">Escolha ao menos uma coluna.</p>`;

  availableWrap.innerHTML = available.length
    ? available.map(meta => {
        const safeId = escapeHTML(meta.id);
        const safeLabel = escapeHTML(meta.label);
        return `
          <div class="detail-item detail-item--available" data-col="${safeId}" draggable="true">
            <span class="detail-item__handle" aria-hidden="true"><i class="ti ti-grip-vertical"></i></span>
            <span class="detail-item__label">${safeLabel}</span>
            <button type="button" class="detail-item__add" data-action="add" aria-label="Adicionar ${safeLabel}"><i class="ti ti-plus"></i></button>
          </div>`;
      }).join("")
    : `<p class="detail-designer__empty">Todas as colunas já estão na tabela.</p>`;

  selectedWrap.querySelectorAll(".detail-item").forEach(item => {
    item.addEventListener("dragstart", handleDetailDesignerDragStart);
    item.addEventListener("dragend", handleDetailDesignerDragEnd);
  });
  availableWrap.querySelectorAll(".detail-item").forEach(item => {
    item.addEventListener("dragstart", handleDetailDesignerDragStart);
    item.addEventListener("dragend", handleDetailDesignerDragEnd);
  });

  renderDetailDesignerViews();
  updateDetailDesignerControls();
  updateDetailDesignerFeedback();
}

function renderDetailDesignerViews(){
  const container = document.getElementById("detail-designer-views");
  const draft = state.details.designerDraft;
  if (!container || !draft) return;
  const views = getAllDetailViews();
  if (!views.length) {
    container.innerHTML = `<span class="detail-view-empty">Nenhuma visão salva.</span>`;
    return;
  }
  const currentId = draft.viewId;
  container.innerHTML = views.map(view => {
    const safeId = escapeHTML(view.id);
    const safeName = escapeHTML(view.name || "Visão");
    const isActive = view.id === currentId;
    const deletable = view.id !== DETAIL_DEFAULT_VIEW.id && view.id !== "__custom__";
    const deleteBtn = deletable
      ? `<button type="button" class="detail-chip__remove" data-action="delete" data-view-id="${safeId}" aria-label="Excluir ${safeName}"><i class="ti ti-trash"></i></button>`
      : "";
    return `
      <div class="detail-chip detail-chip--designer${isActive ? " is-active" : ""}" data-view-id="${safeId}">
        <button type="button" class="detail-chip__action" data-action="load" data-view-id="${safeId}">${safeName}</button>
        ${deleteBtn}
      </div>`;
  }).join("");
}

function updateDetailDesignerControls(){
  const draft = state.details.designerDraft;
  const saveBtn = document.getElementById("detail-save-view");
  const nameInput = document.getElementById("detail-view-name");
  const applyBtn = document.getElementById("detail-apply-columns");
  const hint = document.getElementById("detail-save-hint");
  if (!draft) {
    if (saveBtn) saveBtn.disabled = true;
    if (applyBtn) applyBtn.disabled = true;
    return;
  }
  const selectedIds = sanitizeDetailColumns(draft.columns);
  if (applyBtn) applyBtn.disabled = !selectedIds.length;
  const limitReached = (state.details.savedViews || []).length >= DETAIL_MAX_CUSTOM_VIEWS;
  if (saveBtn && nameInput && hint) {
    const name = limparTexto(nameInput.value || "");
    if (limitReached) {
      saveBtn.disabled = true;
      hint.textContent = `Você já salvou ${DETAIL_MAX_CUSTOM_VIEWS} visões. Apague uma para liberar espaço.`;
    } else {
      saveBtn.disabled = name.length < 3 || !selectedIds.length;
      hint.textContent = `Você pode guardar até ${DETAIL_MAX_CUSTOM_VIEWS} visões personalizadas.`;
    }
  }
}

function updateDetailDesignerFeedback(){
  const feedback = document.getElementById("detail-designer-feedback");
  if (!feedback) return;
  if (detailDesignerFeedbackTimer) {
    clearTimeout(detailDesignerFeedbackTimer);
    detailDesignerFeedbackTimer = null;
  }
  const message = state.details.designerMessage || "";
  if (message) {
    feedback.textContent = message;
    feedback.hidden = false;
    detailDesignerFeedbackTimer = setTimeout(() => {
      state.details.designerMessage = "";
      feedback.hidden = true;
      feedback.textContent = "";
      detailDesignerFeedbackTimer = null;
    }, 3200);
  } else {
    feedback.textContent = "";
    feedback.hidden = true;
  }
}

function handleDetailDesignerListClick(ev){
  const actionBtn = ev.target.closest("[data-action]");
  if (!actionBtn) return;
  const item = actionBtn.closest(".detail-item");
  const colId = item?.dataset.col;
  if (!colId) return;
  ev.preventDefault();
  if (actionBtn.dataset.action === "remove") {
    removeColumnFromDesigner(colId);
  } else if (actionBtn.dataset.action === "add") {
    insertColumnIntoDesigner(colId);
  }
}

function handleDetailDesignerViewClick(ev){
  const button = ev.target.closest("[data-action][data-view-id]");
  if (!button) return;
  const action = button.dataset.action;
  const viewId = button.dataset.viewId;
  if (!viewId) return;
  ev.preventDefault();
  if (action === "load") {
    const view = detailViewById(viewId);
    if (!view) return;
    const cols = sanitizeDetailColumns(view.columns);
    state.details.designerDraft = {
      viewId: view.id,
      name: view.name,
      columns: [...cols],
      original: [...cols],
      modified: false,
    };
    state.details.designerMessage = "";
    const nameInput = document.getElementById("detail-view-name");
    if (nameInput) nameInput.value = "";
    renderDetailDesigner();
  } else if (action === "delete") {
    if (!deleteDetailView(viewId)) return;
    state.details.designerMessage = "Visão removida.";
    renderDetailViewBar();
    if (state.tableRendered) renderTreeTable();
    const fallback = detailViewById(state.details.activeViewId) || DETAIL_DEFAULT_VIEW;
    const cols = sanitizeDetailColumns(fallback.columns);
    state.details.designerDraft = {
      viewId: fallback.id,
      name: fallback.name,
      columns: [...cols],
      original: [...cols],
      modified: false,
    };
    renderDetailDesigner();
  }
}

function handleDetailDesignerApply(){
  const draft = state.details.designerDraft;
  if (!draft) { closeDetailDesigner(); return; }
  const columns = sanitizeDetailColumns(draft.columns);
  if (!columns.length) {
    state.details.designerMessage = "Escolha ao menos uma coluna para aplicar.";
    updateDetailDesignerFeedback();
    return;
  }

  let targetId = draft.viewId;
  if (!targetId || targetId === DETAIL_DEFAULT_VIEW.id) targetId = "__custom__";
  if (targetId !== "__custom__" && draft.modified) {
    updateSavedDetailView(targetId, columns);
    draft.original = [...columns];
    draft.modified = false;
  }

  let label;
  if (targetId === "__custom__") {
    label = draft.viewId === "__custom__"
      ? (draft.name || state.details.customView?.name || DETAIL_CUSTOM_DEFAULT_LABEL)
      : DETAIL_CUSTOM_DEFAULT_LABEL;
  } else {
    const viewMeta = detailViewById(targetId) || detailViewById(draft.viewId);
    label = viewMeta?.name || draft.name || DETAIL_CUSTOM_DEFAULT_LABEL;
  }

  updateActiveDetailConfiguration(targetId, columns, { label });
  renderDetailViewBar();
  if (state.tableRendered) renderTreeTable();
  closeDetailDesigner();
}

function handleDetailDesignerSave(){
  const draft = state.details.designerDraft;
  if (!draft) return;
  const nameInput = document.getElementById("detail-view-name");
  if (!nameInput) return;
  const name = limparTexto(nameInput.value || "");
  const columns = sanitizeDetailColumns(draft.columns);
  if (!columns.length) {
    state.details.designerMessage = "Adicione ao menos uma coluna antes de salvar.";
    updateDetailDesignerFeedback();
    return;
  }
  if (name.length < 3) {
    state.details.designerMessage = "Use um nome com pelo menos 3 caracteres.";
    updateDetailDesignerFeedback();
    return;
  }
  if ((state.details.savedViews || []).length >= DETAIL_MAX_CUSTOM_VIEWS) {
    state.details.designerMessage = "Limite de visões atingido. Remova uma visão antes de salvar outra.";
    updateDetailDesignerFeedback();
    return;
  }

  const view = createDetailView(columns, name);
  if (!view) {
    state.details.designerMessage = "Não foi possível salvar a visão.";
    updateDetailDesignerFeedback();
    return;
  }

  nameInput.value = "";
  state.details.designerDraft = {
    viewId: view.id,
    name: view.name,
    columns: [...view.columns],
    original: [...view.columns],
    modified: false,
  };
  state.details.designerMessage = "Visão salva com sucesso.";
  updateActiveDetailConfiguration(view.id, view.columns, { label: view.name });
  renderDetailViewBar();
  if (state.tableRendered) renderTreeTable();
  renderDetailDesigner();
}

function insertColumnIntoDesigner(colId, beforeId = null){
  const draft = state.details.designerDraft;
  if (!draft) return;
  const sanitized = sanitizeDetailColumns(draft.columns);
  let next = sanitized.filter(id => id !== colId);
  if (beforeId && next.includes(beforeId)) {
    next.splice(next.indexOf(beforeId), 0, colId);
  } else if (!next.includes(colId)) {
    next.push(colId);
  }
  draft.columns = [...next];
  draft.modified = !detailColumnsEqual(draft.columns, draft.original || []);
  state.details.designerMessage = "";
  renderDetailDesigner();
}

function removeColumnFromDesigner(colId){
  const draft = state.details.designerDraft;
  if (!draft) return;
  const sanitized = sanitizeDetailColumns(draft.columns);
  if (sanitized.length <= 1) {
    state.details.designerMessage = "Mantenha pelo menos uma coluna visível.";
    updateDetailDesignerFeedback();
    return;
  }
  const next = sanitized.filter(id => id !== colId);
  draft.columns = [...next];
  draft.modified = !detailColumnsEqual(draft.columns, draft.original || []);
  state.details.designerMessage = "";
  renderDetailDesigner();
}

function handleDetailDesignerDragStart(ev){
  const item = ev.currentTarget;
  const colId = item?.dataset.col;
  if (!colId) return;
  detailDesignerDragState = {
    colId,
    from: item.closest('[data-items]')?.dataset.items || "",
  };
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/plain", colId);
  }
  item.classList.add("is-dragging");
}

function handleDetailDesignerDragEnd(ev){
  ev.currentTarget?.classList?.remove("is-dragging");
  detailDesignerDragState = null;
}

function handleDetailDesignerDragOver(ev){
  ev.preventDefault();
  const container = ev.currentTarget.closest('[data-items]');
  if (container) container.classList.add("is-drag-over");
}

function handleDetailDesignerDragLeave(ev){
  const container = ev.currentTarget.closest('[data-items]');
  if (container) container.classList.remove("is-drag-over");
}

function handleDetailDesignerDrop(ev){
  ev.preventDefault();
  const container = ev.currentTarget.closest('[data-items]');
  if (!container) return;
  container.classList.remove("is-drag-over");
  const colId = (ev.dataTransfer && ev.dataTransfer.getData("text/plain")) || detailDesignerDragState?.colId;
  if (!colId) return;
  const beforeItem = ev.target.closest(".detail-item");
  const beforeId = beforeItem?.dataset.col || null;
  if (container.dataset.items === "selected") {
    if (beforeId === colId) return;
    insertColumnIntoDesigner(colId, beforeId);
  } else {
    removeColumnFromDesigner(colId);
  }
}
function setActiveChip(viewId) {
  $$("#chipbar .chip").forEach(c => c.classList.toggle("is-active", c.dataset.view === viewId));
  if (viewId && viewId !== "contrato") {
    state.lastNonContractView = viewId;
  }
}

/* ===== Aqui eu mostro o resumo dos filtros aplicados para o usuário não se perder ===== */
function renderAppliedFilters() {
  const bar = $("#applied-bar"); if (!bar) return;
  const vals = getFilterValues();
  const items = [];

  const push = (k, v, resetFn) => {
    const chip = document.createElement("div");
    chip.className = "applied-chip";
    chip.innerHTML = `
      <span class="k">${k}</span>
      <span class="v">${v}</span>
      <button type="button" title="Limpar" class="applied-x" aria-label="Remover ${k}"><i class="ti ti-x"></i></button>`;
    chip.querySelector("button").addEventListener("click", async () => {
      await withSpinner(async () => {
        resetFn?.();
        applyFiltersAndRender();
        renderAppliedFilters();
        renderCampanhasView();
        if (state.activeView === "ranking") renderRanking();
      }, "Atualizando filtros…");
    });
    items.push(chip);
  };

  bar.innerHTML = "";

  if (vals.segmento && vals.segmento !== "Todos") push("Segmento", vals.segmento, () => $("#f-segmento").selectedIndex = 0);
  if (vals.diretoria && vals.diretoria !== "Todas") {
    const label = $("#f-diretoria")?.selectedOptions?.[0]?.text || vals.diretoria;
    push("Diretoria", label, () => $("#f-diretoria").selectedIndex = 0);
  }
  if (vals.gerencia && vals.gerencia !== "Todas") {
    const label = $("#f-gerencia")?.selectedOptions?.[0]?.text || vals.gerencia;
    push("Gerência", label, () => $("#f-gerencia").selectedIndex = 0);
  }
  if (vals.agencia && vals.agencia !== "Todas") {
    const label = $("#f-agencia")?.selectedOptions?.[0]?.text || vals.agencia;
    push("Agência", label, () => $("#f-agencia").selectedIndex = 0);
  }
  if (vals.ggestao && vals.ggestao !== "Todos") push("Gerente de gestão", vals.ggestao, () => $("#f-ggestao").selectedIndex = 0);
  if (vals.gerente && vals.gerente !== "Todos") {
    const label = $("#f-gerente")?.selectedOptions?.[0]?.text || vals.gerente;
    push("Gerente", label, () => $("#f-gerente").selectedIndex = 0);
  }
  if (vals.secaoId && vals.secaoId !== "Todas") {
    const secaoLabel = $("#f-secao")?.selectedOptions?.[0]?.text
      || getSectionLabel(vals.secaoId)
      || vals.secaoId;
    push("Seção", secaoLabel, () => $("#f-secao").selectedIndex = 0);
  }
  if (vals.familiaId && vals.familiaId !== "Todas") {
    const familiaLabel = $("#f-familia")?.selectedOptions?.[0]?.text
      || FAMILIA_BY_ID.get(vals.familiaId)?.nome
      || vals.familiaId;
    push("Família", familiaLabel, () => $("#f-familia").selectedIndex = 0);
  }
  if (vals.produtoId && vals.produtoId !== "Todos" && vals.produtoId !== "Todas") {
    const prodLabel = $("#f-produto")?.selectedOptions?.[0]?.text
      || PRODUCT_INDEX.get(vals.produtoId)?.name
      || PRODUTOS_DATA.find(p => p.produtoId === vals.produtoId)?.produtoNome
      || vals.produtoId;
    push("Indicador", prodLabel, () => $("#f-produto").selectedIndex = 0);
  }
  if (vals.status && vals.status !== "todos") {
    const statusEntry = getStatusEntry(vals.status);
    const statusLabel = statusEntry?.nome
      || $("#f-status-kpi")?.selectedOptions?.[0]?.text
      || obterRotuloStatus(vals.status);
    push("Status", statusLabel, () => $("#f-status-kpi").selectedIndex = 0);
  }
  if (vals.visao && vals.visao !== "mensal") {
    const visaoEntry = ACCUMULATED_VIEW_OPTIONS.find(opt => opt.value === vals.visao);
    const visaoLabel = visaoEntry?.label || $("#f-visao")?.selectedOptions?.[0]?.text || vals.visao;
    push("Visão", visaoLabel, () => {
      const sel = $("#f-visao");
      if (sel) sel.value = "mensal";
      state.accumulatedView = "mensal";
      syncPeriodFromAccumulatedView("mensal");
    });
  }

  items.forEach(ch => bar.appendChild(ch));
}

const HIERARCHY_FIELDS_DEF = [
  { key: "segmento",  select: "#f-segmento",  defaultValue: "Todos", defaultLabel: "Todos",  idKey: "segmentoId",    labelKey: "segmentoNome",    fallback: () => SEGMENTOS_DATA },
  { key: "diretoria", select: "#f-diretoria", defaultValue: "Todas", defaultLabel: "Todas", idKey: "diretoriaId",   labelKey: "diretoriaNome",   fallback: () => RANKING_DIRECTORIAS },
  { key: "gerencia",  select: "#f-gerencia",  defaultValue: "Todas", defaultLabel: "Todas", idKey: "regionalId",    labelKey: "regionalNome",    fallback: () => RANKING_GERENCIAS },
  { key: "agencia",   select: "#f-agencia",   defaultValue: "Todas", defaultLabel: "Todas", idKey: "agenciaId",     labelKey: "agenciaNome",     fallback: () => RANKING_AGENCIAS },
  { key: "ggestao",   select: "#f-ggestao",   defaultValue: "Todos", defaultLabel: "Todos", idKey: "gerenteGestaoId", labelKey: "gerenteGestaoNome", fallback: () => GERENTES_GESTAO },
  { key: "gerente",   select: "#f-gerente",   defaultValue: "Todos", defaultLabel: "Todos", idKey: "gerenteId",      labelKey: "gerenteNome",      fallback: () => RANKING_GERENTES }
];
const HIERARCHY_FIELD_MAP = new Map(HIERARCHY_FIELDS_DEF.map(field => [field.key, field]));

function hierarchyDefaultSelection(){
  const defaults = {};
  HIERARCHY_FIELDS_DEF.forEach(field => { defaults[field.key] = field.defaultValue; });
  return defaults;
}

function getHierarchyRows(){
  if (Array.isArray(MESU_DATA) && MESU_DATA.length) return MESU_DATA;
  if (MESU_FALLBACK_ROWS.length) return MESU_FALLBACK_ROWS;

  const rows = [];
  const dirMap = new Map(RANKING_DIRECTORIAS.map(dir => [dir.id, dir]));
  const gerMap = new Map(RANKING_GERENCIAS.map(ger => [ger.id, ger]));
  const segMap = new Map(SEGMENTOS_DATA.map(seg => [seg.id || seg.nome, seg]));

  if (RANKING_AGENCIAS.length){
    RANKING_AGENCIAS.forEach(ag => {
      const gerMeta = gerMap.get(ag.gerencia) || {};
      const dirMeta = dirMap.get(gerMeta.diretoria) || {};
      const segKey = dirMeta.segmento || gerMeta.segmentoId || ag.segmento || ag.segmentoId || "";
      const segMeta = segMap.get(segKey) || {};
      const ggMeta = GERENTES_GESTAO.find(gg => gg.agencia === ag.id) || {};
      const gerenteMeta = RANKING_GERENTES.find(ge => ge.agencia === ag.id) || {};
      rows.push({
        segmentoId: segMeta.id || segMeta.nome || segKey || "",
        segmentoNome: segMeta.nome || segMeta.id || segKey || "",
        diretoriaId: dirMeta.id || dirMeta.nome || "",
        diretoriaNome: dirMeta.nome || dirMeta.id || dirMeta.segmento || "",
        regionalId: gerMeta.id || gerMeta.nome || "",
        regionalNome: gerMeta.nome || gerMeta.id || "",
        agenciaId: ag.id,
        agenciaNome: ag.nome || ag.id,
        gerenteGestaoId: ggMeta.id || "",
        gerenteGestaoNome: ggMeta.nome || ggMeta.id || "",
        gerenteId: gerenteMeta.id || "",
        gerenteNome: gerenteMeta.nome || gerenteMeta.id || "",
      });
    });
  }

  if (!rows.length){
    rows.push({
      segmentoId: "",
      segmentoNome: "",
      diretoriaId: "",
      diretoriaNome: "",
      regionalId: "",
      regionalNome: "",
      agenciaId: "",
      agenciaNome: "",
      gerenteGestaoId: "",
      gerenteGestaoNome: "",
      gerenteId: "",
      gerenteNome: "",
    });
  }

  MESU_FALLBACK_ROWS = rows;
  return rows;
}

function getHierarchySelectionFromDOM(){
  const values = hierarchyDefaultSelection();
  HIERARCHY_FIELDS_DEF.forEach(field => {
    const select = $(field.select);
    if (!select) return;
    const value = limparTexto(select.value);
    values[field.key] = value || field.defaultValue;
  });
  return values;
}

function hierarchyRowMatchesField(row, field, value){
  if (!field) return true;
  const def = HIERARCHY_FIELD_MAP.get(field);
  if (!def) return true;
  if (selecaoPadrao(value) || value === def.defaultValue) return true;
  const rowId = limparTexto(row[def.idKey]);
  const rowLabel = limparTexto(row[def.labelKey]);
  return matchesSelection(value, rowId, rowLabel);
}

function filterHierarchyRowsForField(targetField, selection, rows){
  return rows.filter(row => HIERARCHY_FIELDS_DEF.every(field => {
    if (field.key === targetField) return true;
    return hierarchyRowMatchesField(row, field.key, selection[field.key]);
  }));
}

function buildHierarchyOptions(fieldKey, selection, rows){
  const def = HIERARCHY_FIELD_MAP.get(fieldKey);
  if (!def) return [];
  const filtered = filterHierarchyRowsForField(fieldKey, selection, rows);
  const labelIndex = new Map();
  const options = [];

  const register = (value, label) => {
    const safeLabel = limparTexto(label) || limparTexto(value);
    const safeValue = limparTexto(value);
    if (!safeLabel && !safeValue) return;
    const key = simplificarTexto(safeLabel || safeValue);
    if (labelIndex.has(key)) {
      const existing = labelIndex.get(key);
      if (safeValue && safeValue !== existing.value && !existing.aliases.includes(safeValue)) {
        existing.aliases.push(safeValue);
      }
      if (safeLabel && safeLabel !== existing.value && !existing.aliases.includes(safeLabel)) {
        existing.aliases.push(safeLabel);
      }
      return;
    }
    const optionValue = safeValue || safeLabel;
    const entry = {
      value: optionValue,
      label: safeLabel || optionValue,
      aliases: []
    };
    if (safeLabel && safeLabel !== optionValue) entry.aliases.push(safeLabel);
    if (safeValue && safeValue !== optionValue) entry.aliases.push(safeValue);
    labelIndex.set(key, entry);
    options.push(entry);
  };

  filtered.forEach(row => {
    const value = row[def.idKey] || row[def.labelKey];
    const label = row[def.labelKey] || row[def.idKey];
    register(value, label);
  });

  if (!options.length && typeof def.fallback === "function") {
    const fallback = def.fallback() || [];
    fallback.forEach(item => {
      const value = item?.id ?? item?.value ?? item?.nome ?? item?.name;
      const label = item?.nome ?? item?.name ?? item?.label ?? item?.id ?? item?.value;
      register(value, label);
    });
  }

  options.sort((a,b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
  const defaultEntry = {
    value: def.defaultValue,
    label: def.defaultLabel,
    aliases: [def.defaultValue]
  };
  return [defaultEntry].concat(options);
}

function setSelectOptions(select, options, desiredValue, defaultValue){
  const current = limparTexto(desiredValue);
  select.innerHTML = "";
  let chosen = null;
  options.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
    if (!chosen && optionMatchesValue(opt, current)) {
      chosen = opt;
    }
  });
  if (!chosen) {
    chosen = options.find(opt => optionMatchesValue(opt, defaultValue)) || options[0] || null;
  }
  const nextValue = chosen ? chosen.value : "";
  select.value = nextValue;
  if (select.value !== nextValue) {
    select.selectedIndex = 0;
  }
  if (select.dataset.search === "true") {
    ensureSelectSearch(select);
    storeSelectSearchOptions(select, options);
    syncSelectSearchInput(select);
  }
  return select.value || nextValue;
}

function ensureSelectSearchGlobalListeners(){
  if (SELECT_SEARCH_GLOBAL_LISTENERS) return;
  document.addEventListener("click", (ev) => {
    SELECT_SEARCH_REGISTRY.forEach(data => {
      if (data.wrapper?.contains(ev.target)) return;
      if (typeof data.hidePanel === "function") data.hidePanel();
    });
  });
  SELECT_SEARCH_GLOBAL_LISTENERS = true;
}

function ensureSelectSearch(select){
  if (!select || select.dataset.searchBound === "1" || select.dataset.search !== "true") return;
  const group = select.closest(".filters__group");
  if (!group) return;
  const labelText = limparTexto(group.querySelector("label")?.textContent) || "opção";
  const wrapper = document.createElement("div");
  wrapper.className = "select-search";
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  const panel = document.createElement("div");
  panel.className = "select-search__panel";
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", `Sugestões de ${labelText}`);
  panel.hidden = true;
  panel.innerHTML = `
    <div class="select-search__box">
      <input type="search" class="input input--xs select-search__input" placeholder="Pesquisar ${labelText.toLowerCase()}" aria-label="Pesquisar ${labelText}">
    </div>
    <div class="select-search__results"></div>`;
  wrapper.appendChild(panel);

  const input = panel.querySelector("input");
  const list = panel.querySelector(".select-search__results");
  const hidePanel = () => {
    panel.hidden = true;
    wrapper.classList.remove("is-open");
  };
  const showPanel = () => {
    panel.hidden = false;
    wrapper.classList.add("is-open");
    updateSelectSearchResults(select, { limit: 12, forceAll: true });
    window.requestAnimationFrame(() => input.focus());
  };

  const data = { select, input, panel, list, options: [], wrapper, hidePanel, showPanel };
  SELECT_SEARCH_DATA.set(select, data);
  SELECT_SEARCH_REGISTRY.add(data);
  ensureSelectSearchGlobalListeners();

  input.addEventListener("input", () => updateSelectSearchResults(select));
  input.addEventListener("focus", () => updateSelectSearchResults(select));
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      input.value = "";
      hidePanel();
    }
    if (ev.key === "Enter") {
      const first = list.querySelector(".select-search__item");
      if (first) {
        ev.preventDefault();
        first.click();
      }
    }
  });
  input.addEventListener("blur", () => setTimeout(hidePanel, 120));

  panel.addEventListener("mousedown", (ev) => ev.preventDefault());
  panel.addEventListener("click", (ev) => {
    const item = ev.target.closest(".select-search__item");
    if (!item) return;
    ev.preventDefault();
    aplicarSelecaoBusca(select, item.dataset.value || item.getAttribute("data-value") || "");
    hidePanel();
  });

  select.addEventListener("mousedown", (ev) => {
    ev.preventDefault();
    if (panel.hidden) showPanel(); else hidePanel();
  });
  select.addEventListener("keydown", (ev) => {
    if (["ArrowDown", "ArrowUp", " ", "Enter"].includes(ev.key)) {
      ev.preventDefault();
      showPanel();
    }
  });
  select.addEventListener("change", () => {
    const meta = SELECT_SEARCH_DATA.get(select);
    if (!meta) return;
    meta.input.value = "";
    meta.hidePanel();
  });

  select.dataset.searchBound = "1";
}

function storeSelectSearchOptions(select, options){
  const data = SELECT_SEARCH_DATA.get(select);
  if (!data) return;
  data.options = options.map(opt => ({
    value: opt.value,
    label: opt.label,
    aliases: Array.isArray(opt.aliases) ? opt.aliases.map(item => limparTexto(item)) : []
  }));
  if (data.list) data.list.innerHTML = "";
  if (typeof data.hidePanel === "function") data.hidePanel();
}

function syncSelectSearchInput(select){
  const data = SELECT_SEARCH_DATA.get(select);
  if (!data) return;
  data.input.value = "";
  if (typeof data.hidePanel === "function") data.hidePanel();
}

function updateSelectSearchResults(select, opts = {}){
  const data = SELECT_SEARCH_DATA.get(select);
  if (!data) return;
  const { input, panel, list, options } = data;
  if (!options || !options.length) {
    panel.hidden = true;
    if (list) list.innerHTML = "";
    return;
  }
  const term = simplificarTexto(input.value);
  const base = options.slice();
  const matches = base.filter(opt => {
    if (!term) return true;
    if (simplificarTexto(opt.label).includes(term)) return true;
    return (opt.aliases || []).some(alias => simplificarTexto(alias).includes(term));
  });
  const selected = term ? matches : matches.slice(0, 10);
  const finalList = selected.slice(0, 10);
  if (!finalList.length) {
    if (!term) {
      panel.hidden = true;
      if (list) list.innerHTML = "";
      return;
    }
    if (list) list.innerHTML = `<div class="select-search__empty">Nenhum resultado encontrado</div>`;
    panel.hidden = false;
    return;
  }
  const limit = Number.isFinite(opts.limit) ? opts.limit : 10;
  const rows = finalList.slice(0, limit).map(opt => `<button type="button" class="select-search__item" data-value="${escapeHTML(opt.value)}">${escapeHTML(opt.label)}</button>`).join("\n");
  if (list) list.innerHTML = rows;
  panel.hidden = false;
}

function aplicarSelecaoBusca(select, rawValue){
  const data = SELECT_SEARCH_DATA.get(select);
  if (!data) return;
  const options = data.options || [];
  const match = options.find(opt => optionMatchesValue(opt, rawValue));
  const targetValue = match ? match.value : rawValue;
  select.value = targetValue;
  if (select.value !== targetValue) {
    const fallback = options.find(opt => opt.value === targetValue);
    if (!fallback) select.selectedIndex = 0;
  }
  data.input.value = "";
  if (typeof data.hidePanel === "function") data.hidePanel();
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function refreshHierarchyCombos(opts = {}){
  const rows = getHierarchyRows();
  const baseSelection = { ...hierarchyDefaultSelection(), ...getHierarchySelectionFromDOM(), ...(opts.selection || {}) };
  const result = { ...baseSelection };
  HIERARCHY_FIELDS_DEF.forEach(field => {
    const select = $(field.select);
    if (!select) return;
    const options = buildHierarchyOptions(field.key, result, rows);
    const chosen = setSelectOptions(select, options, result[field.key], field.defaultValue);
    result[field.key] = chosen;
  });
  return result;
}

function adjustHierarchySelection(selection, changedField){
  const def = HIERARCHY_FIELD_MAP.get(changedField);
  if (!def) return selection;
  const value = limparTexto(selection[changedField]);
  const effective = value || def.defaultValue;
  selection[changedField] = effective;

  const setIf = (key, next) => {
    if (!next) return;
    const meta = HIERARCHY_FIELD_MAP.get(key);
    const normalized = limparTexto(next);
    if (!meta) return;
    selection[key] = normalized || meta.defaultValue;
  };

  if (changedField === "agencia" && effective !== def.defaultValue){
    const meta = findAgenciaMeta(effective) || {};
    setIf("gerencia", meta.gerencia || meta.regionalId || meta.regional);
    setIf("diretoria", meta.diretoria || meta.diretoriaId);
    setIf("segmento", meta.segmento || meta.segmentoId);
  }

  if (changedField === "gerencia" && effective !== def.defaultValue){
    const meta = findGerenciaMeta(effective) || {};
    setIf("diretoria", meta.diretoria);
    setIf("segmento", meta.segmentoId);
  }

  if (changedField === "diretoria" && effective !== def.defaultValue){
    const meta = findDiretoriaMeta(effective) || {};
    setIf("segmento", meta.segmento);
  }

  if (changedField === "ggestao" && effective !== def.defaultValue){
    const meta = findGerenteGestaoMeta(effective) || {};
    setIf("agencia", meta.agencia);
    setIf("gerencia", meta.gerencia);
    setIf("diretoria", meta.diretoria);
    const agMeta = meta.agencia ? (findAgenciaMeta(meta.agencia) || {}) : {};
    setIf("segmento", agMeta.segmento || agMeta.segmentoId);
  }

  if (changedField === "gerente" && effective !== def.defaultValue){
    const meta = findGerenteMeta(effective) || {};
    setIf("agencia", meta.agencia);
    setIf("gerencia", meta.gerencia);
    setIf("diretoria", meta.diretoria);
    const agMeta = meta.agencia ? (findAgenciaMeta(meta.agencia) || {}) : {};
    setIf("segmento", agMeta.segmento || agMeta.segmentoId);
  }

  return selection;
}

function handleHierarchySelectionChange(changedField){
  const selection = adjustHierarchySelection(getHierarchySelectionFromDOM(), changedField);
  refreshHierarchyCombos({ selection });
}

/* ===== Aqui eu organizo os filtros superiores (diretoria, agência etc.) ===== */
function ensureSegmentoField() {
  if ($("#f-segmento")) return;
  const filters = $(".filters");
  if (!filters) return;
  const actions = filters.querySelector(".filters__actions");
  const wrap = document.createElement("div");
  wrap.className = "filters__group";
  wrap.innerHTML = `<label>Segmento</label><select id="f-segmento" class="input"></select>`;
  filters.insertBefore(wrap, actions);
}
function getFilterValues() {
  const val = (sel) => $(sel)?.value || "";
  const statusSelect = $("#f-status-kpi");
  const statusOption = statusSelect?.selectedOptions?.[0] || null;
  const statusKey = statusOption?.dataset.statusKey || normalizarChaveStatus(statusSelect?.value) || (statusSelect?.value || "");
  const statusCodigo = statusOption?.dataset.statusCodigo || statusOption?.value || "";
  const statusId = statusOption?.dataset.statusId || statusCodigo || "";
  return {
    segmento: val("#f-segmento"),
    diretoria: val("#f-diretoria"),
    gerencia:  val("#f-gerencia"),
    agencia:   val("#f-agencia"),
    ggestao:   val("#f-ggestao"),
    gerente:   val("#f-gerente"),
    secaoId:   val("#f-secao"),
    familiaId: val("#f-familia"),
    produtoId: val("#f-produto"),
    status:    statusKey || "todos",
    statusCodigo,
    statusId,
    visao:     val("#f-visao") || state.accumulatedView || "mensal",
  };
}

/* ===== Aqui eu construo a busca por contrato com autocomplete ===== */
function rowMatchesSearch(r, term) {
  if (!term) return true;
  const t = term.toLowerCase();
  const contracts = ensureContracts(r);
  return contracts.some(c => (c.id || "").toLowerCase().includes(t));
}

/* ===== Aqui eu aplico o filtro base que decide o que aparece em cada visão ===== */
function filterRowsExcept(rows, except = {}, opts = {}) {
  const f = getFilterValues();
  const {
    searchTerm: searchRaw = "",
    dateStart,
    dateEnd,
    ignoreDate = false,
  } = opts;
  const searchTerm = searchRaw.trim();
  const startISO = ignoreDate ? "" : (dateStart ?? state.period.start);
  const endISO = ignoreDate ? "" : (dateEnd ?? state.period.end);

  return rows.filter(r => {
    const okSeg = selecaoPadrao(f.segmento) || matchesSelection(f.segmento, r.segmento, r.segmentoId, r.segmentoNome);
    const okDR  = (except.diretoria) || selecaoPadrao(f.diretoria) || matchesSelection(f.diretoria, r.diretoria, r.diretoriaNome);
    const okGR  = (except.gerencia)  || selecaoPadrao(f.gerencia)  || matchesSelection(f.gerencia, r.gerenciaRegional, r.gerenciaNome, r.regional);
    const okAg  = (except.agencia)   || selecaoPadrao(f.agencia)   || matchesSelection(f.agencia, r.agencia, r.agenciaNome, r.agenciaCodigo);
    const okGG  = selecaoPadrao(f.ggestao) || matchesSelection(f.ggestao, r.gerenteGestao, r.gerenteGestaoNome);
    const okGer = (except.gerente)   || selecaoPadrao(f.gerente)   || matchesSelection(f.gerente, r.gerente, r.gerenteNome);
    const familiaMetaRow = r.produtoId ? PRODUTO_TO_FAMILIA.get(r.produtoId) : null;
    const rowSecaoId = r.secaoId
      || familiaMetaRow?.secaoId
      || (r.produtoId ? PRODUCT_INDEX.get(r.produtoId)?.sectionId : "")
      || (SECTION_IDS.has(r.familiaId) ? r.familiaId : "");
    const okSec = selecaoPadrao(f.secaoId) || matchesSelection(f.secaoId, rowSecaoId, r.secaoId, r.secaoNome, r.secao, getSectionLabel(rowSecaoId));
    const okFam = selecaoPadrao(f.familiaId) || matchesSelection(f.familiaId, r.familiaId, r.familia);
    const okProd= selecaoPadrao(f.produtoId) || matchesSelection(f.produtoId, r.produtoId, r.produtoNome, r.produto, r.prodOrSub, r.subproduto);
    let rowDate = r.data || r.competencia || "";
    if (rowDate && typeof rowDate !== "string") {
      if (rowDate instanceof Date) {
        rowDate = isoFromUTCDate(rowDate);
      } else {
        rowDate = String(rowDate);
      }
    }
    const okDt  = (!startISO || !rowDate || rowDate >= startISO) && (!endISO || !rowDate || rowDate <= endISO);

    const ating = r.meta ? (r.realizado / r.meta) : 0;
    const statusKey = normalizarChaveStatus(f.status) || "todos";
    let okStatus = true;
    if (statusKey === "atingidos") {
      okStatus = ating >= 1;
    } else if (statusKey === "nao") {
      okStatus = ating < 1;
    }

    const okSearch = rowMatchesSearch(r, searchTerm);

    return okSeg && okDR && okGR && okAg && okGG && okGer && okSec && okFam && okProd && okDt && okStatus && okSearch;
  });
}
function filterRows(rows) { return filterRowsExcept(rows, {}, { searchTerm: state.tableSearchTerm }); }

function autoSnapViewToFilters() {
  if (state.tableSearchTerm) return;
  const f = getFilterValues();
  let snap = null;
  if (f.produtoId && f.produtoId !== "Todos" && f.produtoId !== "Todas") snap = "prodsub";
  else if (f.familiaId && f.familiaId !== "Todas") snap = "familia";
  else if (f.secaoId && f.secaoId !== "Todas") snap = "secao";
  else if (f.gerente && f.gerente !== "Todos") snap = "gerente";
  else if (f.gerencia && f.gerencia !== "Todas") snap = "gerencia";
  else if (f.diretoria && f.diretoria !== "Todas") snap = "diretoria";
  if (snap && state.tableView !== snap) { state.tableView = snap; setActiveChip(snap); }
}

/* ===== Aqui eu monto a árvore da tabela detalhada ===== */
function ensureContracts(r) {
  if (r._contracts) return r._contracts;
  const n = 2 + Math.floor(Math.random() * 3), arr = [];
  const periodYear = Number((state.period?.start || todayISO()).slice(0,4)) || new Date().getFullYear();
  const totalPeso = Math.max(0, toNumber(r.peso ?? r.pontosMeta ?? 0));
  const totalPontos = Math.max(0, toNumber(r.pontosBrutos ?? r.pontos ?? r.pontosCumpridos ?? 0));
  let pesoDistribuido = 0;
  let pontosDistribuidos = 0;
  for (let i = 0; i < n; i++) {
    const id = `CT-${periodYear}-${String(Math.floor(1e6 + Math.random() * 9e6)).padStart(7, "0")}`;
    const valor = Math.round((r.realizado / n) * (0.6 + Math.random() * 0.9)),
          meta  = Math.round((r.meta       / n) * (0.6 + Math.random() * 0.9));
    const sp = r.subproduto || r.produto;
    const canalVenda = r.canalVenda || (Math.random() > .5 ? "Agência física" : "Digital");
    const tipoVenda = r.tipoVenda || (Math.random() > .5 ? "Venda consultiva" : "Venda direta");
    const modalidadePagamento = r.modalidadePagamento || (Math.random() > .5 ? "À vista" : "Parcelado");
    const baseISO = r.data || todayISO();
    const baseDateUTC = dateUTCFromISO(baseISO);
    const dueDateUTC = new Date(baseDateUTC);
    dueDateUTC.setUTCDate(dueDateUTC.getUTCDate() + 10 + Math.floor(Math.random() * 25));
    const dataVencimento = isoFromUTCDate(dueDateUTC);
    let dataCancelamento = "";
    let motivoCancelamento = "";
    if (Math.random() < 0.25) {
      const cancelDateUTC = new Date(dueDateUTC);
      cancelDateUTC.setUTCDate(cancelDateUTC.getUTCDate() - Math.floor(Math.random() * 6));
      dataCancelamento = isoFromUTCDate(cancelDateUTC);
      motivoCancelamento = MOTIVOS_CANCELAMENTO[Math.floor(Math.random() * MOTIVOS_CANCELAMENTO.length)];
    }
    const restantes = n - i;
    const pesoShare = restantes === 1 ? Math.max(0, totalPeso - pesoDistribuido) : (totalPeso / n);
    pesoDistribuido += pesoShare;
    const pontosShareBrutos = restantes === 1 ? Math.max(0, totalPontos - pontosDistribuidos) : (totalPontos / n);
    pontosDistribuidos += pontosShareBrutos;
    const pontosShare = Math.max(0, Math.min(pesoShare, pontosShareBrutos));
    arr.push({
      id,
      produto: r.produto,
      subproduto: r.subproduto || "",
      prodOrSub: sp,
      qtd: 1,
      realizado: valor,
      meta,
      ating: meta ? (valor / meta) : 0,
      data: r.data,
      peso: pesoShare,
      pontosMeta: pesoShare,
      pontos: pontosShare,
      pontosBrutos: pontosShareBrutos,
      canalVenda,
      tipoVenda,
      modalidadePagamento,
      gerente: r.gerenteNome || r.gerente,
      dataVencimento,
      dataCancelamento,
      motivoCancelamento
    });
  }
  r._contracts = arr; return arr;
}

const TREE_LEVEL_LABEL_RESOLVERS = {
  diretoria: (row) => row.diretoriaNome || row.diretoria || "—",
  gerencia:  (row) => row.regional || row.gerenciaNome || row.gerenciaRegional || "—",
  agencia:   (row) => row.agenciaNome || row.agencia || "—",
  gGestao:   (row) => row.gerenteGestaoNome || row.gerenteGestao || "—",
  gerente:   (row) => row.gerenteNome || row.gerente || "—",
  secao:     (row) => row.secaoNome || row.secao || getSectionLabel(row.secaoId) || "—",
  familia:   (row) => row.familia || "—",
  prodsub:   (row) => row.prodOrSub || row.produto || row.subproduto || "—"
};

function resolveTreeLabel(levelKey, subset, fallback) {
  if (!Array.isArray(subset) || !subset.length) return fallback;
  const resolver = TREE_LEVEL_LABEL_RESOLVERS[levelKey];
  if (!resolver) return fallback;
  const label = resolver(subset[0]);
  return label != null && label !== "" ? label : fallback;
}
function buildTree(list, startKey) {
  const keyMap = { diretoria:"diretoria", gerencia:"gerenciaRegional", agencia:"agencia", gGestao:"gerenteGestao", gerente:"gerente", secao:"secaoId", familia:"familia", prodsub:"prodOrSub", produto:"prodOrSub", contrato:"contrato" };
  const NEXT   = { diretoria:"gerencia",  gerencia:"agencia",         agencia:"gGestao", gGestao:"gerente",       gerente:"secao", secao:"familia", familia:"contrato",   prodsub:"contrato", contrato:null };

  const periodStart = state.period?.start || "";
  const periodEnd = state.period?.end || "";
  const diasTotais = businessDaysBetweenInclusive(periodStart, periodEnd);
  const diasDecorridos = businessDaysElapsedUntilToday(periodStart, periodEnd);
  const diasRestantes = Math.max(0, diasTotais - diasDecorridos);

  function group(arr, key){
    const m = new Map();
    arr.forEach(r => { const k = r[key] || "—"; const a = m.get(k) || []; a.push(r); m.set(k, a); });
    return [...m.entries()];
  }
  function agg(arr){
    const realizado = arr.reduce((a,b)=>a+(b.realizado||0),0),
          meta      = arr.reduce((a,b)=>a+(b.meta||0),0),
          qtd       = arr.reduce((a,b)=>a+(b.qtd||0),0),
          data      = arr.reduce((mx,b)=> b.data>mx?b.data:mx, "0000-00-00"),
          peso      = arr.reduce((a,b)=>a+Math.max(0, toNumber(b.peso ?? b.pontosMeta ?? 0)),0),
          pontosBr  = arr.reduce((a,b)=>a+Math.max(0, toNumber(b.pontosBrutos ?? b.pontos ?? 0)),0);
    const pontos = Math.max(0, Math.min(peso, pontosBr));
    const metaDiaria = diasTotais > 0 ? (meta / diasTotais) : 0;
    const referenciaHoje = diasDecorridos > 0 ? Math.min(meta, metaDiaria * diasDecorridos) : 0;
    const metaDiariaNecessaria = diasRestantes > 0 ? Math.max(0, (meta - realizado) / diasRestantes) : 0;
    const projecao = diasDecorridos > 0 ? (realizado / diasDecorridos) * diasTotais : realizado;
    return {
      realizado,
      meta,
      qtd,
      ating: meta? realizado/meta : 0,
      data,
      peso,
      pontos,
      pontosMeta: peso,
      pontosBrutos: pontosBr,
      metaDiaria,
      referenciaHoje,
      metaDiariaNecessaria,
      projecao
    };
  }

  function buildDetailGroups(arr){
    const map = new Map();
    arr.forEach(r => {
      const canal = r.canalVenda || "Canal não informado";
      const tipo = r.tipoVenda || "Tipo não informado";
      const gerente = r.gerente || "—";
      const modalidade = r.modalidadePagamento || (r.subproduto || "Modalidade não informada");
      const key = `${canal}|${tipo}|${gerente}|${modalidade}`;
      const bucket = map.get(key) || [];
      bucket.push(r);
      map.set(key, bucket);
    });
    return [...map.entries()].map(([comboKey, subset]) => {
      const [canal, tipo, gerente, modalidade] = comboKey.split("|");
      const a = agg(subset);
      const dataVencimento = subset.reduce((curr, item) => {
        if (!item.dataVencimento) return curr;
        return !curr || item.dataVencimento > curr ? item.dataVencimento : curr;
      }, "");
      const dataCancelamento = subset.reduce((curr, item) => {
        if (!item.dataCancelamento) return curr;
        return !curr || item.dataCancelamento > curr ? item.dataCancelamento : curr;
      }, "");
      const motivoCancelamento = subset.reduce((curr, item) => curr || item.motivoCancelamento || "", "");
      return {
        canal,
        tipo,
        gerente,
        modalidade,
        realizado: a.realizado,
        meta: a.meta,
        qtd: a.qtd,
        ating: a.ating,
        data: a.data,
        dataVencimento,
        dataCancelamento,
        motivoCancelamento
      };
    }).sort((a,b)=> (b.realizado||0) - (a.realizado||0));
  }

  function buildLevel(arr, levelKey, level, lineage = []){
    if (levelKey === "contrato") {
      return arr.flatMap(r => ensureContracts(r).map(c => {
        const detailGroups = buildDetailGroups([c]);
        const detailBase = detailGroups[0] || null;
        const detail = detailBase ? {
          canal: detailBase.canal,
          tipo: detailBase.tipo,
          gerente: detailBase.gerente,
          modalidade: detailBase.modalidade
        } : null;
        const diariaContrato = diasTotais > 0 ? (c.meta / diasTotais) : 0;
        const entryMeta = { levelKey, groupField: "contrato", value: c.id, label: c.id };
        const nextLineage = [...lineage, entryMeta];
        const breadcrumb = nextLineage.map(item => item.label || item.value).filter(Boolean);
        return {
          type:"contrato",
          level,
          label:c.id,
          realizado:c.realizado,
          meta:c.meta,
          qtd:c.qtd,
          ating:c.ating,
          data:c.data,
          metaDiaria: diariaContrato,
          referenciaHoje: diasDecorridos > 0 ? Math.min(c.meta, diariaContrato * diasDecorridos) : 0,
          metaDiariaNecessaria: diasRestantes > 0 ? Math.max(0, (c.meta - c.realizado) / diasRestantes) : 0,
          projecao: diasDecorridos > 0 ? (c.realizado / Math.max(diasDecorridos, 1)) * diasTotais : c.realizado,
          detail,
          detailGroups,
          levelKey,
          groupField:"contrato",
          groupValue:c.id,
          lineage: nextLineage.map(item => ({ ...item })),
          breadcrumb,
          children:[]
        };
      }));
    }
    const mapKey = keyMap[levelKey] || levelKey;
    return group(arr, mapKey).map(([k, subset]) => {
      const a = agg(subset), next = NEXT[levelKey];
      const labelText = resolveTreeLabel(levelKey, subset, k);
      const entryMeta = { levelKey, groupField: mapKey, value: k, label: labelText };
      const nextLineage = [...lineage, entryMeta];
      const breadcrumb = nextLineage.map(item => item.label || item.value).filter(Boolean);
      return {
        type:"grupo", level, label:labelText, realizado:a.realizado, meta:a.meta, qtd:a.qtd, ating:a.ating, data:a.data,
        peso:a.peso, pontos:a.pontos, pontosMeta:a.pontosMeta, pontosBrutos:a.pontosBrutos,
        metaDiaria:a.metaDiaria, referenciaHoje:a.referenciaHoje, metaDiariaNecessaria:a.metaDiariaNecessaria, projecao:a.projecao,
        breadcrumb,
        detailGroups: [],
        levelKey,
        groupField: mapKey,
        groupValue: k,
        lineage: nextLineage.map(item => ({ ...item })),
        children: next ? buildLevel(subset, next, level+1, nextLineage) : []
      };
    });
  }
  return buildLevel(list, startKey, 0, []);
}

function getContractSearchInput(){
  return document.getElementById("busca");
}

function getContractSuggestPanel(){
  return document.getElementById("contract-suggest");
}

function bindContractSuggestOutsideClick(){
  if (contractSuggestDocBound) return;
  const closeIfOutside = (event) => {
    const wrap = document.querySelector(".card__search-autocomplete");
    if (!wrap) return;
    if (!wrap.contains(event.target)) closeContractSuggestions();
  };
  document.addEventListener("click", closeIfOutside);
  window.addEventListener("resize", closeContractSuggestions);
  document.addEventListener("scroll", closeContractSuggestions, true);
  contractSuggestDocBound = true;
}

function wireContractSuggestionPanel(){
  if (contractSuggestPanelBound) return;
  const panel = getContractSuggestPanel();
  if (!panel) return;
  panel.addEventListener("pointerdown", (event) => {
    const item = event.target.closest?.(".contract-suggest__item");
    if (!item) return;
    event.preventDefault();
    const value = item.dataset.value || item.getAttribute("data-value") || item.textContent || "";
    chooseContractSuggestion(value);
  });
  contractSuggestPanelBound = true;
}

function highlightContractTerm(text, term){
  const value = String(text || "");
  const lower = value.toLowerCase();
  const needle = term.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return escapeHTML(value);
  const before = escapeHTML(value.slice(0, idx));
  const match = escapeHTML(value.slice(idx, idx + term.length));
  const after = escapeHTML(value.slice(idx + term.length));
  return `${before}<mark>${match}</mark>${after}`;
}

function closeContractSuggestions(){
  const panel = getContractSuggestPanel();
  const input = getContractSearchInput();
  if (panel) {
    panel.hidden = true;
    panel.innerHTML = "";
  }
  if (input) {
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  contractSuggestState.open = false;
  contractSuggestState.items = [];
  contractSuggestState.highlight = -1;
}

function setContractSuggestionHighlight(index){
  const panel = getContractSuggestPanel();
  const input = getContractSearchInput();
  if (!panel || !contractSuggestState.open) return;
  const items = panel.querySelectorAll(".contract-suggest__item");
  if (!items.length) {
    contractSuggestState.highlight = -1;
    input?.removeAttribute("aria-activedescendant");
    return;
  }
  let next = index;
  if (next < 0) next = items.length - 1;
  if (next >= items.length) next = 0;
  contractSuggestState.highlight = next;
  items.forEach((btn, i) => {
    const highlighted = i === next;
    btn.classList.toggle("is-highlight", highlighted);
    btn.setAttribute("aria-selected", highlighted ? "true" : "false");
    const id = `contract-opt-${i}`;
    btn.id = id;
    if (highlighted && input) {
      input.setAttribute("aria-activedescendant", id);
      const top = btn.offsetTop;
      const bottom = top + btn.offsetHeight;
      if (top < panel.scrollTop) panel.scrollTop = top;
      else if (bottom > panel.scrollTop + panel.clientHeight) panel.scrollTop = bottom - panel.clientHeight;
    }
  });
}

function moveContractSuggestionHighlight(delta){
  if (!contractSuggestState.open) return;
  const panel = getContractSuggestPanel();
  if (!panel || panel.hidden) return;
  const items = panel.querySelectorAll(".contract-suggest__item");
  if (!items.length) return;
  const next = contractSuggestState.highlight + delta;
  setContractSuggestionHighlight(next);
}

function getHighlightedContractSuggestion(){
  if (!contractSuggestState.open) return null;
  const idx = contractSuggestState.highlight;
  if (idx < 0) return null;
  return contractSuggestState.items[idx] || null;
}

function chooseContractSuggestion(value){
  const input = getContractSearchInput();
  const term = (value || "").trim();
  if (input) {
    input.value = term;
    input.focus();
  }
  closeContractSuggestions();
  requestAnimationFrame(() => {
    if (term) commitContractSearch(term);
    else commitContractSearch("", { showSpinner: true });
  });
}

function refreshContractSuggestions(query = ""){
  const input = getContractSearchInput();
  const panel = getContractSuggestPanel();
  if (!input || !panel) return;
  bindContractSuggestOutsideClick();
  wireContractSuggestionPanel();

  const term = (query || "").trim();
  contractSuggestState.term = term;
  if (!term){
    closeContractSuggestions();
    return;
  }

  const list = Array.isArray(state.contractIndex) ? state.contractIndex : [];
  const lowered = term.toLowerCase();
  const matches = list.filter(id => id.toLowerCase().includes(lowered)).slice(0, 12);

  if (!matches.length){
    contractSuggestState.items = [];
    contractSuggestState.highlight = -1;
    contractSuggestState.open = true;
    panel.innerHTML = `<div class="contract-suggest__empty">Nenhum contrato encontrado</div>`;
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.removeAttribute("aria-activedescendant");
    return;
  }

  contractSuggestState.items = matches;
  contractSuggestState.highlight = -1;
  contractSuggestState.open = true;
  panel.innerHTML = matches.map((id, index) => `
    <button type="button" class="contract-suggest__item" role="option" aria-selected="false" data-index="${index}" data-value="${escapeHTML(id)}">
      <span>${highlightContractTerm(id, term)}</span>
      <span class="contract-suggest__meta">Filtrar</span>
    </button>
  `).join("");
  panel.hidden = false;
  panel.scrollTop = 0;
  input.setAttribute("aria-expanded", "true");
  input.removeAttribute("aria-activedescendant");
}

function updateContractAutocomplete(){
  const input = getContractSearchInput();
  if (!input) return;
  bindContractSuggestOutsideClick();
  wireContractSuggestionPanel();

  const ids = new Set();
  (state._rankingRaw || []).forEach(row => {
    ensureContracts(row).forEach(contract => {
      if (contract?.id) ids.add(contract.id);
    });
  });

  state.contractIndex = [...ids].sort();
  if (input.value) refreshContractSuggestions(input.value);
  else closeContractSuggestions();
}

function setContractSearchLoading(isLoading){
  const wrap = document.querySelector(".card__search-autocomplete");
  if (!wrap) return;
  wrap.classList.toggle("is-loading", Boolean(isLoading));
}

async function commitContractSearch(rawTerm, opts = {}) {
  const { showSpinner = true } = opts || {};
  const term = (rawTerm || "").trim();

  contractSuggestState.pending = term;
  const run = async () => {
    if (term) {
      if (state.tableView !== "contrato") {
        state.lastNonContractView = state.tableView;
      }
      state.tableView = "contrato";
      setActiveChip("contrato");
    } else if (state.tableView === "contrato") {
      const fallback = state.lastNonContractView && state.lastNonContractView !== "contrato"
        ? state.lastNonContractView
        : "diretoria";
      state.tableView = fallback;
      setActiveChip(state.tableView);
    }

    state.tableSearchTerm = term;
    closeContractSuggestions();
    await Promise.resolve(applyFiltersAndRender());
    if (!term) refreshContractSuggestions("");
  };

  const label = term ? "Filtrando contratos…" : "Atualizando tabela…";

  if (showSpinner) {
    await withSpinner(async () => {
      setContractSearchLoading(true);
      try {
        await run();
      } finally {
        setContractSearchLoading(false);
        contractSuggestState.pending = null;
      }
    }, label);
  } else {
    setContractSearchLoading(true);
    try {
      await run();
    } finally {
      setContractSearchLoading(false);
      contractSuggestState.pending = null;
    }
  }
}

/* ===== Aqui eu cuido das interações gerais de UI que não se encaixaram em outro bloco ===== */
function initCombos() {
  ensureSegmentoField();

  const fill = (sel, arr) => {
    const el = $(sel); if (!el) return;
    const current = el.value;
    el.innerHTML = "";
    arr.forEach(v => {
      const o = document.createElement("option");
      o.value = v.value;
      o.textContent = v.label;
      el.appendChild(o);
    });
    if (arr.some(opt => opt.value === current)) {
      el.value = current;
    }
    if (el.dataset.search === "true") {
      ensureSelectSearch(el);
      const options = arr.map(opt => ({
        value: opt.value,
        label: opt.label,
        aliases: Array.isArray(opt.aliases) ? opt.aliases : [],
      }));
      storeSelectSearchOptions(el, options);
      syncSelectSearchInput(el);
    }
  };

  const compareLabels = (a, b) => String(a.label || "").localeCompare(String(b.label || ""), "pt-BR", { sensitivity: "base" });
  const dedupeOptions = (items, valueGetter, labelGetter) => {
    const seenValues = new Set();
    const seenLabels = new Set();
    const list = [];
    items.forEach(item => {
      const rawValue = valueGetter(item);
      const rawLabel = labelGetter(item);
      const value = limparTexto(rawValue) || limparTexto(rawLabel);
      const label = rawLabel != null && rawLabel !== ""
        ? String(rawLabel).trim()
        : (value || "");
      if (!value || !label) return;
      const valueKey = value.toLowerCase();
      const labelKey = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (seenValues.has(valueKey) || seenLabels.has(labelKey)) return;
      seenValues.add(valueKey);
      seenLabels.add(labelKey);
      list.push({ value, label });
    });
    list.sort(compareLabels);
    return list;
  };

  refreshHierarchyCombos();

  [
    { key: "segmento",  selector: "#f-segmento" },
    { key: "diretoria", selector: "#f-diretoria" },
    { key: "gerencia",  selector: "#f-gerencia" },
    { key: "agencia",   selector: "#f-agencia" },
    { key: "ggestao",   selector: "#f-ggestao" },
    { key: "gerente",   selector: "#f-gerente" },
  ].forEach(({ key, selector }) => {
    const el = $(selector);
    if (!el || el.dataset.hierBound) return;
    el.dataset.hierBound = "1";
    el.addEventListener("change", () => handleHierarchySelectionChange(key));
  });

  const secaoOptions = [{ value: "Todas", label: "Todas" }].concat(
    CARD_SECTIONS_DEF.map(sec => ({ value: sec.id, label: sec.label }))
  );
  fill("#f-secao", secaoOptions);

  const familiaOptionsRaw = [{ value: "Todas", label: "Todas", aliases: ["Todas"] }].concat(
    dedupeOptions(
      FAMILIA_DATA,
      f => f?.id,
      f => f?.nome || f?.id
    )
  );
  const familiaOptions = familiaOptionsRaw
    .filter(opt => opt.value === "Todas" || !SECTION_IDS.has(opt.value))
    .map(opt => ({
      ...opt,
      aliases: Array.isArray(opt.aliases) ? opt.aliases : [opt.label, opt.value],
    }));
  fill("#f-familia", familiaOptions);

  const buildProdutoOptions = (familiaId, secaoId) => {
    const options = [{ value: "Todos", label: "Todos" }];
    const filtroSecao = secaoId && secaoId !== "Todas" ? secaoId : "";
    const added = new Set();
    const consider = (prod) => {
      if (!prod || !prod.id || added.has(prod.id)) return;
      if (filtroSecao) {
        const meta = PRODUCT_INDEX.get(prod.id);
        const familiaMeta = PRODUTO_TO_FAMILIA.get(prod.id);
        const prodSecao = meta?.sectionId || familiaMeta?.secaoId || "";
        if (prodSecao !== filtroSecao) return;
      }
      const aliasSet = CARD_ALIAS_INDEX.get(prod.id);
      const aliasList = new Set(Array.isArray(prod.aliases) ? prod.aliases : []);
      if (aliasSet instanceof Set) {
        aliasSet.forEach(item => aliasList.add(item));
      }
      aliasList.add(prod.id);
      if (prod.nome) aliasList.add(prod.nome);
      options.push({ value: prod.id, label: prod.nome || prod.id, aliases: Array.from(aliasList) });
      added.add(prod.id);
    };
    if (!familiaId || familiaId === "Todas") {
      PRODUTOS_BY_FAMILIA.forEach(list => list.forEach(consider));
    } else {
      const list = PRODUTOS_BY_FAMILIA.get(familiaId) || [];
      list.forEach(consider);
    }
    return options;
  };

  const familiaSelect = $("#f-familia");
  const secaoSelect = $("#f-secao");
  const initialFamilia = familiaSelect ? familiaSelect.value : "Todas";
  const initialSecao = secaoSelect ? secaoSelect.value : "Todas";
  fill("#f-produto", buildProdutoOptions(initialFamilia, initialSecao));

  const updateProdutoSelect = () => {
    const famVal = familiaSelect ? familiaSelect.value : "Todas";
    const secVal = secaoSelect ? secaoSelect.value : "Todas";
    fill("#f-produto", buildProdutoOptions(famVal, secVal));
  };

  if (familiaSelect && !familiaSelect.dataset.bound) {
    familiaSelect.dataset.bound = "1";
    familiaSelect.addEventListener("change", () => {
      updateProdutoSelect();
    });
  }

  if (secaoSelect && !secaoSelect.dataset.bound) {
    secaoSelect.dataset.bound = "1";
    secaoSelect.addEventListener("change", () => {
      updateProdutoSelect();
    });
  }

  updateStatusFilterOptions();

  const visaoSelect = $("#f-visao");
  if (visaoSelect) {
    const current = visaoSelect.value || state.accumulatedView || "mensal";
    visaoSelect.innerHTML = "";
    ACCUMULATED_VIEW_OPTIONS.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      visaoSelect.appendChild(option);
    });
    visaoSelect.value = ACCUMULATED_VIEW_OPTIONS.some(opt => opt.value === current)
      ? current
      : "mensal";
    state.accumulatedView = visaoSelect.value || "mensal";
    syncPeriodFromAccumulatedView(state.accumulatedView);
  }
}
function bindEvents() {
  $("#btn-consultar")?.addEventListener("click", async () => {
    await withSpinner(async () => {
      autoSnapViewToFilters();
      applyFiltersAndRender();
      renderAppliedFilters();
      renderCampanhasView();
      if (state.activeView === "ranking") renderRanking();
    }, "Aplicando filtros…");
    closeMobileFilters();
  });

  $("#btn-abrir-filtros")?.addEventListener("click", () => {
    const adv = $("#advanced-filters");
    const isOpen = adv.classList.toggle("is-open");
    adv.setAttribute("aria-hidden", String(!isOpen));
    $("#btn-abrir-filtros").setAttribute("aria-expanded", String(isOpen));
    $("#btn-abrir-filtros").innerHTML = isOpen
      ? `<i class="ti ti-chevron-up"></i> Fechar filtros`
      : `<i class="ti ti-chevron-down"></i> Abrir filtros`;
    if (isOpen) ensureStatusFilterInAdvanced();
  });

  ensureExtraTabs();

  $$(".tab").forEach(t => {
    t.addEventListener("click", () => {
      if (t.classList.contains("is-active")) return;
      const view = t.dataset.view;
      definirAbaAtiva(view);
      if (view === "table") switchView("table");
      else if (view === "ranking") switchView("ranking");
      else if (view === "exec") switchView("exec");
      else if (view === "campanhas") switchView("campanhas");
      else switchView("cards");
    });
  });

  ["#f-segmento","#f-diretoria","#f-gerencia","#f-agencia","#f-ggestao","#f-gerente","#f-secao","#f-familia","#f-produto","#f-status-kpi"].forEach(sel => {
    $(sel)?.addEventListener("change", async () => {
      await withSpinner(async () => {
        autoSnapViewToFilters();
        applyFiltersAndRender();
        renderAppliedFilters();
        renderCampanhasView();
        if (state.activeView === "ranking") renderRanking();
      }, "Atualizando filtros…");
    });
  });

  const visaoSelect = $("#f-visao");
  if (visaoSelect && !visaoSelect.dataset.bound) {
    visaoSelect.dataset.bound = "1";
    visaoSelect.addEventListener("change", async () => {
      const nextView = visaoSelect.value || "mensal";
      state.accumulatedView = nextView;
      syncPeriodFromAccumulatedView(nextView);
      await withSpinner(async () => {
        autoSnapViewToFilters();
        applyFiltersAndRender();
        renderAppliedFilters();
        renderCampanhasView();
        if (state.activeView === "ranking") renderRanking();
      }, "Atualizando visão acumulada…");
    });
  }

  const searchInput = $("#busca");
  if (searchInput) {
    searchInput.addEventListener("input", async (e) => {
      const value = e.target.value || "";
      refreshContractSuggestions(value);
      if (!value.trim() && state.tableSearchTerm) {
        await commitContractSearch("", { showSpinner: true });
      }
    });
    searchInput.addEventListener("keydown", async (e) => {
      if (e.key === "ArrowDown") {
        const value = e.currentTarget.value || "";
        if (!contractSuggestState.open) refreshContractSuggestions(value);
        if (contractSuggestState.open) moveContractSuggestionHighlight(1);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp") {
        const value = e.currentTarget.value || "";
        if (!contractSuggestState.open) refreshContractSuggestions(value);
        if (contractSuggestState.open) moveContractSuggestionHighlight(-1);
        e.preventDefault();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const highlighted = getHighlightedContractSuggestion();
        const value = highlighted ?? e.currentTarget.value;
        await commitContractSearch(value);
        return;
      }
      if (e.key === "Escape") {
        closeContractSuggestions();
      }
    });
    searchInput.addEventListener("change", async (e) => {
      const value = e.target.value || "";
      const term = (value || "").trim();
      if (term === state.tableSearchTerm || term === contractSuggestState.pending) {
        closeContractSuggestions();
        return;
      }
      if (!term) {
        await commitContractSearch("", { showSpinner: true });
      } else {
        await commitContractSearch(term);
      }
    });
    searchInput.addEventListener("focus", (e) => {
      const value = e.target.value || "";
      if (value.trim()) refreshContractSuggestions(value);
    });
    searchInput.addEventListener("blur", () => {
      setTimeout(() => closeContractSuggestions(), 120);
    });
  }

  $("#btn-export")?.remove();
  setupMobileFilters();
}

/* Reordenar filtros */
function reorderFiltersUI() {
  const area = $(".filters"); if (!area) return;
  const adv = $("#advanced-filters .adv__grid") || $("#advanced-filters");

  const groupOf = (sel) => $(sel)?.closest?.(".filters__group") || null;

  const gSeg = groupOf("#f-segmento");
  const gDR  = groupOf("#f-diretoria");
  const gGR  = groupOf("#f-gerencia");
  const gAg  = groupOf("#f-agencia");
  const gGG  = groupOf("#f-ggestao");
  const gGer = groupOf("#f-gerente");
  const gSec = groupOf("#f-secao");
  const gFam = groupOf("#f-familia");
  const gProd= groupOf("#f-produto");
  const gStatus = groupOf("#f-status-kpi");
  const gVisao = groupOf("#f-visao");

  const actions = area.querySelector(".filters__actions") || area.lastElementChild;

  [gSeg,gDR,gGR].filter(Boolean).forEach(el => area.insertBefore(el, actions));
  [gAg,gGG,gGer,gSec,gFam,gProd,gStatus,gVisao].filter(Boolean).forEach(el => adv?.appendChild(el));

  const gStart = $("#f-inicio")?.closest(".filters__group"); if (gStart) gStart.remove();
}



/* ===== Aqui eu controlo o overlay de carregamento para indicar processamento ===== */   // <- COLE AQUI O BLOCO INTEIRO
function ensureLoader(){
  if (document.getElementById('__loader')) return;
  const el = document.createElement('div');
  el.id = '__loader';
  el.className = 'loader is-hide';
  el.innerHTML = `
    <div>
      <div class="loader__spinner" aria-hidden="true"></div>
      <div class="loader__text" id="__loader_text">Carregando…</div>
    </div>`;
  document.body.appendChild(el);
}
function showLoader(text='Carregando…'){
  ensureLoader();
  const el = document.getElementById('__loader');
  el.querySelector('#__loader_text').textContent = text;
  el.classList.remove('is-hide');
}
function hideLoader(){
  const el = document.getElementById('__loader');
  if (el) el.classList.add('is-hide');
}
async function withSpinner(fn, text='Carregando…'){
  showLoader(text);
  await new Promise(r => requestAnimationFrame(() => r()));
  await new Promise(r => setTimeout(r, 0));
  try { await fn(); } finally { hideLoader(); }
}

/* ===== Aqui eu monto o widget de chat flutuante e seus eventos ===== */
function ensureChatWidget(){
  if (document.getElementById("chat-widget")) return;

  const wrap = document.createElement("div");
  wrap.id = "chat-widget";
  wrap.className = "chatw";
  wrap.innerHTML = `
    <button id="chat-launcher" class="chatw__btn" aria-label="Abrir chat de dúvidas">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8.4l-3.6 3a1 1 0 0 1-1.6-.8V6a2 2 0 0 1 2-2zm2 4v2h12V8H6zm0 4v2h9v-2H6z"/></svg>
    </button>
    <section id="chat-panel" class="chatw__panel" aria-hidden="true" role="dialog" aria-label="Chat POBJ e campanhas">
      <header class="chatw__header">
        <div class="chatw__title">Assistente POBJ &amp; Campanhas</div>
        <button id="chat-close" class="chatw__close" aria-label="Fechar chat"><i class="ti ti-x"></i></button>
      </header>

      <p class="chatw__disclaimer">Assistente virtual com IA — respostas podem conter erros.</p>

      <div id="chat-body">
        <!-- Se modo iframe, eu coloco aqui; senão, uso a UI nativa abaixo -->
      </div>

      <div id="chat-ui-native" style="display:none;">
        <div id="chat-messages" class="chatw__msgs" aria-live="polite"></div>
        <form id="chat-form" class="chatw__form" autocomplete="off">
          <input id="chat-input" type="text" placeholder="Pergunte sobre o POBJ ou campanhas…" required />
          <button id="chat-send" type="submit">Enviar</button>
        </form>
      </div>
    </section>
  `;
  document.body.appendChild(wrap);

  const launcher = document.getElementById("chat-launcher");
  const panel    = document.getElementById("chat-panel");
  const closeBtn = document.getElementById("chat-close");
  const body     = document.getElementById("chat-body");
  const uiNative = document.getElementById("chat-ui-native");

  // Montagem conforme o modo
  if (CHAT_MODE === "iframe" && CHAT_IFRAME_URL){
    const iframe = document.createElement("iframe");
    iframe.src = CHAT_IFRAME_URL;
    iframe.style.cssText = "width:100%;height:calc(520px - 48px);border:0;";
    iframe.setAttribute("title", "Chat do Assistente POBJ");
    body.appendChild(iframe);
  } else {
    // UI nativa (mensagens + input)
    uiNative.style.display = "block";
    body.style.display = "none";
    wireNativeChat();
  }

  // Abertura/fechamento
  const open = () => {
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden","false");
    if (CHAT_MODE !== "iframe") setTimeout(()=> document.getElementById("chat-input")?.focus(), 50);
  };
  const close = () => {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden","true");
    launcher.focus();
  };

  launcher.addEventListener("click", () => {
    if (panel.classList.contains("is-open")) close(); else open();
  });
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && panel.classList.contains("is-open")) close(); });

  /* ====== Nativa: UI + envio ====== */
  function wireNativeChat(){
    const msgs  = document.getElementById("chat-messages");
    const form  = document.getElementById("chat-form");
    const input = document.getElementById("chat-input");
    const send  = document.getElementById("chat-send");

    const scrollBottom = () => { msgs.scrollTop = msgs.scrollHeight; };

    const addMsg = (role, text, isTyping=false) => {
      const el = document.createElement("div");
      el.className = `msg msg--${role} ${isTyping?'msg--typing':''}`;
      el.innerHTML = isTyping
        ? `<div class="msg__bubble"><span class="dots"><i></i><i></i><i></i></span></div>`
        : `<div class="msg__bubble"></div>`;
      if (!isTyping) el.querySelector(".msg__bubble").textContent = text;
      msgs.appendChild(el);
      scrollBottom();
      return el;
    };

    const setTyping = (node, on) => {
      if (!node) return;
      node.classList.toggle("msg--typing", !!on);
      if (!on) node.innerHTML = `<div class="msg__bubble"></div>`;
    };

    // Mensagem de boas-vindas
    addMsg("bot","Olá! Posso ajudar com dúvidas sobre o POBJ e campanhas. O que você quer saber?");

    form.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const q = (input.value || "").trim();
      if (!q) return;

      addMsg("user", q);
      input.value = "";
      input.focus();
      send.disabled = true;

      const typing = addMsg("bot","", true);
      try{
        const answer = await sendToAgent(q);
        setTyping(typing, false);
        typing.querySelector(".msg__bubble").textContent = answer || "Desculpe, não consegui responder agora.";
      }catch(err){
        setTyping(typing, false);
        typing.querySelector(".msg__bubble").textContent = "Falha ao falar com o agente. Tente novamente.";
      }finally{
        send.disabled = false;
        scrollBottom();
      }
    });
  }

  /* ====== Integração ====== */
  async function sendToAgent(userText){
    if (CHAT_MODE === "http"){
      const r = await fetch(AGENT_ENDPOINT, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ question: userText })
      });
      if(!r.ok) throw new Error("HTTP "+r.status);
      const data = await r.json();
      return data.answer || "";
    }
    // Em modo IFRAME a conversa acontece dentro do próprio iframe,
    // então aqui só devolvemos vazio (não é usado).
    return "";
  }
}



/* ===== Aqui eu gerencio a troca entre as abas principais mostrando um spinner decente ===== */
async function switchView(next) {
  const label =
    next === "table"     ? "Montando detalhamento…" :
    next === "ranking"   ? "Calculando ranking…"    :
    next === "exec"      ? "Abrindo visão executiva…" :
    next === "campanhas" ? "Abrindo campanhas…" :
                           "Carregando…";

  definirAbaAtiva(next);

  await withSpinner(async () => {
    const views = { cards:"#view-cards", table:"#view-table", ranking:"#view-ranking", exec:"#view-exec", campanhas:"#view-campanhas" };

    if (next === "ranking" && !$("#view-ranking")) createRankingView();
    if (next === "exec") createExecutiveView();
    if (next === "campanhas") ensureCampanhasView();


    Object.values(views).forEach(sel => $(sel)?.classList.add("hidden"));

    if (next === "table" && !state.tableRendered) {
      ensureChipBarAndToolbar();
      autoSnapViewToFilters();
      renderTreeTable();
      state.tableRendered = true;
    } else if (next === "table") {
      renderTreeTable();
    }

    if (next === "ranking") renderRanking();
    if (next === "exec")    renderExecutiveView();   // <- ADICIONE ESTA LINHA
    if (next === "campanhas") renderCampanhasView();

    const el = $(views[next]) || $("#view-cards");
    el.classList.remove("hidden");
    state.activeView = next;
  }, label);
}



/* ===== Aqui eu monto o resumo com os indicadores e pontos principais ===== */
function hitbarClass(p){ return p<50 ? "hitbar--low" : (p<100 ? "hitbar--warn" : "hitbar--ok"); }
function renderResumoKPI(summary, context = {}) {
  const {
    visibleItemsHitCount = null,
    visiblePointsHit = null,
    visibleVarAtingido = null,
    visibleVarMeta = null
  } = context || {};

  let kpi = $("#kpi-summary");
  if (!kpi) {
    kpi = document.createElement("div");
    kpi.id = "kpi-summary";
    kpi.className = "kpi-summary";
    $("#grid-familias").prepend(kpi);
  }

  const indicadoresAtingidos = toNumber(summary.indicadoresAtingidos ?? visibleItemsHitCount ?? 0);
  const indicadoresTotal = toNumber(summary.indicadoresTotal ?? 0);
  const pontosAtingidos = toNumber(summary.pontosAtingidos ?? visiblePointsHit ?? 0);
  const pontosTotal = toNumber(summary.pontosPossiveis ?? 0);

  const varTotalBase = summary.varPossivel != null
    ? toNumber(summary.varPossivel)
    : (visibleVarMeta != null ? toNumber(visibleVarMeta) : 0);
  const varRealBase = summary.varAtingido != null
    ? toNumber(summary.varAtingido)
    : (visibleVarAtingido != null ? toNumber(visibleVarAtingido) : 0);

  const resumoAnim = state.animations?.resumo;
  const keyParts = [
    Math.round(indicadoresAtingidos || 0),
    Math.round(indicadoresTotal || 0),
    Math.round(pontosAtingidos || 0),
    Math.round(pontosTotal || 0),
    Math.round(varRealBase || 0),
    Math.round(varTotalBase || 0)
  ];
  const nextResumoKey = keyParts.join('|');
  const shouldAnimateResumo = resumoAnim?.kpiKey !== nextResumoKey;

  const formatDisplay = (type, value) => {
    if (type === "brl") return formatBRLReadable(value);
    if (type === "pts") return formatPoints(value);
    return formatIntReadable(value);
  };
  const formatFull = (type, value) => {
    if (type === "brl") {
      const n = Math.round(toNumber(value));
      return fmtBRL.format(n);
    }
    if (type === "pts") {
      return formatPoints(value, { withUnit: true });
    }
    const n = Math.round(toNumber(value));
    return fmtINT.format(n);
  };
  const buildTitle = (label, type, globalValue, visibleValue) => {
    let title = `${label}: ${formatFull(type, globalValue)}`;
    if (visibleValue != null && Math.round(toNumber(visibleValue)) !== Math.round(toNumber(globalValue))) {
      title += ` · Filtro atual: ${formatFull(type, visibleValue)}`;
    }
    return title;
  };

  const buildCard = (titulo, iconClass, atingidos, total, fmtType, visibleAting = null, visibleTotal = null, options = {}) => {
    const labelText = options.labelText || titulo;
    const labelTitle = escapeHTML(labelText);
    const labelHtml = options.labelHTML || escapeHTML(labelText);
    const pctRaw = total ? (atingidos / total) * 100 : 0;
    const pct100 = Math.max(0, Math.min(100, pctRaw));
    const hbClass = hitbarClass(pctRaw);
    const pctLabel = `${pctRaw.toFixed(1)}%`;
    const fillTarget = pct100.toFixed(2);
    const thumbPos = Math.max(0, Math.min(100, pctRaw));
    const atgTitle = buildTitle("Atingidos", fmtType, atingidos, visibleAting);
    const totTitle = buildTitle("Total", fmtType, total, visibleTotal);
    const hitbarClasses = ["hitbar", hbClass];
    if (options.emoji) hitbarClasses.push("hitbar--emoji");
    const trackStyle = `style="--target:${fillTarget}%; --thumb:${thumbPos.toFixed(2)}"`;
    const emojiHTML = options.emoji ? `<span class="hitbar__emoji" aria-hidden="true">${options.emoji}</span>` : "";

    return `
      <div class="kpi-pill">
        <div class="kpi-strip__main">
          <span class="kpi-icon"><i class="${iconClass}"></i></span>
          <div class="kpi-strip__text">
            <span class="kpi-strip__label" title="${labelTitle}">${labelHtml}</span>
            <div class="kpi-strip__stats">
              <span class="kpi-stat" title="${atgTitle}">Atg: <strong>${formatDisplay(fmtType, atingidos)}</strong></span>
              <span class="kpi-stat" title="${totTitle}">Total: <strong>${formatDisplay(fmtType, total)}</strong></span>
            </div>
          </div>
        </div>
        <div class="${hitbarClasses.join(' ')}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct100.toFixed(1)}" aria-valuetext="${titulo}: ${pctLabel}">
          <span class="hitbar__track" ${trackStyle}>
            <span class="hitbar__fill"></span>
            <span class="hitbar__thumb">${emojiHTML}<span class="hitbar__pct">${pctLabel}</span></span>
          </span>
        </div>
      </div>`;
  };

  kpi.innerHTML = [
    buildCard("Indicadores", "ti ti-list-check", indicadoresAtingidos, indicadoresTotal, "int", visibleItemsHitCount),
    buildCard("Pontos", "ti ti-medal", pontosAtingidos, pontosTotal, "pts", visiblePointsHit),
    buildCard(
      "Variável Estimada",
      "ti ti-cash",
      varRealBase,
      varTotalBase,
      "brl",
      visibleVarAtingido,
      visibleVarMeta,
      {
        labelText: "Variável Estimada",
        labelHTML: 'Variável <span class="kpi-label-emphasis">Estimada</span>'
      }
    )
  ].join("");

  triggerBarAnimation(kpi.querySelectorAll('.hitbar'), shouldAnimateResumo);
  if (resumoAnim) resumoAnim.kpiKey = nextResumoKey;
}
/* ===== Aqui eu cuido do tooltip dos cards para explicar cada indicador ===== */
function buildCardTooltipHTML(item) {
  const { total: diasTotais, elapsed: diasDecorridos, remaining: diasRestantes } = getCurrentMonthBusinessSnapshot();

  let meta = toNumber(item.meta);
  let realizado = toNumber(item.realizado);
  if (item.metric === "perc") meta = 100;

  const fmt = (m, v) => {
    if (!Number.isFinite(v)) v = 0;
    if (m === "perc") return `${v.toFixed(1)}%`;
    if (m === "qtd") return fmtINT.format(Math.round(v));
    return fmtBRL.format(Math.round(v));
  };

  const faltaTotal         = Math.max(0, meta - realizado);
  const necessarioPorDia   = diasRestantes > 0 ? (faltaTotal / diasRestantes) : 0;
  const mediaDiariaAtual   = diasDecorridos > 0 ? (realizado / diasDecorridos) : 0;
  const projecaoRitmoAtual = mediaDiariaAtual * (diasTotais || 0);
  const referenciaHoje     = diasTotais > 0 ? (meta / diasTotais) * diasDecorridos : 0;

  const necessarioPorDiaDisp = diasRestantes > 0 ? fmt(item.metric, necessarioPorDia) : "—";
  const referenciaHojeDisp   = diasDecorridos > 0 ? fmt(item.metric, referenciaHoje) : "—";

  return `
    <div class="kpi-tip" role="dialog" aria-label="Detalhes do indicador">
      <h5>Projeção e metas</h5>
      <div class="row"><span>Quantidade de dias úteis no mês</span><span>${fmtINT.format(diasTotais)}</span></div>
      <div class="row"><span>Dias úteis trabalhados</span><span>${fmtINT.format(diasDecorridos)}</span></div>
      <div class="row"><span>Dias úteis que faltam</span><span>${fmtINT.format(diasRestantes)}</span></div>
      <div class="row"><span>Falta para a meta</span><span>${fmt(item.metric, faltaTotal)}</span></div>
      <div class="row"><span>Referência para hoje</span><span>${referenciaHojeDisp}</span></div>
      <div class="row"><span>Meta diária necessária</span><span>${necessarioPorDiaDisp}</span></div>
      <div class="row"><span>Projeção (ritmo atual)</span><span>${fmt(item.metric, projecaoRitmoAtual)}</span></div>
    </div>
  `;
}
function positionTip(badge, tip) {
  const card = badge.closest(".prod-card") || badge.closest(".kpi-pill");
  if (!card) return;
  const b = badge.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;

  let top = (b.bottom - c.top) + 8;
  if (b.bottom + th + 12 > vh) top = (b.top - c.top) - th - 8;

  let left;
  if (card.classList.contains("kpi-pill")) {
    left = (b.left - c.left) + (b.width / 2) - (tw / 2);
    const minLeft = 12;
    const maxLeft = Math.max(minLeft, c.width - tw - 12);
    left = Math.min(Math.max(left, minLeft), maxLeft);
    const absLeft = c.left + left;
    if (absLeft < 12) left = 12;
    if (absLeft + tw > vw - 12) left = Math.max(12, vw - 12 - c.left - tw);
  } else {
    left = c.width - tw - 12;
    const absLeft = c.left + left;
    if (absLeft < 12) left = 12;
    if (absLeft + tw > vw - 12) left = Math.max(12, vw - 12 - c.left - tw);
  }

  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
}
function closeAllTips(){
  $$(".kpi-tip.is-open").forEach(t=>{ t.classList.remove("is-open"); t.style.left=""; t.style.top=""; });
  $$(".prod-card.is-tip-open, .kpi-pill.is-tip-open").forEach(c=>c.classList.remove("is-tip-open"));
}

/* listeners globais para tooltips (uma vez) */
let __tipGlobalsWired = false;
function wireTipGlobalsOnce(){
  if(__tipGlobalsWired) return;
  __tipGlobalsWired = true;
  const close = () => closeAllTips();
  document.addEventListener("click", (e)=>{ if(!e.target.closest(".prod-card")) close(); });
  document.addEventListener("touchstart", (e)=>{ if(!e.target.closest(".prod-card")) close(); }, {passive:true});
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") close(); });
  document.addEventListener("scroll", close, { capture:true, passive:true });
  window.addEventListener("resize", close);
}

function bindBadgeTooltip(card){
  const tip = card.querySelector(".kpi-tip");
  const badge = card.querySelector(".badge");
  if(!tip || !badge) return;

  const open = ()=>{
    closeAllTips();
    tip.classList.add("is-open");
    card.classList.add("is-tip-open");
    positionTip(badge, tip);
  };
  const close = ()=>{
    tip.classList.remove("is-open");
    card.classList.remove("is-tip-open");
    tip.style.left=""; tip.style.top="";
  };

  badge.addEventListener("mouseenter", open);
  card.addEventListener("mouseleave", close);
  badge.addEventListener("click",(e)=>{ e.stopPropagation(); if(tip.classList.contains("is-open")) close(); else open(e); });
  badge.addEventListener("touchstart",(e)=>{ e.stopPropagation(); if(tip.classList.contains("is-open")) close(); else open(e); }, {passive:true});

  wireTipGlobalsOnce();
}

/* ===== Aqui eu gero os cards de cada seção/família com métricas e metas ===== */
function getStatusFilter(){
  const raw = $("#f-status-kpi")?.value;
  return normalizarChaveStatus(raw) || "todos";
}
function buildDashboardDatasetFromRows(rows = [], period = state.period || {}) {
  SUBPRODUTO_TO_INDICADOR.clear();
  const productMeta = new Map();
  CARD_SECTIONS_DEF.forEach(sec => {
    sec.items.forEach(item => {
      productMeta.set(item.id, { ...item, sectionId: sec.id, sectionLabel: sec.label });
    });
  });

  const aggregated = new Map();
  rows.forEach(row => {
    const productId = row.produtoId || row.produto || row.prodOrSub;
    if (!productId) return;
    const meta = productMeta.get(productId) || {};
    const secaoId = meta.sectionId || row.secaoId || row.familiaId || "outros";
    const secaoLabel = meta.sectionLabel || row.secaoNome || row.familiaNome || row.familia || getSectionLabel(secaoId) || "Outros";
    const familiaId = row.familiaId || row.familia || secaoId;
    const familiaLabel = row.familiaNome || row.familia || (familiaId === secaoId ? secaoLabel : familiaId) || secaoLabel;
    let agg = aggregated.get(productId);
    if (!agg) {
      agg = {
        id: productId,
        nome: meta.nome || row.produtoNome || row.produto || productId,
        icon: meta.icon || "ti ti-dots",
        metric: meta.metric || row.metric || "valor",
        peso: meta.peso || row.peso || 1,
        secaoId,
        secaoLabel,
        familiaId,
        familiaLabel,
        metaTotal: 0,
        realizadoTotal: 0,
        variavelMeta: 0,
        variavelReal: 0,
        pesoTotal: 0,
        pesoAtingido: 0,
        pontos: 0,
        ultimaAtualizacao: ""
      };
      aplicarIndicadorAliases(agg, agg.id, agg.nome);
      aggregated.set(productId, agg);
    } else {
      if (!agg.familiaId && familiaId) {
        agg.familiaId = familiaId;
      }
      if ((!agg.familiaLabel || agg.familiaLabel === agg.familiaId) && familiaLabel) {
        agg.familiaLabel = familiaLabel;
      }
      if (!agg.secaoId && secaoId) {
        agg.secaoId = secaoId;
      }
      if ((!agg.secaoLabel || agg.secaoLabel === agg.secaoId) && secaoLabel) {
        agg.secaoLabel = secaoLabel;
      }
    }

    const metaValor = Number(row.meta) || 0;
    const realizadoValor = Number(row.realizado) || 0;
    agg.metaTotal += metaValor;
    agg.realizadoTotal += realizadoValor;
    agg.variavelMeta += Number(row.variavelMeta) || 0;
    agg.variavelReal += Number(row.variavelReal) || 0;
    const pesoLinha = Number(row.peso) || agg.peso;
    agg.pesoTotal += pesoLinha;
    if (metaValor > 0 && realizadoValor >= metaValor) {
      agg.pesoAtingido += pesoLinha;
    }
    agg.pontos += Number(row.pontos) || 0;
    if (row.data && row.data > agg.ultimaAtualizacao) {
      agg.ultimaAtualizacao = row.data;
    }

    const aliasCandidates = [
      row.id_indicador,
      row.ds_indicador,
      row.produtoId,
      row.produtoNome,
      row.produto,
      row.prodOrSub,
    ];
    if (!agg.aliases) agg.aliases = new Set();
    aliasCandidates.forEach(val => {
      const texto = limparTexto(val);
      if (!texto) return;
      agg.aliases.add(texto);
      registrarAliasIndicador(agg.id, texto);
    });
    const subprodutoTexto = limparTexto(row.subproduto || row.subProduto || "");
    if (subprodutoTexto) {
      if (!agg.subProdutos) agg.subProdutos = new Set();
      agg.subProdutos.add(subprodutoTexto);
      registrarAliasIndicador(agg.id, subprodutoTexto);
      SUBPRODUTO_TO_INDICADOR.set(simplificarTexto(subprodutoTexto), agg.id);
    }
  });

  const sections = [];
  CARD_SECTIONS_DEF.forEach(sec => {
    const items = sec.items.map(item => {
      const agg = aggregated.get(item.id);
      if (!agg) return null;
      if (agg.secaoId && agg.secaoId !== sec.id) return null;
      const ating = agg.metaTotal ? (agg.realizadoTotal / agg.metaTotal) : 0;
      const variavelAting = agg.variavelMeta ? (agg.variavelReal / agg.variavelMeta) : ating;
      const pontosMeta = Number(item.peso) || 0;
      const pontosBrutos = Number.isFinite(agg.pontos) ? agg.pontos : 0;
      const pontosCumpridos = Math.max(0, Math.min(pontosMeta, pontosBrutos));
      const ultimaISO = agg.ultimaAtualizacao || period.end || period.start || todayISO();
      const cardBase = {
        id: agg.id,
        nome: agg.nome,
        icon: agg.icon,
        metric: agg.metric,
        peso: item.peso,
        secaoId: sec.id,
        secaoLabel: sec.label,
        familiaId: agg.familiaId,
        familiaLabel: agg.familiaLabel,
        meta: agg.metaTotal,
        realizado: agg.realizadoTotal,
        variavelMeta: agg.variavelMeta,
        variavelReal: agg.variavelReal,
        ating,
        atingVariavel: variavelAting,
        atingido: ating >= 1,
        pontos: pontosCumpridos,
        pontosMeta,
        pontosBrutos,
        ultimaAtualizacao: formatBRDate(ultimaISO)
      };
      aplicarIndicadorAliases(cardBase, agg.id, agg.nome);
      cardBase.prodOrSub = agg.produtoNome || agg.nome || agg.id;
      if (agg.aliases) cardBase.aliases = Array.from(agg.aliases);
      if (agg.subProdutos) cardBase.subProdutos = Array.from(agg.subProdutos);
      return cardBase;
    }).filter(Boolean);
    if (items.length) {
      sections.push({ id: sec.id, label: sec.label, items });
    }
  });

  const allItems = sections.flatMap(sec => sec.items);
  const indicadoresTotal = allItems.length;
  const indicadoresAtingidos = allItems.filter(item => item.atingido).length;
  const pontosPossiveis = allItems.reduce((acc, item) => acc + (item.pontosMeta ?? item.peso ?? 0), 0);
  const pontosAtingidos = allItems.reduce((acc, item) => acc + (item.pontos ?? 0), 0);
  const metaTotal = allItems.reduce((acc, item) => acc + (item.meta || 0), 0);
  const realizadoTotal = allItems.reduce((acc, item) => acc + (item.realizado || 0), 0);
  const varPossivel = allItems.reduce((acc, item) => acc + (item.variavelMeta || 0), 0);
  const varAtingido = allItems.reduce((acc, item) => acc + (item.variavelReal || 0), 0);

  const summary = {
    indicadoresTotal,
    indicadoresAtingidos,
    indicadoresPct: indicadoresTotal ? indicadoresAtingidos / indicadoresTotal : 0,
    pontosPossiveis,
    pontosAtingidos,
    pontosPct: pontosPossiveis ? pontosAtingidos / pontosPossiveis : 0,
    metaTotal,
    realizadoTotal,
    metaPct: metaTotal ? realizadoTotal / metaTotal : 0,
    varPossivel,
    varAtingido,
    varPct: varPossivel ? varAtingido / varPossivel : 0
  };

  return { sections, summary };
}

function updateDashboardCards() {
  const factRows = state.facts?.dados || fDados;
  if (!Array.isArray(factRows) || !factRows.length) {
    const empty = buildDashboardDatasetFromRows([], state.period);
    state.dashboard = empty;
    renderFamilias(empty.sections, empty.summary);
    return;
  }
  const filtered = filterRowsExcept(factRows, {}, { searchTerm: "" });
  const dataset = buildDashboardDatasetFromRows(filtered, state.period);
  state.dashboard = dataset;
  renderFamilias(dataset.sections, dataset.summary);
}

function renderFamilias(sections, summary){
  const host = $("#grid-familias");
  host.innerHTML = "";
  host.style.display = "block";
  host.style.gap = "0";

  const resumoAnim = state.animations?.resumo;
  const prevVarRatios = resumoAnim?.varRatios instanceof Map ? resumoAnim.varRatios : new Map();
  const nextVarRatios = new Map();

  const status = getStatusFilter();
  const secaoFilterId = $("#f-secao")?.value || "Todas";
  const familiaFilterId = $("#f-familia")?.value || "Todas";
  const produtoFilterId = $("#f-produto")?.value || "Todos";
  const produtoFilterSlug = simplificarTexto(produtoFilterId);
  const produtoFilterResolved = produtoFilterSlug ? (SUBPRODUTO_TO_INDICADOR.get(produtoFilterSlug) || resolverIndicadorPorAlias(produtoFilterId)) : resolverIndicadorPorAlias(produtoFilterId);

  let atingidosVisiveis = 0;
  let pontosAtingidosVisiveis = 0;
  let varMetaVisiveis = 0;
  let varRealVisiveis = 0;
  let hasVisibleVar = false;

  const kpiHolder = document.createElement("div");
  kpiHolder.id = "kpi-summary";
  kpiHolder.className = "kpi-summary";
  host.appendChild(kpiHolder);

  sections.forEach(sec=>{
    const familiaFilterIsSection = familiaFilterId !== "Todas" && SECTION_IDS.has(familiaFilterId);
    const applyFamiliaFilter = familiaFilterId !== "Todas" && !familiaFilterIsSection;
    if (secaoFilterId !== "Todas" && sec.id !== secaoFilterId) {
      return;
    }
    if (familiaFilterIsSection && sec.id !== familiaFilterId) {
      return;
    }

    const itemsFiltered = sec.items.filter(it=>{
      const okStatus = status === "atingidos" ? it.atingido : (status === "nao" ? !it.atingido : true);
      const aliasList = [it.id, it.nome, it.produtoNome, it.ds_indicador, it.prodOrSub, it.aliases || [], it.subProdutos || []];
      const okProduto = (produtoFilterId === "Todos" || produtoFilterId === "Todas")
        || matchesSelection(produtoFilterId, aliasList)
        || (produtoFilterResolved && (it.id === produtoFilterResolved || matchesSelection(produtoFilterResolved, aliasList)));
      const okFamilia = !applyFamiliaFilter
        || it.familiaId === familiaFilterId
        || it.familiaLabel === familiaFilterId
        || it.id === familiaFilterId;
      return okStatus && okProduto && okFamilia;
    });
    if (!itemsFiltered.length) return;

    const sectionTotalPoints = itemsFiltered.reduce((acc,i)=> acc + (i.pontosMeta ?? i.peso ?? 0), 0);
    const sectionPointsHit   = itemsFiltered.reduce((acc,i)=> acc + Math.max(0, Number(i.pontos ?? 0)), 0);
    const sectionPointsHitDisp = formatPoints(sectionPointsHit);
    const sectionPointsTotalDisp = formatPoints(sectionTotalPoints);
    const sectionPointsHitFull = formatPoints(sectionPointsHit, { withUnit: true });
    const sectionPointsTotalFull = formatPoints(sectionTotalPoints, { withUnit: true });

    const sectionEl = document.createElement("section");
    sectionEl.className = "fam-section";
    sectionEl.id = `sec-${sec.id}`;
    sectionEl.innerHTML = `
      <header class="fam-section__header">
        <div class="fam-section__title">
          <span>${sec.label}</span>
          <small class="fam-section__meta">
            <span class="fam-section__meta-item" title="Pontos: ${sectionPointsHitFull} / ${sectionPointsTotalFull}">Pontos: ${sectionPointsHitDisp} / ${sectionPointsTotalDisp}</span>
          </small>
        </div>
      </header>
      <div class="fam-section__grid"></div>`;
    const grid = sectionEl.querySelector(".fam-section__grid");

    itemsFiltered.forEach(f=>{
      if (f.atingido){ atingidosVisiveis += 1; }
      const pontosMetaItem = Number(f.pontosMeta ?? f.peso) || 0;
      const pontosRealItem = Math.max(0, Number(f.pontos ?? 0));
      pontosAtingidosVisiveis += Math.min(pontosRealItem, pontosMetaItem);
      const variavelMeta = Number(f.variavelMeta) || 0;
      const variavelReal = Number(f.variavelReal) || 0;
      if (variavelMeta || variavelReal) hasVisibleVar = true;
      varMetaVisiveis += variavelMeta;
      varRealVisiveis += variavelReal;
      const pct = Math.max(0, Math.min(100, f.ating*100)); /* clamp 0..100 */
      const badgeClass = pct < 50 ? "badge--low" : (pct < 100 ? "badge--warn" : "badge--ok");
      const badgeTxt   = pct >= 100 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
      const narrowStyle= badgeTxt.length >= 5 ? 'style="font-size:11px"' : '';

      const realizadoTxt = formatByMetric(f.metric, f.realizado);
      const metaTxt      = formatByMetric(f.metric, f.meta);
      const realizadoFull = formatMetricFull(f.metric, f.realizado);
      const metaFull      = formatMetricFull(f.metric, f.meta);

      const pontosMeta = pontosMetaItem;
      const pontosReal = pontosRealItem;
      const pontosRatio = pontosMeta ? (pontosReal / pontosMeta) : 0;
      const pontosPct = Math.max(0, pontosRatio * 100);
      const pontosPctLabel = `${pontosPct.toFixed(1)}%`;
      const pontosFill = Math.max(0, Math.min(100, pontosPct));
      const pontosFillRounded = Number(pontosFill.toFixed(2));
      const pontosTrackClass = pontosPct < 50 ? "var--low" : (pontosPct < 100 ? "var--warn" : "var--ok");
      const pontosMetaTxt = pontosMeta ? formatPoints(pontosMeta, { withUnit: true }) : "0 pts";
      const pontosRealTxt = formatPoints(pontosReal, { withUnit: true });
      const pontosAccessible = `${pontosPctLabel} (${pontosRealTxt} de ${pontosMetaTxt})`;

      grid.insertAdjacentHTML("beforeend", `
        <article class="prod-card" tabindex="0" data-prod-id="${f.id}">
          <div class="prod-card__title">
            <i class="${f.icon}"></i>
            <span class="prod-card__name has-ellipsis" title="${f.nome}">${f.nome}</span>
            <span class="badge ${badgeClass}" ${narrowStyle} aria-label="Atingimento" title="${badgeTxt}">${badgeTxt}</span>
          </div>

          <div class="prod-card__meta">
            <span class="pill">Pontos: ${formatPoints(pontosReal)} / ${formatPoints(pontosMeta)}</span>
            <span class="pill">Peso: ${formatPoints(pontosMeta)}</span>
            <span class="pill">${f.metric === "valor" ? "Valor" : f.metric === "qtd" ? "Quantidade" : "Percentual"}</span>
          </div>

          <div class="prod-card__kpis">
            <div class="kv"><small>Meta</small><strong class="has-ellipsis" title="${metaFull}">${metaTxt}</strong></div>
            <div class="kv"><small>Realizado</small><strong class="has-ellipsis" title="${realizadoFull}">${realizadoTxt}</strong></div>
          </div>

          <div class="prod-card__var">
            <div class="prod-card__var-head">
              <small>Atingimento de pontos</small>
            </div>
            <div class="prod-card__var-body">
              <span class="prod-card__var-goal" title="${pontosMetaTxt}">${pontosMetaTxt}</span>
              <div class="prod-card__var-track ${pontosTrackClass}" data-ratio="${pontosFillRounded}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pontosFillRounded)}" aria-valuetext="${pontosAccessible}">
                <span class="prod-card__var-fill" style="--target:${pontosFillRounded}%"></span>
                <span class="prod-card__var-label" title="Atingido: ${pontosRealTxt} · ${pontosPctLabel}">
                  <span class="prod-card__var-value">${pontosPctLabel}</span>
                </span>
              </div>
            </div>
          </div>

          <div class="prod-card__foot">Atualizado em ${f.ultimaAtualizacao}</div>
          ${buildCardTooltipHTML(f)}
        </article>
      `);

      nextVarRatios.set(f.id, pontosFillRounded);
      const cardEl = grid.lastElementChild;
      if (cardEl) {
        const trackEl = cardEl.querySelector(".prod-card__var-track");
        if (trackEl) {
          const prevRatio = prevVarRatios.get(f.id);
          const animateVar = shouldAnimateDelta(prevRatio, pontosFillRounded, 0.25);
          triggerBarAnimation(trackEl, animateVar);
        }
      }
    });

    host.appendChild(sectionEl);
  });

  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(layoutProdVarTracks);
  } else {
    layoutProdVarTracks();
  }
  ensureVarLabelResizeListener();

  if (resumoAnim) resumoAnim.varRatios = nextVarRatios;

  renderResumoKPI(summary, {
    visibleItemsHitCount: atingidosVisiveis,
    visiblePointsHit: pontosAtingidosVisiveis,
    visibleVarAtingido: hasVisibleVar ? varRealVisiveis : null,
    visibleVarMeta: hasVisibleVar ? varMetaVisiveis : null
  });

  $$(".prod-card").forEach(card=>{
    const tip = card.querySelector(".kpi-tip");
    const badge = card.querySelector(".badge");
    if (badge && tip) bindBadgeTooltip(card);

    card.addEventListener("click", (ev)=>{
      if (ev.target?.classList.contains("badge")) return;
      const prodId = card.getAttribute("data-prod-id");
      const meta = PRODUCT_INDEX.get(prodId);
      const familiaId = meta?.sectionId || null;
      const familiaSelect = $("#f-familia");
      if (familiaSelect){
        if (familiaId){
          let famOpt = Array.from(familiaSelect.options).find(o => o.value === familiaId);
          if (!famOpt){
            famOpt = new Option(FAMILIA_BY_ID.get(familiaId)?.nome || familiaId, familiaId);
            familiaSelect.appendChild(famOpt);
          }
          familiaSelect.value = familiaId;
        } else {
          familiaSelect.value = "Todas";
        }
        familiaSelect.dispatchEvent(new Event("change"));
      }

      const produtoSelect = $("#f-produto");
      if (produtoSelect){
        let opt = Array.from(produtoSelect.options).find(o => o.value === prodId);
        if (!opt){
          opt = new Option(meta?.name || prodId, prodId);
          produtoSelect.appendChild(opt);
        }
        produtoSelect.value = prodId;
      }
      state.tableView = "prodsub";
      setActiveChip("prodsub");
      const tabDet = document.querySelector('.tab[data-view="table"]');
      if (tabDet && !tabDet.classList.contains("is-active")) tabDet.click(); else switchView("table");
      applyFiltersAndRender();
      renderAppliedFilters();
    });
  });
}
/* ===== Aqui eu preparo comportamentos extras das abas quando surgirem novas ===== */
function ensureExtraTabs(){
  const tabs = document.querySelector(".tabs"); 
  if(!tabs) return;

  // Evita duplicar botões
  if(!tabs.querySelector('.tab[data-view="ranking"]')){
    const b = document.createElement("button");
    b.className="tab"; b.dataset.view="ranking"; b.textContent="Ranking";
    b.type = "button";
    tabs.insertBefore(b, tabs.querySelector(".tabs__aside"));
  }

  if(!tabs.querySelector('.tab[data-view="exec"]')){
    const b2 = document.createElement("button");
    b2.className="tab"; b2.dataset.view="exec"; b2.textContent="Visão executiva";
    b2.type = "button";
    tabs.insertBefore(b2, tabs.querySelector(".tabs__aside"));
  }
}

/* ===== Aqui eu injeto estilos extras da visão executiva direto via JS ===== */
function ensureExecStyles(){
  if (document.getElementById("exec-enhanced-styles")) return;
  const s = document.createElement("style");
  s.id = "exec-enhanced-styles";
  s.textContent = `
    .exec-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
    .seg-mini.segmented{padding:2px;border-radius:8px}
    .seg-mini .seg-btn{padding:6px 8px;font-size:12px}
    .exec-chart{background:#fff;border:1px solid var(--stroke);border-radius:14px;box-shadow:var(--shadow);padding:20px;margin-bottom:20px}
    .chart{width:100%;overflow:hidden;padding:20px;border-radius:12px;background:#fff}
    .chart svg{display:block;width:100%;height:auto}
    .chart-legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}
    .legend-item{display:inline-flex;align-items:center;gap:6px;color:#475569;font-weight:700}
    .legend-swatch{display:inline-block;width:14px;height:6px;border-radius:999px;background:#cbd5e1;border:1px solid #94a3b8;position:relative}
    .legend-swatch--bar-real{background:#2563eb;border-color:#1d4ed8;height:10px}
    .legend-swatch--meta-line{background:transparent;border:none;height:0;border-top:2.5px solid #60a5fa;width:18px;margin-top:4px;border-radius:0}
    .exec-panel .exec-h{display:flex;align-items:center;justify-content:space-between;gap:10px}
  `;
  document.head.appendChild(s);
}

/* ===== Aqui eu construo toda a visão executiva com gráficos, rankings e heatmap ===== */
function createExecutiveView(){
  ensureExecStyles();

  const host = document.getElementById("view-exec");
  if (!host) return;

  if (!state.exec) {
    state.exec = { heatmapMode: "secoes", seriesColors: new Map() };
  }
  state.exec.heatmapMode = state.exec.heatmapMode || "secoes";
  if (!(state.exec.seriesColors instanceof Map)) {
    state.exec.seriesColors = new Map();
  }

  const syncSegmented = (containerSelector, dataAttr, stateKey, fallback) => {
    const container = host.querySelector(containerSelector);
    if (!container) return;
    const buttons = container.querySelectorAll('.seg-btn');
    if (!buttons.length) return;
    const active = state.exec[stateKey] || fallback;
    buttons.forEach(btn => {
      const value = btn.dataset[dataAttr] || fallback;
      btn.classList.toggle('is-active', value === active);
      if (!btn.dataset.execBound) {
        btn.dataset.execBound = 'true';
        btn.addEventListener('click', () => {
          state.exec[stateKey] = value;
          buttons.forEach(b => b.classList.toggle('is-active', b === btn));
          if (state.activeView === 'exec') renderExecutiveView();
        });
      }
    });
  };

  syncSegmented('#exec-heatmap-toggle', 'hm', 'heatmapMode', 'secoes');

  if (!host.dataset.execFiltersBound) {
    const execSel = ["#f-segmento","#f-diretoria","#f-gerencia","#f-agencia","#f-ggestao","#f-gerente","#f-familia","#f-produto","#f-status-kpi"];
    execSel.forEach(sel => $(sel)?.addEventListener("change", () => {
      if (state.activeView === 'exec') renderExecutiveView();
    }));
    $("#btn-consultar")?.addEventListener("click", () => {
      if (state.activeView === 'exec') renderExecutiveView();
    });
    host.dataset.execFiltersBound = "true";
  }
}

/* Helpers de agregação para a Visão Executiva */
function resolveExecValueForKey(row, key, fallback = "—") {
  if (!row) return fallback;
  switch (key) {
    case "gerenciaRegional": return row.gerenciaRegional || row.diretoria || fallback;
    case "agencia":         return row.agencia || row.agenciaCodigo || fallback;
    case "gerenteGestao":   return row.gerenteGestao || fallback;
    case "gerente":         return row.gerente || fallback;
    case "prodOrSub":       return row.prodOrSub || row.produtoId || row.produto || fallback;
    case "diretoria":       return row.diretoria || fallback;
    default:                 return row[key] || fallback;
  }
}

function resolveExecLabelForKey(row, key, fallback = "") {
  if (!row) return fallback;
  const candidates = {
    gerenciaRegional: ["gerenciaNome", "regional", "gerenciaRegional"],
    agencia: ["agenciaNome", "agencia", "agenciaCodigo"],
    gerenteGestao: ["gerenteGestaoNome", "gerenteGestao"],
    gerente: ["gerenteNome", "gerente"],
    prodOrSub: ["produtoNome", "prodOrSub", "produto", "produtoId"],
    diretoria: ["diretoriaNome", "diretoria"],
    __total__: ["Consolidado"]
  };
  const fields = candidates[key] || [key];
  for (const field of fields) {
    if (field === "Consolidado") return "Consolidado";
    const value = row[field];
    if (value) return value;
  }
  return fallback || resolveExecValueForKey(row, key, "") || "";
}

function execAggBy(rows, key){
  const map = new Map();
  rows.forEach(r=>{
    const groupKey = key === "__total__" ? "__total__" : resolveExecValueForKey(r, key, "—");
    const current = map.get(groupKey) || { key: groupKey, label: "", real_mens:0, meta_mens:0, real_acum:0, meta_acum:0, qtd:0 };
    const labelCandidate = resolveExecLabelForKey(r, key, current.label || groupKey);
    if (labelCandidate && !current.label) current.label = labelCandidate;
    current.real_mens += (r.real_mens ?? r.realizado ?? 0);
    current.meta_mens += (r.meta_mens ?? r.meta ?? 0);
    current.real_acum += (r.real_acum ?? r.realizado ?? 0);
    current.meta_acum += (r.meta_acum ?? r.meta ?? 0);
    current.qtd       += (r.qtd ?? 0);
    map.set(groupKey, current);
  });
  return [...map.values()].map(x=>{
    if (!x.label) {
      x.label = key === "__total__" ? "Consolidado" : x.key;
    }
    const ating_mens = x.meta_mens ? x.real_mens/x.meta_mens : 0;
    const ating_acum = x.meta_acum ? x.real_acum/x.meta_acum : 0;
    const def_mens   = x.real_mens - x.meta_mens;
    return { ...x, ating_mens, ating_acum, def_mens, p_mens: ating_mens*100, p_acum: ating_acum*100 };
  });
}

const EXEC_FILTER_SELECTORS = {
  gerencia: "#f-gerencia",
  agencia:  "#f-agencia",
  gGestao:  "#f-ggestao",
  gerente:  "#f-gerente",
  prodsub:  "#f-produto"
};
function pctBadgeCls(p){ return p<50?"att-low":(p<100?"att-warn":"att-ok"); }
function moneyBadgeCls(v){ return v>=0?"def-pos":"def-neg"; }

// nível inicial conforme filtros (pra baixo)
function execStartLevelFromFilters(){
  const f = getFilterValues();
  if (f.produtoId && f.produtoId !== "Todos" && f.produtoId !== "Todas") return "prodsub";
  if (f.familiaId && f.familiaId !== "Todas") return "prodsub";
  if (f.gerente && f.gerente !== "Todos")   return "prodsub";
  if (f.ggestao && f.ggestao !== "Todos")   return "gerente";
  if (f.agencia && f.agencia !== "Todas")   return "gGestao";
  if (f.gerencia && f.gerencia !== "Todas") return "agencia";
  if (f.diretoria && f.diretoria !== "Todas") return "gerencia";
  return "gerencia";
}
function levelKeyFor(start){
  return {
    gerencia: "gerenciaRegional",
    agencia:  "agencia",
    gGestao:  "gerenteGestao",
    gerente:  "gerente",
    prodsub:  "prodOrSub"
  }[start] || "gerenciaRegional";
}
function levelLabel(start){
  return {
    gerencia: {sing:"Regional", plural:"Regionais", short:"GR"},
    agencia:  {sing:"Agência", plural:"Agências", short:"Agências"},
    gGestao:  {sing:"Ger. de Gestão", plural:"Ger. de Gestão", short:"GG"},
    gerente:  {sing:"Gerente", plural:"Gerentes", short:"Gerentes"},
    prodsub:  {sing:"Indicador/Subproduto", plural:"Indicadores", short:"Indicadores"}
  }[start];
}

function chartDimensions(container, fallbackW=900, fallbackH=260){
  if (!container) return { width: fallbackW, height: fallbackH };
  const styles = window.getComputedStyle(container);
  const padL = parseFloat(styles.paddingLeft) || 0;
  const padR = parseFloat(styles.paddingRight) || 0;
  const width = Math.max(320, (container.clientWidth || fallbackW) - padL - padR);
  return { width, height: fallbackH };
}
function monthKeyLabel(key){
  if (!key) return "—";
  const [y,m] = key.split('-');
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;
  const dt = new Date(Date.UTC(year, month - 1, 1));
  return dt.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
}

function monthKeyFromDate(dt){
  if (!(dt instanceof Date) || Number.isNaN(dt)) return "";
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizeMonthKey(value){
  if (!value) return "";
  if (value instanceof Date) return monthKeyFromDate(value);
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/[\\/]/g, "-");
    const match = cleaned.match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
  }
  return "";
}

function buildMonthlyAxis(period){
  const startISO = period?.start || todayISO();
  const endISO = period?.end || startISO;

  let startDate = dateUTCFromISO(startISO);
  let endDate = dateUTCFromISO(endISO);
  if (!startDate) startDate = dateUTCFromISO(todayISO());
  if (!endDate) endDate = startDate;
  if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

  const limit = new Date(endDate);
  limit.setUTCDate(1);

  const cursor = new Date(Date.UTC(limit.getUTCFullYear(), 0, 1));
  const keys = [];
  while (cursor <= limit) {
    keys.push(monthKeyFromDate(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  if (!keys.length) {
    keys.push(monthKeyFromDate(limit));
  }

  return keys;
}

function ensureExecSeriesColor(id){
  const palette = EXEC_SERIES_PALETTE;
  if (!palette.length) return '#2563eb';
  if (!id) return palette[0];
  if (state.exec?.seriesColors instanceof Map) {
    const map = state.exec.seriesColors;
    if (map.has(id)) return map.get(id);
    const color = palette[map.size % palette.length];
    map.set(id, color);
    return color;
  }
  return palette[0];
}

function makeMonthlySectionSeries(rows, period){
  const monthKeys = buildMonthlyAxis(period);
  const monthIndex = new Map(monthKeys.map((key, idx) => [key, idx]));
  const sections = new Map();
  const sectionOrder = new Map(CARD_SECTIONS_DEF.map((sec, idx) => [sec.id, idx]));

  rows.forEach(r => {
    const rawDate = r?.competencia || r?.mes || r?.data || r?.dataReferencia || r?.dt;
    const key = normalizeMonthKey(rawDate);
    if (!monthIndex.has(key)) return;
    const idx = monthIndex.get(key);
    const section = resolveSectionMetaFromRow(r);
    if (!section.id) return;

    let entry = sections.get(section.id);
    if (!entry) {
      entry = {
        id: section.id,
        label: section.label || getSectionLabel(section.id) || section.id,
        meta: Array(monthKeys.length).fill(0),
        real: Array(monthKeys.length).fill(0)
      };
      sections.set(section.id, entry);
    } else if (!entry.label && section.label) {
      entry.label = section.label;
    }

    entry.meta[idx] += toNumber(r.meta_mens ?? r.meta ?? 0);
    entry.real[idx] += toNumber(r.real_mens ?? r.realizado ?? 0);
  });

  const series = [...sections.values()].map(entry => {
    const values = entry.meta.map((meta, idx) => {
      if (!Number.isFinite(meta) || meta <= 0) return null;
      const realVal = entry.real[idx] ?? 0;
      return (realVal / meta) * 100;
    });
    if (!values.some(v => Number.isFinite(v))) return null;
    return {
      id: entry.id,
      label: entry.label || getSectionLabel(entry.id) || entry.id,
      values,
      color: ensureExecSeriesColor(entry.id)
    };
  }).filter(Boolean).sort((a, b) => {
    const ai = sectionOrder.has(a.id) ? sectionOrder.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bi = sectionOrder.has(b.id) ? sectionOrder.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' });
  });

  return {
    keys: monthKeys,
    labels: monthKeys.map(monthKeyLabel),
    series
  };
}

function buildExecMonthlyLines(container, dataset){
  if (!dataset || !dataset.series?.length) {
    container.innerHTML = `<div class="muted">Sem dados para exibir.</div>`;
    return;
  }

  const { width: W, height: H } = chartDimensions(container);
  const m = { t:28, r:36, b:48, l:64 };
  const iw = Math.max(0, W - m.l - m.r);
  const ih = Math.max(0, H - m.t - m.b);
  const n = dataset.labels.length;
  const x = (idx) => {
    if (n <= 1) return m.l + iw / 2;
    const step = iw / (n - 1);
    return m.l + step * idx;
  };

  const values = dataset.series.flatMap(s => s.values.filter(v => Number.isFinite(v)));
  const maxVal = values.length ? Math.max(...values) : 0;
  const yMax = Math.max(120, Math.ceil((maxVal || 100) / 10) * 10);
  const y = (val) => {
    const clamped = Math.min(Math.max(val, 0), yMax);
    return m.t + ih - (clamped / yMax) * ih;
  };

  const gridLines = [];
  const steps = 5;
  for (let k = 0; k <= steps; k++) {
    const val = (yMax / steps) * k;
    gridLines.push({ y: y(val), label: `${Math.round(val)}%` });
  }

  const paths = dataset.series.map(series => {
    let d = '';
    let started = false;
    series.values.forEach((value, idx) => {
      if (!Number.isFinite(value)) {
        started = false;
        return;
      }
      const cmd = started ? 'L' : 'M';
      d += `${cmd} ${x(idx)} ${y(value)} `;
      started = true;
    });
    return `<path class="exec-line" d="${d.trim()}" fill="none" stroke="${series.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><title>${escapeHTML(series.label)}</title></path>`;
  }).join('');

  const points = dataset.series.map(series => series.values.map((value, idx) => {
    if (!Number.isFinite(value)) return '';
    const monthLabel = dataset.labels[idx] || String(idx + 1);
    const valueLabel = `${value.toFixed(1)}%`;
    return `<circle class="exec-line__point" cx="${x(idx)}" cy="${y(value)}" r="3.4" fill="${series.color}" stroke="#fff" stroke-width="1.2"><title>${escapeHTML(series.label)} • ${monthLabel}: ${valueLabel}</title></circle>`;
  }).join('')).join('');

  const gridY = gridLines.map(line =>
    `<line x1="${m.l}" y1="${line.y}" x2="${W - m.r}" y2="${line.y}" stroke="#eef2f7"/>
     <text x="${m.l - 6}" y="${line.y + 3}" font-size="10" text-anchor="end" fill="#6b7280">${line.label}</text>`
  ).join('');

  const xlabels = dataset.labels.map((lab, idx) =>
    `<text x="${x(idx)}" y="${H - 10}" font-size="10" text-anchor="middle" fill="#6b7280">${escapeHTML(lab)}</text>`
  ).join('');

  container.innerHTML = `
    <svg class="exec-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Linhas de atingimento mensal por família">
      <rect x="0" y="0" width="${W}" height="${H}" fill="white"/>
      ${gridY}
      ${paths}
      ${points}
      <line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" stroke="#e5e7eb"/>
      ${xlabels}
    </svg>`;
}

/* ===== Aqui eu orquestro o render principal da visão executiva ===== */
function renderExecutiveView(){
  const host = document.getElementById("view-exec"); 
  if(!host) return;

  const ctx    = document.getElementById("exec-context");
  const kpis   = document.getElementById("exec-kpis");
  const chartC = document.getElementById("exec-chart");
  const chartTitleEl = document.getElementById("exec-chart-title");
  const chartLegend = document.getElementById("exec-chart-legend");
  const hm     = document.getElementById("exec-heatmap");
  const rankTopEl = document.getElementById("exec-rank-top");
  const rankBottomEl = document.getElementById("exec-rank-bottom");
  const statusHitEl = document.getElementById("exec-status-hit");
  const statusQuaseEl = document.getElementById("exec-status-quase");
  const statusLongeEl = document.getElementById("exec-status-longe");
  const exportBtn = document.getElementById("btn-export-onepage");

  if (exportBtn && !exportBtn.dataset.bound){
    exportBtn.dataset.bound = "1";
    exportBtn.addEventListener("click", () => window.print());
  }

  if (!Array.isArray(state._rankingRaw) || !state._rankingRaw.length){
    ctx && (ctx.textContent = "Carregando dados…");
    return;
  }

  // base com TODOS os filtros aplicados
  const rowsBase = filterRows(state._rankingRaw);
  const execMonthlyPeriod = getExecutiveMonthlyPeriod();
  const rowsMonthly = filterRowsExcept(state._rankingRaw, {}, {
    searchTerm: state.tableSearchTerm,
    dateStart: execMonthlyPeriod.start,
    dateEnd: execMonthlyPeriod.end,
  });

  // nível inicial
  const start = execStartLevelFromFilters();
  const startKey = levelKeyFor(start);
  const L = levelLabel(start);

  // títulos conforme nível
  document.getElementById("exec-rank-title").textContent   = `Desempenho por ${L.sing}`;
  document.getElementById("exec-heatmap-title").textContent= `Heatmap — ${L.short} × Seções`;
  document.getElementById("exec-status-title").textContent = `Status das ${L.plural}`;

  // contexto
  if (ctx){
    const f = getFilterValues();
    const foco =
      f.gerente  && f.gerente  !== "Todos" ? `Gerente: ${f.gerente}` :
      f.ggestao  && f.ggestao  !== "Todos" ? `GG: ${f.ggestao}` :
      f.agencia  && f.agencia  !== "Todas" ? `Agência: ${f.agencia}` :
      f.gerencia && f.gerencia !== "Todas" ? `GR: ${f.gerencia}` :
      f.diretoria&& f.diretoria!== "Todas" ? `Diretoria: ${f.diretoria}` : `Todas as Diretorias`;
    ctx.innerHTML = `<strong>${foco}</strong> · Período: ${formatBRDate(state.period.start)} a ${formatBRDate(state.period.end)}`;
  }

  // KPIs gerais
  const total = execAggBy(rowsBase, "__total__").reduce((a,b)=>({
    real_mens:a.real_mens + b.real_mens, meta_mens:a.meta_mens + b.meta_mens,
    real_acum:a.real_acum + b.real_acum, meta_acum:a.meta_acum + b.meta_acum
  }), {real_mens:0,meta_mens:0,real_acum:0,meta_acum:0});

  const ating = total.meta_mens ? total.real_mens/total.meta_mens : 0;
  const defas = total.real_mens - total.meta_mens;

  const diasTotais     = businessDaysBetweenInclusive(state.period.start, state.period.end);
  const diasDecorridos = businessDaysElapsedUntilToday(state.period.start, state.period.end);
  const diasRestantes  = Math.max(0, diasTotais - diasDecorridos);
  const mediaDiaria    = diasDecorridos>0 ? (total.real_mens/diasDecorridos) : 0;
  const necessarioDia  = diasRestantes>0 ? Math.max(0, (total.meta_mens-total.real_mens)/diasRestantes) : 0;
  const forecast       = mediaDiaria * diasTotais;
  const forecastPct    = total.meta_mens ? (forecast/total.meta_mens)*100 : 0;

  if (kpis){
    const realMensFull = fmtBRL.format(Math.round(total.real_mens));
    const realMensDisplay = formatBRLReadable(total.real_mens);
    const metaMensFull = fmtBRL.format(Math.round(total.meta_mens));
    const metaMensDisplay = formatBRLReadable(total.meta_mens);
    const defasFull = fmtBRL.format(Math.round(defas));
    const defasDisplay = formatBRLReadable(defas);
    const forecastFull = fmtBRL.format(Math.round(forecast));
    const forecastDisplay = formatBRLReadable(forecast);

    kpis.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-card__title">Atingimento mensal</div>
        <div class="kpi-card__value"><span title="${realMensFull}">${realMensDisplay}</span> <small>/ <span title="${metaMensFull}">${metaMensDisplay}</span></small></div>
        <div class="kpi-card__bar">
          <div class="kpi-card__fill ${pctBadgeCls(ating*100)}" style="width:${Math.min(100, Math.max(0, ating*100))}%"></div>
        </div>
        <div class="kpi-card__pct"><span class="att-badge ${pctBadgeCls(ating*100)}">${(ating*100).toFixed(1)}%</span></div>
      </div>

      <div class="kpi-card">
        <div class="kpi-card__title">Defasagem do mês</div>
        <div class="kpi-card__value ${moneyBadgeCls(defas)}" title="${defasFull}">${defasDisplay}</div>
        <div class="kpi-sub muted">Real – Meta (mês)</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-card__title">Forecast x Meta</div>
        <div class="kpi-card__value"><span title="${forecastFull}">${forecastDisplay}</span> <small>/ <span title="${metaMensFull}">${metaMensDisplay}</span></small></div>
        <div class="kpi-card__bar">
          <div class="kpi-card__fill ${pctBadgeCls(forecastPct)}" style="width:${Math.min(100, Math.max(0, forecastPct))}%"></div>
        </div>
        <div class="kpi-card__pct"><span class="att-badge ${pctBadgeCls(forecastPct)}">${forecastPct.toFixed(1)}%</span></div>
      </div>`;
  }

  const heatmapMode = state.exec.heatmapMode || "secoes";
  const heatmapTitleEl = document.getElementById("exec-heatmap-title");
  if (heatmapTitleEl){
    heatmapTitleEl.textContent = heatmapMode === "meta"
      ? "Heatmap — Variação da meta (mês a mês)"
      : `Heatmap — ${L.short} × Seções`;
  }

  // Gráfico
  if (chartC){
    const monthlySeries = makeMonthlySectionSeries(rowsMonthly, execMonthlyPeriod);
    chartC.setAttribute("aria-label", "Linhas mensais de atingimento por seção");
    if (chartTitleEl) chartTitleEl.textContent = "Evolução mensal por seção";
    if (chartLegend){
      if (monthlySeries.series.length){
        chartLegend.innerHTML = monthlySeries.series.map(serie => `
          <span class="legend-item">
            <span class="legend-swatch legend-swatch--line" style="--swatch:${serie.color}"></span>${escapeHTML(serie.label)}
          </span>`).join("");
      } else {
        chartLegend.innerHTML = `<span class="legend-item muted">Sem seções para exibir.</span>`;
      }
    }

    host.__execChartDataset = monthlySeries;
    const renderChart = () => buildExecMonthlyLines(chartC, host.__execChartDataset);

    renderChart();
    host.__execChartRender = renderChart;

    if (!host.__execResize){
      let raf = null;
      host.__execResize = () => {
        if (state.activeView !== 'exec') return;
        if (raf) cancelAnimationFrame(raf);
        const fn = host.__execChartRender;
        raf = requestAnimationFrame(()=> fn && fn());
      };
      window.addEventListener('resize', host.__execResize);
    }
  }

  // Ranking Top/Bottom
  const grouped = execAggBy(rowsBase, startKey)
    .filter(item => item.key !== "__total__")
    .sort((a,b)=> b.p_mens - a.p_mens);
  const rankIndex = new Map();
  grouped.forEach((row, idx) => rankIndex.set(row.key, idx));
  const myUnit = currentUnitForLevel(start);

  const renderRankList = (container, list) => {
    if (!container) return;
    const rows = list.slice(0, 5);
    while (rows.length < 5) {
      rows.push({ placeholder:true, key:`placeholder-${rows.length}` });
    }

    container.innerHTML = rows.map(row => {
      if (row.placeholder) {
        return `
          <div class="rank-mini__row rank-mini__row--empty" data-placeholder="true">
            <div class="rank-mini__name"><span class="rank-mini__label">Sem dados disponíveis</span></div>
            <div class="rank-mini__bar"><span style="width:0%"></span></div>
            <div class="rank-mini__pct">—</div>
            <div class="rank-mini__vals">—</div>
          </div>`;
      }
      const rankNumber = (rankIndex.get(row.key) ?? 0) + 1;
      const safeKey = escapeHTML(row.key);
      const label = row.label || row.key;
      const pctClass = pctBadgeCls(row.p_mens);
      const realFull = fmtBRL.format(Math.round(row.real_mens));
      const metaFull = fmtBRL.format(Math.round(row.meta_mens));
      const realDisplay = formatBRLReadable(row.real_mens);
      const metaDisplay = formatBRLReadable(row.meta_mens);
      return `
        <div class="rank-mini__row${row.key === myUnit ? ' rank-mini__row--mine' : ''}" data-key="${safeKey}" data-rank="${rankNumber}" title="${escapeHTML(`Ranking #${rankNumber} — ${label}`)}">
          <div class="rank-mini__name"><span class="rank-mini__label">${escapeHTML(label)}</span></div>
          <div class="rank-mini__bar"><span style="width:${Math.min(100, Math.max(0, row.p_mens))}%"></span></div>
          <div class="rank-mini__pct"><span class="att-badge ${pctClass}">${row.p_mens.toFixed(1)}%</span></div>
          <div class="rank-mini__vals"><strong title="${realFull}">${realDisplay}</strong> <small title="${metaFull}">/ ${metaDisplay}</small></div>
        </div>`;
    }).join("");

    container.querySelectorAll(".rank-mini__row").forEach(rowEl => {
      if (rowEl.dataset.placeholder === "true") return;
      rowEl.addEventListener("click", () => {
        const keyVal = rowEl.getAttribute("data-key");
        const selector = EXEC_FILTER_SELECTORS[start];
        if (selector && keyVal){
          const sel = document.querySelector(selector);
          const option = sel && [...sel.options].find(opt => opt.value === keyVal);
          if (sel && option){
            sel.value = keyVal;
            sel.dispatchEvent(new Event("change"));
          }
        }
        document.querySelector('.tab[data-view="table"]')?.click();
      });
    });
  };

  if (rankTopEl) renderRankList(rankTopEl, grouped.slice(0, 5));
  if (rankBottomEl) renderRankList(rankBottomEl, grouped.slice(-5).reverse());

  // Status das unidades
  const statusBase = execAggBy(rowsBase, startKey).filter(item => item.key !== "__total__");
  const hitList = statusBase.filter(item => item.p_mens >= 100).slice(0, 5);
  const quaseList = statusBase.filter(item => item.p_mens >= 90 && item.p_mens < 100).slice(0, 5);
  const longeList = statusBase
    .map(item => ({ ...item, gap: item.real_mens - item.meta_mens }))
    .sort((a,b) => a.gap - b.gap)
    .slice(0, 5);

  const renderStatusList = (container, list, type) => {
    if (!container) return;
    const rows = list.slice(0, 5);
    while (rows.length < 5) {
      rows.push({ placeholder:true, key:`placeholder-${rows.length}` });
    }
    container.innerHTML = rows.map(row => {
      if (row.placeholder) {
        return `
          <div class="list-mini__row list-mini__row--empty" data-placeholder="true">
            <div class="list-mini__name">Sem dados disponíveis</div>
            <div class="list-mini__val">—</div>
          </div>`;
      }
      const safeKey = escapeHTML(row.key);
      const label = escapeHTML(row.label || row.key);
      let valueHTML = "";
      if (type === "hit") {
        valueHTML = `<span class="att-badge att-ok">${row.p_mens.toFixed(1)}%</span>`;
      } else if (type === "quase") {
        valueHTML = `<span class="att-badge att-warn">${row.p_mens.toFixed(1)}%</span>`;
      } else {
        valueHTML = `<span class="def-badge def-neg">${fmtBRL.format(row.gap)}</span>`;
      }
      return `
        <div class="list-mini__row" data-key="${safeKey}" title="${label}">
          <div class="list-mini__name">${label}</div>
          <div class="list-mini__val">${valueHTML}</div>
        </div>`;
    }).join("");

    container.querySelectorAll(".list-mini__row").forEach(rowEl => {
      if (rowEl.dataset.placeholder === "true") return;
      rowEl.addEventListener("click", () => {
        const keyVal = rowEl.getAttribute("data-key");
        const selector = EXEC_FILTER_SELECTORS[start];
        if (selector && keyVal){
          const sel = document.querySelector(selector);
          const option = sel && [...sel.options].find(opt => opt.value === keyVal);
          if (sel && option){
            sel.value = keyVal;
            sel.dispatchEvent(new Event("change"));
          }
        }
        document.querySelector('.tab[data-view="table"]')?.click();
      });
    });
  };

  renderStatusList(statusHitEl, hitList, "hit");
  renderStatusList(statusQuaseEl, quaseList, "quase");
  renderStatusList(statusLongeEl, longeList, "longe");

  // Heatmap
  if (hm){
    if (heatmapMode === "meta") {
      renderExecHeatmapMeta(hm, rowsMonthly, execMonthlyPeriod);
    } else {
      renderExecHeatmapSections(hm, rowsBase, startKey, start, L);
    }
  }
}

function renderExecHeatmapSections(hm, rows, startKey, start, levelMeta){
  if (!hm) return;
  const unitMeta = new Map();
  const sectionEntries = CARD_SECTIONS_DEF.map(sec => ({ id: sec.id, label: sec.label || sec.id }));
  const aggregates = new Map();

  rows.forEach(row => {
    const unitValue = resolveExecValueForKey(row, startKey, "");
    if (!unitValue) return;
    const unitLabel = resolveExecLabelForKey(row, startKey, unitValue);
    if (!unitMeta.has(unitValue)) {
      const title = unitLabel && unitLabel !== unitValue ? `${unitLabel} (${unitValue})` : unitLabel || unitValue;
      unitMeta.set(unitValue, { label: unitLabel || unitValue, title });
    }

    const section = resolveSectionMetaFromRow(row);
    if (!section.id) return;
    const bucketKey = `${unitValue}|${section.id}`;
    const bucket = aggregates.get(bucketKey) || { real:0, meta:0 };
    bucket.real += toNumber(row.real_mens ?? row.realizado ?? 0);
    bucket.meta += toNumber(row.meta_mens ?? row.meta ?? 0);
    aggregates.set(bucketKey, bucket);
  });

  if (!unitMeta.size) {
    hm.innerHTML = `<div class="muted">Sem dados para exibir.</div>`;
    return;
  }

  const units = [...unitMeta.entries()].map(([value, meta]) => ({
    value,
    label: meta.label,
    title: meta.title
  })).sort((a,b)=> a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));

  const columnCount = Math.max(1, sectionEntries.length);
  const rowStyle = ` style="--hm-cols:${columnCount}; --hm-first:240px; --hm-cell:136px"`;
  let html = `<div class="hm-row hm-head"${rowStyle}><div class="hm-cell hm-corner">${escapeHTML(levelMeta.short)} \\ Seção</div>${
    sectionEntries.map(sec => `<div class="hm-cell hm-col" title="${escapeHTML(sec.label)}">${escapeHTML(sec.label)}</div>`).join("")
  }</div>`;

  units.forEach(unit => {
    html += `<div class="hm-row"${rowStyle}><div class="hm-cell hm-rowh"${unit.title ? ` title="${escapeHTML(unit.title)}"` : ""}>${escapeHTML(unit.label)}</div>`;
    sectionEntries.forEach(sec => {
      const bucket = aggregates.get(`${unit.value}|${sec.id}`) || { real:0, meta:0 };
      const realVal = toNumber(bucket.real);
      const metaVal = toNumber(bucket.meta);
      let cls = "hm-cell hm-val";
      let text = "—";
      let title = "";

      if (metaVal > 0){
        const pct = (realVal / metaVal) * 100;
        const pctDisplay = Math.round(pct);
        cls += pct < 50 ? " hm-bad" : (pct < 100 ? " hm-warn" : " hm-ok");
        text = `${pctDisplay}%`;
        title = `Atingimento: ${pct.toFixed(1)}%`;
      } else if (realVal > 0){
        cls += " hm-empty";
        title = "Meta não informada";
      } else {
        cls += " hm-empty";
        title = "Sem dados";
      }

      html += `<div class="${cls}" data-u="${escapeHTML(unit.value)}"${title ? ` title="${escapeHTML(title)}"` : ""}>${text}</div>`;
    });
    html += `</div>`;
  });

  hm.innerHTML = html;

  const selector = EXEC_FILTER_SELECTORS[start];
  hm.querySelectorAll(".hm-val").forEach(cell => {
    if (cell.classList.contains("hm-empty")) return;
    cell.addEventListener("click", () => {
      const unitValue = cell.getAttribute("data-u");
      if (selector && unitValue){
        const sel = document.querySelector(selector);
        const option = sel && [...sel.options].find(opt => opt.value === unitValue);
        if (sel && option){
          sel.value = unitValue;
          sel.dispatchEvent(new Event("change"));
        }
      }
      state.tableView = "prodsub";
      document.querySelector('.tab[data-view="table"]')?.click();
    });
  });
}

function renderExecHeatmapMeta(hm, rows, period){
  if (!hm) return;
  const monthKeys = buildMonthlyAxis(period);
  if (!monthKeys.length){
    hm.innerHTML = `<div class="muted">Sem dados para exibir.</div>`;
    return;
  }

  const monthLabels = monthKeys.map(monthKeyLabel);
  const template = () => monthKeys.reduce((acc, key) => (acc[key] = 0, acc), {});
  const monthSet = new Set(monthKeys);

  const levels = [
    { key: "diretoria",       filterKey: "diretoria", label: "Diretoria", plural: "Diretorias" },
    { key: "gerenciaRegional", filterKey: "gerencia",  label: "Regional",  plural: "Regionais" },
    { key: "agencia",         filterKey: "agencia",   label: "Agência",   plural: "Agências" },
    { key: "gerenteGestao",   filterKey: "ggestao",   label: "Ger. de Gestão", plural: "Ger. de Gestão" },
    { key: "gerente",         filterKey: "gerente",   label: "Gerente",   plural: "Gerentes" }
  ];

  const dataByLevel = new Map(levels.map(level => [
    level.key,
    new Map([["__total__", { id: "__total__", label: `Todas as ${level.plural}`, meta: template() }]])
  ]));

  rows.forEach(row => {
    const monthKey = normalizeMonthKey(row.competencia || row.mes || row.data || row.dataReferencia || row.dt);
    if (!monthSet.has(monthKey)) return;
    const metaValue = toNumber(row.meta_mens ?? row.meta ?? 0);
    levels.forEach(level => {
      const levelMap = dataByLevel.get(level.key);
      if (!levelMap) return;
      const totalEntry = levelMap.get("__total__");
      totalEntry.meta[monthKey] += metaValue;
      const value = resolveExecValueForKey(row, level.key, "");
      if (!value) return;
      let entry = levelMap.get(value);
      if (!entry) {
        entry = { id: value, label: resolveExecLabelForKey(row, level.key, value) || value, meta: template() };
        levelMap.set(value, entry);
      }
      entry.meta[monthKey] += metaValue;
    });
  });

  const filters = getFilterValues();
  const rowStyle = ` style="--hm-cols:${monthKeys.length}; --hm-first:220px; --hm-cell:120px"`;
  let html = `<div class="hm-row hm-head"${rowStyle}><div class="hm-cell hm-corner">Hierarquia \\ Mês</div>${
    monthLabels.map(label => `<div class="hm-cell hm-col">${escapeHTML(label)}</div>`).join("")
  }</div>`;

  levels.forEach(level => {
    const levelMap = dataByLevel.get(level.key);
    if (!levelMap) return;
    const filterValue = filters[level.filterKey];
    const normalizedFilter = filterValue && filterValue !== "Todos" && filterValue !== "Todas" ? filterValue : "";
    let entry = normalizedFilter && levelMap.get(normalizedFilter);
    if (!entry){
      const candidates = [...levelMap.keys()].filter(key => key !== "__total__");
      if (candidates.length === 1) {
        entry = levelMap.get(candidates[0]);
      }
    }
    if (!entry) entry = levelMap.get("__total__");
    if (!entry) return;

    html += `<div class="hm-row hm-meta"${rowStyle}><div class="hm-cell hm-rowh">${escapeHTML(entry.label)}</div>`;
    monthKeys.forEach((key, idx) => {
      const currentMeta = entry.meta[key] ?? 0;
      const prevKey = idx > 0 ? monthKeys[idx - 1] : null;
      const prevMeta = prevKey ? entry.meta[prevKey] ?? 0 : null;
      let delta = null;
      if (prevKey){
        if (prevMeta > 0) {
          delta = ((currentMeta - prevMeta) / prevMeta) * 100;
        } else if (currentMeta === 0) {
          delta = 0;
        }
      }

      let cls = "hm-cell hm-meta";
      let text = "—";
      if (delta == null) {
        cls += " hm-empty";
      } else if (delta < 0) {
        cls += " hm-down";
        text = `${delta.toFixed(1)}%`;
      } else if (delta === 0) {
        cls += " hm-ok";
        text = `0.0%`;
      } else if (delta <= 5) {
        cls += " hm-ok";
        text = `+${delta.toFixed(1)}%`;
      } else if (delta <= 10) {
        cls += " hm-warn";
        text = `+${delta.toFixed(1)}%`;
      } else {
        cls += " hm-alert";
        text = `+${delta.toFixed(1)}%`;
      }

      const monthLabel = monthLabels[idx];
      const prevLabel = prevKey ? monthLabels[idx - 1] : "";
      let title = `Meta ${monthLabel}: ${fmtBRL.format(Math.round(currentMeta))}`;
      if (prevKey){
        title += ` · Anterior (${prevLabel}): ${fmtBRL.format(Math.round(prevMeta ?? 0))}`;
        title += delta != null ? ` · Variação: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : ` · Variação: —`;
      }

      html += `<div class="${cls}" title="${escapeHTML(title)}">${text}</div>`;
    });
    html += `</div>`;
  });

  hm.innerHTML = html;
}

/* ===== Aqui eu calculo e exibo os rankings de cada nível ===== */
/* ===== Aqui eu trato toda a lógica das campanhas e simuladores ===== */
function currentSprintConfig(){
  if (!Array.isArray(CAMPAIGN_SPRINTS) || !CAMPAIGN_SPRINTS.length) return null;
  const id = state.campanhas?.sprintId;
  return CAMPAIGN_SPRINTS.find(s => s.id === id) || CAMPAIGN_SPRINTS[0];
}

function ensureCampanhasView(){
  const host = document.getElementById("view-campanhas");
  if (!host) return;
  if (!CAMPAIGN_SPRINTS.length) {
    host.innerHTML = `<section class="card card--campanhas"><p class="muted">Nenhuma campanha disponível.</p></section>`;
    return;
  }

  const select = document.getElementById("campanha-sprint");
  if (select && !select.dataset.bound) {
    select.dataset.bound = "1";
    select.addEventListener("change", (ev) => {
      state.campanhas.sprintId = ev.target.value;
      renderCampanhasView();
    });
  }
}

function ensureTeamValuesForSprint(sprint){
  if (!sprint || !state.campanhas) return {};
  const store = state.campanhas.teamValues;
  if (!store[sprint.id]) {
    const base = {};
    (sprint.team?.indicators || []).forEach(ind => {
      base[ind.id] = toNumber(ind.default ?? 100);
    });
    store[sprint.id] = base;
    const defaultPreset = sprint.team?.defaultPreset || (sprint.team?.presets?.[0]?.id || "custom");
    state.campanhas.teamPreset[sprint.id] = defaultPreset;
  }
  return store[sprint.id];
}

function ensureIndividualValuesForProfile(sprint, profile){
  if (!sprint || !profile || !state.campanhas) return {};
  const bySprint = state.campanhas.individualValues[sprint.id] || (state.campanhas.individualValues[sprint.id] = {});
  if (!bySprint[profile.id]) {
    const base = {};
    (profile.indicators || []).forEach(ind => {
      base[ind.id] = toNumber(ind.default ?? 100);
    });
    bySprint[profile.id] = base;
    const key = `${sprint.id}:${profile.id}`;
    const defaultPreset = profile.defaultPreset || (profile.presets?.[0]?.id || "custom");
    state.campanhas.individualPreset[key] = defaultPreset;
  }
  return bySprint[profile.id];
}

function detectPresetMatch(values, presets){
  if (!values || !Array.isArray(presets)) return null;
  return presets.find(preset => {
    const pairs = Object.entries(preset.values || {});
    return pairs.every(([key, val]) => Math.round(toNumber(val)) === Math.round(toNumber(values[key])));
  })?.id || null;
}

function formatCampPoints(value){
  return `${fmtINT.format(Math.round(toNumber(value)))} pts`;
}

function formatCampPercent(value){
  return `${fmtONE.format(toNumber(value))}%`;
}

function computeCampaignScore(config, values){
  const indicators = config?.indicators || [];
  const min = toNumber(config?.minThreshold ?? 90);
  const stretch = toNumber(config?.superThreshold ?? (min + 20));
  const cap = toNumber(config?.cap ?? 150);
  const minTotal = toNumber(config?.eligibilityMinimum ?? 100) || 100;

  const rows = indicators.map(ind => {
    const raw = Math.max(0, toNumber(values?.[ind.id] ?? ind.default ?? 0));
    const capped = Math.min(cap, raw);
    const points = (toNumber(ind.weight) * capped) / 100;
    let statusText = "Crítico";
    let statusClass = "status-pill--alert";
    if (raw >= stretch) {
      statusText = "Parabéns";
      statusClass = "status-pill--great";
    } else if (raw >= min) {
      statusText = "Elegível";
      statusClass = "status-pill--ok";
    } else if (raw >= Math.max(0, min - 10)) {
      statusText = "Ajustar";
      statusClass = "status-pill--warn";
    }
    return { ...ind, pct: raw, capped, points, statusText, statusClass };
  });

  const totalPoints = rows.reduce((acc, row) => acc + row.points, 0);
  const hasAllMin = rows.every(row => row.pct >= min);
  const hasAllStretch = rows.every(row => row.pct >= stretch);
  const eligible = hasAllMin && totalPoints >= minTotal;

  let finalStatus = "Não elegível";
  let finalClass = "status-tag--alert";
  if (hasAllStretch && totalPoints >= minTotal) {
    finalStatus = "Parabéns";
    finalClass = "status-tag--great";
  } else if (eligible) {
    finalStatus = "Elegível";
    finalClass = "status-tag--ok";
  } else if (hasAllMin) {
    finalStatus = "Ajustar foco";
    finalClass = "status-tag--warn";
  }

  const shortfall = Math.max(0, minTotal - totalPoints);
  const progressPct = minTotal ? Math.max(0, Math.min(1, totalPoints / minTotal)) : 0;
  const progressLabel = shortfall > 0
    ? `${fmtINT.format(Math.round(shortfall))} pts para elegibilidade`
    : (hasAllStretch ? "Acima do stretch" : "Meta mínima atingida");

  return { rows, totalPoints, finalStatus, finalClass, progressPct, progressLabel, shortfall, hasAllMin, hasAllStretch, minThreshold: min, superThreshold: stretch, cap, eligibilityMinimum: minTotal };
}

function teamPresetForSprint(sprint){
  return state.campanhas.teamPreset[sprint.id] || "custom";
}

function setTeamPresetForSprint(sprint, presetId){
  state.campanhas.teamPreset[sprint.id] = presetId || "custom";
}

function individualPresetKey(sprint, profile){
  return `${sprint.id}:${profile.id}`;
}

function individualPresetForProfile(sprint, profile){
  return state.campanhas.individualPreset[individualPresetKey(sprint, profile)] || "custom";
}

function setIndividualPresetForProfile(sprint, profile, presetId){
  state.campanhas.individualPreset[individualPresetKey(sprint, profile)] = presetId || "custom";
}

function buildTeamSimulator(container, sprint){
  if (!container || !sprint?.team) return;
  if (container.dataset.sprintId === sprint.id) return;
  container.dataset.sprintId = sprint.id;

  const indicators = sprint.team.indicators || [];
  const presets = sprint.team.presets || [];

  container.innerHTML = `
    <div class="sim-card__head">
      <div class="sim-card__title">
        <h5>Simulador de equipe</h5>
        <button type="button" class="sim-help" aria-label="Como funciona o simulador de equipe" data-tip="Ajuste os percentuais de cada indicador entre 0% e 150%. A equipe se torna elegível com todos os indicadores a partir de 90% e somando pelo menos 100 pontos.">
          <i class="ti ti-info-circle"></i>
        </button>
      </div>
      <p>Defina o atingimento de cada indicador para estimar a pontuação e a elegibilidade da equipe.</p>
      <p class="sim-hint">Elegível com todos os indicadores ≥ 90% e pelo menos 100 pontos.</p>
    </div>
    <div class="sim-presets" id="team-presets">
      ${presets.map(p => `<button type="button" class="sim-chip" data-team-preset="${p.id}">${p.label}</button>`).join("")}
    </div>
    <table class="sim-table">
      <thead>
        <tr>
          <th>Indicador</th>
          <th>Peso</th>
          <th>Atingimento</th>
          <th>Pontos</th>
          <th>Resultado</th>
        </tr>
      </thead>
      <tbody>
        ${indicators.map(ind => `
          <tr data-row="${ind.id}">
            <td class="sim-indicator" data-label="Indicador">
              <strong>${ind.label}</strong>
              ${ind.hint ? `<div class="muted" style="font-size:12px;">${ind.hint}</div>` : ""}
            </td>
            <td class="sim-weight" data-label="Peso">${fmtONE.format(toNumber(ind.weight))}%</td>
            <td data-label="Atingimento">
              <div class="sim-slider">
                <input type="range" min="0" max="160" step="1" data-indicator="${ind.id}" aria-label="${ind.label}" />
                <span class="sim-slider-value" data-output="${ind.id}"></span>
              </div>
            </td>
            <td class="sim-points" data-label="Pontos" data-points="${ind.id}"></td>
            <td data-label="Resultado"><span class="status-pill" data-status="${ind.id}"></span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="sim-summary">
      <div class="sim-total">
        <span>Pontuação total</span>
        <strong id="team-total-points"></strong>
      </div>
      <div class="sim-progress">
        <div class="sim-progress__track"><span class="sim-progress__fill" id="team-progress-bar"></span></div>
        <small id="team-progress-label"></small>
      </div>
      <div class="sim-outcome">
        <span id="team-status" class="status-tag"></span>
      </div>
    </div>
  `;

  container.querySelectorAll("input[type=range]").forEach(input => {
    input.addEventListener("input", (ev) => {
      const id = ev.currentTarget.dataset.indicator;
      const values = ensureTeamValuesForSprint(sprint);
      values[id] = toNumber(ev.currentTarget.value);
      updateTeamSimulator(container, sprint);
    });
  });

  container.querySelectorAll("[data-team-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      const presetId = btn.dataset.teamPreset;
      const preset = presets.find(p => p.id === presetId);
      if (!preset) return;
      const values = ensureTeamValuesForSprint(sprint);
      Object.entries(preset.values || {}).forEach(([key, val]) => {
        values[key] = toNumber(val);
      });
      setTeamPresetForSprint(sprint, presetId);
      updateTeamSimulator(container, sprint);
    });
  });
}

function updateTeamSimulator(container, sprint){
  if (!container || !sprint?.team) return;
  const values = ensureTeamValuesForSprint(sprint);
  const result = computeCampaignScore(sprint.team, values);

  (sprint.team.indicators || []).forEach(ind => {
    const row = container.querySelector(`tr[data-row="${ind.id}"]`);
    if (!row) return;
    const slider = row.querySelector("input[type=range]");
    if (slider && slider.value !== String(values[ind.id])) slider.value = String(values[ind.id]);
    const output = row.querySelector(`[data-output="${ind.id}"]`);
    if (output) output.textContent = formatCampPercent(values[ind.id] ?? 0);
    const pointsCell = row.querySelector(`[data-points="${ind.id}"]`);
    const rowData = result.rows.find(r => r.id === ind.id);
    if (pointsCell && rowData) pointsCell.textContent = formatCampPoints(rowData.points);
    const statusEl = row.querySelector(`[data-status="${ind.id}"]`);
    if (statusEl && rowData) {
      statusEl.textContent = rowData.statusText;
      statusEl.className = `status-pill ${rowData.statusClass}`;
    }
  });

  const presetMatch = detectPresetMatch(values, sprint.team.presets);
  setTeamPresetForSprint(sprint, presetMatch || "custom");
  const activePreset = teamPresetForSprint(sprint);
  container.querySelectorAll("[data-team-preset]").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.teamPreset === activePreset);
  });

  const totalEl = container.querySelector("#team-total-points");
  if (totalEl) totalEl.textContent = formatCampPoints(result.totalPoints);
  const statusEl = container.querySelector("#team-status");
  if (statusEl) {
    statusEl.textContent = result.finalStatus;
    statusEl.className = `status-tag ${result.finalClass}`;
  }
  const progressBar = container.querySelector("#team-progress-bar");
  if (progressBar) {
    const pct = Math.max(0, Math.min(100, Math.round(result.progressPct * 100)));
    progressBar.style.width = "";
    progressBar.style.setProperty("--target", `${pct}%`);
    const trackEl = progressBar.parentElement;
    if (trackEl) {
      let animateBar = true;
      const teamMap = state.animations?.campanhas?.team;
      const sprintKey = sprint?.id || "__default__";
      if (teamMap instanceof Map) {
        const prev = teamMap.get(sprintKey);
        animateBar = shouldAnimateDelta(prev, pct, 0.5);
        teamMap.set(sprintKey, pct);
      }
      triggerBarAnimation(trackEl, animateBar);
    }
  }
  const progressLabel = container.querySelector("#team-progress-label");
  if (progressLabel) progressLabel.textContent = result.progressLabel;
}

function buildIndividualSimulator(container, sprint, profile){
  if (!container || !sprint || !profile) return;
  const key = `${sprint.id}:${profile.id}`;
  if (container.dataset.profileKey === key) return;
  container.dataset.profileKey = key;

  const profiles = sprint.individual?.profiles || [];
  const presets = profile.presets || [];

  container.innerHTML = `
    <div class="sim-card__head">
      <div class="sim-card__title">
        <h5>Simulador individual</h5>
        <button type="button" class="sim-help" aria-label="Como funciona o simulador individual" data-tip="Escolha um perfil, use os presets ou ajuste manualmente. Para elegibilidade é necessário atingir 90% em cada indicador e acumular 100 pontos ou mais.">
          <i class="ti ti-info-circle"></i>
        </button>
      </div>
      <p>Simule o desempenho de um gerente considerando os mesmos pesos da campanha.</p>
      <p id="individual-description" class="sim-hint">${profile.description || ""}</p>
    </div>
    <div class="segmented seg-mini" role="tablist" id="individual-profiles">
      ${profiles.map(p => `<button type="button" class="seg-btn" data-profile="${p.id}">${p.label}</button>`).join("")}
    </div>
    <div class="sim-presets" id="individual-presets">
      ${presets.map(p => `<button type="button" class="sim-chip" data-individual-preset="${p.id}">${p.label}</button>`).join("")}
    </div>
    <table class="sim-table">
      <thead>
        <tr>
          <th>Indicador</th>
          <th>Peso</th>
          <th>Atingimento</th>
          <th>Pontos</th>
          <th>Resultado</th>
        </tr>
      </thead>
      <tbody>
        ${(profile.indicators || []).map(ind => `
          <tr data-row="${ind.id}">
            <td class="sim-indicator" data-label="Indicador">
              <strong>${ind.label}</strong>
            </td>
            <td class="sim-weight" data-label="Peso">${fmtONE.format(toNumber(ind.weight))}%</td>
            <td data-label="Atingimento">
              <div class="sim-slider">
                <input type="range" min="0" max="160" step="1" data-indicator="${ind.id}" aria-label="${ind.label}" />
                <span class="sim-slider-value" data-output="${ind.id}"></span>
              </div>
            </td>
            <td class="sim-points" data-label="Pontos" data-points="${ind.id}"></td>
            <td data-label="Resultado"><span class="status-pill" data-status="${ind.id}"></span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="sim-summary">
      <div class="sim-total">
        <span>Pontuação total</span>
        <strong id="individual-total-points"></strong>
      </div>
      <div class="sim-progress">
        <div class="sim-progress__track"><span class="sim-progress__fill" id="individual-progress-bar"></span></div>
        <small id="individual-progress-label"></small>
      </div>
      <div class="sim-outcome">
        <span id="individual-status" class="status-tag"></span>
      </div>
    </div>
  `;

  container.querySelectorAll("#individual-profiles .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const profileId = btn.dataset.profile;
      if (!profileId) return;
      state.campanhas.individualProfile = profileId;
      renderCampanhasView();
    });
  });

  container.querySelectorAll("input[type=range]").forEach(input => {
    input.addEventListener("input", (ev) => {
      const id = ev.currentTarget.dataset.indicator;
      const values = ensureIndividualValuesForProfile(sprint, profile);
      values[id] = toNumber(ev.currentTarget.value);
      updateIndividualSimulator(container, sprint, profile);
    });
  });

  container.querySelectorAll("[data-individual-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      const presetId = btn.dataset.individualPreset;
      const preset = presets.find(p => p.id === presetId);
      if (!preset) return;
      const values = ensureIndividualValuesForProfile(sprint, profile);
      Object.entries(preset.values || {}).forEach(([key, val]) => {
        values[key] = toNumber(val);
      });
      setIndividualPresetForProfile(sprint, profile, presetId);
      updateIndividualSimulator(container, sprint, profile);
    });
  });

}

function updateIndividualSimulator(container, sprint, profile){
  if (!container || !sprint || !profile) return;
  const values = ensureIndividualValuesForProfile(sprint, profile);
  const result = computeCampaignScore(profile, values);

  container.querySelectorAll("#individual-profiles .seg-btn").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.profile === profile.id);
  });

  const desc = container.querySelector("#individual-description");
  if (desc) desc.textContent = profile.description || "";

  (profile.indicators || []).forEach(ind => {
    const row = container.querySelector(`tr[data-row="${ind.id}"]`);
    if (!row) return;
    const slider = row.querySelector("input[type=range]");
    if (slider && slider.value !== String(values[ind.id])) slider.value = String(values[ind.id]);
    const output = row.querySelector(`[data-output="${ind.id}"]`);
    if (output) output.textContent = formatCampPercent(values[ind.id] ?? 0);
    const rowData = result.rows.find(r => r.id === ind.id);
    const pointsCell = row.querySelector(`[data-points="${ind.id}"]`);
    if (pointsCell && rowData) pointsCell.textContent = formatCampPoints(rowData.points);
    const statusEl = row.querySelector(`[data-status="${ind.id}"]`);
    if (statusEl && rowData) {
      statusEl.textContent = rowData.statusText;
      statusEl.className = `status-pill ${rowData.statusClass}`;
    }
  });

  const presetMatch = detectPresetMatch(values, profile.presets);
  setIndividualPresetForProfile(sprint, profile, presetMatch || "custom");
  const activePreset = individualPresetForProfile(sprint, profile);
  container.querySelectorAll("[data-individual-preset]").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.individualPreset === activePreset);
  });

  const totalEl = container.querySelector("#individual-total-points");
  if (totalEl) totalEl.textContent = formatCampPoints(result.totalPoints);
  const statusEl = container.querySelector("#individual-status");
  if (statusEl) {
    statusEl.textContent = result.finalStatus;
    statusEl.className = `status-tag ${result.finalClass}`;
  }
  const progressBar = container.querySelector("#individual-progress-bar");
  if (progressBar) {
    const pct = Math.max(0, Math.min(100, Math.round(result.progressPct * 100)));
    progressBar.style.width = "";
    progressBar.style.setProperty("--target", `${pct}%`);
    const trackEl = progressBar.parentElement;
    if (trackEl) {
      let animateBar = true;
      const individualMap = state.animations?.campanhas?.individual;
      const sprintKey = sprint?.id || "__default__";
      const profileKey = profile?.id || "__profile__";
      const animKey = `${sprintKey}:${profileKey}`;
      if (individualMap instanceof Map) {
        const prev = individualMap.get(animKey);
        animateBar = shouldAnimateDelta(prev, pct, 0.5);
        individualMap.set(animKey, pct);
      }
      triggerBarAnimation(trackEl, animateBar);
    }
  }
  const progressLabel = container.querySelector("#individual-progress-label");
  if (progressLabel) progressLabel.textContent = result.progressLabel;

}

function badgeClassFromStatus(status){
  const norm = (status || "").toLowerCase();
  if (norm.includes("parab")) return "elegibility-badge elegibility-badge--great";
  if (norm.includes("não") || norm.includes("nao")) return "elegibility-badge elegibility-badge--warn";
  if (norm.includes("ajust")) return "elegibility-badge elegibility-badge--warn";
  return "elegibility-badge elegibility-badge--ok";
}

function renderCampaignRanking(container, sprint, options = {}){
  if (!container) return;
  const rows = options.rows || [];
  if (!rows.length) {
    container.innerHTML = `<p class="muted">Nenhum resultado disponível.</p>`;
    return;
  }

  const columnLabel = options.columnLabel || "Unidade";
  const config = sprint.team;
  const cap = Math.max(1, toNumber(config?.cap ?? 150));
  const prevRanking = (state.animations?.campanhas?.ranking instanceof Map)
    ? state.animations.campanhas.ranking
    : new Map();
  const nextRanking = new Map();

  const computeFill = (indicatorRow) => {
    const capped = toNumber(indicatorRow?.capped);
    if (!cap) return 0;
    const pct = (capped / cap) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const body = rows.map((row, idx) => {
    const result = row.result || computeCampaignScore(config, { linhas: row.linhas, cash: row.cash, conquista: row.conquista });
    const linhas = result.rows.find(r => r.id === "linhas");
    const cash = result.rows.find(r => r.id === "cash");
    const conquista = result.rows.find(r => r.id === "conquista");
    const badgeClass = badgeClassFromStatus(row.finalStatus || result.finalStatus);
    const statusText = escapeHTML(row.finalStatus || result.finalStatus || "—");
    const rank = row.rank != null ? row.rank : (idx + 1);
    const unitKey = row.key || row.name || `row-${idx}`;
    const safeUnitKey = escapeHTML(unitKey);
    const safeName = escapeHTML(row.name || row.key || "—");

    const linhasFill = Number(computeFill(linhas).toFixed(2));
    const cashFill = Number(computeFill(cash).toFixed(2));
    const conquistaFill = Number(computeFill(conquista).toFixed(2));

    nextRanking.set(`${unitKey}|linhas`, linhasFill);
    nextRanking.set(`${unitKey}|cash`, cashFill);
    nextRanking.set(`${unitKey}|conquista`, conquistaFill);

    const linhasPctLabel = escapeHTML(formatCampPercent(row.linhas));
    const cashPctLabel = escapeHTML(formatCampPercent(row.cash));
    const conquistaPctLabel = escapeHTML(formatCampPercent(row.conquista));

    const linhasPoints = formatCampPoints(linhas?.points || 0);
    const cashPoints = formatCampPoints(cash?.points || 0);
    const conquistaPoints = formatCampPoints(conquista?.points || 0);
    const totalPoints = formatCampPoints(result.totalPoints);

    return `
      <tr data-unit-key="${safeUnitKey}" data-rank="${rank}">
        <td class="pos-col">${rank}</td>
        <td class="regional-col">${safeName}</td>
        <td>
          <div class="indicator-bar">
            <div class="indicator-bar__track" data-metric="linhas" data-fill="${linhasFill.toFixed(2)}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(linhasFill)}" aria-valuetext="${linhasPctLabel}">
              <span style="--target:${linhasFill.toFixed(2)}%;"></span>
            </div>
            <div class="indicator-bar__value">${linhasPctLabel}</div>
          </div>
          <div class="indicator-bar__points">${linhasPoints}</div>
        </td>
        <td>
          <div class="indicator-bar">
            <div class="indicator-bar__track" data-metric="cash" data-fill="${cashFill.toFixed(2)}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(cashFill)}" aria-valuetext="${cashPctLabel}">
              <span style="--target:${cashFill.toFixed(2)}%;"></span>
            </div>
            <div class="indicator-bar__value">${cashPctLabel}</div>
          </div>
          <div class="indicator-bar__points">${cashPoints}</div>
        </td>
        <td>
          <div class="indicator-bar">
            <div class="indicator-bar__track" data-metric="conquista" data-fill="${conquistaFill.toFixed(2)}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(conquistaFill)}" aria-valuetext="${conquistaPctLabel}">
              <span style="--target:${conquistaFill.toFixed(2)}%;"></span>
            </div>
            <div class="indicator-bar__value">${conquistaPctLabel}</div>
          </div>
          <div class="indicator-bar__points">${conquistaPoints}</div>
        </td>
        <td>${totalPoints}</td>
        <td>${row.atividade ? "Sim" : "Não"}</td>
        <td><span class="${badgeClass}">${statusText}</span></td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <table class="camp-ranking-table">
      <thead>
        <tr>
          <th class="pos-col">#</th>
          <th class="regional-col">${columnLabel}</th>
          <th>Linhas governamentais</th>
          <th>Cash (TPV)</th>
          <th>Abertura de contas</th>
          <th>Pontuação final</th>
          <th>Atividade comercial</th>
          <th>Elegibilidade</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;

  const rowEls = container.querySelectorAll("tbody tr[data-unit-key]");
  rowEls.forEach(tr => {
    const unitKey = tr.dataset.unitKey || "";
    ["linhas", "cash", "conquista"].forEach(metric => {
      const track = tr.querySelector(`.indicator-bar__track[data-metric="${metric}"]`);
      if (!track) return;
      const fillValue = Number(track.dataset.fill || track.getAttribute("data-fill") || "0");
      const prevValue = prevRanking.get(`${unitKey}|${metric}`);
      const animateBar = shouldAnimateDelta(prevValue, fillValue, 0.25);
      triggerBarAnimation(track, animateBar);
    });
  });

  state.animations.campanhas.ranking = nextRanking;
}

function formatCampaignValidity(period) {
  const startISO = period?.start ? converterDataISO(period.start) : "";
  const endISO = period?.end ? converterDataISO(period.end) : "";
  if (!startISO && !endISO) return "";
  const startDate = startISO ? dateUTCFromISO(startISO) : null;
  const endDate = endISO ? dateUTCFromISO(endISO) : null;
  const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" });
  const endFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const capitalize = (txt) => txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : "";
  const startLabelRaw = startDate ? monthFormatter.format(startDate) : (startISO ? formatBRDate(startISO) : "");
  const startLabel = capitalize(startLabelRaw);
  const endLabel = endDate ? endFormatter.format(endDate) : (endISO ? formatBRDate(endISO) : "");
  if (startLabel && endLabel) return `Vigência da campanha: de ${startLabel} até ${endLabel}`;
  if (startLabel) return `Vigência da campanha a partir de ${startLabel}`;
  if (endLabel) return `Vigência da campanha até ${endLabel}`;
  return "";
}

function renderCampanhasView(){
  const host = document.getElementById("view-campanhas");
  if (!host) return;
  if (!Array.isArray(CAMPAIGN_SPRINTS) || !CAMPAIGN_SPRINTS.length) return;

  const sprint = currentSprintConfig();
  if (!sprint) return;

  const rankingContext = buildCampaignRankingContext(sprint);
  const summaryInfo = summarizeCampaignUnitResults(rankingContext.unitResults);
  const aggregatedRows = rankingContext.aggregated.slice().sort((a, b) => b.totalPoints - a.totalPoints);
  aggregatedRows.forEach((row, idx) => { row.rank = idx + 1; });

  const select = document.getElementById("campanha-sprint");
  if (select) {
    select.innerHTML = CAMPAIGN_SPRINTS.map(sp => `<option value="${sp.id}">${sp.label}</option>`).join("");
    select.value = sprint.id;
  }

  const cycleEl = document.getElementById("camp-cycle");
  if (cycleEl) {
    const selectedLabel = sprint.label || sprint.cycle || "";
    cycleEl.textContent = selectedLabel;
    if (sprint.cycle && sprint.cycle !== selectedLabel) {
      cycleEl.setAttribute("title", sprint.cycle);
    } else {
      cycleEl.removeAttribute("title");
    }
  }

  const noteEl = document.getElementById("camp-note");
  if (noteEl) {
    const metaInfo = rankingContext.levelInfo?.meta;
    const pluralLabel = metaInfo?.plural || "unidades";
    const visibleUnits = aggregatedRows.length;
    const base = sprint.note || "";
    const suffix = visibleUnits
      ? ` Exibindo ${fmtINT.format(visibleUnits)} ${pluralLabel} filtradas.`
      : " Nenhuma unidade encontrada para o filtro atual.";
    noteEl.textContent = `${base}${suffix}`.trim();
  }

  const validityEl = document.getElementById("camp-validity");
  if (validityEl) {
    const validityText = formatCampaignValidity(sprint.period || {});
    validityEl.textContent = validityText || "Vigência não informada";
  }

  const headline = document.getElementById("camp-headline");
  if (headline) {
    headline.innerHTML = (sprint.headStats || []).map(stat => `
      <div class="camp-hero__stat">
        <span>${stat.label}</span>
        <strong>${stat.value}</strong>
        ${stat.sub ? `<small>${stat.sub}</small>` : ""}
      </div>`).join("");
  }

  const kpiGrid = document.getElementById("camp-kpis");
  if (kpiGrid) {
    const summaryData = (sprint.summary || []).map(item => {
      if (item.id === "equipes") {
        return { ...item, value: summaryInfo.elegiveis, total: summaryInfo.total };
      }
      if (item.id === "media") {
        return { ...item, value: summaryInfo.media };
      }
      if (item.id === "recorde") {
        return { ...item, value: summaryInfo.recorde, complement: summaryInfo.destaque || item.complement || "" };
      }
      return item;
    });

    kpiGrid.innerHTML = summaryData.map(item => {
      if (item.total != null) {
        return `<div class="camp-kpi"><span>${item.label}</span><strong>${fmtINT.format(item.value)} / ${fmtINT.format(item.total)}</strong><small>de ${fmtINT.format(item.total)} monitoradas</small></div>`;
      }
      if (item.unit === "pts") {
        return `<div class="camp-kpi"><span>${item.label}</span><strong>${formatCampPoints(item.value)}</strong>${item.complement ? `<small>${item.complement}</small>` : ""}</div>`;
      }
      if (item.text) {
        return `<div class="camp-kpi"><span>${item.label}</span><strong>${item.text}</strong></div>`;
      }
      return `<div class="camp-kpi"><span>${item.label}</span><strong>${fmtONE.format(item.value)}</strong>${item.complement ? `<small>${item.complement}</small>` : ""}</div>`;
    }).join("");
  }

  const teamContainer = document.getElementById("sim-equipe");
  buildTeamSimulator(teamContainer, sprint);
  updateTeamSimulator(teamContainer, sprint);

  const profiles = sprint.individual?.profiles || [];
  if (!profiles.length) state.campanhas.individualProfile = null;
  if (profiles.length && !profiles.find(p => p.id === state.campanhas.individualProfile)) {
    state.campanhas.individualProfile = profiles[0].id;
  }
  const profile = profiles.find(p => p.id === state.campanhas.individualProfile) || profiles[0] || null;
  const individualContainer = document.getElementById("sim-individual");
  buildIndividualSimulator(individualContainer, sprint, profile);
  updateIndividualSimulator(individualContainer, sprint, profile);

  const rankingContainer = document.getElementById("camp-ranking");
  const rankingDesc = document.getElementById("camp-ranking-desc");
  if (rankingDesc) {
    const meta = rankingContext.levelInfo?.meta;
    const plural = meta?.plural || "unidades";
    const pluralLabel = plural.charAt(0).toUpperCase() + plural.slice(1);
    rankingDesc.textContent = `Acompanhe a performance das ${pluralLabel} e a elegibilidade frente aos critérios mínimos.`;
  }
  renderCampaignRanking(rankingContainer, sprint, {
    rows: aggregatedRows,
    columnLabel: rankingContext.levelInfo?.meta?.singular || "Unidade"
  });
}


function createRankingView(){
  const main = document.querySelector(".container"); 
  if(!main) return;
  if (document.getElementById("view-ranking")) return;

  const section = document.createElement("section");
  section.id="view-ranking"; section.className="hidden view-panel";
  section.innerHTML = `
    <section class="card card--ranking">
      <header class="card__header rk-head">
        <div class="title-subtitle">
          <h3>Rankings</h3>
          <p class="muted">Compare diferentes visões respeitando os filtros aplicados.</p>
        </div>
        <div class="rk-head__controls">
          <div class="rk-control">
            <label for="rk-type" class="muted">Tipo de ranking</label>
            <select id="rk-type" class="input input--sm">
              <option value="pobj">Ranking POBJ</option>
              <option value="produto">Ranking por produto</option>
            </select>
          </div>
          <div class="rk-product-controls" id="rk-product-wrapper" hidden>
            <div class="segmented seg-mini" id="rk-product-mode" role="group" aria-label="Modo do ranking por produto">
              <button type="button" class="seg-btn" data-mode="melhores">Melhores</button>
              <button type="button" class="seg-btn" data-mode="piores">Piores</button>
            </div>
          </div>
        </div>
      </header>

      <div class="rk-summary" id="rk-summary"></div>
      <div id="rk-table"></div>
    </section>`;
  main.appendChild(section);

  const typeSelect = section.querySelector('#rk-type');
  const modeGroup = section.querySelector('#rk-product-mode');

  typeSelect?.addEventListener('change', () => {
    state.rk.type = typeSelect.value;
    renderRanking();
  });

  modeGroup?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-mode]');
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (!mode || mode === state.rk.productMode) return;
    state.rk.productMode = mode;
    renderRanking();
  });
}
function currentUnitForLevel(level){
  const f=getFilterValues();
  switch(level){
    case "gerente":
      if (f.gerente && f.gerente!=="Todos") return f.gerente;
      return CURRENT_USER_CONTEXT.gerente || "";
    case "agencia":
      if (f.agencia && f.agencia!=="Todas") return f.agencia;
      return CURRENT_USER_CONTEXT.agencia || "";
    case "gerencia":
      if (f.gerencia && f.gerencia!=="Todas") return f.gerencia;
      return CURRENT_USER_CONTEXT.gerencia || "";
    case "diretoria":
      if (f.diretoria && f.diretoria!=="Todas") return f.diretoria;
      return CURRENT_USER_CONTEXT.diretoria || "";
    default:
      return "";
  }
}
function rkGroupCount(level){
  if(level==="diretoria") return 4;
  if(level==="gerencia")  return 8;
  if(level==="agencia")   return 15;
  return 12;
}
function deriveRankingLevelFromFilters(){
  const f = getFilterValues();
  if(f.gerente && f.gerente!=="Todos")   return "gerente";
  if(f.agencia && f.agencia!=="Todas")   return "agencia";
  if(f.gerencia && f.gerencia!=="Todas") return "gerencia";
  if(f.diretoria && f.diretoria!=="Todas") return "diretoria";
  return "agencia";
}
function aggRanking(rows, level){
  const keyMap = { diretoria:"diretoria", gerencia:"gerenciaRegional", agencia:"agencia", gerente:"gerente" };
  const k = keyMap[level] || "agencia";
  const labelFieldMap = { diretoria:"diretoriaNome", gerencia:"gerenciaNome", agencia:"agenciaNome", gerente:"gerenteNome" };
  const labelField = labelFieldMap[level] || k;
  const map = new Map();
  rows.forEach(r=>{
    const key=r[k] || "—";
    const label = r[labelField] || key;
    const obj = map.get(key) || { unidade:key, label, real_mens:0, meta_mens:0, real_acum:0, meta_acum:0, qtd:0 };
    obj.label = label;
    obj.real_mens += (r.real_mens ?? r.realizado ?? 0);
    obj.meta_mens += (r.meta_mens ?? r.meta ?? 0);
    obj.real_acum += (r.real_acum ?? r.realizado ?? 0);
    obj.meta_acum += (r.meta_acum ?? r.meta ?? 0);
    obj.qtd       += (r.qtd ?? 0);
    map.set(key,obj);
  });
  return [...map.values()].map(x=>{
    const ating_mens = x.meta_mens ? x.real_mens/x.meta_mens : 0;
    const ating_acum = x.meta_acum ? x.real_acum/x.meta_acum : 0;
    return { ...x, ating_mens, ating_acum, p_mens: ating_mens*100, p_acum: ating_acum*100 };
  });
}
function renderRanking(){
  const hostSum = document.getElementById("rk-summary");
  const hostTbl = document.getElementById("rk-table");
  if(!hostSum || !hostTbl) return;

  const typeSelect = document.getElementById("rk-type");
  const productWrapper = document.getElementById("rk-product-wrapper");
  const modeGroup = document.getElementById("rk-product-mode");

  const level = deriveRankingLevelFromFilters();
  state.rk.level = level;

  const type = state.rk.type || "pobj";
  if (typeSelect) typeSelect.value = type;
  if (productWrapper) productWrapper.hidden = (type !== "produto");

  const except = { [level]: true };
  const rowsBase = filterRowsExcept(state._rankingRaw, except, { searchTerm: "" });

  const gruposLimite = rkGroupCount(level);
  const myUnit = currentUnitForLevel(level);
  const levelNames = {
    diretoria: "Diretoria",
    gerencia: "Regional",
    agencia: "Agência",
    gerente: "Gerente"
  };
  const nivelNome = levelNames[level] || (level.charAt(0).toUpperCase() + level.slice(1));

  let data = [];
  let visibleRows = [];
  let summaryBadges = [];
  let myRankFull = "—";

  if (type === "produto") {
    const mode = state.rk.productMode === "piores" ? "piores" : "melhores";
    if (state.rk.productMode !== mode) state.rk.productMode = mode;
    if (modeGroup) {
      modeGroup.querySelectorAll('.seg-btn').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.mode === mode);
      });
    }

    const filters = getFilterValues();
    const hasProductFilter = !selecaoPadrao(filters.produtoId);
    const hasFamilyFilter = !selecaoPadrao(filters.familiaId);
    state.rk.product = hasProductFilter ? filters.produtoId : "";

    const selectLabel = (selector, value) => {
      if (!value || selecaoPadrao(value)) return "";
      const select = document.querySelector(selector);
      if (!select) return "";
      const options = Array.from(select.options || []);
      const desired = limparTexto(value);
      const match = options.find(opt => limparTexto(opt.value) === desired);
      return match?.textContent?.trim() || "";
    };

    const productLabelFromRow = (row = {}) => row?.produtoNome || row?.prodOrSub || row?.subproduto || row?.produto || "";
    const familyLabelFromRow = (row = {}) => row?.familiaNome || row?.familia || "";

    const hasAnyProductData = rowsBase.some(row =>
      Boolean(row?.produtoId || row?.prodOrSub || row?.produto || row?.subproduto)
    );
    if (!hasAnyProductData) {
      const badges = [
        `<span class="rk-badge"><strong>Nível:</strong> ${nivelNome}</span>`,
        `<span class="rk-badge"><strong>Modo:</strong> ${mode === 'piores' ? 'Piores resultados' : 'Melhores resultados'}</span>`
      ];
      hostSum.innerHTML = `<div class="rk-badges">${badges.join("")}</div>`;
      hostTbl.innerHTML = `<p class="rk-empty">Sem dados disponíveis para o ranking por produto com os filtros atuais.</p>`;
      return;
    }

    let contextBadge = "";
    let emptyMessage = "Sem dados disponíveis para o contexto selecionado.";
    let filteredRows = rowsBase.slice();

    if (hasProductFilter) {
      filteredRows = filteredRows.filter(row =>
        matchesSelection(filters.produtoId, row.produtoId, row.prodOrSub, row.produtoNome, row.subproduto, row.produto)
      );
      const label = selectLabel('#f-produto', filters.produtoId)
        || productLabelFromRow(filteredRows.find(row => productLabelFromRow(row)))
        || filters.produtoId;
      contextBadge = `<span class="rk-badge"><strong>Produto:</strong> ${escapeHTML(label || filters.produtoId)}</span>`;
      emptyMessage = "Ainda não há dados para o produto selecionado.";
    } else if (hasFamilyFilter) {
      filteredRows = filteredRows.filter(row =>
        matchesSelection(filters.familiaId, row.familiaId, row.familia, row.familiaNome)
      );
      const label = selectLabel('#f-familia', filters.familiaId)
        || familyLabelFromRow(filteredRows.find(row => familyLabelFromRow(row)))
        || filters.familiaId;
      contextBadge = `<span class="rk-badge"><strong>Família:</strong> ${escapeHTML(label || filters.familiaId)}</span>`;
      emptyMessage = "Ainda não há dados para a família selecionada.";
    } else {
      contextBadge = `<span class="rk-badge"><strong>Contexto:</strong> Todos os produtos</span>`;
      emptyMessage = "Sem dados disponíveis para o ranking selecionado.";
    }

    if (!filteredRows.length) {
      summaryBadges = [
        `<span class="rk-badge"><strong>Nível:</strong> ${nivelNome}</span>`,
        contextBadge,
        `<span class="rk-badge"><strong>Modo:</strong> ${mode === 'piores' ? 'Piores resultados' : 'Melhores resultados'}</span>`
      ].filter(Boolean);
      hostSum.innerHTML = summaryBadges.length ? `<div class="rk-badges">${summaryBadges.join("")}</div>` : "";
      hostTbl.innerHTML = `<p class="rk-empty">${emptyMessage}</p>`;
      return;
    }

    data = aggRanking(filteredRows, level);
    data.sort((a,b) => mode === 'piores' ? (a.p_acum - b.p_acum) : (b.p_acum - a.p_acum));
    visibleRows = data.slice(0, gruposLimite);

    const myIndexFull = myUnit ? data.findIndex(d => d.unidade === myUnit) : -1;
    if (myUnit && myIndexFull >= 0 && !visibleRows.some(r => r.unidade === myUnit)) {
      visibleRows.push(data[myIndexFull]);
    }
    myRankFull = myIndexFull >= 0 ? myIndexFull + 1 : "—";

    summaryBadges = [
      `<span class="rk-badge"><strong>Nível:</strong> ${nivelNome}</span>`,
      typeof myRankFull === "number" ? `<span class="rk-badge"><strong>Posição:</strong> ${fmtINT.format(myRankFull)}</span>` : "",
      contextBadge,
      `<span class="rk-badge"><strong>Modo:</strong> ${mode === 'piores' ? 'Piores resultados' : 'Melhores resultados'}</span>`,
      `<span class="rk-badge"><strong>Quantidade de participantes:</strong> ${fmtINT.format(data.length)}</span>`,
    ].filter(Boolean);
  } else {
    if (modeGroup) {
      modeGroup.querySelectorAll('.seg-btn').forEach(btn => btn.classList.remove('is-active'));
    }

    data = aggRanking(rowsBase, level);
    data.sort((a,b)=> (b.p_acum - a.p_acum));
    visibleRows = data.slice(0, gruposLimite);

    const myIndexFull = myUnit ? data.findIndex(d => d.unidade===myUnit) : -1;
    myRankFull = myIndexFull>=0 ? (myIndexFull+1) : "—";

    if (myUnit && myIndexFull >= 0 && !visibleRows.some(r => r.unidade === myUnit)) {
      visibleRows.push(data[myIndexFull]);
    }

    const grupoTexto = typeof myRankFull === "number" ? fmtINT.format(myRankFull) : myRankFull;
    summaryBadges = [
      `<span class="rk-badge"><strong>Nível:</strong> ${nivelNome}</span>`,
      `<span class="rk-badge"><strong>Número do grupo:</strong> ${grupoTexto}</span>`,
      `<span class="rk-badge"><strong>Quantidade de participantes:</strong> ${fmtINT.format(data.length)}</span>`,
    ];
  }

  hostSum.innerHTML = summaryBadges.length ? `<div class="rk-badges">${summaryBadges.join("")}</div>` : "";

  hostTbl.innerHTML = "";
  if (!visibleRows.length) {
    hostTbl.innerHTML = `<p class="rk-empty">Sem dados disponíveis para o ranking selecionado.</p>`;
    return;
  }

  const tbl = document.createElement("table");
  tbl.className = "rk-table";
  tbl.innerHTML = `
    <thead>
      <tr>
        <th class="pos-col">#</th>
        <th class="unit-col">Unidade</th>
        <th>Pontos (mensal)</th>
        <th>Pontos (acumulado)</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tb = tbl.querySelector("tbody");

  visibleRows.forEach((r,idx)=>{
    const fullIndex = data.findIndex(d => d.unidade === r.unidade);
    const rankNumber = fullIndex >= 0 ? (fullIndex + 1) : (idx + 1);
    const isMine = (myUnit && r.unidade === myUnit);
    const rawName = r.label || r.unidade || "—";
    const visibleName = isMine ? rawName : "*****";
    const nomeSafe = escapeHTML(visibleName);
    const titleSafe = escapeHTML(isMine ? rawName : "Participante oculto");
    const tr = document.createElement("tr");
    tr.className = `rk-row ${isMine? "rk-row--mine":""}`;
    tr.innerHTML = `
      <td class="pos-col">${rankNumber}</td>
      <td class="unit-col rk-name" title="${titleSafe}">${nomeSafe}</td>
      <td>${r.p_mens.toFixed(1)}</td>
      <td>${r.p_acum.toFixed(1)}</td>
    `;
    tb.appendChild(tr);
  });

  hostTbl.appendChild(tbl);
}

/* ===== Aqui eu renderizo a tabela em árvore usada no detalhamento ===== */
function openDetailOpportunities(node = {}, trail = []){
  const detail = {
    node,
    trail: Array.isArray(trail) ? [...trail] : [],
    label: node?.label || "",
    type: node?.type || "",
    level: node?.level ?? null,
    levelKey: node?.levelKey || "",
    lineage: Array.isArray(node?.lineage) ? node.lineage.map(entry => ({ ...entry })) : [],
  };
  try {
    document.dispatchEvent(new CustomEvent("detail:open-opportunities", { detail }));
  } catch (err) {
    console.warn("Não foi possível notificar oportunidades personalizadas:", err);
  }
  console.info("Detalhamento — oportunidades", detail);
  openOpportunityModal(detail);
}

function renderTreeTable() {
  ensureChipBarAndToolbar();
  renderDetailViewBar();

  const def = TABLE_VIEWS.find(v=> v.id === state.tableView) || TABLE_VIEWS[0];
  const rowsFiltered = filterRows(state._rankingRaw);
  const nodes = buildTree(rowsFiltered, def.id);
  const activeColumns = getActiveDetailColumns();
  const activeIds = new Set(activeColumns.map(col => col.id));

  let currentSortId = state.detailSort?.id || null;
  let currentSortDirection = state.detailSort?.direction || null;
  if (currentSortId && currentSortDirection) {
    if (currentSortId !== "__label__" && !activeIds.has(currentSortId)) {
      currentSortId = null;
      currentSortDirection = null;
      state.detailSort = { id: null, direction: null };
    }
  }

  const sortMeta = getDetailSortMeta(currentSortId);
  if (!sortMeta || !currentSortDirection) {
    currentSortId = null;
    currentSortDirection = null;
  }

  applyDetailSort(nodes, sortMeta, currentSortDirection);

  const host = document.getElementById("gridRanking");
  if (!host) return;
  host.innerHTML = "";

  const table = document.createElement("table");
  table.className = "tree-table";
  const iconFor = (columnId) => {
    if (currentSortId === columnId) {
      if (currentSortDirection === "asc") return "ti ti-arrow-up";
      if (currentSortDirection === "desc") return "ti ti-arrow-down";
    }
    return "ti ti-arrows-up-down";
  };
  const buildSortControl = (label, columnId, { sortable = true } = {}) => {
    const safeLabel = escapeHTML(label);
    const iconClass = iconFor(columnId);
    if (!sortable) {
      return `<button type="button" class="tree-sort" disabled aria-disabled="true">${safeLabel}<span class="tree-sort__icon"><i class="${iconClass}"></i></span></button>`;
    }
    const safeId = escapeHTML(columnId);
    const isActive = currentSortId === columnId && !!currentSortDirection;
    const ariaPressed = isActive ? "true" : "false";
    return `<button type="button" class="tree-sort" data-sort-id="${safeId}" aria-pressed="${ariaPressed}">${safeLabel}<span class="tree-sort__icon"><i class="${iconClass}"></i></span></button>`;
  };
  const buildHeaderCell = (label, columnId, { sortable = true, thClass = "" } = {}) => {
    const classAttr = thClass ? ` class="${thClass}"` : "";
    return `<th${classAttr}>${buildSortControl(label, columnId, { sortable })}</th>`;
  };
  const headerCells = [
    buildHeaderCell(def.label, "__label__"),
    ...activeColumns.map(col => buildHeaderCell(col.label, col.id)),
    buildHeaderCell("Ações", "__actions__", { sortable: false, thClass: "col-actions" }),
  ].join("");
  table.innerHTML = `
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  host.appendChild(table);

  table.querySelector("thead")?.addEventListener("click", (event) => {
    const btn = event.target.closest(".tree-sort");
    if (!btn || btn.disabled) return;
    const sortId = btn.dataset.sortId;
    if (!sortId) return;
    const meta = getDetailSortMeta(sortId);
    if (!meta) return;
    const prev = state.detailSort || { id: null, direction: null };
    const defaultDir = meta.defaultDirection || (meta.sortType === "string" ? "asc" : "desc");
    const oppositeDir = defaultDir === "asc" ? "desc" : "asc";
    let nextDirection;
    if (prev.id !== sortId || !prev.direction) {
      nextDirection = defaultDir;
    } else if (prev.direction === defaultDir) {
      nextDirection = oppositeDir;
    } else if (prev.direction === oppositeDir) {
      nextDirection = null;
    } else {
      nextDirection = defaultDir;
    }
    if (nextDirection) {
      state.detailSort = { id: sortId, direction: nextDirection };
    } else {
      state.detailSort = { id: null, direction: null };
    }
    renderTreeTable();
  });

  if (state.compact) document.getElementById("table-section")?.classList.add("is-compact");
  else document.getElementById("table-section")?.classList.remove("is-compact");

  let seq=0; const mkId=()=>`n${++seq}`;

  const buildDetailTableHTML = (node = null) => {
    const groups = Array.isArray(node?.detailGroups) ? node.detailGroups : [];
    if (!groups.length) return "";
    const columns = DETAIL_SUBTABLE_COLUMNS;
    const rows = groups.map(group => {
      const cells = columns.map(col => `<td>${col.render(group)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    const cancelGroup = groups.find(g => g.dataCancelamento || g.motivoCancelamento);
    let alertHtml = "";
    if (cancelGroup) {
      const dateText = cancelGroup.dataCancelamento ? `Cancelado em ${formatBRDate(cancelGroup.dataCancelamento)}` : "";
      const reasonText = cancelGroup.motivoCancelamento ? cancelGroup.motivoCancelamento : "";
      const descriptionParts = [];
      if (dateText) descriptionParts.push(escapeHTML(dateText));
      if (reasonText) descriptionParts.push(escapeHTML(reasonText));
      const descriptionHtml = descriptionParts.join(" • ");
      alertHtml = `<div class="tree-detail__alert"><i class="ti ti-alert-triangle"></i><div><strong>Venda cancelada</strong>${descriptionHtml ? `<span>${descriptionHtml}</span>` : ""}</div></div>`;
    }

    return `
      <div class="tree-detail-wrapper">
        ${alertHtml}
        <table class="detail-table">
          <thead>
            <tr>${columns.map(col => `<th>${escapeHTML(col.label)}</th>`).join("")}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  function renderNode(node, parentId=null, parentTrail=[]){
    const id=mkId(), has=!!(node.children&&node.children.length);
    const tr=document.createElement("tr");
    tr.className=`tree-row ${node.type==="contrato"?"type-contrato":""} lvl-${node.level}`;
    tr.dataset.id=id; if(parentId) tr.dataset.parent=parentId;
    const trail=[...parentTrail, node.label];
    const hasDetails = node.type === "contrato" && Array.isArray(node.detailGroups) && node.detailGroups.length > 0;
    let detailTr=null;

    const cancelGroup = hasDetails ? node.detailGroups.find(g => g.dataCancelamento || g.motivoCancelamento) : null;
    const isCancelled = !!cancelGroup;

    if (hasDetails) tr.classList.add("has-detail");
    if (isCancelled) {
      tr.classList.add("is-cancelled");
      tr.dataset.cancelled = "1";
    }

    const rawLabelBase = (node.type === "contrato" || !node.detail?.gerente)
      ? (node.label || "—")
      : `Gerente: ${node.detail.gerente}`;
    const labelBase = escapeHTML(rawLabelBase);
    const fallbackLabel = escapeHTML(node.label || "—");

    let statusBadge = "";
    if (isCancelled) {
      const titleText = cancelGroup?.motivoCancelamento
        ? `Cancelado — ${cancelGroup.motivoCancelamento}`
        : "Cancelado";
      const safeTitle = escapeHTML(titleText);
      statusBadge = `<span class="tree-status tree-status--cancelled" title="${safeTitle}"><i class="ti ti-alert-triangle"></i> Cancelado</span>`;
    }

    const labelHtml = node.detail
      ? `<div class="tree-label"><span class="label-strong">${labelBase}</span>${statusBadge}</div>`
      : (statusBadge
        ? `<div class="tree-label"><span class="label-strong">${fallbackLabel}</span>${statusBadge}</div>`
        : `<span class="label-strong">${fallbackLabel}</span>`);

    const dataCells = activeColumns.map(col => {
      const cls = col.cellClass ? ` class="${col.cellClass}"` : "";
      const content = col.render(node);
      return `<td${cls}>${content}</td>`;
    }).join("");

    const canOpenOpportunities = node.levelKey !== "contrato" && node.type !== "contrato";
    const opportunityButtonHtml = canOpenOpportunities
      ? `<button type="button" class="icon-btn" title="Ver oportunidades"><i class="ti ti-bulb"></i></button>`
      : "";

    tr.innerHTML=`
      <td><div class="tree-cell">
        <button class="toggle" type="button" ${has?"":"disabled"} aria-label="${has?"Expandir/colapsar":""}"><i class="ti ${has?"ti-chevron-right":"ti-dot"}"></i></button>
        ${labelHtml}</div></td>
      ${dataCells}
      <td class="actions-cell">
        <span class="actions-group">
          <button type="button" class="icon-btn" title="Abrir chamado"><i class="ti ti-ticket"></i></button>
          ${opportunityButtonHtml}
        </span>
      </td>`;

    const [btnTicket, btnOpportunity] = tr.querySelectorAll(".icon-btn");
    btnTicket?.addEventListener("click",(ev)=>{ ev.stopPropagation(); window.open(TICKET_URL,"_blank"); });
    btnOpportunity?.addEventListener("click",(ev)=>{
      ev.stopPropagation();
      openDetailOpportunities(node, trail);
    });

    const btn=tr.querySelector(".toggle");
    if(btn && has){
      btn.addEventListener("click", ()=>{
        const isOpen=btn.dataset.open==="1";
        btn.dataset.open=isOpen?"0":"1";
        btn.querySelector("i").className=`ti ${isOpen?"ti-chevron-right":"ti-chevron-down"}`;
        toggleChildren(id, !isOpen);
      });
    }

    tbody.appendChild(tr);

    if (hasDetails){
      const detailHTML = buildDetailTableHTML(node);
      if (detailHTML){
        detailTr=document.createElement("tr");
        detailTr.className="tree-row tree-detail-row";
        detailTr.dataset.detailParent=id;
        detailTr.style.display="none";
        if (isCancelled) {
          detailTr.classList.add("is-cancelled-detail");
          detailTr.dataset.cancelled = "1";
        }
        const detailColspan = activeColumns.length + 2;
        detailTr.innerHTML=`<td colspan="${detailColspan}">${detailHTML}</td>`;
        tbody.appendChild(detailTr);

        tr.addEventListener("click", (ev)=>{
          if (ev.target.closest('.toggle') || ev.target.closest('.icon-btn')) return;
          const open = detailTr.style.display === "table-row";
          if (open){
            detailTr.style.display="none";
            tr.classList.remove("is-detail-open");
          } else {
            detailTr.style.display="table-row";
            tr.classList.add("is-detail-open");
          }
        });
      }
    }

    if(has){
      node.children.forEach(ch=>renderNode(ch, id, trail));
      toggleChildren(id, false);
    }
  }

  function toggleChildren(parentId, show){
    const kids=[...tbody.querySelectorAll(`tr[data-parent="${parentId}"]`)];
    kids.forEach(ch=>{
      ch.style.display=show?"table-row":"none";
      if(!show){
        const b=ch.querySelector(".toggle[data-open='1']");
        if(b){ b.dataset.open="0"; b.querySelector("i").className="ti ti-chevron-right"; }
        toggleChildren(ch.dataset.id,false);
      }
    });
    if(!show){
      const detail=tbody.querySelector(`tr.tree-detail-row[data-detail-parent="${parentId}"]`);
      if(detail){
        detail.style.display="none";
        const parentRow=tbody.querySelector(`tr[data-id="${parentId}"]`);
        parentRow?.classList.remove("is-detail-open");
      }
    }
  }

  nodes.forEach(n=>renderNode(n,null,[]));
}
function applyFiltersAndRender(){
  updatePeriodLabels();
  updateDashboardCards();
  if(state.tableRendered) renderTreeTable();
  if (state.activeView === "campanhas") renderCampanhasView();
}
function expandAllRows(){
  const tb=document.querySelector("#gridRanking tbody"); if(!tb) return;
  tb.querySelectorAll("tr").forEach(tr=>{
    const b=tr.querySelector("i.ti-chevron-right")?.parentElement;
    if(b && !b.disabled){ b.dataset.open="1"; b.querySelector("i").className="ti ti-chevron-down"; }
    if(tr.dataset.parent) tr.style.display="table-row";
  });
}
function collapseAllRows(){
  const tb=document.querySelector("#gridRanking tbody"); if(!tb) return;
  tb.querySelectorAll("tr").forEach(tr=>{
    const b=tr.querySelector("i.ti-chevron-down")?.parentElement || tr.querySelector(".toggle");
    if(b && !b.disabled){ b.dataset.open="0"; b.querySelector("i").className="ti ti-chevron-right"; }
    if(tr.dataset.parent) tr.style.display="none";
  });
}

/* ===== Aqui eu crio um tooltip simples para qualquer campo com elipse ===== */
function enableSimpleTooltip(){
  let tip = document.getElementById("__tip");
  if(!tip){
    tip = document.createElement("div");
    tip.id = "__tip";
    tip.className = "tip";
    document.body.appendChild(tip);
  }

  const moveTitlesToDataTip = (root = document) => {
    root.querySelectorAll('[title]').forEach(el => {
      if (
        el.closest('.kpi-tip') ||
        el.tagName === 'SVG' || el.tagName === 'USE' ||
        el.hasAttribute('data-native-title')
      ) return;

      const t = el.getAttribute('title');
      if (!t) return;
      el.setAttribute('data-tip', t);
      if(!el.hasAttribute('aria-label')) el.setAttribute('aria-label', t);
      el.removeAttribute('title');
    });
  };

  moveTitlesToDataTip();

  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'title') {
        const el = m.target;
        if (el.getAttribute && el.hasAttribute('title')) {
          moveTitlesToDataTip(el.parentNode || document);
        }
      }
      if (m.type === 'childList' && m.addedNodes?.length) {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) moveTitlesToDataTip(node);
        });
      }
    }
  });
  obs.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['title']
  });

  let raf = null;
  const show = (e) => {
    if(raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(()=>{
      const t = e.target.closest('[data-tip]');
      if(!t){ tip.classList.remove('is-on'); return; }
      tip.textContent = t.getAttribute('data-tip') || '';
      tip.classList.add('is-on');
      const pad = 12;
      const x = Math.min(window.innerWidth - tip.offsetWidth - pad, e.clientX + 14);
      const y = Math.min(window.innerHeight - tip.offsetHeight - pad, e.clientY + 16);
      tip.style.left = `${x}px`;
      tip.style.top  = `${y}px`;
    });
  };
  const hide = () => tip.classList.remove('is-on');

  document.addEventListener('mousemove', show, {passive:true});
  document.addEventListener('mouseleave', hide, true);
  window.addEventListener('scroll', hide, {passive:true});
}

/* ===== Aqui eu faço o refresh geral: carrego dados e redesenho tudo ===== */
async function refresh(){
  try{
    const dataset = await getData();
    state._dataset = dataset;
    state.facts = dataset.facts || state.facts;
    state._rankingRaw = (state.facts?.dados && state.facts.dados.length)
      ? state.facts.dados
      : (dataset.ranking || []);
    rebuildOpportunityLeads();
    updateContractAutocomplete();

    const right = document.getElementById("lbl-atualizacao");
    if(right){
      right.innerHTML = `
        <div class="period-inline">
          <span class="txt">
            De
            <strong><span id="lbl-periodo-inicio">${formatBRDate(state.period.start)}</span></strong>
            até
            <strong><span id="lbl-periodo-fim">${formatBRDate(state.period.end)}</span></strong>
          </span>
          <button id="btn-alterar-data" type="button" class="link-action">
            <i class="ti ti-chevron-down"></i> Alterar data
          </button>
        </div>`;
      document.getElementById("btn-alterar-data")?.addEventListener("click", (e)=> openDatePopover(e.currentTarget));
      updatePeriodLabels();
    }

    updateDashboardCards();
    reorderFiltersUI();
    renderAppliedFilters();
    if(state.tableRendered) renderTreeTable();

    if (state.activeView==="ranking") renderRanking();
    if (state.activeView==="exec")    renderExecutiveView();
    if (state.activeView==="campanhas") renderCampanhasView();

  }catch(e){
    console.error(e);
    alert("Falha ao carregar dados.");
  }
}



/* ===== Aqui eu escrevi um loader de CSV que aguenta diferentes codificações e separadores ===== */
async function loadCSVAuto(url) {
  // Busca como binário para poder detectar a codificação.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${url}: ${res.status}`);
  const buf = await res.arrayBuffer();

  // Tenta decodificar como UTF-8; se vier com � (replacement char), refaz como latin-1.
  let text = new TextDecoder("utf-8").decode(buf);
  if (text.includes("\uFFFD")) {
    text = new TextDecoder("iso-8859-1").decode(buf);
  }
  text = text.trim();

  // Descobre o separador pela 1ª linha (conta ; e ,)
  const first = (text.split(/\r?\n/)[0] || "");
  const semis = (first.match(/;/g) || []).length;
  const commas = (first.match(/,/g) || []).length;
  const delimiter = semis > commas ? ";" : ",";

  // Faz o parse com cabeçalho
  const parsed = Papa.parse(text, {
    header: true,
    delimiter,
    skipEmptyLines: true
  });

  if (parsed.errors && parsed.errors.length) {
    console.warn(`Avisos ao ler ${url}:`, parsed.errors);
  }

  return parsed.data; // array de objetos {coluna:valor}
}



/* ===== Aqui eu disparo o boot do painel assim que a página carrega ===== */
(async function(){
  ensureLoader();
  enableSimpleTooltip();
  injectStyles();
  setupUserMenu();
  await loadBaseData();
  initCombos();
  bindEvents();
  initMobileCarousel();
  wireClearFiltersButton();
  ensureStatusFilterInAdvanced();
  reorderFiltersUI();
  if (typeof setupOpportunityModal === "function") {
    setupOpportunityModal();
  }
  await refresh();
  ensureChatWidget();
})();