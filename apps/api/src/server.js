import { readConfig } from './config.js';
import { bootstrap } from './bootstrap.js';
import { createApp } from './app.js';

const config = readConfig();
const service = await bootstrap(config); // Ready before traffic: index/embedding errors fail startup explicitly.
const server = createApp(service).listen(config.port, '127.0.0.1', () => {
  console.log(
    `RAG API ready at http://127.0.0.1:${config.port} (${config.provider}, ${config.vectorStore})`,
  );
});
server.requestTimeout = 130000;
// Gracefully stop accepting traffic; a short deadline prevents hung provider calls blocking shutdown.
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
