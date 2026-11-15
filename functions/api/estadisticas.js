// Cloudflare Pages Function: GET /api/estadisticas?dias=30
// Returns store sales (Shopify) and site visits (Google Analytics) for the panel's «Estadísticas» tab.
// Only answers to the team account signed in with Firebase. Secrets live in the Cloudflare project settings:
//   SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET  credentials of the read-only Dev Dashboard app installed on the store
//                  (exchanged for a 24-hour token with the client credentials grant); SHOPIFY_TOKEN still works instead
//   GA_CLAVE_JSON  full JSON key of the Google Cloud service account that can read the Analytics property
// Plain settings (with defaults): FIREBASE_PROYECTO, CUENTA_EQUIPO, SHOPIFY_TIENDA, SHOPIFY_VERSION, GA_PROPIEDAD.

const ZONA = 'Europe/Madrid';
const CACHE_SEGUNDOS = 600;
const JWKS_FIREBASE = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const ajustes = (env) => ({
  proyecto: env.FIREBASE_PROYECTO || 'dormily-panel',
  cuenta: env.CUENTA_EQUIPO || 'panel@dormily.es',
  tienda: env.SHOPIFY_TIENDA || 'de800h-ms.myshopify.com',
  version: env.SHOPIFY_VERSION || '2026-07',
  propiedad: env.GA_PROPIEDAD || '564410947'
});

const json = (datos, estado = 200, extra = {}) =>
  new Response(JSON.stringify(datos), { status: estado, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra) });

/* ---------- base64url helpers ---------- */
const deB64url = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const aB64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jsonB64url = (o) => aB64url(new TextEncoder().encode(JSON.stringify(o)));

/* ---------- Firebase sign-in check ---------- */
async function verificarFirebase(token, a) {
  const partes = (token || '').split('.');
  if (partes.length !== 3) throw new Error('token');
  const [h, p, s] = partes;
  const cab = JSON.parse(new TextDecoder().decode(deB64url(h)));
  const datos = JSON.parse(new TextDecoder().decode(deB64url(p)));
  if (cab.alg !== 'RS256') throw new Error('token');
  const claves = await (await fetch(JWKS_FIREBASE, { cf: { cacheTtl: 3600, cacheEverything: true } })).json();
  const jwk = (claves.keys || []).find((k) => k.kid === cab.kid);
  if (!jwk) throw new Error('token');
  const clave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valida = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clave, deB64url(s), new TextEncoder().encode(h + '.' + p));
  const ahora = Math.floor(Date.now() / 1000);
  if (!valida || datos.aud !== a.proyecto || datos.iss !== 'https://securetoken.google.com/' + a.proyecto ||
    !(datos.exp > ahora) || !(datos.iat <= ahora + 60) || (datos.email || '').toLowerCase() !== a.cuenta.toLowerCase()) throw new Error('token');
}

/* ---------- Dates in Madrid time ---------- */
const fechaMadrid = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
function diasAtras(n) {
  const lista = [];
  for (let i = n - 1; i >= 0; i--) lista.push(fechaMadrid(new Date(Date.now() - i * 86400000)));
  return lista;
}

/* ---------- Shopify ---------- */
const CONSULTA_PEDIDOS = `query Pedidos($q: String!, $c: String) {
  orders(first: 100, after: $c, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      createdAt cancelledAt test
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      lineItems(first: 30) { nodes { title quantity } }
    }
  }
}`;

// Dev Dashboard apps get a 24-hour token from their client ID and secret; it is reused while this worker stays warm.
let tokenShopify = { valor: null, caduca: 0 };
async function accesoShopify(env, a) {
  if (env.SHOPIFY_TOKEN) return env.SHOPIFY_TOKEN;
  if (tokenShopify.valor && Date.now() < tokenShopify.caduca) return tokenShopify.valor;
  const r = await fetch('https://' + a.tienda + '/admin/oauth/access_token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.SHOPIFY_CLIENT_ID, client_secret: env.SHOPIFY_CLIENT_SECRET })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error('Shopify no dio acceso (' + r.status + (d.error_description || d.error ? ': ' + (d.error_description || d.error) : '') + ')');
  tokenShopify = { valor: d.access_token, caduca: Date.now() + Math.max(60, (d.expires_in || 86399) - 300) * 1000 };
  return tokenShopify.valor;
}

async function datosShopify(env, a, dias) {
  if (!env.SHOPIFY_TOKEN && !(env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET)) return { configurado: false };
  const acceso = await accesoShopify(env, a);
  const fechas = diasAtras(dias);
  const porDia = Object.fromEntries(fechas.map((f) => [f, { ventas: 0, pedidos: 0 }]));
  const productos = {};
  let ventas = 0, pedidos = 0, moneda = 'EUR', cursor = null;
  for (let pagina = 0; pagina < 20; pagina++) {
    const r = await fetch('https://' + a.tienda + '/admin/api/' + a.version + '/graphql.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': acceso },
      body: JSON.stringify({ query: CONSULTA_PEDIDOS, variables: { q: 'created_at:>=' + fechas[0], c: cursor } })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.errors) throw new Error('Shopify respondió ' + r.status + (d.errors ? ': ' + JSON.stringify(d.errors).slice(0, 160) : ''));
    for (const o of d.data.orders.nodes) {
      if (o.test || o.cancelledAt) continue;
      const dia = fechaMadrid(new Date(o.createdAt));
      if (!porDia[dia]) continue;
      const importe = Number(o.currentTotalPriceSet.shopMoney.amount) || 0;
      moneda = o.currentTotalPriceSet.shopMoney.currencyCode || moneda;
      ventas += importe; pedidos += 1;
      porDia[dia].ventas += importe; porDia[dia].pedidos += 1;
      for (const l of o.lineItems.nodes) productos[l.title] = (productos[l.title] || 0) + (l.quantity || 0);
    }
    if (!d.data.orders.pageInfo.hasNextPage) break;
    cursor = d.data.orders.pageInfo.endCursor;
  }
  return {
    configurado: true, moneda, ventas, pedidos, ticket: pedidos ? ventas / pedidos : 0, porDia,
    productos: Object.entries(productos).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([titulo, unidades]) => ({ titulo, unidades }))
  };
}

/* ---------- Google Analytics ---------- */
async function tokenGoogle(clave) {
  const ahora = Math.floor(Date.now() / 1000);
  const firmar = jsonB64url({ alg: 'RS256', typ: 'JWT' }) + '.' + jsonB64url({
    iss: clave.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600
  });
  const pem = clave.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const llave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', llave, new TextEncoder().encode(firmar));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + firmar + '.' + aB64url(firma)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error('Google no dio acceso (' + r.status + ')');
  return d.access_token;
}

const EMBUDO = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase'];

async function datosAnalytics(env, a, dias) {
  if (!env.GA_CLAVE_JSON) return { configurado: false };
  let clave;
  try { clave = JSON.parse(env.GA_CLAVE_JSON); } catch (e) { throw new Error('La clave GA_CLAVE_JSON no es un JSON válido'); }
  const acceso = await tokenGoogle(clave);
  const rango = [{ startDate: (dias - 1) + 'daysAgo', endDate: 'today' }];
  const top = (dim, met) => ({ dateRanges: rango, dimensions: [{ name: dim }], metrics: [{ name: met }], orderBys: [{ metric: { metricName: met }, desc: true }], limit: 8 });
  const r = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/' + a.propiedad + ':batchRunReports', {
    method: 'POST', headers: { authorization: 'Bearer ' + acceso, 'content-type': 'application/json' },
    body: JSON.stringify({ requests: [
      { dateRanges: rango, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }] },
      { dateRanges: rango, metrics: [{ name: 'activeUsers' }, { name: 'sessions' }] },
      top('sessionSourceMedium', 'sessions'),
      top('pagePath', 'screenPageViews'),
      { dateRanges: rango, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }],
        dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: EMBUDO } } } }
    ] })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Analytics respondió ' + r.status + (d.error ? ': ' + d.error.message : ''));
  const [porFecha, totales, fuentes, paginas, eventos] = d.reports;
  const filas = (rep) => rep.rows || [];
  const fechas = diasAtras(dias);
  const porDia = Object.fromEntries(fechas.map((f) => [f, { usuarios: 0, sesiones: 0 }]));
  for (const f of filas(porFecha)) {
    const v = f.dimensionValues[0].value;
    const dia = v.slice(0, 4) + '-' + v.slice(4, 6) + '-' + v.slice(6, 8);
    if (porDia[dia]) porDia[dia] = { usuarios: Number(f.metricValues[0].value), sesiones: Number(f.metricValues[1].value) };
  }
  const tot = filas(totales)[0];
  const embudo = Object.fromEntries(EMBUDO.map((e) => [e, 0]));
  for (const f of filas(eventos)) embudo[f.dimensionValues[0].value] = Number(f.metricValues[0].value);
  return {
    configurado: true,
    usuarios: tot ? Number(tot.metricValues[0].value) : 0,
    sesiones: tot ? Number(tot.metricValues[1].value) : 0,
    porDia,
    fuentes: filas(fuentes).map((f) => ({ nombre: f.dimensionValues[0].value, sesiones: Number(f.metricValues[0].value) })),
    paginas: filas(paginas).map((f) => ({ ruta: f.dimensionValues[0].value, vistas: Number(f.metricValues[0].value) })),
    embudo
  };
}

const seguro = (promesa) => promesa.catch((e) => ({ configurado: true, error: e.message || String(e) }));

export async function onRequestGet({ request, env, waitUntil }) {
  const a = ajustes(env);
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  try { await verificarFirebase(token, a); } catch (e) { return json({ error: 'Hace falta entrar en el panel con el código del equipo.' }, 401); }

  const url = new URL(request.url);
  const dias = [7, 30, 90].includes(Number(url.searchParams.get('dias'))) ? Number(url.searchParams.get('dias')) : 30;
  const claveCache = new Request('https://cache.panel-landez.internal/estadisticas?dias=' + dias);
  const cache = caches.default;
  if (url.searchParams.get('fresco') !== '1') {
    const guardado = await cache.match(claveCache);
    if (guardado) return json(await guardado.json());
  }

  const [shopify, analytics] = await Promise.all([seguro(datosShopify(env, a, dias)), seguro(datosAnalytics(env, a, dias))]);
  const respuesta = { generado: new Date().toISOString(), dias, zona: ZONA, shopify, analytics };
  waitUntil(cache.put(claveCache, new Response(JSON.stringify(respuesta), { headers: { 'cache-control': 'max-age=' + CACHE_SEGUNDOS } })));
  return json(respuesta);
}
