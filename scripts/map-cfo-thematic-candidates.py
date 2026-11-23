import re,json,hashlib,collections
from pathlib import Path
from lxml import html
import argparse
parser=argparse.ArgumentParser(description='Map editorial candidates only; no certification or database writes')
parser.add_argument('--source-dir',required=True);parser.add_argument('--evidence-dir',required=True);args=parser.parse_args()
source=Path(args.source_dir);p=Path(args.evidence_dir);raw=(source/'cfo2027-scope-mirror.pdf').read_bytes();pages=(source/'cfo2027-scope-mirror.txt').read_text().split('\f');items=[];active=False;done=False;selected=[]
for page_num,page in enumerate(pages,1):
 for line in page.splitlines():
  if re.match(r'^\s*4\.\s+DIREITO CONSTITUCIONAL',line):active=True
  if active and 'ANEXO “C”' in line:active=False;done=True
  if not active:continue
  if line.strip():selected.append(line)
  m=re.match(r'^\s*([4-9](?:\.\d+){0,3})\.?\s+(.+)',line)
  if m:
   items.append({'item':m[1],'text':m[2].strip(),'pdf_page':page_num})
  elif items and line.strip() and not re.match(r'^\s*(?:Edital DRH/CRS|nº 11/2026|CFO/2027|\d+)\s*$',line):items[-1]['text']+=' '+line.strip()
 assert not done or not active
assert done and len({i['item'] for i in items})==len(items)
extract='\n'.join(selected)+'\n';(p/'cfo2027-anexo-b-juridico-20261123.txt').write_text(extract)
# Ranges below are editorial correspondences, NOT express article limits in the notice.
ranges={
'5.2':[('CP',1,12)],'5.3':[('CP',1,12)],'5.4':[('CP',13,19)],'5.4.1':[('CP',13,13)],'5.4.2':[('CP',14,17)],'5.4.3':[('CP',18,19)],'5.5':[('CP',23,25)],'5.6':[('CP',21,22),('CP',26,28)],'5.7':[('CP',20,22)],'5.9':[('CP',29,31)],'5.10':[('CP',107,120)],'5.11':[('CP',32,95)],'5.12':[('CP',69,76)],'5.13':[('CP',91,95)],'5.14':[('CP',121,154)],'5.15':[('CP',155,183)],'5.16':[('CP',213,234)],'5.17':[('CP',250,285)],'5.18':[('CP',289,311)],'5.19':[('CP',312,359)],
'6.2':[('CPP',3,3)],'6.3':[('CPP',4,23)],'6.4':[('CPP',28,28)],'6.5':[('CPP',24,62)],'6.6':[('CPP',69,91)],'6.7':[('CPP',251,281)],'6.8':[('CPP',282,350)],'6.9':[('CPP',282,350)],'6.10':[('CPP',155,250)],'6.11':[('CPP',158,158)],'6.12':[('CPP',155,250)],'6.13':[('CPP',563,573)],'6.14':[('CPP',647,667)],
'8.1':[('CC',1,39)],'8.2':[('CC',40,69)],'8.3':[('CC',79,103)],'8.4':[('CC',104,211)],'8.4.1':[('CC',104,120)],'8.4.2':[('CC',138,165)],'8.4.3':[('CC',166,184)],'8.4.4':[('CC',186,188)],'8.4.5':[('CC',189,211)],'8.5':[('CC',1196,1224)],'8.6':[('CC',1228,1313)],'8.6.1':[('CC',1228,1237)],'8.6.2':[('CC',1238,1259)],'8.6.3':[('CC',1260,1274)],'8.6.4':[('CC',1275,1313)],'8.7':[('CC',186,188),('CC',927,954)],'8.8':[('CPC',1,15)],'8.9':[('CPC',16,16)],'8.10':[('CPC',17,20)],'8.11':[('CPC',21,41)],'8.12':[('CPC',70,112)],'8.12.1':[('CPC',70,76)],'8.12.2':[('CPC',77,78)],'8.12.3':[('CPC',79,81)]}
urls={'CP':'https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-2848-7-dezembro-1940-412868-normaatualizada-pe.html','CPP':'https://www2.camara.leg.br/legin/fed/declei/1940-1949/decreto-lei-3689-3-outubro-1941-322206-normaatualizada-pe.html','CC':'https://www2.camara.leg.br/legin/fed/lei/2002/lei-10406-10-janeiro-2002-432893-normaatualizada-pl.html','CPC':'https://www2.camara.leg.br/legin/fed/lei/2015/lei-13105-16-marco-2015-780273-normaatualizada-pl.html'}
rows=json.load(open(source/'cfo-thematic-catalog.json'));links=[];byid={};sources=[]
for code,url in urls.items():
 data=(source/(code.lower()+'-scope.html')).read_bytes();root=html.fromstring(data);blocks=[' '.join(e.text_content().split()) for e in root.xpath('//p|//h1|//h2|//h3|//h4')];heads=[]
 for j,t in enumerate(blocks):
  if t and len(t)<180 and not re.match(r'Art\.',t) and (t.isupper() or re.match(r'^(?:TÍTULO|CAPÍTULO|LIVRO|Seção|Subseção)',t)):
   nxt=next((v for v in blocks[j+1:] if re.match(r'Art\.\s*\d',v)),None)
   if nxt:heads.append(t+' => '+nxt.split('.')[0]+'. '+nxt.split('.')[1][:30] if '.' in nxt else t)
 filename=code.lower()+'-estrutura-oficial-20261123.txt';archive='\n'.join(heads)+'\n';(p/filename).write_text(archive);sources.append({'code':code,'url':url,'raw_sha256':hashlib.sha256(data).hexdigest(),'structure_extract':filename,'structure_sha256':hashlib.sha256(archive.encode()).hexdigest()})
for i in items:
 item=i['item'];locator=item
 while locator not in ranges and '.' in locator:locator=locator.rsplit('.',1)[0]
 if locator in ranges:
  i['correspondence_status']='editorial_candidate_requires_material_review';i['mapping_anchor']=locator;i['ranges']=[{'document_code':c,'from':a,'through':b}for c,a,b in ranges[locator]]
  for row in rows:
   m=re.fullmatch(r'art-(\d+)(?:-([a-z]+))?',row['provision_key'])
   if not m:continue
   num=int(m[1]);suffix=m[2]or''
   if any(row['document_code']==c and a<=num<=b for c,a,b in ranges[locator]):
    if item=='5.19' and num==359 and suffix>'h':continue
    if item=='6.2' and not suffix:continue
    if item=='6.4' and suffix!='a':continue
    if item=='6.11' and suffix not in list('abcdef'):continue
    links.append((item,row['document_code'],row['provision_key'],row['provision_id']));byid[row['provision_id']]=row
 else:i['correspondence_status']='express_diploma_already_cataloged_or_open_doctrinal_topic'
file='cfo2027-thematic-candidate-links-20261123.tsv';tsv='syllabus_item\tdocument_code\tprovision_key\tprovision_id\n'+'\n'.join('\t'.join(r)for r in links)+'\n';(p/file).write_text(tsv)
manifest={'notice_code':'CFO_2027','reviewed_on':'2026-11-23','notice_source_url':'https://dhg1h5j42swfq.cloudfront.net/2026/09/03102826/pm-mg-2027-cleaned.pdf','notice_source_kind':'third_party_mirror_of_notice_not_direct_official_capture','notice_pdf_sha256':hashlib.sha256(raw).hexdigest(),'official_source_attempt':{'url':'https://policiamilitar.mg.gov.br/conteudoportal/sites/concurso/030920260905177550.pdf','result':'HTTP 503 on 2026-11-23'},'annex_legal_topic_inventory_complete_for_captured_pdf':True,'identified_topic_count':len(items),'mapping_exhaustive':False,'cutoff_confirmed':False,'certified':False,'included_in_coverage_denominator':False,'denominator_retained':2130,'candidate_distinct_devices':len(byid),'candidate_links':len(links),'candidate_by_document':dict(collections.Counter(r['document_code']for r in byid.values())),'links_file':file,'links_sha256':hashlib.sha256(tsv.encode()).hexdigest(),'source_extract':'cfo2027-anexo-b-juridico-20261123.txt','source_extract_sha256':hashlib.sha256(extract.encode()).hexdigest(),'limitations':['Faixas editoriais relacionam temas com capítulos dos códigos; não são limites de artigos expressos pelo edital.','Doutrina, jurisprudência e normas correlatas permanecem abertos; não declarar todo programa mapeado.','Candidatos vinculados a IDs canônicos via SELECT somente leitura em 23/11/2026; existência no catálogo não comprova vigência histórica.','A inclusão de um candidato não prepara texto nem certifica dispositivo.','A união temática permanece fora do denominador até validação material e confirmação da fonte oficial do edital.'],'code_structure_sources':sources,'topics':items}
(p/'cfo2027-thematic-map-20261123.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(len(items),'legal topics inventoried;',len(byid),'candidate devices;',len(links),'candidate links; denominator unchanged',manifest['candidate_by_document'])
