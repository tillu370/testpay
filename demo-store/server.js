import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const WEBHOOK_SECRET = process.env.YOUPI_WEBHOOK_SECRET || 'youpi_dev_webhook_secret_key_12345';

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Authoritative Webhook Receiver
  if (req.method === 'POST' && pathname === '/api/webhook') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      const signature = req.headers['x-gateway-signature'] || '';

      // Verify HMAC-SHA256 signature
      const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
      const isValid = (signature.length === expected.length) && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

      console.log('\n========================================');
      console.log('⚡ [AuraGear Store] Inbound Webhook Received!');
      console.log('Signature Valid:', isValid ? '✅ MATCHED' : '❌ MISMATCH');

      try {
        const payload = JSON.parse(rawBody.toString('utf8'));
        console.log('Event:', payload.event);
        console.log('Order ID:', payload.orderId);
        console.log('Amount:', payload.amount);
        console.log('Bank UTR:', payload.utr);
        console.log('Payment Method:', payload.method);
      } catch (e) {
        console.log('Raw Payload:', rawBody.toString('utf8'));
      }
      console.log('========================================\n');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true, verified: isValid }));
    });
    return;
  }

  // 2. Checkout Session Creator (Server-to-Server)
  if (req.method === 'POST' && pathname === '/api/checkout') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const orderId = body.orderId || `AURA-ORD-${Date.now()}`;
        const amount = Number(body.amount || 1.00);

        const apiRes = await fetch('http://localhost:6100/api/v1/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            amount,
            currency: 'INR',
            description: body.name || 'AuraGear Purchase',
            metadata: { store: 'AuraGear Store' }
          })
        });

        const data = await apiRes.json();
        res.writeHead(apiRes.status, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 2. Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`\n============================================================`);
  console.log(`✨ AuraGear YouPI Demo Store is running!`);
  console.log(`👉 URL: http://localhost:${PORT}`);
  console.log(`👉 Webhook Endpoint: http://localhost:${PORT}/api/webhook`);
  console.log(`============================================================\n`);
});
