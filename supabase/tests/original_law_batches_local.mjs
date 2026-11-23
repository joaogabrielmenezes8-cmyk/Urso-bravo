// Local evidence and disposable PostgreSQL only. Never accepts a remote DB URL.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const norm=s=>s.split(/\s+/).filter(Boolean).join(' ');
const bundles=['l9099','l9605'].map(n=>JSON.parse(read('evidence/'+n+'-originais-20261123.json')));
const count={L9099:81,L9605:65},all=[];
for(const b of bundles){
 assert.equal(b.versions.length,count[b.document_code]);assert.equal(b.notice_certification,false);
 for(const a of [b.original_archive,b.compilada_archive])assert.equal(hash(read('evidence/'+a.path)),a.sha256);
 const source=read('evidence/'+b.original_archive.path);
 const articles=new Map(source.trimEnd().split(/\n\n(?=Art\. \d)/).map(t=>{const m=t.match(/^Art\. (\d+(?:-[A-Z])?)\.\n([\s\S]*)$/);assert.ok(m);return [m[1],m[2]];}));
 const compiled=new Map(read('evidence/'+b.compilada_archive.path).trimEnd().split(/\n\n(?=Art\. \d)/).map(t=>{const m=t.match(/^Art\. (\d+(?:-[A-Z])?)\.\n([\s\S]*)$/);assert.ok(m);return [m[1],m[2]];}));
 const extracts=[];
 for(const [i,v]of b.versions.entries()){
  const s=b.scope_preparation[i];assert.equal(norm(v.body),norm(articles.get(s.article)));assert.equal(norm(v.body),norm(compiled.get(s.article))); 
  assert.equal(v.provision_id,s.provision_id);assert.equal(v.id,s.version_id);
  assert.equal(v.source_sha256,hash(`Art. ${s.article}.\n${v.body}\n`));
  assert.equal(s.original_matches_compilation,true);assert.equal(v.revoked,false);
  assert.ok(!/^\(VETADO\)$/.test(v.body));assert.ok(!/CAPÍTULO|Seção [IVX]|redação dada pela|Artigo acrescido pela/.test(v.body));
  extracts.push(`Art. ${s.article}.\n${v.body}\n`);all.push(v);
 }
 assert.equal(read('evidence/'+b.source_extract),extracts.join('\n'));
 const veto=b.not_prepared.filter(s=>s.status==='not_enacted_veto');assert.equal(veto.length,b.document_code==='L9099'?1:7);
 assert.equal(b.identified_slots,b.versions.length+b.not_prepared.length);
 assert.equal(new Set([...b.scope_preparation,...b.not_prepared].map(s=>s.provision_id)).size,b.identified_slots);
 assert.equal(b.versions[0].valid_from,b.document_code==='L9099'?'1995-11-26':'1998-03-30');
}
assert.equal(bundles[0].not_prepared.find(s=>s.provision_key==='art-00085').status,'pending_derogation_and_jurisprudence_review');
assert.equal(new Set(all.map(v=>v.provision_id)).size,146);
const db=new PGlite();
try{
 await db.exec(read('tests/notice_legal_snapshots_fixture.sql'));
 await db.exec(read('pending/20261117130000_notice_legal_snapshots.sql'));
 for(const v of all)await db.query('insert into public.legal_provisions values($1)',[v.provision_id]);
 const rev={id:'c0000000-0000-4000-8000-000000000002',notice_id:'10000000-0000-0000-0000-000000000002',revision:1,cutoff_on:'2026-09-03',cutoff_clause:'SYNTHETIC QA candidate only',source_url:'https://example.test/notice',source_sha256:'c'.repeat(64)};
 const scope=all.map(v=>({revision_id:rev.id,provision_id:v.provision_id,version_id:v.id,syllabus_locator:'QA explicit diploma scope; no certification'}));
 for(let i=0;i<2;i++)await db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(rev),JSON.stringify(all),JSON.stringify(scope)]);
 assert.equal((await db.query('select count(*)::int n from public.legal_provision_versions')).rows[0].n,146);
 for(const bundle of bundles){
  const target=bundle.versions[0];
  const early={...rev,id:'c0000000-0000-4000-8000-000000000001',notice_id:'10000000-0000-0000-0000-000000000001',cutoff_on:bundle.document_code==='L9099'?'1995-11-25':'1998-03-29'};
  await assert.rejects(db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(early),'[]',JSON.stringify([{revision_id:early.id,provision_id:target.provision_id,version_id:target.id,syllabus_locator:'QA vacatio'}])]));
 }
 await db.exec("set role authenticated;set test.premium='yes';set test.admin='no';");
 for(const v of all)assert.equal((await db.query('select status from public.resolve_notice_legal_provision($1,$2)',[rev.notice_id,v.provision_id])).rows[0].status,'available');
 console.log('PASS: 146 complete article bodies match original; 146 hashes;8 vetoes excluded; art85 pending; stable scope IDs; exact retry; 146 temporal resolutions; vacatio rejected before start');
}finally{await db.close()}
