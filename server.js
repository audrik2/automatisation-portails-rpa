// server.js
import express from 'express';
import { exec } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const app = express();

// Increase body size limit to handle 4 base64-encoded documents
app.use(express.json({ limit: '50mb' }));

// Document fields that contain base64 file content sent by n8n
const DOCUMENT_FIELDS = [
  'doc_bulletin_inscription',
  'doc_bulletin_salaire',
  'doc_piece_identite',
  'doc_rib',
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'playwright-automation' });
});

// Main endpoint — receives payload from n8n and runs main.js
app.post('/run', async (req, res) => {
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

  // Create a unique temp folder for this run in /tmp (RAM — not disk)
  const runId = Date.now();
  const tempDir = `/tmp/playwright-run-${runId}`;
  mkdirSync(tempDir, { recursive: true });
  console.log(`📁 Temp folder created: ${tempDir}`);

  try {
    // Decode each base64 document and save to temp folder
    for (const field of DOCUMENT_FIELDS) {
      const { filename, content } = payload[field];
      const localPath = join(tempDir, filename);
      writeFileSync(localPath, Buffer.from(content, 'base64'));
      payload[field] = localPath;
      console.log(`💾 Saved to /tmp: ${filename}`);
    }

    console.log('▶️  All documents ready, starting automation...');

    const env = {
      ...process.env,
      PAYLOAD: JSON.stringify(payload),
    };

    exec('node main.js', { env, timeout: 600000, cwd: '/var/www/automatisation-portails-rpa' }, (err, stdout, stderr) => {

      // Always delete temp files after run
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
