// Disposable PostgreSQL only; includes no URL/credential input.
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const db=new PGlite();
try {
 await db.exec(read('tests/notice_legal_snapshots_fixture.sql'));
 await db.exec(`create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema auth to authenticated;
 insert into auth.users values ('70000000-0000-0000-0000-000000000001'),('70000000-0000-0000-0000-000000000002');
 create table public.student_study_annotations(id integer,body text);
 insert into public.student_study_annotations values(1,'legacy preserved');`);
 await db.exec(read('pending/20261117130000_notice_legal_snapshots.sql'));
 const migration=read('pending/20261122030000_legal_version_annotations.sql');
 await db.exec(migration);await db.exec(migration);
 await db.exec(`insert into public.notice_legal_revisions(id,notice_id,revision,cutoff_on,cutoff_clause,source_url,source_sha256) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,'2024-05-09','synthetic','https://example.test/notice',repeat('a',64)),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',1,'2026-09-03','synthetic','https://example.test/notice2',repeat('b',64));
 insert into public.legal_provision_versions(id,provision_id,valid_from,body,source_url,source_sha256,review_evidence) values
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2020-01-01','😀 eco eco','https://example.test/old',repeat('a',64),'synthetic'),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','2026-01-01','eco novo','https://example.test/new',repeat('b',64),'synthetic');
 insert into public.notice_legal_scope values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','A','40000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','A','40000000-0000-0000-0000-000000000002');
 insert into public.notice_legal_releases(revision_id) values ('30000000-0000-0000-0000-000000000001'),('30000000-0000-0000-0000-000000000002');
 set role authenticated;set test.uid='70000000-0000-0000-0000-000000000001';set test.premium='yes';set test.admin='no';`);
 const user='70000000-0000-0000-0000-000000000001', version='40000000-0000-0000-0000-000000000001';
 const r=await db.query('insert into public.student_legal_version_annotations(user_id,version_id,body,selected_text,highlight_color,start_offset,end_offset) values($1,$2,$3,$4,$5,6,9) returning id',[user,version,'comentário antigo','eco','yellow']);
 const id=r.rows[0].id;
 const expectError=async(sql,args,codes)=>{try{await db.query(sql,args);}catch(e){if(codes.includes(e.code))return;throw e;}throw Error('Unsafe operation accepted: '+sql);};
 await expectError('update public.student_legal_version_annotations set version_id=$1 where id=$2',['40000000-0000-0000-0000-000000000002',id],['55000']);
 await expectError('update public.student_legal_version_annotations set selected_text=$1 where id=$2',['alterado',id],['22023']);
 await expectError('insert into public.student_legal_version_annotations(user_id,version_id,body,start_offset,end_offset) values($1,$2,$3,0,1)',[user,version,'invalid offsets'],['23514']);
 await expectError('insert into public.student_legal_version_annotations(user_id,version_id,body) values($1,$2,$3)',['70000000-0000-0000-0000-000000000002',version,'intrusion'],['42501']);
 await db.exec("set test.uid='70000000-0000-0000-0000-000000000002';");
 if((await db.query('select * from public.student_legal_version_annotations')).rows.length)throw Error('Foreign notes leaked');
 await db.exec("set test.uid='70000000-0000-0000-0000-000000000001';set test.premium='no';");
 if((await db.query('select * from public.student_legal_version_annotations')).rows.length)throw Error('Unreadable version notes leaked');
 await expectError('insert into public.student_legal_version_annotations(user_id,version_id,body) values($1,$2,$3)',[user,version,'free write'],['42501']);
 await db.exec("set test.premium='yes';");
 const saved=(await db.query('select * from public.student_legal_version_annotations where id=$1',[id])).rows[0];
 if(saved.body!=='comentário antigo'||saved.start_offset!==6)throw Error('Historical anchor changed');
 await db.query('update public.student_legal_version_annotations set body=$1 where id=$2',['comentário editado',id]);
 await db.query('delete from public.student_legal_version_annotations where id=$1',[id]);
 await db.exec('reset role');
 if((await db.query('select body from public.student_study_annotations')).rows[0].body!=='legacy preserved')throw Error('Legacy annotations changed');
 console.log('PASS: historical CRUD, Unicode/repeated anchors, version immutability, owner/premium RLS, legacy preservation, migration replay');
}catch(e){console.error(e.message,e.code);process.exitCode=1;}finally{await db.close();}
