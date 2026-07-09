// server.js
import 'dotenv/config';
import express from 'express';
import { exec } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const app = express();
app.use(express.json({ limit: '50mb' }));

// Required fields per sync_type
const REQUIRED_FIELDS_BY_SYNC_TYPE = {
  inscrire_apprenant: [
    'sync_type', '2_num_action', '3_branche', '3_first_name', '3_last_name', '3a_birth_year',
  ],
  documents_inscription: [
    'sync_type', '2_num_action', '3_civility', '3_first_name', '3_last_name',
    'doc_bulletin_inscription', 'doc_bulletin_salaire', 'doc_piece_identite', 'doc_rib',
  ],
  documents_facturation: [
    'sync_type', '2_num_action', '3_civility', '3_first_name', '3_last_name',
    '4_doc_bilan', '4_doc_emargement',
  ],
};

// Document fields per sync_type
const DOCUMENT_FIELDS_BY_SYNC_TYPE = {
  inscrire_apprenant: [],
  documents_inscription: ['doc_bulletin_inscription', 'doc_bulletin_salaire', 'doc_piece_identite', 'doc_rib'],
  documents_facturation: ['4_doc_bilan', '4_doc_emargement'],
};

// Final step per sync_type — used to determine overall success
const FINAL_STEP_BY_SYNC_TYPE = {
  inscrire_apprenant: '5_remboursement.js',
  documents_inscription: '4_importer_documents_inscription.js',
  documents_facturation: '4_importer_documents_facturation.js',
};

// Middleware — validate Authorization header
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${process.env.API_SECRET}`) {
    console.warn('Unauthorized request rejected');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// Middleware — restrict access to n8n IP only
function requireAllowedIP(req, res, next) {
  const allowedIP = process.env.ALLOWED_IP;
  if (!allowedIP) return next();

  const requestIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const cleanIP = requestIP.replace(/^::ffff:/, '');

  if (cleanIP !== allowedIP) {
    console.warn(`Rejected request from unauthorized IP: ${cleanIP}`);
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
}

// Parse __STEP_RESULT__ lines from stdout
function parseStepResults(stdout) {
  return stdout
    .split('\n')
    .filter(l => l.includes('__STEP_RESULT__'))
    .map(l => {
      try {
        return JSON.parse(l.split('__STEP_RESULT__')[1]);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
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

// Health check endpoint — requires IP check + Authorization header
app.get('/health', requireAllowedIP, requireAuth, (req, res) => {
  res.json({ status: 'ok', service: 'playwright-automation' });
});

// Main endpoint — requires IP check + Authorization header
app.post('/run', requireAllowedIP, requireAuth, async (req, res) => {
  const payload = { ...req.body };
  const syncType = payload['sync_type'];
  console.log('Payload received — sync_type:', syncType);

  // Validate sync_type is known
  const requiredFields = REQUIRED_FIELDS_BY_SYNC_TYPE[syncType];
  const documentFields = DOCUMENT_FIELDS_BY_SYNC_TYPE[syncType];
  const finalStep = FINAL_STEP_BY_SYNC_TYPE[syncType];

  if (!requiredFields) {
    return res.status(400).json({
      success: false,
      error: `Unknown sync_type: ${syncType}`,
    });
  }

  // Validate required fields for this sync_type
  const missingFields = requiredFields.filter(f => !payload[f]);
  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields for ${syncType}: ${missingFields.join(', ')}`,
    });
  }

  // Create unique temp folder in /tmp (RAM)
  const runId = Date.now();
  const tempDir = `/tmp/playwright-run-${runId}`;
  mkdirSync(tempDir, { recursive: true });
  console.log(`Temp folder created: ${tempDir}`);

  try {
    // Download documents relevant to this sync_type only
    for (const field of documentFields) {
      const url = payload[field];
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split('/').pop() || `${field}.pdf`;
      const localPath = join(tempDir, filename);

      console.log(`Downloading: ${field}`);
      await downloadFile(url, localPath);
      payload[field] = localPath;
      console.log(`Saved to /tmp: ${filename}`);
    }

    console.log('All documents ready, starting automation...');

    const env = {
      ...process.env,
      PAYLOAD: JSON.stringify(payload),
    };

    exec('node main.js', { env, timeout: 600000, cwd: '/var/www/automatisation-portails-rpa' }, (err, stdout, stderr) => {

      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true });
        console.log(`Temp folder deleted: ${tempDir}`);
      }

      if (stderr) console.error('stderr:', stderr);

      // Parse step results from stdout
      const stepResults = parseStepResults(stdout || '');

      // Last step that was executed
      const lastStep = stepResults[stepResults.length - 1] || null;

      // Overall success only if the final step of the branch completed with success
      const finalStepResult = stepResults.filter(s => s.step === finalStep).pop();
      const overallSuccess = finalStepResult?.status === 'success';

      if (err) {
        console.error('Automation failed:', err.message);
        return res.status(500).json({
          success: false,
          // Output 1 — full step details
          steps: stepResults,
          // Output 2 — last step summary
          last_step: lastStep?.step || null,
          status: lastStep?.status || null,
          status_code: lastStep?.status_code || null,
          message: lastStep?.message || null,
          error: err.message,
        });
      }

      console.log('Automation completed');
      res.json({
        success: overallSuccess,
        // Output 1 — full step details
        steps: stepResults,
        // Output 2 — last step summary
        last_step: lastStep?.step || null,
        status: lastStep?.status || null,
        status_code: lastStep?.status_code || null,
        message: lastStep?.message || null,
      });
    });

  } catch (err) {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
      console.log(`Temp folder deleted after error: ${tempDir}`);
    }

    console.error('Setup failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Playwright service running on port ${PORT}`);
});