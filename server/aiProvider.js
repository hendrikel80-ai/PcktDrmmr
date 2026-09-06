// Provider-Abstraktion, damit generatePattern.js und soundLike.js nicht
// fest an Anthropics API-Form gebunden sind. Provider per AI_PROVIDER in
// .env wählen (aktuell "anthropic" | "deepseek", Default "anthropic") —
// beide Features (Drum-Patterns, Sound Like) laufen über denselben
// Provider, eine gemeinsame Einstellung statt zwei getrennte.
//
// DeepSeeks öffentliche API hat kein zu Anthropics `web_search_20250305`
// äquivalentes serverseitiges Web-Search-Tool. `callChatModel({webSearch:
// true})` wird bei Providern ohne Unterstützung dafür einfach ignoriert
// (kein Fehler) — der Rückgabewert `usedWebSearch` sagt dem Aufrufer, ob
// tatsächlich recherchiert wurde, damit z.B. Sound Like das transparent
// in der UI anzeigen kann statt eine Websuche vorzutäuschen, die nicht
// stattgefunden hat.

class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function callAnthropic({ system, userMessage, maxTokens, webSearch }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new UpstreamError('ANTHROPIC_API_KEY ist nicht gesetzt (siehe .env.example)', 500);
  }
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  };
  if (webSearch) {
    // max_uses begrenzt Kosten/Latenz pro Anfrage.
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new UpstreamError(`Anthropic API antwortete mit ${response.status}: ${bodyText.slice(0, 300)}`, 502);
  }

  const data = await response.json();
  // Mit aktiviertem Web-Search-Tool enthält `content` zusätzlich zu Text
  // auch server_tool_use-/web_search_tool_result-Blöcke — nur die
  // Text-Blöcke zusammen ergeben die eigentliche Antwort.
  const text = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  if (!text) {
    throw new UpstreamError('Anthropic API lieferte keinen Text-Content', 502);
  }
  return { text, usedWebSearch: Boolean(webSearch) };
}

async function callDeepSeek({ system, userMessage, maxTokens }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new UpstreamError('DEEPSEEK_API_KEY ist nicht gesetzt (siehe .env.example)', 500);
  }
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
      // OpenAI-kompatibles JSON-Mode-Flag: DeepSeeks Chat-Completions-API
      // unterstützt das analog zu OpenAI und macht gültiges JSON deutlich
      // zuverlässiger — Anthropic hat kein Äquivalent, deshalb nur hier.
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new UpstreamError(`DeepSeek API antwortete mit ${response.status}: ${bodyText.slice(0, 300)}`, 502);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) {
    throw new UpstreamError('DeepSeek API lieferte keinen Text-Content', 502);
  }
  // Kein serverseitiges Web-Search-Tool verfügbar (siehe Moduldoc) — auch
  // bei angefragter Websuche war es keine.
  return { text, usedWebSearch: false };
}

const PROVIDERS = {
  anthropic: callAnthropic,
  deepseek: callDeepSeek,
};

/// Sendet einen System+User-Prompt an den in AI_PROVIDER konfigurierten
/// Provider und liefert `{ text, usedWebSearch }` zurück. `webSearch: true`
/// aktiviert Websuche nur bei Providern, die das unterstützen — der
/// Aufrufer muss `usedWebSearch` prüfen statt es anzunehmen.
export async function callChatModel({ system, userMessage, maxTokens, webSearch = false }) {
  const providerName = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
  const impl = PROVIDERS[providerName];
  if (!impl) {
    throw new UpstreamError(
      `Unbekannter AI_PROVIDER "${providerName}" — unterstützt: ${Object.keys(PROVIDERS).join(', ')}`,
      500
    );
  }
  return impl({ system, userMessage, maxTokens, webSearch });
}

export { UpstreamError };
