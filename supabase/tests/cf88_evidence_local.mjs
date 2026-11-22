// PostgreSQL in memory; catalogue IDs are real, notice revisions are synthetic.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const names=['cf88-original-9-artigos','cf88-emendas-9-artigos','cf88-sem-clausula-2-artigos','cf88-artigo-37-versoes'];
const bundles=names.map(n=>JSON.parse(read('evidence/'+n+'.json'))),versions=bundles.flatMap(b=>b.versions);
assert.equal(versions.length,23);assert.equal(new Set(versions.map(v=>v.provision_id)).size,21);
for(const b of bundles){
 const parts=read('evidence/'+b.source_extract).split('\n\nArt. ');
 assert.equal(parts.length,b.versions.length);
 parts.forEach((p,i)=>assert.equal(createHash('sha256').update((i?'Art. ':'')+p+(i<parts.length-1?'\n':'')).digest('hex'),b.versions[i].source_sha256));
}
const historical=bundles[3],old=historical.versions[0],middle=historical.versions[1],current=historical.versions[2];
assert.match(old.body,/outro, técnico ou científico/);assert.doesNotMatch(old.body,/outro de qualquer natureza/);
assert.match(middle.body,/aprovada pelo Congresso Nacional/);assert.match(current.body,/outro de qualquer natureza/);
for(const v of historical.versions){assert.doesNotMatch(v.body,/Constituição da República Federativa do Brasil|§ 17\.|§ 18\./);}
assert.equal(old.valid_until,middle.valid_from);assert.equal(middle.valid_until,current.valid_from);
assert.equal(current.valid_until,'2027-01-01');
assert.equal(bundles[2].requires_effective_date_review,true);
const db=new PGlite();
try{
 await db.exec(read('tests/notice_legal_snapshots_fixture.sql'));
 await db.exec(read('pending/20261117130000_notice_legal_snapshots.sql'));
 for(const pid of new Set(versions.map(v=>v.provision_id)))await db.query('insert into public.legal_provisions values($1)',[pid]);
 for(let i=1;i<=2;i++){
  const rev={id:`e0000000-0000-4000-8000-00000000000${i}`,notice_id:`10000000-0000-0000-0000-00000000000${i}`,revision:1,cutoff_on:i===1?'2024-05-09':'2026-09-03',cutoff_clause:'SYNTHETIC ONLY; does not seal a real notice',source_url:'https://example.test/synthetic',source_sha256:'f'.repeat(64)};
  const selected=versions.filter(v=>v.provision_id!==old.provision_id).concat(i===1?old:current);
  const scope=selected.map(v=>({revision_id:rev.id,provision_id:v.provision_id,version_id:v.id,syllabus_locator:'4.1'}));
  for(let retry=0;retry<2;retry++)await db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(rev),JSON.stringify(versions),JSON.stringify(scope)]);
 }
 await db.exec("set role authenticated;set test.premium='yes';set test.admin='no'");
 for(let i=1;i<=2;i++){
  const r=await db.query(`select * from public.resolve_notice_legal_provision('10000000-0000-0000-0000-00000000000${i}',$1)`,[old.provision_id]);
  assert.equal(r.rows[0].status,'available');assert.equal(r.rows[0].version_id,i===1?old.id:current.id);
 }
 await db.exec('reset role');
 const r=await db.query('select (select count(*) from public.legal_provision_versions)::int v,(select count(*) from public.notice_legal_scope)::int s');
 assert.deepEqual(r.rows[0],{v:23,s:42});
 console.log('PASS: 23 hashes/states, 21 articles, 42 scope links, old/current art37 resolved distinctly, exact retry, 2027 deferred');
}finally{await db.close();}
