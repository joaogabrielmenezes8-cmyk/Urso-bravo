// Disposable PostgreSQL only; real canonical IDs, synthetic notices, no production writes.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bundle=JSON.parse(read('evidence/l13869-artigos-1-45.json')),scope=bundle.scope_preparation,versions=bundle.versions;
assert.equal(scope.length,46);assert.equal(versions.length,40);
const parts=read('evidence/'+bundle.source_extract).split('\n\nArt. ');
assert.equal(parts.length,46);
parts.forEach((p,i)=>assert.equal(createHash('sha256').update((i?'Art. ':'')+p+(i<parts.length-1?'\n':'')).digest('hex'),scope[i].source_sha256));
const article=n=>versions.find(v=>v.provision_id===scope.find(s=>s.article===n).provision_id);
assert.equal(article('1').valid_from,'2020-01-03');assert.equal(article('3').valid_from,'2020-01-25');assert.equal(article('15-A').valid_from,'2022-04-01');
assert.equal(article('44').revoked,false);assert.match(article('13').body,/Pena - detenção/);
assert.doesNotMatch(article('15').body,/Violência Institucional/);assert.equal(article('15-A').heading,'Violência Institucional');
assert.deepEqual(scope.filter(s=>!s.version_id).map(s=>s.article),['11','14','17','26','34','35']);
assert.equal(scope.filter(s=>s.status==='prepared_effective_date_requires_review').length,10);
const db=new PGlite();
try{
 await db.exec(read('tests/notice_legal_snapshots_fixture.sql'));
 await db.exec(read('pending/20261117130000_notice_legal_snapshots.sql'));
 for(const s of scope)await db.query('insert into public.legal_provisions values($1)',[s.provision_id]);
 for(let i=1;i<=2;i++){
  const revision={id:`a3000000-0000-4000-8000-00000000000${i}`,notice_id:`10000000-0000-0000-0000-00000000000${i}`,revision:1,cutoff_on:i===1?'2024-05-09':'2026-09-03',cutoff_clause:'SYNTHETIC ONLY: not official cutoff certification',source_url:'https://example.test/synthetic',source_sha256:'3'.repeat(64)};
  const links=scope.map(s=>({revision_id:revision.id,provision_id:s.provision_id,version_id:s.version_id,syllabus_locator:'synthetic L13869'}));
  for(let retry=0;retry<2;retry++)await db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(revision),JSON.stringify(versions),JSON.stringify(links)]);
 }
 await db.exec("set role authenticated;set test.premium='yes';set test.admin='no'");
 for(const s of scope){const r=await db.query("select status from public.resolve_notice_legal_provision('10000000-0000-0000-0000-000000000001',$1)",[s.provision_id]);assert.equal(r.rows[0].status,s.version_id?'available':'pending_version');}
 await db.exec('reset role');
 const r=await db.query('select (select count(*) from public.legal_provision_versions)::int v,(select count(*) from public.notice_legal_scope)::int s');assert.deepEqual(r.rows[0],{v:40,s:92});
 const before={id:'a3000000-0000-4000-8000-000000000003',notice_id:'10000000-0000-0000-0000-000000000001',revision:2,cutoff_on:'2022-03-31',cutoff_clause:'SYNTHETIC VACATIO',source_url:'https://example.test/vacatio',source_sha256:'4'.repeat(64)};
 await assert.rejects(db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(before),'[]',JSON.stringify([{revision_id:before.id,provision_id:article('15-A').provision_id,version_id:article('15-A').id,syllabus_locator:'test'}])]));
 console.log('PASS: 46 hashes, 40 versions/92 links/retry, 6 vetoes distinct, art13 penalty/15A heading, effective-date review flags, early15A rejected');
}finally{await db.close();}
