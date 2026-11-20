# Vade Mecum por edital

A migração usa `notices.id` e `legal_provisions.id` do Supabase canônico. Cada revisão tem uma data de corte e uma fonte. O escopo fixa no máximo uma redação por dispositivo. O selo torna a revisão visível e congela o escopo. Uma retificação cria outra revisão e preserva as referências feitas à anterior.

## Cobertura documental

| Edição | Marco e fontes | Escopo conferido |
| --- | --- | --- |
| CFO 2027 | O item 7.8.1 usa a publicação do edital. O [PDF espelhado](https://dhg1h5j42swfq.cloudfront.net/2026/09/03102826/pm-mg-2027-cleaned.pdf) traz 02/09/2026 no cabeçalho. O [extrato reproduzido do Diário](https://www.escavador.com/diarios/10798470/DOEMG/diario-do-executivo/2026-09-04?page=40) informa publicação integral no CRS em 03/09/2026. O extrato saiu em 04/09/2026. | Diplomas expressos do Anexo B conferidos com o catálogo. Os recortes temáticos ainda exigem correspondência artigo a artigo e a cadeia oficial de retificações permanece pendente. |
| CFSD 2025 | O item 7.6.1 do [PDF espelhado](https://dhg1h5j42swfq.cloudfront.net/2024/05/09193423/090520241910444160.pdf) usa a data de publicação. A data do cabeçalho e a registrada no app são 09/05/2024. As cópias dos atos [nº 01](https://folhadesabara.com.br/envios/2024/08/01/fb7f32f6f9bc8ed29658ec45ca111a291a127637.pdf) e [nº 02](https://arquivos.qconcursos.com/regulamento/arquivo/79967/pm_mg_2025_soldado_edital_n_10-edital.pdf) tratam de vagas e do calendário. A publicação no CRS e a lista completa de retificações ainda exigem confirmação. | Os quatro diplomas do Anexo B, itens 4.1 a 4.4, estão cadastrados. O recorte constitucional está discriminado abaixo. |
| CFO 2026 | Item 7.6.1 do [PDF espelhado](https://cdn.direcaoconcursos.com.br/uploads/2025/09/050920251410032270.pdf). Há [cópia de retificação nº 01](https://arquivos.qconcursos.com/regulamento/arquivo/95442/pm_mg_2026_oficial_edital_n_11-edital.pdf). | Edição ainda sem registro em `notices`. |
| CFSD 2023 | Item 7.5.1 do [PDF de órgão público municipal](https://www.caboverde.mg.gov.br/ckfinder/userfiles/files/EDITAL%20CFSD%202023.pdf). | Edição cadastrada com 51 itens. Escopo e cadeia de alterações por conferir. |
| CFO 2025 | Item 7.6.1 do edital DRH/CRS nº 09/2024 em [PDF espelhado](https://dhg1h5j42swfq.cloudfront.net/2024/05/09193416/edital-pm-mg-oficial.pdf). | Edição ainda sem registro em `notices`. |

Conferência de diplomas do Anexo B com os códigos do catálogo:

| Edição e item | Códigos |
| --- | --- |
| CFSD 2025, 4.1 | `CF88`: arts. 1º a 5º, 12 a 16, 37 a 42, 122 a 126 e 142 a 144. Os dispositivos vinculados a cada artigo precisam ser conferidos individualmente. |
| CFSD 2025, 4.2 a 4.4 | `LINDB`, `DUDH`, `CADH`. |
| CFO 2027, 4.10 a 4.11 | `CF88`, `CEMG`. |
| CFO 2027, 7.12 a 7.16 | `L8429`, `L13019`, `L13709`, `L14133`, `MG45969`. |
| CFO 2027, 8.12.4 | `LINDB`. |
| CFO 2027, 9.1 a 9.13 | `DUDH`, `CADH`, `ECA`, `L8072`, `L9099`, `L9455`, `L9605`, `L10741`, `L10826`, `L11340`, `L11343`, `L13431`, `L13869`. |

Os recortes por assunto de Direito Penal, Processo Penal, Civil, Processo Civil e demais matérias ainda precisam de correspondência editorial. A presença do diploma no catálogo não certifica sua redação na data de corte. Os 30 registros de certificação documental e os 15 dispositivos com data de vigência inicial não foram promovidos a versões históricas.

## Como usar a migração

O arquivo em `supabase/pending/` está reservado para homologação. O RPC administrativo `ingest_notice_legal_revision` recebe uma revisão, suas versões e o escopo completo em uma transação READ COMMITTED. O operador fornece IDs estáveis, URL HTTPS, SHA-256 da fonte e evidência de revisão da redação e de seu intervalo. O RPC sela a revisão após validar os vínculos. Uma repetição idêntica retorna o mesmo ID. O RPC rejeita conteúdo divergente e listas parciais de escopo. Uma correção em uma revisão já selada exige nova revisão.

Use um intervalo de vigência semiaberto, com início inclusivo e fim exclusivo. Represente revogação com um registro com `revoked = true` e fonte do ato. Uma eventual restauração de vigência exige um novo registro com fonte própria. Se falta a redação, associe o artigo com `version_id` nulo. Uma lacuna no escopo registrado não permite concluir que o artigo esteja fora do programa oficial.

O RPC `resolve_notice_legal_provision` usa as permissões do chamador. A omissão de `p_revision_id` seleciona a última revisão selada, e o ID explícito preserva o contexto de consultas anteriores. Em modo histórico, trate os estados pendentes sem recorrer ao texto atual. A segunda migração resolve a revisão para questões oficiais pela edição original, fixa a revisão de novos simulados na criação da tentativa e valida a revisão informada pelo tutor.

## Implementação integrada — revisão final de 20/11/2026

Código real no rascunho Lovable `drft_01m7ms02befwys2r2ra1f07e7y`, commit `c7f5495df49248816bfb200283a7b81c6a756e85`. O preview foi materializado no mesmo SHA. O rascunho não foi aceito ou publicado. O repositório operacional principal não foi atualizado. O patch deste PR é aplicável à base real `45e11d6609c6b57f5974231391f67bf389cb04e8`.

| Fluxo | Código real | Comportamento |
| --- | --- | --- |
| Leitor | `src/routes/app.ementario.tsx`, `notice-legal-reading.tsx` | Atual/Edital/Comparar, data de corte, fontes, revisão explícita no link e lacunas visíveis, sem fallback silencioso |
| Questões | `src/routes/app.resolver.tsx`, `question-notice-reading.tsx` | Questão oficial usa a edição original; comentário editorial separado do texto legal |
| Simulados | `src/routes/app.simulados.tsx` | Revisão, concurso e data de criação fixados na tentativa; consultas posteriores preservam a revisão |
| Treino gratuito | `src/components/app/free-practice.tsx` | Sessão fixa revisão na criação; RPC valida dono, questão e envio; textos legais mantêm acesso premium/admin |
| Provas anteriores | `src/routes/app.provas-anteriores.tsx` | Edição pelo ano/concurso e estado pendente quando faltam vínculos certificados |
| Tutor | `src/lib/question-tutor.functions.ts` | Sessão validada no servidor; somente redações resolvidas são evidência; falta de referências bloqueia IA |
| Gabaritos inéditos | `answer-key-status.ts`, `editorial-answer-key-notice.tsx` | Adequação temporal explicitamente pendente; prefixo fixo no tutor; gabarito oficial preservado |

Não existe certificação do gabarito inédito por revisão. A disponibilidade do texto legal não certifica a alternativa editorial. Resultados anteriores não foram regravados. Treino grátis e provas anteriores não possuíam tutor e não receberam um novo tutor.

Marcações, comentários e progresso atuais preservam os mesmos IDs. As ferramentas aparecem em Atual/Comparar e ficam ocultas em Edital para evitar gravação em âncoras incorretas. Edição de marcações históricas por versão ainda não foi implementada.

## Migrações pendentes

Aplicar em ordem somente depois de homologação/autorização para o destino:

1. `20261117130000_notice_legal_snapshots.sql`: versões, escopo selado, RLS e ingestão idempotente.
2. `20261117140000_question_notice_legal_context.sql`: contexto de questões e revisão imutável dos simulados.
3. `20261119150000_list_reader_notices.sql`: lista mínima de editais ativos e históricos selados conforme acesso, sem ampliar a RLS global de notices.
4. `20261120150000_practice_notice_legal_context.sql`: contexto de treino gratuito e provas anteriores.

As quatro permanecem em `supabase/pending`. A última também depende da estrutura já existente de treino gratuito. Os nomes/tipos das colunas de sessões e provas anteriores e os códigos `PMMG_CFO`/`PMMG_SOLDADO` foram conferidos por SELECT no Supabase canônico.

A revisão de segurança detectou e corrigiu uma elevação indevida no wrapper SECURITY DEFINER do treino gratuito: depois de validar dono/sessão/envio, ele verifica premium/admin com `coalesce` antes de resolver texto. Conta grátis recebe `pending_access` sem redação ou data de corte, mantendo gabarito e comentário já autorizados.

## Testes e evidências

| Verificação | Resultado e limite |
| --- | --- |
| Suíte geral do app | 256 PASS no rascunho |
| Integração | 11 PASS, PostgreSQL 17 descartável, sessão/rede sintéticas e IA stub |
| Tipos/build | PASS no rascunho |
| Navegador móvel | Chromium 393x852: leitor Atual/Edital/Comparar, questão oficial e treino gratuito PASS |
| SQL independente no Work | PostgreSQL/PGlite 18.6: quatro migrações reaplicadas, três suítes e acesso grátis/premium/sessão alheia/sem login PASS |
| Bundle DUDH | 30 hashes, ingestão/retry em dois editais sintéticos, 30 versões e 60 vínculos PASS |
| Patch completo | Aplicação conferida contra os arquivos originais da base real, incluindo treino e provas anteriores |

Evidências do navegador: [relatório](../audits/2026-11-20-e2e-navegador-temporal/RELATORIO.md) e [JSON](../audits/2026-11-20-e2e-navegador-temporal/resultado.json). As capturas estão no rascunho Lovable, na mesma pasta. O Work abriu visualmente a captura da questão com redação antiga, corte 09/05/2024 e comentário editorial separado.

Os testes do navegador interceptam o Supabase e executam RPCs temporais no banco descartável; cotas, autenticação e parte das respostas são stubs. Não houve chamada real de IA. A tela de resultado do simulado premium com revisão fixada não foi aberta no navegador; seu contrato tem teste de integração. Não se trata de E2E de produção nem de login real.

Reprodução no código real do aplicativo:

- `bash supabase/tests/notice_legal_local.sh`
- `bash supabase/tests/notice_legal_integration.sh`
- Navegador: seguir o relatório acima e validar JSON com `supabase/tests/browser/check_result.py`.

Verificação independente em memória: `PGLITE_MODULE=/caminho/para/pglite/dist/index.js node supabase/tests/practice_notice_security_local.mjs` e `node supabase/tests/dudh_evidence_local.mjs` com a mesma variável. Versão usada: `@electric-sql/pglite@0.5.16`. Este repositório preserva o patch e os artefatos; a suíte completa deve rodar no código real com suas dependências.

## Cobertura e pendências materiais

SELECT de 20/11 confirmou 30 normas, 7.466 dispositivos, 295 itens (CFO 2027: 193; CFSD 2025: 51; CFSD 2023: 51) e 30 registros formais. As tabelas temporais ainda não existem no banco canônico. Esses registros não comprovam certificação material integral.

`supabase/evidence/dudh-artigos-1-30.json` prepara 30 versões com IDs estáveis e hashes individuais; extratos em `dudh-artigos-1-30.txt`. Fonte institucional UNICEF conferida em 20/11. Texto coincide com os 30 dispositivos cadastrados normalizando apenas espaços. ID e hash já preparados do art. 3 preservados. A data 10/12/1948 é a adoção/proclamação declarada pela fonte, não vigência de tratado. O bundle não inclui revisão oficial de edital ou selo. Cobre DUDH no CFO 2027 item 9.1 e CFSD 2025 item 4.3, sem certificar as demais normas.

A cópia consolidada do CFSD 2025 também contém a Errata nº 01, de 19/06/2024, sobre coleta de amostra no exame toxicológico (página 5 do PDF de 93 páginas). As retificações nº 01 e nº 02 tratam de vagas e calendário. Essas cópias não demonstram, por si, exaustividade da cadeia oficial. A tentativa de recuperar o portal oficial do CRS em 20/11 retornou timeout.

**P0 permanece aberto:** falta confirmar a cadeia oficial completa e os marcos de corte, mapear e conferir os demais dispositivos, preparar seu acervo histórico e concluir homologação autenticada contra ambiente com dados certificados. Nenhuma edição é declarada integralmente certificada. CFO 2025/2026 e CFSD 2023 seguem com as pendências documentais da tabela inicial.

Merge, aceitação do rascunho, publicação, migrações e importação em produção dependem de autorização específica. Nenhuma dessas operações foi executada nesta retomada.
