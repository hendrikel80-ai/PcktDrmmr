import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generatePattern, UpstreamError } from './generatePattern.js';

// Eigener Variablenname statt PORT: unter `npm run dev:full` (concurrently)
// erben sowohl der Vite- als auch der Backend-Prozess dieselbe Shell-Umgebung
// — eine generische PORT-Variable (z.B. vom Preview-Tool für Vites autoPort
// gesetzt) würde sonst versehentlich auch dieses Backend umleiten.
const PORT = process.env.API_PORT || 3001;
const MAX_PROMPT_LENGTH = 300;

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/generate-pattern', async (req, res) => {
  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';

  if (!prompt) {
    return res.status(400).json({ error: 'prompt darf nicht leer sein' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res
      .status(400)
      .json({ error: `prompt darf maximal ${MAX_PROMPT_LENGTH} Zeichen lang sein` });
  }

  try {
    const pattern = await generatePattern(prompt);
    res.json({ pattern });
  } catch (err) {
    const status = err instanceof UpstreamError ? err.status : 500;
    console.error('generate-pattern failed:', err.message);
    res.status(status).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.listen(PORT, () => {
  console.log(`Pocket Drummer API läuft auf http://localhost:${PORT}`);
});
