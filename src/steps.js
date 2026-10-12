// Walkthrough text for each scenario. Every quantitative claim here is
// checked against the model in tests/model.test.mjs ("text claims").
export const STEPS = {
  normal: [
    { title: "Baseline", text: "A healthy left ventricle. Two boundary curves control the loop: ESPVR (contractility ceiling) and EDPVR (passive compliance floor). The loop shape emerges from these constraints." },
    { title: "Filling (phase a)", text: "Mitral valve opens → blood flows from left atrium into the ventricle along the EDPVR. Volume rises gently because the normal wall is compliant — filling is easy and pressure stays low." },
    { title: "Systole (b → c → d)", text: "Phase b: all valves closed, pressure builds until it exceeds aortic pressure (~80 mmHg). Phase c: aortic valve opens, blood is ejected; pressure peaks near 120 and falls as ejection ends. The top-left corner sits on the ESPVR — the maximum the ventricle can squeeze at that volume. Phase d: pressure falls back down." },
    { title: "Sliding vs. rotating", text: "Preload changes SLIDE the loop along a fixed ESPVR. Contractility changes ROTATE the ESPVR itself. Both can increase Stroke Volume (SV), but through fundamentally different mechanisms. Try the sliders to see this." },
  ],
  hfref: [
    { title: "The heart muscle weakens", text: "In dilated cardiomyopathy or after a large MI, the ventricle loses contractile force. The ESPVR flattens — the ceiling drops. The ventricle simply cannot squeeze as hard." },
    { title: "Can't empty → volume backs up", text: "Because the ventricle can't empty properly, blood accumulates. The body retains fluid (RAAS activation), pushing the loop rightward. The ventricle dilates." },
    { title: "Filling pressures rise → congestion", text: "More volume in the ventricle means higher diastolic pressure (LVEDP rises). This backs up into the lungs → pulmonary congestion → dyspnea. The larger filling volume partially rescues Stroke Volume (SV), but at the cost of congestion." },
    { title: "Ejection Fraction (EF) drops", text: "EF falls to ~30%. The loop is wide but flat — lots of volume, poor emptying. Treatment targets: reduce preload (diuretics), reduce afterload (ACE inhibitors), and if possible support contractility." },
  ],
  hfpef: [
    { title: "The wall stiffens", text: "In hypertensive heart disease, aging, or amyloid, the ventricular wall becomes stiff. Think of inflating a stiff balloon — it takes much more pressure to fill the same volume. The EDPVR curve shifts upward." },
    { title: "Filling pressure rises despite less volume", text: "Even though the ventricle fills to a SMALLER volume, diastolic pressure (LVEDP) is much higher. The bottom of the loop rises. This is the opposite of HFrEF — the ventricle is small and stiff, not big and floppy." },
    { title: "Same symptoms, different mechanism", text: "High LVEDP backs up into the lungs → pulmonary congestion → dyspnea. The patient looks identical to HFrEF clinically — but the cause is impaired filling, not impaired contraction." },
    { title: "The diagnostic trap", text: "Ejection Fraction (EF) is preserved (>50%) — the ventricle empties fine, it just can't fill. Echo shows 'normal EF' but diastolic dysfunction (elevated E/e'). This is why HFpEF was historically missed." },
  ],
  as: [
    { title: "Fixed obstruction to outflow", text: "A stenotic aortic valve creates a barrier to ejection. The ventricle must generate much higher pressure to push blood through the narrowed opening — peak LV pressure climbs above 200 mmHg while aortic pressure stays near normal. The loop grows taller." },
    { title: "Pressure overload → hypertrophy", text: "The ventricle compensates by thickening its walls (concentric hypertrophy). The thicker muscle squeezes harder (steeper ESPVR) but is also stiffer (EDPVR rises), so filling pressure is higher. The loop becomes tall and narrow." },
    { title: "High energy cost", text: "A tall, narrow loop means enormous myocardial oxygen demand. The thick wall also has poor subendocardial perfusion → patients develop angina even without coronary artery disease." },
    { title: "Decompensation", text: "At this stage Stroke Volume (SV) and Ejection Fraction (EF) are maintained through hypertrophy. But eventually the muscle can't keep up → contractility falls → EF drops → rapid clinical deterioration. Try lowering contractility to see it." },
  ],
  ar: [
    { title: "Backward leak during diastole", text: "An incompetent aortic valve lets blood leak backward from the aorta into the ventricle during diastole. The LV fills from TWO sources — the left atrium AND the aorta. Notice the relaxation line (d) tilts right: the ventricle starts refilling before the mitral valve even opens." },
    { title: "Volume overload widens the loop", text: "The ventricle dilates to accommodate the extra volume. The loop shifts right and becomes wide. Total Stroke Volume (SV) is very large, but some of it just leaks backward — forward SV to the body is reduced. The large SV also widens pulse pressure: the aortic valve opens at a low pressure and the peak is high." },
    { title: "Eccentric remodeling", text: "Chronic volume overload causes the ventricle to remodel — it stretches (sarcomeres added in series). The chamber gets bigger and compliance improves, keeping filling pressures manageable." },
    { title: "Progressive failure", text: "Over time, the chronic dilation increases wall stress → contractility eventually drops → the ESPVR flattens → Ejection Fraction (EF) falls. By the time EF drops, significant irreversible damage has occurred." },
  ],
  ms: [
    { title: "Restricted filling", text: "A stenotic mitral valve limits blood flow from the left atrium into the ventricle. The ventricle receives less blood per beat → it underfills. The loop shrinks and shifts left." },
    { title: "The ventricle itself is normal", text: "Contractility, compliance and afterload are all unchanged — only filling changed. The ventricle just doesn't get enough blood to work with, so Stroke Volume (SV) and pressure both drop. Compare with Hemorrhage, which looks similar on the loop." },
    { title: "LVEDP is LOW — key point", text: "Unlike most causes of pulmonary congestion, the LV filling pressure is actually low. The ventricle is starved of volume, not overloaded. This distinguishes MS from heart failure on the PV loop." },
    { title: "LA pressure drives the congestion", text: "The pathology is in the left atrium — LA pressure must be very high to force blood through the stenotic valve. LA dilates → atrial fibrillation. Pulmonary congestion comes from LA hypertension, not LV dysfunction." },
  ],
  mr: [
    { title: "Backward leak during systole", text: "An incompetent mitral valve lets blood regurgitate from the ventricle back into the left atrium during contraction. Notice the contraction line (b) tilts left: volume escapes into the LA before the aortic valve even opens." },
    { title: "Afterload (ESP) drops", text: "Because part of the ejection goes into the low-pressure LA, the effective afterload is reduced. The ventricle doesn't have to generate as much pressure to empty. The top of the loop drops." },
    { title: "Volume overload from regurgitant return", text: "The leaked blood returns from the LA next beat, increasing filling volume. The loop shifts right and widens. Total Stroke Volume (SV) is high, but forward SV is reduced." },
    { title: "The Ejection Fraction (EF) trap", text: "EF appears supranormal (>60%) because of the low-resistance unloading. But this is misleading — in severe MR, an EF of 60% actually indicates the ventricle is already failing. Guidelines consider surgery at EF ≤60%." },
  ],
  hemorrhage: [
    { title: "Acute blood loss", text: "Blood loss reduces circulating volume → less venous return → the ventricle fills less. The loop slides left and shrinks. This is primarily a preload problem." },
    { title: "Sympathetic compensation kicks in", text: "Baroreceptors detect falling pressure → sympathetic activation → contractility rises slightly (steeper ESPVR) and arterioles constrict (steeper Ea line) to defend blood pressure. Heart rate also rises, which the loop itself cannot show." },
    { title: "Smaller loop, lower Stroke Volume (SV)", text: "Despite compensation, SV drops significantly. The loop is small and shifted left. The ventricle is working fine — it just doesn't have enough blood to pump." },
    { title: "Tachycardia is the early sign", text: "Cardiac output = SV × heart rate. With reduced SV, heart rate must rise to maintain output. Tachycardia appears BEFORE hypotension — by the time blood pressure drops, >30% of blood volume is lost." },
  ],
  fluid: [
    { title: "Volume expansion", text: "IV fluid increases circulating volume → more venous return → the ventricle fills more. The loop slides right along the same ESPVR. Contractility and afterload don't change — this is a pure preload effect." },
    { title: "More filling → more Stroke Volume (SV)", text: "Greater filling stretch → more forceful contraction → SV increases. The loop gets wider. The right side moves far right; the left side moves only a little right, because ejection pressure rises and the end-systolic point climbs the same ESPVR." },
    { title: "Preload vs. inotropy distinction", text: "Compare with inotropes: fluid moves the RIGHT side of the loop (more filling). Inotropes move the LEFT side (better emptying). Both increase SV, but by moving opposite sides of the loop." },
    { title: "Fluid responsiveness has limits", text: "On the flat part of the compliance curve, fluid helps. Once filling reaches the steep part, more fluid mostly raises filling pressure → pulmonary edema. This is why passive leg raise and SVV testing matter." },
  ],
  inotrope: [
    { title: "Contractility increases", text: "Dobutamine (β1 agonist) strengthens contraction. The ESPVR rotates upward — the contractile ceiling rises. The ventricle can now squeeze more completely at any given volume." },
    { title: "Better emptying → wider loop", text: "The ventricle empties more completely → the left side of the loop shifts left. Filling volume stays the same. Stroke Volume (SV) increases because the loop gets WIDER, not just shifted." },
    { title: "Compare: preload vs. contractility", text: "IV Fluid: right side moves right (more filling), left side moves only slightly. Inotrope: left side moves left (better emptying), right side stays. Both increase SV by moving OPPOSITE sides of the loop." },
    { title: "Clinical tradeoff", text: "Ejection Fraction (EF) improves. But inotropes increase myocardial oxygen demand and arrhythmia risk. They're a bridge — to surgery, recovery, or a ventricular assist device — not a long-term solution." },
  ],
};
