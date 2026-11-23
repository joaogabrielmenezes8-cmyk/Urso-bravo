// Disposable PostgreSQL only; real canonical IDs, synthetic notices, no production writes.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bundles=['lindb-artigos-1-19','lindb-2018-artigos-20-30'].map(name=>JSON.parse(read('evidence/'+name+'.json')));
const scope=bundles.flatMap(b=>b.scope_preparation), versions=bundles.flatMap(b=>b.versions);
assert.equal(scope.length,30); assert.equal(versions.length,29);
assert.equal(new Set(scope.map(s=>s.provision_id)).size,30);
for(const b of bundles){
 const parts=read('evidence/'+b.source_extract).split('\n\nArt. ');
 assert.equal(parts.length,b.scope_preparation.length);
 parts.forEach((p,i)=>assert.equal(createHash('sha256').update((i?'Art. ':'')+p+(i<parts.length-1?'\n':'')).digest('hex'),b.scope_preparation[i].source_sha256));
}
const byArticle=n=>versions.find(v=>v.provision_id===scope.find(s=>s.article===n).provision_id);
assert.match(byArticle(1).body,/§ 2º \(Revogado/);
assert.match(byArticle(15).body,/Parágrafo único\. \(Revogado/);
assert.equal(byArticle(18).valid_from,'2014-02-27');
assert.equal(byArticle(29).valid_from,'2018-10-23');
assert.equal(scope.find(s=>s.article===25).version_id,null);
assert.equal(scope.find(s=>s.article===25).status,'not_enacted_veto');
const db=new PGlite();
try{
 await db.exec(read('tests/notice_legal_snapshots_fixture.sql'));
 await db.exec(read('pending/20261117130000_notice_legal_snapshots.sql'));
 for(const s of scope)await db.query('insert into public.legal_provisions values($1)',[s.provision_id]);
 for(let i=1;i<=2;i++){
  const rev={id:`d0000000-0000-4000-8000-00000000000${i}`,notice_id:`10000000-0000-0000-0000-00000000000${i}`,revision:1,cutoff_on:i===1?'2024-05-09':'2026-09-03',cutoff_clause:'SYNTHETIC ONLY: not official cutoff certification',source_url:'https://example.test/synthetic',source_sha256:'d'.repeat(64)};
  const links=scope.map(s=>({revision_id:rev.id,provision_id:s.provision_id,version_id:s.version_id,syllabus_locator:i===1?'4.2':'8.12.4'}));
  for(let retry=0;retry<2;retry++)await db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(rev),JSON.stringify(versions),JSON.stringify(links)]);
 }
 let r=await db.query('select count(*)::int as n from public.legal_provision_versions'); assert.equal(r.rows[0].n,29);
 r=await db.query('select count(*)::int as n from public.notice_legal_scope'); assert.equal(r.rows[0].n,60);
 await db.exec("set role authenticated; set test.premium='yes'; set test.admin='no'");
 for(const s of scope){r=await db.query("select status from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000001',$1)",[s.provision_id]);assert.equal(r.rows[0].status,s.article===25?'pending_version':'available');}
 // Boundary assertion uses the real resolver: never attach an art.29 version during vacatio.
 await db.exec('reset role');
 const before={id:'d0000000-0000-4000-8000-000000000003',notice_id:'10000000-0000-0000-0000-000000000001',revision:2,cutoff_on:'2018-10-22',cutoff_clause:'SYNTHETIC VACATIO',source_url:'https://example.test/vacatio',source_sha256:'e'.repeat(64)};
 await assert.rejects(db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(before),'[]',JSON.stringify([{revision_id:before.id,provision_id:byArticle(29).provision_id,version_id:byArticle(29).id,syllabus_locator:'test'}]) ]));
 console.log('PASS: 30 hashes, 29 versions/60 links, exact retry, partial repeals, veto distinct, vacatio rejected');
}finally{await db.close();}
