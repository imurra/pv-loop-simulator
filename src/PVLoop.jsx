import React, { useState, useMemo, useCallback } from "react";
// ═══════════════════════════════════════════════════════════════════
// PRESSURE–VOLUME LOOP SIMULATOR v4
// CVPhysiology cf025 (independent effects) + cf026 (interdependent)
//
// ESPVR: P = Ees × (V − V0)         contractility boundary
// EDPVR: P = A × (e^(α×V) − 1)     passive compliance
// Ea:    ESP = Ea × (EDV − ESV)      arterial elastance
// ESV  = (Ea×EDV + Ees×V0)/(Ees+Ea)
//
// INDEPENDENT EFFECTS (cf025 — what the sliders model):
//   ↑Preload (EDV):  EDV↑, ESV unchanged, SV↑  (slides along ESPVR)
//   ↑Inotropy (Ees): ESPVR steepens, ESV↓, EDV unchanged, SV↑ (wider)
//   ↑Afterload (Ea): ESP↑, ESV↑, EDV unchanged, SV↓ (taller/narrower)
//   ↑Stiffness (α):  EDPVR shifts up, EDV↓ at same filling pressure (horizontal shift)
//
// BUG FIXES in v4.1:
//   - Slider transition snapshots scenario params (no afterload leak)
//   - Compliance slider shifts EDV horizontally via filling-pressure equivalence
//   - Each slider is truly independent (cf025)
// ═══════════════════════════════════════════════════════════════════

const V0 = 10, A_ED = 0.5, REF_ALPHA = 0.02;

// Compliance-driven EDV: at a given filling pressure (set by slider EDV at ref alpha),
// a stiffer ventricle fills to a smaller volume, a more compliant one fills more.
// This models: same LA pressure → different EDV depending on wall stiffness.
function getEffectiveEDV(sliderEDV, alpha) {
  if (Math.abs(alpha - REF_ALPHA) < 0.001) return sliderEDV;
  const refLVEDP = A_ED * (Math.exp(REF_ALPHA * sliderEDV) - 1);
  if (alpha <= 0.001) return Math.min(sliderEDV * 1.3, 200);
  const edv = Math.log(refLVEDP / A_ED + 1) / alpha;
  return Math.max(50, Math.min(edv, 200));
}

function computeState(Ees, EDV, Ea, alpha) {
  const ESV = (Ea * EDV + Ees * V0) / (Ees + Ea);
  const ESP = Ees * (ESV - V0);
  const SV = EDV - ESV;
  const EF = (SV / EDV) * 100;
  const LVEDP = A_ED * (Math.exp(alpha * EDV) - 1);
  const esvP0 = A_ED * (Math.exp(alpha * ESV) - 1);
  return { EDV, ESV, ESP, SV, EF, LVEDP, esvP0 };
}

// Manual-mode compute: ESP pinned, LVEDP pinned.
// ESV derived from ESPVR at pinned ESP. EDV derived from EDPVR at pinned LVEDP.
function computePinned(Ees, sliderEDV, alpha, refESP, refLVEDP) {
  // Pin LVEDP → derive EDV from EDPVR inverse
  const EDV = Math.max(50, Math.min(Math.log(refLVEDP / A_ED + 1) / alpha, sliderEDV));
  // Pin ESP → derive ESV from ESPVR: ESP = Ees*(ESV-V0) → ESV = ESP/Ees + V0
  const ESV = Math.min(refESP / Ees + V0, EDV - 1);
  const ESP = refESP;
  const SV = EDV - ESV;
  const EF = (SV / EDV) * 100;
  const LVEDP = A_ED * (Math.exp(alpha * EDV) - 1);
  const esvP0 = A_ED * (Math.exp(alpha * ESV) - 1);
  return { EDV, ESV, ESP, SV, EF, LVEDP, esvP0 };
}

function edpvr(V, alpha) { return A_ED * (Math.exp(alpha * V) - 1); }
function espvr(V, Ees) { return Ees * (V - V0); }

// ─── SCENARIOS ───
const SC = {
  normal: {
    label: "Normal", Ees: 2.5, EDV: 120, Ea: 2.0, alpha: 0.02, color: "#58A6FF",
    highlight: null,
    steps: [
      { title: "Baseline", text: "A healthy left ventricle. Two boundary curves control the loop: ESPVR (contractility ceiling) and EDPVR (passive compliance floor). The loop shape emerges from these constraints." },
      { title: "Filling (phase a)", text: "Mitral valve opens → blood flows from left atrium into the ventricle along the EDPVR. Volume rises gently because the normal wall is compliant — filling is easy and pressure stays low." },
      { title: "Systole (b → c → d)", text: "Phase b: all valves closed, pressure builds. Phase c: aortic valve opens, blood is ejected. The top-left corner sits on the ESPVR — the maximum the ventricle can squeeze at that volume. Phase d: pressure falls back down." },
      { title: "Sliding vs. rotating", text: "Preload changes SLIDE the loop along a fixed ESPVR. Contractility changes ROTATE the ESPVR itself. Both can increase Stroke Volume (SV), but through fundamentally different mechanisms. Try the sliders to see this." },
    ]
  },
  hfref: {
    label: "HFrEF", Ees: 1.0, EDV: 180, Ea: 2.2, alpha: 0.02, color: "#F85149",
    highlight: "topleft",
    steps: [
      { title: "The heart muscle weakens", text: "In dilated cardiomyopathy or after a large MI, the ventricle loses contractile force. The ESPVR flattens — the ceiling drops. The ventricle simply cannot squeeze as hard." },
      { title: "Can't empty → volume backs up", text: "Because the ventricle can't empty properly, blood accumulates. The body retains fluid (RAAS activation), pushing the loop rightward. The ventricle dilates." },
      { title: "Filling pressures rise → congestion", text: "More volume in the ventricle means higher diastolic pressure (LVEDP rises). This backs up into the lungs → pulmonary congestion → dyspnea. The Starling mechanism partially compensates Stroke Volume (SV), but at the cost of congestion." },
      { title: "Ejection Fraction (EF) drops", text: "EF falls to ~30%. The loop is wide but flat — lots of volume, poor emptying. Treatment targets: reduce preload (diuretics), reduce afterload (ACE inhibitors), and if possible support contractility." },
    ]
  },
  hfpef: {
    label: "HFpEF", Ees: 3.0, EDV: 105, Ea: 2.2, alpha: 0.035, color: "#F0883E",
    highlight: "bottomright",
    steps: [
      { title: "The wall stiffens", text: "In hypertensive heart disease, aging, or amyloid, the ventricular wall becomes stiff. Think of inflating a stiff balloon — it takes much more pressure to fill the same volume. The EDPVR curve shifts upward." },
      { title: "Filling pressure rises despite less volume", text: "Even though the ventricle fills to a SMALLER volume, diastolic pressure (LVEDP) is much higher. The bottom of the loop rises. This is the opposite of HFrEF — the ventricle is small and stiff, not big and floppy." },
      { title: "Same symptoms, different mechanism", text: "High LVEDP backs up into the lungs → pulmonary congestion → dyspnea. The patient looks identical to HFrEF clinically — but the cause is impaired filling, not impaired contraction." },
      { title: "The diagnostic trap", text: "Ejection Fraction (EF) is preserved (>50%) — the ventricle empties fine, it just can't fill. Echo shows 'normal EF' but diastolic dysfunction (elevated E/e'). This is why HFpEF was historically missed." },
    ]
  },
  as: {
    label: "Aortic Stenosis", Ees: 3.0, EDV: 130, Ea: 3.5, alpha: 0.02, color: "#A371F7",
    highlight: "topright",
    steps: [
      { title: "Fixed obstruction to outflow", text: "A stenotic aortic valve creates a barrier to ejection. The ventricle must generate much higher pressure (afterload/ESP) to push blood through the narrowed opening. The loop grows taller." },
      { title: "Pressure overload → hypertrophy", text: "The ventricle compensates by thickening its walls (concentric hypertrophy) to generate the higher pressures needed. The loop becomes tall and narrow — high afterload (ESP), reduced Stroke Volume (SV)." },
      { title: "High energy cost", text: "A tall, narrow loop means enormous myocardial oxygen demand. The thick wall also has poor subendocardial perfusion → patients develop angina even without coronary artery disease." },
      { title: "Decompensation", text: "Initially Stroke Volume (SV) and Ejection Fraction (EF) are maintained through hypertrophy. But eventually the muscle can't keep up → contractility falls → EF drops → rapid clinical deterioration." },
    ]
  },
  ar: {
    label: "Aortic Regurg", Ees: 2.5, EDV: 180, Ea: 1.5, alpha: 0.018, color: "#D2A8FF",
    highlight: "bottomright",
    steps: [
      { title: "Backward leak during diastole", text: "An incompetent aortic valve lets blood leak backward from the aorta into the ventricle during diastole. The LV fills from TWO sources — the left atrium AND the aorta — so it overfills dramatically." },
      { title: "Volume overload widens the loop", text: "The ventricle dilates to accommodate the extra volume. The loop shifts right and becomes wide. Total Stroke Volume (SV) is very large, but some of it just leaks backward — forward SV to the body is reduced." },
      { title: "Eccentric remodeling", text: "Chronic volume overload causes the ventricle to remodel — it stretches (sarcomeres added in series). The chamber gets bigger but compliance may actually improve initially, keeping filling pressures manageable." },
      { title: "Progressive failure", text: "Over time, the chronic dilation increases wall stress → contractility eventually drops → the ESPVR flattens → Ejection Fraction (EF) falls. By the time EF drops, significant irreversible damage has occurred." },
    ]
  },
  ms: {
    label: "Mitral Stenosis", Ees: 2.5, EDV: 90, Ea: 2.0, alpha: 0.02, color: "#79C0FF",
    highlight: "bottomright",
    steps: [
      { title: "Restricted filling", text: "A stenotic mitral valve limits blood flow from the left atrium into the ventricle. The ventricle receives less blood per beat → it underfills. The loop shrinks and shifts left." },
      { title: "The ventricle itself is normal", text: "Contractility is fine, compliance is fine — the problem is upstream. The ventricle just doesn't get enough blood to work with. Stroke Volume (SV) drops because there's less to eject." },
      { title: "LVEDP is LOW — key point", text: "Unlike most causes of pulmonary congestion, the LV filling pressure is actually low. The ventricle is starved of volume, not overloaded. This distinguishes MS from heart failure on the PV loop." },
      { title: "LA pressure drives the congestion", text: "The pathology is in the left atrium — LA pressure must be very high to force blood through the stenotic valve. LA dilates → atrial fibrillation. Pulmonary congestion comes from LA hypertension, not LV dysfunction." },
    ]
  },
  mr: {
    label: "Mitral Regurg", Ees: 2.5, EDV: 160, Ea: 1.2, alpha: 0.02, color: "#3FB950",
    highlight: "topleft",
    steps: [
      { title: "Backward leak during systole", text: "An incompetent mitral valve lets blood regurgitate from the ventricle back into the left atrium during contraction. This creates a low-resistance escape route — the ventricle can empty more easily." },
      { title: "Afterload (ESP) drops", text: "Because part of the ejection goes into the low-pressure LA, the effective afterload is reduced. The ventricle doesn't have to generate as much pressure to empty. The top of the loop drops." },
      { title: "Volume overload from regurgitant return", text: "The leaked blood returns from the LA next beat, increasing filling volume. The loop shifts right and widens. Total Stroke Volume (SV) is high, but forward SV is reduced." },
      { title: "The Ejection Fraction (EF) trap", text: "EF appears supranormal (>60%) because of the low-resistance unloading. But this is misleading — in severe MR, an EF of 60% actually indicates the ventricle is already failing. Guidelines trigger surgery at EF <60%." },
    ]
  },
  hemorrhage: {
    label: "Hemorrhage", Ees: 2.8, EDV: 85, Ea: 2.5, alpha: 0.02, color: "#D29922",
    highlight: "bottomright",
    steps: [
      { title: "Acute blood loss", text: "Blood loss reduces circulating volume → less venous return → the ventricle fills less. The loop slides left and shrinks. This is primarily a preload problem." },
      { title: "Sympathetic compensation kicks in", text: "Baroreceptors detect falling pressure → sympathetic activation → heart rate increases, contractility improves slightly, and peripheral vessels constrict to maintain blood pressure." },
      { title: "Smaller loop, lower Stroke Volume (SV)", text: "Despite compensation, SV drops significantly. The loop is small and shifted left. The ventricle is working fine — it just doesn't have enough blood to pump." },
      { title: "Tachycardia is the early sign", text: "Cardiac output = SV × heart rate. With reduced SV, heart rate must rise to maintain output. Tachycardia appears BEFORE hypotension — by the time blood pressure drops, >30% of blood volume is lost." },
    ]
  },
  fluid: {
    label: "IV Fluid", Ees: 2.5, EDV: 150, Ea: 2.0, alpha: 0.02, color: "#1F6FEB",
    highlight: "bottomright",
    steps: [
      { title: "Volume expansion", text: "IV fluid increases circulating volume → more venous return → the ventricle fills more. The loop slides right along the same ESPVR. Contractility and afterload don't change — this is a pure preload effect." },
      { title: "Starling mechanism increases SV", text: "Greater filling stretch → more forceful contraction → Stroke Volume (SV) increases. The loop gets wider. The right side shifts right while the left side barely moves." },
      { title: "Preload vs. inotropy distinction", text: "Compare with inotropes: fluid shifts the RIGHT side of the loop (more filling). Inotropes shift the LEFT side (better emptying). Both increase SV, but by moving opposite sides of the loop." },
      { title: "Fluid responsiveness has limits", text: "On the steep part of the compliance curve, fluid helps. But past a certain point, more fluid just raises filling pressure without increasing SV → pulmonary edema. This is why passive leg raise and SVV testing matter." },
    ]
  },
  inotrope: {
    label: "Inotrope", Ees: 4.0, EDV: 120, Ea: 2.0, alpha: 0.02, color: "#BC8CFF",
    highlight: "topleft",
    steps: [
      { title: "Contractility increases", text: "Dobutamine (β1 agonist) strengthens contraction. The ESPVR rotates upward — the contractile ceiling rises. The ventricle can now squeeze more completely at any given volume." },
      { title: "Better emptying → wider loop", text: "The ventricle empties more completely → the left side of the loop shifts left. Filling volume stays roughly the same. Stroke Volume (SV) increases because the loop gets WIDER, not just shifted." },
      { title: "Compare: preload vs. contractility", text: "IV Fluid: right side shifts right (more filling), left side stays → wider. Inotrope: left side shifts left (better emptying), right side stays → wider. Both increase SV by moving OPPOSITE sides of the loop." },
      { title: "Clinical tradeoff", text: "Ejection Fraction (EF) improves. But inotropes increase myocardial oxygen demand and arrhythmia risk. They're a bridge — to surgery, recovery, or a ventricular assist device — not a long-term solution." },
    ]
  },
};

const NORM = SC.normal;
const normSt = computeState(NORM.Ees, NORM.EDV, NORM.Ea, NORM.alpha);

// ─── SVG ───
const W = 540, H = 420;
const PD = { t: 22, r: 22, b: 52, l: 56 };
const GW = W - PD.l - PD.r, GH = H - PD.t - PD.b;
const VMAX = 220, PMAX = 240;

function vX(v) { return PD.l + (v / VMAX) * GW; }
function pY(p) { return PD.t + GH - (Math.max(0, Math.min(p, PMAX)) / PMAX) * GH; }

// ORIGINAL v1 loop generation — restored exactly
function makeLoop(st, Ees, alpha) {
  const { EDV, ESV, ESP, LVEDP, esvP0 } = st;
  const pts = [];
  // Phase a: diastolic filling along EDPVR
  for (let i = 0; i <= 20; i++) {
    const v = ESV + (EDV - ESV) * (i / 20);
    const p = edpvr(v, alpha);
    pts.push([v, Math.min(p, 60)]);
  }
  // Phase b: isovolumetric contraction
  for (let i = 0; i <= 12; i++) {
    const f = i / 12;
    const p = Math.min(LVEDP, 60) + (ESP - Math.min(LVEDP, 60)) * f;
    pts.push([EDV, p]);
  }
  // Phase c: ejection — slight arc above ESP, respecting ESPVR
  for (let i = 0; i <= 20; i++) {
    const f = i / 20;
    const v = EDV - (EDV - ESV) * f;
    const straightP = ESP;
    const peakBow = 8;
    const bow = peakBow * Math.sin(f * Math.PI);
    const espvrAtV = espvr(v, Ees);
    const p = Math.min(straightP + bow, espvrAtV + 5);
    pts.push([v, Math.max(p, ESP - 15)]);
  }
  // Phase d: isovolumetric relaxation
  for (let i = 0; i <= 12; i++) {
    const f = i / 12;
    const p = ESP - (ESP - Math.min(esvP0, 30)) * f;
    pts.push([ESV, p]);
  }
  return pts.map(([v, p]) => `${vX(v).toFixed(1)},${pY(p).toFixed(1)}`).join(" ");
}

function makeCurve(type, param) {
  const pts = [];
  for (let v = (type === "espvr" ? V0 : 0); v <= 210; v += 2) {
    const p = type === "espvr" ? espvr(v, param) : edpvr(v, param);
    if (p > PMAX + 10) break;
    if (type === "edpvr" && p > 65) break; // cap display
    pts.push(`${vX(v).toFixed(1)},${pY(p).toFixed(1)}`);
  }
  return pts.join(" ");
}

function D({ val, ref: r }) {
  const d = val - r;
  if (Math.abs(d) < 0.5) return null;
  return <span style={{ fontSize: 9, marginLeft: 2, color: d > 0 ? "#F85149" : "#58A6FF", fontWeight: 800 }}>{d > 0 ? "▲" : "▼"}</span>;
}

function getHL(key, pv) {
  if (!key) return null;
  const m = {
    topleft: { cx: vX(pv.ESV), cy: pY(pv.ESP), label: "End-systolic point" },
    bottomright: { cx: vX(pv.EDV), cy: pY(Math.min(pv.LVEDP, 50)), label: "Preload (EDV)" },
    topright: { cx: vX(pv.EDV), cy: pY(pv.ESP), label: "Peak pressure" },
  };
  return m[key] || null;
}

// ═══════════ COMPONENT ═══════════
export default function PVLoop() {
  const [scKey, setScKey] = useState("normal");
  const [step, setStep] = useState(0);
  const [sl, setSl] = useState({ Ees: 2.5, EDV: 120, Ea: 2.0, alpha: 0.02, _eaMoved: false });
  const [mode, setMode] = useState("scenario");

  const sc = SC[scKey];
  // Manual mode: ESP and LVEDP pinned at normal values for Ees/EDV/alpha sliders.
  // Only the Ea slider lets ESP float.
  const pv = useMemo(() => {
    if (mode === "scenario") return computeState(sc.Ees, sc.EDV, sc.Ea, sc.alpha);
    if (sl._eaMoved) return computeState(sl.Ees, sl.EDV, sl.Ea, sl.alpha);
    return computePinned(sl.Ees, sl.EDV, sl.alpha, normSt.ESP, normSt.LVEDP);
  }, [mode, sc, sl, normSt.ESP, normSt.LVEDP]);
  const pm = mode === "scenario" ? sc : { Ees: sl.Ees, EDV: pv.EDV, Ea: sl.Ea, alpha: sl.alpha };

  const loop = useMemo(() => makeLoop(pv, pm.Ees, pm.alpha), [pv, pm.Ees, pm.alpha]);
  const nLoop = useMemo(() => makeLoop(normSt, NORM.Ees, NORM.alpha), []);
  const espL = useMemo(() => makeCurve("espvr", pm.Ees), [pm.Ees]);
  const edpL = useMemo(() => makeCurve("edpvr", pm.alpha), [pm.alpha]);
  const nEspL = useMemo(() => makeCurve("espvr", NORM.Ees), []);
  const nEdpL = useMemo(() => makeCurve("edpvr", NORM.alpha), []);

  const col = mode === "scenario" ? sc.color : "#58A6FF";
  const showRef = mode === "scenario" ? scKey !== "normal" : true;
  const steps = sc.steps;
  const nSteps = steps.length;
  const hl = mode === "scenario" ? getHL(sc.highlight, pv) : null;

  const pickSc = useCallback((k) => { setScKey(k); setStep(0); setMode("scenario"); }, []);
  
  const slide = useCallback((k, v) => {
    if (mode === "scenario") {
      const snap = SC[scKey];
      setSl({ Ees: snap.Ees, EDV: snap.EDV, Ea: snap.Ea, alpha: snap.alpha, _eaMoved: k === "Ea", [k]: v });
    } else {
      setSl(prev => ({ ...prev, _eaMoved: k === "Ea" ? true : prev._eaMoved, [k]: v }));
    }
    setMode("manual");
  }, [mode, scKey]);

  const vTicks = [0, 50, 100, 150, 200];
  const pTicks = [0, 50, 100, 150, 200];
  const dispLVEDP = Math.min(pv.LVEDP, 50);

  const groups = [
    { label: "Conditions", keys: ["normal", "hfref", "hfpef"] },
    { label: "Valvular", keys: ["as", "ar", "ms", "mr"] },
    { label: "Acute", keys: ["hemorrhage", "fluid", "inotrope"] },
  ];

  return (
    <div style={{ background: "#0D1117", color: "#C9D1D9", minHeight: "100vh", fontFamily: "'JetBrains Mono','SF Mono','Fira Code',monospace", padding: "8px 8px 20px" }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: "#E6EDF3", margin: 0, letterSpacing: 1.5, textTransform: "uppercase" }}>Pressure–Volume Loop</h1>
          <div style={{ fontSize: 9, color: "#484F58", marginTop: 2 }}>ESPVR & EDPVR control the boundaries · The loop is emergent</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
          {groups.map(g => (
            <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 8, color: "#484F58", width: 62, textAlign: "right", flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>{g.label}</span>
              {g.keys.map(k => {
                const s = SC[k]; const on = scKey === k && mode === "scenario";
                return <button key={k} onClick={() => pickSc(k)} style={{
                  padding: "3px 9px", fontSize: 10, fontWeight: on ? 700 : 400,
                  background: on ? s.color + "20" : "transparent", color: on ? s.color : "#6E7681",
                  border: `1px solid ${on ? s.color + "55" : "#21262D"}`,
                  borderRadius: 3, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                }}>{s.label}</button>;
              })}
            </div>
          ))}
        </div>

        {/* SVG */}
        <div style={{ background: "#0D1117", border: "1px solid #21262D", borderRadius: 6, padding: 4, position: "relative" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
            {vTicks.map(v => <line key={`vg${v}`} x1={vX(v)} y1={PD.t} x2={vX(v)} y2={PD.t + GH} stroke="#161B22" strokeWidth={1} />)}
            {pTicks.map(p => <line key={`pg${p}`} x1={PD.l} y1={pY(p)} x2={PD.l + GW} y2={pY(p)} stroke="#161B22" strokeWidth={1} />)}
            <line x1={PD.l} y1={PD.t} x2={PD.l} y2={PD.t + GH} stroke="#30363D" strokeWidth={1.5} />
            <line x1={PD.l} y1={PD.t + GH} x2={PD.l + GW} y2={PD.t + GH} stroke="#30363D" strokeWidth={1.5} />
            {vTicks.map(v => <text key={`vl${v}`} x={vX(v)} y={PD.t + GH + 16} textAnchor="middle" fill="#484F58" fontSize={10} fontFamily="inherit">{v}</text>)}
            {pTicks.map(p => <text key={`pl${p}`} x={PD.l - 8} y={pY(p) + 4} textAnchor="end" fill="#484F58" fontSize={10} fontFamily="inherit">{p}</text>)}
            <text x={PD.l + GW / 2} y={H - 4} textAnchor="middle" fill="#6E7681" fontSize={11} fontFamily="inherit">Volume (mL)</text>
            <text x={14} y={PD.t + GH / 2} textAnchor="middle" fill="#6E7681" fontSize={11} fontFamily="inherit" transform={`rotate(-90,14,${PD.t + GH / 2})`}>Pressure (mmHg)</text>

            {/* Normal reference — prominent so pathology comparison is clear */}
            {showRef && <>
              <polyline points={nEspL} fill="none" stroke="#8B949E" strokeWidth={1.2} strokeDasharray="5,3" opacity={0.5} />
              <polyline points={nEdpL} fill="none" stroke="#8B949E" strokeWidth={1.2} strokeDasharray="5,3" opacity={0.5} />
              <polygon points={nLoop} fill="#8B949E" fillOpacity={0.06} stroke="#8B949E" strokeWidth={1.8} strokeDasharray="4,3" opacity={0.55} />
              <text x={vX(normSt.EDV) + 5} y={pY(normSt.ESP) + 14} fill="#8B949E" fontSize={10} fontFamily="inherit" fontWeight={600} opacity={0.7}>Normal</text>
            </>}

            {/* Active ESPVR & EDPVR */}
            <polyline points={espL} fill="none" stroke={col} strokeWidth={1.5} opacity={0.45} strokeDasharray="6,3" />
            <polyline points={edpL} fill="none" stroke={col} strokeWidth={1.5} opacity={0.45} strokeDasharray="6,3" />

            {/* Curve labels */}
            {(() => { const lv = V0 + Math.min(90 / pm.Ees, 45), lp = espvr(lv, pm.Ees); return lp > 10 && lp < PMAX - 20 ? <text x={vX(lv) + 3} y={pY(lp) - 5} fill={col} fontSize={9} opacity={0.6} fontFamily="inherit" fontWeight={600}>ESPVR</text> : null; })()}
            {(() => { let v2 = 170, p2 = edpvr(v2, pm.alpha); if (p2 > 50) { v2 = 140; p2 = edpvr(v2, pm.alpha); } if (p2 > 50) { v2 = 110; p2 = edpvr(v2, pm.alpha); } return p2 > 1 && p2 < 60 ? <text x={vX(v2) + 3} y={pY(p2) - 5} fill={col} fontSize={9} opacity={0.6} fontFamily="inherit" fontWeight={600}>EDPVR</text> : null; })()}

            {/* Ea line */}
            <line x1={vX(pv.EDV)} y1={pY(0)} x2={vX(pv.ESV)} y2={pY(pv.ESP)} stroke="#E3B341" strokeWidth={1.2} strokeDasharray="3,3" opacity={0.5} />
            <text x={vX(pv.EDV) + 4} y={pY(2)} fill="#E3B341" fontSize={8} opacity={0.55} fontFamily="inherit">Ea</text>

            {/* PV loop */}
            <polygon points={loop} fill={col} fillOpacity={0.1} stroke={col} strokeWidth={2.2} strokeLinejoin="round" />

            {/* Corner dots */}
            <circle cx={vX(pv.EDV)} cy={pY(Math.min(pv.LVEDP, 50))} r={3} fill={col} opacity={0.7} />
            <circle cx={vX(pv.ESV)} cy={pY(pv.ESP)} r={3} fill={col} opacity={0.7} />
            <circle cx={vX(pv.EDV)} cy={pY(pv.ESP)} r={3} fill={col} opacity={0.4} />
            <circle cx={vX(pv.ESV)} cy={pY(Math.min(pv.esvP0, 30))} r={3} fill={col} opacity={0.4} />

            {/* Phase labels */}
            <text x={vX(pv.EDV) + 7} y={pY((Math.min(pv.LVEDP, 50) + pv.ESP) / 2)} fill="#6E7681" fontSize={9} fontFamily="inherit" fontWeight={600}>b</text>
            <text x={vX((pv.EDV + pv.ESV) / 2)} y={pY(pv.ESP) - 7} fill="#6E7681" fontSize={9} textAnchor="middle" fontFamily="inherit" fontWeight={600}>c</text>
            <text x={vX(pv.ESV) - 8} y={pY((pv.ESP + Math.min(pv.esvP0, 30)) / 2)} fill="#6E7681" fontSize={9} textAnchor="end" fontFamily="inherit" fontWeight={600}>d</text>
            <text x={vX((pv.EDV + pv.ESV) / 2)} y={pY(Math.min(edpvr((pv.EDV + pv.ESV) / 2, pm.alpha), 50)) + 15} fill="#6E7681" fontSize={9} textAnchor="middle" fontFamily="inherit" fontWeight={600}>a</text>

            {/* SV bracket */}
            <line x1={vX(pv.ESV)} y1={pY(-8)} x2={vX(pv.EDV)} y2={pY(-8)} stroke={col} strokeWidth={1} opacity={0.5} />
            <text x={vX((pv.ESV + pv.EDV) / 2)} y={pY(-16)} fill={col} fontSize={9} textAnchor="middle" fontFamily="inherit" opacity={0.65}>SV = {Math.round(pv.SV)} mL</text>

            {/* Yellow highlight */}
            {hl && <>
              <circle cx={hl.cx} cy={hl.cy} r={14} fill="none" stroke="#E3B341" strokeWidth={2.5} opacity={0.85}>
                <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
              </circle>
              <text x={hl.cx} y={hl.cy - 20} fill="#E3B341" fontSize={8} textAnchor="middle" fontFamily="inherit" fontWeight={600}>{hl.label}</text>
            </>}
          </svg>
          <div style={{ position: "absolute", top: 8, right: 10, fontSize: 8, color: "#30363D", lineHeight: 1.6 }}>
            <div>a = filling · b = isovolum. contraction</div>
            <div>c = ejection · d = isovolum. relaxation</div>
          </div>
        </div>

        {/* Readouts */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 3, margin: "6px 0", padding: "6px", background: "#161B22", borderRadius: 4, border: "1px solid #21262D" }}>
          {[
            { l: "EDV", v: pv.EDV, u: "mL", r: normSt.EDV },
            { l: "LVEDP", v: dispLVEDP, u: "mmHg", r: normSt.LVEDP },
            { l: "ESV", v: pv.ESV, u: "mL", r: normSt.ESV },
            { l: "Afterload", v: pv.ESP, u: "mmHg", r: normSt.ESP },
            { l: "Stroke Vol", v: pv.SV, u: "mL", r: normSt.SV },
            { l: "Ejection Fr", v: pv.EF, u: "%", r: normSt.EF },
          ].map(({ l, v, u, r }) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 7, color: "#484F58", textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E6EDF3" }}>
                {v >= 100 ? Math.round(v) : Number(v).toFixed(1)}<D val={v} ref={r} />
              </div>
              <div style={{ fontSize: 7, color: "#30363D" }}>{u}</div>
            </div>
          ))}
        </div>

        {/* Sliders */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, margin: "4px 0", padding: "8px", background: "#161B22", borderRadius: 4, border: "1px solid #21262D" }}>
          {[
            { key: "Ees", label: "Contractility (Ees)", min: 0.5, max: 5, step: 0.1 },
            { key: "EDV", label: "Preload (EDV)", min: 60, max: 180, step: 2 },
            { key: "Ea", label: "Afterload (Ea)", min: 0.5, max: 4, step: 0.1 },
            { key: "alpha", label: "Compliance (α)", min: 0.005, max: 0.04, step: 0.001 },
          ].map(({ key, label, min, max, step: s }) => {
            const val = mode === "scenario" ? (sc[key] ?? NORM[key]) : sl[key];
            return (
              <div key={key}>
                <div style={{ fontSize: 8, color: "#8B949E", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
                <input type="range" min={min} max={max} step={s} value={val}
                  onChange={e => slide(key, parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: col, height: 4 }} />
                <div style={{ fontSize: 10, color: "#E6EDF3", fontWeight: 600, textAlign: "center" }}>
                  {key === "alpha" ? val.toFixed(3) : Number(val).toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Teaching steps */}
        {steps && mode === "scenario" && (
          <div style={{ background: "#161B22", border: `1px solid ${col}22`, borderRadius: 4, padding: "10px 12px", marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: col }}>
                {sc.label}{scKey !== "normal" ? " — Mechanism" : " — How It Works"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={{
                  padding: "2px 10px", fontSize: 11, fontWeight: 600,
                  background: step === 0 ? "#0D1117" : col + "18", color: step === 0 ? "#30363D" : col,
                  border: `1px solid ${step === 0 ? "#21262D" : col + "44"}`,
                  borderRadius: 3, cursor: step === 0 ? "default" : "pointer", fontFamily: "inherit",
                }}>← Prev</button>
                <span style={{ fontSize: 10, color: "#6E7681", minWidth: 32, textAlign: "center" }}>{step + 1}/{nSteps}</span>
                <button onClick={() => setStep(s => Math.min(nSteps - 1, s + 1))} disabled={step === nSteps - 1} style={{
                  padding: "2px 10px", fontSize: 11, fontWeight: 600,
                  background: step === nSteps - 1 ? "#0D1117" : col + "18", color: step === nSteps - 1 ? "#30363D" : col,
                  border: `1px solid ${step === nSteps - 1 ? "#21262D" : col + "44"}`,
                  borderRadius: 3, cursor: step === nSteps - 1 ? "default" : "pointer", fontFamily: "inherit",
                }}>Next →</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {steps.map((_, i) => (
                <div key={i} onClick={() => setStep(i)} style={{
                  flex: 1, height: 3, borderRadius: 2, cursor: "pointer",
                  background: i <= step ? col : "#21262D", transition: "background 0.2s",
                }} />
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E6EDF3", marginBottom: 4 }}>{steps[step].title}</div>
            <div style={{ fontSize: 11, color: "#8B949E", lineHeight: 1.7, minHeight: 48 }}>{steps[step].text}</div>
          </div>
        )}

        {mode === "manual" && (
          <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 4, padding: "8px 12px", marginTop: 6, fontSize: 10, color: "#6E7681", lineHeight: 1.6 }}>
            <strong style={{ color: "#E6EDF3" }}>Manual mode — independent effects (cf025)</strong><br />
            Afterload (Ea) is held at 2.0 unless you move the Ea slider. ESP stays ~120 mmHg.<br />
            • <strong style={{ color: "#BC8CFF" }}>Ees</strong>: rotates ESPVR → left side of loop moves (ESV changes), right side stays<br />
            • <strong style={{ color: "#1F6FEB" }}>EDV</strong>: slides along same ESPVR → right side moves, left side stays<br />
            • <strong style={{ color: "#A371F7" }}>Ea</strong>: changes afterload → ESP rises/falls, ESV changes<br />
            • <strong style={{ color: "#F0883E" }}>α</strong>: compliance — stiffer wall fills to smaller EDV at same filling pressure
          </div>
        )}

        <div style={{ fontSize: 7, color: "#21262D", textAlign: "center", marginTop: 8 }}>Dr. Ian Murray · CC BY-NC-SA · Sagawa/Suga · CVPhysiology cf025/cf026</div>
      </div>
    </div>
  );
}
