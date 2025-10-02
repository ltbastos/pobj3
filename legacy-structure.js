const LEGACY_RESUMO_STRUCTURE = [
  {
    id: "captacao",
    label: "NEGÓCIOS CAPTAÇÃO",
    familias: [
      {
        id: "captacao_cap_bruta",
        nome: "Captação Bruta (CDB, Isentos, Corretora e Previdência)",
        indicadores: [
          {
            id: "captacao_bruta",
            cardId: "captacao_bruta",
            nome: "Captação Bruta (CDB, Isentos, Corretora e Previdência)"
          }
        ]
      },
      {
        id: "captacao_cap_bruta_total",
        nome: "Captação Bruta Total",
        indicadores: [
          {
            id: "captacao_bruta_total",
            cardId: "captacao_bruta_total",
            nome: "Captação Bruta Total"
          }
        ]
      },
      {
        id: "captacao_cap_liquida",
        nome: "Captação Líquida (Todos os Produtos)",
        indicadores: [
          {
            id: "captacao_liquida",
            cardId: "captacao_liquida",
            nome: "Captação Líquida (Todos os Produtos)",
            subindicadores: [
              { id: "captacao_liquida_grupo_a", nome: "Captação Líquida - Grupo A" },
              { id: "captacao_liquida_isentos_aplicacao", nome: "Isentos - Aplicação" },
              { id: "captacao_liquida_isentos_resgate", nome: "Isentos - Resgate" },
              { id: "captacao_liquida_fundos_aplicacao", nome: "Fundos - Aplicação" },
              { id: "captacao_liquida_fundos_resgate", nome: "Fundos - Resgate" },
              { id: "captacao_liquida_previdencia_aplicacao", nome: "Previdência Privada - Aplicação" },
              { id: "captacao_liquida_portab_previdencia_aplicacao", nome: "Portabilidade de Previdência Privada - Aplicação" },
              { id: "captacao_liquida_previdencia_resgate", nome: "Previdência Privada - Resgate" },
              { id: "captacao_liquida_portab_previdencia_resgate", nome: "Portabilidade de Previdência Privada - Resgate" },
              { id: "captacao_liquida_coe_aplicacao", nome: "Coe - Aplicação" },
              { id: "captacao_liquida_coe_resgate", nome: "Coe - Resgate" },
              { id: "captacao_liquida_deposito_prazo_aplicacao", nome: "Depósito à Prazo - Aplicação" },
              { id: "captacao_liquida_deposito_prazo_resgate", nome: "Depósito à Prazo - Resgate" },
              { id: "captacao_liquida_grupo_b", nome: "Captação Líquida - Grupo B" },
              { id: "captacao_liquida_investfacil", nome: "Investfácil" },
              { id: "captacao_liquida_investfacil_aplicacao", nome: "Investfácil - Aplicação" },
              { id: "captacao_liquida_investfacil_resgate", nome: "Investfácil - Resgate" },
              { id: "captacao_liquida_poupanca", nome: "Poupança" },
              { id: "captacao_liquida_poupanca_aplicacao", nome: "Poupança - Aplicação" },
              { id: "captacao_liquida_poupanca_resgate", nome: "Poupança - Resgate" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "financeiro",
    label: "FINANCEIRO",
    familias: [
      {
        id: "financeiro_recuperacao_ate59",
        nome: "Recuperação de Vencidos até 59 dias",
        indicadores: [
          {
            id: "rec_vencidos_59",
            cardId: "rec_vencidos_59",
            nome: "Recuperação de Vencidos até 59 dias"
          }
        ]
      },
      {
        id: "financeiro_recuperacao_acima59",
        nome: "Recuperação de Vencidos acima de 59 dias",
        indicadores: [
          {
            id: "rec_vencidos_50mais",
            cardId: "rec_vencidos_50mais",
            nome: "Recuperação de Vencidos acima de 59 dias"
          }
        ]
      },
      {
        id: "financeiro_recuperacao_credito",
        nome: "Recuperação de Crédito",
        indicadores: [
          {
            id: "rec_credito",
            cardId: "rec_credito",
            nome: "Recuperação de Crédito",
            subindicadores: [
              { id: "recuperacao_de_credito_lp_total", nome: "Recuperação de Crédito LP Total" },
              { id: "recuperacao_de_credito_lp_a_vista", nome: "Recuperação de Crédito LP à Vista" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "credito",
    label: "CRÉDITO",
    familias: [
      {
        id: "credito_producao_pj",
        nome: "Produção de Crédito PJ",
        indicadores: [
          {
            id: "prod_credito_pj",
            cardId: "prod_credito_pj",
            nome: "Produção de Crédito PJ",
            subindicadores: [
              { id: "prod_credito_pj_linha", nome: "Linha PJ" },
              { id: "prod_credito_pj_cartao", nome: "Cartão PJ" }
            ]
          }
        ]
      },
      {
        id: "credito_rotativo_volume",
        nome: "Limite Rotativo PJ (Volume)",
        indicadores: [
          {
            id: "rotativo_pj_vol",
            cardId: "rotativo_pj_vol",
            nome: "Limite Rotativo PJ (Volume)",
            subindicadores: [
              { id: "rotativo_pj_vol_carteira", nome: "Carteira ativa" }
            ]
          }
        ]
      },
      {
        id: "credito_rotativo_quantidade",
        nome: "Limite Rotativo PJ (Quantidade)",
        indicadores: [
          {
            id: "rotativo_pj_qtd",
            cardId: "rotativo_pj_qtd",
            nome: "Limite Rotativo PJ (Quantidade)",
            subindicadores: [
              { id: "rotativo_pj_qtd_carteira", nome: "Carteira ativa" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "ligadas",
    label: "LIGADAS",
    familias: [
      {
        id: "ligadas_cartoes",
        nome: "Cartões",
        indicadores: [
          {
            id: "cartoes",
            cardId: "cartoes",
            nome: "Cartões",
            subindicadores: [
              { id: "cartoes_pf", nome: "Cartões PF" },
              { id: "cartoes_pj", nome: "Cartões PJ" }
            ]
          }
        ]
      },
      {
        id: "ligadas_consorcios",
        nome: "Consórcios",
        indicadores: [
          {
            id: "consorcios",
            cardId: "consorcios",
            nome: "Consórcios",
            subindicadores: [
              { id: "consorcios_auto", nome: "Auto" },
              { id: "consorcios_imobiliario", nome: "Imobiliário" }
            ]
          }
        ]
      },
      {
        id: "ligadas_seguros",
        nome: "Seguros",
        indicadores: [
          {
            id: "seguros",
            cardId: "seguros",
            nome: "Seguros",
            subindicadores: [
              { id: "seguros_empresas", nome: "Empresas" },
              { id: "seguros_pessoas", nome: "Pessoas" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "produtividade",
    label: "PRODUTIVIDADE",
    familias: [
      {
        id: "produtividade_sucesso_equipe",
        nome: "Sucesso de Equipe Crédito",
        indicadores: [
          {
            id: "sucesso_equipe_credito",
            cardId: "sucesso_equipe_credito",
            nome: "Sucesso de Equipe Crédito",
            subindicadores: [
              { id: "sucesso_equipe_credito_base", nome: "Equipes" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "clientes",
    label: "CLIENTES",
    familias: [
      {
        id: "clientes_conquista_qualif",
        nome: "Conquista Qualificada Gerenciado PJ",
        indicadores: [
          {
            id: "conquista_qualif_pj",
            cardId: "conquista_qualif_pj",
            nome: "Conquista Qualificada Gerenciado PJ",
            subindicadores: [
              { id: "conquista_qualif_pj_ativacao", nome: "Ativação" },
              { id: "conquista_qualif_pj_cross", nome: "Cross-sell" }
            ]
          }
        ]
      },
      {
        id: "clientes_conquista_folha",
        nome: "Conquista de Clientes Folha de Pagamento",
        indicadores: [
          {
            id: "conquista_folha",
            cardId: "conquista_folha",
            nome: "Conquista de Clientes Folha de Pagamento",
            subindicadores: [
              { id: "conquista_folha_publico", nome: "Público" },
              { id: "conquista_folha_privado", nome: "Privado" }
            ]
          }
        ]
      },
      {
        id: "clientes_bradesco_expresso",
        nome: "Bradesco Expresso",
        indicadores: [
          {
            id: "bradesco_expresso",
            cardId: "bradesco_expresso",
            nome: "Bradesco Expresso",
            subindicadores: [
              { id: "bradesco_expresso_agencia", nome: "Agência" },
              { id: "bradesco_expresso_digital", nome: "Digital" }
            ]
          }
        ]
      }
    ]
  }
];
