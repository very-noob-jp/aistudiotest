const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /app\.listen\(PORT, "0\.0\.0\.0", \(\) => \{/,
  `// Apply initial QoS on startup
  const initConfig = loadConfig();
  applyQoS(initConfig.qos_enabled, initConfig.qos_download, initConfig.qos_upload).catch(console.error);
  
  app.listen(PORT, "0.0.0.0", () => {`
);

fs.writeFileSync('server.ts', code);
console.log('Added QoS startup');
