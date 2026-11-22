// PostgreSQL in memory; catalogue IDs are real, notice revisions are synthetic.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bundle=JSON.parse(read('evidence/l9455-artigos-1-4.json')),versions=bundle.versions;
assert.equal(versions.length,5);assert.equal(new Set(versions.map(v=>v.provision_id)).size,4);
const parts=read('evidence/'+bundle.source_extract).split('\n\nArt. ');
assert.equal(parts.length,5);
parts.forEach((p,i)=>assert.equal(createHash('sha256').update((i?'Art. ':'')+p+(i<parts.length-1?'\n':'')).digest('hex'),versions[i].source_sha256));
const old=versions[0],current=versions[1];
assert.doesNotMatch(old.body,/reiteradamente/);assert.match(current.body,/III - submeter mulher, reiteradamente/);
assert.equal(old.valid_until,current.valid_from);assert.equal(current.valid_from,'2026-05-21');
assert.equal(versions[4].revoked,false);assert.match(versions[4].body,/Revoga-se o art. 233/);
const db=new PGlite();
try{
 await db.exec(read('tests/notice_legal_snapshots_fixture.sql'));
 await db.exec(read('pending/20261117130000_notice_legal_snapshots.sql'));
 for(const pid of new Set(versions.map(v=>v.provision_id)))await db.query('insert into public.legal_provisions values($1)',[pid]);
 for(let i=1;i<=2;i++){
  const rev={id:`a1000000-0000-4000-8000-00000000000${i}`,notice_id:`10000000-0000-0000-0000-00000000000${i}`,revision:1,cutoff_on:i===1?'2024-05-09':'2026-09-03',cutoff_clause:'SYNTHETIC ONLY, not official notice certification',source_url:'https://example.test/synthetic',source_sha256:'a'.repeat(64)};
  const scope=versions.filter(v=>v.provision_id!==old.provision_id).concat(i===1?old:current).map(v=>({revision_id:rev.id,provision_id:v.provision_id,version_id:v.id,syllabus_locator:'synthetic L9455'}));
  for(let retry=0;retry<2;retry++)await db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(rev),JSON.stringify(versions),JSON.stringify(scope)]);
 }
 await db.exec("set role authenticated;set test.premium='yes';set test.admin='no'");
 for(let i=1;i<=2;i++){
  const r=await db.query(`select * from public.resolve_notice_legal_provision('10000000-0000-0000-0000-00000000000${i}',$1)`,[old.provision_id]);assert.equal(r.rows[0].version_id,i===1?old.id:current.id);
 }
 await db.exec('reset role');
 const r=await db.query('select (select count(*) from public.legal_provision_versions)::int v,(select count(*) from public.notice_legal_scope)::int s');assert.deepEqual(r.rows[0],{v:5,s:8});
 console.log('PASS: 5 hashes/states, 4 articles, 8 links/retry; 2026 incisoIII excluded before21May, applicable afterward; revoking article not marked revoked');
}finally{await db.close();}
