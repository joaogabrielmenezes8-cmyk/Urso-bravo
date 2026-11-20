import asyncio, json, base64, subprocess, time, re, sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
D=open("/tmp/browser/e2e/dbdir.txt").read().strip().splitlines()[-1]; PORT="55443"
SHOTS=Path("/tmp/browser/e2e/shots"); SHOTS.mkdir(exist_ok=True)
STUDENT="70000000-0000-0000-0000-000000000001"
PROV="20000000-0000-0000-0000-000000000001"; DOC="a0000000-0000-0000-0000-000000000001"
OFFICIAL="80000000-0000-0000-0000-000000000001"; ORIGINAL="80000000-0000-0000-0000-000000000002"; NOREF="80000000-0000-0000-0000-000000000003"
FREE_SESSION="b0000000-0000-0000-0000-000000000001"
DB_RPCS={"list_reader_notices","resolve_notice_legal_provision","resolve_question_notice_legal_context","resolve_free_practice_notice_legal_context","resolve_historical_exam_notice_legal_context"}
log=[]
def psql(q, premium):
    pre=f"set role authenticated; set test.uid='{STUDENT}'; set test.premium='{premium}';"
    out=subprocess.run(["psql","-X","-q","-At","-h",D,"-p",PORT,"-U","postgres","-d","postgres","-v","ON_ERROR_STOP=1","-c",pre,"-c",q],capture_output=True,text=True)
    if out.returncode: return None, out.stderr.strip()
    return json.loads(out.stdout.strip().splitlines()[-1] or "null"), None
def lit(v): return "null" if v is None else "'"+str(v).replace("'","''")+"'"
def db_rpc(name,args,premium):
    named=", ".join(f"{k} => {lit(v)}" for k,v in args.items())
    setret,_=psql(f"select to_jsonb(proretset) from pg_proc where proname='{name}'",premium)
    q=(f"select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.{name}({named}) r" if setret else f"select to_jsonb(public.{name}({named}))")
    return psql(q,premium)
def jwt():
    b=lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
    return b({"alg":"HS256","typ":"JWT"})+"."+b({"sub":STUDENT,"role":"authenticated","exp":int(time.time())+86400,"email":"qa@example.com"})+".c3ludGhldGlj"
USER={"id":STUDENT,"aud":"authenticated","role":"authenticated","email":"qa-sintetico@example.com","app_metadata":{},"user_metadata":{"full_name":"QA Sintético"},"created_at":"2026-01-01T00:00:00Z"}
QROW=lambda qid,st,origin:{"id":qid,"contest_id":"50000000-0000-0000-0000-000000000001","discipline_id":"d1","topic_id":None,"exam_id":None,"number_on_exam":1,"statement":st,"origin":origin,"difficulty":"medium","official_answer_key":"A","current_answer_key":"A","explanation":"COMENTARIO_EDITORIAL_SINTETICO","legal_basis":"Art. 1","validated_at":"2026-01-01","status":"validated","created_at":"2026-01-01",
  "question_options":[{"id":qid[:-1]+"a","question_id":qid,"label":"A","content":"Alternativa A","is_currently_correct":True,"explanation":None,"sort_order":1},{"id":qid[:-1]+"b","question_id":qid,"label":"B","content":"Alternativa B","is_currently_correct":False,"explanation":None,"sort_order":2}],
  "disciplines":{"id":"d1","slug":"direito","name":"Direito"},"contests":{"id":"50000000-0000-0000-0000-000000000001","code":"PMMG_CFO","name":"CFO","organization":"PMMG"},"question_sources":[],"question_audiences":[],"topics":None,"exams":None,"contest":{"id":"50000000-0000-0000-0000-000000000001","code":"PMMG_CFO","name":"CFO","organization":"PMMG"},"discipline":{"id":"d1","slug":"direito","name":"Direito"}}
QUESTIONS=[QROW(OFFICIAL,"ENUNCIADO OFICIAL SINTÉTICO","official")]
TABLES={"legal_documents":[{"id":DOC,"code":"SINT","title":"Lei sintética de teste","official_url":"https://example.test","update_status":"ok"}],
 "legal_provisions":[{"id":PROV,"document_id":DOC,"provision_label":"Art. 1","provision_key":"art-00001","heading":None,"text_body":"Texto posterior","official_anchor_url":"https://example.test/new","verified_at":None,"hierarchy_path":[],"display_order":1,"completeness":"complete"}],
 "profiles":[{"id":STUDENT,"user_id":STUDENT,"role":"student","full_name":"QA Sintético","target_contest_id":"50000000-0000-0000-0000-000000000001"}],
 "questions":QUESTIONS,"legal_acceptances":[{"id":"aceite-sintetico"}],"question_options":QUESTIONS[0]["question_options"]}
FREE_STUBS={"free_practice_status":{"limit":10,"used":0,"remaining":10},
 "start_free_practice":{"session_id":FREE_SESSION,"used":2,"limit":10,"questions":[{"id":ORIGINAL,"statement":"ENUNCIADO INÉDITO SINTÉTICO","discipline_id":"d1","difficulty":None,"options":[{"label":"A","content":"Alternativa A"},{"label":"B","content":"Alternativa B"}]},{"id":NOREF,"statement":"ENUNCIADO SEM REFERÊNCIA","discipline_id":"d1","difficulty":None,"options":[{"label":"A","content":"Alternativa A"},{"label":"B","content":"Alternativa B"}]}]},
 "submit_free_practice":{"total":2,"correct":1,"percentage":50,"items":[{"question_id":ORIGINAL,"selected":"B","correct_answer":"B","correct":True,"explanation":"COMENTARIO_EDITORIAL_SINTETICO","legal_basis":"Art. 1"},{"question_id":NOREF,"selected":None,"correct_answer":"A","correct":False,"explanation":"OUTRO_COMENTARIO","legal_basis":""}]}}
async def scenario(pw, premium, name, steps):
    br=await pw.chromium.launch(headless=True); ctx=await br.new_context(viewport={"width":393,"height":852},is_mobile=True,has_touch=True)
    page=await ctx.new_page(); errors=[]; unexpected=[]
    page.on("console",lambda m: errors.append(m.text) if m.type=="error" else None)
    page.on("pageerror",lambda e: errors.append("pageerror: "+str(e)))
    async def handler(route):
        req=route.request; u=urlparse(req.url); path=u.path
        if path.startswith("/auth/v1/user"): return await route.fulfill(json=USER)
        if path.startswith("/auth/v1/"): return await route.fulfill(json={})
        if path.startswith("/rest/v1/rpc/"):
            fn=path.rsplit("/",1)[1]; args=json.loads(req.post_data or "{}")
            if fn in DB_RPCS:
                data,err=db_rpc(fn,args,premium); log.append((name,fn,args,err is None))
                return await route.fulfill(status=400 if err else 200,json=data if err is None else {"message":err})
            if fn=="my_premium_access": return await route.fulfill(json=premium=="yes")
            if fn in FREE_STUBS and premium=="no": return await route.fulfill(json=FREE_STUBS[fn])
            return await route.fulfill(json=None)
        if path.startswith("/rest/v1/"):
            t=path.split("/")[3]
            if req.method!="GET": return await route.fulfill(status=201,json=[])
            return await route.fulfill(json=TABLES.get(t,[]))
        if path.startswith("/functions/v1/"):
            unexpected.append(path); return await route.fulfill(status=503,json={"error":"stub"})
        unexpected.append(req.url); return await route.abort()
    await ctx.route(re.compile(r"https://[a-z0-9]+\.supabase\.co/.*"),handler)
    await ctx.route(re.compile(r"https://(?!localhost).*(ai\.gateway|openai|lovable\.dev/api).*"),lambda r: (unexpected.append(r.request.url), r.abort())[1])
    await page.goto("http://localhost:8080/",wait_until="domcontentloaded")
    session={"access_token":jwt(),"refresh_token":"synthetic","token_type":"bearer","expires_in":86400,"expires_at":int(time.time())+86400,"user":USER}
    await page.evaluate("([k,v])=>localStorage.setItem(k,v)",["sb-mnibsiqxviglqyrtunqs-auth-token",json.dumps(session)])
    res={}
    try: await steps(page,res)
    except Exception as e: res["exception"]=repr(e)[:300]; await page.screenshot(path=str(SHOTS/f"{name}_erro.png"))
    res["console_errors"]=errors[:8]; res["unexpected_network"]=unexpected
    await br.close(); return res
async def reader(page,res):
    await page.goto("http://localhost:8080/app/ementario",wait_until="networkidle")
    await page.locator("select:has(option:text('Lei sintética de teste'))").first.select_option("a0000000-0000-0000-0000-000000000001",timeout=15000)
    await page.wait_for_timeout(1500)
    res["atual_mostra_texto_atual"]=await page.get_by_text("Texto posterior").count()>0
    await page.screenshot(path=str(SHOTS/"1_leitor_atual.png"))
    sel=page.locator("select").filter(has=page.locator("option[value=compare]")).first
    await sel.select_option("notice"); await page.wait_for_timeout(1000)
    ed=page.get_by_role("combobox",name=re.compile("Edital"))
    res["lista_editais"]=await ed.locator("option").all_inner_texts()
    await ed.select_option("10000000-0000-0000-0000-000000000001"); await page.wait_for_timeout(1500)
    res["edital_2025_texto_antigo"]=await page.get_by_text("Texto anterior").count()>0
    res["edital_corte"]=await page.get_by_text("Data de corte do edital: 09/05/2024").count()>0
    await page.screenshot(path=str(SHOTS/"2_leitor_edital_2025.png"))
    await sel.select_option("compare"); await page.wait_for_timeout(1500)
    res["comparar_difere"]=await page.get_by_text("O texto atual difere da redação do edital.").count()>0
    await page.screenshot(path=str(SHOTS/"3_leitor_comparar.png"))
async def question(page,res):
    await page.goto("http://localhost:8080/app/resolver?question="+OFFICIAL,wait_until="networkidle"); await page.wait_for_timeout(2000)
    res["enunciado"]=await page.get_by_text("ENUNCIADO OFICIAL SINTÉTICO").count()>0
    await page.get_by_role("button",name=re.compile("Alternativa A")).first.click()
    await page.get_by_role("button",name="Responder").click()
    sec=page.get_by_role("region",name="Legislação do edital")
    await sec.wait_for(timeout=15000); await page.wait_for_timeout(1500)
    res["questao_oficial_corte_2024"]=await sec.get_by_text("Data de corte: 09/05/2024").count()>0
    await sec.locator("summary").first.click()
    res["questao_texto_da_edicao"]=await sec.get_by_text("Texto anterior").count()>0
    res["questao_oficial_sem_rotulo_editorial"]=await page.get_by_role("note",name="Gabarito editorial").count()==0
    res["comentario_editorial_rotulado"]=await page.get_by_role("region",name="Comentário editorial").count()==1
    res["questao_sem_texto_atual"]=await sec.get_by_text("Texto posterior").count()==0
    await sec.scroll_into_view_if_needed(); await page.screenshot(path=str(SHOTS/"4_questao_oficial.png"))
async def treino(page,res):
    await page.goto("http://localhost:8080/app/simulados",wait_until="networkidle")
    await page.get_by_role("button",name=re.compile("Iniciar treino grátis")).click(timeout=15000)
    await page.get_by_text("ENUNCIADO INÉDITO SINTÉTICO").wait_for()
    res["antes_correcao_sem_gabarito"]=await page.get_by_text("COMENTARIO_EDITORIAL_SINTETICO").count()==0
    await page.get_by_role("button",name=re.compile(r"^B\.")).click()
    await page.get_by_role("button",name="Próxima").click()
    await page.get_by_role("button",name=re.compile("Finalizar e corrigir")).click()
    await page.get_by_text("Correção comentada").wait_for(); await page.wait_for_timeout(2000)
    body=await page.locator("body").inner_text()
    res["gabarito_preservado"]="Sua resposta: B · Correta: B" in body
    res["comentario_rotulado"]=await page.get_by_role("region",name="Comentário editorial").count()==2
    res["sem_texto_legal_gratis"]=("Texto posterior" not in body) and ("Texto anterior" not in body) and ("Data de corte" not in body)
    res["aviso_pendente"]="pendente de certificação ou indisponível" in body
    res["gabarito_editorial_rotulado"]=await page.get_by_role("note",name="Gabarito editorial").count()==2
    await page.get_by_text("Correção comentada").scroll_into_view_if_needed(); await page.screenshot(path=str(SHOTS/"5_treino_gratis_correcao.png"))
async def main():
    async with async_playwright() as pw:
        out={"leitor_premium":await scenario(pw,"yes","leitor",reader),"questao_premium":await scenario(pw,"yes","questao",question),"treino_gratis":await scenario(pw,"no","treino",treino)}
    out["rpc_calls"]=[f"{n}:{f}:{'ok' if ok else 'erro'}" for n,f,a,ok in log]
    print(json.dumps(out,ensure_ascii=False,indent=1))
asyncio.run(main())
