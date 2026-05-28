// helpers/payload.js
import { readFileSync } from 'fs';

export function getPayload() {
  // Production — payload passed as environment variable by n8n
  if (process.env.PAYLOAD) {
    return JSON.parse(process.env.PAYLOAD);
  }

  // Local testing — read from payload.json if it exists
  try {
    return JSON.parse(readFileSync('./payload.json', 'utf-8'));
  } catch {
    throw new Error(
      'No payload found. Either set the PAYLOAD environment variable or create payload.json for local testing.'
    );
  }
}