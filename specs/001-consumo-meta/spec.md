# Feature Specification: Consumo Meta: Dashboard de Consumo da WhatsApp Cloud API

| Campo | Valor |
|---|---|
| **Nome** | Consumo Meta (nome provisório) |
| **Branch** | `feat/001-consumo-meta` |
| **Status** | Draft: aguardando validação |
| **Criado em** | 2026-11-17 |
| **Origem** | Descoberta guiada (SDD) + mockup do dashboard |

> **Escopo:** plataforma multi-tenant em que a Fasterisk cadastra clientes e credenciais Meta. Cada cliente vê o consumo da WhatsApp Cloud API em um dashboard embutido no Chatfast da própria conta. A Fasterisk opera tudo por um painel admin, também embutido no Chatfast.
>
> **Fora desta spec:** stack, arquitetura, modelagem física e infraestrutura vão para o `plan.md`. A contagem de **mensagens recebidas** é evolução futura (ver US-12).

---

## User Scenarios & Testing

### US-01: Acesso ao dashboard pelo Chatfast com isolamento por empresa (P1)

**Como** agente de um cliente, **quero** abrir o dashboard pelo app embutido no Chatfast **para** ver o consumo da minha empresa sem login extra.

**Teste independente:** abrir a URL de embed com um `company_id` cadastrado e um agente válido, e confirmar que só aparecem dados daquela empresa.

1. **Given** um `company_id` cadastrado e ativo, e um `user_id` que a Helena confirma como agente dessa conta, **When** o Chatfast abre `/dashboard?company_id=<uuid>&user_id=<id>`, **Then** o sistema abre o dashboard com dados exclusivamente dessa empresa.
2. **Given** um `company_id` não cadastrado, **When** a URL é aberta, **Then** o sistema exibe "Conta não cadastrada. Fale com a Fasterisk" e nenhum dado.
3. **Given** um `user_id` que a Helena não reconhece como agente da conta, **When** a URL é aberta, **Then** o sistema exibe "Acesso não autorizado" e nenhum dado.
4. **Given** a API da Helena indisponível ou sem resposta em até 5 s, **When** a URL é aberta, **Then** o sistema exibe "Não foi possível validar seu acesso agora. Tente novamente" com o botão "Tentar de novo" e **não** libera acesso.
5. **Given** o token Chatfast do cliente recusado pela Helena, **When** a URL é aberta, **Then** o sistema exibe "Integração com o Chatfast precisa ser atualizada. Fale com a Fasterisk" e marca o cliente com alerta no admin.
6. **Given** uma sessão válida da empresa A, **When** uma requisição pede dados, contas ou números da empresa B, **Then** o sistema nega com "fora da empresa" e não retorna nenhum dado de B.
7. **Given** a página aberta diretamente no navegador (fora do iframe do Chatfast) em produção, **When** a tela é carregada, **Then** o sistema bloqueia a exibição.
8. **Given** o cliente com status "inativo", **When** a URL é aberta, **Then** o sistema exibe "Conta desativada. Fale com a Fasterisk".

### US-02: Acesso ao painel admin restrito à Fasterisk (P1)

**Como** admin da Fasterisk, **quero** acessar o `/admin` pelo Chatfast da Fasterisk **para** gerenciar a plataforma, sem que clientes consigam fazer o mesmo.

**Teste independente:** abrir o `/admin` com um agente admin e com um agente comum da Fasterisk, e com um agente de cliente.

1. **Given** um `user_id` que a Helena confirma como **admin** na conta da Fasterisk, **When** o `/admin` é aberto, **Then** o sistema exibe o painel admin.
2. **Given** um agente **não admin** da conta da Fasterisk, **When** o `/admin` é aberto, **Then** o sistema exibe "Sem permissão de administrador".
3. **Given** qualquer agente de um cliente, **When** o `/admin` ou uma ação admin é chamada, **Then** o sistema nega o acesso.

### US-03: Cadastro de cliente (P2)

**Como** admin da Fasterisk, **quero** cadastrar um cliente com o `company_id` e o token Chatfast dele **para** liberar o dashboard da empresa.

**Teste independente:** cadastrar um cliente e abrir o dashboard dele (vazio) pelo embed.

1. **Given** nome, `company_id` (UUID) e token Chatfast válidos, **When** o admin salva, **Then** o sistema cria o cliente com status "ativo" e registra auditoria.
2. **Given** um `company_id` já cadastrado, **When** o admin salva, **Then** o sistema recusa com "Empresa já cadastrada".
3. **Given** um `company_id` com formato inválido, **When** o admin salva, **Then** o sistema recusa indicando o campo.
4. **Given** um cliente salvo, **When** o admin visualiza o detalhe, **Then** o sistema mostra apenas os 4 últimos caracteres do token Chatfast e nunca o token completo.
5. **Given** um cliente existente, **When** o admin substitui o token Chatfast, **Then** o novo token passa a valer e a auditoria registra a troca sem o valor do token.

### US-04: Cadastro de conta WABA com validação e descoberta de números (P2)

**Como** admin da Fasterisk, **quero** vincular uma conta WABA ao cliente **para** que o consumo dela seja coletado.

**Teste independente:** cadastrar uma conta WABA com token válido e ver os números descobertos no detalhe do cliente.

1. **Given** um WABA ID e um Access Token válidos e com os escopos necessários, **When** o admin salva, **Then** o sistema valida o token, confirma o WABA, descobre e lista os números (número, nome verificado, qualidade), grava a data de expiração do token (quando houver) e inicia o backfill.
2. **Given** um token inválido, expirado ou sem escopos, **When** o admin salva, **Then** o sistema recusa e informa o motivo (inválido, expirado ou escopo ausente).
3. **Given** um WABA ID já vinculado a qualquer cliente, **When** o admin salva, **Then** o sistema recusa com "WABA já cadastrada".
4. **Given** um token de usuário com expiração, **When** o admin salva, **Then** o sistema aceita, exibe a data de expiração e recomenda o uso de System User token.
5. **Given** um cliente com uma conta WABA, **When** o admin adiciona uma segunda conta, **Then** as duas coexistem e o dashboard do cliente passa a oferecer o filtro de WABA.

### US-05: Coleta automática e periódica do consumo (P3)

**Como** Fasterisk, **quero** que o sistema colete o consumo de todas as contas ativas periodicamente **para** que o dashboard esteja sempre atualizado sem consultar a Meta em tempo real.

**Teste independente:** com uma conta ativa e a Meta simulada, executar um ciclo de coleta e verificar os dados gravados e o registro da execução.

1. **Given** contas WABA ativas, **When** chega o horário do ciclo, **Then** o sistema coleta volume e custo por dia, número, categoria e tipo de cobrança, além de enviadas e entregues por número, para cada conta.
2. **Given** uma conta recém-cadastrada, **When** a primeira coleta roda, **Then** o sistema busca o histórico retroativo configurado (backfill), respeitando o limite de histórico da Meta.
3. **Given** dados já coletados de um dia, **When** o mesmo dia é coletado de novo (janela de reprocessamento dos últimos N dias), **Then** o sistema atualiza os valores **sem duplicar**.
4. **Given** uma coleta em andamento numa conta, **When** outra coleta da mesma conta é disparada (ciclo, admin ou cliente), **Then** a segunda não roda em paralelo.
5. **Given** um erro de token (inválido ou revogado), **When** a coleta roda, **Then** a conta passa para `token_invalido` e deixa de ser coletada até o token ser trocado.
6. **Given** um limite de requisições da Meta atingido, **When** a coleta roda, **Then** o sistema desacelera e, se persistir, desiste daquela conta no ciclo e tenta no próximo, marcando `erro_sync` com o motivo.
7. **Given** um erro em uma conta, **When** o ciclo roda, **Then** as demais contas continuam sendo coletadas normalmente.
8. **Given** qualquer ciclo, **When** ele termina, **Then** o sistema registra cada execução (conta, início, fim, janela, linhas gravadas, status, erro).
9. **Given** um token com expiração em até 7 dias, **When** a verificação diária roda, **Then** a conta passa para `token_expirando`.
10. **Given** uma conta pausada ou um número com coleta desativada, **When** o ciclo roda, **Then** o sistema não coleta esse item.

### US-06: Indicadores principais do dashboard (P4)

**Como** cliente, **quero** ver os totais de envio e entrega do período **para** entender rapidamente meu volume.

**Teste independente:** com dados conhecidos de um período, conferir os 5 cards.

1. **Given** dados no período, **When** o dashboard carrega, **Then** o sistema exibe os cards:
   - **Enviadas**, com o período;
   - **Entregues**, com a quantidade não entregue;
   - **Taxa de entrega** (entregues ÷ enviadas);
   - **Média diária (enviadas)**, com "X de Y dias com envio";
   - **Pico diário**, com a data.
2. **Given** um período sem nenhum envio, **When** o dashboard carrega, **Then** os cards mostram 0 e a taxa mostra "—" (sem divisão por zero).
3. **Given** o cabeçalho, **When** o dashboard carrega, **Then** o sistema exibe "Última sincronização: <data e hora>".
4. **Given** um período que inclui o dia de hoje, **When** o dashboard carrega, **Then** o sistema avisa que os dados do dia atual são parciais e que a Meta pode revisá-los.

### US-07: Consumo por categoria de cobrança com custo em R$ (P4)

**Como** cliente, **quero** ver volume e custo por categoria **para** entender onde estou gastando.

**Teste independente:** com dados e cotação conhecidos, conferir os cards de categoria e o total.

1. **Given** dados no período, **When** o dashboard carrega, **Then** o sistema exibe um card para Marketing, Utility, Autenticação e Serviço com volume, % do volume, custo em R$, cobradas e gratuitas.
2. **Given** dados no período, **When** o dashboard carrega, **Then** o card **Total** exibe volume, quantidade de categorias, custo total em R$ e custo médio por mensagem cobrada.
3. **Given** a conversão, **When** um custo é exibido em R$, **Then** o valor usa a cotação vigente no dia de cada consumo e é rotulado como **estimado**.
4. **Given** uma conta para a qual a Meta não informa custo (por exemplo, linha de crédito de parceiro), **When** o dashboard carrega, **Then** o custo aparece como "—" com o tooltip "A Meta não informa custo para esta conta", nunca como R$ 0,00.
5. **Given** um período com dias com e sem custo, **When** o dashboard carrega, **Then** o total exibe "Custo parcial (X dias sem custo)".
6. **Given** dias anteriores à primeira cotação cadastrada, **When** o custo é convertido, **Then** o sistema usa a cotação mais antiga e marca o valor como "convertido com cotação posterior".
7. **Given** nenhuma cotação cadastrada, **When** o dashboard carrega, **Then** o custo em R$ aparece como "Indisponível (cotação não cadastrada)" e o volume continua visível.

### US-08: Gráficos diários (P4)

**Como** cliente, **quero** ver a evolução diária por categoria e de envio/entrega **para** identificar picos e tendências.

**Teste independente:** com dados de vários dias, alternar os modos dos gráficos e conferir os valores.

1. **Given** dados no período, **When** o dashboard carrega, **Then** o gráfico "Categorias por dia" exibe barras empilhadas por categoria, com um dia por barra, incluindo dias sem dados.
2. **Given** o gráfico de categorias, **When** o cliente alterna entre **Volume** e **Custo**, **Then** o gráfico passa a exibir o valor escolhido (custo em R$).
3. **Given** dados no período, **When** o dashboard carrega, **Then** o gráfico "Mensagens por dia" exibe enviadas e entregues lado a lado, com alternância entre **Barras** e **Linha**.
4. **Given** os gráficos, **When** são exibidos, **Then** cada um traz a nota explicativa:
   - **Categorias por dia:** os dados contam mensagens entregues; o Serviço é gratuito; o custo é aproximado; WABAs com linha de crédito de parceiro não têm custo.
   - **Mensagens por dia:** as entregues podem superar as enviadas no dia, porque a Meta conta a entrega no dia em que ela acontece.

### US-09: Consumo por número (P4)

**Como** cliente, **quero** ver o consumo de cada número **para** saber qual linha gasta mais.

**Teste independente:** com 2 números com dados conhecidos, conferir a tabela.

1. **Given** dados no período, **When** o dashboard carrega, **Then** o sistema exibe a tabela com estas colunas:
   - WABA, Número, Nome verificado e Qualidade (selo GREEN/YELLOW/RED);
   - Enviadas, Entregues e Taxa;
   - volume de cada categoria;
   - Custo (R$) e % do total, com barra.
2. **Given** a tabela, **When** é exibida, **Then** o cabeçalho mostra "N número(s)".
3. **Given** um número sem consumo no período, **When** a tabela é exibida, **Then** o número aparece com zeros.

### US-10: Filtros do dashboard (P5)

**Como** cliente, **quero** filtrar por período, WABA, número e categoria **para** analisar recortes específicos.

**Teste independente:** aplicar combinações de filtros e conferir que todos os blocos refletem o recorte.

1. **Given** o dashboard aberto pela primeira vez, **When** ele carrega, **Then** o período padrão é o **mês atual** e os demais filtros são "Todos".
2. **Given** os atalhos **7d, 30d, 90d, Mês atual e Mês anterior**, **When** o cliente clica num deles, **Then** as datas de início e fim são preenchidas no fuso da conta.
3. **Given** filtros alterados, **When** o cliente clica em **Aplicar**, **Then** todos os cards, gráficos e a tabela são recalculados com o recorte, numa única atualização.
4. **Given** uma data de início posterior à data de fim, **When** o cliente clica em Aplicar, **Then** o sistema recusa e indica o erro.
5. **Given** um cliente com uma única conta WABA, **When** o dashboard carrega, **Then** o filtro WABA mostra só essa conta.
6. **Given** filtros aplicados, **When** o Chatfast recria o iframe, **Then** os filtros e o período são restaurados.
7. **Given** um recorte sem dados, **When** o cliente clica em Aplicar, **Then** o sistema exibe o estado vazio "Nenhum consumo no período selecionado".

### US-11: Sincronização manual pelo cliente (P6)

**Como** cliente, **quero** clicar em "Sincronizar com a Meta" **para** ver dados mais recentes sem esperar o próximo ciclo.

**Teste independente:** clicar no botão, ver a coleta concluir e o botão ficar bloqueado por 15 minutos.

1. **Given** a última sincronização da conta há mais de 15 minutos, **When** o cliente clica em "Sincronizar com a Meta", **Then** o sistema dispara a coleta das contas do cliente, mostra "Sincronizando…" e, ao concluir, atualiza o dashboard e a data de última sincronização.
2. **Given** uma sincronização feita há menos de 15 minutos, **When** o dashboard é exibido, **Then** o botão fica desabilitado com "Disponível em X min".
3. **Given** uma coleta já em andamento, **When** o cliente clica, **Then** o sistema não dispara uma nova coleta e exibe "Sincronizando…".
4. **Given** uma conta com `token_invalido` ou pausada, **When** o cliente clica, **Then** o sistema não coleta essa conta e informa que os dados estão desatualizados.
5. **Given** uma falha na coleta, **When** a sincronização termina, **Then** o sistema exibe uma mensagem de erro e mantém os dados anteriores.

### US-12: Cotação USD → BRL com vigência (P6)

**Como** admin da Fasterisk, **quero** cadastrar a cotação com data de vigência **para** converter o custo em reais sem alterar o passado.

**Teste independente:** cadastrar duas cotações com vigências diferentes e conferir o custo de dias antes e depois da troca.

1. **Given** uma nova cotação com data de início de vigência, **When** o admin salva, **Then** ela passa a valer para os dias a partir dessa data, e os dias anteriores continuam usando a cotação que valia neles.
2. **Given** a tela de admin, **When** é exibida, **Then** o card "Cotação USD → BRL vigente" mostra o valor atual e o histórico de vigências.
3. **Given** uma cotação ≤ 0 ou em formato inválido, **When** o admin salva, **Then** o sistema recusa.
4. **Given** nenhuma cotação cadastrada, **When** o admin abre o painel, **Then** o sistema exibe o alerta "Cadastre a cotação".
5. **Given** uma alteração de cotação, **When** ela é salva, **Then** a auditoria registra quem alterou, o valor e a vigência.

### US-13: Gestão operacional das contas no admin (P7)

**Como** admin da Fasterisk, **quero** acompanhar e operar as integrações **para** resolver problemas antes que o cliente perceba.

**Teste independente:** com uma conta em erro, ver o alerta na lista, abrir o detalhe e executar as ações.

1. **Given** a página principal do admin, **When** ela carrega, **Then** o sistema exibe:
   - a tabela de clientes com nome, `company_id`, número de contas, pior status entre as contas, último sync e o selo de alerta;
   - no topo, o contador "contas com problema" e o botão "Novo cliente".
2. **Given** o clique em um cliente, **When** o detalhe abre, **Then** o sistema exibe os dados do cliente e cada conta WABA com:
   - status, data de expiração do token, último sync e último erro;
   - os números com a chave para ativar ou desativar a coleta;
   - as últimas execuções de sync.
3. **Given** uma conta, **When** o admin clica em **Testar conexão**, **Then** o sistema valida o token e o WABA e exibe o resultado sem coletar dados.
4. **Given** uma conta, **When** o admin clica em **Sincronizar agora**, **Then** o sistema dispara a coleta respeitando a regra de não executar em paralelo. Para o admin não há intervalo mínimo.
5. **Given** uma conta com `token_invalido`, **When** o admin troca o token por um válido, **Then** a conta volta para `ativa` e é coletada no próximo ciclo.
6. **Given** uma conta, **When** o admin clica em **Pausar** ou **Retomar**, **Then** o status muda e a coleta para ou volta.
7. **Given** uma conta, **When** o admin clica em **Atualizar números**, **Then** o sistema redescobre os números na Meta, adicionando os novos e mantendo o histórico dos removidos.
8. **Given** qualquer alteração no admin, **When** ela é salva, **Then** a auditoria registra quem (`user_id`), o quê, quando e os dados sem segredos.

### US-14: Aviso de dados desatualizados para o cliente (P7)

**Como** cliente, **quero** ser avisado quando meus dados não estão sendo atualizados **para** não tomar decisões com números velhos.

**Teste independente:** colocar uma conta em `token_invalido` e abrir o dashboard do cliente.

1. **Given** alguma conta do cliente em `token_invalido`, `erro_sync` ou `pausada`, **When** o dashboard carrega, **Then** o sistema exibe a faixa amarela "Dados desatualizados desde DD/MM. A Fasterisk já foi notificada."
2. **Given** todas as contas em `ativa` ou `token_expirando`, **When** o dashboard carrega, **Then** a faixa não aparece.
3. **Given** um problema numa conta, **When** o status muda, **Then** **não** é enviado e-mail nem mensagem. O aviso aparece só nas telas (faixa no cliente, alerta no admin).

### US-15: Exportação em Excel e PDF (P8)

**Como** cliente (ou admin vendo um cliente), **quero** exportar os dados do recorte atual **para** conferir, compartilhar ou arquivar.

**Teste independente:** aplicar um filtro, exportar os dois formatos e conferir que o conteúdo bate com a tela.

1. **Given** filtros aplicados, **When** o usuário clica em **Exportar Excel**, **Then** o sistema gera um `.xlsx` com 3 abas:
   - **Resumo:** indicadores e categorias;
   - **Por número:** a tabela de consumo por número;
   - **Diário:** uma linha por dia, número e categoria, com volume, cobradas, gratuitas, custo na moeda da conta, moeda, cotação usada e custo R$.
2. **Given** filtros aplicados, **When** o usuário clica em **Exportar PDF**, **Then** o sistema gera um relatório de 1 a 2 páginas com:
   - cabeçalho com nome do cliente, período, filtros e "dados até <última sincronização>";
   - os cards de indicadores e de categorias;
   - os dois gráficos;
   - a tabela por número;
   - a nota "custo estimado".
3. **Given** custos indisponíveis ou parciais, **When** o arquivo é gerado, **Then** eles aparecem como "indisponível" ou "parcial", igual à tela, nunca como zero.
4. **Given** um recorte sem dados, **When** o usuário exporta, **Then** o arquivo é gerado com a indicação "Nenhum consumo no período".
5. **Given** um cliente A, **When** ele exporta, **Then** o arquivo contém exclusivamente dados de A.

### US-16: Desativação e reativação de cliente (P9)

**Como** admin da Fasterisk, **quero** desativar um cliente que cancelou **para** parar a coleta e bloquear o acesso sem perder dados.

**Teste independente:** desativar um cliente, tentar abrir o dashboard e depois reativá-lo.

1. **Given** um cliente ativo, **When** o admin o desativa, **Then** o status vira "inativo", a coleta de todas as contas dele para e o dashboard exibe "Conta desativada. Fale com a Fasterisk".
2. **Given** um cliente inativo, **When** o admin visualiza o cliente, **Then** os tokens e o histórico de consumo continuam guardados.
3. **Given** um cliente inativo, **When** o admin o reativa, **Then** a coleta volta sem precisar recadastrar os tokens, e o sistema reprocessa o período em que ele ficou inativo, dentro do limite de histórico da Meta.

### US-17: Mensagens recebidas (Futuro, fora da v1)

O card "Recebidas" **não** aparece na v1. A obtenção desse número depende de uma pesquisa técnica: os endpoints de analytics da Meta provavelmente não o oferecem, e o webhook do WABA pertence ao app do Chatfast. Uma spec própria será aberta se a pesquisa encontrar uma fonte que não afete o Chatfast.

---

## Edge Cases

| # | Situação | Comportamento esperado |
|---|---|---|
| EC-01 | Dia de consumo sem cotação vigente | Usa a cotação mais antiga e marca "convertido com cotação posterior". Sem nenhuma cotação: custo R$ "indisponível" e alerta no admin. |
| EC-02 | A Meta devolve volume sem custo | Custo "—" com tooltip; total "Custo parcial (X dias)". Nunca zero falso. |
| EC-03 | A Meta revisa números de dias passados | A janela de reprocessamento recoleta os últimos N dias e atualiza sem duplicar. |
| EC-04 | Entregues > enviadas num dia | É exibido como veio, com nota explicativa no gráfico. |
| EC-05 | Helena fora do ar ou lenta (> 5 s) | O acesso é bloqueado com "Tente novamente". Nunca libera sem validar. |
| EC-06 | Token Chatfast revogado | O acesso é bloqueado com "Integração com o Chatfast precisa ser atualizada" e o cliente recebe alerta no admin. |
| EC-07 | Token Meta revogado ou expirado | A conta vira `token_invalido`, a coleta para, o cliente vê a faixa amarela e o admin vê o alerta. |
| EC-08 | Token Meta perto de expirar (≤ 7 dias) | A conta vira `token_expirando`. O alerta aparece só no admin. |
| EC-09 | Limite de requisições da Meta | O sistema desacelera, desiste da conta no ciclo e tenta no próximo, sem afetar outras contas. |
| EC-10 | Duas coletas simultâneas na mesma conta | Só uma roda. A outra é ignorada e mostra "Sincronizando…". |
| EC-11 | Cliente clica em sincronizar antes de 15 min | O botão fica desabilitado com "Disponível em X min". |
| EC-12 | Conta recém-cadastrada sem dados ainda (backfill em andamento) | O dashboard mostra "Coletando histórico. Os dados aparecerão em instantes". |
| EC-13 | Período sem dados | Estado vazio "Nenhum consumo no período selecionado". Taxa "—". |
| EC-14 | Data de início > fim no filtro | O sistema recusa e indica o erro. |
| EC-15 | Período pedido além do histórico disponível | Mostra os dados existentes, com o aviso "Dados disponíveis a partir de DD/MM". |
| EC-16 | `company_id` ou WABA já cadastrado | O cadastro é recusado com mensagem específica. |
| EC-17 | Número removido do WABA na Meta | O histórico é mantido e o número fica marcado como "não encontrado na Meta". |
| EC-18 | Cliente desativado tenta abrir o dashboard | Exibe "Conta desativada. Fale com a Fasterisk". |
| EC-19 | Página aberta fora do iframe do Chatfast (produção) | A exibição é bloqueada. |
| EC-20 | Iframe recriado pelo Chatfast | Os filtros e o período são restaurados. |
| EC-21 | Sessão expira com o dashboard aberto | A sessão é renovada automaticamente uma vez, de forma transparente. |
| EC-22 | Erro interno do servidor | Mensagem amigável com código de rastreio para o suporte. |

---

## Functional Requirements

### Acesso e segurança
- **FR-001:** o sistema DEVE abrir o dashboard a partir de `/dashboard?company_id=<uuid>&user_id=<id>`, aceitando também as variantes `companyid`, `userId`, `userid` e `user`.
- **FR-002:** o sistema DEVE confirmar na API da Helena, usando o token Chatfast cadastrado do cliente, que o `user_id` é agente daquela empresa antes de liberar qualquer dado.
- **FR-003:** o sistema NÃO DEVE liberar acesso quando a Helena estiver indisponível ou recusar o token, e DEVE exibir uma mensagem específica para cada caso.
- **FR-004:** o sistema DEVE liberar o `/admin` somente para agentes que a Helena confirme como **admin** na conta da Fasterisk (`company_id` configurado como conta admin).
- **FR-005:** o sistema DEVE garantir que toda consulta, ação e exportação retorne exclusivamente dados do `company_id` da sessão.
- **FR-006:** o sistema DEVE negar qualquer requisição que referencie conta, número ou empresa de outro `company_id`.
- **FR-007:** o sistema DEVE bloquear a exibição das telas fora do iframe do Chatfast em produção, com as origens permitidas configuráveis.
- **FR-008:** a sessão DEVE expirar em 12 horas e ser renovada automaticamente uma vez quando expirar.
- **FR-009:** o sistema DEVE guardar os tokens da Meta e do Chatfast cifrados em repouso e NUNCA DEVE retorná-los a nenhuma tela. A tela exibe apenas os 4 últimos caracteres e permite apenas a substituição.
- **FR-010:** o sistema NÃO DEVE registrar em log tokens, respostas cruas da Meta, conteúdo de mensagens ou telefones de contatos.

### Cadastro (admin)
- **FR-011:** o admin DEVE poder cadastrar, editar, desativar e reativar clientes (nome, `company_id`, token Chatfast).
- **FR-012:** o sistema DEVE recusar `company_id` duplicado ou com formato inválido.
- **FR-013:** o admin DEVE poder vincular N contas WABA a um cliente, cada uma com N números.
- **FR-014:** ao salvar uma conta WABA, o sistema DEVE validar o token (validade, escopos e expiração) e o WABA, e descobrir os números (número, nome verificado e qualidade).
- **FR-015:** o sistema DEVE recusar um WABA ID já vinculado a qualquer cliente.
- **FR-016:** o admin DEVE poder ativar ou desativar a coleta por número.
- **FR-017:** o admin DEVE poder testar a conexão, sincronizar agora, trocar o token, pausar e retomar cada conta, e atualizar os números.
- **FR-018:** o sistema DEVE manter um status por conta: `ativa`, `token_invalido`, `token_expirando`, `erro_sync` ou `pausada`. Cada conta exibe ainda o último sync, o último erro e a expiração do token.
- **FR-019:** o admin DEVE exibir o contador de "contas com problema" e um selo de alerta por cliente.
- **FR-020:** o sistema DEVE registrar auditoria de toda alteração (autor, ação, entidade, data e dados sem segredos).

### Cotação
- **FR-021:** o admin DEVE poder cadastrar cotações USD → BRL globais, cada uma com data de início de vigência, e o sistema DEVE manter o histórico.
- **FR-022:** o sistema DEVE converter o custo de cada dia pela cotação vigente naquele dia.
- **FR-023:** para dias anteriores à primeira cotação, o sistema DEVE usar a cotação mais antiga e marcar o valor como "convertido com cotação posterior".
- **FR-024:** sem nenhuma cotação cadastrada, o sistema DEVE exibir o custo em R$ como "indisponível" e alertar o admin.

### Coleta
- **FR-025:** o sistema DEVE coletar periodicamente, em intervalo configurável, o consumo de todas as contas `ativa` e `token_expirando` de clientes ativos.
- **FR-026:** o sistema DEVE coletar volume e custo por dia, conta, número, categoria (Marketing, Utility, Autenticação, Serviço), tipo de cobrança (cobrada/gratuita) e país, quando disponível, além de enviadas e entregues por número e dia.
- **FR-027:** o sistema DEVE recoletar os últimos N dias a cada ciclo (N configurável) e, ao cadastrar uma conta, fazer o backfill de M dias (configurável, limitado ao histórico da Meta).
- **FR-028:** recoletar um dia DEVE atualizar os dados existentes sem duplicá-los.
- **FR-029:** o sistema NÃO DEVE executar duas coletas simultâneas da mesma conta, seja qual for a origem (ciclo, admin ou cliente).
- **FR-030:** o sistema DEVE marcar a conta como `token_invalido` em erro de token e interromper a coleta dela até a troca do token.
- **FR-031:** o sistema DEVE verificar a expiração dos tokens diariamente e marcar `token_expirando` quando faltarem 7 dias ou menos.
- **FR-032:** o sistema DEVE respeitar o limite de requisições da Meta, desacelerando perto do limite e adiando a conta para o próximo ciclo se ele persistir.
- **FR-033:** a falha de uma conta NÃO DEVE impedir a coleta das demais.
- **FR-034:** o sistema DEVE registrar cada execução de coleta (conta, início, fim, janela, linhas, status e erro) e exibir as últimas no admin.
- **FR-035:** o dashboard DEVE ler apenas os dados coletados e NUNCA DEVE consultar a Meta durante a navegação.
- **FR-036:** o sistema DEVE sinalizar a saúde de cada ciclo para um monitor externo configurável.

### Dashboard
- **FR-037:** o dashboard DEVE exibir os cards Enviadas, Entregues, Taxa de entrega, Média diária e Pico diário, conforme a US-06.
- **FR-038:** o dashboard DEVE exibir os cards por categoria e o card Total, conforme a US-07, com o custo em R$ rotulado como estimado.
- **FR-039:** o sistema NUNCA DEVE exibir custo ausente como zero. DEVE exibir "—", "indisponível" ou "parcial", com explicação.
- **FR-040:** o dashboard DEVE exibir o gráfico "Categorias por dia" (empilhado, alternando Volume/Custo) e o gráfico "Mensagens por dia" (enviadas × entregues, alternando Barras/Linha), com notas explicativas.
- **FR-041:** o dashboard DEVE exibir a tabela "Consumo por número", conforme a US-09.
- **FR-042:** o dashboard DEVE oferecer os filtros WABA, Número, Categoria, Início e Fim, os atalhos 7d, 30d, 90d, Mês atual e Mês anterior, e recalcular tudo numa única atualização ao clicar em **Aplicar**.
- **FR-043:** o período padrão DEVE ser o mês atual, e as datas DEVEM ser interpretadas no fuso da conta.
- **FR-044:** o dashboard DEVE exibir "Última sincronização" e avisar quando o período incluir o dia atual (dados parciais).
- **FR-045:** o dashboard DEVE restaurar os filtros quando o Chatfast recriar o iframe.
- **FR-046:** o dashboard DEVE exibir a faixa amarela de dados desatualizados quando houver conta em `token_invalido`, `erro_sync` ou `pausada`.
- **FR-047:** o cliente DEVE poder disparar "Sincronizar com a Meta", com intervalo mínimo de 15 minutos por conta, exibindo "Disponível em X min" enquanto bloqueado.
- **FR-048:** o sistema NÃO DEVE enviar e-mail ou mensagem sobre problemas de integração na v1.

### Exportação
- **FR-049:** o dashboard DEVE exportar em Excel (`.xlsx`, 3 abas) e PDF (relatório de 1 a 2 páginas), conforme a US-15, respeitando os filtros aplicados.
- **FR-050:** a exportação DEVE manter as mesmas regras de custo indisponível ou parcial da tela.

### Ciclo de vida do cliente
- **FR-051:** desativar um cliente DEVE parar a coleta e bloquear o acesso, mantendo tokens e histórico.
- **FR-052:** reativar um cliente DEVE retomar a coleta sem recadastro e reprocessar o período inativo, dentro do limite da Meta.

---

## Key Entities

| Entidade | Descrição | Atributos principais |
|---|---|---|
| **Cliente** | Empresa atendida pela Fasterisk, identificada pelo `company_id` do Chatfast. | nome, `company_id` (único), token Chatfast (cifrado, exibe os últimos 4), status (ativo/inativo), datas |
| **Conta WABA** | Conta WhatsApp Business da Meta vinculada a um cliente (1 cliente → N contas). | WABA ID (único), nome, token Meta (cifrado, exibe os últimos 4), expiração do token, status, último sync, último erro, marcação "sem custo da Meta", fuso |
| **Número** | Número de telefone de uma conta WABA (1 conta → N números). | identificador Meta (único), número exibido, nome verificado, qualidade, coleta ativa, "não encontrado na Meta" |
| **Consumo diário** | Fato de volume e custo por dia. | empresa, conta, número, data, categoria, tipo de cobrança, país, volume, custo (pode ser ausente), moeda |
| **Mensagens diárias** | Fato de envio e entrega por número e dia. | empresa, número, data, enviadas, entregues |
| **Cotação** | Taxa USD → BRL global com vigência. | valor, início de vigência, autor, data de cadastro |
| **Execução de sync** | Histórico operacional de cada coleta. | conta, origem (ciclo/admin/cliente), início, fim, janela, linhas, status, erro |
| **Auditoria** | Registro de alterações administrativas. | empresa, `user_id`, ação, entidade, dados sem segredos, data |
| **Sessão** | Acesso temporário (12 h) após a validação na Helena. | empresa, usuário, nome, é admin, expiração |

**Enumerações:**
- **Categoria:** Marketing, Utility, Autenticação, Serviço.
- **Tipo de cobrança:** cobrada, gratuita.
- **Status da conta:** `ativa`, `token_invalido`, `token_expirando`, `erro_sync`, `pausada`.
- **Status do cliente:** ativo, inativo.

---

## Success Criteria

| # | Critério | Meta |
|---|---|---|
| SC-01 | Isolamento entre empresas | 0 casos de dados de uma empresa visíveis para outra, verificados por teste em 100% das rotas e exportações |
| SC-02 | Acesso sem validação | 0 aberturas de dashboard ou admin sem confirmação do agente na Helena |
| SC-03 | Segredos expostos | 0 tokens retornados a telas ou presentes em logs |
| SC-04 | Tempo de carregamento do dashboard | ≤ 2 s após clicar em Aplicar, para 90 dias e até 20 números |
| SC-05 | Atualização dos dados | Dados de no máximo 1 ciclo de atraso em relação à Meta, para 100% das contas `ativa` |
| SC-06 | Conformidade de valores | Volume e custo USD divergem 0% dos valores da Meta para o mesmo dia e conta, após o reprocessamento |
| SC-07 | Idempotência | Recoletar um período N vezes produz exatamente os mesmos totais |
| SC-08 | Zero falso | 0 ocorrências de custo ausente exibido ou exportado como R$ 0,00 |
| SC-09 | Detecção de problema | 100% das contas com token inválido aparecem com alerta no admin e faixa no cliente em até 1 ciclo |
| SC-10 | Resiliência do ciclo | A falha de uma conta não impede a coleta de nenhuma outra (100% das demais concluídas) |
| SC-11 | Cadastro rápido | O admin cadastra um cliente com uma conta WABA e vê os números descobertos em ≤ 3 min |
| SC-12 | Exportação | O Excel e o PDF são gerados em ≤ 10 s para 90 dias, com totais idênticos aos da tela |
| SC-13 | Proteção da Meta | No máximo 1 sincronização manual por conta a cada 15 min vinda do cliente |

---

## Assumptions & Pending Research

- **A-01 (resolvida em research.md; ⚠️ restantes validados nas tasks T042/T075/T128):** a disponibilidade exata das métricas na Graph API (`pricing_analytics`, `analytics`, `template_analytics`, descontinuação de `conversation_analytics`), as granularidades, o atraso dos dados, a moeda e o limite de histórico devem ser confirmados na documentação oficial antes do `plan.md`. Divergências podem ajustar FR-026 e FR-027.
- **A-02 (resolvida, research R-03):** o custo vem na **moeda da WABA**. BRL passa direto; USD usa a cotação vigente do dia; outra moeda fica "indisponível".
- **A-03 (parcial, research R-07):** a Helena não tem `isAdmin`; usamos `isOwner` ou `profile` de admin. Os valores reais de `profile` são confirmados na T042.
- **A-04:** o fuso padrão é `America/Fortaleza`, quando a Meta não informar o fuso da conta.
- **A-05 (risco aceito):** a barreira de iframe é uma proteção de navegador, não autenticação. A autenticação real é a validação na Helena (FR-002).
