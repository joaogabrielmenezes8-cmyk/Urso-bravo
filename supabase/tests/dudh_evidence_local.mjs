// Disposable database only. PGLITE_MODULE may point to an installed PGlite module.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const bundle = JSON.parse(read('evidence/dudh-artigos-1-30.json'));
const extracts = read('evidence/dudh-artigos-1-30.txt').split('\n\nArtigo ');
if (extracts.length !== 30 || bundle.versions.length !== 30) throw Error('Expected 30 articles');
for (let i = 0; i < 30; i++) {
  const extract = (i ? 'Artigo ' : '') + extracts[i] + (i < 29 ? '\n' : '');
  if (createHash('sha256').update(extract).digest('hex') !== bundle.versions[i].source_sha256) {
    throw Error('Digest mismatch for article ' + (i + 1));
  }
}
const db = new PGlite();
try {
  await db.exec(read('tests/notice_legal_snapshots_fixture.sql'));
  await db.exec(read('pending/20261117130000_notice_legal_snapshots.sql'));
  for (const v of bundle.versions) await db.query('insert into public.legal_provisions values($1)', [v.provision_id]);
  for (let i = 1; i <= 2; i++) {
    const revision = {
      id: `b0000000-0000-4000-8000-00000000000${i}`,
      notice_id: `10000000-0000-0000-0000-00000000000${i}`,
      revision: 1, cutoff_on: i === 1 ? '2024-05-09' : '2026-09-03',
      cutoff_clause: 'SYNTHETIC TEST ONLY - no official notice certification',
      source_url: 'https://example.test/synthetic-notice', source_sha256: 'a'.repeat(64),
    };
    const scope = bundle.versions.map(v => ({ revision_id: revision.id,
      provision_id: v.provision_id, syllabus_locator: i === 1 ? '4.3' : '9.1', version_id: v.id }));
    for (let pass = 0; pass < 2; pass++) await db.query(
      'select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',
      [JSON.stringify(revision), JSON.stringify(bundle.versions), JSON.stringify(scope)],
    );
  }
  const { rows } = await db.query('select (select count(*) from public.legal_provision_versions) as versions, (select count(*) from public.notice_legal_scope) as scopes, (select count(*) from public.notice_legal_releases) as releases');
  if (rows[0].versions !== 30 || rows[0].scopes !== 60 || rows[0].releases !== 2) throw Error(JSON.stringify(rows));
  console.log('PASS: 30 digests, idempotent ingestion for two synthetic notices, 30 versions and 60 links');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
