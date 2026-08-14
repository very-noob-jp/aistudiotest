import { createServer } from 'vite';
const server = await createServer({
  server: { middlewareMode: true, allowedHosts: true },
  appType: 'spa'
});
console.log(server.config.server.allowedHosts);
process.exit(0);
