# Auditoria da refatoração financeira

Estado: concluído em código e nos gates automatizados. Este registro distingue a implementação comprovada da validação visual que não pôde ser executada nesta sessão.

## Modelo implementado

- Recorrências mensais usam regras tipadas com término `never`, `count` ou `until`. Consultas projetam o período solicitado sem persistir um horizonte artificial.
- A identidade é `seriesId` + `occurrenceNumber`. Revisões mudam o futuro e preservam registros consolidados. Overrides mantêm a posição global mesmo quando a data muda.
- Pagamento, edição individual, skip, detalhes/anexo e confirmação de cobrança materializam ocorrências. Uma fixa e uma recorrente finita repetem o valor inteiro; parcelas dividem uma compra única.
- `commitment: forecast` não entra no total lançado da fatura ou no limite. `forecastAmount` é somente uma projeção de leitura. Cobranças recorrentes exigem confirmação a partir da data prevista; a primeira cobrança criada com data já efetiva é lançada imediatamente.
- Carteiras usam `paidAt` para ledger, preservando a data prevista. Gastos de cartão são liquidados pela fatura. A repetição de uma quitação mantém sua primeira data efetiva.
- Faturas pagas ficam ocultas no seletor padrão, aparecem em pesquisa explícita de mês/ciclo e exigem reversão antes de mudanças financeiras.
- Rebase de séries reaplica a edição local explícita sobre o prefixo remoto, preservando pagamentos concorrentes. A fila só publica o rebase depois de gravá-lo no IndexedDB.
- Pagamentos concorrentes de uma mesma fatura são conciliados pelo saldo restante: o pagamento remoto tem precedência, o local é reduzido ou descartado quando necessário, e fatura, grupo e ledger são recalculados juntos.
- Quitações sem carteira continuam sendo pagamentos canônicos `paid`, vinculados à fatura, mas sem entrada de ledger e fora dos relatórios de caixa. `skipped` permanece reservado a ocorrências ignoradas.
- Rejeições conhecidas de domínio interrompem retentativas automáticas. A recuperação explícita oferece backup local e download antes de restaurar os dados confirmados, com confirmação e proteção contra edições concorrentes.

## Organização

`domainTypes.ts` e `domainConstants.ts` concentram tipos e constantes compartilhados. `recurrence/` contém regras, projeção, materialização, revisões, exclusões e rebase. `transactionCreation/` separa criação e resolução de cadastros. `transactionSeries/` contém edição, exclusão, ledger, atribuição de ciclos e invariantes. `syncCreditCardInvoices.ts` concentra a projeção persistida de faturas.

Auxiliares do seletor foram extraídos de `CardSpendingForm`. O rateio de pagamentos em `invoicePaymentContributions.ts` distribui centavos proporcionalmente sem contribuições negativas. `transactionSettlementDate.ts` centraliza a data efetiva usada nos gráficos e pagamentos recentes da página inicial.

## Evidências disponíveis

| Área | Evidência |
| --- | --- |
| Projeção indefinida/finita, fim de mês, exclusões | `recurrence/projectOccurrences.test.ts` e RPC SQL de projeção |
| Criação real, idempotência, modos e cartão | `transactionCreation/createTransactionSnapshot.test.ts` |
| Escopos, overrides, histórico pago e conversão individual | `recurrence/seriesLifecycle.test.ts` |
| Edição de data, mapper, reload e troca de ciclo | `transactionDate.test.ts` e runtime SQL |
| Parcelas, troca de cartão sem mudança de data, ciclo explícito, IDs canônicos | `transactionSeries/installmentInvoiceEditing.test.ts` |
| Previsão não reserva limite; compra parcelada reserva o saldo devido | `invoiceCommitment.test.ts` |
| Pagamento hoje idempotente e concorrente | `transactionStatus.test.ts`, `financeSyncMerge.test.ts`, runtime SQL |
| Faturas pagas no seletor | `invoiceSelection.test.ts` |
| Migração de 12 registros com datas movidas entre meses, tags, detalhes, anexo e ledger | `supabase/tests/recurrence-legacy.mjs` |
| Rebase TypeScript e mappers de produção pelo writer SQL; encerramento remoto | `supabase/tests/recurrence-sync-runtime.mjs` |
| Formato de regra, datas inválidas, centavos, posições inteiras e rollback da revisão | `supabase/tests/recurrence-runtime.mjs` |
| Quitação parcial 40 + 60, reversão individual e proteção do pagamento anterior | `supabase/tests/recurrence-runtime.mjs` |
| Reversão preserva regras sem registros; fechamento sem carteira não recria ledger | `invoiceSettlement.test.ts` |
| Pagamentos de fatura concorrentes: soma compatível, ajuste pelo saldo e descarte da duplicata | `financeSyncMerge.test.ts` e rollback `INVOICE_OVERPAYMENT` no runtime SQL |
| Cancelamento somente desta ocorrência e desta em diante sem afetar irmãs | `recurrence/seriesLifecycle.test.ts` |
| Rateio exato de pagamento e exclusão de previsões | `planningReportsUtils.test.ts` |
| Planejamento concilia saldo inicial com pagamento efetivo, mantém pendências na data prevista e exclui quitação sem caixa | `planningTimelineUtils.test.ts` |
| Falha de armazenamento e edição concorrente durante rebase/recuperação | `persistConflictResolution.test.ts`, `recoverPendingSync.test.ts` |
| Durabilidade da fila antes do envio remoto e descarte de snapshots superados | `persistPendingSync.test.ts` |
| Exclusão permanente de override não recria previsão, inclusive após mudar a data da série | `recurrence/accountDeletion.test.ts` |
| Exclusão em massa de parcelas preserva pagamentos/ledger e compromissos já lançados | `transactionSeries/deleteTransactions.test.ts` |

As migrations 018–027 foram executadas somente no PGlite local, junto das anteriores. Nenhuma migration foi aplicada a banco remoto. A migration 022 força recarga canônica dos dispositivos antigos por lacuna de revisão. A migration 023 registra exclusões de posições nas regras sobreviventes, inclusive em exclusão direta de ocorrência ou cascata de grupo. O runtime SQL verifica que essas posições não reaparecem e que as demais continuam projetadas.

## Limitações de validação

A comprovação visual está limitada pela ausência de navegador conectado. A API CUA foi consultada após os gates finais e retornou `apps: []`, `browsers: []`. Não houve execução visual dos formulários, e testes de domínio não são apresentados como substitutos dessa evidência.

| Objetivo original | Situação verificável |
| --- | --- |
| 1. Regras, projeções, materialização, escopos e histórico | Implementados; testes de ciclo de vida, projeção e runtime SQL aprovados. Detalhes/anexos pela interface pendentes. |
| 2. Única, fixa, recorrente e parcelada | Domínio e criação testados; apresentação e submissão dos quatro modos pendentes no navegador. |
| 3. Previsões de cartão, limite e confirmação | Totais, ciclos e invariantes verificados em TypeScript e SQL; confirmação visual pendente. |
| 4. Invoices e invariantes PostgreSQL | Migrations e runtimes locais aprovados, incluindo pagamento parcial e reversão. |
| 5. Seletor de faturas pagas | Filtro, pesquisa e seleção padrão testados; interação visual pendente. |
| 6. Edição de data end-to-end | Draft e handlers inspecionados; domínio, mapper, reload e writer SQL testados. Submissão pelo formulário ainda não comprovada visualmente. |
| 7. Ações paga/recebida hoje | Labels, aplicabilidade, idempotência e ledger testados; menu e confirmação pendentes no navegador. |
| 8. Auditoria financeira | Correções e evidências registradas acima; recuperação offline, duplicação e exclusão ainda precisam da passagem pela interface. |
| 9. Compatibilidade e gates | Legado preservado no teste de migrations; 125 testes em 33 arquivos, migrations 001–027, typecheck, lint e build aprovados. Sem aplicação em banco remoto. |

- Validar formulários e ações quando houver um navegador conectado: data por escopo, detalhes projetados, seleção de fatura paga, confirmação de cobrança e recuperação de sync. Todas as consultas à API de navegador retornaram listas vazias.
- Validar visualmente a explicação da base dos relatórios de planejamento. O texto agora informa o agrupamento pela data prevista e a inclusão de pendências; fechamentos sem débito em carteira ficam fora dos totais. Testes cobrem essa exclusão no relatório, no resumo e no ledger.
- Validar a conversão de parcelamentos pela interface. O domínio agora usa `routingOverride` para campos explicitamente limpos. A migration 025 aplica a mesma resolução no ledger, atribuição de fatura, validações e view efetiva. Testes cobrem conversão individual, parcelas mensais, mapper/reload, preservação de overrides em edição descritiva e pagamento via writer SQL. Payloads antigos que omitem o indicador preservam o valor canônico.
- Conferir os fluxos de exclusão de cadastros na interface. A migration 024 valida referências e propriedade por usuário ao final da transação; o runtime cobre referências ausentes, carteira de outro usuário, rollback da exclusão isolada e remoção atômica de referência e carteira. Exclusões diretas/cascatas e rebase de posições excluídas também têm cobertura.
- Reduzir os arquivos ainda excessivamente grandes quando houver separação natural. A dependência circular entre normalização de backups e projeção de faturas foi removida: `invoiceCycles.ts`, `transactionResolution.ts` e `valueNormalization.ts` fornecem as funções compartilhadas sem importar o módulo central.

## Validação recente

A rodada final passou nos cinco gates pedidos: 125 testes em 33 arquivos, migrations 001–027 e seus três runtimes, typecheck, lint e build. `git diff --check` também passou; o build mantém somente o aviso conhecido do chunk principal acima de 500 kB.

A auditoria de pagamentos concorrentes de fatura encontrou uma divergência que o merge genérico não podia resolver: dois dispositivos podiam criar IDs de pagamento distintos e debitar duas vezes a carteira, embora o PostgreSQL rejeitasse o sobrepagamento. `reconcileInvoicePaymentMerge.ts` agora dá precedência ao estado remoto, consome apenas o saldo restante com o pagamento local e recompõe transações, grupos, ledger e `paidAmount` de forma atômica no snapshot. Pagamentos parciais compatíveis, 40 + 60, são preservados; 60 + 60 reduz o segundo para 40; uma quitação remota integral elimina a duplicata local. O runtime SQL comprova que `INVOICE_OVERPAYMENT` faz rollback e esse erro não entra em retentativa automática.

A ação de quitar sem carteira usava `status: skipped` ao mesmo tempo que marcava a fatura como paga localmente. Como a projeção canônica do PostgreSQL contabiliza somente liquidações `paid`, a fatura reabria depois do sync. O fluxo agora usa uma liquidação `paid` sem carteira, sem ledger e fora dos relatórios de caixa; nomes e textos da interface foram ajustados para descrever esse contrato. Na retentativa de detalhes após uma falha parcial, os campos financeiros também ficam bloqueados depois que a transação já foi salva, evitando que uma segunda submissão descarte silenciosamente edições que não seriam reaplicadas.

A auditoria da fila de sincronização encontrou uma quebra de durabilidade: o envio remoto era iniciado no `finally` da gravação no IndexedDB, inclusive quando ela falhava, e uma edição mais nova podia ser enviada enquanto somente a anterior estava protegida. `persistPendingSync.ts` agora libera apenas o snapshot atual depois da persistência correspondente; o hook rastreia qual versão está durável e impede flushes indiretos de uma versão ainda não gravada. O carregamento inicial espera a hidratação da fila local antes de consultar e aplicar a revisão remota. Se a consulta remota falhar, um snapshot pendente continua sendo exibido em vez de ser substituído por dados vazios. O contrato público de sincronização também deixou de ser duplicado entre contexto e hook.

Três testes cobrem falha de armazenamento, supersessão por edição concorrente e ordem persistência-antes-de-flush. No estado dessa correção, a suíte passou com 120 testes em 33 arquivos; typecheck, lint e build também passaram, com apenas o aviso existente do bundle principal.

A auditoria de duplicação rápida eliminou a gravação direta e sem feedback feita pelo menu contextual. Despesas, receitas e transferências agora abrem seus formulários preenchidos, preservando valor, rotas, categoria, beneficiário e tags; status volta a pendente e a data fica no dia atual para revisão. Cartões já seguiam o fluxo de formulário. `duplicateTransactionPrefill.test.ts` cobre carteira, transferência, reset de status e ausência da data efetiva anterior.

Depois dessa mudança, passaram 117 testes em 32 arquivos, typecheck, lint, build e `git diff --check`. As migrations 001–027 não mudaram e permanecem aprovadas na rodada anterior.

A auditoria de detalhes e anexos encontrou duplicação em retentativas parciais: se um upload fosse concluído e o seguinte falhasse, repetir o salvamento criava outra cópia do primeiro. `transactionAttachmentIdentity.ts` gera identidade SHA-256 estável por transação e arquivo; Storage e metadados usam upsert idempotente. A transação participa do hash para impedir colisão quando o mesmo arquivo é anexado a lançamentos diferentes. A migration 027 concede atualização somente no bucket e na pasta do usuário autenticado.

Após essa correção, passaram 115 testes em 31 arquivos, migrations 001–027 com runtimes, typecheck, lint, build e `git diff --check`. O teste de identidade cobre retry, conteúdo diferente e isolamento entre transações.

A auditoria de exclusão de parcelamentos formalizou dois contratos antes implícitos. Ao excluir todas, parcelas de carteira já pagas e seu ledger são preservados, enquanto parcelas futuras mutáveis são removidas e o grupo é recalculado para o plano restante. Compromissos de cartão já lançados não são apagados por uma exclusão em massa. Dois testes cobrem os dois casos. A preservação do total original foi avaliada e descartada porque divergiria do total canônico derivado pelo writer PostgreSQL.

Após esses testes, passaram 114 testes em 30 arquivos, typecheck, lint, build e `git diff --check`. As migrations 001–026 permanecem verdes na rodada anterior e não foram alteradas nesta revisão.

A auditoria de roteamento pago encontrou uma conversão inválida: uma despesa de carteira já paga podia trocar para cartão mantendo `status: paid`, removendo o ledger e criando uma cobrança individual indevidamente quitada. `invoiceMutations.ts` agora rejeita qualquer entrada paga no cartão quando o registro anterior não era pago no mesmo cartão. A migration 026 aplica a mesma regra no PostgreSQL. Edições de metadados de registros legados pagos no mesmo cartão continuam permitidas. Dois testes TypeScript e o runtime SQL comprovam o contrato e o rollback.

Após essa correção, passaram 112 testes em 29 arquivos, migrations 001–026 com runtimes, typecheck, lint, build e `git diff --check`. O build conserva apenas o aviso de bundle acima de 500 kB. O navegador permaneceu ausente na segunda verificação após a retomada.

A retomada da validação visual iniciou o servidor local com o carregador `runner`, mas nenhum dos três destinos oferecidos pela ferramenta estava disponível: aba interna, Chrome e Edge retornaram `Browser is not available`. O servidor foi encerrado normalmente. Esta é a primeira repetição do bloqueio após a retomada do Goal.

Na revisão estrutural, as opções visuais e tipos do formulário de cartão foram extraídos para `CardSpendingOptions.tsx`, e o preview de parcelas para `InstallmentPreviewModal.tsx`. `CardSpendingForm.tsx` caiu de 1.119 para 893 linhas, mantendo a lógica principal e o comportamento. Depois da extração, 110 testes, typecheck, lint, build e `git diff --check` passaram; o build mantém somente o aviso de bundle grande.

A revisão da duplicação encontrou divergência entre o menu e o botão dos formulários: o botão podia copiar status pago e toda a série. `duplicateTransactionDraft.ts` agora centraliza a criação de uma ocorrência independente e pendente, sem vínculo com fatura anterior, quantidade de parcelas ou regra recorrente. Menu, formulário de carteira e formulário de cartão usam essa função. Dois testes passam pelo domínio de criação e comprovam uma única ocorrência sem ledger e sem alteração de saldo.

Os quatro testes preexistentes de exclusão foram restaurados após identificar substituição acidental do arquivo durante a revisão anterior. Os novos ficam em `permanentDeletionSeries.test.ts`. O conjunto atual passou com 110 testes em 28 arquivos, typecheck, lint e build; o aviso de bundle permanece. Nenhuma migration foi alterada nesta rodada.

A rodada de 2026-09-07 passou nos cinco gates: 102 testes em 26 arquivos, migrations 001–025 com runtimes, typecheck, lint e build. O build mantém apenas o aviso de bundle acima de 500 kB. A consulta atual à API de interface retornou `apps: []` e `browsers: []`.

A auditoria do planejamento corrigiu dupla contagem de pagamentos feitos antes do mês previsto: o saldo inicial já continha o débito, mas a projeção o descontava novamente pela data agendada. Transações pagas agora entram pela data efetiva, pendentes pela data prevista e quitações sem caixa ficam excluídas. Quatro testes verificam antecipação, atraso, pendência e fechamento manual. Isso é específico da projeção de caixa; os relatórios por competência mantêm sua base prevista explícita.

A exclusão permanente mantém o contrato de remover o grupo vinculado inteiro e seus filhos, inclusive parcelas com roteamento individual. A confirmação agora informa esse alcance, a remoção de faturas/pagamentos e o efeito nos saldos; Arquivar é a alternativa que preserva histórico. `permanentDeletion.test.ts` verifica a remoção de parcelas, tags e ledger e a preservação de grupos independentes. Referências existentes somente no JSON da regra agora também identificam séries vinculadas, evitando payload com referência pendente rejeitado pela migration 024. Erros de referência de cadastro/tag interrompem tentativas automáticas de sync e preservam os dados locais para revisão.

Após essa revisão, a execução completa e a execução verbose confirmaram 104 testes em 26 arquivos; typecheck, lint e build passaram. A validação de migrations 001–025 da rodada anterior continua aplicável: nenhum SQL foi alterado nesta revisão. A confirmação na interface ainda precisa de validação visual.

A conferência de criação corrigiu metadados de regra que podiam sobrescrever valor/data/identidade do cadastro e seleção inválida de cartão que podia usar um fallback silencioso. Uma fatura explicitamente diferente agora materializa apenas a primeira previsão recorrente como override. Os seis testes de criação passaram; lint passou após essas mudanças. Typecheck passou antes do último caso de override de fatura.

A rodada após roteamento explícito passou com 95 testes/25 arquivos, typecheck, lint, migrations 001–025 e build. O teste SQL converte uma parcela para carteira, confirma fatura nula, débito único e persistência da conversão após payload antigo. Nenhuma migration foi aplicada remotamente.

A migration 024 foi executada no PGlite local e passou junto das migrations anteriores e dos runtimes. Ela limpa referências legadas sem destino válido, sem alterar transações materializadas ou histórico financeiro.

A proteção de gastos de fatura paga compara o cartão efetivo, incluindo a herança do grupo. O runtime permite uma edição descritiva que apenas explicita o mesmo cartão e continua rejeitando mudanças financeiras. Os testes SQL de remoção atômica de referência e carteira também passaram.

Em 2026-09-07, os cinco gates passaram após a extração das dependências: 91 testes em 25 arquivos, migrations, typecheck, lint e build. O build mantém aviso de bundle acima de 500 kB. Esses resultados não substituem a validação final do Goal.
