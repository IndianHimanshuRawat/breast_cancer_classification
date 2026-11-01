// ---- Config: point this at your FastAPI server ----
const API_URL = "https://breast-cancer-classification-xpep.onrender.com/predict";

// [key, label, typical min, typical max]. Keys must match the API exactly (note the space in "concave points_se").
const GROUPS = [
  { title: "Average of the nuclei", hint: "Mean values across all cells in the sample.", fields: [
    ["radius_mean","Radius",7,28],["texture_mean","Texture",9.7,39],["smoothness_mean","Smoothness",0.05,0.17],
    ["compactness_mean","Compactness",0.02,0.35],["symmetry_mean","Symmetry",0.1,0.31],["fractal_dimension_mean","Fractal dimension",0.05,0.1]]},
  { title: "Variation between nuclei", hint: "Standard error: how much each measurement varies.", fields: [
    ["radius_se","Radius",0.1,2.9],["texture_se","Texture",0.35,4.9],["smoothness_se","Smoothness",0.001,0.032],
    ["compactness_se","Compactness",0.002,0.14],["concave points_se","Concave points",0,0.053],["symmetry_se","Symmetry",0.007,0.08]]},
  { title: "Most extreme nuclei", hint: "Worst (largest) values found in the sample.", fields: [
    ["symmetry_worst","Symmetry",0.15,0.67],["fractal_dimension_worst","Fractal dimension",0.05,0.21]]}
];
const GROUP_NAME = ["Mean","Variation in","Worst"];
const LABEL = {}; GROUPS.forEach((g,i) => g.fields.forEach(f => LABEL[f[0]] = `${GROUP_NAME[i]} ${f[1].toLowerCase()}`));

const SAMPLES = {
  malignant: [17.99,10.38,0.1184,0.2776,0.2419,0.07871,1.095,0.9053,0.006399,0.04904,0.01587,0.03003,0.4601,0.1189],
  benign:    [13.54,14.36,0.09779,0.08129,0.1885,0.05766,0.2699,0.7886,0.008462,0.0146,0.01015,0.01918,0.2746,0.08128]
};

const LEVELS = {
  very_low:  { badge: "Very low likelihood", title: "Benign pattern", pos: 5,
    detail: "The measurements strongly resemble benign tissue.",
    steps: ["Keep up routine screening for your age and risk group.", "Learn how your breasts normally look and feel, and report any change promptly.", "Keep this report with your health records.", "Maintain a healthy weight, limit alcohol and stay active."] },
  low:       { badge: "Low likelihood", title: "Likely benign", pos: 25,
    detail: "The measurements lean toward benign tissue, with some features worth a second look.",
    steps: ["Share this result with your doctor at your next visit.", "Ask whether a follow-up image or repeat sample is advisable.", "Keep to your screening schedule and report new symptoms such as a lump, discharge or skin change.", "Keep a copy of this report for comparison."] },
  uncertain: { badge: "Uncertain result", title: "Inconclusive pattern", pos: 50,
    detail: "The model cannot separate benign from malignant with confidence on these measurements.",
    steps: ["Book an appointment with a doctor or breast specialist in the coming days.", "Ask about a repeat aspirate, ultrasound, or a core needle biopsy.", "Double-check the values you entered against the lab report.", "Bring any earlier imaging or pathology results."] },
  high:      { badge: "High likelihood", title: "Malignant pattern", pos: 78,
    detail: "The measurements resemble malignant tissue. This is an estimate, not a diagnosis.",
    steps: ["See a breast specialist or oncologist soon, ideally within the week.", "Ask for pathology confirmation (core needle biopsy) and staging imaging if advised.", "Bring this report, the original lab sheet and your family history.", "Take someone you trust to the appointment and write down what you are told."] },
  very_high: { badge: "Very high likelihood", title: "Malignant pattern", pos: 95,
    detail: "The measurements strongly resemble malignant tissue. This is an estimate, not a diagnosis.",
    steps: ["Contact a breast specialist or oncologist as soon as you can.", "Ask for pathology confirmation and a treatment-planning discussion.", "Bring this report, the original lab sheet and your family history.", "Ask for support: many hospitals offer a nurse navigator or counsellor."] }
};
const QUESTIONS = [
  "Do these measurements match the lab report you received?",
  "Do I need a biopsy or repeat test to confirm?",
  "What do my family history and age mean for my risk?",
  "How soon should I come back for follow-up?"
];

const $ = (s, el = document) => el.querySelector(s);
const form = $("#form"), groupsEl = $("#groups");
const keys = GROUPS.flatMap(g => g.fields.map(f => f[0]));
const range = Object.fromEntries(GROUPS.flatMap(g => g.fields.map(f => [f[0], [f[2], f[3]]])));
const idOf = k => "f_" + k.replace(/\W+/g, "_");
const input = k => document.getElementById(idOf(k));
const history = [];

GROUPS.forEach(g => {
  const fs = document.createElement("fieldset");
  fs.innerHTML = `<legend>${g.title}</legend><p class="hint">${g.hint}</p><div class="grid">` +
    g.fields.map(([k, label, lo, hi]) => `
      <div class="field" data-key="${k}">
        <label for="${idOf(k)}">${label}</label>
        <input id="${idOf(k)}" type="number" step="any" min="0" inputmode="decimal" placeholder="e.g. ${((lo + hi) / 2).toPrecision(2)}" required>
        <small>Typical ${lo} to ${hi}</small>
        <span class="err">Enter a number of 0 or more</span>
        <span class="warn">Outside the typical range. Check the value.</span>
      </div>`).join("") + `</div>`;
  groupsEl.appendChild(fs);
});

function fill(type) {
  SAMPLES[type].forEach((v, i) => input(keys[i]).value = v);
  document.querySelectorAll(".field").forEach(f => f.classList.remove("bad", "odd"));
  $("#analyze").scrollIntoView({ behavior: "smooth" });
}
document.querySelectorAll("[data-sample]").forEach(b => b.addEventListener("click", () => fill(b.dataset.sample)));
$("#clear").addEventListener("click", () => {
  form.reset(); showIdle(); $("#report").hidden = true;
  document.querySelectorAll(".field").forEach(f => f.classList.remove("bad", "odd"));
});
form.addEventListener("input", e => {
  const f = e.target.closest(".field"); if (!f) return;
  f.classList.remove("bad");
  const v = parseFloat(e.target.value), [lo, hi] = range[f.dataset.key];
  f.classList.toggle("odd", !Number.isNaN(v) && (v < lo * .8 || v > hi * 1.2));
});
$("#print").addEventListener("click", () => window.print());

const out = $("#out"), idle = $("#idle");
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
function showIdle() { out.hidden = true; out.classList.remove("show"); idle.hidden = false; }

function countUp(el, to) {
  if (still) { el.textContent = to; return; }
  const t0 = performance.now();
  (function tick(t) {
    const p = Math.min((t - t0) / 1300, 1);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

function render(d) {
  const L = LEVELS[d.risk_level], pm = d.probability_malignant, pb = d.probability_benign;
  const pct = x => (x * 100).toFixed(1) + "%";
  idle.hidden = true; out.hidden = false;
  out.className = "out r-" + d.risk_level;
  $("#arc").style.strokeDashoffset = 327;
  $("#needle").style.left = "0%"; $("#bBen").style.width = $("#bMal").style.width = "0";
  void out.offsetWidth;
  out.classList.add("show");

  $("#badge").textContent = L.badge;
  $("#verdict").textContent = L.title;
  $("#detail").textContent = L.detail;
  $("#vBen").textContent = pct(pb); $("#vMal").textContent = pct(pm);
  requestAnimationFrame(() => {
    $("#arc").style.strokeDashoffset = 327 * (1 - pm);
    $("#needle").style.left = `calc(${pm * 100}% - 2px)`;
    $("#bBen").style.width = pb * 100 + "%"; $("#bMal").style.width = pm * 100 + "%";
  });
  countUp($("#pct"), Math.round(pm * 100));

  // report
  $("#report").hidden = false;
  $("#stamp").textContent = "Generated " + new Date().toLocaleString();
  $("#steps").innerHTML = L.steps.map(s => `<li>${s}</li>`).join("");
  $("#questions").innerHTML = QUESTIONS.map(s => `<li>${s}</li>`).join("");
  $("#model-info").textContent = `${d.model}. Model confidence in its label: ${pct(d.confidence)}.`;

  const top = d.factors.slice(0, 6), max = Math.max(...top.map(f => Math.abs(f.contribution)), .01);
  $("#factors").innerHTML = top.map(f => {
    const up = f.contribution > 0, w = Math.abs(f.contribution) / max * 50;
    return `<div class="frow"><span>${LABEL[f.key] || f.key}</span>
      <div class="ftrack"><i class="fbar ${up ? "up" : "down"}" data-w="${w}"></i></div>
      <em>${up ? "+" : ""}${f.contribution.toFixed(2)}</em></div>`;
  }).join("");
  requestAnimationFrame(() => requestAnimationFrame(() =>
    document.querySelectorAll(".fbar").forEach(b => b.style.width = b.dataset.w + "%")));

  history.unshift({ t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), title: L.title, p: pct(pm) });
  $("#history").innerHTML = history.slice(0, 5).map(h => `<li><span>${h.t} · ${h.title}</span><b>${h.p}</b></li>`).join("");
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  let ok = true; const payload = {};
  keys.forEach(k => {
    const el = input(k), v = parseFloat(el.value);
    if (el.value.trim() === "" || Number.isNaN(v) || v < 0) { el.closest(".field").classList.add("bad"); ok = false; }
    else payload[k] = v;
  });
  if (!ok) { document.querySelector(".field.bad input").focus(); return; }

  const btn = $("#submit");
  btn.disabled = true; $(".label", btn).textContent = "Analyzing…"; $(".spin", btn).hidden = false;
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error("Server returned " + res.status);
    const data = await res.json();
    if (data.probability_malignant === undefined) throw new Error("Old API: replace main.py with the updated version.");
    render(data);
    $((window.innerWidth < 900) ? "#result" : "#report").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    idle.hidden = true; out.hidden = false; out.className = "out show r-high";
    $("#badge").textContent = "Connection problem"; $("#verdict").textContent = "Couldn’t get a result";
    $("#detail").textContent = String(err.message).startsWith("Old API") ? err.message : `Check that the API is running at ${API_URL} and that CORS is enabled.`;
    $("#pct").textContent = "!"; $("#arc").style.strokeDashoffset = 327;
  } finally {
    btn.disabled = false; $(".label", btn).textContent = "Run analysis"; $(".spin", btn).hidden = true;
  }
});

// ---- Microscope field: drifting cells with nuclei ----
(() => {
  const c = $("#cells"), x = c.getContext("2d"), W = c.width;
  const cells = Array.from({ length: 22 }, () => ({
    x: Math.random() * W, y: Math.random() * W, r: 26 + Math.random() * 40,
    vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, p: Math.random() * 6
  }));
  function draw(t) {
    x.clearRect(0, 0, W, W);
    cells.forEach(k => {
      k.x = (k.x + k.vx + W) % W; k.y = (k.y + k.vy + W) % W;
      const r = k.r * (1 + Math.sin(t / 1800 + k.p) * .04);
      const g = x.createRadialGradient(k.x, k.y, r * .2, k.x, k.y, r);
      g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(214,69,122,.35)");
      x.beginPath(); x.arc(k.x, k.y, r, 0, 7); x.fillStyle = g; x.fill();
      x.strokeStyle = "rgba(150,40,95,.35)"; x.lineWidth = 2; x.stroke();
      x.beginPath(); x.arc(k.x + r * .1, k.y - r * .05, r * .42, 0, 7);
      x.fillStyle = "rgba(91,42,94,.75)"; x.fill();
    });
    if (!still) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
