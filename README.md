# PV Loop Simulator

An interactive left-ventricular pressure–volume loop for preclinical physiology. Students move four sliders (contractility, preload, afterload, compliance) or step through ten preset conditions, each with a four-step walkthrough. A dashed normal loop stays on screen for comparison. Sliders stop at physiologically impossible combinations and say why.

- **Current version (v2.0):** https://imurra.github.io/pv-loop-simulator/
- **Previous version (v1.0, archived):** https://imurra.github.io/pv-loop-simulator/v1/

See [CHANGELOG.md](CHANGELOG.md) for what changed between versions.

## Project layout

| Path | Contents |
|---|---|
| `src/model.js` | All equations, physiological limits, presets, and loop geometry |
| `src/steps.js` | Walkthrough text for each preset |
| `src/PVLoop.jsx` | Interface |
| `tests/model.test.mjs` | 21 automated tests of the model and the walkthrough claims |
| `legacy/v1/` | The original v1 code (byte-for-byte copy of commit f095099) and its build config |
| `scripts/build-single-page.mjs` | Builds a one-file version of the simulator |
| `.github/workflows/pages.yml` | Runs the tests, then builds both versions and deploys to GitHub Pages |

## Running locally

```
npm install
npm test          # about 50 seconds
npm run dev       # local preview of v2
npm run build     # builds v2 into dist/ and v1 into dist/v1/
```

## The model in brief

The end-systolic pressure–volume relationship (ESPVR, slope Ees) and the end-diastolic pressure–volume relationship (EDPVR) bound the loop; arterial elastance (Ea) sets where ejection ends:

- ESV = (Ea·EDV + Ees·V₀) / (Ees + Ea)
- ESP = Ees·(ESV − V₀)
- LVEDP = A·(e^(α·EDV) − 1)

Full methods, parameter choices, limits, and verification are in the v2 technical report.

## How to cite (required)

Any use, display, or sharing of this simulator, including screenshots, recordings, slides, and course pages, must cite it:

> Murray IVJ. PV Loop Simulator (Version 2.0) [Interactive simulation]. 2026. Available at: https://imurra.github.io/pv-loop-simulator/

Use the **Cite this repository** button on GitHub for APA or BibTeX formats.

## License

© 2026 Ian V.J. Murray. Licensed under [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). See [LICENSE](LICENSE) for the full terms.

- **Citation required** for every use.
- **Non-commercial use only.** No commercial test prep, paid courses or platforms, paid apps, or advertising-supported products without written permission.
- **No modified versions.** Altered, rebranded, translated, or partial copies may not be shared or hosted.
- Any other use requires prior written permission from the author.

This is a teaching tool, not a clinical model. Do not use it for clinical decisions.
