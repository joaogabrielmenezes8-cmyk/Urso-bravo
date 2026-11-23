-- URSO BRAVO: auditoria temporal somente leitura (2026-11-22).
-- Executar no projeto canônico somente com permissões SELECT.
-- Não certifica vigência nem altera dados.
SELECT
  count(*) AS total_dispositivos,
  count(*) FILTER (WHERE effective_from IS NOT NULL) AS inicio_vigencia_preenchido,
  count(*) FILTER (WHERE effective_to IS NOT NULL) AS fim_vigencia_preenchido,
  count(*) FILTER (WHERE verified_at IS NOT NULL) AS verificados
FROM public.legal_provisions;

SELECT completeness,
       count(*) AS registros,
       count(*) FILTER (WHERE verified_at IS NOT NULL) AS com_verificacao
FROM public.legal_provision_review_queue
GROUP BY completeness
ORDER BY count(*) DESC;

-- Conferir instalação do resolvedor sem depender de seu corpo.
SELECT count(*) AS resolvedores_instalados
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='resolve_notice_legal_provision';

-- Falta de datas não implica revogação nem vigência indefinida.
-- A certificação histórica exige ato oficial, marco de publicação e vacatio legis.
