// PostgreSQL in memory; catalogue IDs are real, notice revisions are synthetic.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bundle=JSON.parse(read('evidence/l13431-artigos-1-29.json')),versions=bundle.versions;
assert.equal(versions.length,30);assert.equal(new Set(versions.map(v=>v.provision_id)).size,29);
const parts=read('evidence/'+bundle.source_extract).split('\n\nArt. ');
assert.equal(parts.length,30);
parts.forEach((p,i)=>assert.equal(createHash('sha256').update((i?'Art. ':'')+p+(i<parts.length-1?'\n':'')).digest('hex'),versions[i].source_sha256));
const old=versions.find(v=>v.valid_until),current=versions.find(v=>v.provision_id===old.provision_id&&!v.valid_until);
assert.doesNotMatch(old.body,/V - violência patrimonial/);assert.match(current.body,/V - violência patrimonial/);
assert(current.body.indexOf('V - violência patrimonial')<current.body.indexOf('§ 1º'));
assert.equal(current.valid_from,'2022-07-09');assert.equal(old.valid_from,'2018-04-05');
assert.equal(old.valid_until,current.valid_from);
assert.equal(versions.filter(v=>v.body.includes('TÍTULO')||v.body.includes('CAPÍTULO')).length,0);
const revoker=versions.find(v=>v.provision_id===bundle.scope_preparation.find(s=>s.article===28).provision_id);
assert.equal(revoker.revoked,false);assert.match(revoker.body,/Revoga-se o art. 248/);
assert.equal(bundle.document_structure.length,11);
const db=new PGlite();
try{
 await db.exec(read('tests/notice_legal_snapshots_fixture.sql'));
 await db.exec(read('pending/20261117130000_notice_legal_snapshots.sql'));
 for(const pid of new Set(versions.map(v=>v.provision_id)))await db.query('insert into public.legal_provisions values($1)',[pid]);
 for(let i=1;i<=2;i++){
  const rev={id:`a2000000-0000-4000-8000-00000000000${i}`,notice_id:`10000000-0000-0000-0000-00000000000${i}`,revision:1,cutoff_on:i===1?'2022-07-08':'2026-09-03',cutoff_clause:'SYNTHETIC ONLY, not official notice certification',source_url:'https://example.test/synthetic',source_sha256:'a'.repeat(64)};
  const scope=versions.filter(v=>v.provision_id!==old.provision_id).concat(i===1?old:current).map(v=>({revision_id:rev.id,provision_id:v.provision_id,version_id:v.id,syllabus_locator:'synthetic L13431'}));
  for(let retry=0;retry<2;retry++)await db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(rev),JSON.stringify(versions),JSON.stringify(scope)]);
 }
 await db.exec("set role authenticated;set test.premium='yes';set test.admin='no'");
 for(let i=1;i<=2;i++){
  const r=await db.query(`select * from public.resolve_notice_legal_provision('10000000-0000-0000-0000-00000000000${i}',$1)`,[old.provision_id]);assert.equal(r.rows[0].version_id,i===1?old.id:current.id);
 }
 await db.exec('reset role');
 const r=await db.query('select (select count(*) from public.legal_provision_versions)::int v,(select count(*) from public.notice_legal_scope)::int s');assert.deepEqual(r.rows[0],{v:30,s:58});
 console.log('PASS: 30 hashes/states, 29 articles, 58 links/retry; 45day vacatio and caput hierarchy; revoking art28 preserved; no phantom ECA208');
}finally{await db.close();}
