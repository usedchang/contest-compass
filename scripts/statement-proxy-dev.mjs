import { createServer } from 'node:http';
import worker from '../server/statement-worker/worker.mjs';

const port = Number(process.env.STATEMENT_DEV_PORT || 8788);
createServer(async (request, response) => {
  try {
    const url = `http://127.0.0.1:${port}${request.url}`;
    const upstream = await worker.fetch(new Request(url, { method: request.method, headers: request.headers }));
    response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: error.message }));
  }
}).listen(port, '127.0.0.1', () => console.log(`Statement proxy: http://127.0.0.1:${port}`));
