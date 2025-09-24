/* =====================================================================
   script.js • Passo a passo totalmente comentado
   ---------------------------------------------------------------------
   COMO LER ESTE ARQUIVO
   1) Dados e configurações fixas (valores de exemplo e textos).
   2) Funções utilitárias para formatar números e preparar status.
   3) Funções que atualizam cada parte da interface (filtros, cards, tabela).
   4) Um bloco final que inicia tudo quando a página termina de carregar.

   Sempre que adaptar algo, deixe o seu comentário com a data e o motivo.
   Isso evita que você (ou outra pessoa) precise adivinhar intenções depois.
   ===================================================================== */

// ---------------------------------------------------------------------
// 1) DADOS DE EXEMPLO E CONFIGURAÇÕES FIXAS
// ---------------------------------------------------------------------

/**
 * Cada objeto representa uma agência monitorada.
 * Troque pelos seus dados reais mantendo os mesmos nomes de propriedades.
 */
const REGISTROS_EXEMPLO = [
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
  { diretoria: "Sudeste", regional: "Rio de Janeiro", agencia: "Agência Centro Rio", gerente: "Lucas Azevedo", meta: 505000, realizado: 456000 },
];

/**
 * Dicionário com os textos exibidos na coluna "Status da meta".
 * Se alterar as faixas de atingimento, mude a função `identificarStatus` abaixo.
 */
const STATUS_META = {
  atingida: { rotulo: "Meta atingida", descricao: "Atingimento igual ou acima de 100%" },
  atencao: { rotulo: "Em atenção", descricao: "Atingimento entre 85% e 99%" },
  critica: { rotulo: "Crítica", descricao: "Atingimento abaixo de 85%" },
};

/**
 * Ordem em que os status aparecem nos filtros.
 * Mantemos em uma constante para não depender da ordem do objeto acima.
 */
const ORDEM_STATUS_META = ["atingida", "atencao", "critica"];

// ---------------------------------------------------------------------
// 2) FUNÇÕES DE APOIO (FORMATAÇÃO E PREPARAÇÃO DOS DADOS)
// ---------------------------------------------------------------------

// Objetos Intl para reaproveitar formatações sem recriar a cada chamada.
const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const formatadorPercentual = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatadorInteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Formata um número para moeda brasileira. */
function formatarMoeda(valor) {
  return formatadorMoeda.format(valor);
}

/** Formata número decimal (0 a 1) para percentual legível. */
function formatarPercentual(valor) {
  return formatadorPercentual.format(valor);
}

/** Formata números inteiros (ex.: quantidade de registros). */
function formatarInteiro(valor) {
  return formatadorInteiro.format(valor);
}

/** Remove acentos e coloca texto em minúsculo para facilitar buscas. */
function normalizarTexto(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Define status textual com base no atingimento numérico. */
function identificarStatus(atingimento) {
  if (atingimento >= 1) return "atingida";
  if (atingimento >= 0.85) return "atencao";
  return "critica";
}

/**
 * Cria uma cópia da base de exemplo adicionando campos calculados.
 * - atingimento: realizado / meta
 * - status: chave usada pelos filtros e pela tabela
 */
function prepararRegistrosBase() {
  return REGISTROS_EXEMPLO.map((registro) => {
    const atingimento = registro.meta > 0 ? registro.realizado / registro.meta : 0;
    return {
      ...registro,
      atingimento,
      status: identificarStatus(atingimento),
    };
  });
}

// ---------------------------------------------------------------------
// 3) FUNÇÕES QUE CUIDAM DA INTERFACE
// ---------------------------------------------------------------------

/** Captura apenas uma vez os elementos usados diversas vezes. */
function obterElementosPrincipais() {
  return {
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
}

/**
 * Preenche os selects com os valores únicos encontrados na base.
 * O parâmetro `estado` guarda a base original e os dados filtrados.
 */
function prepararFiltrosIniciais(estado, elementos) {
  const { registrosOriginais } = estado;

  popularSelect(elementos.campoDiretoria, extrairValoresUnicos(registrosOriginais, "diretoria"));
  popularSelect(elementos.campoRegional, extrairValoresUnicos(registrosOriginais, "regional"));
  popularSelect(elementos.campoGerente, extrairValoresUnicos(registrosOriginais, "gerente"));
  popularSelectStatus(elementos.campoStatus);
}

/**
 * Atualiza o conteúdo de um campo select mantendo uma opção neutra.
 * Use `manterValor = true` quando o usuário já tiver escolhido algo.
 */
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

/** Campo de status usa textos amigáveis definidos em STATUS_META. */
function popularSelectStatus(select) {
  const placeholder = select.dataset.placeholder || "Todos os status";
  select.innerHTML = `<option value="">${placeholder}</option>`;

  ORDEM_STATUS_META.forEach((chave) => {
    const option = document.createElement("option");
    option.value = chave;
    option.textContent = STATUS_META[chave].rotulo;
    select.appendChild(option);
  });
}

/** Conecta botões e selects com suas ações. */
function registrarEventos(estado, elementos) {
  const {
    formulario,
    botaoLimpar,
    campoDiretoria,
    campoRegional,
    campoGerente,
    campoStatus,
  } = elementos;

  // Quando clicar em "Aplicar filtros", evita recarregar a página.
  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    aplicarFiltros(estado, elementos);
  });

  // Botão que reseta tudo e volta para a visão completa.
  botaoLimpar.addEventListener("click", () => {
    formulario.reset();
    [campoDiretoria, campoRegional, campoGerente, campoStatus].forEach((select) => {
      if (select) select.selectedIndex = 0;
    });
    if (elementos.campoBusca) elementos.campoBusca.value = "";
    aplicarFiltros(estado, elementos);
    atualizarFiltrosDependentes(estado, elementos);
  });

  // Quando muda a diretoria, atualizamos regionais e gerentes disponíveis.
  campoDiretoria.addEventListener("change", () => {
    atualizarFiltrosDependentes(estado, elementos);
  });

  // Quando muda a regional, ajustamos apenas os gerentes daquela região.
  campoRegional.addEventListener("change", () => {
    atualizarFiltrosDependentes(estado, elementos, { atualizarRegional: false });
  });
}

/**
 * Ajusta os selects "Regional" e "Gerente" com base no que foi escolhido.
 * Evita que apareçam opções sem relação com a diretoria selecionada.
 */
function atualizarFiltrosDependentes(estado, elementos, opcoes = { atualizarRegional: true }) {
  const { campoDiretoria, campoRegional, campoGerente } = elementos;
  const { registrosOriginais } = estado;

  const diretoriaSelecionada = campoDiretoria.value;
  const regionalSelecionada = campoRegional.value;

  if (opcoes.atualizarRegional !== false) {
    const baseRegional = diretoriaSelecionada
      ? registrosOriginais.filter((registro) => registro.diretoria === diretoriaSelecionada)
      : registrosOriginais;

    popularSelect(campoRegional, extrairValoresUnicos(baseRegional, "regional"), true);
  }

  const baseGerente = (() => {
    if (diretoriaSelecionada && regionalSelecionada) {
      return registrosOriginais.filter(
        (registro) => registro.diretoria === diretoriaSelecionada && registro.regional === regionalSelecionada,
      );
    }
    if (diretoriaSelecionada) {
      return registrosOriginais.filter((registro) => registro.diretoria === diretoriaSelecionada);
    }
    if (regionalSelecionada) {
      return registrosOriginais.filter((registro) => registro.regional === regionalSelecionada);
    }
    return registrosOriginais;
  })();

  popularSelect(campoGerente, extrairValoresUnicos(baseGerente, "gerente"), true);
}

/**
 * Filtra os registros conforme o que o usuário informou no formulário
 * e atualiza cards, tabela e contador em sequência.
 */
function aplicarFiltros(estado, elementos) {
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

  const termoBuscaBruto = campoBusca ? campoBusca.value.trim() : "";
  const termoBusca = normalizarTexto(termoBuscaBruto);
  const diretoria = campoDiretoria.value;
  const regional = campoRegional.value;
  const gerente = campoGerente.value;
  const status = campoStatus.value;

  const filtrados = estado.registrosOriginais.filter((registro) => {
    if (diretoria && registro.diretoria !== diretoria) return false;
    if (regional && registro.regional !== regional) return false;
    if (gerente && registro.gerente !== gerente) return false;
    if (status && registro.status !== status) return false;

    if (termoBusca) {
      const conjunto = `${registro.agencia} ${registro.gerente}`;
      if (!normalizarTexto(conjunto).includes(termoBusca)) return false;
    }

    return true;
  });

  estado.registrosFiltrados = filtrados;

  atualizarCartoes(filtrados, areaCartoes);
  atualizarTabela(filtrados, corpoTabela);
  atualizarContador(filtrados, contadorRegistros);
}

/**
 * Preenche o container de cards com indicadores resumidos.
 * Caso não haja registros filtrados, mostra uma mensagem amigável.
 */
function atualizarCartoes(registros, container) {
  if (!registros.length) {
    container.innerHTML = `
      <p class="texto-ajuda">Nenhum registro encontrado. Ajuste os filtros para visualizar resultados.</p>
    `;
    return;
  }

  const resumo = calcularResumo(registros);

  const cartoes = [
    {
      id: "card-total-agencias",
      titulo: "Unidades monitoradas",
      valor: formatarInteiro(resumo.totalAgencias),
      rodape: "Quantidade de linhas atualmente exibidas na tabela",
    },
    {
      id: "card-meta",
      titulo: "Meta acumulada",
      valor: formatarMoeda(resumo.metaTotal),
      rodape: "Somatório das metas das agências filtradas",
    },
    {
      id: "card-realizado",
      titulo: "Realizado acumulado",
      valor: formatarMoeda(resumo.realizadoTotal),
      rodape: "Resultado alcançado considerando apenas os filtros ativos",
    },
    {
      id: "card-atingimento",
      titulo: "Atingimento médio",
      valor: formatarPercentual(resumo.atingimentoMedio),
      rodape: "Média simples do atingimento percentual",
    },
    {
      id: "card-atingidas",
      titulo: "Metas atingidas",
      valor: `${formatarInteiro(resumo.quantidadeAtingidas)} agências`,
      rodape: "Total de agências com status 'Meta atingida'",
    },
  ];

  container.innerHTML = cartoes
    .map(
      (cartao) => `
        <article class="painel-cartoes__item" id="${cartao.id}">
          <span class="painel-cartoes__titulo">${cartao.titulo}</span>
          <strong class="painel-cartoes__valor">${cartao.valor}</strong>
          <span class="painel-cartoes__rodape">${cartao.rodape}</span>
        </article>
      `,
    )
    .join("");
}

/** Calcula totais necessários para montar os cards. */
function calcularResumo(registros) {
  const totalAgencias = registros.length;
  const metaTotal = registros.reduce((acumulado, registro) => acumulado + registro.meta, 0);
  const realizadoTotal = registros.reduce((acumulado, registro) => acumulado + registro.realizado, 0);
  const atingimentoMedio = registros.reduce((acumulado, registro) => acumulado + registro.atingimento, 0) / totalAgencias;
  const quantidadeAtingidas = registros.filter((registro) => registro.status === "atingida").length;

  return { totalAgencias, metaTotal, realizadoTotal, atingimentoMedio, quantidadeAtingidas };
}

/** Desenha o corpo da tabela com base nos registros filtrados. */
function atualizarTabela(registros, corpoTabela) {
  if (!registros.length) {
    corpoTabela.innerHTML = `
      <tr>
        <td colspan="8" class="texto-ajuda">Nenhum dado para exibir. Verifique os filtros.</td>
      </tr>
    `;
    return;
  }

  corpoTabela.innerHTML = registros.map(montarLinha).join("");
}

/**
 * Recebe um registro (linha) e devolve o HTML correspondente para a tabela.
 * Se adicionar novas colunas, lembre de incluir aqui também.
 */
function montarLinha(registro) {
  const infoStatus = STATUS_META[registro.status];

  return `
    <tr>
      <td>${registro.diretoria}</td>
      <td>${registro.regional}</td>
      <td>${registro.agencia}</td>
      <td>${registro.gerente}</td>
      <td>${formatarMoeda(registro.meta)}</td>
      <td>${formatarMoeda(registro.realizado)}</td>
      <td>${formatarPercentual(registro.atingimento)}</td>
      <td data-status="${registro.status}" title="${infoStatus.descricao}">${infoStatus.rotulo}</td>
    </tr>
  `;
}

/** Atualiza o texto do contador localizado no topo da tabela. */
function atualizarContador(registros, elemento) {
  if (!registros.length) {
    elemento.textContent = "Nenhum registro encontrado";
    return;
  }

  const texto = registros.length === 1
    ? "1 registro exibido"
    : `${registros.length} registros exibidos`;

  elemento.textContent = texto;
}

/** Retorna valores únicos de um campo específico (ex.: diretorias). */
function extrairValoresUnicos(registros, chave) {
  const valores = new Set();
  registros.forEach((registro) => valores.add(registro[chave]));
  return Array.from(valores);
}

// ---------------------------------------------------------------------
// 4) INICIALIZAÇÃO GERAL
// ---------------------------------------------------------------------

/**
 * Este é o ponto de entrada do painel.
 * A função é chamada quando o DOM está pronto para ser manipulado.
 */
function iniciarPainel() {
  const estado = {
    registrosOriginais: prepararRegistrosBase(),
    registrosFiltrados: [],
  };

  const elementos = obterElementosPrincipais();

  prepararFiltrosIniciais(estado, elementos);
  registrarEventos(estado, elementos);
  aplicarFiltros(estado, elementos);
}

// Aguarda o carregamento do HTML para iniciar a lógica.
document.addEventListener("DOMContentLoaded", iniciarPainel);
