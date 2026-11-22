// In-memory verification only. No remote database configuration is accepted.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const bundle = JSON.parse(read('evidence/cadh-artigos-1-82.json'));
const extracts = read('evidence/cadh-artigos-1-82-oea.txt').split('\n\nArtigo ');
if (extracts.length !== 82 || bundle.versions.length !== 81 || bundle.pending_count !== 1) throw Error('Unexpected coverage');
for (let i = 0; i < 82; i++) {
  const extract = (i ? 'Artigo ' : '') + extracts[i] + (i < 81 ? '\n' : '');
  if (createHash('sha256').update(extract).digest('hex') !== bundle.scope_preparation[i].source_sha256) throw Error('Digest mismatch ' + (i + 1));
}
const conflict=bundle.scope_preparation.find(s=>s.article===31);
if(conflict.version_id!==null) throw Error('Official cross-reference conflict was silently certified');
const sixty=bundle.versions.find(v=>v.provision_id===bundle.scope_preparation.find(s=>s.article===60).provision_id);
if(sixty.body.includes('Seção 2')) throw Error('Section heading leaked into article 60');
const db = new PGlite();
try {
  await db.exec(read('tests/notice_legal_snapshots_fixture.sql'));
  await db.exec(read('pending/20261117130000_notice_legal_snapshots.sql'));
  for (const s of bundle.scope_preparation) await db.query('insert into public.legal_provisions values($1)', [s.provision_id]);
  for (let i = 1; i <= 2; i++) {
    const revision = { id: `c0000000-0000-4000-8000-00000000000${i}`,
      notice_id: `10000000-0000-0000-0000-00000000000${i}`, revision: 1,
      cutoff_on: i === 1 ? '2024-05-09' : '2026-09-03',
      cutoff_clause: 'SYNTHETIC TEST ONLY - no official notice certification',
      source_url: 'https://example.test/synthetic-notice', source_sha256: 'c'.repeat(64) };
    const scope = bundle.scope_preparation.map(s => ({ revision_id: revision.id,
      provision_id: s.provision_id, syllabus_locator: i === 1 ? '4.4' : '9.2', version_id: s.version_id }));
    for (let pass = 0; pass < 2; pass++) await db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',
      [JSON.stringify(revision), JSON.stringify(bundle.versions), JSON.stringify(scope)]);
  }
  const { rows } = await db.query('select (select count(*) from public.legal_provision_versions) as versions, (select count(*) from public.notice_legal_scope) as scopes');
  if (rows[0].versions !== 81 || rows[0].scopes !== 164) throw Error(JSON.stringify(rows));
  await db.exec("set role authenticated; set test.premium='yes'; set test.admin='no';");
  const statuses = {};
  for (const s of bundle.scope_preparation) {
    const { rows } = await db.query("select status from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000001',$1)", [s.provision_id]);
    statuses[rows[0].status] = (statuses[rows[0].status] || 0) + 1;
  }
  if (statuses.available !== 81 || statuses.pending_version !== 1) throw Error(JSON.stringify(statuses));
  console.log('PASS: 82 digests, 81 versions/164 links with exact retry, article 31 stays pending');
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { await db.close(); }
