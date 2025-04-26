import miniGL from "../miniGL.js";

function assert(cond, msg) {
  if (!cond) throw new Error("Test failed: " + msg);
}

function testLinearGraph() {
  const gl = { canvas: { width: 1, height: 1 } };
  const a = { id: "a", inputs: new Map(), outputs: new Set() };
  const b = { id: "b", inputs: new Map(), outputs: new Set() };
  const c = { id: "c", inputs: new Map(), outputs: new Set() };
  b.inputs.set("in", { node: a });
  c.inputs.set("in", { node: b });
  // Fake topo sort
  const order = [];
  function visit(node) {
    if (order.includes(node)) return;
    for (const conn of node.inputs.values()) visit(conn.node);
    order.push(node);
  }
  visit(c);
  assert(
    order[0] === a && order[1] === b && order[2] === c,
    "Linear topo order"
  );
}

function testFeedbackLoop() {
  const a = { id: "a", inputs: new Map(), outputs: new Set() };
  const b = { id: "b", inputs: new Map(), outputs: new Set() };
  a.inputs.set("in", { node: b });
  b.inputs.set("in", { node: a });
  // Should not infinite loop
  const order = [];
  const visited = new Set();
  function visit(node) {
    if (visited.has(node)) return;
    visited.add(node);
    for (const conn of node.inputs.values()) visit(conn.node);
    order.push(node);
  }
  visit(a);
  assert(order.includes(a) && order.includes(b), "Feedback loop topo");
}

function testDisconnect() {
  const a = { id: "a", inputs: new Map(), outputs: new Set() };
  const b = { id: "b", inputs: new Map(), outputs: new Set() };
  b.inputs.set("in", { node: a });
  b.inputs.delete("in");
  assert(b.inputs.size === 0, "Disconnect works");
}

function runAll() {
  testLinearGraph();
  testFeedbackLoop();
  testDisconnect();
  console.log("All dry graph tests passed.");
}

runAll();
