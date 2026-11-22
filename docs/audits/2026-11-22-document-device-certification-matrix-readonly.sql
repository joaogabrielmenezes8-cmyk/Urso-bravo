-- URSO BRAVO | auditoria somente leitura | 2026-11-22
-- Diferencia certificação documental de evidência individual e vigência temporal.
-- Não promove status nem presume vigência a partir de campos nulos.
WITH per_document AS (
 SELECT p.document_id,
        count(*) AS devices,
        count(*) FILTER (WHERE p.effective_from IS NOT NULL) AS with_start,
        count(*) FILTER (WHERE p.effective_to IS NOT NULL) AS with_end,
        count(*) FILTER (WHERE p.verified_at IS NOT NULL) AS individually_verified,
        count(*) FILTER (WHERE p.completeness = 'full') AS full_text,
        count(*) FILTER (WHERE p.completeness = 'excerpt') AS excerpts,
        count(*) FILTER (WHERE p.completeness = 'under_review') AS under_review
 FROM public.legal_provisions p GROUP BY p.document_id
)
SELECT d.document_id, d.devices, d.with_start, d.with_end,
       d.individually_verified, d.full_text, d.excerpts, d.under_review,
       (c.document_id IS NOT NULL) AS has_document_certification,
       (c.certified_at IS NOT NULL) AS document_certified,
       (c.certified_fingerprint IS NOT NULL) AS has_document_fingerprint,
       (c.reader_e2e_checked_at IS NOT NULL) AS reader_e2e_recorded,
       (c.question_links_checked_at IS NOT NULL) AS question_links_recorded
FROM per_document d
LEFT JOIN public.legal_document_certifications c ON c.document_id=d.document_id
ORDER BY d.devices DESC, d.document_id;

-- Revisões por estado: não contar presença de URL como certificação histórica.
SELECT completeness, count(*) AS devices,
       count(*) FILTER (WHERE verified_at IS NOT NULL) AS verified,
       count(*) FILTER (WHERE official_url IS NOT NULL OR official_anchor_url IS NOT NULL) AS with_source
FROM public.legal_provision_review_queue
GROUP BY completeness ORDER BY devices DESC;

-- Pré-requisito do resolvedor no banco canônico (zero significa não instalado).
SELECT count(*) AS resolver_overloads
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='resolve_notice_legal_provision';
