// Copyright (c) 2026 Ian V.J. Murray. Licensed under CC BY-NC-ND 4.0 (citation
// required, non-commercial use only, no modified versions). See LICENSE.
// ═══════════════════════════════════════════════════════════════════
// PRESSURE–VOLUME LOOP MODEL v5 — one set of equations for everything
//
// Every scenario is just a set of slider positions, and every slider
// runs through the same computeState(). There is no "which slider moved
// last" logic, so the loop never jumps and the result never depends on
// the order in which sliders were touched.
//
// ESPVR:  P = Ees × (V − V0)              contractility ceiling (Sagawa/Suga)
// EDPVR:  P = A × (e^(α·V) − 1)           passive filling curve
// Ea:     ESP = Ea × SV                    afterload (arterial elastance)
// ⇒ ESV = (Ea·EDV + Ees·V0) / (Ees + Ea)
//
// Compliance: the slider is a compliance multiplier (right = more compliant);
// α = REF_ALPHA / compliance. v4 kept the filling pressure fixed when the
// wall stiffened (EDV fell, LVEDP unchanged); the scenarios kept volume
// fixed (LVEDP rose, EDV unchanged). v5 keeps v4's intent that a stiffer
// wall fills less, but splits the difference geometrically, so a stiffer
// wall fills to a smaller volume AND at a higher pressure — both of which
// a stiff ventricle shows.
// ═══════════════════════════════════════════════════════════════════

export const V0 = 10;
export const A_ED = 0.5;
export const REF_ALPHA = 0.02;

export const SLIDERS = [
  { key: "Ees", label: "Contractility (Ees)", min: 0.5, max: 5, step: 0.1, fmt: (v) => v.toFixed(1) },
  { key: "fill", label: "Preload (filling)", min: 60, max: 220, step: 2, fmt: (v) => `${Math.round(v)}` },
  { key: "Ea", label: "Afterload (Ea)", min: 0.5, max: 4, step: 0.05, fmt: (v) => v.toFixed(1) },
  { key: "comp", label: "Compliance", min: 0.5, max: 2, step: 0.05, fmt: (v) => `×${v.toFixed(2)}` },
];

// Aortic valve opening pressure as a fraction of ESP (aortic diastolic
// pressure). Wide pulse pressure in AR; in AS the LV peak towers above a
// near-normal aortic diastolic pressure.
const OPEN_FRACTION = { none: 0.72, ar: 0.45, as: 0.42, mr: 0.72 };
// Peak systolic LV pressure control point (×ESP) for the ejection arc.
const PEAK_FACTOR = { none: 1.3, ar: 1.35, as: 1.4, mr: 1.25 };
// Fraction of SV that leaks during the "isovolumetric" phases.
const LEAK = { mr: 0.2, ar: 0.18 };

export const alphaOf = (comp) => REF_ALPHA / comp;
export const edpvr = (V, alpha) => A_ED * (Math.exp(alpha * V) - 1);
export const espvr = (V, Ees) => Ees * (V - V0);
const edpvrInv = (P, alpha) => Math.log(P / A_ED + 1) / alpha;

// Filling volume reached by this wall, given the preload slider (the
// volume a normally compliant wall would reach under the same conditions).
export function fillVolume(fill, comp) {
  if (Math.abs(comp - 1) < 1e-9) return fill;
  const alpha = alphaOf(comp);
  const pFill = edpvr(fill, REF_ALPHA); // filling pressure for a normal wall
  const edvSamePressure = edpvrInv(pFill, alpha);
  return Math.sqrt(fill * edvSamePressure);
}

export function computeState(p) {
  const lesion = p.lesion || "none";
  const alpha = alphaOf(p.comp);
  const EDV = fillVolume(p.fill, p.comp);
  const ESV = (p.Ea * EDV + p.Ees * V0) / (p.Ees + p.Ea);
  const ESP = espvr(ESV, p.Ees);
  const SV = EDV - ESV;
  const EF = (SV / EDV) * 100;
  const LVEDP = edpvr(EDV, alpha);
  const Popen = OPEN_FRACTION[lesion] * ESP;
  const leakB = lesion === "mr" ? LEAK.mr * SV : 0;
  const leakD = lesion === "ar" ? LEAK.ar * SV : 0;
  const Pc = PEAK_FACTOR[lesion] * ESP;
  // Peak of the quadratic Bézier ejection arc (clipped to ESPVR later)
  let Ppeak = 0, Vpeak = EDV;
  const vStart = EDV - leakB;
  for (let i = 0; i <= 60; i++) {
    const f = i / 60;
    const v = vStart - (vStart - ESV) * f;
    const pp = Math.min((1 - f) ** 2 * Popen + 2 * f * (1 - f) * Pc + f * f * ESP, espvr(v, p.Ees));
    if (pp > Ppeak) { Ppeak = pp; Vpeak = v; }
  }
  return { EDV, ESV, ESP, SV, EF, LVEDP, alpha, Popen, Ppeak, Vpeak, leakB, leakD, Pc, lesion, Ees: p.Ees, Ea: p.Ea };
}

// ─── Physiological limits ───
// Each returns a plain-language reason when violated. Every limit is
// monotonic in every slider, so along any one slider the allowed range is
// a single interval and the slider can simply stop at its edge.
export const LIMITS = [
  { id: "dilation", test: (s) => s.EDV <= 230, why: "Filling volume would pass ~230 mL — beyond how far the ventricle can stretch." },
  { id: "edema", test: (s) => s.LVEDP <= 35, why: "Filling pressure would pass 35 mmHg — far past the point where fluid floods the lungs." },
  { id: "inverted", test: (s) => s.LVEDP <= s.Popen - 5, why: "Filling pressure would reach the pressure that opens the aortic valve — the loop would fold over on itself." },
  { id: "lowSV", test: (s) => s.SV >= 20, why: "Stroke volume would fall below 20 mL — too little to sustain the circulation." },
  { id: "highEF", test: (s) => s.EF <= 80, why: "Ejection fraction would exceed 80% — no ventricle empties that completely." },
  { id: "lowESP", test: (s) => s.ESP >= 50, why: "End-systolic pressure would fall below 50 mmHg — circulatory collapse." },
  { id: "highESP", test: (s) => s.ESP <= 230, why: "End-systolic pressure would pass 230 mmHg — beyond what the ventricle can generate." },
];

export function violations(state) {
  return LIMITS.filter((l) => !(l.test(state) && Number.isFinite(state.EDV) && Number.isFinite(state.ESP)));
}
export const isValid = (params) => violations(computeState(params)).length === 0;

// Move one slider toward a target. If the target is impossible, stop at the
// last allowed slider step between the current value and the target and
// report why. `params` must itself be valid.
export function moveSlider(params, key, target) {
  const def = SLIDERS.find((s) => s.key === key);
  target = Math.min(def.max, Math.max(def.min, target));
  const cand = { ...params, [key]: target };
  const vs = violations(computeState(cand));
  if (vs.length === 0) return { params: cand, blocked: null };
  let lo = params[key], hi = target; // lo valid, hi invalid
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (isValid({ ...params, [key]: mid })) lo = mid; else hi = mid;
  }
  // snap to the slider grid, toward the current (valid) value
  const dir = Math.sign(target - params[key]);
  const steps = (lo - def.min) / def.step;
  let snapped = def.min + (dir > 0 ? Math.floor(steps + 1e-9) : Math.ceil(steps - 1e-9)) * def.step;
  snapped = +snapped.toFixed(4);
  if ((dir > 0 && snapped < params[key]) || (dir < 0 && snapped > params[key]) || !isValid({ ...params, [key]: snapped })) {
    snapped = params[key];
  }
  return { params: { ...params, [key]: snapped }, blocked: { key, reason: vs[0].why, id: vs[0].id } };
}

// ─── Loop geometry ───
// Returns [[V, P, phase], ...]. Phases: a filling, b isovolumetric
// contraction, c ejection, d isovolumetric relaxation.
export function loopPoints(s) {
  const pts = [];
  const vFillStart = s.ESV + s.leakD;
  const vEjectStart = s.EDV - s.leakB;
  const pFillStart = edpvr(vFillStart, s.alpha);
  for (let i = 0; i <= 24; i++) {
    const v = vFillStart + (s.EDV - vFillStart) * (i / 24);
    pts.push([v, edpvr(v, s.alpha), "a"]);
  }
  for (let i = 1; i <= 12; i++) {
    const f = i / 12;
    // MR: volume escapes to the LA before the aortic valve opens
    pts.push([s.EDV - s.leakB * f, s.LVEDP + (s.Popen - s.LVEDP) * f, "b"]);
  }
  for (let i = 1; i <= 30; i++) {
    const f = i / 30;
    const v = vEjectStart - (vEjectStart - s.ESV) * f;
    const p = (1 - f) ** 2 * s.Popen + 2 * f * (1 - f) * s.Pc + f * f * s.ESP;
    pts.push([v, Math.min(p, espvr(v, s.Ees)), "c"]);
  }
  for (let i = 1; i <= 12; i++) {
    const f = i / 12;
    // AR: the aorta refills the LV before the mitral valve opens
    pts.push([s.ESV + s.leakD * f, s.ESP - (s.ESP - pFillStart) * f, "d"]);
  }
  return pts;
}

// ─── Scenarios = slider positions ───
export const NORMAL = { Ees: 2.5, fill: 120, Ea: 1.6, comp: 1, lesion: null };

export const SC = {
  normal: { label: "Normal", params: NORMAL, color: "#58A6FF", highlight: null },
  hfref: { label: "HFrEF", params: { Ees: 1.0, fill: 180, Ea: 2.0, comp: 1, lesion: null }, color: "#F85149", highlight: "topleft" },
  hfpef: { label: "HFpEF", params: { Ees: 3.0, fill: 146, Ea: 2.2, comp: 0.6, lesion: null }, color: "#F0883E", highlight: "bottomright" },
  as: { label: "Aortic Stenosis", params: { Ees: 4.5, fill: 136, Ea: 3.5, comp: 0.75, lesion: "as" }, color: "#A371F7", highlight: "topright" },
  ar: { label: "Aortic Regurg", params: { Ees: 2.5, fill: 176, Ea: 1.3, comp: 1.25, lesion: "ar" }, color: "#D2A8FF", highlight: "relax" },
  ms: { label: "Mitral Stenosis", params: { Ees: 2.5, fill: 84, Ea: 1.6, comp: 1, lesion: null }, color: "#79C0FF", highlight: "bottomright" },
  mr: { label: "Mitral Regurg", params: { Ees: 2.5, fill: 160, Ea: 0.8, comp: 1, lesion: "mr" }, color: "#3FB950", highlight: "contract" },
  hemorrhage: { label: "Hemorrhage", params: { Ees: 3.0, fill: 80, Ea: 2.2, comp: 1, lesion: null }, color: "#D29922", highlight: "bottomright" },
  fluid: { label: "IV Fluid", params: { Ees: 2.5, fill: 150, Ea: 1.6, comp: 1, lesion: null }, color: "#1F6FEB", highlight: "bottomright" },
  inotrope: { label: "Inotrope", params: { Ees: 4.0, fill: 120, Ea: 1.6, comp: 1, lesion: null }, color: "#BC8CFF", highlight: "topleft" },
};
