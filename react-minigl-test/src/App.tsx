import React from "react";
import "./App.css";
import { MiniGLFlowEditor } from "./components/MiniGLFlowEditor";

function App() {
  return (
    <div className="App">
      <MiniGLFlowEditor canvasId="minigl-canvas" />
    </div>
  );
}

export default App;
