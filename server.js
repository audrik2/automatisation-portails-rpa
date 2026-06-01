// server.js
import express from 'express';
import { exec } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const app = express();
app.use(express.json({ limit: '50mb' }));

const DOCUMENT_FIELDS = [
  'doc_bulletin_inscription',
  'doc_bulletin_salaire',
  'doc_piece_identite',
  'doc_rib',
];

// Middleware — validate Authorization header on every request
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || authHeader !== `Bearer ${process.env.API_SECRET}`) {
    console.warn('⚠️  Unauthorized request rejected');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
}

// Download a file from a URL and save it to a local path
async function downloadFile(url, localPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(localPath, buffer);
}

// Health check endpoint — no auth required
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'playwright-automation' });
});

// Main endpoint — requires Authorization header
app.post('/run', requireAuth, async (req, res) => {
  const payload = { ...req.body };
  console.log('📦 Payload received');

  // Validate required fields
  const requiredFields = [
    '2_num_action', '3a_branche', '3a_passeport',
    ...DOCUMENT_FIELDS,
  ];

  const missingFields = requiredFields.filter(f => !payload[f]);
  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missingFields.join(', ')}`,
    });
  }

  // Create unique temp folder in /tmp (RAM)
  const runId = Date.now();
  const tempDir = `/tmp/playwright-run-${runId}`;
  mkdirSync(tempDir, { recursive: true });
  console.log(`📁 Temp folder created: ${tempDir}`);

  try {
    // Download each document from its URL and save to temp folder
    for (const field of DOCUMENT_FIELDS) {
      const url = payload[field];
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split('/').pop() || `${field}.pdf`;
      const localPath = join(tempDir, filename);

      console.log(`⬇️  Downloading: ${field}`);
      await downloadFile(url, localPath);
      payload[field] = localPath;
      console.log(`💾 Saved to /tmp: ${filename}`);
    }

    console.log('▶️  All documents ready, starting automation...');

    const env = {
      ...process.env,
      PAYLOAD: JSON.stringify(payload),
    };

    exec('node main.js', { env, timeout: 600000, cwd: '/var/www/automatisation-portails-rpa' }, (err, stdout, stderr) => {

      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true });
        console.log(`🗑️  Temp folder deleted: ${tempDir}`);
      }

      console.log('stdout:', stdout);
      if (stderr) console.error('stderr:', stderr);

      if (err) {
        console.error('❌ Automation failed:', err.message);
        return res.status(500).json({
          success: false,
          error: err.message,
          stdout,
          stderr,
        });
      }

      console.log('✅ Automation completed');
      res.json({ success: true, message: 'Automation completed', stdout });
    });

  } catch (err) {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
      console.log(`🗑️  Temp folder deleted after error: ${tempDir}`);
    }

    console.error('❌ Setup failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Playwright service running on port ${PORT}`);
});