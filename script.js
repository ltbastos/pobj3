/* =====================================================================
   script.js • lógica simples, documentada e amigável para iniciantes
   ---------------------------------------------------------------------
   COMO ESTE ARQUIVO ESTÁ ORGANIZADO
   1. Dados de exemplo utilizados no painel (section "DADOS FICTÍCIOS").
   2. Constantes com textos e funções auxiliares (section "SUPORTES").
   3. Funções responsáveis por preencher filtros, cartões e tabela.
   4. Inicialização da página logo após o carregamento do DOM.

   Atenção: os dados são fictícios e foram criados apenas para demonstrar
   o funcionamento dos componentes. Para usar dados reais basta substituir
   a função `obterDados()` por uma requisição a um arquivo CSV ou API.
   ===================================================================== */

// ---------------------------------------------------------------------
// DADOS FICTÍCIOS
// ---------------------------------------------------------------------
// Cada objeto representa uma agência. Os nomes das propriedades são
// intuitivos para facilitar a manutenção.
const DADOS_BASE = [
  { diretoria: "Sul", regional: "Curitiba", agencia: "Agência Batel", gerente: "Ana Souza", meta: 520000, realizado: 548000 },
  { diretoria: "Sul", regional: "Curitiba", agencia: "Agência Cabral", gerente: "Bruno Andrade", meta: 460000, realizado: 389000 },
  { diretoria: "Sul", regional: "Porto Alegre", agencia: "Agência Moinhos", gerente: "Carla Menezes", meta: 480000, realizado: 512500 },
  { diretoria: "Sul", regional: "Porto Alegre", agencia: "Agência Centro Histórico", gerente: "Daniel Rosa", meta: 395000, realizado: 327800 },
  { diretoria: "Nordeste", regional: "Recife", agencia: "Agência Boa Viagem", gerente: "Eduarda Lima", meta: 410000, realizado: 415600 },
  { diretoria: "Nordeste", regional: "Recife", agencia: "Agência Derby", gerente: "Fernando Alves", meta: 430000, realizado: 398200 },
  { diretoria: "Nordeste", regional: "Salvador", agencia: "Agência Caminho das Árvores", gerente: "Gabriela Nunes", meta: 450000, realizado: 371900 },
  { diretoria: "Nordeste", regional: "Salvador", agencia: "Agência Pituba", gerente: "Heitor Martins", meta: 398000, realizado: 412200 },
  { diretoria: "Sudeste", regional: "São Paulo", agencia: "Agência Paulista", gerente: "Ícaro Figueiredo", meta: 720000, realizado: 754300 },
  { diretoria: "Sudeste", regional: "São Paulo", agencia: "Agência Faria Lima", gerente: "Juliana Campos", meta: 680000, realizado: 612450 },
  { diretoria: "Sudeste", regional: "Rio de Janeiro", agencia: "Agência Barra", gerente: "Karina Prado", meta: 540000, realizado: 522800 },
  { diretoria: "Sudeste", regional: "Rio de Janeiro", agencia: "Agência Centro Rio", gerente: "Lucas Azevedo", meta: 505000, realizado: 456000 }
];

// ---------------------------------------------------------------------
// SUPORTES: textos, formatações e utilidades gerais
// ---------------------------------------------------------------------
const DEFINICOES_STATUS = {
  atingida: {
    rotulo: "Meta atingida",
    descricao: "Atingimento igual ou acima de 100%",
  },
  atencao: {
    rotulo: "Em atenção",
    descricao: "Atingimento entre 85% e 99%",
  },
  critica: {
    rotulo: "Crítica",
    descricao: "Atingimento abaixo de 85%",
  },
};

const ORDEM_STATUS = ["atingida", "atencao", "critica"];

const formatoMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const formatoPercentual = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatoInteiro = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function classificarStatus(atingimento) {
  if (atingimento >= 1) return "atingida";
  if (atingimento >= 0.85) return "atencao";
  return "critica";
}

function obterDados() {
  // A função cria uma cópia para evitar alterações indesejadas
  return DADOS_BASE.map((item) => {
    const atingimento = item.realizado / item.meta;
    return {
      ...item,
      atingimento,
      status: classificarStatus(atingimento),
    };
  });
}

// ---------------------------------------------------------------------
// FUNÇÕES DE INTERFACE
// ---------------------------------------------------------------------
function prepararInterface() {
  const estado = {
    dadosOriginais: obterDados(),
    dadosFiltrados: [],
  };

  const elementos = {
    formulario: document.getElementById("form-filtros"),
    campoDiretoria: document.getElementById("filtro-diretoria"),
    campoRegional: document.getElementById("filtro-regional"),
    campoGerente: document.getElementById("filtro-gerente"),
    campoStatus: document.getElementById("filtro-status"),
    campoBusca: document.getElementById("filtro-pesquisa"),
    botaoLimpar: document.getElementById("botao-limpar"),
    areaCartoes: document.getElementById("area-cartoes"),
    corpoTabela: document.getElementById("corpo-tabela"),
    contadorRegistros: document.getElementById("contador-registros"),
  };

  preencherFiltrosIniciais(estado, elementos);
  configurarEventos(estado, elementos);
  aplicarFiltros(estado, elementos);
}

function preencherFiltrosIniciais(estado, elementos) {
  const { dadosOriginais } = estado;
  popularSelect(elementos.campoDiretoria, extrairUnicos(dadosOriginais, "diretoria"));
  popularSelect(elementos.campoRegional, extrairUnicos(dadosOriginais, "regional"));
  popularSelect(elementos.campoGerente, extrairUnicos(dadosOriginais, "gerente"));
  popularSelectStatus(elementos.campoStatus);
}

function popularSelect(select, valores, manterValor = false) {
  const placeholder = select.dataset.placeholder || "Todas as opções";
  const valorAnterior = manterValor ? select.value : "";
  const opcoesOrdenadas = [...valores].sort((a, b) => a.localeCompare(b, "pt-BR"));
  select.innerHTML = `<option value="">${placeholder}</option>`;
  opcoesOrdenadas.forEach((valor) => {
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = valor;
    select.appendChild(option);
  });
  if (manterValor && valorAnterior && opcoesOrdenadas.includes(valorAnterior)) {
    select.value = valorAnterior;
  }
}

function popularSelectStatus(select) {
  const placeholder = select.dataset.placeholder || "Todos os status";
  select.innerHTML = `<option value="">${placeholder}</option>`;
  ORDEM_STATUS.forEach((chave) => {
    const option = document.createElement("option");
    option.value = chave;
    option.textContent = DEFINICOES_STATUS[chave].rotulo;
    select.appendChild(option);
  });
}

function configurarEventos(estado, elementos) {
  const { formulario, botaoLimpar, campoDiretoria, campoRegional, campoGerente, campoStatus, campoBusca } = elementos;

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    aplicarFiltros(estado, elementos);
  });

  botaoLimpar.addEventListener("click", () => {
    formulario.reset();
    [campoDiretoria, campoRegional, campoGerente, campoStatus].forEach((select) => {
      if (select) select.selectedIndex = 0;
    });
    if (campoBusca) campoBusca.value = "";
    aplicarFiltros(estado, elementos);
    atualizarOpcoesDependentes(estado, elementos);
  });

  campoDiretoria.addEventListener("change", () => {
    atualizarOpcoesDependentes(estado, elementos);
  });

  campoRegional.addEventListener("change", () => {
    atualizarOpcoesDependentes(estado, elementos, { atualizarRegional: false });
  });
}

function atualizarOpcoesDependentes(estado, elementos, opcoes = { atualizarRegional: true }) {
  const { campoDiretoria, campoRegional, campoGerente } = elementos;
  const { dadosOriginais } = estado;
  const diretoriaSelecionada = campoDiretoria.value;
  const regionalSelecionada = campoRegional.value;

  if (opcoes.atualizarRegional !== false) {
    const baseRegional = diretoriaSelecionada
      ? dadosOriginais.filter((item) => item.diretoria === diretoriaSelecionada)
      : dadosOriginais;
    popularSelect(campoRegional, extrairUnicos(baseRegional, "regional"), true);
  }

  const baseGerente = (() => {
    if (diretoriaSelecionada && regionalSelecionada) {
      return dadosOriginais.filter(
        (item) => item.diretoria === diretoriaSelecionada && item.regional === regionalSelecionada,
      );
    }
    if (diretoriaSelecionada) {
      return dadosOriginais.filter((item) => item.diretoria === diretoriaSelecionada);
    }
    if (regionalSelecionada) {
      return dadosOriginais.filter((item) => item.regional === regionalSelecionada);
    }
    return dadosOriginais;
  })();
  popularSelect(campoGerente, extrairUnicos(baseGerente, "gerente"), true);
}

function aplicarFiltros(estado, elementos) {
  const { dadosOriginais } = estado;
  const {
    campoDiretoria,
    campoRegional,
    campoGerente,
    campoStatus,
    campoBusca,
    areaCartoes,
    corpoTabela,
    contadorRegistros,
  } = elementos;

  const termoBusca = normalizarTexto(campoBusca.value.trim());
  const diretoria = campoDiretoria.value;
  const regional = campoRegional.value;
  const gerente = campoGerente.value;
  const status = campoStatus.value;

  const filtrados = dadosOriginais.filter((item) => {
    if (diretoria && item.diretoria !== diretoria) return false;
    if (regional && item.regional !== regional) return false;
    if (gerente && item.gerente !== gerente) return false;
    if (status && item.status !== status) return false;

    if (termoBusca) {
      const conjunto = `${item.agencia} ${item.gerente}`;
      if (!normalizarTexto(conjunto).includes(termoBusca)) return false;
    }
    return true;
  });

  estado.dadosFiltrados = filtrados;
  atualizarCartoes(filtrados, areaCartoes);
  atualizarTabela(filtrados, corpoTabela);
  atualizarContador(filtrados, contadorRegistros);
}

function atualizarCartoes(dados, container) {
  if (!dados.length) {
    container.innerHTML = `<p class="texto-suave">Nenhum registro encontrado. Ajuste os filtros para visualizar resultados.</p>`;
    return;
  }

  const totalAgencias = dados.length;
  const totalMeta = dados.reduce((soma, item) => soma + item.meta, 0);
  const totalRealizado = dados.reduce((soma, item) => soma + item.realizado, 0);
  const mediaAtingimento = dados.reduce((soma, item) => soma + item.atingimento, 0) / totalAgencias;
  const atingidas = dados.filter((item) => item.status === "atingida").length;

  const cartoes = [
    {
      id: "card-agencias",
      titulo: "Unidades monitoradas",
      valor: formatoInteiro.format(totalAgencias),
      rodape: "Quantidade de agências exibidas na tabela",
    },
    {
      id: "card-meta",
      titulo: "Meta acumulada",
      valor: formatoMoeda.format(totalMeta),
      rodape: "Somatório das metas do período",
    },
    {
      id: "card-realizado",
      titulo: "Realizado acumulado",
      valor: formatoMoeda.format(totalRealizado),
      rodape: "Total alcançado pelas agências filtradas",
    },
    {
      id: "card-atingimento",
      titulo: "Atingimento médio",
      valor: formatoPercentual.format(mediaAtingimento),
      rodape: "Média simples do atingimento das agências",
    },
    {
      id: "card-atingidas",
      titulo: "Metas atingidas",
      valor: `${formatoInteiro.format(atingidas)} agências`,
      rodape: "Total de agências com desempenho acima ou igual a 100%",
    },
  ];

  container.innerHTML = cartoes
    .map(
      (cartao) => `
        <article class="card-resumo" id="${cartao.id}">
          <span class="card-resumo__titulo">${cartao.titulo}</span>
          <strong class="card-resumo__valor">${cartao.valor}</strong>
          <span class="card-resumo__rodape">${cartao.rodape}</span>
        </article>
      `,
    )
    .join("");
}

function atualizarTabela(dados, corpoTabela) {
  if (!dados.length) {
    corpoTabela.innerHTML = `
      <tr>
        <td colspan="8" class="texto-suave">Nenhum dado para exibir. Verifique os filtros selecionados.</td>
      </tr>`;
    return;
  }

  corpoTabela.innerHTML = dados.map(montarLinhaTabela).join("");
}

function montarLinhaTabela(item) {
  const definicaoStatus = DEFINICOES_STATUS[item.status];
  return `
    <tr>
      <td>${item.diretoria}</td>
      <td>${item.regional}</td>
      <td>${item.agencia}</td>
      <td>${item.gerente}</td>
      <td>${formatoMoeda.format(item.meta)}</td>
      <td>${formatoMoeda.format(item.realizado)}</td>
      <td>${formatoPercentual.format(item.atingimento)}</td>
      <td data-status="${item.status}" title="${definicaoStatus.descricao}">${definicaoStatus.rotulo}</td>
    </tr>
  `;
}

function atualizarContador(dados, elemento) {
  if (!dados.length) {
    elemento.textContent = "Nenhum registro encontrado";
    return;
  }
  const texto = dados.length === 1 ? "1 registro exibido" : `${dados.length} registros exibidos`;
  elemento.textContent = texto;
}

function extrairUnicos(lista, chave) {
  const valores = new Set();
  lista.forEach((item) => valores.add(item[chave]));
  return Array.from(valores);
}

// ---------------------------------------------------------------------
// INICIALIZAÇÃO
// ---------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", prepararInterface);
