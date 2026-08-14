const fs = require('fs');
let code = fs.readFileSync('server/network.ts', 'utf8');

const qosCode = `
export async function applyQoS(enabled: boolean, downMbps: string, upMbps: string) {
  const iface = "wlan0";
  
  // Clear existing QoS rules
  await runSudo(\`tc qdisc del dev \${iface} root || true\`);
  await runSudo(\`tc qdisc del dev \${iface} ingress || true\`);

  if (!enabled) return;

  const downMbit = parseInt(downMbps);
  const upMbit = parseInt(upMbps);

  if (isNaN(downMbit) || isNaN(upMbit) || (downMbit === 0 && upMbit === 0)) return;

  // Egress (Router -> Client, so this is "Download" for the client)
  if (downMbit > 0) {
    await runSudo(\`tc qdisc add dev \${iface} root tbf rate \${downMbit}mbit burst 32kbit latency 400ms\`);
  }

  // Ingress (Client -> Router, so this is "Upload" for the client)
  if (upMbit > 0) {
    await runSudo(\`tc qdisc add dev \${iface} handle ffff: ingress\`);
    await runSudo(\`tc filter add dev \${iface} parent ffff: protocol ip prio 50 u32 match ip src 0.0.0.0/0 police rate \${upMbit}mbit burst 32kbit drop flowid :1\`);
  }
}
`;

code = code.replace('export async function addPortForward', qosCode + '\nexport async function addPortForward');
fs.writeFileSync('server/network.ts', code);
console.log('Added applyQoS');
