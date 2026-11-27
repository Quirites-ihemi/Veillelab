"""Construit les données du site (public/data/*.json) à partir du classeur Quiritès.

usage : python3 build_data.py <classeur.xlsx> <dossier_sortie> <dossier_images> [limite_publications]
"""
import json, os, re, sys, collections
import pandas as pd

src, out, imgdir = sys.argv[1], sys.argv[2], sys.argv[3]
only = set(sys.argv[4].split(',')) if len(sys.argv) > 4 else None
os.makedirs(out, exist_ok=True)
S = pd.read_excel(src, sheet_name=None, dtype=str)


def sheet(name):
    return S[name].dropna(how='all').fillna('')


def s(v):
    v = '' if v is None else str(v)
    return v.strip() if v.strip() != 'nan' else ''


def rows(df, cols):
    return [{c: s(r[c]) for c in cols} for _, r in df.iterrows()]


P = sheet('PUBLICATIONS')
P = P[P.publication_id.str.match(r'^PUB\d+$')]
if only:
    P = P[P.publication_id.isin(only)]
pubs = list(P.publication_id)
keep = lambda df: df[df.publication_id.isin(pubs)]

N = keep(sheet('NOEUDS_CONNAISSANCE'))
R = keep(sheet('RELATIONS_CONNAISSANCE'))
C = keep(sheet('CONTENUS'))
nodes = rows(N, ['node_id', 'publication_id', 'type_noeud', 'libelle', 'libelle_normalise', 'page_source', 'chunk_id_source'])
rels = rows(R, ['relation_id', 'publication_id', 'source_id', 'type_relation', 'cible_id', 'page_source', 'chunk_id_source'])
contents = rows(C, ['chunk_id', 'publication_id', 'ordre', 'section', 'page_debut', 'page_fin', 'texte'])

images = sorted(os.listdir(imgdir))
lower = {}
for f in images:
    lower.setdefault(f.lower(), f)


def find_image(pid, declared):
    # Nom déclaré dans la base, sinon PUBxxx.png/.jpg ; casse indifférente (GitHub Pages la distingue).
    for name in [declared] + [f'{pid}.{e}' for e in ('png', 'jpg', 'jpeg', 'webp')]:
        if name and name in images:
            return name
        if name and name.lower() in lower:
            return lower[name.lower()]
    return ''
nc, rc, cc = (collections.Counter(x['publication_id'] for x in L) for L in (nodes, rels, contents))
PCOLS = ['publication_id', 'titre', 'année_publication', 'image_publication', 'auteurs_MI', 'organisme_producteur',
         'type_document', 'domaine', 'url_contenu', 'url_source']
publications = []
for p in rows(P, PCOLS):
    pid = p['publication_id']
    img = find_image(pid, p['image_publication'])
    has_img = bool(img)
    p.update(node_count=nc[pid], relation_count=rc[pid], chunk_count=cc[pid], has_graph=nc[pid] > 0,
             has_image=has_img, image_path=f'/images/publications/{img}' if has_img else '')
    publications.append(p)
pubmeta = {p['publication_id']: p for p in publications}

CE = keep(sheet('CHRONO_ELEMENTS'))
CP = keep(sheet('CHRONO_PROVENANCES'))
chrono_el = rows(CE, list(CE.columns))
chrono_pr = rows(CP, ['provenance_id', 'chrono_id', 'publication_id', 'chunk_id', 'page_source', 'section', 'preuve',
                      'expression_temporelle_source', 'niveau_confiance', 'origine_decision'])

T = sheet('TRAITEMENTS_IA')
treatments = rows(T, list(T.columns))

# Expertises
RF = S['REFERENTIEL_MICRO_EXPERTISES'].iloc[2:].dropna(how='all')
RF.columns = ['id', 'label', 'family']
ref = {s(r.id): (s(r.label), s(r.family)) for r in RF.itertuples()}
NE = keep(sheet('noeuds_expertises'))
AE = keep(sheet('Associations des expertises'))
defs = {}
byme = collections.defaultdict(list)
for r in NE.itertuples():
    me = s(r.id_micro_expertise)
    if r.publication_id not in byme[me]:
        byme[me].append(r.publication_id)
    if s(r.definition_courte) and me not in defs:
        defs[me] = s(r.definition_courte)
assoc = collections.defaultdict(collections.Counter)
edges = collections.defaultdict(lambda: {'count': 0, 'publication_ids': []})
for r in AE.itertuples():
    a, b = s(r.source_id), s(r.cible_id)
    assoc[a][b] += 1
    assoc[b][a] += 1
    e = edges[tuple(sorted((a, b)))]
    e['count'] += 1
    if r.publication_id not in e['publication_ids']:
        e['publication_ids'].append(r.publication_id)
expertise_nodes = []
for me in sorted(byme):
    label, family = ref.get(me, ('', ''))
    ps = byme[me]
    pm = [pubmeta[p] for p in ps]
    expertise_nodes.append({
        'id': me, 'label': label, 'family': family, 'definition': defs.get(me, ''),
        'entities': list(dict.fromkeys(p['organisme_producteur'] for p in pm if p['organisme_producteur'])),
        'domains': list(dict.fromkeys(p['domaine'] for p in pm if p['domaine'])),
        'publications': [{'publication_id': p['publication_id'], 'titre': p['titre'], 'annee': p['année_publication'],
                          'organisme': p['organisme_producteur'], 'image_path': p['image_path'],
                          'url_contenu': p['url_contenu'], 'url_source': p['url_source'], 'has_graph': p['has_graph']} for p in pm],
        'associated': [{'id': k, 'count': v} for k, v in sorted(assoc[me].items(), key=lambda kv: kv[0])],
        'publication_count': len(ps), 'degree': len(assoc[me]),
    })
expertise_edges = [{'source': a, 'target': b, **v} for (a, b), v in sorted(edges.items())]

# Notions transversales
TN = keep(sheet('TRANSVERSAL_NOTIONS'))
notions = []
for (sn, label), g in TN.groupby([TN.suivi_id.str[:5], 'notion'], sort=True):
    sel = {}
    for r in g.itertuples():
        sel.setdefault(r.publication_id, [])
        if r.node_id not in sel[r.publication_id]:
            sel[r.publication_id].append(r.node_id)
    notions.append({'sn': sn, 'label': label, 'selections': sel})

out_files = {'publications': publications, 'nodes': nodes, 'relations': rels, 'contents': contents,
             'treatments': treatments, 'expertise_nodes': expertise_nodes, 'expertise_edges': expertise_edges,
             'chronology_elements': chrono_el, 'chronology_provenances': chrono_pr, '_notions': notions}
for k, v in out_files.items():
    json.dump(v, open(os.path.join(out, k + '.json'), 'w'), ensure_ascii=False, indent=2)
print({k: len(v) for k, v in out_files.items()})
