// Edge Function: analiza una foto de comida con Claude y devuelve una lista editable.
// Secreto requerido: ANTHROPIC_API_KEY (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen incluidos).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MODEL = 'claude-haiku-5-5';
const DAILY_LIMIT = 4;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};

const SYSTEM = `Eres un nutricionista que analiza fotos de comida. Identifica cada alimento visible y estima la porción en gramos.
Responde SOLO con JSON válido, sin texto adicional ni bloques de código, con esta forma:
{"items":[{"name":"nombre en español","match":"nombre exacto del catálogo o null","grams":150,"confidence":"alta|media|baja","kcal_100g":0,"protein_100g":0,"carbs_100g":0,"fat_100g":0}],"note":"aviso breve opcional"}
Reglas: usa en "match" el nombre EXACTO del catálogo cuando el alimento coincida; si no coincide, pon null y estima los valores por 100 g.
No inventes alimentos que no se ven. Si la imagen no contiene comida, devuelve {"items":[],"note":"No veo comida en la imagen"}.
Si no puedes distinguir salsas, aceites o ingredientes mezclados, indícalo en "note". Máximo 10 alimentos.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let claimedFor: string | null = null;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u.user) return json({ error: 'unauthorized', message: 'Inicia sesión para usar esta función.' }, 401);

    const body = await req.json();
    const image = typeof body.image === 'string' ? body.image : '';
    const mediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(body.mediaType) ? body.mediaType : 'image/jpeg';
    if (!image || image.length > 6_000_000) return json({ error: 'bad_image', message: 'La imagen no es válida o es demasiado grande.' }, 400);
    const catalog: string[] = Array.isArray(body.catalog)
      ? body.catalog.filter((x: unknown) => typeof x === 'string').slice(0, 300).map((x: string) => x.slice(0, 60)) : [];

    // Reserva atómica de una foto del día (límite aplicado en el servidor)
    const { data: left, error: ce } = await admin.rpc('claim_photo_slot', { p_user: u.user.id, p_limit: DAILY_LIMIT });
    if (ce) {
      if (ce.message.includes('limit_reached'))
        return json({ error: 'limit_reached', message: `Llegaste al límite de ${DAILY_LIMIT} fotos por hoy. Puedes seguir registrando a mano.` }, 429);
      throw ce;
    }
    claimedFor = u.user.id;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1200, system: SYSTEM,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: `Catálogo: ${catalog.join('; ')}\n\nAnaliza esta comida.` },
        ] }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic_${res.status}: ${(await res.text()).slice(0, 300)}`);
    const out = await res.json();
    const text: string = (out.content ?? []).map((b: { text?: string }) => b.text ?? '').join('');
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

    const items = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 12).map((it: Record<string, unknown>) => ({
      name: String(it.name ?? '').slice(0, 60),
      match: typeof it.match === 'string' ? it.match.slice(0, 60) : null,
      grams: Math.round(num(it.grams, 1, 1500)),
      confidence: ['alta', 'media', 'baja'].includes(String(it.confidence)) ? String(it.confidence) : 'media',
      kcal_100g: num(it.kcal_100g, 0, 900), protein_100g: num(it.protein_100g, 0, 100),
      carbs_100g: num(it.carbs_100g, 0, 100), fat_100g: num(it.fat_100g, 0, 100),
    })).filter((i: { name: string; grams: number }) => i.name && i.grams > 0);

    return json({ items, note: typeof parsed.note === 'string' ? parsed.note.slice(0, 200) : '', remaining: left });
  } catch (e) {
    console.error('analyze-meal error:', e);
    // Si el análisis falló, devolvemos la foto reservada
    if (claimedFor) await admin.rpc('release_photo_slot', { p_user: claimedFor });
    const detail = String((e as { message?: string })?.message ?? e).replace(/sk-ant-[A-Za-z0-9_-]+/g, '***').slice(0, 300);
    return json({ error: 'failed', message: 'No pudimos analizar la foto. No se descontó de tu límite.', detail }, 502);
  }
});
