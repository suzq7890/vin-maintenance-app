// canAccessChat: single function to control access to chat feature
// To gate behind paywall later, replace `return true` with subscription check
function canAccessChat(req) {
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!canAccessChat(req)) {
    return res.status(403).json({ error: 'Chat is a premium feature. Please upgrade to access.' });
  }

  const { vehicle, messages } = req.body;

  if (!vehicle || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const vehicleStr = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
    vehicle.engine,
    vehicle.drive,
    vehicle.fuel,
  ].filter(Boolean).join(' ');

  const systemPrompt = `You are a knowledgeable automotive advisor helping the owner of a ${vehicleStr}.

Your role is to answer questions as if you have read and understood the owner's manual for this specific vehicle. You help the owner:
- Understand what maintenance they actually need and when
- Know whether a service recommendation from a shop is legitimate or unnecessary
- Understand warning lights, sounds, or symptoms
- Interpret maintenance schedules in plain English
- Feel confident and informed before or during a service appointment

Guidelines:
- Always be specific to the ${vehicleStr} — not generic car advice
- Use plain, simple language — avoid jargon unless you explain it
- Be direct and honest — if a shop recommendation sounds like an upsell, say so clearly
- If you're uncertain about a specific detail, say "I'd recommend verifying this in your owner's manual" rather than guessing
- Keep responses concise — the user is often on their phone in a waiting room
- Never recommend ignoring safety-critical maintenance`;

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(aiRes.status).json({ error: errText });
    }

    const aiData = await aiRes.json();
    const reply = (aiData.content || []).map((b) => b.text || '').join('').trim();

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
