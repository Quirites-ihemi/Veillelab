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

// ---------- Rendu des sources (provenance exacte + chunk visible) ----------
function formatRepere(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d+(?:\s*[;,]\s*\d+)*$/.test(raw)) {
    const pages = raw.split(/[;,]/).map(x => x.trim()).filter(Boolean);
    return `p. ${pages.join(pages.length > 1 ? " et " : "")}`;
  }
  if (/^\d+\s*[-–]\s*\d+$/.test(raw)) return `p. ${raw.replace(/\s*-\s*/, "–")}`;
  return `repère ${raw}`;
}
function refOf(s) {
  return [s.publication_id, formatRepere(s.repere)].filter(Boolean).join(" · ") || "Source du corpus";
}
function chunkHtml(s) {
  const chunk = String(s.extrait || "").replace(/\s+/g, " ").trim();
  if (!chunk) return `<div class="chunk-missing">Extrait du corpus non renvoyé par le backend.</div>`;
  return `<div class="chunk-box"><strong>Extrait du corpus</strong><p>« ${esc(clip(chunk, 900))} »</p></div>`;
}
function sourceHtml(s) {
  const link = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noreferrer">Ouvrir la source ↗</a>` : "";
  const why = s.raison_pertinence ? `<div class="why-box"><strong>Pourquoi ce matériau a été retenu</strong><p>${esc(clip(s.raison_pertinence, 220))}</p></div>` : "";
  return `<div class="source-mini"><strong>${esc(refOf(s))}</strong><small>${esc(s.titre || "")}</small>${chunkHtml(s)}${why}${link}</div>`;
}
function sourceStripHtml(s) {
  return `<div class="source-strip"><div class="source-main"><strong class="source-ref">${esc(refOf(s))}</strong><small class="source-title">${esc(s.titre || "")}</small>${chunkHtml(s)}</div>` +
    (s.url ? `<a class="source-open" href="${esc(s.url)}" target="_blank" rel="noreferrer">Ouvrir la source ↗</a>` : `<span class="source-open disabled">Lien indisponible</span>`) + `</div>`;
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
  const extra = kind === "trend" && item.limite ? `<p><em>Limite : ${esc(clip(item.limite, 220))}</em></p>`
    : kind === "sign" && item.extrait_appui ? `<p><em>Appui : « ${esc(clip(item.extrait_appui, 220))} »</em></p>`
    : kind === "source" ? `<p><em>${esc(item.type_source || "")} — « ${esc(clip(item.indice_recurrence || "", 200))} »</em></p>` : "";
  return `<div class="object-item"><strong>${esc(item.label || "")}</strong>${desc ? `<p>${esc(clip(desc, 260))}</p>` : ""}${extra}${(item.sources || []).map(sourceStripHtml).join("")}</div>`;
}
function emptyCol(title, why) { return `<div class="object-item"><strong>${esc(title)}</strong><p>${esc(why)}</p></div>`; }

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
        <div class="object-col sign"><h4>◉ Signes de changement à guetter</h4>${a.signes_a_guetter.length ? a.signes_a_guetter.map(x => itemHtml(x, "sign")).join("")
          : emptyCol("Aucun signe", "Aucun élément observable n’a pu être ancré par un extrait vérifié.")}</div>
        <div class="object-col source"><h4>↗ Sources à surveiller</h4>${a.sources_a_surveiller.length ? a.sources_a_surveiller.map(x => itemHtml(x, "source")).join("")
          : emptyCol("Aucune source récurrente identifiée", "Les matériaux validés ne permettent pas d’établir une source suivable dans le temps (série, observatoire, bulletin…).")}</div>
      </div>`;
    const angles = (a.angles_morts || []).length ? `<p class="why"><strong>Angles morts :</strong> ${a.angles_morts.map(esc).join(" · ")}</p>` : "";
    return `<section class="object-axis">${head}
      <p class="why"><small>Requête : « ${esc(d.requete_axe || "")} » — ${d.candidats_evalues ?? 0} évalués, ${d.materiaux_valides ?? 0} retenus, ${nPub} publication(s)${d.ancres_attendues ? ` — ancres retrouvées ${d.ancres_retrouvees}/${d.ancres_attendues}` : ""}</small></p>
      ${cols}${angles}
      <details class="raw-materials"><summary>Matériaux validés pour cet axe (${(a.materiaux_valides || []).length})</summary>${(a.materiaux_valides || []).map(sourceHtml).join("")}</details>
      ${excludedHtml(a.materiaux_ecartes)}${rejetsHtml(a.rejets)}
    </section>`;
  }).join("");
}

// ---------- Étape 4 ----------
function renderFinal() {
  $("#finalPreview").innerHTML = `<div class="need-recap"><b>Besoin</b><span>${esc(state.need)}</span></div>` +
    state.objects.map(o => {
      if (o.statut !== "ok") return `<section class="final-axis"><h3>${esc(o.titre)}</h3><p class="axis-failure">${esc(o.statut === "erreur_technique" ? "Erreur technique." : (o.message || "Aucun objet fondé."))}</p></section>`;
      const li = [
        ...o.tendances.map(x => `<li>Tendance — ${esc(x.label)}</li>`),
        ...o.signes_a_guetter.map(x => `<li>Signe à guetter — ${esc(x.label)}</li>`),
        ...o.sources_a_surveiller.map(x => `<li>Source à surveiller — ${esc(x.label)}</li>`)
      ].join("");
      return `<section class="final-axis"><h3>${esc(o.titre)}</h3><p>${esc(o.objectif_surveillance || "")}</p><ul>${li || "<li>Aucun objet suffisamment sourcé.</li>"}</ul></section>`;
    }).join("");
}

function download() {
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
$("#downloadBtn").onclick = download;
$$("[data-back]").forEach(b => b.onclick = () => gotoStep(+b.dataset.back));
checkHealth();
