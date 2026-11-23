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
| CFSD 2025, 4.1 | `CF88`: arts. 1º a 5º, 12 a 16, 37, 38, 42, 122 a 126 e 142 a 144 (21 artigos; Seções I e III, sem arts. 39–41). Os dispositivos vinculados a cada artigo precisam ser conferidos individualmente. |
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

Marcações, comentários e progresso atuais preservam os mesmos IDs. No rascunho c7f5495 as ferramentas antigas aparecem em Atual/Comparar. Em 22/11 foi implementada no patch deste PR a edição histórica vinculada ao ID da versão, com âncoras exatas e tabela própria, sem regravar anotações antigas. Essa atualização adicional ainda não foi aplicada ao rascunho Lovable: a navegação ao editor foi bloqueada por política de acesso do navegador; não houve contorno do bloqueio.

## Migrações pendentes

Aplicar em ordem somente depois de homologação/autorização para o destino:

1. `20261117130000_notice_legal_snapshots.sql`: versões, escopo selado, RLS e ingestão idempotente.
2. `20261117140000_question_notice_legal_context.sql`: contexto de questões e revisão imutável dos simulados.
3. `20261119150000_list_reader_notices.sql`: lista mínima de editais ativos e históricos selados conforme acesso, sem ampliar a RLS global de notices.
4. `20261120150000_practice_notice_legal_context.sql`: contexto de treino gratuito e provas anteriores.
5. `20261122030000_legal_version_annotations.sql`: notas e destaques vinculados à versão imutável, offsets Unicode, seleção validada no servidor e RLS por dono/acesso ao texto.

As cinco permanecem em `supabase/pending`. A quarta também depende da estrutura já existente de treino gratuito. Os nomes/tipos das colunas de sessões e provas anteriores e os códigos `PMMG_CFO`/`PMMG_SOLDADO` foram conferidos por SELECT no Supabase canônico.

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


## Implementação e acervo — 22/11/2026

HEAD inicial confirmado: `2a8cece280c6c1a9ef6d806fa242f787e60039a7`. O ajuste concorrente de limpeza do PostgreSQL descartável foi preservado. A branch e o PR existentes foram mantidos.

### Marcações históricas implementadas

O patch acrescenta `legal-version-annotations.tsx`, `legal-version-selection.ts`, seus testes, e altera `notice-legal-reading.tsx` e `legal-highlighted-text.tsx`. Comentário/destaque grava `user_id` e `version_id`; a âncora é medida em pontos de código Unicode e validada contra o corpo imutável no PostgreSQL. Trechos repetidos não deslocam a marcação para outra ocorrência. Trocar usuário ou versão reinicia o rascunho local e usa outra chave de consulta. Erros de persistência são exibidos.

A quinta migração não modifica `student_study_annotations` nem o progresso existente. O dono e a versão de uma anotação não podem ser trocados; acesso ao texto histórico continua sujeito às permissões existentes. A validação de seleções usa o corpo literal, evitando diferença entre texto formatado e offsets.

**Estado de aplicação:** código novo no patch versionado e testado localmente. O rascunho real continua em `c7f5495`; não foi atualizado com as novas marcações nem houve novo preview integral nesta retomada. O bloqueio do editor não foi contornado.

### Lotes preparados

| Lote | Estados textuais preparados | Limite material |
| --- | ---: | --- |
| DUDH | 30 | Lote anterior preservado; adoção não tratada como vigência de tratado |
| CADH | 81 | Todos os 43 pendentes foram revisados; 42 preparados, art. 31 continua pendente |
| LINDB | 29 | Art. 25 vetado, sem redação normativa fictícia |
| CF88 — recorte CFSD | 23 estados para 21 artigos | Art. 37 possui três intervalos; arts. 16 e 142 exigem revisão da eficácia derivada |
| Lei 9.455 — Tortura | 5 estados para 4 artigos | Acréscimo de 2026 separado da redação anterior |
| Lei 13.431 — Escuta protegida | 30 estados para 29 artigos | Vacatio de um ano e acréscimo de 2022 individualizados |
| Lei 13.869 — Abuso de Autoridade | 40 redações para 46 slots | Seis vetos integrais; dez datas de eficácia derivadas exigem revisão |
| **Total** | **238 estados para 234 dispositivos distintos** | **Nenhum selo de edital** |

CADH: `cadh-reconciliation-20261122.json` registra a análise individual. O cabeçalho da Seção 2 foi retirado do corpo do art. 60 por erro de extração. Diferenças de transcrição/leitura não foram classificadas como alterações legislativas. O art. 31 da OEA remete aos arts. 76/77; publicações brasileiras oficiais consultadas transcrevem 69/70. Não se escolheu silenciosamente uma delas. As 39 versões anteriores e seus IDs/payloads foram preservados. Fonte OEA integral extraída em 20/11, revisada em 22/11; a nova recuperação integral apresentou 403, registrada sem alegar nova captura completa.

LINDB: extratos oficiais da Câmara e fontes de vigência versionados. Art. 29 vigora em 23/10/2018, após 180 dias; demais acréscimos normativos de 2018 em 26/04/2018. Art. 18 tem estado composto desde 27/02/2014, após 120 dias da Lei 12.874/2013. Revogações parciais dos arts. 1º e 15 preservadas. Texto legislativo literal não substitui análise de EC45, EC66, CPC ou jurisprudência.

CF88: art. 37 separa os intervalos 16/03/2021–20/12/2024, 20/12/2024–22/12/2025 e 22/12/2025–01/01/2027. A reconstrução aplica somente substituições expressas da EC135 (§11) e EC138 (XVI,b) ao texto oficial do Senado; a regra transitória do art. 3º da EC135 permanece referência correlata. §§17/18 da EC132 não foram antecipados: sua vigência é em 2027. Arts. 16 e 142 usam data de promulgação por incidência constitucional imediata, identificada como interpretação derivada e sujeita a revisão; não como cláusula expressa ou certificação institucional.

### Cobertura calculável

Manifesto: `supabase/evidence/p0-device-coverage-20261122.json`. O CFO inclui registro TSV dos 2.130 IDs canônicos dos 21 diplomas expressos; o manifesto enumera exceções preparadas e o estado pendente padrão, permitindo reconstrução individual completa.

| Edital | Denominador identificado | Dispositivos com texto preparado | Preparação | Certificados para o edital |
| --- | ---: | ---: | ---: | ---: |
| CFSD 2025 | 163 slots de artigo | 161 | 98,7730% | 0/163 — 0% |
| CFO 2027 | 2.130 slots dos diplomas expressos | 234 | 10,9859% | 0/2.130 — 0% |

O denominador inclui o slot vetado LINDB25. A CADH31 permanece sem versão. Dois artigos constitucionais e dez artigos com partes promulgadas posteriormente da Lei 13.869 têm revisão material da data de eficácia pendente. Os percentuais de preparação não são percentuais de certificação jurídica. O denominador do CFO **não representa o programa integral**: recortes temáticos CP/CPP/CC/CPC e completude do catálogo ainda precisam ser mapeados. Nenhum dado de produção foi sobrescrito.

### Editais: evidência e impedimento exato

`p0-official-notice-chain-20261122.json` separa assinatura, publicação, vigência, cópia e original. O portal CRS e a autenticidade do Diário retornaram timeout. Foi localizada a URL oficial direta do CFO, `https://policiamilitar.mg.gov.br/conteudoportal/sites/concurso/030920260905177550.pdf`, mas a recuperação retornou timeout. A URL do CFSD citada em fonte secundária, `https://intranet.policiamilitar.mg.gov.br/conteudoportal/sites/concurso/090520242041069440.pdf`, retornou 502.

As cópias conhecidas da Errata01 e Retificações01/02 do CFSD estão individualizadas no ledger. Isso não comprova cadeia exaustiva. Uma cópia de ato posterior cita Diário de 11/05/2024; não foi confundida com prova da publicação integral no CRS. Cortes 09/05/2024 e 03/09/2026 continuam candidatos, sem selo. Hash de PDF original inacessível permanece nulo.

### Homologação essencial desta retomada

- `legal_version_annotations_local.mjs`: PASS para CRUD, imutabilidade, seleção Unicode/repetida, RLS, isolamento e preservação do legado.
- `cadh_evidence_local.mjs`: PASS, 82 hashes, 81 versões, 164 vínculos/retry e art31 pendente.
- `lindb_evidence_local.mjs`: PASS, 30 hashes, 29 versões, 60 vínculos/retry, veto e rejeição durante vacatio.
- `cf88_evidence_local.mjs`: PASS, 23 estados, 21 artigos, 42 vínculos/retry e seleção distinta do art37.
- `p0_acervo_homologation_local.mjs`: PASS, cinco migrações duas vezes, três suítes SQL, 238 estados, 2.293 vínculos em editais sintéticos, mesma revisão em questão/simulado/contexto do tutor, notas por versão e RLS.
- React: duas suítes, sete testes PASS; TypeScript focado PASS; aplicação do patch à base real conferida.
- As 256 verificações/11 integrações anteriores não foram repetidas a cada alteração. Não houve chamada real à IA, login real ou novo preview integral.

Comandos dos testes de evidência: `PGLITE_MODULE=/caminho/pglite/dist/index.js node supabase/tests/<arquivo>.mjs`. Nenhum aceita URL/credencial de banco remoto. Evidência consolidada: `audits/2026-11-22-temporal/resultado.json`.

Persistem: certificação dos marcos/cadeia oficiais; conflito CADH31; revisão material de eficácia CF16/142; demais 1.888 slots do recorte explícito CFO sem versão; demais recortes temáticos; aplicação operacional das novas marcações e homologação autenticada. Não há certificação integral, merge, deploy ou escrita no banco de produção.

### Lotes CFO adicionais — mesma retomada

`l9455-artigos-1-4.json`: quatro artigos, cinco estados. Art. 1º distingue 01/01/2004–21/05/2026 e a redação desde 21/05/2026 (Lei 15.410/2026, arts. 3º e 4º). Os arts. 2º–4º têm vigência inicial em 08/04/1997. A redação do art. 1º anterior a 2004 não foi preparada por estar fora dos cortes prioritários. O catálogo atual já contém o inciso III de 2026; não foi sobrescrito. O art. 4º é regra revogadora do ECA233, sem receber `revoked=true` indevidamente.

`l13431-artigos-1-29.json`: 29 artigos, 30 estados; início 05/04/2018 comprovado pela publicação, art. 29 e registro do Senado. Art. 4º separa o acréscimo do inciso V em 09/07/2022, após 45 dias da publicação da Lei 14.344. O posicionamento gráfico do inciso V foi corrigido para o caput conforme art. 28 da lei modificadora; extrato bruto da Câmara preservado. Estrutura de 11 títulos/capítulos mantida como metadados. A citação do ECA208 no art. 25 não gerou artigo espúrio.

`l9455_evidence_local.mjs`: PASS, cinco hashes/estados e oito vínculos/retry; acréscimo de 2026 ausente na redação anterior. `l13431_evidence_local.mjs`: PASS, 30 hashes/estados, 58 vínculos/retry, vacatio, hierarquia e regra revogadora. Integração essencial repetida somente após esses novos lotes: PASS com 198 estados e 2.293 vínculos. Fontes e divergências de transcrição em `cfo-lotes-fontes-20261122.json`.

### Lei de Abuso de Autoridade — lote adicional

`l13869-artigos-1-45.json` e extratos: 46 slots (incluindo 15-A), 40 redações e seis vetos integrais (11, 14, 17, 26, 34, 35). Vetos não foram convertidos em revogações. A retificação de 05/09/2019 corrige a mensagem de veto; a de 18/09/2019 corrige a pena omitida do art. 13. A promulgação de partes ocorreu em 27/09/2019. O art. 15-A foi acrescido pela Lei 14.321, publicada com vigência imediata em 01/04/2022.

Os artigos sem essas partes posteriores adotam o intervalo inicial calculado pelo art. 45: publicação 05/09/2019 + 120 dias = 03/01/2020. Os dez estados compostos com partes promulgadas depois adotam 27/09/2019 + 120 dias = 25/01/2020, com **data derivada expressamente sujeita a revisão material**, sem apresentá-la como cláusula expressa ou certificação institucional. Estados intermediários anteriores aos cortes prioritários não foram preparados. A retificação adicional da mensagem de veto, identificada pelo link159057, não foi recuperada; não foi presumido efeito normativo nem exaustividade da cadeia.

`l13869_evidence_local.mjs`: PASS, 46 hashes, 40 versões/92 vínculos com retry, vetos separados, pena do art. 13, nome jurídico do art. 15-A e rejeição de aplicação anterior à sua vigência. Integração essencial final: **PASS com 238 estados e 2.293 vínculos**. CFO: 234 preparados, sete slots vetados conhecidos, CADH31 em conflito e 1.888 slots ainda sem evidência histórica preparada, dentro do recorte explícito parcial. Doze dispositivos preparados do CFO têm revisão de eficácia derivada pendente.


## Lote massivo CFO — 23/11/2026

Preparados 146 dispositivos adicionais: 81 da Lei 9.099/1995 e 65 da Lei 9.605/1998. Cada corpo integral foi confrontado com publicação original e compilação oficial da Câmara, normalizando apenas espaços/quebras; hashes das capturas e dos extratos estão nos bundles `l9099-originais-20261123.json` e `l9605-originais-20261123.json`. Oito vetos integrais foram separados e não contam como texto. L9099 art85 permanece sem versão aplicável preparada para revisão de derrogação/jurisprudência. Dispositivos alterados e diferenças documentais não foram completados por inferência.

Os inícios propostos são 26/11/1995 (L9099 art96, sessenta dias da publicação de 27/09) e 30/03/1998 (L9605 art81 vetado, regra de 45 dias da LINDB, publicação de 13/02). A retificação de 17/02/1998 da L9605 corrige apenas a epígrafe e foi documentada separadamente, sem alteração do corpo dos artigos. Não há certificação formal por edital.

Acumulado: **393 estados textuais / 389 dispositivos**, CFO **389/2.130 (18,2629%)**, apenas diplomas expressos. Restam 1.741 slots sem texto preparado: 1.725 pendentes de evidência histórica, 15 vetos integrais e CADH31 em conflito. As 12 revisões materiais de datas anteriores permanecem pendentes. CFSD permanece 161/163, certificação formal 0%.

O inventário do Anexo B registra 163 tópicos jurídicos no PDF capturado. A matriz temática acrescenta 2.029 correspondências editoriais candidatas com 1.129 dispositivos canônicos (CP360, CPP335, CC350, CPC84). Essas faixas não são limites expressos de artigos no edital e não encerram doutrina/jurisprudência. Permanecem fora do denominador até revisão material e confirmação da fonte oficial. A obtenção direta do PDF oficial retornou HTTP503; a cópia de referência e o extrato receberam hashes, sem equipará-los a captura oficial ou cadeia exaustiva.

Reprodução local: `python scripts/prepare-original-law-batch.py --source-dir <capturas> --evidence-dir supabase/evidence --law L9099` (repetir L9605). Usa HTMLs oficiais capturados, conforme nomes e hashes nos bundles; requer Python/lxml. Nenhuma conexão de banco é utilizada pelo preparador. O mapeador `scripts/map-cfo-thematic-candidates.py` usa capturas locais do PDF e estrutura oficial dos códigos, além de catálogo obtido por SELECT, e não produz certificação.

Validação: `original_law_batches_local.mjs` PASS; regeneração byte a byte PASS; `cfo_thematic_map_local.mjs` PASS; regressão integrada `p0_acervo_homologation_local.mjs` PASS com 393 estados e 2.293 vínculos, ingestão idempotente, contexto temporal, RLS, notas e legado em PostgreSQL descartável. Evidência: `audits/2026-11-23-temporal/lote-massivo.json`. Não houve login real, chamada real à IA, integração nova ao preview, merge, deploy ou escrita em produção.
