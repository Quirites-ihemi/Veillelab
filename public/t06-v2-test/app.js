// =====================================================
// T06 — Front GitHub Pages V0.5 — TEST ISOLÉ
// - Branché sur /scenario-v2/axes et /scenario-v2/axis-objects du backend Cloud Run T06 V2 de test.
// - SUPPRIMÉ : fallbackWatchFromMaterials, localFallbackAxes, FALLBACK_GROUPS,
//   shouldUseFallback, recherche corpus côté front, digest injecté dans le besoin.
// - Une case vide est affichée comme vide, avec son motif.
// Même HTML que la V0.4 (mêmes identifiants d'éléments).
// =====================================================

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// Backend de test configurable depuis l'interface. Aucun serveur local n'est requis.
let BACKEND = String(window.T06_BACKEND || "").replace(/\/+$/, "");
try {
  if (!BACKEND) BACKEND = String(localStorage.getItem("t06_v2_backend") || "").replace(/\/+$/, "");
} catch {}

const state = { step: 1, need: "", subjectQuery: "", anchor: null, axes: [], objects: [] };

function esc(s = "") { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function clip(s = "", n = 230) { s = String(s).replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + "…"; }

async function api(path, payload = null) {
  if (!BACKEND) throw new Error("Configurez d'abord l'URL du backend T06 V2 de test.");
  const opt = payload === null ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
  const res = await fetch(`${BACKEND}${path}`, opt);
  const txt = await res.text();
  let data; try { data = JSON.parse(txt); } catch { data = { ok: false, error: txt }; }
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}
function showAlert(m) { const el = $("#alert"); el.textContent = m; el.classList.remove("hidden"); }
function clearAlert() { $("#alert").classList.add("hidden"); }
function loading(on, title = "", detail = "") {
  $("#loading").classList.toggle("hidden", !on);
  if (on) { $("#loadingTitle").textContent = title || "Traitement en cours…"; $("#loadingDetail").textContent = detail || ""; }
}
function gotoStep(n) {
  state.step = n;
  $$(".view").forEach((v, i) => v.classList.toggle("hidden", i !== n - 1));
  $$(".step").forEach(b => { const x = +b.dataset.step; b.classList.toggle("active", x === n); b.classList.toggle("done", x < n); });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Rendu des sources (provenance lisible, preuve à la demande) ----------
function formatRepere(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // Dans T06, les repères numériques à deux bornes correspondent à page_debut/page_fin.
  if (/^\d+\s*[;,]\s*\d+$/.test(raw)) {
    const [a, b] = raw.split(/[;,]/).map(x => x.trim());
    return a === b ? `p. ${a}` : `p. ${a}–${b}`;
  }
  if (/^\d+\s*[-–]\s*\d+$/.test(raw)) {
    const [a, b] = raw.split(/[-–]/).map(x => x.trim());
    return a === b ? `p. ${a}` : `p. ${a}–${b}`;
  }
  if (/^\d+$/.test(raw)) return `p. ${raw}`;
  return `repère ${raw}`;
}
function refOf(s) {
  return [s.publication_id, formatRepere(s.repere)].filter(Boolean).join(" · ") || "Source du corpus";
}
function sourcePageLabel(s) { return formatRepere(s?.repere || "") || "page indiquée"; }
function isTableMaterial(s) {
  const t = String(s?.extrait || "").trim();
  if (!t) return false;
  const pipes = (t.match(/\|/g) || []).length;
  const compact = t.replace(/\s+/g, "");
  return pipes >= 8 && pipes / Math.max(compact.length, 1) > 0.025;
}
function chunkHtml(s) {
  const chunk = String(s.extrait || "").replace(/\s+/g, " ").trim();
  if (isTableMaterial(s)) {
    const link = s.url ? `<a class="table-open" href="${esc(s.url)}" target="_blank" rel="noreferrer">Voir le tableau — ${esc(sourcePageLabel(s))} ↗</a>` : `<span class="table-open disabled">Tableau source — ${esc(sourcePageLabel(s))}</span>`;
    return `<div class="table-source-note">${link}</div>`;
  }
  if (!chunk) return `<div class="chunk-missing">Passage indexé non renvoyé par le backend.</div>`;
  return `<details class="proof-details"><summary>Voir la preuve</summary><div class="chunk-box"><strong>Synthèse du passage indexé</strong><p>« ${esc(clip(chunk, 900))} »</p></div></details>`;
}
function sourceHtml(s) {
  const link = s.url && !isTableMaterial(s) ? `<a href="${esc(s.url)}" target="_blank" rel="noreferrer">Ouvrir la source ↗</a>` : "";
  const why = s.raison_pertinence ? `<div class="why-box"><strong>Pourquoi ce matériau a été retenu</strong><p>${esc(clip(s.raison_pertinence, 220))}</p></div>` : "";
  return `<div class="source-mini"><strong>${esc(refOf(s))}</strong><small>${esc(s.titre || "")}</small>${chunkHtml(s)}${why}${link}</div>`;
}
function sourceStripHtml(s) {
  const table = isTableMaterial(s);
  const action = table
    ? (s.url ? `<a class="source-open" href="${esc(s.url)}" target="_blank" rel="noreferrer">Voir le tableau — ${esc(sourcePageLabel(s))} ↗</a>` : `<span class="source-open disabled">Tableau — ${esc(sourcePageLabel(s))}</span>`)
    : (s.url ? `<a class="source-open" href="${esc(s.url)}" target="_blank" rel="noreferrer">Ouvrir la source ↗</a>` : `<span class="source-open disabled">Lien indisponible</span>`);
  const proof = table ? "" : chunkHtml(s);
  return `<div class="source-strip"><div class="source-main"><strong class="source-ref">${esc(refOf(s))}</strong><small class="source-title">${esc(s.titre || "")}</small>${proof}</div>${action}</div>`;
}
function compactSourceHtml(s) {
  const table = isTableMaterial(s);
  const label = table ? `Voir le tableau — ${sourcePageLabel(s)}` : refOf(s);
  return `<div class="final-source-ref"><span>${esc(label)}</span>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noreferrer">Source ↗</a>` : ""}</div>`;
}
const MOTIFS = {
  hors_sujet: "hors sujet", hors_axe: "hors axe", extrait_introuvable: "justification non vérifiable dans le texte", non_evalue: "non évalué par le filtre"
};
function excludedHtml(list = []) {
  if (!list.length) return "";
  return `<details class="raw-materials"><summary>Matériaux écartés par le filtre (${list.length})</summary>` +
    list.map(x => `<div class="source-mini"><strong>${esc(refOf(x))} — ${esc(MOTIFS[x.motif] || x.motif)}</strong><small>${esc(x.titre || "")}</small>${x.raison ? `<small><em>${esc(clip(x.raison, 200))}</em></small>` : ""}</div>`).join("") +
    `</details>`;
}
function rejetsHtml(list = []) {
  if (!list.length) return "";
  return `<details class="raw-materials"><summary>Journal de validation : objets rejetés (${list.length})</summary>` +
    list.map(x => `<div class="source-mini"><small>${esc(x.objet)} → <strong>${esc(x.motif)}</strong>${x.valeur ? ` (${esc(x.valeur)})` : ""}</small></div>`).join("") +
    `</details>`;
}

// ---------- Étape 1 → 2 : besoin → matériaux validés → axes ----------
async function analyze() {
  clearAlert();
  const need = $("#need").value.trim();
  if (!need) return showAlert("Saisissez d’abord votre besoin de veille.");
  state.need = need;
  loading(true, "Recherche et filtrage du corpus", "Les matériaux sont retrouvés, filtrés un par un, puis les axes émergent des seuls matériaux retenus.");
  try {
    const r = await api("/scenario-v2/axes", { need });
    state.anchor = r;
    state.subjectQuery = r.subject_query || "";
    state.axes = (r.axes || []).map(a => ({ ...a, selected: true }));
    if (!state.axes.length) showAlert(r.message || "Le corpus ne permet de fonder aucun axe pour ce besoin.");
    renderStep2();
    gotoStep(2);
  } catch (e) { showAlert(String(e.message || e)); }
  finally { loading(false); }
}

function renderStep2() {
  const r = state.anchor || {};
  const d = r.diagnostic || {};
  $("#needRecap2").textContent = `${state.need}  —  requête sujet : « ${state.subjectQuery} »`;
  $("#coverage").innerHTML =
    `<div><strong>${d.candidats_evalues ?? 0}</strong><small>matériaux évalués</small></div>` +
    `<div><strong>${d.materiaux_valides ?? 0}</strong><small>matériaux jugés pertinents</small></div>` +
    `<div><strong>${d.publications_validees ?? 0}</strong><small>publications pertinentes</small></div>`;

  const axesHtml = state.axes.map((a, i) => `
    <article class="axis-card ${a.selected ? "selected" : ""}" data-axis="${i}">
      <div class="axis-head">
        <button class="axis-check" data-toggle-axis="${i}">${a.selected ? "✓" : "○"}</button>
        <div><h3>${esc(a.titre)}</h3></div>
        <span class="coverage-badge ${a.publication_count < 2 ? "partial" : ""}">${a.publication_count} publication${a.publication_count > 1 ? "s" : ""}</span>
      </div>
      <p>${esc(a.objectif_surveillance || "")}</p>
      ${a.question_veille ? `<p><strong>Question :</strong> ${esc(a.question_veille)}</p>` : ""}
      <p class="why"><strong>Fondement :</strong> ${esc(a.justification || "")}</p>
      ${a.statut_documentaire === "appui_publication_unique" ? `<p class="why"><strong>Limite :</strong> axe appuyé sur une seule publication.</p>` : ""}
      <details class="axis-sources"><summary>Matériaux qui fondent cet axe (${(a.sources || []).length})</summary>${(a.sources || []).map(sourceHtml).join("")}</details>
    </article>`).join("");

  const empty = state.axes.length ? "" :
    `<article class="axis-card"><h3>Aucun axe fondé sur le corpus</h3><p>${esc(r.message || "")}</p></article>`;

  $("#axesGrid").innerHTML = axesHtml + empty +
    `<details class="axis-sources"><summary>Matériaux jugés pertinents pour le sujet (${(r.materiaux_valides || []).length})</summary>${(r.materiaux_valides || []).map(sourceHtml).join("")}</details>` +
    excludedHtml(r.materiaux_ecartes) + rejetsHtml(r.rejets);

  $$("[data-toggle-axis]").forEach(btn => btn.onclick = () => {
    const i = +btn.dataset.toggleAxis; state.axes[i].selected = !state.axes[i].selected; renderStep2();
  });
}

// ---------- Étape 2 → 3 : objets par axe ----------
async function buildObjects() {
  clearAlert();
  const selected = state.axes.filter(a => a.selected);
  if (!selected.length) return showAlert("Retenez au moins un axe.");
  state.objects = [];
  for (let i = 0; i < selected.length; i++) {
    const a = selected[i];
    loading(true, `Axe ${i + 1}/${selected.length} — ${a.titre}`, "Recherche sujet + axe, filtrage, puis génération à partir des seuls matériaux validés.");
    try {
      const axis = {
        axis_id: a.axis_id, titre: a.titre, objectif_surveillance: a.objectif_surveillance,
        question_veille: a.question_veille, termes_discriminants: a.termes_discriminants || [],
        anchor_material_ids: a.anchor_material_ids || []
      };
      state.objects.push(await api("/scenario-v2/axis-objects", { need: state.need, subject_query: state.subjectQuery, axis }));
    } catch (e) {
      // Aucune donnée de repli : l'échec est affiché comme un échec.
      state.objects.push({ axis_id: a.axis_id, titre: a.titre, objectif_surveillance: a.objectif_surveillance,
        statut: "erreur_technique", erreur: String(e.message || e), tendances: [], signes_a_guetter: [], sources_a_surveiller: [], angles_morts: [] });
    }
  }
  loading(false);
  renderStep3();
  gotoStep(3);
}

function itemHtml(item, kind) {
  const desc = kind === "trend" ? item.synthese : kind === "sign" ? item.pourquoi_guetter : item.raison;
  const extra = kind === "trend" && item.limite ? `<p class="object-limit"><em>Limite : ${esc(clip(item.limite, 220))}</em></p>`
    : kind === "sign" && item.extrait_appui ? `<p class="object-appui"><em>Appui documentaire : « ${esc(clip(item.extrait_appui, 220))} »</em></p>`
    : kind === "source" ? `<p class="object-appui"><em>${esc(item.type_source || "")}${item.indice_recurrence ? ` — « ${esc(clip(item.indice_recurrence, 200))} »` : ""}</em></p>` : "";
  const sources = item.sources || [];
  const provenance = sources.length ? `<div class="object-provenance">${sources.map(s => `<span>${esc(refOf(s))}</span>`).join("")}</div>` : "";
  const proof = sources.length ? `<details class="object-proof"><summary>Voir la preuve et la provenance</summary>${sources.map(sourceStripHtml).join("")}</details>` : "";
  return `<div class="object-item"><strong>${esc(item.label || "")}</strong>${desc ? `<p>${esc(clip(desc, 320))}</p>` : ""}${extra}${provenance}${proof}</div>`;
}
function emptyCol(title, why) { return `<div class="object-empty"><strong>${esc(title)}</strong><p>${esc(why)}</p></div>`; }

function renderStep3() {
  $("#needRecap3").textContent = state.need;
  $("#objectsContainer").innerHTML = state.objects.map((a, i) => {
    const head = `<div class="object-axis-head"><div><span>Axe ${i + 1}</span><h3>${esc(a.titre)}</h3><p>${esc(a.objectif_surveillance || "")}</p></div></div>`;
    if (a.statut === "erreur_technique") {
      return `<section class="object-axis">${head}<div class="axis-failure">Erreur technique (${esc(clip(a.erreur || "", 200))}). Ce statut ne dit rien du contenu du corpus.</div></section>`;
    }
    const d = a.diagnostic || {};
    const nPub = d.publications_validees ?? 0;
    const cols = a.statut === "aucun_materiau_valide"
      ? `<div class="fallback-note">${esc(a.message || "Aucun matériau pertinent pour le sujet et l’axe : aucun objet produit.")}</div>`
      : `<div class="objects-grid">
        <div class="object-col trend"><h4>▤ Tendances documentées</h4>${a.tendances.length ? a.tendances.map(x => itemHtml(x, "trend")).join("")
          : emptyCol("Aucune tendance", nPub < 2 ? `Une seule publication pertinente (${nPub}) : une tendance exige au moins deux publications convergentes.` : "Les matériaux validés ne décrivent pas d’évolution commune à deux publications.")}</div>
        <div class="object-col sign"><h4>◉ Éléments à surveiller</h4>${a.signes_a_guetter.length ? a.signes_a_guetter.map(x => itemHtml(x, "sign")).join("")
          : emptyCol("Aucun élément à surveiller", "Aucun élément observable n’a pu être ancré dans les matériaux validés.")}</div>
        <div class="object-col source"><h4>↗ Sources à surveiller</h4>${a.sources_a_surveiller.length ? a.sources_a_surveiller.map(x => itemHtml(x, "source")).join("")
          : emptyCol("Aucune source récurrente identifiée", "Les matériaux validés ne permettent pas d’établir une source suivable dans le temps (série, observatoire, bulletin…).")}</div>
      </div>`;
    const angles = (a.angles_morts || []).length ? `<div class="points-doc"><strong>Points à documenter</strong><ul>${a.angles_morts.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
    return `<section class="object-axis">${head}
      <p class="why"><small>Requête : « ${esc(d.requete_axe || "")} » — ${d.candidats_evalues ?? 0} évalués, ${d.materiaux_valides ?? 0} retenus, ${nPub} publication(s)${d.ancres_attendues ? ` — ancres retrouvées ${d.ancres_retrouvees}/${d.ancres_attendues}` : ""}</small></p>
      ${cols}${angles}
      <details class="raw-materials"><summary>Matériaux validés pour cet axe (${(a.materiaux_valides || []).length})</summary>${(a.materiaux_valides || []).map(sourceHtml).join("")}</details>
      ${excludedHtml(a.materiaux_ecartes)}${rejetsHtml(a.rejets)}
    </section>`;
  }).join("");
}

// ---------- Étape 4 ----------
function finalItemsSection(title, items, kind, emptyText) {
  const body = items.length ? items.map(item => {
    const desc = kind === "trend" ? item.synthese : kind === "sign" ? item.pourquoi_guetter : item.raison;
    const refs = (item.sources || []).map(compactSourceHtml).join("");
    return `<article class="final-object"><strong>${esc(item.label || "")}</strong>${desc ? `<p>${esc(clip(desc, 300))}</p>` : ""}${refs}</article>`;
  }).join("") : `<div class="final-empty">${esc(emptyText)}</div>`;
  return `<section class="final-group"><h4>${esc(title)}</h4>${body}</section>`;
}
function renderFinal() {
  const intro = `<div class="final-title-block"><div><span class="final-kicker">SCÉNARIO DE VEILLE</span><h3>${esc(state.need)}</h3></div><div class="final-date">${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date())}</div></div>`;
  const axes = state.objects.map(o => {
    if (o.statut !== "ok") return `<section class="final-axis-card"><h3>${esc(o.titre)}</h3><p class="axis-failure">${esc(o.statut === "erreur_technique" ? "Erreur technique." : (o.message || "Aucun objet fondé."))}</p></section>`;
    const points = (o.angles_morts || []).length ? `<section class="final-group points"><h4>Points à documenter</h4><ul>${o.angles_morts.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>` : "";
    return `<section class="final-axis-card"><div class="final-axis-heading"><h3>${esc(o.titre)}</h3><p>${esc(o.objectif_surveillance || "")}</p></div><div class="final-groups">${finalItemsSection("Tendances documentées", o.tendances || [], "trend", "Aucune tendance suffisamment documentée.")}${finalItemsSection("Éléments à surveiller", o.signes_a_guetter || [], "sign", "Aucun élément suffisamment sourcé.")}${finalItemsSection("Sources à surveiller", o.sources_a_surveiller || [], "source", "Aucune source récurrente identifiée.")}</div>${points}</section>`;
  }).join("");
  $("#finalPreview").innerHTML = intro + axes;
}


// ---------- Export Word (.docx) autonome, sans dépendance externe ----------
function xmlEsc(s = "") { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c])); }
function docxRun(text, opts = {}) {
  const rPr = `${opts.bold ? "<w:b/>" : ""}${opts.italic ? "<w:i/>" : ""}${opts.color ? `<w:color w:val="${opts.color}"/>` : ""}${opts.size ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : ""}`;
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}
function docxP(text = "", style = "Normal", opts = {}) {
  const pPr = `<w:pPr><w:pStyle w:val="${style}"/>${opts.spacingAfter ? `<w:spacing w:after="${opts.spacingAfter}"/>` : ""}</w:pPr>`;
  return `<w:p>${pPr}${docxRun(text, opts)}</w:p>`;
}
function docxBullet(text) { return `<w:p><w:pPr><w:pStyle w:val="Normal"/><w:ind w:left="360" w:hanging="180"/></w:pPr>${docxRun("• " + text)}</w:p>`; }
function docxHyperlink(label, url, rels) {
  const id = `rId${rels.length + 2}`;
  rels.push({ id, url });
  return `<w:p><w:pPr><w:pStyle w:val="Source"/></w:pPr><w:hyperlink r:id="${id}" w:history="1"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t>${xmlEsc(label)}</w:t></w:r></w:hyperlink></w:p>`;
}
function docxObject(item, kind, rels) {
  const desc = kind === "trend" ? item.synthese : kind === "sign" ? item.pourquoi_guetter : item.raison;
  let x = docxP(item.label || "", "ObjectTitle", { bold: true });
  if (desc) x += docxP(desc, "Normal");
  for (const s of (item.sources || [])) {
    const label = `${s.publication_id || "Source"}${formatRepere(s.repere) ? " — " + formatRepere(s.repere) : ""}${s.titre ? " — " + s.titre : ""}`;
    x += docxP(label, "Source");
    if (s.url) x += docxHyperlink(isTableMaterial(s) ? `Voir le tableau — ${sourcePageLabel(s)}` : "Ouvrir la source", s.url, rels);
  }
  return x;
}
function crc32(bytes) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n=0;n<256;n++) { let c=n; for (let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1); table[n]=c>>>0; }
  }
  let c=0xFFFFFFFF; for (const b of bytes) c=table[(c^b)&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0;
}
function u16(n){ return [n&255,(n>>>8)&255]; } function u32(n){ return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]; }
function zipStore(files) {
  const te = new TextEncoder(); const chunks=[]; const central=[]; let offset=0;
  for (const f of files) {
    const name=te.encode(f.name), data=typeof f.data === "string" ? te.encode(f.data) : f.data, crc=crc32(data);
    const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name]);
    chunks.push(local,data);
    const cen=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);
    central.push(cen); offset += local.length + data.length;
  }
  const centralSize=central.reduce((a,b)=>a+b.length,0), centralOffset=offset;
  const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(centralOffset),...u16(0)]);
  return new Blob([...chunks,...central,end], {type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}
function buildDocxBlob() {
  const rels=[];
  let body = docxP("Scénario de veille", "Title") + docxP(`Besoin : ${state.need}`, "Subtitle") + docxP(`Généré le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date())}`, "Meta");
  for (const o of state.objects) {
    body += docxP(o.titre || "Axe", "Heading1");
    if (o.objectif_surveillance) body += docxP(o.objectif_surveillance, "AxisObjective");
    if (o.statut !== "ok") { body += docxP(o.message || "Aucun objet suffisamment fondé.", "Normal"); continue; }
    const groups = [
      ["Tendances documentées", o.tendances || [], "trend", "Aucune tendance suffisamment documentée."],
      ["Éléments à surveiller", o.signes_a_guetter || [], "sign", "Aucun élément suffisamment sourcé."],
      ["Sources à surveiller", o.sources_a_surveiller || [], "source", "Aucune source récurrente identifiée."]
    ];
    for (const [title, items, kind, empty] of groups) {
      body += docxP(title, "Heading2");
      if (!items.length) body += docxP(empty, "Empty"); else for (const item of items) body += docxObject(item, kind, rels);
    }
    body += docxP("Points à documenter", "Heading2");
    if ((o.angles_morts || []).length) for (const x of o.angles_morts) body += docxBullet(x); else body += docxP("Aucun point supplémentaire identifié.", "Empty");
  }
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:color w:val="082653"/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="315F8F"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="71869A"/><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:color w:val="0B315E"/><w:sz w:val="30"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="120"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:color w:val="1768C4"/><w:sz w:val="24"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="100"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="AxisObjective"><w:name w:val="Axis Objective"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="456784"/><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ObjectTitle"><w:name w:val="Object Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="17466F"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="60"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Source"><w:name w:val="Source"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="58738F"/><w:sz w:val="18"/></w:rPr><w:pPr><w:spacing w:after="50"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Empty"><w:name w:val="Empty"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="71869A"/><w:i/></w:rPr></w:style></w:styles>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels.map(x => `<Relationship Id="${x.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEsc(x.url)}" TargetMode="External"/>`).join("")}</Relationships>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
  const now = new Date().toISOString();
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Scénario de veille</dc:title><dc:creator>Quiritès Veille Lab</dc:creator><cp:lastModifiedBy>Quiritès Veille Lab</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Quiritès Veille Lab</Application></Properties>`;
  return zipStore([{name:"[Content_Types].xml",data:types},{name:"_rels/.rels",data:rootRels},{name:"word/document.xml",data:documentXml},{name:"word/styles.xml",data:stylesXml},{name:"word/_rels/document.xml.rels",data:docRels},{name:"docProps/core.xml",data:core},{name:"docProps/app.xml",data:appXml}]);
}
function downloadDocx() {
  const blob = buildDocxBlob();
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "scenario-de-veille-quirites.docx"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
function downloadJson() {
  const payload = {
    generated_at: new Date().toISOString(),
    mode: "T06-v2-github-test-filtered",
    need: state.need,
    subject_query: state.subjectQuery,
    anchor: state.anchor,
    axes_retenus: state.axes.filter(a => a.selected),
    objects: state.objects
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "scenario-veille-v2-test.json"; a.click(); URL.revokeObjectURL(a.href);
}

async function checkHealth() {
  const el = $("#backendState");
  el.classList.remove("ok", "bad");
  if (!BACKEND) {
    el.textContent = "Backend T06 V2 à configurer";
    el.classList.add("bad");
    return false;
  }
  try {
    const h = await api("/health");
    el.textContent = h.ok ? `Backend T06 V2 connecté · ${h.version || "OK"}` : "Backend répond";
    el.classList.add("ok");
    return true;
  } catch (e) {
    el.textContent = `Backend inaccessible`;
    el.classList.add("bad");
    showAlert(`Connexion au backend impossible : ${e.message || e}`);
    return false;
  }
}

function configureBackend() {
  const input = $("#backendUrl");
  const value = String(input?.value || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(value)) {
    return showAlert("Collez l'URL HTTPS du service Cloud Run T06 V2 de test.");
  }
  BACKEND = value;
  try { localStorage.setItem("t06_v2_backend", BACKEND); } catch {}
  clearAlert();
  checkHealth();
}

$("#connectBackendBtn").onclick = configureBackend;
if ($("#backendUrl")) $("#backendUrl").value = BACKEND;
$("#demoBtn").onclick = () => { $("#need").value = "Je veux faire une veille sur les évolutions de la pédocriminalité"; };
$("#analyseBtn").onclick = analyze;
$("#objectsBtn").onclick = buildObjects;
$("#finalBtn").onclick = () => { renderFinal(); gotoStep(4); };

const wordBtn = $("#downloadBtn");
if (wordBtn) {
  wordBtn.textContent = "Télécharger le scénario (.docx)";
  wordBtn.onclick = downloadDocx;
  const jsonBtn = document.createElement("button");
  jsonBtn.className = "secondary export-json-btn";
  jsonBtn.textContent = "Export technique (.json)";
  jsonBtn.onclick = downloadJson;
  wordBtn.parentElement.insertBefore(jsonBtn, wordBtn);
}

$$("[data-back]").forEach(b => b.onclick = () => gotoStep(+b.dataset.back));
checkHealth();
