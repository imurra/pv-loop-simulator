# Changelog

## v2.0 — October 11, 2026

A rewrite of the model so that every preset and every slider runs through one set of equations, sliders stop at physiologically impossible combinations, and every claim in the walkthrough text is checked by an automated test. Internally this was the "v5" model; publicly it is version 2.

Live: https://imurra.github.io/pv-loop-simulator/
Previous version: https://imurra.github.io/pv-loop-simulator/v1/

### Fixed
- **Contractility slider collapsed stroke volume.** v1 fixed end-systolic pressure at 122 mmHg, so below an Ees of about 1.2, SV fell to ~1 mL (the HFrEF preset at the same Ees showed 53 mL). End-systolic pressure is now computed from ventricular–arterial coupling.
- **Loop depended on which slider was moved last.** Each slider used different equations; setting Ees to 1.5 and then nudging Ea by 0.1 made SV jump from 29 to 46 mL. All sliders now share one model, and the order of moves never matters.
- **Compliance slider ran backwards.** It controlled stiffness, so right meant less compliant. Right now means more compliant.
- **Compliance treated two different ways.** The slider kept filling pressure fixed; the presets kept volume fixed. A stiffer wall now fills to a smaller volume at a higher pressure in both.
- **Normal EF was 51%.** Afterload changed from 2.0 to 1.6 (Ea/Ees 0.64); normal EF is now 56%, about 118/77 mmHg.
- **Aortic stenosis EF was 38%** while its text said EF is maintained. Hypertrophy is now modeled (steeper ESPVR, stiffer wall); EF 51%, peak LV pressure 237 mmHg.
- **Hemorrhage** text described sympathetic responses the model did not include; contractility and afterload now rise modestly.
- **Text contradicted the model:** IV fluid ("left side barely moves" — ESV actually rises), IV fluid step 4 (steep part of the compliance curve described as helpful), manual-mode panel. All rewritten to match.

### Added
- Physiological limits with a one-line reason when a slider stops: filling volume > 230 mL, filling pressure > 35 mmHg, inverted loop, SV < 20 mL, EF > 80%, end-systolic pressure < 50 or > 230 mmHg.
- Readouts for filling volume, residual volume, SV, EF, end-systolic pressure, and filling pressure, with ▲▼ versus normal.
- Realistic loop top: the aortic valve opens at aortic diastolic pressure, pressure peaks, then falls to end-systolic pressure.
- Mitral regurgitation and aortic regurgitation loop shapes (tilted contraction and relaxation lines; wide pulse pressure in AR).
- 21 automated tests (`npm test`), including all 32.8 million slider combinations, 2,000 random slider sequences, and every text claim.
- Afterload slider in finer steps (0.05).
- Version label and link to the previous version in the footer.

### Not changed
- Layout, colors, list of presets, and the four-step walkthrough structure.
- No heart rate or time course (deliberately out of scope for a single-beat PV loop).

## v1.0 — March 8, 2026

The original simulator (internally "v4"). Preserved unchanged:
- Branch `archive/v1` (commit f095099)
- Copy in `legacy/v1/`, served at https://imurra.github.io/pv-loop-simulator/v1/ with an archive banner
