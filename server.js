// server.js
import 'dotenv/config';
import express from 'express';
import { exec } from 'child_process';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import PQueue from 'p-queue';

// Dossier du projet : deduit de l'emplacement de ce fichier, donc valable
// en local comme en prod. APP_DIR permet de forcer une autre valeur.
const PROJECT_DIR = process.env.APP_DIR || dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '50mb' }));

// ─────────────────────────────────────────────────────────────
// File d'attente : un seul run Playwright a la fois.
// Les requetes suivantes patientent ici et sont traitees en FIFO.
// ─────────────────────────────────────────────────────────────
const queue = new PQueue({ concurrency: 1 });

// Pire cas mesure : 66s par run. On budgete 70s pour la marge.
const RUN_BUDGET_SECONDS = 70;
// Au-dela, on refuse en 503. 20 x 70s = ~23min d'attente pour le dernier arrive,
// +66s pour son propre run = ~25min. Le `timeout` du noeud execute_playright
// cote n8n doit donc etre au minimum a 1800000 (30 min).
const MAX_WAITING = 20;

// Message affiche a l'utilisateur quand le run echoue sans qu'aucune etape
// n'ait pu etre loguee (crash au demarrage, timeout de exec, SIGTERM).
const FALLBACK_ERROR_MESSAGE = 'Erreur : le traitement a échoué';

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

// ─────────────────────────────────────────────────────────────
// Resume destine a n8n. Les etapes en repli (status 'skipped')
// sont exclues du resume : leur echec est un cas nominal, elles
// ne doivent jamais devenir le message utilisateur. Elles restent
// visibles dans `steps` pour le diagnostic.
// ─────────────────────────────────────────────────────────────
function summarize(stepResults) {
  const reportable = stepResults.filter(s => s.status !== 'skipped');
  const lastStep = reportable[reportable.length - 1] || null;

  return {
    last_step: lastStep?.step || null,
    status: lastStep?.status || 'error',
    status_code: lastStep?.status_code || 400,
    message: lastStep?.message || FALLBACK_ERROR_MESSAGE,
  };
}

// Download a file from a URL and save it to a local path
async function downloadFile(url, localPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(localPath, buffer);

  // ── Diagnostic : le portail Iperia refuse en CLIENT_ERROR les fichiers
  // qui ne correspondent pas a leur extension, sont vides, ou depassent 10 Mo.
  // On verifie les octets magiques plutot que de faire confiance au nom.
  const head = buffer.subarray(0, 4);
  let realType = 'inconnu';
  if (head.toString('latin1', 0, 4) === '%PDF') realType = 'pdf';
  else if (head[0] === 0xff && head[1] === 0xd8) realType = 'jpeg';
  else if (head[0] === 0x89 && head.toString('latin1', 1, 4) === 'PNG') realType = 'png';
  else if (buffer.subarray(0, 200).toString('utf8').trim().match(/^[<{]/)) realType = 'HTML/JSON (!)';

  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  const ext = localPath.split('.').pop().toLowerCase();
  const mismatch = (ext === 'pdf' && realType !== 'pdf')
    || (['jpg', 'jpeg'].includes(ext) && realType !== 'jpeg')
    || (ext === 'png' && realType !== 'png');

  console.log(`   ↳ ${sizeMB} Mo — contenu réel : ${realType} — extension : .${ext}` +
    (mismatch ? '  ⚠️  INCOHÉRENT' : '') +
    (buffer.length > 10 * 1024 * 1024 ? '  ⚠️  > 10 Mo (refusé par Iperia)' : '') +
    (buffer.length === 0 ? '  ⚠️  FICHIER VIDE' : ''));
}

// ─────────────────────────────────────────────────────────────
// exec() promisifie : c'est LA piece maitresse.
// Sans ca, la fonction rendrait la main des le lancement du
// process et la file se libererait avant la fin du run.
// On resout toujours (jamais de rejet) pour recuperer stdout
// meme en cas d'erreur.
// ─────────────────────────────────────────────────────────────
function execAutomation(env) {
  return new Promise((resolve) => {
    exec(
      'node main.js',
      { env, timeout: 300000, cwd: PROJECT_DIR },
      (err, stdout, stderr) => resolve({ err, stdout, stderr })
    );
  });
}

// ─────────────────────────────────────────────────────────────
// Le travail serialise : telechargement des documents + run.
// Ne touche jamais a `res` — retourne { httpStatus, body }.
// ─────────────────────────────────────────────────────────────
async function processRun(payload, documentFields, finalStep) {
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

    const { err, stdout, stderr } = await execAutomation(env);

    if (stderr) console.error('stderr:', stderr);

    // Parse step results from stdout
    const stepResults = parseStepResults(stdout || '');

    // Output 2 — last step summary, avec repli si aucune etape n'a ete loguee
    const summary = summarize(stepResults);

    // Overall success only if the final step of the branch completed with success
    const finalStepResult = stepResults.filter(s => s.step === finalStep).pop();
    const overallSuccess = finalStepResult?.status === 'success';

    if (err) {
      console.error('Automation failed:', err.message);
      return {
        httpStatus: 500,
        body: {
          success: false,
          // Output 1 — full step details
          steps: stepResults,
          // Output 2 — last step summary
          ...summary,
          // Trace technique : logs et support uniquement, pas d'affichage
          debug: err.message,
        },
      };
    }

    console.log('Automation completed');
    return {
      httpStatus: 200,
      body: {
        success: overallSuccess,
        // Output 1 — full step details
        steps: stepResults,
        // Output 2 — last step summary
        ...summary,
      },
    };

  } finally {
    // Nettoyage garanti, succes comme echec
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
      console.log(`Temp folder deleted: ${tempDir}`);
    }
  }
}

// Health check endpoint — requires IP check + Authorization header
app.get('/health', requireAllowedIP, requireAuth, (req, res) => {
  res.json({
    status: 'ok',
    service: 'playwright-automation',
    queue: { waiting: queue.size, running: queue.pending },
  });
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

  // ── Validations hors file : rejet immediat, aucune place occupee ──
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

  // ── Garde-fou : refuser franchement plutot que faire attendre trop longtemps ──
  if (queue.size >= MAX_WAITING) {
    console.warn(`[queue] saturée (${queue.size} en attente) — rejet de ${syncType}`);
    return res.status(503).json({
      success: false,
      error: `File saturée (${queue.size} en attente). Réessayer plus tard.`,
      retry_after_seconds: queue.size * RUN_BUDGET_SECONDS,
    });
  }

  // ── Mise en file ──
  const position = queue.size + queue.pending;
  if (position > 0) {
    console.log(`[queue] ${syncType} mis en attente — ${position} devant lui`);
  }

  // Si n8n abandonne (timeout, coupure reseau), on le note.
  let clientGone = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientGone = true;
      console.warn(`[queue] client deconnecte avant la fin — ${syncType}`);
    }
  });

  try {
    const result = await queue.add(async () => {
      // Le client a abandonne pendant l'attente : inutile de traiter.
      // Sinon le dossier serait modifie dans Iperia alors que n8n a deja
      // renvoye une erreur — incoherence et risque de double traitement.
      if (clientGone) {
        console.warn(`[queue] ${syncType} abandonné avant exécution — run annulé`);
        return null;
      }
      return processRun(payload, documentFields, finalStep);
    });

    if (result === null) return;

    if (clientGone) {
      console.warn('[queue] run termine mais client deja parti, reponse ignoree');
      return;
    }
    return res.status(result.httpStatus).json(result.body);

  } catch (err) {
    console.error('Setup failed:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Playwright service running on port ${PORT} — concurrency 1`);
});
