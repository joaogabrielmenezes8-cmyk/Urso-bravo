// In-memory PostgreSQL verification. No production connection is accepted.
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import { readFileSync } from 'node:fs';
const db = new PGlite();
const read=p=>readFileSync(new URL('../../'+p, import.meta.url),'utf8');
try {
for(const p of ['notice_legal_snapshots_fixture','question_notice_legal_context_fixture','practice_notice_legal_context_fixture']) await db.exec(read('supabase/tests/'+p+'.sql'));
const migrations=['20261117130000_notice_legal_snapshots','20261117140000_question_notice_legal_context','20261119150000_list_reader_notices','20261120150000_practice_notice_legal_context'];
for(let pass=0;pass<2;pass++)for(const p of migrations)await db.exec(read('supabase/pending/'+p+'.sql'));
for(const p of ['notice_legal_snapshots','question_notice_legal_context','list_reader_notices'])await db.exec(read('supabase/tests/'+p+'.sql'));
await db.exec(read('supabase/tests/question_notice_legal_context.sql').split('do $$')[0].replace(/^begin;\s*/,''));
await db.exec(read('supabase/tests/practice_notice_legal_context_data.sql'));
await db.exec("set role authenticated; set test.uid='70000000-0000-0000-0000-000000000001'; set test.premium='no'; set test.admin='no';");
const call=async()=> (await db.query("select public.resolve_free_practice_notice_legal_context('b0000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002') as context")).rows[0].context;
if((await call()).status!=='pending_access')throw Error('free text exposure');
await db.exec("set test.premium='yes';");
if((await call()).status!=='available')throw Error('premium pinned context missing');
await db.exec("set test.uid='70000000-0000-0000-0000-000000000002';");
if((await call()).status!=='pending_attempt')throw Error('foreign session exposure');
await db.exec("set test.uid='';");
let rejected=false;try{await call();}catch(e){rejected=e.code==='42501';}if(!rejected)throw Error('unsigned caller accepted');
console.log('PASS: four migrations twice, three SQL suites, free/premium/foreign/unsigned security checks');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await db.close();}
