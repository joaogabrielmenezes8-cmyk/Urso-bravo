import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const b=JSON.parse(read('evidence/cf88-legislativo-original-20261123.json'));
assert.deepEqual(b.scope_preparation.map(s=>s.article),[44,45,46,47,54,56]);
assert.equal(read('evidence/cf88-legislativo-original-20261123.txt'),b.versions.map((v,i)=>`Art. ${b.scope_preparation[i].article}.\n${v.body}\n`).join('\n'));
for(const [i,v] of b.versions.entries())assert.equal(v.source_sha256,createHash('sha256').update(`Art. ${b.scope_preparation[i].article}.\n${v.body}\n`).digest('hex'));
const db=new PGlite();
try{
 await db.exec(read('tests/notice_legal_snapshots_fixture.sql'));
 await db.exec(read('pending/20261117130000_notice_legal_snapshots.sql'));
 for(const v of b.versions)await db.query('insert into public.legal_provisions values($1)',[v.provision_id]);
 const rev={id:'c0000000-0000-4000-8000-000000000002',notice_id:'10000000-0000-0000-0000-000000000002',revision:1,cutoff_on:'2026-09-03',cutoff_clause:'SYNTHETIC QA ONLY',source_url:'https://example.test/notice',source_sha256:'c'.repeat(64)};
 const scope=b.versions.map(v=>({revision_id:rev.id,provision_id:v.provision_id,version_id:v.id,syllabus_locator:'QA partial explicit CF88 scope'}));
 for(let i=0;i<2;i++)await db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(rev),JSON.stringify(b.versions),JSON.stringify(scope)]);
 assert.equal((await db.query('select count(*)::int n from public.legal_provision_versions')).rows[0].n,6);
 await db.exec("set role authenticated;set test.premium='yes';set test.admin='no';");
 for(const v of b.versions)assert.equal((await db.query('select status from public.resolve_notice_legal_provision($1,$2)',[rev.notice_id,v.provision_id])).rows[0].status,'available');
 console.log('PASS: 6 source hashes, 6 stable versions, idempotent ingestion and temporal resolution in disposable PostgreSQL; no official notice certification');
}finally{await db.close()}
