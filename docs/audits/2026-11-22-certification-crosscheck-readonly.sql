-- Complemento da auditoria temporal: distinguir certificação documental,
-- revisão individual e períodos de vigência. Somente leitura.
-- Não executar UPDATE/INSERT nem inferir certificação temporal de certified_at.

SELECT
  count(*) AS documentos_com_registro,
  count(*) FILTER (WHERE certified_at IS NOT NULL) AS documentos_certificados,
  count(*) FILTER (WHERE integrality_checked_at IS NOT NULL) AS integridade_conferida,
  count(*) FILTER (WHERE question_links_checked_at IS NOT NULL) AS questoes_conferidas,
  count(*) FILTER (WHERE reader_e2e_checked_at IS NOT NULL) AS leitor_e2e_conferido
FROM public.legal_document_certifications;

-- Cruzamento por documento, sem duplicar dispositivos quando houver
-- múltiplos registros de certificação.
SELECT
  q.document_code,
  count(DISTINCT q.provision_id) AS dispositivos_na_fila,
  count(DISTINCT q.provision_id) FILTER (WHERE q.verified_at IS NOT NULL) AS verificados_na_fila,
  count(DISTINCT q.provision_id) FILTER (WHERE q.completeness = 'full') AS texto_completo_na_fila,
  count(DISTINCT q.provision_id) FILTER (WHERE p.effective_from IS NOT NULL) AS com_inicio_vigencia,
  count(DISTINCT q.provision_id) FILTER (WHERE p.effective_to IS NOT NULL) AS com_fim_vigencia,
  count(DISTINCT q.provision_id) FILTER (WHERE c.certified_at IS NOT NULL) AS vinculados_documento_certificado
FROM public.legal_provision_review_queue q
LEFT JOIN public.legal_provisions p ON p.id=q.provision_id
LEFT JOIN public.legal_document_certifications c ON c.document_id=q.document_id
GROUP BY q.document_code
ORDER BY dispositivos_na_fila DESC, q.document_code;

-- Estados de corte: a ausência do resolvedor é um bloqueio técnico
-- independente da certificação documental.
SELECT count(*) AS resolvedores_temporais
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='resolve_notice_legal_provision';
