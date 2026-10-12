import { build } from "esbuild";
import fs from "fs";
const SP = process.env.SP || "dist-single";
const globals = { react: "window.React", "react-dom/client": "window.ReactDOM" };
const res = await build({
  entryPoints: ["src/main.jsx"], bundle: true, minify: true, format: "iife", write: false,
  jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment",
  inject: [], define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "globals", setup(b) {
    b.onResolve({ filter: /^react(-dom\/client)?$/ }, (a) => ({ path: a.path, namespace: "g" }));
    b.onLoad({ filter: /.*/, namespace: "g" }, (a) => ({ contents: `module.exports = ${globals[a.path]};`, loader: "js" }));
  } }],
});
const js = res.outputFiles[0].text;
const html = `<title>PV Loop Simulator</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap">
<style>
/* Single committed dark look, matching the original simulator */
:root { --bg: #0D1117; --fg: #C9D1D9; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); padding-inline: 8px; }
input[type=range]:focus-visible, button:focus-visible { outline: 2px solid #58A6FF; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { animate { display: none; } }
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
fs.mkdirSync(`${SP}/artifact`, { recursive: true });
fs.writeFileSync(`${SP}/artifact/pv-loop-simulator.html`, html);
// Note: written as page content; wrap in <!doctype html><html><body> to open it standalone.
console.log("bytes", html.length);
