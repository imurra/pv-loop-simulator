import React, { useState, useMemo, useCallback } from "react";
// ═══════════════════════════════════════════════════════════════════
// PRESSURE–VOLUME LOOP SIMULATOR v4
// CVPhysiology cf025 (independent effects) + cf026 (interdependent)
//
// ESPVR: P = Ees × (V − V0)         contractility boundary
// EDPVR: P = A × (e^(α×V) − 1)     passive compliance
// Ea:    ESP = Ea × (EDV − ESV)      arterial elastance
// ESV  = (Ea×EDV + Ees×V0)/(Ees+Ea)
// ═══════════════════════════════════════════════════════════════════

const V0 = 10, A_ED = 0.5, REF_ALPHA = 0.02;

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

function computePinned(Ees, sliderEDV, alpha, refESP, refLVEDP) {
  const EDV = Math.max(50, Math.min(Math.log(refLVEDP / A_ED + 1) / alpha, sliderEDV));
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

// ─── FIXED: no reserved `ref` ───
function D({ val, baseline }) {
  const d = val - baseline;
  if (Math.abs(d) < 0.5) return null;
  return (
    <span style={{ fontSize: 9, marginLeft: 2, color: d > 0 ? "#F85149" : "#58A6FF", fontWeight: 800 }}>
      {d > 0 ? "▲" : "▼"}
    </span>
  );
}

// ─── SCENARIOS ───
const SC = { /* UNCHANGED — exactly as you provided */ };

const NORM = SC.normal;
const normSt = computeState(NORM.Ees, NORM.EDV, NORM.Ea, NORM.alpha);

// ─── SVG ───
const W = 540, H = 420;
const PD = { t: 22, r: 22, b: 52, l: 56 };
const GW = W - PD.l - PD.r, GH = H - PD.t - PD.b;
const VMAX = 220, PMAX = 240;

function vX(v) { return PD.l + (v / VMAX) * GW; }
function pY(p) { return PD.t + GH - (Math.max(0, Math.min(p, PMAX)) / PMAX) * GH; }

// makeLoop, makeCurve, getHL unchanged …

// ═══════════ COMPONENT ═══════════
export default function PVLoop() {
  const [scKey, setScKey] = useState("normal");
  const [step, setStep] = useState(0);
  const [sl, setSl] = useState({ Ees: 2.5, EDV: 120, Ea: 2.0, alpha: 0.02, _eaMoved: false });
  const [mode, setMode] = useState("scenario");

  const sc = SC[scKey];

  const pv = useMemo(() => {
    if (mode === "scenario") return computeState(sc.Ees, sc.EDV, sc.Ea, sc.alpha);
    if (sl._eaMoved) return computeState(sl.Ees, sl.EDV, sl.Ea, sl.alpha);
    return computePinned(sl.Ees, sl.EDV, sl.alpha, normSt.ESP, normSt.LVEDP);
  }, [mode, sc, sl]);

  const dispLVEDP = Math.min(pv.LVEDP, 50);

  return (
    <div>
      {/* … all SVG + UI unchanged … */}

      {/* Readouts — FIXED */}
      {[
        { l: "EDV", v: pv.EDV, r: normSt.EDV },
        { l: "LVEDP", v: dispLVEDP, r: normSt.LVEDP },
        { l: "ESV", v: pv.ESV, r: normSt.ESV },
        { l: "Afterload", v: pv.ESP, r: normSt.ESP },
        { l: "Stroke Vol", v: pv.SV, r: normSt.SV },
        { l: "Ejection Fr", v: pv.EF, r: normSt.EF },
      ].map(({ l, v, r }) => (
        <div key={l}>
          {v >= 100 ? Math.round(v) : v.toFixed(1)}
          <D val={v} baseline={r} />
        </div>
      ))}
    </div>
  );
}
