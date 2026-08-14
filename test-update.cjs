const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'addPortForward, runPing',
  'addPortForward, applyQoS, runPing'
);

const qosRoute = `
  app.post('/api/config/qos', requireAdmin, async (req, res) => {
    const { qos_enabled, qos_download, qos_upload } = req.body;
    const config = loadConfig();
    Object.assign(config, { qos_enabled, qos_download, qos_upload });
    saveConfig(config);
    await applyQoS(qos_enabled, qos_download, qos_upload);
    res.json({ success: true });
  });
`;

code = code.replace(
  /app\.post\('\/api\/config\/qos'[\s\S]*?res\.json\(\{ success: true \}\);\s*\}\);/,
  qosRoute.trim()
);

fs.writeFileSync('server.ts', code);
console.log('Updated server.ts');
