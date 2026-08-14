import { createServer } from 'vite';
const server = await createServer({
  server: { middlewareMode: true, allowedHosts: true },
  appType: 'spa'
});
console.log('Vite server created');
process.exit(0);
