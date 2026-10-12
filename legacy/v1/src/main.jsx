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
