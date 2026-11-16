// Plantilla de los documentos de gestión: presupuesto, pedido y albarán.
// documentoHTML(doc) devuelve el documento listo para imprimir o guardar en PDF desde el navegador.
// Al imprimir, la cabecera, el pie y la fila de títulos de la tabla se repiten en cada hoja, con «Página X de Y».

// Datos de la empresa que salen en todos los documentos. Los que van entre corchetes faltan por poner.
export const EMPRESA = {
  marca: 'Landez Descanso',
  razonSocial: '[Razón social]',
  nif: '[NIF]',
  domicilio: '[Calle y número]',
  localidad: '[CP] Yecla (Murcia)',
  telefono: '868 353 401',
  correo: 'contacto@landezdescanso.es',
  web: 'landezdescanso.es',
  registro: '' // Inscripción en el Registro Mercantil, si la empresa es una sociedad
};

export const TIPOS = {
  presupuesto: { titulo: 'Presupuesto', prefijo: 'P' },
  pedido: { titulo: 'Pedido', prefijo: 'PED' },
  albaran: { titulo: 'Albarán', prefijo: 'ALB' }
};

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' });
const fechaCorta = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
const cifra = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, useGrouping: 'always' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Los huecos [entre corchetes] se marcan para que se vean antes de enviar el documento.
const dato = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<mark class="hueco">$1</mark>');
const verFecha = (iso) => (iso ? fechaCorta.format(new Date(iso + 'T12:00:00')) : '');
const redondeo = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const dias = (desde, hasta) => Math.round((new Date(hasta + 'T12:00:00') - new Date(desde + 'T12:00:00')) / 86400000);

// Importes: precio sin IVA por unidad, dos descuentos en cadena (%) e IVA (%) por línea.
export function calcular(doc) {
  const lineas = (doc.lineas || []).map((l) => {
    const cantidad = Number(l.cantidad) || 0, precio = Number(l.precio) || 0;
    const neto = redondeo(precio * (1 - (Number(l.dto1) || 0) / 100) * (1 - (Number(l.dto2) || 0) / 100));
    return Object.assign({}, l, { cantidad, precio, neto, bruto: redondeo(cantidad * precio), importe: redondeo(cantidad * neto), iva: l.iva ?? 21 });
  });
  const porIva = {};
  for (const l of lineas) porIva[l.iva] = redondeo((porIva[l.iva] || 0) + l.importe);
  const tramos = Object.entries(porIva).map(([tipo, base]) => ({ tipo: Number(tipo), base, cuota: redondeo(base * Number(tipo) / 100) }));
  const bruto = redondeo(lineas.reduce((s, l) => s + l.bruto, 0));
  const base = redondeo(tramos.reduce((s, t) => s + t.base, 0));
  const cuota = redondeo(tramos.reduce((s, t) => s + t.cuota, 0));
  const total = redondeo(base + cuota);
  const pagado = redondeo(Number(doc.pagado) || 0);
  return { lineas, tramos, bruto, descuento: redondeo(bruto - base), base, cuota, total, pagado, pendiente: redondeo(total - pagado) };
}

const fila = (k, v) => (v ? '<div><dt>' + esc(k) + '</dt><dd>' + dato(v) + '</dd></div>' : '');

function caja(clase, titulo, cuerpo, extra = '') {
  return cuerpo ? '<section class="caja ' + clase + '"><h3>' + esc(titulo) + extra + '</h3>' + cuerpo + '</section>' : '';
}
function direccion(p) {
  const lineas = [p.nombre && '<b>' + dato(p.nombre) + '</b>', p.empresa && dato(p.empresa), dato(p.direccion), dato(p.localidad), dato(p.pais)].filter(Boolean);
  const datos = fila('NIF', p.nif) + fila('Tel.', p.telefono) + fila('Correo', p.correo) + fila('Att.', p.att) + fila('Contacto', p.contacto);
  return lineas.length || datos ? '<p class="dir">' + lineas.join('<br>') + '</p>' + (datos ? '<dl>' + datos + '</dl>' : '') : '';
}

export function documentoHTML(doc, empresa = EMPRESA) {
  const tipo = TIPOS[doc.tipo] || TIPOS.presupuesto;
  const c = calcular(doc);
  const cli = doc.cliente || {};
  const env = doc.envio || {};
  const log = doc.logistica || {};
  const conPrecios = doc.tipo !== 'albaran' || doc.valorado;
  const conFotos = c.lineas.some((l) => l.imagen);
  const conDto1 = c.lineas.some((l) => Number(l.dto1)), conDto2 = c.lineas.some((l) => Number(l.dto2));
  const columnas = 2 + (conPrecios ? 2 + (conDto1 ? 1 : 0) + (conDto2 ? 1 : 0) + ((conDto1 || conDto2) ? 1 : 0) : 0) + 1;

  // Cabecera que se repite en cada hoja.
  const cabecera = '<div class="cab">' +
    '<img class="logo" src="' + esc(doc.logo || 'logo-documento.svg') + '" alt="' + esc(empresa.marca) + '">' +
    '<address>' + '<b>' + dato(empresa.razonSocial) + '</b><br>NIF ' + dato(empresa.nif) + '<br>' + dato(empresa.domicilio) + '<br>' + dato(empresa.localidad) +
    '<br>' + esc(empresa.telefono) + ' · ' + esc(empresa.correo) + '<br>' + esc(empresa.web) + '</address></div>' +
    '<div class="tira"><span class="tipo">' + esc(tipo.titulo) + '</span><span class="num">' + dato(doc.numero) + '</span>' +
    '<span>' + esc(verFecha(doc.fecha)) + '</span><span class="cli">' + dato(cli.nombre || cli.empresa || '') + '</span></div>';

  // Pie que se repite en cada hoja.
  const pie = '<div class="pie">' + dato(empresa.razonSocial) + ' · NIF ' + dato(empresa.nif) + ' · ' + dato(empresa.domicilio) + ', ' + dato(empresa.localidad) +
    (empresa.registro ? '<br>' + dato(empresa.registro) : '') +
    '<br><span class="rgpd">' + esc(empresa.marca) + ' trata sus datos personales para gestionar la relación comercial, conforme al RGPD y la Ley Orgánica 3/2018. ' +
    'Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a ' + esc(empresa.correo) + '.</span></div>';

  // Datos del documento, cliente y envío (solo en la primera hoja).
  const datosDoc = '<dl>' + fila('Número', doc.numero) + fila('Fecha', verFecha(doc.fecha)) +
    (doc.tipo === 'presupuesto' ? fila('Válido hasta', verFecha(doc.validoHasta)) : '') +
    (doc.tipo === 'pedido' ? fila('Entrega prevista', verFecha(doc.entregaPrevista)) : '') +
    (doc.tipo === 'albaran' ? fila('Fecha de entrega', verFecha(doc.fechaEntrega)) : '') +
    fila('Su referencia', doc.suReferencia) + fila('Nuestra ref.', doc.referencia) + fila('Atendido por', doc.comercial) + '</dl>';
  const envioDistinto = env.direccion && env.direccion !== cli.direccion;
  const envioCuerpo = (envioDistinto || doc.tipo !== 'presupuesto') ? direccion(env.direccion ? env : cli) +
    (doc.tipo === 'albaran' ? '<dl>' + fila('Transporte', env.transportista) + fila('Seguimiento', env.seguimiento) + '</dl>' : '') : '';
  const partes = '<div class="partes">' +
    caja('caja-doc', tipo.titulo, datosDoc) +
    caja('caja-cli', 'Cliente', direccion(cli), cli.codigo ? '<span class="cod">Código ' + esc(cli.codigo) + '</span>' : '') +
    caja('caja-env', 'Dirección de envío', envioCuerpo) + '</div>';

  // Líneas. La fila de títulos se repite al cambiar de hoja.
  const thead = '<thead><tr>' + (conFotos ? '<th class="foto"></th>' : '') + '<th class="art">Artículo</th><th>Descripción</th><th class="num">Cant.</th>' +
    (conPrecios ? '<th class="num">Precio</th>' + (conDto1 ? '<th class="num">Dto. 1</th>' : '') + (conDto2 ? '<th class="num">Dto. 2</th>' : '') +
      ((conDto1 || conDto2) ? '<th class="num">Neto</th>' : '') + '<th class="num">Importe</th>' : '') + '</tr></thead>';
  const detalle = (d) => (Array.isArray(d) ? d : String(d || '').split('\n')).filter(Boolean).map((x) => '<span class="det">' + dato(x) + '</span>').join('');
  const filas = c.lineas.map((l) => '<tr>' +
    (conFotos ? '<td class="foto">' + (l.imagen ? '<img src="' + esc(l.imagen) + '" alt="">' : '') + '</td>' : '') +
    '<td class="art">' + dato(l.ref) + '</td><td class="desc"><b>' + dato(l.descripcion) + '</b>' + detalle(l.detalle) + '</td>' +
    '<td class="num">' + cifra.format(l.cantidad) + '</td>' +
    (conPrecios ? (l.precio
      ? '<td class="num">' + euros.format(l.precio) + '</td>' + (conDto1 ? '<td class="num">' + (Number(l.dto1) ? cifra.format(l.dto1) + ' %' : '') + '</td>' : '') +
        (conDto2 ? '<td class="num">' + (Number(l.dto2) ? cifra.format(l.dto2) + ' %' : '') + '</td>' : '') +
        ((conDto1 || conDto2) ? '<td class="num">' + euros.format(l.neto) + '</td>' : '') + '<td class="num imp">' + euros.format(l.importe) + '</td>'
      : '<td class="num incluido" colspan="' + (columnas - 3 - (conFotos ? 1 : 0)) + '">Incluido</td>') : '') +
    '</tr>').join('') || '<tr><td colspan="' + (columnas + (conFotos ? 1 : 0)) + '" class="vacio">Sin líneas</td></tr>';
  const tabla = '<table class="lineas">' + thead + '<tbody>' + filas + '</tbody></table>';

  // Cierre: totales, logística, condiciones y firma.
  const totales = conPrecios ? '<div class="totales">' +
    '<div><span>Bruto</span><b>' + euros.format(c.bruto) + '</b></div>' +
    (c.descuento ? '<div><span>Descuentos</span><b>−' + euros.format(c.descuento) + '</b></div>' : '') +
    c.tramos.map((t) => '<div><span>Base imponible' + (c.tramos.length > 1 ? ' ' + t.tipo + ' %' : '') + '</span><b>' + euros.format(t.base) + '</b></div><div><span>IVA ' + cifra.format(t.tipo) + ' %</span><b>' + euros.format(t.cuota) + '</b></div>').join('') +
    '<div class="total"><span>Total' + (doc.tipo === 'pedido' ? ' pedido' : '') + '</span><b>' + euros.format(c.total) + '</b></div>' +
    (c.pagado ? '<div><span>Pagado</span><b>' + euros.format(c.pagado) + '</b></div><div class="pendiente"><span>Pendiente</span><b>' + euros.format(c.pendiente) + '</b></div>' : '') +
    '</div>' : '';
  const logistica = [['Bultos', log.bultos], ['Peso bruto', log.pesoBruto && cifra.format(log.pesoBruto) + ' kg'], ['Peso neto', log.pesoNeto && cifra.format(log.pesoNeto) + ' kg'], ['Volumen', log.volumen && cifra.format(log.volumen) + ' m³']]
    .filter(([, v]) => v).map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>').join('');
  const condiciones = [
    doc.tipo === 'presupuesto' && doc.validoHasta ? 'Validez de la oferta: ' + dias(doc.fecha, doc.validoHasta) + ' días, hasta el ' + verFecha(doc.validoHasta) + '.' : '',
    ...(doc.condiciones || [])
  ].filter(Boolean);
  const notas = (doc.formaPago ? '<p><b>Forma de pago:</b> ' + dato(doc.formaPago) + '</p>' : '') +
    (doc.notas ? '<p>' + dato(doc.notas) + '</p>' : '') +
    (condiciones.length ? '<ul>' + condiciones.map((x) => '<li>' + dato(x) + '</li>').join('') + '</ul>' : '');
  const firma = { presupuesto: 'Aceptación del cliente', pedido: 'Conforme del cliente', albaran: 'Recibí conforme' }[doc.tipo];
  const firmaNota = { presupuesto: 'Firma, nombre y fecha', pedido: 'Firma, nombre y fecha', albaran: 'Firma, nombre, DNI y fecha. Revise la mercancía antes de firmar.' }[doc.tipo];
  const cierre = '<div class="cierre">' +
    '<div class="izq">' + (logistica ? '<dl class="logistica">' + logistica + '</dl>' : '') + (notas ? '<div class="notas">' + notas + '</div>' : '') + '</div>' +
    '<div class="der">' + totales + '<section class="firma"><p>' + firma + '</p><div class="hueco-firma"></div><p class="peq">' + firmaNota + '</p></section></div>' +
    '</div>';

  return '<article class="doc doc-' + esc(doc.tipo) + '"><table class="marco">' +
    '<thead><tr><td>' + cabecera + '</td></tr></thead>' +
    '<tfoot><tr><td>' + pie + '</td></tr></tfoot>' +
    '<tbody><tr><td>' + partes + tabla + cierre + '</td></tr></tbody>' +
    '</table></article>';
}

// Estilos de la hoja. Van aparte para poder meterlos en la ventana de impresión del panel.
export const ESTILOS_DOCUMENTO = `
.doc { --tinta: #000; --gris: #555; --linea: #BBB; --fina: #E2E2E2;
  width: 210mm; min-height: 297mm; margin: 0 auto; padding: 12mm 14mm 10mm; background: #fff; color: var(--tinta);
  font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 9pt; line-height: 1.35; box-sizing: border-box; }
.doc *, .doc *::before, .doc *::after { box-sizing: border-box; }
.doc h3 { margin: 0; }
.doc dl, .doc dd, .doc p, .doc ul, .doc address { margin: 0; font-style: normal; }
.doc table.marco { width: 100%; border-collapse: collapse; }
.doc table.marco > * > tr > td { padding: 0; }

/* Cabecera repetida */
.cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 10mm; }
.doc .logo { width: 40mm; height: auto; }
.cab address { text-align: right; font-size: 8pt; color: var(--gris); line-height: 1.45; }
.cab address b { color: var(--tinta); }
.tira { display: flex; align-items: baseline; gap: 5mm; margin: 5mm 0 5mm; padding: 2mm 0; border-top: 1.5px solid var(--tinta); border-bottom: 0.5px solid var(--linea); font-size: 9pt; }
.tira .tipo { font-weight: 700; text-transform: uppercase; letter-spacing: .08em; font-size: 10pt; }
.tira .num { font-weight: 700; }
.tira .cli { margin-left: auto; color: var(--gris); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80mm; }

/* Datos de la primera hoja */
.partes { display: grid; grid-template-columns: 0.9fr 1fr 1fr; gap: 5mm; margin-bottom: 6mm; }
.caja { border: 0.5px solid var(--linea); padding: 2.5mm 3mm; }
.caja h3 { display: flex; justify-content: space-between; gap: 2mm; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .08em; color: var(--gris); font-weight: 700; margin-bottom: 1.8mm; padding-bottom: 1.2mm; border-bottom: 0.5px solid var(--fina); }
.caja h3 .cod { text-transform: none; letter-spacing: 0; font-weight: 400; }
.caja .dir { margin-bottom: 1.5mm; }
.caja dl div { display: flex; gap: 2mm; }
.caja dt { color: var(--gris); white-space: nowrap; min-width: 15mm; }
.caja-doc dt { min-width: 22mm; }
.caja-doc dd { font-weight: 700; }
.caja-doc dl div:first-child dd { white-space: nowrap; }

/* Líneas */
table.lineas { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.lineas thead th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; padding: 1.8mm 2mm; border-top: 1px solid var(--tinta); border-bottom: 1px solid var(--tinta); }
.lineas td { padding: 2.4mm 2mm; border-bottom: 0.5px solid var(--fina); vertical-align: top; }
.lineas tr { break-inside: avoid; }
.lineas .num { text-align: right; white-space: nowrap; }
.lineas th.num { text-align: right; }
.lineas .art { width: 20mm; }
.lineas td.art { color: var(--gris); }
.lineas .foto { width: 18mm; padding-right: 0; }
.lineas .foto img { width: 16mm; height: 16mm; object-fit: contain; display: block; }
.lineas .desc b { font-weight: 700; }
.lineas .det { display: block; color: var(--gris); font-size: 8pt; padding-left: 3mm; }
.lineas .incluido { font-style: italic; }
.lineas .vacio { color: var(--gris); text-align: center; }

/* Cierre */
.cierre { display: flex; gap: 8mm; margin-top: 5mm; padding-top: 3mm; border-top: 1px solid var(--tinta); break-inside: avoid; }
.cierre .izq { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3mm; }
.cierre .der { width: 72mm; display: flex; flex-direction: column; gap: 5mm; }
.logistica { display: grid; grid-template-columns: repeat(4, auto); justify-content: start; gap: 0 7mm; }
.logistica div { display: flex; flex-direction: column; }
.logistica dt { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; color: var(--gris); }
.logistica dd { font-weight: 700; font-variant-numeric: tabular-nums; }
.notas { color: var(--gris); font-size: 8pt; }
.notas p + p, .notas p + ul { margin-top: 1.5mm; }
.notas b { color: var(--tinta); }
.notas ul { padding-left: 4mm; }
.totales { font-variant-numeric: tabular-nums; }
.totales div { display: flex; justify-content: space-between; gap: 4mm; padding: 0.9mm 0; }
.totales span { color: var(--gris); }
.totales b { font-weight: 400; }
.totales .total { margin-top: 1.5mm; padding: 2mm 0; border-top: 1px solid var(--tinta); border-bottom: 1px solid var(--tinta); }
.totales .total span, .totales .total b { color: var(--tinta); font-size: 11pt; font-weight: 700; }
.totales .pendiente span, .totales .pendiente b { color: var(--tinta); font-weight: 700; }
.firma { border: 0.5px solid var(--linea); padding: 2.5mm 3mm; }
.firma p { font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
.firma .hueco-firma { height: 16mm; }
.firma .peq { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--gris); font-size: 7.5pt; border-top: 0.5px solid var(--tinta); padding-top: 1mm; }

/* Pie repetido */
.pie { margin-top: 6mm; padding-top: 2.5mm; border-top: 0.5px solid var(--linea); text-align: center; color: var(--gris); font-size: 7pt; line-height: 1.45; }
.pie .rgpd { font-size: 6.5pt; }

.doc mark.hueco { background: #FFF1A8; color: inherit; padding: 0 1mm; }

@page { size: A4; margin: 10mm 0 12mm;
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5pt Arial, Helvetica, sans-serif; color: #555; margin-right: 14mm; } }
@media print { .doc { width: auto; min-height: 0; padding: 0 14mm; } }
`;
