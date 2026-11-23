-- Read-only inventory. An inventory match never certifies a historical version.
with diploma_scope(edition, edital_item, code, article_numbers) as (
  values
    ('CFSD_2025', '4.1', 'CF88', array[
      1,2,3,4,5,12,13,14,15,16,37,38,39,40,41,42,122,123,124,125,126,142,143,144
    ]),
    ('CFSD_2025', '4.2', 'LINDB', null),
    ('CFSD_2025', '4.3', 'DUDH', null),
    ('CFSD_2025', '4.4', 'CADH', null),
    ('CFO_2027', '4.10', 'CF88', null),
    ('CFO_2027', '4.11', 'CEMG', null),
    ('CFO_2027', '7.12', 'L8429', null),
    ('CFO_2027', '7.13', 'L13019', null),
    ('CFO_2027', '7.14', 'L13709', null),
    ('CFO_2027', '7.15', 'L14133', null),
    ('CFO_2027', '7.16', 'MG45969', null),
    ('CFO_2027', '8.12.4', 'LINDB', null),
    ('CFO_2027', '9.1', 'DUDH', null),
    ('CFO_2027', '9.2', 'CADH', null),
    ('CFO_2027', '9.3', 'ECA', null),
    ('CFO_2027', '9.4', 'L8072', null),
    ('CFO_2027', '9.5', 'L9099', null),
    ('CFO_2027', '9.6', 'L9455', null),
    ('CFO_2027', '9.7', 'L9605', null),
    ('CFO_2027', '9.8', 'L10741', null),
    ('CFO_2027', '9.9', 'L10826', null),
    ('CFO_2027', '9.10', 'L11340', null),
    ('CFO_2027', '9.11', 'L11343', null),
    ('CFO_2027', '9.12', 'L13431', null),
    ('CFO_2027', '9.13', 'L13869', null)
)
select
  scope.edition, scope.edital_item, scope.code,
  document.id is not null as diploma_in_catalog,
  exists (
    select from public.exam_syllabus_items item
    where item.edition = scope.edition and item.item_code = scope.edital_item
  ) as syllabus_item_in_catalog,
  cardinality(scope.article_numbers) as expected_article_count,
  count(distinct provision.provision_key) as catalog_key_count,
  count(provision.id) filter (where provision.effective_from is not null) as dated_rows
from diploma_scope scope
left join public.legal_documents document on document.code = scope.code
left join public.legal_provisions provision on provision.document_id = document.id
  and (scope.article_numbers is null or provision.provision_key in (
    select 'art-' || lpad(article::text, 5, '0')
    from unnest(scope.article_numbers) article
  ))
group by scope.edition, scope.edital_item, scope.code, document.id, scope.article_numbers
order by scope.edition, string_to_array(scope.edital_item, '.')::int[];
