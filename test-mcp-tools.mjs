import { spawn } from "node:child_process";

const serverPath = "C:\\Users\\20260520010\\Desktop\\jlceda\\dist\\index.js";
const tools = [
  { name: "pcb_get_board_info", arguments: {} },
  { name: "pcb_get_feature_support", arguments: {} },
  { name: "pcb_screenshot", arguments: {} },
  { name: "pcb_get_tracks", arguments: {} },
  { name: "pcb_get_pads", arguments: {} }
];

const child = spawn("C:\\Program Files\\nodejs\\node.exe", [serverPath], {
  env: {
    ...process.env,
    GATEWAY_WS_URL: "ws://127.0.0.1:18800/ws/rpc"
  },
  stdio: ["pipe", "pipe", "pipe"]
});

let id = 1;
let buffer = "";
const pending = new Map();

function send(method, params = {}) {
  const requestId = id++;
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }) + "\n");
  return new Promise((resolve) => pending.set(requestId, resolve));
}

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  while (true) {
    const index = buffer.indexOf("\n");
    if (index < 0) break;
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

child.stderr.on("data", (chunk) => process.stderr.write(chunk));

const timeout = setTimeout(() => {
  console.log(JSON.stringify({ timeout: true }, null, 2));
  child.kill();
}, 180000);

try {
  await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "local-tool-test", version: "1.0.0" }
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");

  const results = {};
  for (const tool of tools) {
    results[tool.name] = await send("tools/call", tool);
  }

  clearTimeout(timeout);
  console.log(JSON.stringify(results, null, 2));
} finally {
  child.kill();
}
