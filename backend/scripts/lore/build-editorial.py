"""Rebuild the bundled DRAFT from the editorial sources; never overwrite a release."""
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'backend/content/eldoria-tres-sinos/1.0.0'
DOC = ROOT / 'docs/lore/01-pacto-dos-tres-sinos.md'
ATLAS = ROOT / 'docs/lore/atlas.json'
if (OUT / 'manifest.json').exists():
    if json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))['status'] != 'DRAFT':
        raise RuntimeError('Published versions are immutable')
OUT.mkdir(parents=True, exist_ok=True)
md = DOC.read_text(encoding='utf-8')
atlas = json.loads(ATLAS.read_text(encoding='utf-8'))

def rows(section):
    block = md.split(section, 1)[1].split('\n## ', 1)[0]
    return [[cell.strip() for cell in line.strip('|').split('|')] for line in block.splitlines() if line.startswith('| ') and not line.startswith('| ---')][1:]

def write(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

quotes = re.findall(r'^> (.+)$', md, re.M)
public = {
    'title': 'Eldoria — O Pacto dos Três Sinos', 'premise': quotes[0],
    'tone': 'Fantasia de fronteira, investigação, negociação e consequências persistentes.',
    'hooks': ['Trabalhar numa caravana', 'Procurar trabalho no porto', 'Visitar alguém da região', 'Pesquisar a abadia', 'Acompanhar outro personagem'],
    'playerHistoryPolicy': 'Cada jogador escolhe seu vínculo. Nenhum passado é atribuído automaticamente.',
    'start': {'year': 87, 'month': 1, 'monthName': 'Bruma', 'day': 1, 'hour': 8, 'minute': 0},
    'party': {'minPlayers': 3, 'maxPlayers': 4, 'startLevel': 1, 'endLevel': 3},
    'opening': quotes[-1],
}
write('public.json', public)

places = [{'id': p['id'], 'name': p['name'], 'parentId': None if p['mapId'] == 'vale' else p['mapId'], 'description': p['name']} for p in atlas['places']]
place_descriptions = {r[0]: r[2] for r in rows('## 4. Atlas')}
for p in places:
    p['description'] = place_descriptions.get(p['id'], p['description'])
places += [{'id': r['id'], 'name': r['name'], 'parentId': 'abadia', 'description': r['name']} for r in atlas['rooms']]
factions = [dict(zip(['id', 'name', 'objective', 'limits'], r)) for r in rows('## 5. Facções')]
locations = ['taverna', 'guarda', 'capela', 'cais', 'mercado', 'mina', 'brejo', 'mina']
faction_ids = [None, 'pacto', 'pacto', None, 'liga', 'ferrugem', 'margem', None]
npcs = []
for i, r in enumerate(rows('## 6. NPCs')):
    binding = atlas['npcBindings'][i]
    npcs.append({'id': r[0], 'name': r[1].split(' · ')[0], 'placeId': locations[i], 'factionId': faction_ids[i], 'objective': r[2].split('; ', 1)[1], 'voice': r[3], 'knowledgeBoundary': r[4], 'catalog': {'source': binding['source'], 'srdIndex': binding['srdIndex']}})
objects = [
    {'id': 'sino-vau', 'name': 'Sino Vau', 'placeId': 'vau', 'state': 'Intacto; regulagem pendente.'},
    {'id': 'sino-vigia', 'name': 'Sino Vigia', 'placeId': 'ponte', 'state': 'Sem badajo; regulagem pendente.'},
    {'id': 'sino-guarda', 'name': 'Sino Guarda', 'placeId': 'A4', 'state': 'Intacto; regulagem pendente.'},
    {'id': 'badajo', 'name': 'Badajo do Vigia', 'placeId': 'mina', 'state': 'Dentro do caixote de três listras.'},
    {'id': 'caixote', 'name': 'Caixote de três listras', 'placeId': 'mina', 'state': 'Contém o badajo; ainda não está em trânsito.'},
    {'id': 'galeria', 'name': 'Galeria Funda', 'placeId': 'abadia', 'state': 'Instável, acesso lacrado; entrada dispensável para o reparo.'},
]
relations = [{'from': a, 'to': b, 'kind': k} for a, b, k in [('nara','teo','TRUSTS'),('teo','bento','FRIEND'),('iria','dalia','RESPECTS'),('oren','mara','OWES_PAYMENT'),('sava','iria','DISTRUSTS')]]
write('entities.json', {'places': places, 'factions': factions, 'npcs': npcs, 'objects': objects, 'relations': relations})

fact_rows = re.findall(r'^\| (C\d+) \| (.+?) \| (.+?) \|$', md, re.M)
subjects = [['porto'],['sino-vau','sino-vigia','sino-guarda'],['galeria'],['sino-vigia'],['mara','oren','badajo'],['oren'],['badajo','caixote','mina'],['bento','mina'],['sava','margem'],['abadia'],[],[],['cais'],['sino-vigia','sino-vau','sino-guarda']]
facts = [{'id': r[0], 'text': r[1], 'mutability': 'INITIAL_STATE' if r[0] in ['C02','C04','C06','C07','C08'] else 'FIXED', 'audience': 'PUBLIC' if r[0] in ['C01','C02','C11','C12'] else 'MASTER', 'subjects': subjects[i]} for i, r in enumerate(fact_rows)]
observations = [
    ('F01', 'Nara viu uma carroça da Liga sair à noite.', ['nara','liga']),
    ('F02', 'O Vigia está mudo e Bento está desaparecido.', ['sino-vigia','bento']),
    ('F03', 'Téo reconhece marcas das rodas da Companhia Ferrugem na ponte.', ['teo','ferrugem','ponte']),
    ('F04', 'Sava viu tecido da Liga perto da ponte.', ['sava','liga','ponte']),
    ('F05', 'Bento viu Mara mover o caixote de três listras para a mina.', ['bento','mara','caixote','mina']),
    ('F06', 'Oren está pagando bem por metal.', ['oren']),
    ('F07', 'Há mortos andando na abadia; o relato não identifica quantidade ou comportamento.', ['abadia']),
    ('F08', 'Bento está vivo e preso no abrigo de ferramentas da mina.', ['bento','mina']),
    ('F09', 'A Companhia Ferrugem retirou a peça do Vigia.', ['ferrugem','badajo']),
]
facts += [{'id': k, 'text': t, 'mutability': 'INITIAL_STATE' if k in ['F02','F06','F07','F08'] else 'FIXED', 'audience': 'MASTER', 'subjects': s} for k,t,s in observations]
claims = [
    {'id':'R01','text':'Sava roubou o sino.','truth':'FALSE','factIds':['C09']},
    {'id':'R02','text':'Há mortos andando na abadia.','truth':'TRUE_IMPRECISE','factIds':['F07']},
    {'id':'R03','text':'Oren está pagando bem por metal.','truth':'TRUE','factIds':['F06']},
    {'id':'R04','text':'O metal já saiu do vale.','truth':'FALSE','factIds':['C07']},
    {'id':'R05','text':'Uma peça foi removida do mecanismo do Vigia.','truth':'TRUE','factIds':['C04']},
]
knowledge = []
for npc, keys in {'nara':['F01'],'iria':['F02'],'dalia':['C03','C14'],'teo':['F03'],'oren':['C05','C06'],'mara':['C05','C07'],'sava':['C09','F04'],'bento':['F05','F08']}.items():
    knowledge += [{'npcId':npc,'targetId':key,'stance':'KNOWS','source':'Conhecimento inicial definido na lore editorial.'} for key in keys]
knowledge += [{'npcId':n,'targetId':r,'stance':s,'source':'Crença inicial; não equivale a descoberta.'} for n,r,s in [('iria','R01','BELIEVES'),('oren','R04','BELIEVES'),('dalia','R05','SUSPECTS')]]
write('facts.json', {'facts': facts, 'claims': claims, 'knowledge': knowledge, 'improvisation': {'allowed': ['Cheiros, roupas e detalhes decorativos compatíveis.', 'Falas compatíveis com objetivo e conhecimento do ator.'], 'requiresValidatedEvent': ['Parentes, salas, tesouros, poderes, mortes, promessas e soluções mecânicas.', 'Correção administrativa de fato fixo, preservando o histórico.']}})
history = []
for i, row in enumerate(rows('## 3. Linha do tempo')):
    history.append({'id':f'H{i+1:02}', 'timeLabel':row[0], 'relativeMinutes': [None,None,-43200,-2880,-1440,0][i], 'precision':'APPROXIMATE_YEARS' if i<2 else 'DAY' if i<5 else 'MINUTE', 'text':row[1], 'audience':'PUBLIC' if i in [0,1,5] else 'MASTER', 'knowledgeNote':row[2]})
write('history.json', history)

threads = [dict(zip(['id','objective','completion','consequence'], r)) for r in rows('### Fios e condições')]
# rows() includes subsequent pressure-table rows; keep only thread identifiers.
threads = [r for r in threads if r['id'].startswith('fio-')]
clues = [
    {'id':'pista-retirada','conclusion':'A Companhia retirou a peça.','factIds':['F09'], 'alternatives':[{'holderId':'teo','text':'Marcas de rodas reconhecidas na ponte.'},{'holderId':'bento','text':'Testemunho sobre a carga.'},{'holderId':'mara','text':'Identificação das ferramentas usadas.'}]},
    {'id':'pista-financiamento','conclusion':'A Liga financiou o trabalho.','factIds':['C05','C06'], 'alternatives':[{'holderId':'mercado','text':'Ordem de serviço obtida por investigação.'},{'holderId':'mara','text':'Registro de pagamento obtido por negociação.'},{'holderId':'oren','text':'Admissão ao ser confrontado com evidência.'}]},
    {'id':'pista-mecanismo','conclusion':'Os sinos estabilizam a galeria.','factIds':['C03','C14'], 'alternatives':[{'holderId':'dalia','text':'Fragmento e explicação.'},{'holderId':'A2','text':'Instruções de manutenção.'},{'holderId':'A5','text':'Encaixes e marcas de afinação.'}]},
    {'id':'pista-inocencia','conclusion':'Sava é inocente.','factIds':['C09'], 'alternatives':[{'holderId':'brejo','text':'Pescadores testemunham o horário.'},{'holderId':'ponte','text':'Ferramentas incompatíveis com a acusação.'},{'holderId':'teo','text':'Evidência do trajeto da Companhia.'}]},
]
pressures = [
    {'id':'preparo','afterMinutes':720,'afterEventId':None,'condition':'Caixote na mina e Mara pode agir.','effect':'Equipe prepara transporte.','subjects':['caixote','mara','mina']},
    {'id':'partida','afterMinutes':1440,'afterEventId':None,'condition':'Transporte preparado, caixote na mina, Mara capaz e trajeto não interrompido.','effect':'Partida pela rota Mina–Abadia; caixote em trânsito.','subjects':['caixote','mara','mina','abadia']},
    {'id':'chegada','afterMinutes':90,'afterEventId':'partida','condition':'Viagem efetivamente iniciada e não interrompida; ajustar atraso por evento.','effect':'Chegada ao pátio A1; Mara suspende coleta se perceber risco. Sem combate automático.','subjects':['caixote','mara','A1']},
    {'id':'interdicao','afterMinutes':2160,'afterEventId':None,'condition':'Vigia continua inativo.','effect':'Ponte interditada; rotas alternativas permanecem.','subjects':['ponte','sino-vigia']},
    {'id':'agua-turva','afterMinutes':2880,'afterEventId':None,'condition':'Galeria não estabilizada.','effect':'Água turva no cais; Conselho oferece ajuda. Sem morte automática.','subjects':['galeria','cais','pacto']},
]
repairs = [{'id':'repor-badajo','placeId':'ponte','objectId':'sino-vigia','minutes':30,'conditions':['Badajo correto recuperado ou substituto fabricado em tarefa aprovada.','Ferramentas comuns e acesso.'],'effect':'Vigia tem badajo funcional.'}]
for obj,loc in [('sino-vau','vau'),('sino-vigia','ponte'),('sino-guarda','A4')]:
    repairs.append({'id':'regular-'+obj,'placeId':loc,'objectId':obj,'minutes':20,'conditions':['Instruções, ferramentas comuns e acesso.'],'effect':'Mecanismo regulado por evento confirmado.'})
write('threads.json', {'threads':threads,'clues':clues,'pressures':pressures,'repairs':repairs,
    'rewards':[{'threadId':'fio-sino','kind':'LODGING','quantity':7,'unit':'DAYS','beneficiary':'GROUP','enabled':True},{'threadId':'fio-sino','kind':'MONEY','quantity':None,'unit':'UNDEFINED','beneficiary':'GROUP','enabled':False}],
    'resolutions':['Restituição negociada com Oren e Mara.','Denúncia pública e reparo pelo Conselho.','Cooperação com a Margem e negociação política.'],
    'guidance': ['Alternativas consistentes são permitidas; não exigir combate para pistas ou conclusão.', 'Falhas podem custar tempo ou exigir outra abordagem; não mudar o culpado.', 'Inspeção básica da balsa revela corda puída e saco comum da Liga; isso não prova crime ou presença de Bento.', 'Três mecanismos regulados e Vigia funcional estabilizam a galeria. Entrada na galeria não é obrigatória.', 'Oficina pode emprestar ferramentas mediante acordo registrado. Reparos com condições cumpridas não exigem teste aleatório.', 'Bento exige avaliação explícita quando o tempo avança; nunca morrer automaticamente por silêncio no chat.', 'Relógio avança por ações e aprovação; tempo de parede não movimenta o mundo.', 'Abadia é o ponto combinado com o transportador da Liga. Mara ignora os vigias; Oren não recebeu confirmação da coleta.']})
for m in atlas['maps']:
    m['asset'] = m['asset'].replace('mapas/','assets/')
    m['texture'] = m['texture'].replace('mapas/','assets/')
for key in ['packId','version','status','npcBindings','creatureBindings','creatureSource','notes']:
    atlas.pop(key)
atlas['localTravel'] = [{'from':'porto','to':p,'minutes':minutes,'bidirectional':True} for p,minutes in [('taverna',5),('capela',5),('vau',10),('cais',10)]]
# Authored grid geometry: rooms + six corridors, independently of SVG strokes.
floor = set()
for r in atlas['rooms']:
    floor.update((x,y) for x in range(r['x'],r['x']+r['width']) for y in range(r['y'],r['y']+r['height']))
for x,y,w,h in [(5,9,1,2),(9,5,2,1),(17,5,2,1),(13,9,1,2),(10,13,2,1),(5,16,1,2)]:
    floor.update((a,b) for a in range(x,x+w) for b in range(y,y+h))
walls = []
for x,y in sorted(floor):
    for dx,dy,edge in [(-1,0,(x,y,x,y+1)),(1,0,(x+1,y,x+1,y+1)),(0,-1,(x,y,x+1,y)),(0,1,(x,y+1,x+1,y+1))]:
        if (x+dx,y+dy) not in floor:
            walls.append(dict(zip(['x1','y1','x2','y2'],edge)))
for edge in [(5,9,6,9),(5,11,6,11),(9,5,9,6),(11,5,11,6),(17,5,17,6),(19,5,19,6),(13,9,14,9),(13,11,14,11),(10,13,10,14),(12,13,12,14),(5,16,6,16)]:
    walls.append({**dict(zip(['x1','y1','x2','y2'],edge)), 'door':'open' if edge == (5,16,6,16) else 'closed'})
atlas['geometry'] = [{'mapId':'abadia','walls':walls,'entry':{'x':5,'y':17}}]
write('atlas.json', atlas)
encounters=[]
for index,loc,use in [('wolf','mata','Evitar, alimentar ou afastar; confronto opcional.'),('bandit','mina','Trabalhadores e guardas; não presumir hostilidade.'),('giant-rat','mina','Fauna local.'),('skeleton','abadia','Vigias antigos; calibrar quantidade.'),('zombie','abadia','Vigias antigos; calibrar quantidade.'),('giant-spider','brejo','Anunciar teias e restos antes do confronto.'),('specter',None,'Reservado para arco posterior.'),('dire-wolf',None,'Reservado para arco posterior.')]:
    encounters.append({'id':index,'placeId':loc,'catalog':{'source':'dnd5eapi-2014','srdIndex':index},'availability':'LATER_ARC' if loc is None else 'OPTIONAL','resolution':'MANUAL','usage':use})
write('encounters.json',encounters)
(OUT / 'assets').mkdir(exist_ok=True)
for m in atlas['maps']:
    for key in ['asset','texture']:
        shutil.copyfile(ROOT / 'docs/lore/mapas' / Path(m[key]).name, OUT / m[key])

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

files = [{'path':p.relative_to(OUT).as_posix(),'sha256':sha(p),'audience':'PUBLIC' if p.name=='public.json' else 'MASTER'} for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='manifest.json']
manifest = {'formatVersion':1,'packId':'eldoria-tres-sinos','version':'1.0.0','status':'DRAFT','files':files,'sources':[
    {'title':'Lore original — O Pacto dos Três Sinos','reference':'docs/lore/01-pacto-dos-tres-sinos.md','sha256':sha(DOC)},
    {'title':'Atlas e mapas esquemáticos originais','reference':'docs/lore/atlas.json','sha256':sha(ATLAS)},
    {'title':'Catálogo existente dnd5eapi-2014; conferir atribuição do SRD 5.1 antes de publicação','reference':'https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf','sha256':None}],
    'rules':{'profile':'SRD_2014','combat':'MANUAL','moneyEnabled':False,'publicationBlockers':['Calibrar encontros com 3–4 personagens de níveis 1–3.','Definir recompensa monetária e sua transferência transacional antes de habilitar dinheiro.','Revisar atribuição das fichas e procedência antes de publicar.']}}
write('manifest.json',manifest)
registry = [{'packId':manifest['packId'],'version':manifest['version'],'manifestSha256':sha(OUT / 'manifest.json')}]
(ROOT / 'backend/src/lore/bundled-packs.ts').write_text('// Generated by scripts/lore/build-editorial.py. Trusted manifest digests.\nexport const BUNDLED_PACKS = ' + json.dumps(registry, indent=2) + ';\n', encoding='utf-8')
print(f'DRAFT rebuilt: {len(files)} files, {len(npcs)} NPCs, {len(facts)} facts; validate before use.')
