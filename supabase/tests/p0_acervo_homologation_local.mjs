// Final essential integration. Accepts no database URL and never writes remotely.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const json=p=>JSON.parse(read('evidence/'+p+'.json'));
const coverage=json('p0-device-coverage-20261122');
const names=['dudh-artigos-1-30','cadh-artigos-1-82','lindb-artigos-1-19','lindb-2018-artigos-20-30','cf88-original-9-artigos','cf88-emendas-9-artigos','cf88-sem-clausula-2-artigos','cf88-artigo-37-versoes','l9455-artigos-1-4','l13431-artigos-1-29','l13869-artigos-1-45'];
const versions=names.flatMap(n=>json(n).versions),byId=new Map(versions.map(v=>[v.id,v]));
assert.equal(versions.length,238);assert.equal(byId.size,238);
const catalog=read('evidence/p0-cfo-explicit-catalog.tsv').trim().split('\n').slice(1).map(l=>{const [document_code,provision_key,provision_id]=l.split('\t');return{document_code,provision_key,provision_id};});
assert.equal(catalog.length,2130);assert.equal(new Set(catalog.map(r=>r.provision_id)).size,2130);
const scopes=coverage.notices.map(n=>{
 assert.equal(n.certified_percent,0);assert.equal(n.cutoff_confirmed,false);
 const explicit=new Map(n.scope.map(s=>[s.provision_id,s]));
 const rows=n.notice_code==='CFO_2027'?catalog.map(r=>({...r,...explicit.get(r.provision_id),version_id:explicit.get(r.provision_id)?.version_id??null})):n.scope;
 assert.equal(rows.length,n.identified_catalog_article_slots);
 assert.equal(rows.filter(r=>r.version_id).length,n.prepared_versions);
 for(const r of rows)if(r.version_id){const v=byId.get(r.version_id);assert(v);assert.equal(v.provision_id,r.provision_id);assert(v.valid_from<=n.cutoff_candidate&&(!v.valid_until||n.cutoff_candidate<v.valid_until));}
 return rows;
});
const cfsdConstitution=scopes[0].filter(r=>r.document_code==='CF88').map(r=>r.provision_key);
assert.equal(cfsdConstitution.length,21);
for(const key of ['art-00039','art-00040','art-00041'])assert(!cfsdConstitution.includes(key));
const db=new PGlite();
try{
 for(const f of ['notice_legal_snapshots_fixture','question_notice_legal_context_fixture','practice_notice_legal_context_fixture'])await db.exec(read('tests/'+f+'.sql'));
 await db.exec(`create table auth.users(id uuid primary key);insert into auth.users values('70000000-0000-0000-0000-000000000001'),('70000000-0000-0000-0000-000000000002');create table public.student_study_annotations(id int,body text);insert into public.student_study_annotations values(1,'legacy preserved');`);
 const migrations=['20261117130000_notice_legal_snapshots','20261117140000_question_notice_legal_context','20261119150000_list_reader_notices','20261120150000_practice_notice_legal_context','20261122030000_legal_version_annotations'];
 for(let pass=0;pass<2;pass++)for(const m of migrations)await db.exec(read('pending/'+m+'.sql'));
 for(const s of ['notice_legal_snapshots','question_notice_legal_context','list_reader_notices'])await db.exec(read('tests/'+s+'.sql'));
 for(const row of catalog)await db.query('insert into public.legal_provisions(id,provision_key) values($1,$2)',[row.provision_id,row.provision_key]);
 const revisions=[];
 for(let i=0;i<2;i++){
  const rev={id:`f0000000-0000-4000-8000-00000000000${i+1}`,notice_id:`10000000-0000-0000-0000-00000000000${i+1}`,revision:1,cutoff_on:coverage.notices[i].cutoff_candidate,cutoff_clause:'SYNTHETIC QA ONLY; NOT AN OFFICIAL NOTICE CERTIFICATION',source_url:'https://example.test/qa-only',source_sha256:'1'.repeat(64)};revisions.push(rev);
  const scope=scopes[i].map(s=>({revision_id:rev.id,provision_id:s.provision_id,version_id:s.version_id,syllabus_locator:s.document_code}));
  for(let retry=0;retry<2;retry++)await db.query('select public.ingest_notice_legal_revision($1::jsonb,$2::jsonb,$3::jsonb)',[JSON.stringify(rev),JSON.stringify(versions),JSON.stringify(scope)]);
 }
 const history=json('cf88-artigo-37-versoes'),old=history.versions[0],current=history.versions[2];
 await db.query("update public.legal_provisions set document_id='a0000000-0000-0000-0000-000000000001' where id=$1",[old.provision_id]);
 await db.query("update public.question_legal_references set provision_id=$1,provision_label='Art.37'",[old.provision_id]);
 await db.exec("insert into public.mock_exam_attempts(id,user_id,contest_id,question_ids,submitted_at,created_at) values('90000000-0000-0000-0000-000000000004','70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',array['80000000-0000-0000-0000-000000000002']::uuid[],now(),now());set role authenticated;set test.uid='70000000-0000-0000-0000-000000000001';set test.premium='yes';set test.admin='no';");
 const question=async(q,attempt=null,rev=null)=>(await db.query('select public.resolve_question_notice_legal_context($1,$2,$3) c',[q,attempt,rev])).rows[0].c;
 const official=await question('80000000-0000-0000-0000-000000000001');assert.equal(official.references[0].version_id,old.id);
 const mock=await question('80000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000004');assert.equal(mock.references[0].version_id,current.id);
 const tutorContext=await question('80000000-0000-0000-0000-000000000002','90000000-0000-0000-0000-000000000004',revisions[1].id);assert.deepEqual(tutorContext,mock);
 assert.equal((await question('80000000-0000-0000-0000-000000000001',null,revisions[1].id)).status,'pending_notice');
 await db.query('insert into public.student_legal_version_annotations(user_id,version_id,body) values($1,$2,$3)',['70000000-0000-0000-0000-000000000001',old.id,'nota histórica real art37']);
 const notes=await db.query('select version_id from public.student_legal_version_annotations');assert.equal(notes.rows[0].version_id,old.id);
 const cadh31=json('cadh-artigos-1-82').scope_preparation.find(s=>s.article===31);
 assert.equal((await db.query('select status from public.resolve_notice_legal_provision($1,$2)',[revisions[0].notice_id,cadh31.provision_id])).rows[0].status,'pending_version');
 await db.exec("set test.uid='70000000-0000-0000-0000-000000000002';");assert.equal((await db.query('select * from public.student_legal_version_annotations')).rows.length,0);
 await db.exec("set test.premium='no';");assert.notEqual((await question('80000000-0000-0000-0000-000000000001')).status,'available');
 await db.exec('reset role');assert.equal((await db.query('select body from public.student_study_annotations')).rows[0].body,'legacy preserved');
 const counts=(await db.query('select (select count(*) from public.legal_provision_versions)::int v,(select count(*) from public.notice_legal_scope)::int s')).rows[0];assert.deepEqual(counts,{v:238,s:2293});
 console.log('PASS: five migrations twice; 3 SQL regressions; 238 text states; 2293 scope links; idempotence; real art37 reader/question/mock/tutor context; pending CADH31; version notes/RLS/legacy; corrected CFSD scope');
}finally{await db.close();}
