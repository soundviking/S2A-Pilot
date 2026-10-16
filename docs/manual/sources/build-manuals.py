"""Regenerate translated editions from the approved illustrated French master.
Usage: python3 build-manuals.py /path/to/edition-1.0-complete [en es de]
The screenshot masters are separate from the lightweight PWA distribution.
"""
from pathlib import Path
import json,sys,shutil
source=Path(sys.argv[1]).resolve();destination=Path(__file__).resolve().parent.parent
strings=json.loads((Path(__file__).parent/'french-strings.json').read_text())
rows={}
for line in (Path(__file__).parent/'translations.tsv').read_text().splitlines():
 index,*values=line.split('\t');assert len(values)==3;rows[int(index)]=values
invariant={5,6,113,117,237,238,425,427,429,431,433,450,451,452,453}
assert set(range(len(strings)))-rows.keys()==invariant
extras={
'MODE D’EMPLOI ILLUSTRÉ · ÉDITION 1.0':['ILLUSTRATED USER MANUAL · EDITION 1.0','MANUAL DE USO ILUSTRADO · EDICIÓN 1.0','ILLUSTRIERTES BENUTZERHANDBUCH · AUSGABE 1.0'],
'Vidéo muette':['Video muted','Vídeo silenciado','Video stumm'],
'Son autorisé':['Audio enabled','Audio activado','Ton erlaubt'],
'Haut-parleur barré':['Crossed-out speaker','Altavoz tachado','Durchgestrichener Lautsprecher'],
'Haut-parleur non barré':['Normal speaker','Altavoz normal','Normaler Lautsprecher'],
'Boutons issus des captures Safari du même média vidéo.':['Buttons captured in Safari from the same video.','Botones capturados en Safari del mismo vídeo.','In Safari aufgenommene Buttons desselben Videos.'],
'Import Pilot vers QLab 5 · Application Mac':['Pilot import into QLab 5 · Mac app','Importación de Pilot a QLab 5 · Aplicación Mac','Pilot-Import nach QLab 5 · Mac-App'],
'Dépannage Pilot et Bridge':['Pilot and Bridge troubleshooting','Problemas de Pilot y Bridge','Fehlerhilfe für Pilot und Bridge'],
'Lexique':['Glossary','Glosario','Glossar'],
}
toc={
'en':['Discover Pilot','First show','Create and organise Cues','Add music','Media settings','Timeline in Edit','Video and visuals','Save and reopen','Show mode','Maverick and Iceman','Cue sheet PDF','Video output','Before the performance','Discover Bridge','Import into QLab','Bridge monitor'],
'es':['Descubrir Pilot','Primer espectáculo','Crear y organizar Cues','Añadir música','Ajustar un medio','Línea de tiempo en Edit','Vídeo e imágenes','Guardar y reabrir','Modo Show','Maverick e Iceman','Hoja de Cues PDF','Salida de vídeo','Antes del espectáculo','Descubrir Bridge','Importar en QLab','Monitor de Bridge'],
'de':['Pilot kennenlernen','Erster Ablauf','Cues erstellen und ordnen','Musik hinzufügen','Medien einstellen','Timeline in Edit','Video und Bilder','Speichern und öffnen','Show-Modus','Maverick und Iceman','PDF-Ablaufplan','Videoausgabe','Vor der Vorstellung','Bridge kennenlernen','In QLab importieren','Bridge-Monitor']}
master=(source/'sources/generer-manuel.py').read_text()
for language in sys.argv[2:] or ['en','es','de']:
 column=['en','es','de'].index(language)
 mapping={strings[i]:values[column].replace('\\n','\n') for i,values in rows.items()}
 mapping.update({key:values[column] for key,values in extras.items()})
 mapping['Safari 27.0.1 sur Mac · interface française']={'en':'Safari 27.0.1 on Mac · English interface','es':'Safari 27.0.1 en Mac · interfaz española','de':'Safari 27.0.1 auf dem Mac · deutsche Oberfläche'}[language]
 code=master.replace("ROOT=Path(__file__).resolve().parents[1]",f'ROOT=Path({str(source)!r})')
 code=code.replace("PDF=ROOT/'output/pdf/S2A-Pilot-et-Bridge-Mode-emploi-illustre-edition-1.0-orange.pdf'",f'PDF=Path({str(destination / ("S2A-Pilot-et-Bridge-"+language+".pdf"))!r})')
 localized=source/'captures/localized'/language
 code=code.replace("CAP={r['id']:r for r in json.loads((ROOT/'sources/captures.json').read_text())['captures']}",f"CAP={{r['id']:r for r in json.loads(Path({str(localized/'sources/captures.json')!r}).read_text())['captures']}}")
 code=code.replace('def para(t,width,size=11,color=INK,bold=False):','''def translate(t):
 return MAPPING.get(t,MAPPING.get(t.replace('<br/>','\\n'),t)).replace('\\n','<br/>')
def para(t,width,size=11,color=INK,bold=False):
 t=translate(t)''')
 code=code.replace("def image_path(id):return ROOT/'captures/fiche-technique-page1.png' if id=='technical' else ROOT/'captures/brutes'/f'{id}.png'",f"def image_path(id):return Path({str(localized/'captures/fiche-technique-page1.png')!r}) if id=='technical' else Path({str(localized/'captures/brutes')!r})/f'{{id}}.png'")
 # Dynamic focus regions keep the real controls framed when labels change width.
 code=code.replace("x1,y1,x2,y2=b['region'];dw=b['width'];", "video=CAP['12-sortie']['points'][0];targetX=video['x'] if b.get('number')==2 else video['x']-50;b['target']=[targetX,0,40,40];b['region']=[video['x']-(54 if b.get('number')==2 else 114),0,video['x']+46,40];x1,y1,x2,y2=b['region'];dw=b['width'];")
 code=code.replace("label=match[1]+'  '+labels[match[1]];", "label=match[1]+'  '+TOC[int(match[1])-1];")
 code=code.replace("c.addOutlineEntry(pg['chapter'],", "c.addOutlineEntry(translate(pg['chapter']),")
 code=code.replace("(ROOT/'sources/pages.json').write_text",f"Path({str(destination/'sources'/('pages-'+language+'.json'))!r}).write_text")
 code=code.replace("(ROOT/'sources/validation.json').write_text",f"Path({str(destination/'sources'/('validation-'+language+'.json'))!r}).write_text")
 code=code.replace("(ROOT/'annotations'/f'{b[\"id\"]}.svg').write_text",f"(Path({str(localized)!r})/'annotations'/f'{{b[\"id\"]}}.svg').write_text")
 (localized/'annotations').mkdir(exist_ok=True)
 code=code.replace("c.setTitle('S2A Pilot et Bridge - Mode d’emploi illustré - Édition 1.0')", "c.setTitle("+repr({'en':'S2A Pilot and Bridge - Illustrated user manual - Edition 1.0','es':'S2A Pilot y Bridge - Manual de uso ilustrado - Edición 1.0','de':'S2A Pilot und Bridge - Illustriertes Benutzerhandbuch - Ausgabe 1.0'}[language])+")")
 exec(compile(code,str(source/'sources/generer-manuel.py'),'exec'),{'MAPPING':mapping,'TOC':toc[language]})
shutil.copyfile(source/'output/pdf/S2A-Pilot-et-Bridge-Mode-emploi-illustre-edition-1.0-orange.pdf',destination/'S2A-Pilot-et-Bridge-fr.pdf')
