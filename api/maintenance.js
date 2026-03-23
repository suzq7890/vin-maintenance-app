export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { vin } = req.body;

  if (!vin || vin.length !== 17) {
    return res.status(400).json({ error: 'Invalid VIN' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Step 1: Decode VIN via NHTSA
  let vehicle = null;
  try {
    const nhtsaRes = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${vin}?format=json`
    );
    const nhtsaData = await nhtsaRes.json();
    const r = nhtsaData.Results?.[0];

    // Detect commercial/fleet VINs (first char 1-5 = USA, but certain body classes indicate commercial)
    const isCommercial = r && r.BodyClass && (
      r.BodyClass.toLowerCase().includes('truck') && r.GVWR && r.GVWR.includes('Class') ||
      r.VehicleType === 'TRAILER' ||
      r.VehicleType === 'BUS' ||
      r.VehicleType === 'INCOMPLETE VEHICLE'
    );

    if (isCommercial) {
      return res.status(200).json({
        valid: false,
        reason: 'commercial',
        message: 'This appears to be a commercial or fleet vehicle. This tool is designed for personal passenger vehicles.',
      });
    }

    // Error code 11 = VIN not found in database
    if (!r || !r.Make) {
      return res.status(200).json({
        valid: false,
        reason: 'not_found',
        message: 'This VIN could not be found in the vehicle database. Please double-check for typos — common mistakes include the letter O instead of zero, or the letter I instead of the number 1.',
      });
    }

    // Error code 8 = invalid check digit (likely typo)
    if (r.ErrorCode === '8') {
      return res.status(200).json({
        valid: false,
        reason: 'invalid',
        message: 'This VIN has an invalid check digit, which usually means there is a typo. Double-check your VIN and try again.',
      });
    }

    vehicle = {
      year: r.ModelYear,
      make: r.Make,
      model: r.Model,
      trim: r.Trim || '',
      engine: r.DisplacementL
        ? parseFloat(r.DisplacementL).toFixed(1) + 'L ' + (r.EngineCylinders ? r.EngineCylinders + '-cyl' : '')
        : '',
      drive: r.DriveType || '',
      fuel: r.FuelTypePrimary || '',
    };
  } catch (err) {
    return res.status(500).json({ error: 'VIN decode failed: ' + err.message });
  }

  // Step 2: Claude generates maintenance tasks with intervalMiles
  const vehicleStr = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
    vehicle.engine,
    vehicle.drive,
    vehicle.fuel,
  ].filter(Boolean).join(' ');

  const prompt = `You are an automotive expert. Generate a maintenance schedule for a ${vehicleStr}.

Rules:
- Return ONLY raw JSON, no markdown, no code fences, nothing else
- Keep each "note" field under 100 characters
- Keep each "name" field under 40 characters
- "intervalMiles" must be an integer representing the recommended service interval in miles (e.g. 5000, 15000, 30000). Use 0 if the task is time-based only and has no mileage interval.

Required format (exactly 3 items per array, no more):
{"oil":[{"name":"...","interval":"...","note":"...","intervalMiles":5000},{"name":"...","interval":"...","note":"...","intervalMiles":5000},{"name":"...","interval":"...","note":"...","intervalMiles":5000}],"tires":[{"name":"...","interval":"...","note":"...","intervalMiles":6000},{"name":"...","interval":"...","note":"...","intervalMiles":6000},{"name":"...","interval":"...","note":"...","intervalMiles":6000}],"filters":[{"name":"...","interval":"...","note":"...","intervalMiles":15000},{"name":"...","interval":"...","note":"...","intervalMiles":15000},{"name":"...","interval":"...","note":"...","intervalMiles":15000}],"service":[{"name":"...","interval":"...","note":"...","intervalMiles":30000},{"name":"...","interval":"...","note":"...","intervalMiles":30000},{"name":"...","interval":"...","note":"...","intervalMiles":30000}]}

Generate vehicle-specific tasks. Use the correct oil type and capacity for this exact vehicle.`;

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
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(aiRes.status).json({ error: errText });
    }

    const aiData = await aiRes.json();
    let raw = (aiData.content || []).map((b) => b.text || '').join('').trim();
    raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'No JSON object found in response', raw });
    }

    const tasks = JSON.parse(raw.slice(start, end + 1));

    return res.status(200).json({
      valid: true,
      ...vehicle,
      ...tasks,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
