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

## Aplicação e testes

- O código do app foi encontrado no Lovable no commit `45e11d6609c6b57f5974231391f67bf389cb04e8`. O GitHub continha o README do projeto. `integracao/leitor-vade-mecum-temporal.patch` é o diff aplicável ao leitor dessa base, com os modos atual, edital e comparação. As anotações existentes continuam vinculadas ao dispositivo no modo atual. O texto histórico fica em uma área própria, sem gravar marcação na redação errada.
- Em um banco local vazio e descartável, execute via `psql -v ON_ERROR_STOP=1` os arquivos `supabase/tests/notice_legal_snapshots_fixture.sql`, `supabase/pending/20261117130000_notice_legal_snapshots.sql` e `supabase/tests/notice_legal_snapshots.sql`, nessa ordem. A suíte passou em PostgreSQL 18.6 via PGlite.
- O patch passou em `git diff --check` e transpilação TSX isolada. A suíte completa do app e a homologação autenticada continuam pendentes.

## Integração e ensaio da retomada

- A expansão de `integracao/leitor-vade-mecum-temporal.patch` usa os arquivos da mesma base real do Lovable. O leitor abre a redação da revisão a partir do resultado da questão em outra aba para preservar a tentativa. Marcações, comentários e progresso existentes continuam na leitura atual. A comparação ignora diferenças de cabeçalho e formatação simples.
- O solucionador, os resultados de simulado e o tutor usam `resolve_question_notice_legal_context`. A IA recebe apenas as redações certificadas da revisão consultada. O gabarito original da banca fica separado da correção atual. O histórico legado em `historical_exam_practice` e as rotas de prática gratuita ainda precisam de homologação e vínculo com o novo serviço.
- A migração `supabase/pending/20261117140000_question_notice_legal_context.sql` deve ser aplicada depois da primeira. Os testes adicionais estão em `supabase/tests/question_notice_legal_context*.sql`. Execute a fixture de contexto antes das duas migrações e a suíte de contexto depois das duas. As duas suítes SQL passaram no PostgreSQL 18.6 via PGlite.
- Apliquei o patch em uma cópia limpa dos arquivos reais e transpilei os 10 arquivos alterados. Rodei testes de comparação do leitor, entrada do tutor e regressões existentes de anotações, progresso e URLs em ambiente isolado.
- `supabase/evidence/dudh-artigo-3.json` contém uma redação conferida, reutilizável no item 9.1 do CFO 2027 e 4.3 do CFSD 2025. Os respectivos escopos foram ensaiados em dois editais de teste, com reprocessamento e apenas uma versão gravada. O artefato não contém um selo editorial oficial dos editais. Os demais dispositivos continuam pendentes de conferência individual.
- O rascunho do Lovable continua no commit-base publicado antes desta integração. Seu editor privado exige sessão com acesso e a operação disponível no conector não endereça o rascunho. O preview remoto ainda não contém a integração. Não houve alteração no Supabase canônico.


## Reconciliação com o repositório operacional — 19/11/2026

Consulta direta ao repositório privado `joaogabrielmenezes8-cmyk/screenshot-exact-match` (branch `main`) confirmou `package.json` com `name: urso-bravo`, Vite, React 19, TanStack Router/Start, Supabase e Vitest. Os seguintes caminhos foram abertos e conferidos, não apenas presumidos:

| Fluxo | Arquivo existente no aplicativo | Integração prevista no patch |
| --- | --- | --- |
| Leitor e anotações | `src/routes/app.ementario.tsx` | `NoticeLegalReading`, mantendo marcações atuais isoladas da redação histórica |
| Resolução de questões | `src/routes/app.resolver.tsx` | `QuestionNoticeReading` e contexto por revisão |
| Simulados | `src/routes/app.simulados.tsx` | fixação da revisão da tentativa, preservando gabarito original |
| Tutor IA | `src/components/app/question-tutor.tsx` | contexto temporal certificado e referências da edição |

O repositório operacional também contém `src/lib/supabase.ts` e `src/lib/legal-reading-format.ts`. **A existência desses arquivos não comprova que o patch foi aplicado nem que o app publicado corresponde ao HEAD do GitHub.** A busca de código no repositório privado não retornou resultados; os caminhos acima foram confirmados por leitura direta. Não inferir ausência de componentes a partir da busca vazia.

Próxima entrega de código: aplicar o patch em branch isolada do repositório operacional após confirmar a revisão base, executar `npm run build` e `npm test`, e validar RPCs com dados sintéticos e sessão autenticada em banco descartável. Não migrar produção nem preencher versões históricas sem fonte oficial e certificação.
