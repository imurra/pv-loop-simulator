// Copyright (c) 2026 Ian V.J. Murray. Licensed under CC BY-NC-ND 4.0 (citation
// required, non-commercial use only, no modified versions). See LICENSE.
import React from "react";
import { createRoot } from "react-dom/client";
import PVLoop from "./PVLoop.jsx";   // YOUR FILE — unchanged

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <PVLoop />
  </React.StrictMode>
);
