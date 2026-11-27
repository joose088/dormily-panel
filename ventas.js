// Panel de ventas (Gestión → Ventas): lo vendido por provincia, por cliente y por mes, trimestre o año,
// con comparativas entre periodos y entre clientes. Sale de los pedidos de venta o de las facturas del panel.
import { calcular, esCompra } from './documento.js';

// Province from the first two digits of the postal code (01 Álava … 52 Melilla).
const PROVINCIAS = ['', 'Álava', 'Albacete', 'Alicante', 'Almería', 'Ávila', 'Badajoz', 'Islas Baleares', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Castellón',
  'Ciudad Real', 'Córdoba', 'A Coruña', 'Cuenca', 'Girona', 'Granada', 'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Jaén', 'León', 'Lleida', 'La Rioja', 'Lugo',
  'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Ourense', 'Asturias', 'Palencia', 'Las Palmas', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Cantabria',
  'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid', 'Bizkaia', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla'];
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function provinciaDe(...textos) {
  for (const t of textos) {
    const cp = String(t || '').match(/\b(0[1-9]|[1-4]\d|5[0-2])\d{3}\b/);
    if (cp) return PROVINCIAS[Number(cp[1])];
  }
  // Without a postal code, a province named in the address still counts («Yecla (Murcia)»).
  for (const t of textos) { const s = sinTildes(t); const p = PROVINCIAS.find((x) => x && new RegExp('\\b' + sinTildes(x) + '\\b').test(s)); if (p) return p; }
  return 'Sin provincia';
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
// Period keys: «2026-03» (month), «2026-T1» (quarter), «2026» (year).
const clavePeriodo = (fecha, escala) => { const y = fecha.slice(0, 4), m = Number(fecha.slice(5, 7)); return escala === 'anio' ? y : escala === 'trimestre' ? y + '-T' + Math.ceil(m / 3) : fecha.slice(0, 7); };
const nombrePeriodo = (k, corto) => {
  if (/^\d{4}$/.test(k)) return k;
  if (/T/.test(k)) return k.slice(6) + 'º trim.' + (corto ? '' : ' ' + k.slice(0, 4));
  const m = Number(k.slice(5, 7)) - 1;
  return corto ? MESES[m] : MESES_LARGOS[m] + ' ' + k.slice(0, 4);
};
function periodoAnterior(k, mismoDelAnio) {
  if (/^\d{4}$/.test(k)) return String(Number(k) - 1);
  const y = Number(k.slice(0, 4));
  if (mismoDelAnio) return (y - 1) + k.slice(4);
  if (/T/.test(k)) { const t = Number(k.slice(6)); return t > 1 ? y + '-T' + (t - 1) : (y - 1) + '-T4'; }
  const m = Number(k.slice(5, 7));
  return m > 1 ? y + '-' + String(m - 1).padStart(2, '0') : (y - 1) + '-12';
}
const periodosDelAnio = (y, escala) => (escala === 'anio' ? null : escala === 'trimestre' ? [1, 2, 3, 4].map((t) => y + '-T' + t) : MESES.map((_, i) => y + '-' + String(i + 1).padStart(2, '0')));

// Fixed categorical order for the compared customers (validated set: blue, orange, aqua), light and dark steps.
const SERIES = 3;

export function crearVentas({ S, esc, euros, render }) {
  const V = () => (S.gestion.ventas = Object.assign({ fuente: 'pedidos', escala: 'mes', anio: String(new Date().getFullYear()), provincia: '', periodo: '', mismoDelAnio: false, comparar: [] }, S.gestion.ventas || {}));
  const fEnt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' });
  const eur0 = (n) => fEnt.format(Math.round(n)) + ' €';
  const pct = (n) => (n > 0 ? '+' : '') + new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n) + ' %';

  // Every sale: date, amount with VAT (under recargo de equivalencia the whole price is ours), customer and province.
  function ventas() {
    const v = V();
    return S.documentos.filter((d) => (v.fuente === 'facturas' ? d.tipo === 'factura' && d.estado !== 'anulada' : d.tipo === 'pedido' && !esCompra(d) && d.estado !== 'cancelado') && d.fecha)
      .map((d) => {
        const c = d.cliente || {}, env = d.envio || {};
        const id = d.clienteId || 'n:' + sinTildes(c.nombre || 'Sin nombre');
        const ficha = d.clienteId && S.clientes.find((x) => x.id === d.clienteId);
        return { fecha: d.fecha, importe: calcular(d).total, cliente: id, nombre: (ficha && ficha.nombre) || c.nombre || 'Sin nombre',
          provincia: provinciaDe(env.localidad, c.localidad, env.direccion, c.direccion) };
      });
  }
  const suma = (xs) => xs.reduce((s, x) => s + x.importe, 0);

  // Vertical bars, one series, with a tooltip per bar; the selected period is drawn darker.
  function barras(titulo, puntos, marcado) {
    const W = 640, H = 190, B = 24, A = 14, n = puntos.length || 1, max = Math.max(0, ...puntos.map((p) => p.v));
    const paso = W / n, ancho = Math.min(46, paso * 0.66), h = (v) => (max ? (v / max) * (H - B - A) : 0);
    const marcas = puntos.map((p, i) => {
      const x = i * paso + (paso - ancho) / 2, y = H - B - h(p.v);
      return '<g class="v-bar' + (p.k === marcado ? ' v-marcado' : '') + '"><rect class="v-hit" x="' + (i * paso).toFixed(1) + '" y="0" width="' + paso.toFixed(1) + '" height="' + (H - B) + '"></rect>' +
        (p.v ? '<path d="' + barraRedonda(x, y, ancho, h(p.v)) + '"></path>' : '') + '<title>' + esc(p.titulo + ': ' + eur0(p.v) + (p.n ? ' · ' + p.n + (p.n === 1 ? ' venta' : ' ventas') : '')) + '</title>' +
        '<text x="' + (i * paso + paso / 2).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(p.etiqueta) + '</text></g>';
    }).join('');
    return '<figure class="v-graf"><figcaption><span>' + esc(titulo) + '</span><span class="v-max">' + (max ? 'Máximo: ' + esc(eur0(max)) : 'Sin ventas') + '</span></figcaption>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(titulo) + '"><line class="v-eje" x1="0" x2="' + W + '" y1="' + (H - B) + '" y2="' + (H - B) + '"></line>' + marcas + '</svg></figure>';
  }
  // Bar with 4px rounded top, square at the baseline.
  function barraRedonda(x, y, w, h) {
    const r = Math.min(4, h, w / 2);
    return 'M' + x.toFixed(1) + ',' + (y + h).toFixed(1) + 'V' + (y + r).toFixed(1) + 'Q' + x.toFixed(1) + ',' + y.toFixed(1) + ' ' + (x + r).toFixed(1) + ',' + y.toFixed(1) +
      'H' + (x + w - r).toFixed(1) + 'Q' + (x + w).toFixed(1) + ',' + y.toFixed(1) + ' ' + (x + w).toFixed(1) + ',' + (y + r).toFixed(1) + 'V' + (y + h).toFixed(1) + 'Z';
  }

  // Grouped bars: up to three customers per period, each in its fixed series colour, with a legend.
  function barrasClientes(titulo, periodos, series) {
    const W = 640, H = 210, B = 24, A = 14, n = periodos.length || 1, k = series.length;
    const max = Math.max(0, ...series.flatMap((s) => s.valores));
    const paso = W / n, grupo = Math.min(paso * 0.78, 30 * k), ancho = (grupo - 2 * (k - 1)) / k, h = (v) => (max ? (v / max) * (H - B - A) : 0);
    const marcas = periodos.map((p, i) => {
      const x0 = i * paso + (paso - grupo) / 2;
      return '<g>' + series.map((s, j) => {
        const v = s.valores[i], x = x0 + j * (ancho + 2);
        return '<g class="v-serie v-s' + (s.slot + 1) + '"><rect class="v-hit" x="' + x.toFixed(1) + '" y="0" width="' + (ancho + 2).toFixed(1) + '" height="' + (H - B) + '"></rect>' +
          (v ? '<path d="' + barraRedonda(x, H - B - h(v), ancho, h(v)) + '"></path>' : '') + '<title>' + esc(s.nombre + ' · ' + nombrePeriodo(p) + ': ' + eur0(v)) + '</title></g>';
      }).join('') + '<text x="' + (i * paso + paso / 2).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(nombrePeriodo(p, true)) + '</text></g>';
    }).join('');
    const leyenda = '<div class="v-leyenda">' + series.map((s) => '<span><i class="v-s' + (s.slot + 1) + '"></i>' + esc(s.nombre) + ' · ' + esc(eur0(s.valores.reduce((a, b) => a + b, 0))) + '</span>').join('') + '</div>';
    return '<figure class="v-graf"><figcaption><span>' + esc(titulo) + '</span></figcaption>' + leyenda +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(titulo) + '"><line class="v-eje" x1="0" x2="' + W + '" y1="' + (H - B) + '" y2="' + (H - B) + '"></line>' + marcas + '</svg></figure>';
  }

  function vista() {
    const v = V();
    if (!S.listo.documentos) return '<div class="vacio">Cargando documentos…</div>';
    const todas = ventas();
    const anios = [...new Set(todas.map((x) => x.fecha.slice(0, 4)).concat(v.anio))].sort().reverse();
    const provincias = [...new Set(todas.map((x) => x.provincia))].sort((a, b) => a.localeCompare(b, 'es'));
    if (v.provincia && !provincias.includes(v.provincia)) v.provincia = '';
    const enProv = todas.filter((x) => !v.provincia || x.provincia === v.provincia);
    const delAnio = enProv.filter((x) => x.fecha.startsWith(v.anio));

    // Filters, in one row above the charts.
    const chip = (attr, val, actual, txt) => '<button class="chip" type="button" ' + attr + '="' + val + '" aria-pressed="' + (actual === val) + '">' + txt + '</button>';
    let html = '<div class="filtros v-filtros">' +
      chip('data-v-fuente', 'pedidos', v.fuente, 'Pedidos de venta') + chip('data-v-fuente', 'facturas', v.fuente, 'Facturas') + '<span class="v-sep"></span>' +
      chip('data-v-escala', 'mes', v.escala, 'Meses') + chip('data-v-escala', 'trimestre', v.escala, 'Trimestres') + chip('data-v-escala', 'anio', v.escala, 'Años') + '<span class="v-sep"></span>' +
      '<label class="v-sel">Año <select data-v-anio aria-label="Año">' + anios.map((y) => '<option' + (y === v.anio ? ' selected' : '') + '>' + y + '</option>').join('') + '</select></label>' +
      '<label class="v-sel">Provincia <select data-v-prov aria-label="Provincia"><option value="">Todas</option>' + provincias.map((p) => '<option' + (p === v.provincia ? ' selected' : '') + '>' + esc(p) + '</option>').join('') + '</select></label></div>';
    if (!todas.length) return html + '<div class="vacio">Todavía no hay ' + (v.fuente === 'facturas' ? 'facturas' : 'pedidos de venta') + '. En cuanto los hagáis en «Documentos», aquí salen las ventas por provincia, cliente y mes.</div>';

    // Headline numbers for the year, against the same stretch of the year before (to today, if it is the current year).
    const hoy = new Date().toISOString().slice(0, 10), esteAnio = v.anio === hoy.slice(0, 4);
    const hasta = esteAnio ? hoy.slice(5) : '12-31';
    const antes = enProv.filter((x) => x.fecha.startsWith(String(Number(v.anio) - 1)) && x.fecha.slice(5) <= hasta);
    const total = suma(delAnio), totalAntes = suma(antes), nClientes = new Set(delAnio.map((x) => x.cliente)).size;
    const varTxt = (a, b) => (b ? '<span class="v-var ' + (a >= b ? 'v-sube' : 'v-baja') + '">' + (a >= b ? '▲ ' : '▼ ') + pct((a - b) / b * 100) + '</span> frente a ' + eur0(b) : 'Sin ventas el año anterior');
    html += '<div class="est-kpis">' +
      '<div class="saldo"><span class="est-n">Vendido en ' + esc(v.anio) + (v.provincia ? ' · ' + esc(v.provincia) : '') + '</span><span class="neto">' + eur0(total) + '</span><span class="est-nota">' + varTxt(total, totalAntes) + (esteAnio ? ' (mismas fechas)' : '') + '</span></div>' +
      '<div class="saldo"><span class="est-n">' + (v.fuente === 'facturas' ? 'Facturas' : 'Pedidos') + '</span><span class="neto">' + fEnt.format(delAnio.length) + '</span><span class="est-nota">' + fEnt.format(antes.length) + ' el año anterior</span></div>' +
      '<div class="saldo"><span class="est-n">Ticket medio</span><span class="neto">' + (delAnio.length ? eur0(total / delAnio.length) : '–') + '</span><span class="est-nota">Importes con IVA</span></div>' +
      '<div class="saldo"><span class="est-n">Clientes que han comprado</span><span class="neto">' + fEnt.format(nClientes) + '</span><span class="est-nota">' + fEnt.format(new Set(antes.map((x) => x.cliente)).size) + ' el año anterior</span></div></div>';

    // Sales by period (months or quarters of the year; every year for «Años»).
    const lista = periodosDelAnio(v.anio, v.escala) || [...new Set(enProv.map((x) => x.fecha.slice(0, 4)))].sort();
    const porPeriodo = (xs, k) => xs.filter((x) => clavePeriodo(x.fecha, v.escala) === k);
    if (!lista.includes(v.periodo)) {
      // Default period to compare: the current one if it is in the list, otherwise the last one with sales.
      const actual = clavePeriodo(hoy, v.escala);
      v.periodo = lista.includes(actual) ? actual : ([...lista].reverse().find((k) => porPeriodo(enProv, k).length) || lista[lista.length - 1]);
    }
    const puntos = lista.map((k) => { const xs = porPeriodo(enProv, k); return { k, v: suma(xs), n: xs.length, titulo: nombrePeriodo(k), etiqueta: nombrePeriodo(k, true) }; });
    const graficas = [barras('Ventas por ' + ({ mes: 'mes', trimestre: 'trimestre', anio: 'año' }[v.escala]) + (v.escala === 'anio' ? '' : ' de ' + v.anio) + (v.provincia ? ' · ' + v.provincia : ''), puntos, v.periodo)];

    // Provinces of the year: click one to filter everything by it.
    const porProv = {};
    todas.filter((x) => x.fecha.startsWith(v.anio)).forEach((x) => { const p = (porProv[x.provincia] = porProv[x.provincia] || { v: 0, n: 0, c: new Set() }); p.v += x.importe; p.n++; p.c.add(x.cliente); });
    const filasProv = Object.entries(porProv).sort((a, b) => b[1].v - a[1].v);
    const maxProv = Math.max(0, ...filasProv.map(([, p]) => p.v));
    graficas.push('<section class="v-graf v-prov"><h3 class="grupo-titulo">Por provincia en ' + esc(v.anio) + '</h3>' + (filasProv.length ? '<ol>' + filasProv.map(([n, p]) =>
      '<li><button type="button" data-v-provsel="' + esc(n) + '" aria-pressed="' + (v.provincia === n) + '" title="' + esc(n + ': ' + eur0(p.v) + ' · ' + p.n + ' ventas · ' + p.c.size + ' clientes') + '">' +
      '<span class="nom">' + esc(n) + '</span><span class="val">' + esc(eur0(p.v)) + '<small>' + p.c.size + (p.c.size === 1 ? ' cliente' : ' clientes') + '</small></span><span class="v-barra"><i style="width:' + (p.v / maxProv * 100).toFixed(1) + '%"></i></span></button></li>').join('') + '</ol>' +
      (v.provincia ? '<button type="button" class="mini" data-v-provsel="">Ver todas las provincias</button>' : '<p class="v-pie">Pulsa una provincia para ver solo sus clientes.</p>')
      : '<div class="vacio" style="margin-top:8px">Sin ventas en ' + esc(v.anio) + '.</div>') + '</section>');
    html += '<div class="v-graficas">' + graficas.join('') + '</div>';

    // Customers: the chosen period against the previous one (or the same one a year before).
    const previo = periodoAnterior(v.periodo, v.mismoDelAnio);
    const enPeriodo = enProv.filter((x) => clavePeriodo(x.fecha, v.escala) === v.periodo), enPrevio = enProv.filter((x) => clavePeriodo(x.fecha, v.escala) === previo);
    const clientes = {};
    for (const [xs, campo] of [[enPeriodo, 'ahora'], [enPrevio, 'antes']]) xs.forEach((x) => { const c = (clientes[x.cliente] = clientes[x.cliente] || { id: x.cliente, nombre: x.nombre, provincia: x.provincia, ahora: 0, antes: 0 }); c[campo] += x.importe; });
    const filas = Object.values(clientes).sort((a, b) => b.ahora - a.ahora || b.antes - a.antes);
    const opcionesPeriodo = lista.map((k) => '<option value="' + k + '"' + (k === v.periodo ? ' selected' : '') + '>' + esc(nombrePeriodo(k)) + '</option>').join('');
    html += '<section class="v-bloque"><div class="v-cab"><h3 class="grupo-titulo">Clientes' + (v.provincia ? ' de ' + esc(v.provincia) : '') + '</h3>' +
      '<label class="v-sel">Periodo <select data-v-periodo aria-label="Periodo">' + opcionesPeriodo + '</select></label>' +
      (v.escala === 'anio' ? '' : '<label class="v-sel">Comparar con <select data-v-contra aria-label="Comparar con"><option value="anterior"' + (v.mismoDelAnio ? '' : ' selected') + '>' + (v.escala === 'mes' ? 'el mes anterior' : 'el trimestre anterior') + '</option><option value="anio"' + (v.mismoDelAnio ? ' selected' : '') + '>el mismo ' + (v.escala === 'mes' ? 'mes' : 'trimestre') + ' del año pasado</option></select></label>') + '</div>';
    html += filas.length ? '<div class="tabla-wrap"><table class="mov v-tabla"><thead><tr><th>Cliente</th><th>Provincia</th><th class="num">' + esc(nombrePeriodo(previo)) + '</th><th class="num">' + esc(nombrePeriodo(v.periodo)) + '</th><th class="num">Diferencia</th><th>Comparar</th></tr></thead><tbody>' +
      filas.map((c) => {
        const dif = c.ahora - c.antes, sel = v.comparar.includes(c.id);
        const cambio = !c.antes ? (c.ahora ? '<span class="v-var v-sube">▲ Nuevo</span>' : '') : !c.ahora ? '<span class="v-var v-baja">▼ No ha comprado</span>' :
          '<span class="v-var ' + (dif >= 0 ? 'v-sube' : 'v-baja') + '">' + (dif >= 0 ? '▲ +' : '▼ ') + eur0(dif) + ' (' + pct(dif / c.antes * 100) + ')</span>';
        return '<tr><td><b>' + esc(c.nombre) + '</b></td><td>' + esc(c.provincia) + '</td><td class="num">' + eur0(c.antes) + '</td><td class="num"><b>' + eur0(c.ahora) + '</b></td><td class="num">' + cambio + '</td>' +
          '<td><button type="button" class="mini" data-v-comp="' + esc(c.id) + '" aria-pressed="' + sel + '">' + (sel ? 'Quitar' : 'Comparar') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="vacio" style="margin-top:8px">Ningún cliente ha comprado en ' + esc(nombrePeriodo(v.periodo)) + ' ni en ' + esc(nombrePeriodo(previo)) + '.</div>';
    html += '</section>';

    // Customers side by side across the year (or the years).
    v.comparar = v.comparar.filter((id) => todas.some((x) => x.cliente === id));
    if (v.comparar.length) {
      const series = v.comparar.map((id, slot) => {
        const xs = todas.filter((x) => x.cliente === id);
        return { slot, nombre: xs[0].nombre, valores: lista.map((k) => suma(porPeriodo(xs, k))) };
      });
      html += '<section class="v-bloque"><div class="v-cab"><h3 class="grupo-titulo">Comparativa de clientes</h3><button type="button" class="mini" data-v-comp-limpiar="1">Quitar todos</button></div>' +
        barrasClientes('Compras por ' + ({ mes: 'mes', trimestre: 'trimestre', anio: 'año' }[v.escala]) + (v.escala === 'anio' ? '' : ' de ' + v.anio) + ' (todas las provincias)', lista, series) +
        '<div class="tabla-wrap"><table class="mov v-tabla"><thead><tr><th>Cliente</th>' + lista.map((k) => '<th class="num">' + esc(nombrePeriodo(k, true)) + '</th>').join('') + '<th class="num">Total</th></tr></thead><tbody>' +
        series.map((s) => '<tr><td><i class="v-punto v-s' + (s.slot + 1) + '"></i><b>' + esc(s.nombre) + '</b></td>' + s.valores.map((x) => '<td class="num">' + (x ? eur0(x) : '–') + '</td>').join('') + '<td class="num"><b>' + eur0(s.valores.reduce((a, b) => a + b, 0)) + '</b></td></tr>').join('') +
        '</tbody></table></div></section>';
    } else html += '<p class="v-pie">Pulsa «Comparar» en hasta ' + SERIES + ' clientes para ver sus compras lado a lado.</p>';
    html += '<p class="v-pie">Importes con IVA de ' + (v.fuente === 'facturas' ? 'las facturas (sin las anuladas)' : 'los pedidos de venta (sin los cancelados)') + '. La provincia sale del código postal de la dirección de envío o, si no hay, de la del cliente.</p>';
    return html;
  }

  function alClic(b) {
    const v = V(), d = b.dataset;
    if (d.vFuente) { v.fuente = d.vFuente; v.periodo = ''; render(); return true; }
    if (d.vEscala) { v.escala = d.vEscala; v.periodo = ''; render(); return true; }
    if (d.vProvsel != null) { v.provincia = v.provincia === d.vProvsel ? '' : d.vProvsel; render(); return true; }
    if (d.vComp) {
      const i = v.comparar.indexOf(d.vComp);
      if (i >= 0) v.comparar.splice(i, 1);
      else if (v.comparar.length >= SERIES) v.comparar = v.comparar.slice(1).concat(d.vComp); // the oldest pick makes room
      else v.comparar.push(d.vComp);
      render(); return true;
    }
    if (d.vCompLimpiar) { v.comparar = []; render(); return true; }
    return false;
  }
  // Selects in the filter row.
  document.addEventListener('change', (e) => {
    const t = e.target, v = V();
    if (t.matches('[data-v-anio]')) { v.anio = t.value; v.periodo = ''; render(); }
    else if (t.matches('[data-v-prov]')) { v.provincia = t.value; render(); }
    else if (t.matches('[data-v-periodo]')) { v.periodo = t.value; render(); }
    else if (t.matches('[data-v-contra]')) { v.mismoDelAnio = t.value === 'anio'; render(); }
  });
  return { vista, alClic };
}

export const ESTILOS_VENTAS = `
  .v-filtros { align-items: center; }
  .v-sep { width: 1px; align-self: stretch; background: var(--line); margin: 0 4px; }
  .v-sel { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; color: var(--muted); }
  .v-sel select { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 5px 10px; font: inherit; font-size: 13.5px; }
  .v-graficas { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 14px; margin-top: 14px; align-items: start; }
  .v-graf { margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px; min-width: 0; }
  .v-graf figcaption { display: flex; justify-content: space-between; gap: 8px; font-weight: 700; font-size: 14px; margin-bottom: 8px; }
  .v-graf .v-max { font-weight: 400; color: var(--muted); font-size: 12.5px; }
  .v-graf svg { width: 100%; height: auto; display: block; overflow: visible; }
  .v-graf svg text { font-size: 11px; fill: var(--muted); }
  .v-eje { stroke: var(--line); stroke-width: 1; }
  .v-hit { fill: transparent; }
  .v-bar path { fill: var(--accent); opacity: .55; }
  .v-bar.v-marcado path, .v-bar:hover path { opacity: 1; }
  .v-bar:hover .v-hit, .v-serie:hover .v-hit { fill: var(--accent-soft); }
  .v-prov ol { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 2px; max-height: 300px; overflow: auto; }
  .v-prov li button { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; text-align: left; border: 0; background: transparent; border-radius: 8px; padding: 6px 8px; color: var(--ink); font: inherit; font-size: 13.5px; }
  .v-prov li button:hover, .v-prov li button[aria-pressed="true"] { background: var(--accent-soft); }
  .v-prov .nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
  .v-prov .val { font-variant-numeric: tabular-nums; text-align: right; }
  .v-prov .val small { display: block; color: var(--muted); font-size: 11.5px; }
  .v-barra { grid-column: 1 / -1; height: 6px; background: var(--sunk); border-radius: 3px; overflow: hidden; }
  .v-barra i { display: block; height: 100%; background: var(--accent); border-radius: 0 3px 3px 0; }
  .v-bloque { margin-top: 18px; }
  .v-cab { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 8px; }
  .v-cab .grupo-titulo { margin: 0 auto 0 0; }
  .v-tabla td, .v-tabla th { white-space: nowrap; }
  .v-var { font-weight: 700; font-variant-numeric: tabular-nums; }
  .v-sube { color: var(--ok); }
  .v-baja { color: var(--bad); }
  .v-pie { color: var(--muted); font-size: 12.5px; margin: 10px 0 0; }
  .v-leyenda { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--ink); margin-bottom: 6px; }
  .v-leyenda span { display: inline-flex; align-items: center; gap: 6px; }
  .v-leyenda i, .v-punto { width: 10px; height: 10px; border-radius: 3px; display: inline-block; background: var(--v-color); }
  .v-punto { margin-right: 6px; vertical-align: -1px; }
  .v-s1 { --v-color: #2a78d6; } .v-s2 { --v-color: #eb6834; } .v-s3 { --v-color: #1baf7a; }
  .v-serie path { fill: var(--v-color); }
  @media (max-width: 800px) { .v-graficas { grid-template-columns: 1fr; } .v-sep { display: none; } }
`;
