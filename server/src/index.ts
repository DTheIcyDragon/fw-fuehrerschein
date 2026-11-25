import path from 'node:path';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');

const { app, close } = createApp({ dataDir: DATA_DIR });

const server = app.listen(PORT, () => {
  console.log(`Feuerwehr-Führerscheinverwaltung läuft auf Port ${PORT} (DATA_DIR=${DATA_DIR})`);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Signal ${signal} empfangen, fahre Server herunter...`);
  server.close(() => {
    close();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
