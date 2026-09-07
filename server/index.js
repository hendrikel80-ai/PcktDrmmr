import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generatePattern } from './generatePattern.js';
import { soundLike } from './soundLike.js';
import { UpstreamError } from './aiProvider.js';

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
    return res.status(400).json({ error: 'prompt must not be empty' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res
      .status(400)
      .json({ error: `prompt must be at most ${MAX_PROMPT_LENGTH} characters long` });
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

app.post('/api/sound-like', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';

  if (!query) {
    return res.status(400).json({ error: 'query must not be empty' });
  }
  if (query.length > MAX_PROMPT_LENGTH) {
    return res
      .status(400)
      .json({ error: `query must be at most ${MAX_PROMPT_LENGTH} characters long` });
  }

  try {
    const { suggestions, usedWebSearch } = await soundLike(query);
    res.json({ suggestions, usedWebSearch });
  } catch (err) {
    const status = err instanceof UpstreamError ? err.status : 500;
    console.error('sound-like failed:', err.message);
    res.status(status).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.listen(PORT, () => {
  console.log(`Pocket Studio API running on http://localhost:${PORT}`);
});
