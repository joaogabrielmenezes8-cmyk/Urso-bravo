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
| Todos | Sem erros de console | PASS |

Reprodução: `bash supabase/tests/browser/start_throwaway_db.sh > /tmp/browser/e2e/dbdir.txt` e, nessa pasta,
`python3 notice_legal_browser_e2e.py` (dev server em localhost:8080). Capturas nesta pasta; saída bruta em `resultado.json`.
Limitações: sem login real, sem dados reais, cota e gabarito do treino vieram de stubs; acervo histórico não certificado.
