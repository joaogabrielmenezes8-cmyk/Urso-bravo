# E2E local de navegador — Vade Mecum temporal (20/11/2026)

**Natureza:** teste local, não é teste de produção. Chromium/Playwright, viewport móvel 393x852, contra o servidor de desenvolvimento do rascunho.
Sessão sintética (JWT não assinado no armazenamento local), rede do Supabase interceptada: as RPCs temporais
(`list_reader_notices`, `resolve_notice_legal_provision`, `resolve_question_notice_legal_context`,
`resolve_free_practice_notice_legal_context`) foram executadas em PostgreSQL descartável com as migrações pendentes e dados sintéticos;
demais tabelas e RPCs de cota/acesso foram stubs. Nenhuma chamada a IA, funções remotas ou rede externa (`unexpected_network` vazio).

| Cenário | Verificação | Resultado |
|---|---|---|
| Leitor (premium) | Atual mostra redação atual | PASS |
| Leitor | Lista traz edital ativo e histórico selado | PASS |
| Leitor | Edital 2025: redação antiga e corte 09/05/2024 | PASS |
| Leitor | Comparar indica divergência | PASS |
| Questão oficial (premium) | Edição original, corte 09/05/2024, texto antigo, sem texto atual, comentário editorial rotulado | PASS |
| Treino grátis | Sem gabarito/comentário antes da correção | PASS |
| Treino grátis | Gabarito preservado e 2 comentários editoriais rotulados | PASS |
| Treino grátis | Nenhum texto legal nem data de corte (estado pendente) | PASS |
| Treino grátis | 2 rótulos "Gabarito editorial · adequação temporal pendente" | PASS |
| Questão oficial | Sem rótulo editorial (gabarito oficial preservado) | PASS |
| Todos | Sem erros de console | PASS |

Reprodução no código real do aplicativo, com PostgreSQL, Python/Playwright e servidor de desenvolvimento em localhost:8080: crie `/tmp/browser/e2e`, execute `bash supabase/tests/browser/start_throwaway_db.sh > /tmp/browser/e2e/dbdir.txt`, depois `python3 supabase/tests/browser/notice_legal_browser_e2e.py > /tmp/browser/e2e/resultado.json` e `python3 supabase/tests/browser/check_result.py /tmp/browser/e2e/resultado.json`. O banco usa socket Unix e porta 55443; encerre o processo local com pg_ctl ao terminar. As capturas foram versionadas no rascunho Lovable nesta pasta e são geradas em `/tmp/browser/e2e/shots` pelo script. Este PR preserva o relatório e JSON, sem copiar os binários.
Limitações: sem login real, sem dados reais, cota e gabarito do treino vieram de stubs; acervo histórico não certificado.


Revisão final do aplicativo: `c7f5495df49248816bfb200283a7b81c6a756e85`. Resultado final: 256 testes gerais, 11 testes de integração, typecheck e build aprovados no ambiente do rascunho. Simulados premium com revisão fixada possuem teste de integração, mas a tela de resultado desse fluxo não foi aberta no navegador. O tutor foi testado com IA stub em testes automatizados, sem chamada real no E2E. Verificador de JSON acrescentado no PR: relatório final aceito e cenário deliberadamente falso rejeitado.
