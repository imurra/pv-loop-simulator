import test from "node:test";
import assert from "node:assert/strict";
import {
  SLIDERS, SC, NORMAL, LIMITS, V0, computeState, violations, isValid, moveSlider,
  loopPoints, espvr, edpvr, alphaOf,
} from "../src/model.js";

const VMAX = 240, PMAX = 280;
const N = computeState(NORMAL);
const S = Object.fromEntries(Object.entries(SC).map(([k, s]) => [k, computeState(s.params)]));
const KEYS = ["EDV", "ESV", "SV", "EF", "ESP", "LVEDP"];
const LESIONS = [null, "mr", "ar", "as"];

// deterministic RNG
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const gridVals = (d) => { const out = []; for (let v = d.min; v <= d.max + 1e-9; v += d.step) out.push(+v.toFixed(4)); return out; };
const randomValid = (lesion = null) => {
  for (;;) {
    const p = { lesion };
    for (const d of SLIDERS) { const g = gridVals(d); p[d.key] = g[Math.floor(rnd() * g.length)]; }
    if (isValid(p)) return p;
  }
};
const in_ = (x, lo, hi, msg) => assert.ok(x >= lo && x <= hi, `${msg}: ${x.toFixed(2)} not in [${lo}, ${hi}]`);

// ─────────── 1. Normal physiology ───────────
test("normal heart sits in textbook ranges", () => {
  in_(N.EDV, 110, 130, "EDV"); in_(N.ESV, 45, 60, "ESV"); in_(N.SV, 60, 80, "SV");
  in_(N.EF, 55, 65, "EF"); in_(N.ESP, 95, 120, "ESP"); in_(N.LVEDP, 3, 12, "LVEDP");
  in_(N.Ppeak, 110, 130, "peak systolic"); in_(N.Popen, 70, 90, "aortic diastolic");
  in_(N.Ea / N.Ees, 0.5, 0.8, "Ea/Ees coupling");
  assert.ok(N.Vpeak > N.ESV && N.Vpeak < N.EDV, "peak pressure occurs during ejection");
});

// ─────────── 2. Pathophysiology = text claims ───────────
test("every scenario is physiologically possible and on the slider grid", () => {
  for (const [k, s] of Object.entries(SC)) {
    assert.deepEqual(violations(computeState(s.params)).map((v) => v.id), [], k);
    for (const d of SLIDERS) {
      const v = s.params[d.key];
      in_(v, d.min, d.max, `${k}.${d.key}`);
      const n = (v - d.min) / d.step;
      assert.ok(Math.abs(n - Math.round(n)) < 1e-6, `${k}.${d.key}=${v} not on slider grid`);
    }
  }
});

test("HFrEF: low EF ~30%, dilated, congested", () => {
  const s = S.hfref;
  in_(s.EF, 25, 35, "EF"); assert.ok(s.EDV > N.EDV + 40); assert.ok(s.ESV > 100); assert.ok(s.LVEDP >= 15);
  assert.ok(SC.hfref.params.Ees < NORMAL.Ees, "ESPVR flattens");
});
test("HFpEF: EF >50%, smaller filling volume, high filling pressure", () => {
  const s = S.hfpef;
  assert.ok(s.EF > 50); assert.ok(s.EDV < N.EDV, "fills to a SMALLER volume"); assert.ok(s.LVEDP >= 15);
  assert.ok(s.alpha > N.alpha, "EDPVR shifts up");
});
test("Aortic stenosis: tall, narrow, EF maintained, stiffer wall", () => {
  const s = S.as;
  assert.ok(s.Ppeak > 200, "peak LV pressure > 200"); in_(s.Popen, 70, 100, "aortic pressure near normal");
  assert.ok(s.EF >= 50, "EF maintained"); assert.ok(s.SV < N.SV, "narrow");
  assert.ok(SC.as.params.Ees > NORMAL.Ees, "steeper ESPVR"); assert.ok(s.alpha > N.alpha, "stiffer");
  assert.ok(s.LVEDP > N.LVEDP, "filling pressure higher");
});
test("Aortic regurgitation: big wide loop, wide pulse pressure, d tilts right", () => {
  const s = S.ar;
  assert.ok(s.EDV > 170); assert.ok(s.SV > 100); assert.ok(s.EF >= 55);
  assert.ok(s.Ppeak - s.Popen > (N.Ppeak - N.Popen) + 40, "wide pulse pressure");
  assert.ok(s.alpha < N.alpha, "compliance improves"); assert.ok(s.LVEDP <= 15, "filling pressure manageable");
  assert.ok(s.leakD > 0 && s.leakB === 0);
});
test("Mitral stenosis: only filling changes; low LVEDP", () => {
  const s = S.ms, p = SC.ms.params;
  assert.equal(p.Ees, NORMAL.Ees); assert.equal(p.Ea, NORMAL.Ea); assert.equal(p.comp, NORMAL.comp);
  assert.ok(s.EDV < N.EDV - 25); assert.ok(s.SV < N.SV); assert.ok(s.ESP < N.ESP, "pressure drops");
  assert.ok(s.LVEDP < N.LVEDP, "LVEDP is LOW"); assert.ok(Math.abs(s.EF - N.EF) < 5);
});
test("Mitral regurgitation: supranormal EF, low ESP, dilated, b tilts left", () => {
  const s = S.mr;
  assert.ok(s.EF > 60); assert.ok(s.ESP < N.ESP); assert.ok(s.EDV > N.EDV); assert.ok(s.SV > 100);
  assert.ok(s.leakB > 0 && s.leakD === 0);
});
test("Hemorrhage: small left-shifted loop; sympathetic Ees and Ea up", () => {
  const s = S.hemorrhage, p = SC.hemorrhage.params;
  assert.ok(s.EDV < N.EDV - 25); assert.ok(s.SV < N.SV - 20); assert.ok(s.LVEDP < N.LVEDP);
  assert.ok(p.Ees > NORMAL.Ees && p.Ea > NORMAL.Ea);
});
test("IV fluid: pure preload — right side moves far, left side a little", () => {
  const s = S.fluid, p = SC.fluid.params;
  assert.equal(p.Ees, NORMAL.Ees); assert.equal(p.Ea, NORMAL.Ea); assert.equal(p.comp, NORMAL.comp);
  const dR = s.EDV - N.EDV, dL = s.ESV - N.ESV;
  assert.ok(dL > 0 && dR > 2 * dL, `right ${dR.toFixed(1)} vs left ${dL.toFixed(1)}`);
  assert.ok(s.SV > N.SV);
});
test("Inotrope: left side moves left, filling volume unchanged", () => {
  const s = S.inotrope;
  assert.equal(s.EDV, N.EDV); assert.ok(s.ESV < N.ESV); assert.ok(s.SV > N.SV); assert.ok(s.EF > N.EF);
});
test("fluid vs inotrope move opposite sides of the loop", () => {
  assert.ok(S.fluid.EDV - N.EDV > N.EDV - S.fluid.EDV + 20);
  assert.ok(N.ESV - S.inotrope.ESV > 5 && S.inotrope.EDV === N.EDV);
});

// ─────────── 3. Each slider does what the panel says ───────────
test("slider directions hold from every scenario", () => {
  for (const [k, sc] of Object.entries(SC)) {
    const base = computeState(sc.params);
    const up = (key, d) => computeState({ ...sc.params, [key]: sc.params[key] + d });
    const c = up("Ees", 0.1);
    assert.ok(c.ESV < base.ESV && c.SV > base.SV && c.EF > base.EF && c.ESP > base.ESP, `${k} Ees`);
    assert.equal(c.EDV, base.EDV); assert.equal(c.LVEDP, base.LVEDP);
    const f = up("fill", 2);
    assert.ok(f.EDV > base.EDV && f.SV > base.SV && f.LVEDP > base.LVEDP && f.ESP > base.ESP && f.ESV > base.ESV, `${k} fill`);
    assert.ok(f.EDV - base.EDV > f.ESV - base.ESV, `${k} preload moves right side more than left`);
    const a = up("Ea", 0.1);
    assert.ok(a.ESP > base.ESP && a.ESV > base.ESV && a.SV < base.SV && a.EF < base.EF, `${k} Ea`);
    assert.equal(a.EDV, base.EDV); assert.equal(a.LVEDP, base.LVEDP);
    const m = up("comp", 0.05);
    assert.ok(m.EDV > base.EDV && m.LVEDP < base.LVEDP, `${k} more compliant → fills more at lower pressure`);
    const st = up("comp", -0.05);
    assert.ok(st.EDV < base.EDV && st.LVEDP > base.LVEDP, `${k} stiffer → fills less at higher pressure`);
  }
});

// ─────────── 4. Full-range sweeps of every slider from every scenario ───────────
test("sweeps: allowed range is one interval, outputs monotonic and continuous", () => {
  const dirs = { Ees: { EDV: 0, ESV: -1, SV: 1, ESP: 1 }, fill: { EDV: 1, SV: 1, ESP: 1, LVEDP: 1 }, Ea: { EDV: 0, ESV: 1, SV: -1, ESP: 1 }, comp: { EDV: 1, LVEDP: -1 } };
  let checked = 0;
  for (const [k, sc] of Object.entries(SC)) {
    for (const d of SLIDERS) {
      const vals = gridVals(d);
      const valid = vals.map((v) => isValid({ ...sc.params, [d.key]: v }));
      const first = valid.indexOf(true), last = valid.lastIndexOf(true);
      assert.ok(valid.slice(first, last + 1).every(Boolean), `${k}.${d.key}: allowed range has a hole`);
      let prev = null; const series = [];
      for (let i = first; i <= last; i++) {
        const s = computeState({ ...sc.params, [d.key]: vals[i] });
        for (const key of KEYS) assert.ok(Number.isFinite(s[key]), `${k}.${d.key} ${key} NaN`);
        if (prev) {
          for (const [key, sign] of Object.entries(dirs[d.key])) {
            const dv = s[key] - prev[key];
            if (sign === 0) assert.ok(Math.abs(dv) < 1e-9, `${k}.${d.key} changed ${key}`);
            else assert.ok(dv * sign > 0, `${k}.${d.key} ${key} not monotonic at ${vals[i]}`);
          }
        }
        series.push(s); prev = s; checked++;
      }
      // no discontinuities: no step changes an output far more than its neighbours do
      for (const key of KEYS) {
        const dl = series.slice(1).map((x, i) => Math.abs(x[key] - series[i][key]));
        dl.forEach((x, i) => {
          const nb = Math.max(dl[i - 1] ?? 0, dl[i + 1] ?? 0);
          assert.ok(x <= 2 * nb + 0.5, `${k}.${d.key}: ${key} jumps ${x.toFixed(2)} (neighbours ${nb.toFixed(2)})`);
        });
      }
    }
  }
  assert.ok(checked > 1000);
});

// ─────────── 5. Order of slider moves never matters ───────────
test("path independence: 2000 random slider sequences", () => {
  for (let t = 0; t < 2000; t++) {
    const lesion = LESIONS[t % 4];
    let p = randomValid(lesion);
    for (let m = 0; m < 20; m++) {
      const d = SLIDERS[Math.floor(rnd() * 4)];
      const target = d.min + Math.round((rnd() * (d.max - d.min)) / d.step) * d.step;
      p = moveSlider(p, d.key, target).params;
      assert.ok(isValid(p), "every intermediate state valid");
    }
    const viaPath = computeState(p);
    const direct = computeState({ ...p });
    for (const key of KEYS) assert.equal(viaPath[key], direct[key]);
    // the same four values set in reverse order give the same loop
    let q = { ...NORMAL, lesion };
    const order = [...SLIDERS].reverse();
    for (const d of order) q = { ...q, [d.key]: p[d.key] };
    assert.deepEqual(loopPoints(computeState(q)), loopPoints(viaPath));
  }
});

// ─────────── 6. Guardrails ───────────
test("limits are monotonic in every slider (so a slider can just stop)", () => {
  for (let t = 0; t < 400; t++) {
    const p = randomValid(LESIONS[t % 4]);
    for (const d of SLIDERS) {
      for (const lim of LIMITS) {
        const ok = gridVals(d).map((v) => lim.test(computeState({ ...p, [d.key]: v })));
        const flips = ok.slice(1).filter((x, i) => x !== ok[i]).length;
        assert.ok(flips <= 1, `${lim.id} along ${d.key} flips ${flips}×`);
      }
    }
  }
});

test("moveSlider: lands on target if possible, otherwise stops at the edge with a reason", () => {
  let blockedCount = 0;
  for (let t = 0; t < 3000; t++) {
    const p = randomValid(LESIONS[t % 4]);
    const d = SLIDERS[t % 4];
    const target = d.min + Math.round((rnd() * (d.max - d.min)) / d.step) * d.step;
    const { params: r, blocked } = moveSlider(p, d.key, target);
    assert.ok(isValid(r));
    for (const o of SLIDERS) if (o.key !== d.key) assert.equal(r[o.key], p[o.key], "only the moved slider changes");
    const lo = Math.min(p[d.key], target), hi = Math.max(p[d.key], target);
    assert.ok(r[d.key] >= lo - 1e-9 && r[d.key] <= hi + 1e-9, "never overshoots");
    if (isValid({ ...p, [d.key]: target })) {
      assert.equal(blocked, null); assert.ok(Math.abs(r[d.key] - target) < 1e-9);
    } else {
      blockedCount++;
      assert.ok(blocked && blocked.reason.length > 20);
      assert.ok(violations(computeState({ ...p, [d.key]: target })).some((v) => v.id === blocked.id));
      const next = +(r[d.key] + Math.sign(target - p[d.key]) * d.step).toFixed(4);
      assert.ok(!isValid({ ...p, [d.key]: next }), `${d.key} stopped early at ${r[d.key]} (next ${next} is allowed)`);
    }
  }
  assert.ok(blockedCount > 100, "guard actually exercised");
});

test("specific impossible combinations are blocked", () => {
  const cases = [
    [{ Ees: 0.5, fill: 100, Ea: 4, comp: 1 }, "lowSV"],          // weak heart + huge afterload
    [{ Ees: 5, fill: 120, Ea: 0.5, comp: 1 }, "highEF"],         // strong heart + no afterload
    [{ Ees: 5, fill: 220, Ea: 4, comp: 1 }, "highESP"],
    [{ Ees: 2.5, fill: 220, Ea: 1.6, comp: 0.5 }, "edema"],      // stiff and overfilled
    [{ Ees: 2.5, fill: 220, Ea: 1.6, comp: 2 }, "dilation"],
    [{ Ees: 0.5, fill: 120, Ea: 0.5, comp: 1 }, "lowESP"],       // weak heart + vasodilated
  ];
  for (const [p, id] of cases) {
    const ids = violations(computeState({ ...p, lesion: null })).map((v) => v.id);
    assert.ok(ids.includes(id), `${JSON.stringify(p)} should violate ${id}, got [${ids}]`);
  }
});

// ─────────── 7. Every allowed combination draws a proper loop ───────────
test("exhaustive grid: no NaN anywhere; every allowed state satisfies all limits", () => {
  let total = 0, allowed = 0;
  for (const lesion of LESIONS) {
    for (const Ees of gridVals(SLIDERS[0])) for (const fill of gridVals(SLIDERS[1]))
      for (const Ea of gridVals(SLIDERS[2])) for (const comp of gridVals(SLIDERS[3])) {
        const s = computeState({ Ees, fill, Ea, comp, lesion });
        total++;
        for (const key of KEYS) if (!Number.isFinite(s[key])) assert.fail(`NaN ${key}`);
        if (violations(s).length === 0) {
          allowed++;
          assert.ok(s.SV >= 20 && s.EF <= 80 && s.LVEDP <= 35 && s.LVEDP < s.Popen && s.ESP >= 50 && s.ESP <= 230 && s.EDV <= 230);
          assert.ok(s.ESV > V0 && s.ESV < s.EDV);
        }
      }
  }
  console.log(`  grid: ${total.toLocaleString()} combinations, ${allowed.toLocaleString()} allowed`);
  assert.ok(allowed > 0.2 * total);
});

const segX = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};

test("loop geometry on allowed states: phases, ESPVR ceiling, Ea line, no self-crossing, on chart", () => {
  let n = 0;
  for (let t = 0; t < 6000; t++) {
    const s = computeState(randomValid(LESIONS[t % 4]));
    const pts = loopPoints(s);
    const ph = (x) => pts.filter((p) => p[2] === x);
    for (const [v, p] of pts) {
      assert.ok(Number.isFinite(v) && Number.isFinite(p));
      assert.ok(v >= 0 && v <= VMAX && p >= 0 && p <= PMAX, `off chart (${v.toFixed(0)}, ${p.toFixed(0)})`);
    }
    // a: on the EDPVR, volume rising
    const a = ph("a");
    a.forEach(([v, p], i) => {
      assert.ok(Math.abs(p - edpvr(v, s.alpha)) < 1e-9);
      if (i) assert.ok(v > a[i - 1][0]);
    });
    // b: pressure rising to aortic opening; volume constant (MR: falling)
    const b = ph("b");
    b.forEach(([v, p], i) => { if (i) { assert.ok(p > b[i - 1][1]); assert.ok(v <= b[i - 1][0] + 1e-9); } });
    if (s.lesion !== "mr") b.forEach(([v]) => assert.ok(Math.abs(v - s.EDV) < 1e-9));
    // c: volume falling, never above the ESPVR, ends exactly on the end-systolic point
    const c = ph("c");
    c.forEach(([v, p], i) => {
      assert.ok(p <= espvr(v, s.Ees) + 1e-9, "ejection above ESPVR");
      if (i) assert.ok(v < c[i - 1][0]);
    });
    const end = c[c.length - 1];
    assert.ok(Math.abs(end[0] - s.ESV) < 1e-9 && Math.abs(end[1] - s.ESP) < 1e-9);
    assert.ok(Math.abs(s.ESP - espvr(s.ESV, s.Ees)) < 1e-9, "ES point on ESPVR");
    assert.ok(Math.abs(s.ESP / s.SV - s.Ea) < 1e-9, "Ea line slope = Ea");
    // d: pressure falling; volume constant (AR: rising)
    const d = ph("d");
    d.forEach(([v, p], i) => { if (i) { assert.ok(p < d[i - 1][1]); assert.ok(v >= d[i - 1][0] - 1e-9); } });
    if (s.lesion !== "ar") d.forEach(([v]) => assert.ok(Math.abs(v - s.ESV) < 1e-9));
    // closes on the start of filling
    const last = d[d.length - 1];
    assert.ok(Math.abs(last[0] - a[0][0]) < 1e-9 && Math.abs(last[1] - a[0][1]) < 1e-9);
    // simple polygon
    if (t % 6 === 0) {
      const ring = pts.map(([v, p]) => [v, p]);
      for (let i = 0; i < ring.length; i++)
        for (let j = i + 2; j < ring.length; j++) {
          if (i === 0 && j === ring.length - 1) continue;
          const A = ring[i], B = ring[(i + 1) % ring.length], C = ring[j], D = ring[(j + 1) % ring.length];
          assert.ok(!segX(A, B, C, D), "loop crosses itself");
        }
      n++;
    }
  }
  assert.ok(n > 500);
});

test("compliance slider: right = more compliant (α falls)", () => {
  assert.ok(alphaOf(2) < alphaOf(1) && alphaOf(1) < alphaOf(0.5));
  const comp = SLIDERS.find((d) => d.key === "comp");
  assert.equal(comp.label, "Compliance");
});
