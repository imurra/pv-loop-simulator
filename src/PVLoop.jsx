import React, { useState, useMemo, useCallback } from "react";
import {
  V0, SLIDERS, SC, NORMAL, computeState, moveSlider, loopPoints, espvr, edpvr,
} from "./model.js";
import { STEPS } from "./steps.js";
// ═══════════════════════════════════════════════════════════════════
// PRESSURE–VOLUME LOOP SIMULATOR v5
// All math lives in model.js (one model for scenarios and sliders,
// physiological limits, loop geometry) and is tested in tests/.
// ═══════════════════════════════════════════════════════════════════

const normSt = computeState(NORMAL);

// ─── SVG ───
const W = 540, H = 470;
const PD = { t: 22, r: 22, b: 72, l: 56 };
const GW = W - PD.l - PD.r, GH = H - PD.t - PD.b;
export const VMAX = 240, PMAX = 280;
const vX = (v) => PD.l + (v / VMAX) * GW;
const pY = (p) => PD.t + GH - (Math.max(-20, Math.min(p, PMAX)) / PMAX) * GH;
const toPts = (arr) => arr.map(([v, p]) => `${vX(v).toFixed(1)},${pY(p).toFixed(1)}`).join(" ");

function makeCurve(type, param) {
  const pts = [];
  for (let v = type === "espvr" ? V0 : 0; v <= VMAX - 10; v += 2) {
    const p = type === "espvr" ? espvr(v, param) : edpvr(v, param);
    if (p > PMAX + 10) break;
    if (type === "edpvr" && p > 60) break; // cap display
    pts.push([v, p]);
  }
  return toPts(pts);
}

function D({ val, reference, tol = 0.5 }) {
  const d = val - reference;
  if (Math.abs(d) < tol) return null;
  return (
    <span style={{ fontSize: 9, marginLeft: 2, color: d > 0 ? "#F85149" : "#58A6FF", fontWeight: 800 }}>
      {d > 0 ? "▲" : "▼"}
    </span>
  );
}

function getHL(key, pv) {
  if (!key) return null;
  const m = {
    topleft: { cx: vX(pv.ESV), cy: pY(pv.ESP), label: "End-systolic point" },
    bottomright: { cx: vX(pv.EDV), cy: pY(pv.LVEDP), label: "Filling (EDV, LVEDP)" },
    topright: { cx: vX(pv.Vpeak), cy: pY(pv.Ppeak), label: "Peak pressure" },
    relax: { cx: vX(pv.ESV + pv.leakD / 2), cy: pY(pv.ESP * 0.5), label: "Refilling from aorta" },
    contract: { cx: vX(pv.EDV - pv.leakB / 2), cy: pY((pv.LVEDP + pv.Popen) / 2), label: "Leak into LA" },
  };
  return m[key] || null;
}

const READOUTS = [
  { key: "EDV", label: "Filling vol", unit: "mL", sub: "EDV" },
  { key: "ESV", label: "Residual vol", unit: "mL", sub: "ESV" },
  { key: "SV", label: "Stroke vol", unit: "mL", sub: "SV" },
  { key: "EF", label: "Ejection fr", unit: "%", sub: "EF" },
  { key: "ESP", label: "End-sys P", unit: "mmHg", sub: "ESP" },
  { key: "LVEDP", label: "Filling P", unit: "mmHg", sub: "LVEDP" },
];

// ═══════════ COMPONENT ═══════════
export default function PVLoop() {
  const [scKey, setScKey] = useState("normal");
  const [step, setStep] = useState(0);
  const [sl, setSl] = useState({ ...NORMAL });
  const [mode, setMode] = useState("scenario");
  const [fromKey, setFromKey] = useState("normal");
  const [blocked, setBlocked] = useState(null);

  const sc = SC[scKey];
  const params = mode === "scenario" ? sc.params : sl;
  const pv = useMemo(() => computeState(params), [params]);

  const loop = useMemo(() => toPts(loopPoints(pv)), [pv]);
  const nLoop = useMemo(() => toPts(loopPoints(normSt)), []);
  const espL = useMemo(() => makeCurve("espvr", params.Ees), [params.Ees]);
  const edpL = useMemo(() => makeCurve("edpvr", pv.alpha), [pv.alpha]);
  const nEspL = useMemo(() => makeCurve("espvr", NORMAL.Ees), []);
  const nEdpL = useMemo(() => makeCurve("edpvr", normSt.alpha), []);

  const col = mode === "scenario" ? sc.color : "#58A6FF";
  const showRef = mode === "scenario" ? scKey !== "normal" : true;
  const steps = STEPS[scKey];
  const nSteps = steps.length;
  const hl = mode === "scenario" ? getHL(sc.highlight, pv) : null;

  const pickSc = useCallback((k) => {
    setScKey(k);
    setStep(0);
    setMode("scenario");
    setBlocked(null);
  }, []);

  const slide = useCallback(
    (k, v) => {
      // Leaving a scenario: start from that scenario's exact slider positions
      const base = mode === "scenario" ? { ...SC[scKey].params } : sl;
      if (mode === "scenario") setFromKey(scKey);
      const res = moveSlider(base, k, v);
      setSl(res.params);
      setBlocked(res.blocked);
      setMode("manual");
    },
    [mode, scKey, sl]
  );

  const vTicks = [0, 50, 100, 150, 200];
  const pTicks = [0, 50, 100, 150, 200, 250];

  const groups = [
    { label: "Conditions", keys: ["normal", "hfref", "hfpef"] },
    { label: "Valvular", keys: ["as", "ar", "ms", "mr"] },
    { label: "Acute", keys: ["hemorrhage", "fluid", "inotrope"] },
  ];

  const midFill = (pv.ESV + pv.leakD + pv.EDV) / 2;

  return (
    <div style={{ background: "#0D1117", color: "#C9D1D9", minHeight: "100vh", fontFamily: "'JetBrains Mono','SF Mono','Fira Code',monospace", padding: "8px 8px 20px" }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: "#E6EDF3", margin: 0, letterSpacing: 1.5, textTransform: "uppercase" }}>
            Pressure–Volume Loop
          </h1>
          <div style={{ fontSize: 9, color: "#6E7681", marginTop: 2 }}>
            ESPVR & EDPVR control the boundaries · The loop is emergent
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
          {groups.map((g) => (
            <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 8, color: "#6E7681", width: 62, textAlign: "right", flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {g.label}
              </span>
              {g.keys.map((k) => {
                const s = SC[k];
                const on = scKey === k && mode === "scenario";
                return (
                  <button key={k} data-sc={k} onClick={() => pickSc(k)}
                    style={{ padding: "3px 9px", fontSize: 10, fontWeight: on ? 700 : 400, background: on ? s.color + "20" : "transparent", color: on ? s.color : "#8B949E", border: `1px solid ${on ? s.color + "55" : "#30363D"}`, borderRadius: 3, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* SVG */}
        <div style={{ background: "#0D1117", border: "1px solid #21262D", borderRadius: 6, padding: 4, position: "relative" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
            {vTicks.map((v) => <line key={`vg${v}`} x1={vX(v)} y1={PD.t} x2={vX(v)} y2={PD.t + GH} stroke="#161B22" strokeWidth={1} />)}
            {pTicks.map((p) => <line key={`pg${p}`} x1={PD.l} y1={pY(p)} x2={PD.l + GW} y2={pY(p)} stroke="#161B22" strokeWidth={1} />)}
            <line x1={PD.l} y1={PD.t} x2={PD.l} y2={PD.t + GH} stroke="#30363D" strokeWidth={1.5} />
            <line x1={PD.l} y1={pY(0)} x2={PD.l + GW} y2={pY(0)} stroke="#30363D" strokeWidth={1.5} />
            {vTicks.map((v) => <text key={`vl${v}`} x={vX(v)} y={PD.t + GH + 34} textAnchor="middle" fill="#6E7681" fontSize={10} fontFamily="inherit">{v}</text>)}
            {pTicks.map((p) => <text key={`pl${p}`} x={PD.l - 8} y={pY(p) + 4} textAnchor="end" fill="#6E7681" fontSize={10} fontFamily="inherit">{p}</text>)}
            <text x={PD.l + GW / 2} y={H - 6} textAnchor="middle" fill="#8B949E" fontSize={11} fontFamily="inherit">Volume (mL)</text>
            <text x={14} y={PD.t + GH / 2} textAnchor="middle" fill="#8B949E" fontSize={11} fontFamily="inherit" transform={`rotate(-90,14,${PD.t + GH / 2})`}>Pressure (mmHg)</text>

            {/* Normal reference */}
            {showRef && (
              <>
                <polyline points={nEspL} fill="none" stroke="#8B949E" strokeWidth={1.2} strokeDasharray="5,3" opacity={0.5} />
                <polyline points={nEdpL} fill="none" stroke="#8B949E" strokeWidth={1.2} strokeDasharray="5,3" opacity={0.5} />
                <polygon points={nLoop} fill="#8B949E" fillOpacity={0.06} stroke="#8B949E" strokeWidth={1.8} strokeDasharray="4,3" opacity={0.55} />
                <text x={vX(normSt.EDV) + 5} y={pY(normSt.Popen) + 4} fill="#8B949E" fontSize={10} fontFamily="inherit" fontWeight={600} opacity={0.7}>Normal</text>
              </>
            )}

            {/* Active ESPVR & EDPVR */}
            <polyline points={espL} fill="none" stroke={col} strokeWidth={1.5} opacity={0.45} strokeDasharray="6,3" />
            <polyline points={edpL} fill="none" stroke={col} strokeWidth={1.5} opacity={0.45} strokeDasharray="6,3" />

            {(() => {
              const lv = V0 + Math.min(110 / params.Ees, 50), lp = espvr(lv, params.Ees);
              return lp > 10 && lp < PMAX - 20 ? (
                <text x={vX(lv) + 3} y={pY(lp) - 5} fill={col} fontSize={9} opacity={0.6} fontFamily="inherit" fontWeight={600}>ESPVR</text>
              ) : null;
            })()}
            {(() => {
              let v2 = 200, p2 = edpvr(v2, pv.alpha);
              for (const v of [170, 140, 110, 90]) { if (p2 <= 45) break; v2 = v; p2 = edpvr(v2, pv.alpha); }
              return p2 > 1 && p2 < 55 ? (
                <text x={vX(v2) + 3} y={pY(p2) - 5} fill={col} fontSize={9} opacity={0.6} fontFamily="inherit" fontWeight={600}>EDPVR</text>
              ) : null;
            })()}

            {/* Ea line */}
            <line x1={vX(pv.EDV)} y1={pY(0)} x2={vX(pv.ESV)} y2={pY(pv.ESP)} stroke="#E3B341" strokeWidth={1.2} strokeDasharray="3,3" opacity={0.5} />
            <text x={vX(pv.EDV) + 6} y={pY(0) - 3} fill="#E3B341" fontSize={8} opacity={0.6} fontFamily="inherit">Ea</text>

            {/* PV loop */}
            <polygon data-testid="loop" points={loop} fill={col} fillOpacity={0.1} stroke={col} strokeWidth={2.2} strokeLinejoin="round" />

            {/* Corner dots */}
            <circle cx={vX(pv.EDV)} cy={pY(pv.LVEDP)} r={3} fill={col} opacity={0.7} />
            <circle cx={vX(pv.ESV)} cy={pY(pv.ESP)} r={3} fill={col} opacity={0.7} />

            {/* Phase labels */}
            <text x={vX(pv.EDV - pv.leakB / 2) + 7} y={pY((pv.LVEDP + pv.Popen) / 2)} fill="#8B949E" fontSize={9} fontFamily="inherit" fontWeight={600}>b</text>
            <text x={vX((pv.EDV + pv.ESV) / 2)} y={pY(pv.Ppeak) - 7} fill="#8B949E" fontSize={9} textAnchor="middle" fontFamily="inherit" fontWeight={600}>c</text>
            <text x={vX(pv.ESV + pv.leakD / 2) - 8} y={pY(pv.ESP / 2)} fill="#8B949E" fontSize={9} textAnchor="end" fontFamily="inherit" fontWeight={600}>d</text>
            <text x={vX(midFill)} y={pY(edpvr(midFill, pv.alpha)) - 6} fill="#8B949E" fontSize={9} textAnchor="middle" fontFamily="inherit" fontWeight={600}>a</text>

            {/* SV bracket */}
            <line x1={vX(pv.ESV)} y1={pY(-5)} x2={vX(pv.EDV)} y2={pY(-5)} stroke={col} strokeWidth={1} opacity={0.5} />
            <text x={vX((pv.ESV + pv.EDV) / 2)} y={pY(-14)} fill={col} fontSize={9} textAnchor="middle" fontFamily="inherit" opacity={0.75}>
              SV = {Math.round(pv.SV)} mL
            </text>

            {hl && (
              <>
                <circle cx={hl.cx} cy={hl.cy} r={14} fill="none" stroke="#E3B341" strokeWidth={2.5} opacity={0.85}>
                  <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
                </circle>
                <text x={hl.cx} y={hl.cy - 20} fill="#E3B341" fontSize={8} textAnchor="middle" fontFamily="inherit" fontWeight={600}>{hl.label}</text>
              </>
            )}
          </svg>
          <div style={{ position: "absolute", top: 8, right: 10, fontSize: 8, color: "#484F58", lineHeight: 1.6 }}>
            <div>a = filling · b = isovolum. contraction</div>
            <div>c = ejection · d = isovolum. relaxation</div>
          </div>
        </div>

        {/* Readouts */}
        <div data-testid="readouts" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, marginTop: 4 }}>
          {READOUTS.map((r) => (
            <div key={r.key} style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 4, padding: "4px 2px", textAlign: "center" }}>
              <div style={{ fontSize: 7.5, color: "#8B949E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E6EDF3" }} data-readout={r.key}>
                {Math.round(pv[r.key])}
                <D val={pv[r.key]} reference={normSt[r.key]} tol={r.key === "LVEDP" ? 1 : 1.5} />
              </div>
              <div style={{ fontSize: 7, color: "#6E7681" }}>{r.sub} · {r.unit}</div>
            </div>
          ))}
        </div>

        {/* Sliders */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, margin: "4px 0", padding: "8px", background: "#161B22", borderRadius: 4, border: "1px solid #21262D" }}>
          {SLIDERS.map(({ key, label, min, max, step: s, fmt }) => (
            <div key={key}>
              <div style={{ fontSize: 8, color: "#8B949E", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
              <input type="range" data-slider={key} min={min} max={max} step={s} value={params[key]}
                onChange={(e) => slide(key, parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: col, height: 4 }} />
              <div style={{ fontSize: 10, color: blocked && blocked.key === key ? "#F0883E" : "#E6EDF3", fontWeight: 600, textAlign: "center" }}>
                {fmt(params[key])}
              </div>
            </div>
          ))}
        </div>

        {blocked && mode === "manual" && (
          <div data-testid="blocked" style={{ background: "#F0883E14", border: "1px solid #F0883E55", borderRadius: 4, padding: "6px 10px", fontSize: 10, color: "#F0883E", lineHeight: 1.5 }}>
            <strong>Limit reached.</strong> {blocked.reason}
          </div>
        )}

        {/* Teaching steps */}
        {mode === "scenario" && (
          <div style={{ background: "#161B22", border: `1px solid ${col}22`, borderRadius: 4, padding: "10px 12px", marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: col }}>
                {sc.label}{scKey !== "normal" ? " — Mechanism" : " — How It Works"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
                  style={{ padding: "2px 10px", fontSize: 11, fontWeight: 600, background: step === 0 ? "#0D1117" : col + "18", color: step === 0 ? "#30363D" : col, border: `1px solid ${step === 0 ? "#21262D" : col + "44"}`, borderRadius: 3, cursor: step === 0 ? "default" : "pointer", fontFamily: "inherit" }}>
                  ← Prev
                </button>
                <span style={{ fontSize: 10, color: "#8B949E", minWidth: 32, textAlign: "center" }}>{step + 1}/{nSteps}</span>
                <button onClick={() => setStep((s) => Math.min(nSteps - 1, s + 1))} disabled={step === nSteps - 1}
                  style={{ padding: "2px 10px", fontSize: 11, fontWeight: 600, background: step === nSteps - 1 ? "#0D1117" : col + "18", color: step === nSteps - 1 ? "#30363D" : col, border: `1px solid ${step === nSteps - 1 ? "#21262D" : col + "44"}`, borderRadius: 3, cursor: step === nSteps - 1 ? "default" : "pointer", fontFamily: "inherit" }}>
                  Next →
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {steps.map((_, i) => (
                <div key={i} onClick={() => setStep(i)} style={{ flex: 1, height: 3, borderRadius: 2, cursor: "pointer", background: i <= step ? col : "#21262D", transition: "background 0.2s" }} />
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#E6EDF3", marginBottom: 4 }}>{steps[step].title}</div>
            <div style={{ fontSize: 11, color: "#8B949E", lineHeight: 1.7, minHeight: 48 }}>{steps[step].text}</div>
          </div>
        )}

        {mode === "manual" && (
          <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 4, padding: "8px 12px", marginTop: 6, fontSize: 10, color: "#8B949E", lineHeight: 1.6 }}>
            <strong style={{ color: "#E6EDF3" }}>Manual mode — starting from {SC[fromKey].label}</strong>
            {sl.lesion && <span> (valve lesion kept)</span>}
            <br />
            All four sliders share one model, so the order you move them never matters. Ejection pressure is not fixed — it emerges from contractility, afterload and filling. Sliders stop at physiologically impossible combinations.
            <br />• <strong style={{ color: "#BC8CFF" }}>Contractility</strong>: rotates ESPVR → left side moves (ESV changes), filling volume stays
            <br />• <strong style={{ color: "#1F6FEB" }}>Preload</strong>: right side moves; left side moves a little because ejection pressure rises
            <br />• <strong style={{ color: "#A371F7" }}>Afterload</strong>: steepens the Ea line → ejection pressure rises, ESV rises, SV falls
            <br />• <strong style={{ color: "#F0883E" }}>Compliance</strong>: left = stiffer wall → fills to a smaller volume at a higher pressure
          </div>
        )}

        <div style={{ fontSize: 7, color: "#6E7681", textAlign: "center", marginTop: 8 }}>
          Dr. Ian Murray · CC BY-NC-SA · Sagawa/Suga · CVPhysiology cf025/cf026 · v2.0 ·{" "}
          <a href="./v1/" style={{ color: "#8B949E" }}>previous version</a>
        </div>
      </div>
    </div>
  );
}
