// Gestión: catálogo de productos, clientes y documentos (presupuestos, pedidos y albaranes).
// El documento se monta buscando productos del catálogo: al elegir uno se añade con su foto, características y precio.
// Recibe del panel (index.html) su estado y sus utilidades; devuelve la vista y los formularios.
import { documentoHTML, ESTILOS_DOCUMENTO, calcular, EMPRESA, TIPOS, PREFIJO_COMPRA, PREFIJO_SIMPLIFICADA, esCompra, esSimplificada, tituloDe } from './documento.js';
import { crearVentas, ESTILOS_VENTAS } from './ventas.js';
import { desglose, precioExtra, costeNeto, costeCompra, datosCalculo, escandalloDe, ESCANDALLO_BASE, TIPOS_COSTE, REDONDEOS } from './escandallo.js';

export const CATEGORIAS = ['Colchones', 'Canapés', 'Bases y somieres', 'Cabezales', 'Almohadas', 'Textil', 'Accesorios', 'Servicios'];
// Widths and lengths offered when creating the sizes of a product, by category (editable in the form).
const MEDIDAS_TIPICAS = {
  Colchones: ['80, 90, 105, 135, 150, 160', '190, 200'], 'Canapés': ['90, 105, 135, 150, 160', '190'],
  'Bases y somieres': ['90, 105, 135, 150, 160', '190'], Cabezales: ['90, 105, 135, 150, 160', ''], Almohadas: ['70, 90, 135, 150', '']
};
// Finish and extra groups that can be added with one click; their prices start at 0 and are filled in per model.
const GRUPOS_TIPICOS = {
  Colchones: [['Firmeza', true, ['Media', 'Firme']]],
  'Canapés': [['Color de la madera', true, ['Cambrian', 'Blanco', 'Ártico', 'Amazonas']], ['Tapizado', true, ['Serie 1', 'Serie 2', 'Serie 3']],
    ['Tapa', true, ['Entera', 'Mixta']], ['Apertura', true, ['Frontal', 'Lateral']], ['Bisagra', false, ['Doble pistón', 'Motor', 'Vertical / horizontal']]],
  'Bases y somieres': [['Patas', false, ['Juego de 4 patas 25 cm', 'Juego de 6 patas 25 cm', 'Juego de 7 patas 25 cm']], ['Color', true, ['Beige', 'Gris marengo']]],
  Cabezales: [['Tapizado', true, ['Serie 1', 'Serie 2', 'Serie 3']], ['Color', true, ['Beige', 'Gris', 'Blanco']]]
};
export const ESTADOS_DOC = {
  presupuesto: [['borrador', 'Borrador'], ['enviado', 'Enviado'], ['aceptado', 'Aceptado'], ['rechazado', 'Rechazado']],
  pedido: [['abierto', 'En curso'], ['servido', 'Servido'], ['cancelado', 'Cancelado']],
  albaran: [['pendiente', 'Por entregar'], ['entregado', 'Entregado']],
  factura: [['emitida', 'Emitida'], ['cobrada', 'Cobrada'], ['anulada', 'Anulada']]
};
// Highest total allowed on a simplified invoice in retail (Reglamento de facturación, art. 4).
const MAX_SIMPLIFICADA = 3000;
const ESTADOS_COMPRA = [['abierto', 'En curso'], ['recibido', 'Recibido'], ['cancelado', 'Cancelado']];
const estadosDe = (d) => (esCompra(d) ? ESTADOS_COMPRA : ESTADOS_DOC[d.tipo] || []);
// Name in the panel list: sales orders say so, to tell them apart from purchase orders.
const nombreTipo = (d) => (d.tipo === 'pedido' ? (esCompra(d) ? 'Pedido de compra' : 'Pedido de venta') : tituloDe(d));
const CLASE_ESTADO = { aceptado: 'ok', servido: 'ok', entregado: 'ok', recibido: 'ok', rechazado: 'bad', cancelado: 'bad', enviado: 'azul', abierto: 'azul', pendiente: 'warn', borrador: '', emitida: 'azul', cobrada: 'ok', anulada: 'bad' };
const CONDICIONES_BASE = {
  presupuesto: 'Plazo de entrega: 7 a 10 días laborables desde la aceptación.\n3 años de garantía.',
  pedido: 'Plazo de entrega: 7 a 10 días laborables.\n3 años de garantía.',
  albaran: '',
  factura: ''
};
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const decimal = (v) => (v === '' || v == null ? '' : String(v).replace('.', ','));
const fPct = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',') + ' %';
const sinPortesIncluidos = (xs) => xs.filter((x) => !/(portes|env[ií]o)s? incluid/i.test(x));
const lineasDe = (txt) => String(txt || '').split('\n').map((x) => x.trim()).filter(Boolean);
// A product has either one price (precio/coste/medidas) or a list of sizes (variantes), each with its own price.
const variantesDe = (p) => (p && Array.isArray(p.variantes) ? p.variantes.filter((v) => v.medida || v.version) : []);
const gruposDe = (p) => (p && Array.isArray(p.opciones) ? p.opciones.filter((g) => g.nombre && (g.valores || []).length) : []);
const nombreVariante = (v) => [v.medida, v.version].filter(Boolean).join(' · ');
const textoBusqueda = (p) => [p.ref, p.nombre, p.categoria, p.medidas, p.detalle, p.proveedor, p.refProveedor].concat(variantesDe(p).map((v) => nombreVariante(v) + ' ' + (v.ref || ''))).join(' ');
const numeros = (txt) => String(txt || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
const dimension = (m, i) => parseFloat(String(m || '').split(/[×x]/)[i]) || 0;
// Sizes are listed by version (electric-bed lids last), then width and length, so they read like a price table.
const motorUltimo = (v) => (/motor/i.test(v.version || '') ? 1 : 0);
const ordenVariantes = (a, b) => motorUltimo(a) - motorUltimo(b) || (a.version || '').localeCompare(b.version || '', 'es') || dimension(a.medida, 0) - dimension(b.medida, 0) ||
  dimension(a.medida, 1) - dimension(b.medida, 1) || String(a.medida || '').localeCompare(String(b.medida || ''), 'es');

export function crearGestion(x) {
  const { S, $, esc, escribir, col, aviso, cerrar, render, euros, num, nuevoId, hoyIso, sumaDias, textoFecha, cabecera, abrirHoja, PERSONAS } = x;
  S.gestion = Object.assign({ sub: 'documentos', tipo: 'todos', buscar: '', categoria: 'todas' }, S.gestion || {});
  const panelVentas = crearVentas({ S, esc, euros, render });

  /* ---------- Datos de apoyo ---------- */
  const ajustesEmpresa = () => S.ajustes.find((a) => a.id === 'empresa') || {};
  function empresa() {
    const guardado = ajustesEmpresa(), e = Object.assign({}, EMPRESA);
    for (const k of Object.keys(e)) if (guardado[k]) e[k] = guardado[k];
    return e;
  }
  // Each series is correlative per year: P-, PED-, PC-, ALB-, F- (full invoices) and FS- (simplified invoices).
  function siguienteNumero(tipo, fecha, compra, modalidad) {
    const prefijo = compra ? PREFIJO_COMPRA : tipo === 'factura' && modalidad === 'simplificada' ? PREFIJO_SIMPLIFICADA : TIPOS[tipo].prefijo;
    const pre = prefijo + '-' + (fecha || hoyIso()).slice(0, 4) + '-';
    let max = 0;
    S.documentos.forEach((d) => { if (d.tipo === tipo && String(d.numero || '').startsWith(pre)) max = Math.max(max, parseInt(d.numero.slice(pre.length), 10) || 0); });
    return pre + String(max + 1).padStart(4, '0');
  }
  function siguienteCodigoCliente() {
    const max = S.clientes.reduce((m, c) => Math.max(m, parseInt(c.codigo, 10) || 0), 0);
    return String(max + 1).padStart(4, '0');
  }
  const producto = (id) => S.productos.find((p) => p.id === id);
  /* ---------- Precios: a mano, o calculados con el escandallo ---------- */
  const plantillas = () => (S.ajustes.find((a) => a.id === 'escandallos') || {}).categorias || {};
  // Full escandallo of a size (or of the product without sizes); with the hand price when there is one.
  const calculo = (p, v, e) => { const x = v || p; return desglose(costeCompra(p, x), e || escandalloDe(p, plantillas()), datosCalculo(p, x), Number(x.precio) || 0); };
  const calculoAuto = (p, v, e) => { const x = v || p; return desglose(costeCompra(p, x), e || escandalloDe(p, plantillas()), datosCalculo(p, x)); };
  // Selling price without VAT of a size (or of a product without sizes): the one typed by hand, else the escandallo's.
  const precioDe = (p, v) => { const manual = Number((v || p).precio) || 0; if (manual) return manual; const c = calculoAuto(p, v); return c.valido ? c.precio : 0; };
  const precioOpcion = (p, x) => Number(x.precio) || precioExtra(costeCompra(p, x), escandalloDe(p, plantillas()), datosCalculo(p, x));
  // Purchase cost without VAT (what goes in a purchase order and in the margin).
  const costeDe = (p, x) => costeNeto(costeCompra(p, x), datosCalculo(p, x));
  const desde = (p, compra) => {
    const f = (v) => (compra ? costeDe(p, v || p) : precioDe(p, v));
    const vs = variantesDe(p);
    if (!vs.length) return f(null);
    const xs = vs.map(f).filter(Boolean);
    return xs.length ? Math.min(...xs) : 0;
  };
  const buscarProductos = (q) => {
    const t = sinTildes(q).split(/\s+/).filter(Boolean);
    return S.productos.filter((p) => p.activo !== false).filter((p) => {
      const texto = sinTildes(textoBusqueda(p));
      return t.every((w) => texto.includes(w));
    }).map((p) => {
      // Products whose name or reference has the words go first («iron 30» → Iron 30 before Iron 20 in 130×190).
      const nombre = sinTildes(p.nombre + ' ' + p.ref).split(/[^a-z0-9]+/);
      return [p, t.filter((w) => nombre.includes(w)).length * 2 + t.filter((w) => nombre.some((n) => n.startsWith(w))).length];
    }).sort((a, b) => b[1] - a[1] || (a[0].nombre || '').localeCompare(b[0].nombre || '', 'es')).map(([p]) => p);
  };

  /* ---------- Foto de producto: se reduce a 480 px en JPEG y se guarda dentro del producto ---------- */
  async function fotoReducida(f) {
    if (!f.type.startsWith('image/')) throw new Error('«' + f.name + '» no es una foto.');
    const url = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => mal(r.error); r.readAsDataURL(f); });
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se puede leer la foto.')); i.src = url; });
    for (const [lado, calidad] of [[480, 0.78], [360, 0.7], [260, 0.6]]) {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      const datos = c.toDataURL('image/jpeg', calidad);
      if (datos.length < 120000) return datos;
    }
    throw new Error('La foto es demasiado grande incluso reducida.');
  }

  // Photo straight from a product card: pick it, it is shrunk and saved on the product (and so shows in every document).
  document.addEventListener('change', async (e) => {
    const inp = e.target.closest && e.target.closest('[data-g-foto-in]');
    if (!inp || !S.escribir) return;
    const f = inp.files && inp.files[0], p = producto(inp.dataset.gFotoIn);
    inp.value = '';
    if (!f || !p) return;
    try {
      const foto = await fotoReducida(f);
      await escribir(() => col('productos').doc(p.id).update({ foto, actualizado: new Date().toISOString() }), 'Foto guardada: ya sale en los documentos', 'puso foto al producto «' + p.nombre + '»');
    } catch (err) { aviso(err.message); }
  });

  /* ---------- Vista ---------- */
  function renderGestion() {
    const G = S.gestion;
    const subs = [['documentos', 'Documentos', S.documentos.length], ['ventas', 'Ventas', null], ['productos', 'Productos', S.productos.length], ['escandallos', 'Escandallos', null], ['clientes', 'Clientes', S.clientes.length], ['empresa', 'Datos de la empresa', null]];
    const acciones = {
      documentos: '<button class="btn primario" type="button" data-nuevo="presupuesto">+ Presupuesto</button><button class="btn" type="button" data-nuevo="pedido">+ Pedido de venta</button><button class="btn" type="button" data-nuevo="pedidoCompra">+ Pedido de compra</button><button class="btn" type="button" data-nuevo="albaran">+ Albarán</button><button class="btn" type="button" data-nuevo="factura">+ Factura</button>',
      productos: '<button class="btn primario" type="button" data-nuevo="producto">+ Producto</button>' +
        (S.escribir && S.listo.productos && copiasSobrantes().sobran.length ? '<button class="btn" type="button" data-g-repetidos="1">Quitar repetidos (' + copiasSobrantes().sobran.length + ')</button>' : ''),
      escandallos: '',
      ventas: '',
      clientes: '<button class="btn primario" type="button" data-nuevo="cliente">+ Cliente</button>',
      empresa: ''
    }[G.sub];
    let html = cabecera('Gestión', 'Productos, escandallos, clientes, presupuestos, pedidos, albaranes y facturas.', acciones) +
      '<div class="filtros">' + subs.map(([k, n, c]) => '<button class="chip" type="button" data-gsub="' + k + '" aria-pressed="' + (G.sub === k) + '">' + n + (c ? ' <span style="opacity:.6">' + c + '</span>' : '') + '</button>').join('') +
      '<a class="chip" href="guia-gestion.html" target="_blank" rel="noopener" style="margin-left:auto;text-decoration:none;color:inherit">Guía: qué poner en cada campo</a></div>';
    if (G.sub === 'productos') html += vistaProductos();
    else if (G.sub === 'escandallos') html += vistaEscandallos();
    else if (G.sub === 'ventas') html += panelVentas.vista();
    else if (G.sub === 'clientes') html += vistaClientes();
    else if (G.sub === 'empresa') html += vistaEmpresa();
    else html += vistaDocumentos();
    return html + '<div style="height:40px"></div>';
  }
  const buscador = (ph) => '<input type="search" id="g-buscar" class="g-buscar" placeholder="' + esc(ph) + '" value="' + esc(S.gestion.buscar) + '" aria-label="Buscar">';

  function vistaDocumentos() {
    const G = S.gestion;
    if (!S.listo.documentos) return '<div class="vacio">Cargando documentos…</div>';
    const q = sinTildes(G.buscar);
    const lista = S.documentos.filter((d) => G.tipo === 'todos' || (G.tipo === 'compra' ? esCompra(d) : d.tipo === G.tipo && !esCompra(d)))
      .filter((d) => !q || sinTildes([d.numero, (d.cliente || {}).nombre, d.suReferencia].join(' ')).includes(q))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || '').localeCompare(a.creado || ''));
    let html = '<div class="filtros">' + [['todos', 'Todos'], ['presupuesto', 'Presupuestos'], ['pedido', 'Pedidos de venta'], ['compra', 'Pedidos de compra'], ['albaran', 'Albaranes'], ['factura', 'Facturas']]
      .map(([k, n]) => '<button class="chip" type="button" data-gtipo="' + k + '" aria-pressed="' + (G.tipo === k) + '">' + n + '</button>').join('') + buscador('Buscar por número, cliente o proveedor') + '</div>';
    if (!S.documentos.length) return html + '<div class="vacio">Todavía no hay documentos. Empieza con «+ Presupuesto». Antes conviene dar de alta los productos en «Productos».</div>';
    if (!lista.length) return html + '<div class="vacio">Nada con este filtro.</div>';
    return html + '<div class="tabla-wrap"><table class="mov"><thead><tr><th>Número</th><th>Tipo</th><th>Fecha</th><th>Cliente o proveedor</th><th>Estado</th><th class="num">Total</th></tr></thead><tbody>' +
      lista.map((d) => {
        const est = estadosDe(d).find((e) => e[0] === d.estado);
        return '<tr class="clic" tabindex="0" data-abrir="documentos:' + esc(d.id) + '"><td><b>' + esc(d.numero) + '</b></td><td>' + esc(nombreTipo(d)) + '</td><td>' + esc(textoFecha(d.fecha)) + '</td><td>' + esc((d.cliente || {}).nombre || '') + '</td>' +
          '<td>' + (est ? '<span class="pill ' + (CLASE_ESTADO[est[0]] || '') + '">' + esc(est[1]) + '</span>' : '') + '</td><td class="num">' + (d.tipo === 'albaran' && !d.valorado ? '' : euros(calcular(d).total)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function vistaProductos() {
    const G = S.gestion;
    if (!S.listo.productos) return '<div class="vacio">Cargando productos…</div>';
    const cats = ['todas'].concat(CATEGORIAS.filter((c) => S.productos.some((p) => p.categoria === c)));
    const q = sinTildes(G.buscar);
    const lista = S.productos.filter((p) => G.categoria === 'todas' || p.categoria === G.categoria)
      .filter((p) => !q || sinTildes(textoBusqueda(p)).includes(q))
      .sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '') || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    let html = '<div class="filtros">' + cats.map((c) => '<button class="chip" type="button" data-gcat="' + esc(c) + '" aria-pressed="' + (G.categoria === c) + '">' + esc(c === 'todas' ? 'Todas' : c) + '</button>').join('') + buscador('Buscar producto') + '</div>';
    if (!S.productos.length) return html + '<div class="vacio">El catálogo está vacío. Da de alta cada producto con «+ Producto»: foto, referencia, características y precio. Luego, al hacer un documento, basta con buscarlo.</div>';
    if (!lista.length) return html + '<div class="vacio">Ningún producto con este filtro.</div>';
    // Products entered twice (same reference or same name): flagged so one can be deleted.
    const cuenta = (k) => S.productos.filter((o) => k(o)).length;
    const repetido = (p) => cuenta((o) => p.ref && sinTildes(o.ref) === sinTildes(p.ref)) > 1 || cuenta((o) => sinTildes(o.nombre) === sinTildes(p.nombre)) > 1;
    const usos = (p) => S.documentos.filter((d) => (d.lineas || []).some((l) => l.productoId === p.id)).length;
    const nRep = lista.filter(repetido).length;
    if (nRep) html += '<div class="est-aviso">Hay ' + nRep + ' productos repetidos (misma referencia o mismo nombre), marcados con «Repetido». Pulsa «Quitar repetidos» arriba para borrar las copias que sobran' + (S.escribir ? '' : ' (hace falta permiso de edición)') + '.</div>';
    return html + '<div class="rejilla-cards g-productos">' + lista.map((p) => {
      const iva = Number(p.iva ?? 21), vs = variantesDe(p), gs = gruposDe(p), pr = desde(p);
      const rep = repetido(p), u = rep ? usos(p) : 0;
      const medidas = [...new Set(vs.map((v) => v.medida).filter(Boolean))];
      return '<article class="card g-prod' + (p.activo === false ? ' g-inactivo' : '') + '">' +
        (S.escribir
          ? '<label class="g-foto g-foto-sub" title="' + (p.foto ? 'Cambiar la foto' : 'Subir una foto') + '">' + (p.foto ? '<img src="' + esc(p.foto) + '" alt=""><span class="g-foto-cambiar">Cambiar</span>' : '<span>+ Subir foto</span>') +
            '<input type="file" accept="image/*" data-g-foto-in="' + esc(p.id) + '" hidden></label>'
          : '<div class="g-foto">' + (p.foto ? '<img src="' + esc(p.foto) + '" alt="">' : '<span>Sin foto</span>') + '</div>') +
        '<div class="g-prod-txt"><h3>' + esc(p.nombre) + '</h3><div class="linea"><span>' + esc(p.ref) + '</span>' + (p.categoria ? '<span class="pill">' + esc(p.categoria) + '</span>' : '') + (p.activo === false ? '<span class="pill bad">De baja</span>' : '') + (rep ? '<span class="pill warn">Repetido · ' + (u ? 'en ' + u + (u === 1 ? ' documento' : ' documentos') : 'sin documentos') + '</span>' : '') + '</div>' +
        (vs.length ? '<div class="linea">' + esc(medidas.slice(0, 6).join(', ') + (medidas.length > 6 ? '… (' + medidas.length + ' medidas)' : '')) + '</div>' : p.medidas ? '<div class="linea">' + esc(p.medidas) + '</div>' : '') +
        (gs.length ? '<div class="linea">' + esc(gs.map((g) => g.nombre).join(' · ')) + '</div>' : '') +
        (pr ? '<div class="linea"><b style="color:var(--ink)">' + (vs.length > 1 ? 'Desde ' : '') + euros(pr) + '</b><span>+ IVA · ' + euros(Math.round(pr * (1 + iva / 100) * 100) / 100) + ' con IVA</span></div>' : '<div class="linea"><span class="pill warn">Sin precio ni coste</span></div>') +
        '<div class="pie"><span class="der"><button class="mini" type="button" data-abrir="productos:' + esc(p.id) + '">Abrir</button></span></div></div></article>';
    }).join('') + '</div>';
  }

  function vistaClientes() {
    if (!S.listo.clientes) return '<div class="vacio">Cargando clientes…</div>';
    const q = sinTildes(S.gestion.buscar);
    const lista = S.clientes.filter((c) => !q || sinTildes([c.codigo, c.nombre, c.nif, c.localidad, c.correo].join(' ')).includes(q))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    let html = '<div class="filtros">' + buscador('Buscar cliente') + '</div>';
    if (!S.clientes.length) return html + '<div class="vacio">Aún no hay clientes. Se guardan solos al hacer un documento, o puedes darlos de alta con «+ Cliente».</div>';
    return html + '<div class="tabla-wrap"><table class="mov"><thead><tr><th>Código</th><th>Nombre</th><th>NIF</th><th>Localidad</th><th>Teléfono</th><th class="num">Documentos</th></tr></thead><tbody>' +
      lista.map((c) => '<tr class="clic" tabindex="0" data-abrir="clientes:' + esc(c.id) + '"><td>' + esc(c.codigo) + '</td><td><b>' + esc(c.nombre) + '</b></td><td>' + esc(c.nif) + '</td><td>' + esc(c.localidad) + '</td><td>' + esc(c.telefono) + '</td><td class="num">' +
        S.documentos.filter((d) => d.clienteId === c.id).length + '</td></tr>').join('') + '</tbody></table></div>';
  }

  function vistaEmpresa() {
    const e = empresa(), g = ajustesEmpresa();
    const faltan = ['razonSocial', 'nif'].filter((k) => !g[k]);
    return (faltan.length ? '<div class="est-aviso">Faltan datos que deben salir en los documentos: ' + faltan.map((k) => ({ razonSocial: 'nombre o razón social', nif: 'NIF' }[k])).join(', ') + '.</div>' : '') +
      (!g.domicilio ? '<div class="est-aviso">Sin el domicilio fiscal no se pueden hacer facturas completas (las simplificadas sí).</div>' : '') +
      '<div class="card" style="margin-top:12px;max-width:640px"><h3>' + esc(e.razonSocial) + '</h3><div class="txt">NIF ' + esc(e.nif) + '\n' + esc(e.telefono) + ' · ' + esc(e.correo) + '\n' + esc(e.web) + '</div>' +
      '<div class="txt" style="margin-top:8px;color:var(--muted)">Solo en facturas completas: ' + (g.domicilio ? esc(g.domicilio + ', ' + (g.localidad || '')) : 'sin domicilio') + (e.registro ? '\n' + esc(e.registro) : '') + '</div>' +
      '<div class="pie"><span>Validez de los presupuestos: ' + (g.validez || 15) + ' días</span><span class="der">' + (S.escribir ? '<button class="mini" type="button" data-nuevo="empresa">Editar</button>' : '') + '<a class="mini" href="plantilla.html" target="_blank" rel="noopener">Ver la plantilla</a></span></div></div>';
  }

  /* ---------- Producto ---------- */
  // A product is a model (e.g. «Canapé Iron 30») with its sizes (each with cost, price, weight and volume)
  // and its finish and extra groups (each value can add to the cost and to the price).
  function formProducto(p) {
    const nuevo = !p;
    // New products start as Azorín ones: its cost list is quoted with VAT included.
    p = p || { categoria: 'Colchones', iva: '21', activo: true, bultos: 1, proveedor: 'Azorín Descanso', costeConIva: true };
    let foto = p.foto || '';
    let variantes = variantesDe(p).map((v) => Object.assign({}, v));
    let grupos = gruposDe(p).map((g) => Object.assign({}, g, { valores: g.valores.map((x) => Object.assign({}, x)) }));
    const ro = S.escribir ? '' : ' disabled';
    const campos = [
      { n: 'nombre', l: 'Nombre del modelo', req: true, ancho: true, max: 140, ph: 'Ej.: Canapé Iron 30 (sin la medida: las medidas van abajo)' },
      { n: 'ref', l: 'Referencia', req: true, max: 40, ph: 'Ej.: CAN-IRON30' },
      { n: 'categoria', l: 'Categoría', t: 'select', op: CATEGORIAS },
      { n: 'proveedor', l: 'Proveedor', max: 120, lista: S.proveedores.map((x) => x.nombre) },
      { n: 'refProveedor', l: 'Referencia del proveedor', max: 60, ph: 'Ej.: 1052 o página de su tarifa' },
      { n: 'detalle', l: 'Características (una por línea; salen en el documento)', t: 'textarea', ancho: true, ph: 'Altura: 30 cm\nNúcleo: muelle ensacado y viscoelástica\nFirmeza: media' },
      { n: 'notasInternas', l: 'Notas internas (no salen en los documentos)', t: 'textarea', ancho: true, ph: 'Plazos, lo que hay que confirmar con el proveedor…' },
      { n: 'iva', l: 'IVA', t: 'select', op: [['21', '21 %'], ['10', '10 %'], ['4', '4 %'], ['0', 'Sin IVA']] },
      { n: 'bultos', l: 'Bultos por unidad', t: 'dinero', def: 1 },
      { n: 'sepC', l: 'Coste de compra', t: 'sep' },
      { n: 'costeConIva', l: 'Los costes que escribo llevan el IVA incluido (como la tarifa de costes de Azorín)', t: 'check' },
      { n: 'sepU', l: 'Precio único (solo si el producto no tiene medidas)', t: 'sep' },
      { n: 'medidas', l: 'Medida', max: 80, ph: 'Ej.: 70 × 40 cm' },
      { n: 'coste', l: 'Coste de compra (€, no sale en documentos)', t: 'dinero' },
      { n: 'pvpMin', l: 'PVP mínimo del proveedor, con IVA (€)', t: 'dinero' },
      { n: 'precio', l: 'Precio de venta sin IVA, solo si lo fijas a mano (€)', t: 'dinero' },
      { n: 'peso', l: 'Peso por unidad (kg)', t: 'dinero' },
      { n: 'volumen', l: 'Volumen por unidad (m³)', t: 'dinero' },
      { n: 'activo', l: 'Se sigue vendiendo (si no, no sale al buscar)', t: 'check' }
    ];
    const tipicas = MEDIDAS_TIPICAS[p.categoria] || ['', ''];
    const extra = '<div class="campo ancho" id="p-foto-campo"><span class="lbl">Foto (sale en presupuestos, pedidos y albaranes)</span><div class="g-foto-edit"><div class="g-foto" id="p-foto">' + (foto ? '<img src="' + esc(foto) + '" alt="">' : '<span>Sin foto</span>') + '</div>' +
      (S.escribir ? '<div class="g-foto-btns"><label class="btn" for="p-foto-in">Elegir foto</label><input type="file" id="p-foto-in" accept="image/*" hidden><button type="button" class="btn" id="p-foto-quitar"' + (foto ? '' : ' hidden') + '>Quitar</button></div>' : '') + '</div></div>' +
      '<div class="campo ancho" id="p-pvp" style="font-size:13px;color:var(--muted)"></div>' +
      '<div class="separador">Medidas y precios</div>' +
      '<div class="campo ancho"><p class="p-ayuda">Cada medida con su coste de compra y, si el proveedor lo exige, su PVP mínimo con IVA (el precio nunca bajará de ahí). El precio de venta lo calcula el escandallo (Gestión → Escandallos) y sale en gris; escribe uno solo si quieres fijarlo a mano. Si un modelo tiene versiones con precio distinto (por ejemplo cajón entero o partido, o tapa de cama a motor), escribe la versión en su columna.</p>' +
        (S.escribir ? '<div class="p-gen"><label>Anchos (cm)<input id="p-anchos" value="' + esc(tipicas[0]) + '" placeholder="90, 135, 150"></label><label>Largos (cm)<input id="p-largos" value="' + esc(tipicas[1]) + '" placeholder="190, 200 (vacío en cabezales)"></label>' +
          '<label>Versión (opcional)<input id="p-version" placeholder="Ej.: Cajón partido"></label><button type="button" class="btn" id="p-gen">Crear medidas</button></div>' : '') +
        '<div id="p-vars"></div>' +
        (S.escribir ? '<div class="p-acc"><button type="button" class="btn" id="p-var-add">+ Una medida</button></div>' : '') +
      '</div>' +
      '<div class="separador">Acabados y extras</div>' +
      '<div class="campo ancho"><p class="p-ayuda">Grupos que se eligen al añadir el producto a un presupuesto o pedido: color, tapizado, tipo de tapa, apertura, bisagra, patas… Cada opción suma su coste (y su PVP mínimo, si el proveedor lo pone) y el panel calcula lo que suma al precio; escribe «+ Venta» solo para fijarlo a mano. Si no cambia el precio, déjalo en 0.</p>' +
        '<div id="p-grupos"></div>' +
        (S.escribir ? '<div class="p-acc"><button type="button" class="btn" id="p-grupo-add">+ Grupo</button><span id="p-tipicos" class="p-tipicos"></span></div>' : '') +
      '</div>';
    const precioDinero = (v) => (v === '' || v == null || v === 0 ? '' : String(v).replace('.', ','));
    abrirHoja({
      titulo: nuevo ? 'Nuevo producto' : p.nombre, campos, valores: Object.assign({}, p, { iva: String(p.iva ?? 21) }), extra,
      alMontar(form) {
        form.classList.add('hoja-prod');
        // The photo goes first, where it is seen, instead of at the end of the long form.
        const campoFoto = $('p-foto-campo'), primerCampo = form.querySelector('.campos > *');
        if (campoFoto && primerCampo && primerCampo !== campoFoto) primerCampo.before(campoFoto);
        const iva = () => Number(form.elements.iva.value);
        const conIva = (n) => (n ? euros(Math.round(n * (1 + iva() / 100) * 100) / 100) : '');
        // The product as it stands in the form, to price it with the escandallo while typing.
        const actual = () => Object.assign({}, p, { iva: iva(), categoria: form.elements.categoria.value, costeConIva: form.elements.costeConIva.checked,
          coste: num(form.elements.coste.value), pvpMin: num(form.elements.pvpMin.value), precio: 0 });
        const auto = (v) => { const c = calculo(actual(), v ? Object.assign({}, v, { precio: 0 }) : null); return c.valido ? c.precio : 0; };
        const pvp = () => {
          if (variantes.length) { $('p-pvp').textContent = ''; return; }
          const a = auto(null), manual = num(form.elements.precio.value);
          form.elements.precio.placeholder = a ? String(a).replace('.', ',') : '0,00';
          const pr = manual || a;
          $('p-pvp').textContent = pr ? 'Con IVA: ' + conIva(pr) + (manual ? ' (puesto a mano)' : ' (calculado con el escandallo)') : '';
        };
        // Grey price in each size: what the escandallo gives; the VAT column shows the price that will be used.
        const pintarAuto = (i) => {
          const v = variantes[i], fila = $('p-vars').querySelector('[data-v="' + i + '"]'); if (!fila) return;
          const a = auto(v);
          fila.querySelector('[data-k="precio"]').placeholder = a ? String(a).replace('.', ',') : 'Venta';
          fila.querySelector('[data-civa]').textContent = conIva(Number(v.precio) || a);
        };
        // With sizes, the single-price fields are hidden: each size carries its own.
        const unico = ['medidas', 'precio', 'coste', 'pvpMin', 'peso', 'volumen'];
        const sepUnico = Array.from(form.querySelectorAll('.separador')).find((s) => s.textContent.startsWith('Precio único'));
        const ocultarCampo = (n, si) => { const c = form.elements[n].closest('.campo, .chk-linea'); if (c) c.hidden = si; };
        const ajustarUnico = () => {
          const ocultar = variantes.length > 0;
          unico.forEach((n) => ocultarCampo(n, ocultar));
          if (sepUnico) sepUnico.hidden = ocultar;
          pvp();
        };
        const pintarVars = () => {
          const caja = $('p-vars');
          if (!variantes.length) { caja.innerHTML = '<div class="vacio" style="margin:6px 0">Sin medidas: se usa el precio único de arriba. Para colchones, canapés, somieres y cabezales, crea sus medidas.</div>'; ajustarUnico(); return; }
          caja.innerHTML = '<div class="p-var p-var-cab"><span>Medida</span><span>Versión</span><span>Ref.</span><span>Coste</span><span>PVP mín.</span><span>Venta</span><span>Con IVA</span><span>Peso kg</span><span>Vol. m³</span><span></span></div>' +
            variantes.map((v, i) => '<div class="p-var" data-v="' + i + '">' +
              '<input data-k="medida" value="' + esc(v.medida || '') + '" placeholder="150×190" aria-label="Medida"' + ro + '>' +
              '<input data-k="version" value="' + esc(v.version || '') + '" title="' + esc(v.version || '') + '" placeholder="—" aria-label="Versión"' + ro + '>' +
              '<input data-k="ref" value="' + esc(v.ref || '') + '" placeholder="auto" title="Vacía: referencia del modelo + medida" aria-label="Referencia de la medida"' + ro + '>' +
              '<input data-k="coste" inputmode="decimal" value="' + esc(precioDinero(v.coste)) + '" placeholder="Coste" aria-label="Coste de compra"' + ro + '>' +
              '<input data-k="pvpMin" inputmode="decimal" value="' + esc(precioDinero(v.pvpMin)) + '" placeholder="—" aria-label="PVP mínimo del proveedor, con IVA"' + ro + '>' +
              '<input data-k="precio" inputmode="decimal" value="' + esc(precioDinero(v.precio)) + '" placeholder="Venta" aria-label="Precio de venta sin IVA"' + ro + '>' +
              '<span class="p-civa" data-civa="' + i + '"></span>' +
              '<input data-k="peso" inputmode="decimal" value="' + esc(precioDinero(v.peso)) + '" placeholder="kg" aria-label="Peso en kg"' + ro + '>' +
              '<input data-k="volumen" inputmode="decimal" value="' + esc(precioDinero(v.volumen)) + '" placeholder="m³" aria-label="Volumen en m³"' + ro + '>' +
              (S.escribir ? '<button type="button" class="p-x" data-quita-v="' + i + '" aria-label="Quitar medida">×</button>' : '<span></span>') + '</div>').join('');
          variantes.forEach((v, i) => pintarAuto(i));
          ajustarUnico();
        };
        const pintarGrupos = () => {
          $('p-grupos').innerHTML = grupos.length ? grupos.map((g, gi) => '<div class="p-grupo" data-g="' + gi + '">' +
            '<div class="p-grupo-cab"><input data-gk="nombre" value="' + esc(g.nombre || '') + '" placeholder="Nombre del grupo (ej.: Tapizado)" aria-label="Nombre del grupo"' + ro + '>' +
              '<select data-gk="obligatoria" aria-label="Cómo se elige"' + ro + '><option value="1"' + (g.obligatoria !== false ? ' selected' : '') + '>Hay que elegir una</option><option value="0"' + (g.obligatoria === false ? ' selected' : '') + '>Opcional (extra)</option></select>' +
              (S.escribir ? '<button type="button" class="mini" data-quita-g="' + gi + '">Quitar grupo</button>' : '') + '</div>' +
            '<div class="p-val p-val-cab"><span>Opción</span><span>+ Coste</span><span>+ PVP mín.</span><span>+ Venta</span><span></span></div>' +
            (g.valores || []).map((x, xi) => '<div class="p-val" data-x="' + xi + '"><input data-xk="nombre" value="' + esc(x.nombre || '') + '" placeholder="Ej.: Serie 2" aria-label="Opción"' + ro + '>' +
              '<input data-xk="coste" inputmode="decimal" value="' + esc(precioDinero(x.coste)) + '" placeholder="0" aria-label="Suma al coste"' + ro + '>' +
              '<input data-xk="pvpMin" inputmode="decimal" value="' + esc(precioDinero(x.pvpMin)) + '" placeholder="—" aria-label="Suma al PVP mínimo del proveedor, con IVA"' + ro + '>' +
              '<input data-xk="precio" inputmode="decimal" value="' + esc(precioDinero(x.precio)) + '" placeholder="' + esc(String(precioOpcion(actual(), Object.assign({}, x, { precio: 0 })) || 0).replace('.', ',')) + '" aria-label="Suma al precio de venta"' + ro + '>' +
              (S.escribir ? '<button type="button" class="p-x" data-quita-x="' + xi + '" aria-label="Quitar opción">×</button>' : '<span></span>') + '</div>').join('') +
            (S.escribir ? '<button type="button" class="mini" data-anade-x="' + gi + '">+ Opción</button>' : '') + '</div>').join('')
            : '<div class="vacio" style="margin:6px 0">Sin acabados ni extras.</div>';
          if ($('p-tipicos')) {
            const tip = (GRUPOS_TIPICOS[form.elements.categoria.value] || []).filter(([n]) => !grupos.some((g) => sinTildes(g.nombre) === sinTildes(n)));
            $('p-tipicos').innerHTML = tip.length ? 'Añadir: ' + tip.map(([n]) => '<button type="button" class="mini" data-tipico="' + esc(n) + '">' + esc(n) + '</button>').join('') : '';
          }
        };
        pintarVars(); pintarGrupos();
        // Enter inside the size and finish tables must not save the whole product.
        form.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' || !e.target.closest('#p-vars, #p-grupos, .p-gen, .p-acc')) return;
          e.preventDefault();
          if (e.target.closest('.p-gen') && $('p-gen')) $('p-gen').click();
        });
        ['precio', 'coste', 'pvpMin'].forEach((n) => form.elements[n].addEventListener('input', pvp));
        form.elements.costeConIva.addEventListener('change', () => { pintarVars(); pintarGrupos(); });
        form.elements.iva.addEventListener('change', pintarVars);
        form.elements.categoria.addEventListener('change', () => {
          const t = MEDIDAS_TIPICAS[form.elements.categoria.value];
          if (t && $('p-anchos')) { $('p-anchos').value = t[0]; $('p-largos').value = t[1]; }
          pintarGrupos(); pintarVars();
        });

        $('p-vars').addEventListener('input', (e) => {
          const fila = e.target.closest('[data-v]'), k = e.target.dataset.k; if (!fila || !k) return;
          const i = Number(fila.dataset.v);
          variantes[i][k] = ['coste', 'pvpMin', 'precio', 'peso', 'volumen'].includes(k) ? num(e.target.value) : e.target.value.trim();
          if (k === 'precio' || k === 'coste' || k === 'pvpMin') pintarAuto(i);
        });
        $('p-vars').addEventListener('click', (e) => { const b = e.target.closest('[data-quita-v]'); if (b) { variantes.splice(Number(b.dataset.quitaV), 1); pintarVars(); } });
        if ($('p-gen')) $('p-gen').onclick = () => {
          const anchos = numeros($('p-anchos').value), largos = numeros($('p-largos').value), version = $('p-version').value.trim();
          if (!anchos.length) { aviso('Escribe al menos un ancho.'); $('p-anchos').focus(); return; }
          let nuevas = 0;
          anchos.forEach((a) => (largos.length ? largos : ['']).forEach((l) => {
            const medida = l ? a + '×' + l : a + ' cm';
            if (variantes.some((v) => v.medida === medida && (v.version || '') === version)) return;
            variantes.push({ id: nuevoId(), medida, version, ref: '', coste: 0, pvpMin: 0, precio: 0, peso: 0, volumen: 0 }); nuevas++;
          }));
          variantes.sort(ordenVariantes); pintarVars();
          aviso(nuevas ? 'Creadas ' + nuevas + (nuevas === 1 ? ' medida' : ' medidas') + '. Rellena su coste: el precio lo calcula el escandallo.' : 'Esas medidas ya estaban.');
        };
        if ($('p-var-add')) $('p-var-add').onclick = () => {
          variantes.push({ id: nuevoId(), medida: '', version: '', ref: '', coste: 0, pvpMin: 0, precio: 0, peso: 0, volumen: 0 }); pintarVars();
          const f = $('p-vars').querySelector('.p-var:last-child [data-k="medida"]'); if (f) f.focus();
        };

        $('p-grupos').addEventListener('input', (e) => {
          const gEl = e.target.closest('[data-g]'); if (!gEl) return;
          const g = grupos[Number(gEl.dataset.g)];
          if (e.target.dataset.gk === 'nombre') g.nombre = e.target.value.trim();
          const xEl = e.target.closest('[data-x]'), xk = e.target.dataset.xk;
          if (xEl && xk) g.valores[Number(xEl.dataset.x)][xk] = xk === 'nombre' ? e.target.value.trim() : num(e.target.value);
        });
        $('p-grupos').addEventListener('change', (e) => {
          const gEl = e.target.closest('[data-g]');
          if (gEl && e.target.dataset.gk === 'obligatoria') grupos[Number(gEl.dataset.g)].obligatoria = e.target.value === '1';
        });
        $('p-grupos').addEventListener('click', (e) => {
          const b = e.target.closest('button'); if (!b) return;
          const gEl = b.closest('[data-g]'); const g = gEl && grupos[Number(gEl.dataset.g)];
          if (b.dataset.quitaG != null) grupos.splice(Number(b.dataset.quitaG), 1);
          else if (b.dataset.quitaX != null) g.valores.splice(Number(b.dataset.quitaX), 1);
          else if (b.dataset.anadeX != null) g.valores.push({ id: nuevoId(), nombre: '', coste: 0, precio: 0 });
          else return;
          pintarGrupos();
          if (b.dataset.anadeX != null) { const f = $('p-grupos').querySelector('[data-g="' + b.dataset.anadeX + '"] .p-val:last-of-type [data-xk="nombre"]'); if (f) f.focus(); }
        });
        if ($('p-grupo-add')) $('p-grupo-add').onclick = () => {
          grupos.push({ id: nuevoId(), nombre: '', obligatoria: true, valores: [{ id: nuevoId(), nombre: '', coste: 0, precio: 0 }] }); pintarGrupos();
          const f = $('p-grupos').querySelector('.p-grupo:last-child [data-gk="nombre"]'); if (f) f.focus();
        };
        if ($('p-tipicos')) $('p-tipicos').addEventListener('click', (e) => {
          const b = e.target.closest('[data-tipico]'); if (!b) return;
          const t = (GRUPOS_TIPICOS[form.elements.categoria.value] || []).find(([n]) => n === b.dataset.tipico); if (!t) return;
          grupos.push({ id: nuevoId(), nombre: t[0], obligatoria: t[1], valores: t[2].map((n) => ({ id: nuevoId(), nombre: n, coste: 0, precio: 0 })) }); pintarGrupos();
        });

        const pintar = () => { $('p-foto').innerHTML = foto ? '<img src="' + esc(foto) + '" alt="">' : '<span>Sin foto</span>'; if ($('p-foto-quitar')) $('p-foto-quitar').hidden = !foto; };
        if ($('p-foto-in')) $('p-foto-in').addEventListener('change', async (e) => {
          const f = e.target.files[0]; if (!f) return;
          try { foto = await fotoReducida(f); pintar(); } catch (err) { aviso(err.message); }
          e.target.value = '';
        });
        if ($('p-foto-quitar')) $('p-foto-quitar').onclick = () => { foto = ''; pintar(); };
      },
      alGuardar(d) {
        delete d.sepU; delete d.sepC;
        // Only a new or changed reference is checked: a product already repeated (e.g. the tariff loaded twice) must still be editable.
        const refCambiada = nuevo || sinTildes(d.ref) !== sinTildes(p.ref);
        const repetida = S.productos.find((o) => o.id !== p.id && sinTildes(o.ref) === sinTildes(d.ref));
        if (repetida && refCambiada) { aviso('La referencia ' + d.ref + ' ya es de «' + repetida.nombre + '».'); return false; }
        const vs = variantes.filter((v) => v.medida || v.version || v.precio || v.coste)
          .map((v) => ({ id: v.id || nuevoId(), medida: String(v.medida || '').trim(), version: String(v.version || '').trim(), ref: String(v.ref || '').trim(),
            coste: Number(v.coste) || 0, pvpMin: Number(v.pvpMin) || 0, precio: Number(v.precio) || 0, peso: Number(v.peso) || 0, volumen: Number(v.volumen) || 0 }));
        const sinMedida = vs.find((v) => !v.medida);
        if (sinMedida) { aviso('Hay una fila de medidas sin la medida escrita.'); return false; }
        const claves = new Set();
        for (const v of vs) {
          const k = sinTildes(v.medida.replace(/\s/g, '').replace('x', '×') + '|' + v.version);
          if (claves.has(k)) { aviso('La medida ' + nombreVariante(v) + ' está repetida.'); return false; }
          claves.add(k);
        }
        vs.sort(ordenVariantes);
        const gs = grupos.map((g) => ({ id: g.id || nuevoId(), nombre: String(g.nombre || '').trim(), obligatoria: g.obligatoria !== false,
          valores: (g.valores || []).filter((x) => String(x.nombre || '').trim()).map((x) => ({ id: x.id || nuevoId(), nombre: String(x.nombre).trim(), coste: Number(x.coste) || 0, pvpMin: Number(x.pvpMin) || 0, precio: Number(x.precio) || 0 })) }))
          .filter((g) => g.nombre || g.valores.length);
        const grupoMal = gs.find((g) => !g.nombre || !g.valores.length);
        if (grupoMal) { aviso(grupoMal.nombre ? 'El grupo «' + grupoMal.nombre + '» no tiene opciones.' : 'Hay un grupo de acabados sin nombre.'); return false; }
        const tieneCoste = (x) => Number(x.coste) > 0;
        if (!vs.length && !d.precio && !tieneCoste(d)) { aviso('Falta el coste (el escandallo calcula el precio), un precio a mano, o crear las medidas.'); return false; }
        if (vs.length) {
          // Summary fields kept for lists and older documents: lowest price and cost, and the list of sizes.
          d.precio = 0; d.coste = 0; d.pvpMin = 0; d.peso = 0; d.volumen = 0;
          d.medidas = [...new Set(vs.map((v) => v.medida))].join(', ').slice(0, 300);
          const sinPrecio = vs.filter((v) => !v.precio && !tieneCoste(v)).length;
          if (sinPrecio) aviso(sinPrecio + (sinPrecio === 1 ? ' medida no tiene' : ' medidas no tienen') + ' coste ni precio: saldrán a 0 € en los documentos hasta que lo pongas.');
        }
        const cuerpo = Object.assign(d, { variantes: vs, opciones: gs, foto, actualizado: new Date().toISOString() });
        if (nuevo) return escribir(() => col('productos').add(Object.assign(cuerpo, { creado: cuerpo.actualizado, creadoPor: S.yo })), 'Producto añadido', 'añadió el producto «' + d.nombre + '»');
        return escribir(() => col('productos').doc(p.id).update(cuerpo), 'Producto guardado', 'editó el producto «' + d.nombre + '»');
      },
      alBorrar: nuevo ? null : () => escribir(() => col('productos').doc(p.id).delete(), 'Producto eliminado', 'borró el producto «' + p.nombre + '»')
    });
  }

  /* ---------- Escandallos ---------- */
  // Each category has its escandallo (costs on top of the purchase, margin and rounding); a product can have its own.
  // The selling price of every size comes from it unless someone fixes a price by hand.
  const nombreRedondeo = (k) => (REDONDEOS.find((x) => x[0] === k) || REDONDEOS[0])[1];
  const sumaTipo = (e, t) => (e.lineas || []).filter((l) => l.tipo === t).reduce((a, l) => a + (Number(l.valor) || 0), 0);
  const resumenEsc = (e) => [sumaTipo(e, 'fijo') ? euros(sumaTipo(e, 'fijo')) + ' por unidad' : '', sumaTipo(e, 'compra') ? fPct(sumaTipo(e, 'compra')) + ' de la compra' : '',
    sumaTipo(e, 'venta') ? fPct(sumaTipo(e, 'venta')) + ' de la venta' : '', 'margen ' + fPct(Number(e.margen) || 0)].filter(Boolean).join(' · ');
  const CATS_ESC = CATEGORIAS.filter((c) => c !== 'Servicios');
  const claseMargen = (c) => (!c.valido ? '' : c.beneficio < 0 ? 'malo' : c.margen < 10 ? 'justo' : 'bien');

  // One row per size (or one row for a product without sizes): purchase, other costs, total, price and what is left.
  function tablaEscandallo(p, e) {
    const vs = variantesDe(p);
    const filas = (vs.length ? vs : [null]).map((v) => {
      const x = v || p, c = calculo(p, v, e);
      const nombre = v ? nombreVariante(v) : p.medidas || 'Precio único';
      if (!c.valido) return '<tr><td>' + esc(nombre) + '</td><td colspan="7" class="e-nd">' + esc(c.motivo) + '</td></tr>';
      const marca = c.aMano ? '<span class="pill">a mano</span>' : c.subido ? '<span class="pill azul" title="El escandallo daba menos: se ha subido al PVP mínimo del proveedor">PVP mín.</span>' : '';
      return '<tr><td>' + esc(nombre) + '</td><td class="num">' + euros(c.coste) + '</td><td class="num">' + euros(c.costeTotal - c.coste) + '</td><td class="num">' + euros(c.costeTotal) + '</td>' +
        '<td class="num"><b>' + euros(c.precio) + '</b></td><td class="num">' + euros(c.conIva) + (c.bajoMinimo ? ' <span class="pill bad" title="Por debajo del PVP mínimo del proveedor (' + esc(euros(c.minimo)) + ')">bajo mín.</span>' : '') + '</td>' +
        '<td class="num e-' + claseMargen(c) + '">' + euros(c.beneficio) + '</td><td class="num e-' + claseMargen(c) + '">' + fPct(c.margen) + '</td><td>' + marca + '</td></tr>';
    }).join('');
    return '<div class="tabla-wrap"><table class="mov e-tabla"><thead><tr><th>Medida</th><th class="num">Compra</th><th class="num">Otros costes</th><th class="num">Coste total</th><th class="num">Venta sin IVA</th><th class="num">Con IVA</th><th class="num">Beneficio</th><th class="num">Margen</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>';
  }

  function vistaEscandallos() {
    const G = S.gestion, pl = plantillas();
    if (!S.listo.productos) return '<div class="vacio">Cargando productos…</div>';
    let html = '<p class="p-ayuda" style="max-width:880px;margin-top:10px">El escandallo pasa del coste de compra al precio de venta: suma lo que cuesta además el producto (transporte, envío, embalaje, comisiones, publicidad, devoluciones), deja el margen que queráis, añade el IVA y redondea. Nunca baja del PVP mínimo del proveedor. Ese precio es el que entra solo en presupuestos y pedidos; allí se puede cambiar a mano o aplicar un descuento comercial. Todo en € sin IVA salvo «Con IVA».</p>' +
      '<h2 class="e-h2">Escandallo de cada categoría</h2><div class="rejilla-cards e-cats">' + CATS_ESC.map((c) => {
        const e = pl[c], n = S.productos.filter((p) => p.categoria === c).length, propios = S.productos.filter((p) => p.categoria === c && p.escandallo && p.escandallo.propio).length;
        return '<article class="card"><h3>' + esc(c) + '</h3><div class="linea">' + (e ? esc(resumenEsc(e)) : '<span class="pill warn">Sin hacer</span> se usa margen del 30 % y nada más') + '</div>' +
          '<div class="linea">Redondeo: ' + esc(nombreRedondeo((e || ESCANDALLO_BASE).redondeo)) + '</div>' +
          '<div class="pie"><span>' + n + (n === 1 ? ' producto' : ' productos') + (propios ? ' · ' + propios + ' con escandallo propio' : '') + '</span><span class="der"><button class="mini" type="button" data-esc-cat="' + esc(c) + '">' + (S.escribir ? 'Editar' : 'Ver') + '</button></span></div></article>';
      }).join('') + '</div>';
    const cats = ['todas'].concat(CATEGORIAS.filter((c) => S.productos.some((p) => p.categoria === c)));
    const q = sinTildes(G.buscar);
    const lista = S.productos.filter((p) => p.activo !== false).filter((p) => G.categoria === 'todas' || p.categoria === G.categoria)
      .filter((p) => !q || sinTildes(textoBusqueda(p)).includes(q))
      .sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '') || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    html += '<h2 class="e-h2">Escandallo de cada producto</h2><div class="filtros">' + cats.map((c) => '<button class="chip" type="button" data-gcat="' + esc(c) + '" aria-pressed="' + (G.categoria === c) + '">' + esc(c === 'todas' ? 'Todas' : c) + '</button>').join('') + buscador('Buscar producto o medida') + '</div>';
    if (!S.productos.length) return html + '<div class="vacio">Todavía no hay productos. Dalos de alta en Productos → «+ Producto».</div>';
    if (!lista.length) return html + '<div class="vacio">Ningún producto con este filtro.</div>';
    // Long lists are cut so the page stays light; the search narrows them down.
    const max = 12, vistos = lista.slice(0, max);
    return html + vistos.map((p) => {
      const propio = p.escandallo && p.escandallo.propio;
      return '<section class="card e-prod"><div class="e-prod-cab"><div><h3>' + esc(p.nombre) + '</h3><div class="linea"><span>' + esc(p.ref) + '</span><span class="pill">' + esc(p.categoria || '') + '</span>' +
        '<span class="pill ' + (propio ? 'azul' : '') + '">' + (propio ? 'Escandallo propio' : 'Escandallo de ' + esc(p.categoria || 'la categoría')) + '</span>' + (p.costeConIva ? '<span class="pill">Coste con IVA</span>' : '') + '</div></div>' +
        '<span class="der"><button class="mini" type="button" data-esc-prod="' + esc(p.id) + '">' + (S.escribir ? 'Editar escandallo' : 'Ver escandallo') + '</button><button class="mini" type="button" data-abrir="productos:' + esc(p.id) + '">Ficha</button></span></div>' +
        tablaEscandallo(p) + '</section>';
    }).join('') + (lista.length > max ? '<div class="vacio">Se ven ' + max + ' de ' + lista.length + ' productos. Busca o filtra por categoría para ver el resto.</div>' : '');
  }

  // Editor of the cost lines of an escandallo, inside a form. lineas is changed in place.
  function editorLineas(lineas, caja, alCambiar) {
    const ro = S.escribir ? '' : ' disabled';
    const pintar = () => {
      caja.innerHTML = '<div class="e-lin e-lin-cab"><span>Concepto</span><span>Cómo se cuenta</span><span>Valor</span><span></span></div>' + lineas.map((l, i) => '<div class="e-lin" data-l="' + i + '">' +
        '<input data-lk="concepto" value="' + esc(l.concepto || '') + '" placeholder="Ej.: Envío al cliente" aria-label="Concepto"' + ro + '>' +
        '<select data-lk="tipo" aria-label="Cómo se cuenta"' + ro + '>' + TIPOS_COSTE.map(([k, n]) => '<option value="' + k + '"' + (l.tipo === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
        '<input data-lk="valor" inputmode="decimal" value="' + esc(l.valor ? String(l.valor).replace('.', ',') : '') + '" placeholder="0" aria-label="Valor"' + ro + '>' +
        (S.escribir ? '<button type="button" class="p-x" data-quita-l="' + i + '" aria-label="Quitar concepto">×</button>' : '<span></span>') + '</div>').join('') +
        (S.escribir ? '<button type="button" class="mini" data-anade-l>+ Concepto</button>' : '');
    };
    caja.addEventListener('input', (e) => {
      const f = e.target.closest('[data-l]'), k = e.target.dataset.lk; if (!f || !k) return;
      lineas[Number(f.dataset.l)][k] = k === 'valor' ? num(e.target.value) : e.target.value.trim(); alCambiar();
    });
    caja.addEventListener('change', (e) => { const f = e.target.closest('[data-l]'); if (f && e.target.dataset.lk === 'tipo') { lineas[Number(f.dataset.l)].tipo = e.target.value; alCambiar(); } });
    caja.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.quitaL != null) lineas.splice(Number(b.dataset.quitaL), 1);
      else if (b.dataset.anadeL != null) lineas.push({ concepto: '', tipo: 'fijo', valor: 0 });
      else return;
      pintar(); alCambiar();
      if (b.dataset.anadeL != null) { const x = caja.querySelector('.e-lin:last-of-type [data-lk="concepto"]'); if (x) x.focus(); }
    });
    pintar();
    return { pintar };
  }
  const limpiarLineas = (lineas) => lineas.filter((l) => String(l.concepto || '').trim() || Number(l.valor))
    .map((l) => ({ concepto: String(l.concepto || '').trim() || 'Sin nombre', tipo: TIPOS_COSTE.some(([k]) => k === l.tipo) ? l.tipo : 'fijo', valor: Number(l.valor) || 0 }));
  const sinHueco = (e) => 1 - sumaTipo(e, 'venta') / 100 - (Number(e.margen) || 0) / 100 <= 0.01;

  function formEscCategoria(cat) {
    const e = JSON.parse(JSON.stringify(plantillas()[cat] || ESCANDALLO_BASE));
    const campos = [
      { n: 'margen', l: 'Margen de beneficio, % sobre el precio de venta sin IVA', t: 'dinero' },
      { n: 'redondeo', l: 'Redondeo del precio con IVA', t: 'select', op: REDONDEOS }
    ];
    const extra = '<div class="separador">Costes además de la compra (por cada unidad vendida)</div>' +
      '<div class="campo ancho"><p class="p-ayuda">«€ por unidad»: transporte, envío al cliente, embalaje, montaje… «% de la venta»: comisión de cobro, publicidad, devoluciones y garantía. «% de la compra»: mermas o seguros que van con el coste.</p><div id="e-lineas"></div></div>' +
      '<div class="campo ancho"><div class="e-ejemplo" id="e-ejemplo"></div></div>';
    abrirHoja({
      titulo: 'Escandallo · ' + cat, campos, valores: { margen: e.margen, redondeo: e.redondeo || '9' }, extra,
      alMontar(form) {
        form.classList.add('hoja-prod');
        const ejemplo = () => {
          const ee = Object.assign({}, e, { margen: num(form.elements.margen.value), redondeo: form.elements.redondeo.value });
          const prod = S.productos.find((p) => p.categoria === cat && !(p.escandallo && p.escandallo.propio) && variantesDe(p).length);
          let html = '<b>Así queda</b>';
          if (sinHueco(ee)) html += '<p class="e-nd">Los % sobre la venta y el margen suman 100 % o más: no hay precio posible.</p>';
          else if (prod) html += '<p>' + esc(prod.nombre) + ':</p>' + tablaEscandallo(prod, ee);
          else {
            const c = desglose(100, ee, { iva: 21 });
            html += '<p>Con un coste de compra de 100 € sin IVA: coste total ' + euros(c.costeTotal) + ', venta ' + euros(c.precio) + ' sin IVA (' + euros(c.conIva) + ' con IVA), beneficio ' + euros(c.beneficio) + ' (' + fPct(c.margen) + ').</p>';
          }
          $('e-ejemplo').innerHTML = html;
        };
        editorLineas(e.lineas, $('e-lineas'), ejemplo);
        form.elements.margen.addEventListener('input', ejemplo); form.elements.redondeo.addEventListener('change', ejemplo);
        ejemplo();
      },
      alGuardar(d) {
        const nuevo = { lineas: limpiarLineas(e.lineas), margen: Number(d.margen) || 0, redondeo: d.redondeo };
        if (sinHueco(nuevo)) { aviso('Los % sobre la venta y el margen suman 100 % o más: bájalos.'); return false; }
        const todas = Object.assign({}, plantillas(), { [cat]: nuevo });
        return escribir(() => col('ajustes').doc('escandallos').set({ categorias: todas, actualizado: new Date().toISOString() }), 'Escandallo guardado', 'cambió el escandallo de ' + cat);
      }
    });
  }

  function formEscProducto(p) {
    const propioAntes = !!(p.escandallo && p.escandallo.propio);
    const e = JSON.parse(JSON.stringify(propioAntes ? p.escandallo : escandalloDe(p, plantillas())));
    const manuales = variantesDe(p).filter((v) => Number(v.precio)).length + (variantesDe(p).length ? 0 : Number(p.precio) ? 1 : 0);
    const campos = [
      { n: 'usar', l: 'Escandallo', t: 'select', op: [['cat', 'El de su categoría (' + (p.categoria || '—') + ')'], ['propio', 'Uno propio para este producto']] },
      { n: 'costeConIva', l: 'Sus costes de compra llevan el IVA incluido (como la tarifa de Azorín)', t: 'check' },
      { n: 'margen', l: 'Margen de beneficio, % sobre el precio de venta sin IVA', t: 'dinero' },
      { n: 'redondeo', l: 'Redondeo del precio con IVA', t: 'select', op: REDONDEOS }
    ].concat(manuales ? [{ n: 'quitarManuales', l: 'Quitar los ' + manuales + (manuales === 1 ? ' precio puesto' : ' precios puestos') + ' a mano y usar el escandallo en todo', t: 'check' }] : []);
    const extra = '<div class="campo ancho" id="e-propio"><span class="lbl">Costes además de la compra</span><div id="e-lineas"></div></div>' +
      '<div class="campo ancho"><div class="e-ejemplo" id="e-ejemplo"></div></div>';
    abrirHoja({
      titulo: 'Escandallo · ' + p.nombre, campos, valores: { usar: propioAntes ? 'propio' : 'cat', costeConIva: !!p.costeConIva, margen: e.margen, redondeo: e.redondeo || '9' }, extra,
      alMontar(form) {
        form.classList.add('hoja-prod');
        const propio = () => form.elements.usar.value === 'propio';
        const actual = () => {
          const prod = Object.assign({}, p, { costeConIva: form.elements.costeConIva.checked });
          if (form.elements.quitarManuales && form.elements.quitarManuales.checked) { prod.variantes = variantesDe(p).map((v) => Object.assign({}, v, { precio: 0 })); prod.precio = 0; }
          return prod;
        };
        const esc2 = () => (propio() ? Object.assign({}, e, { margen: num(form.elements.margen.value), redondeo: form.elements.redondeo.value }) : escandalloDe(Object.assign({}, p, { escandallo: null }), plantillas()));
        const previa = () => {
          ['margen', 'redondeo'].forEach((n) => { form.elements[n].closest('.campo').hidden = !propio(); });
          $('e-propio').hidden = !propio();
          const ee = esc2();
          $('e-ejemplo').innerHTML = '<b>Así queda</b>' + (propio() ? '' : '<p>' + esc(resumenEsc(ee)) + ' · redondeo: ' + esc(nombreRedondeo(ee.redondeo).toLowerCase()) + '</p>') +
            (sinHueco(ee) ? '<p class="e-nd">Los % sobre la venta y el margen suman 100 % o más.</p>' : tablaEscandallo(actual(), ee));
        };
        editorLineas(e.lineas, $('e-lineas'), previa);
        form.addEventListener('input', previa); form.addEventListener('change', previa);
        previa();
      },
      alGuardar(d) {
        const cambio = { costeConIva: !!d.costeConIva, actualizado: new Date().toISOString() };
        if (d.usar === 'propio') {
          cambio.escandallo = { propio: true, lineas: limpiarLineas(e.lineas), margen: Number(d.margen) || 0, redondeo: d.redondeo };
          if (sinHueco(cambio.escandallo)) { aviso('Los % sobre la venta y el margen suman 100 % o más: bájalos.'); return false; }
        } else cambio.escandallo = { propio: false };
        if (d.quitarManuales) {
          if (variantesDe(p).length) cambio.variantes = (p.variantes || []).map((v) => Object.assign({}, v, { precio: 0 }));
          else cambio.precio = 0;
        }
        return escribir(() => col('productos').doc(p.id).update(cambio), 'Escandallo guardado', 'cambió el escandallo de «' + p.nombre + '»');
      }
    });
  }

  /* ---------- Productos repetidos ---------- */
  // Products with the same reference (the tariff loaded twice): keep the copy used in documents
  // (or, failing that, the one with a photo, more sizes, or the oldest) and the rest can go. Copies used in documents are never removed.
  function copiasSobrantes() {
    const usos = (p) => S.documentos.filter((d) => (d.lineas || []).some((l) => l.productoId === p.id)).length;
    const grupos = new Map();
    for (const p of S.productos) { const k = sinTildes(p.ref).trim(); if (!k) continue; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); }
    const sobran = [], usadas = [];
    for (const g of grupos.values()) {
      if (g.length < 2) continue;
      const orden = g.map((p) => ({ p, u: usos(p) })).sort((a, b) => b.u - a.u || (b.p.foto ? 1 : 0) - (a.p.foto ? 1 : 0) ||
        variantesDe(b.p).length - variantesDe(a.p).length || String(a.p.creado || '').localeCompare(String(b.p.creado || '')));
      for (const x of orden.slice(1)) (x.u ? usadas : sobran).push({ p: x.p, queda: orden[0].p });
    }
    return { sobran, usadas };
  }
  async function quitarRepetidos() {
    if (!S.escribir || !S.listo.productos || !S.listo.documentos) { aviso('Espera a que terminen de cargar los productos y los documentos.'); return; }
    const { sobran, usadas } = copiasSobrantes();
    if (!sobran.length) { aviso('No hay productos repetidos que se puedan quitar.'); return; }
    if (!confirm('Hay ' + sobran.length + ' productos repetidos (misma referencia). Se borra la copia que sobra de cada uno y se queda la que está en documentos o tiene foto. ' +
      'Las copias que salen en algún documento no se tocan. ¿Borrar las ' + sobran.length + ' copias?')) return;
    await escribir(async () => {
      for (let i = 0; i < sobran.length; i += 20) {
        await Promise.all(sobran.slice(i, i + 20).map(({ p, queda }) => (p.foto && !queda.foto
          ? col('productos').doc(queda.id).update({ foto: p.foto }).then(() => { queda.foto = p.foto; }) // keep a photo that was only on the copy
          : Promise.resolve()).then(() => col('productos').doc(p.id).delete())));
      }
    }, sobran.length + ' productos repetidos quitados' + (usadas.length ? '. Quedan ' + usadas.length + ' copias que están en documentos: revísalas a mano.' : ''), 'quitó ' + sobran.length + ' productos repetidos');
  }

  /* ---------- Cliente ---------- */
  const CAMPOS_CLIENTE = [
    { n: 'nombre', l: 'Nombre o empresa', req: true, ancho: true, max: 160 },
    { n: 'nif', l: 'NIF / DNI', max: 30 },
    { n: 'codigo', l: 'Código', max: 12 },
    { n: 'direccion', l: 'Dirección', ancho: true, max: 200 },
    { n: 'localidad', l: 'CP y localidad', max: 120 },
    { n: 'pais', l: 'País', max: 60 },
    { n: 'telefono', l: 'Teléfono', max: 40 },
    { n: 'correo', l: 'Correo', t: 'email', max: 120 },
    { n: 'att', l: 'A la atención de', ancho: true, max: 120 },
    { n: 'sepE', l: 'Dirección de envío, si es otra', t: 'sep' },
    { n: 'envioNombre', l: 'Nombre en el envío', ancho: true, max: 160 },
    { n: 'envioDireccion', l: 'Dirección', ancho: true, max: 200 },
    { n: 'envioLocalidad', l: 'CP y localidad', max: 120 },
    { n: 'envioPais', l: 'País', max: 60 },
    { n: 'envioContacto', l: 'Contacto para la entrega', ancho: true, max: 120 },
    { n: 'notas', l: 'Notas', t: 'textarea', ancho: true }
  ];
  function formCliente(c) {
    const nuevo = !c;
    c = c || { codigo: siguienteCodigoCliente(), pais: 'España' };
    abrirHoja({
      titulo: nuevo ? 'Nuevo cliente' : c.nombre, campos: CAMPOS_CLIENTE, valores: c,
      alGuardar(d) {
        delete d.sepE;
        d.actualizado = new Date().toISOString();
        if (nuevo) return escribir(() => col('clientes').add(Object.assign(d, { creado: d.actualizado, creadoPor: S.yo })), 'Cliente añadido', 'añadió el cliente «' + d.nombre + '»');
        return escribir(() => col('clientes').doc(c.id).update(d), 'Cliente guardado', 'editó el cliente «' + d.nombre + '»');
      },
      alBorrar: nuevo ? null : () => escribir(() => col('clientes').doc(c.id).delete(), 'Cliente eliminado', 'borró el cliente «' + c.nombre + '»')
    });
  }

  /* ---------- Datos de la empresa ---------- */
  function formEmpresa() {
    const g = ajustesEmpresa();
    const campos = [
      { n: 'sepA', l: 'En todos los documentos (bastan para la factura simplificada)', t: 'sep' },
      { n: 'razonSocial', l: 'Nombre y apellidos del autónomo (o razón social)', req: true, ancho: true, max: 160 },
      { n: 'nif', l: 'NIF (el DNI con la letra)', req: true, max: 20 },
      { n: 'telefono', l: 'Teléfono', max: 40 },
      { n: 'correo', l: 'Correo', max: 120 },
      { n: 'web', l: 'Web', max: 120 },
      { n: 'sepF', l: 'Solo en facturas completas (no sale en presupuestos, pedidos, albaranes ni facturas simplificadas)', t: 'sep' },
      { n: 'domicilio', l: 'Domicilio fiscal (calle y número)', ancho: true, max: 160, ph: 'El del modelo 036' },
      { n: 'localidad', l: 'CP, localidad y provincia', ancho: true, max: 120 },
      { n: 'registro', l: 'Registro Mercantil (solo si sois sociedad)', ancho: true, max: 240, ph: 'Registro Mercantil de Murcia, tomo …, folio …, hoja …' },
      { n: 'sepC', l: 'Valores que se ponen solos en cada documento nuevo', t: 'sep' },
      { n: 'validez', l: 'Días de validez de los presupuestos', t: 'number', max: 3 },
      { n: 'formaPago', l: 'Forma de pago', max: 200 },
      { n: 'condPresupuesto', l: 'Condiciones del presupuesto (una por línea)', t: 'textarea', ancho: true },
      { n: 'condPedido', l: 'Condiciones del pedido (una por línea)', t: 'textarea', ancho: true },
      { n: 'condAlbaran', l: 'Notas del albarán (una por línea)', t: 'textarea', ancho: true }
    ];
    const valores = Object.assign({ telefono: EMPRESA.telefono, correo: EMPRESA.correo, web: EMPRESA.web, validez: 15,
      condPresupuesto: CONDICIONES_BASE.presupuesto, condPedido: CONDICIONES_BASE.pedido, condAlbaran: CONDICIONES_BASE.albaran }, g);
    abrirHoja({
      titulo: 'Datos de la empresa', campos, valores,
      alGuardar(d) {
        delete d.sepC; delete d.sepA; delete d.sepF;
        d.validez = Math.max(1, parseInt(d.validez, 10) || 15);
        return escribir(() => col('ajustes').doc('empresa').set(d), 'Datos guardados', 'cambió los datos de la empresa para los documentos');
      }
    });
  }

  /* ---------- Documento ---------- */
  function nuevoDocumento(tipo, base, sentido) {
    const g = ajustesEmpresa();
    const fecha = hoyIso();
    const compra = tipo === 'pedido' && sentido === 'compra';
    // An invoice is full when the customer gave a NIF (a company, or someone who asked for it); otherwise simplified.
    const modalidad = tipo !== 'factura' ? '' : (base && base.modalidad) || (base && base.cliente && base.cliente.nif ? 'completa' : 'simplificada');
    const d = Object.assign({
      tipo, fecha, numero: siguienteNumero(tipo, fecha, compra, modalidad), estado: ESTADOS_DOC[tipo][0][0], comercial: S.yo || '',
      cliente: { pais: 'España' }, envio: {}, lineas: [], logistica: {},
      formaPago: compra ? '' : g.formaPago || '', notas: '',
      // A purchase order carries no customer conditions; whatever we ask the supplier goes in Notas.
      // «Portes incluidos» no longer applies (shipping is charged apart), even if it was saved in Datos de la empresa.
      condiciones: compra ? [] : sinPortesIncluidos(lineasDe({ presupuesto: g.condPresupuesto ?? CONDICIONES_BASE.presupuesto, pedido: g.condPedido ?? CONDICIONES_BASE.pedido, albaran: g.condAlbaran ?? CONDICIONES_BASE.albaran, factura: CONDICIONES_BASE.factura }[tipo]))
    }, compra ? { sentido: 'compra' } : {}, modalidad ? { modalidad } : {}, base || {}, modalidad ? { modalidad } : {});
    if (tipo === 'presupuesto' && !d.validoHasta) d.validoHasta = sumaDias(fecha, Number(g.validez) || 15);
    return d;
  }

  // In a purchase order the line takes the purchase cost, not the selling price.
  // v is the chosen size (if the product has sizes) and elegidos the chosen finishes: [[grupo, valor], …].
  function lineaDeProducto(p, compra, v, elegidos = [], cantidad = 1) {
    let precio = compra ? costeDe(p, v || p) : precioDe(p, v);
    let coste = costeDe(p, v || p);
    const acabados = elegidos.map(([g, x]) => { precio += compra ? costeDe(p, x) : precioOpcion(p, x); coste += costeDe(p, x); return g.nombre + ': ' + x.nombre; });
    const ref = v ? v.ref || [p.ref, String(v.medida || '').replace(/\D+/g, '')].filter(Boolean).join('-') : p.ref || '';
    precio = Math.round(precio * 100) / 100;
    // precioCatalogo and coste stay in the document but are never printed: they flag a hand-changed price and give the margin.
    return { productoId: p.id, varianteId: v ? v.id : '', ref, descripcion: (p.nombre || '') + (v ? ' ' + v.medida : ''),
      detalle: [v ? v.version : p.medidas ? 'Medidas: ' + p.medidas : ''].concat(acabados, [p.detalle || '']).filter(Boolean).join('\n'),
      cantidad, precio, precioCatalogo: precio, coste: Math.round(coste * 100) / 100, dto1: 0, dto2: 0, iva: Number(p.iva ?? 21) };
  }

  // Bultos, peso y volumen sumados de los productos del catálogo (de la medida elegida si la tiene).
  function logisticaDe(lineas) {
    let bultos = 0, peso = 0, volumen = 0, alguno = false;
    lineas.forEach((l) => {
      const p = l.productoId && producto(l.productoId); if (!p) return;
      const v = l.varianteId && variantesDe(p).find((x) => x.id === l.varianteId);
      const n = Number(l.cantidad) || 0; alguno = true;
      bultos += n * (Number(p.bultos) || (p.categoria === 'Servicios' ? 0 : 1)); peso += n * (Number((v || p).peso) || 0); volumen += n * (Number((v || p).volumen) || 0);
    });
    const r = (v) => Math.round(v * 100) / 100;
    return alguno ? { bultos: r(bultos) || '', pesoBruto: r(peso) || '', volumen: r(volumen) || '' } : {};
  }

  function paraImprimir(d) {
    return Object.assign({}, d, { lineas: (d.lineas || []).map((l) => Object.assign({}, l, { imagen: (l.productoId && (producto(l.productoId) || {}).foto) || '' })),
      comercial: (PERSONAS[d.comercial] || {}).n || d.comercial || '' });
  }
  function imprimir(d) {
    const w = window.open('', '_blank');
    if (!w) { aviso('El navegador ha bloqueado la ventana. Permite las ventanas emergentes para el panel.'); return; }
    const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="' + esc(base) + '"><title>' + esc(d.numero || 'Documento') + '</title>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#E9E9EE}.doc{box-shadow:0 4px 24px rgba(0,0,0,.15);margin:16px auto}@media print{body{background:#fff}.doc{box-shadow:none;margin:0}}' + ESTILOS_DOCUMENTO + '</style></head><body>' +
      documentoHTML(paraImprimir(d), empresa()) + '</body></html>');
    w.document.close();
    const listo = () => setTimeout(() => { w.focus(); w.print(); }, 150);
    const imgs = Array.from(w.document.images);
    Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; })))).then(listo);
  }

  function editorDocumento(original, plantilla) {
    const nuevo = !original || !original.id;
    const d = JSON.parse(JSON.stringify(original || plantilla));
    d.cliente = d.cliente || {}; d.envio = d.envio || {}; d.lineas = d.lineas || []; d.logistica = d.logistica || {};
    const tipo = d.tipo;
    const compra = esCompra(d);
    const titulo = tituloDe(d);
    const ro = S.escribir ? '' : ' disabled';
    const campo = (id, l, v, extra = '') => '<div class="campo"><label for="' + id + '">' + l + '</label><input id="' + id + '" value="' + esc(v ?? '') + '"' + extra + ro + '></div>';
    const fechaCampo = (id, l, v) => campo(id, l, v, ' type="date"');
    const estados = estadosDe(d).map(([k, n]) => '<option value="' + k + '"' + (d.estado === k ? ' selected' : '') + '>' + n + '</option>').join('');
    const personas = Object.keys(PERSONAS).filter((k) => k !== 'todos').map((k) => '<option value="' + k + '"' + (d.comercial === k ? ' selected' : '') + '>' + esc(PERSONAS[k].n) + '</option>').join('');
    const env = d.envio;
    const otroEnvio = !!(env.direccion || env.nombre);
    const factura = tipo === 'factura';
    // Gender of the document name in messages («el albarán», «la factura»).
    const el = factura ? 'la ' : 'el ', guardadoTxt = factura ? ' guardada' : ' guardado', eliminadoTxt = factura ? ' eliminada' : ' eliminado';
    const botonConv = (a, txt) => '<button type="button" class="btn" data-convertir="' + a + '">' + txt + '</button>';
    const conversion = !nuevo && S.escribir && !compra ? (tipo === 'presupuesto' ? botonConv('pedido', 'Pasar a pedido')
      : tipo === 'pedido' ? botonConv('albaran', 'Hacer albarán') + botonConv('factura', 'Hacer factura')
      : tipo === 'albaran' ? botonConv('factura', 'Hacer factura') : '') : '';
    const modalidades = [['simplificada', 'Simplificada (hasta 3.000 €, sin domicilio)'], ['completa', 'Completa (con domicilio y NIF del cliente)']]
      .map(([k, n]) => '<option value="' + k + '"' + ((d.modalidad || 'simplificada') === k ? ' selected' : '') + '>' + n + '</option>').join('');

    $('capa').innerHTML = '<div class="velo" id="velo"><form class="hoja hoja-doc" id="hoja" novalidate>' +
      '<h2 style="display:flex;flex-wrap:wrap;align-items:baseline;gap:8px"><span id="d-titulo">' + esc(titulo) + '</span> <span id="d-titulo-num" style="color:var(--muted);font-weight:500">' + esc(d.numero) + '</span><a class="mini" href="guia-gestion.html#documento" target="_blank" rel="noopener" style="margin-left:auto;font-family:var(--f-body)">Guía de campos</a></h2>' +
      '<div class="campos g-tres">' +
        (factura ? '<div class="campo"><label for="d-modalidad">Tipo de factura</label><select id="d-modalidad"' + ro + '>' + modalidades + '</select></div>' : '') +
        campo('d-numero', 'Número', d.numero) + fechaCampo('d-fecha', factura ? 'Fecha de expedición' : 'Fecha', d.fecha) +
        (factura ? fechaCampo('d-operacion', 'Fecha de la venta (si es otra)', d.fechaOperacion)
          : tipo === 'presupuesto' ? fechaCampo('d-valido', 'Válido hasta', d.validoHasta) : tipo === 'pedido' ? fechaCampo('d-entrega', 'Entrega prevista', d.entregaPrevista) : fechaCampo('d-entregado', 'Fecha de entrega', d.fechaEntrega)) +
        '<div class="campo"><label for="d-estado">Estado</label><select id="d-estado"' + ro + '>' + estados + '</select></div>' +
        '<div class="campo"><label for="d-comercial">' + (compra ? 'Pedido por' : 'Atendido por') + '</label><select id="d-comercial"' + ro + '><option value=""></option>' + personas + '</select></div>' +
        campo('d-suref', 'Su referencia', d.suReferencia, ' maxlength="80"') +
      '</div>' +
      '<div class="separador">' + (compra ? 'Proveedor' : 'Cliente') + '</div>' +
      '<div class="campos g-tres">' +
        (compra
          ? '<div class="campo ancho"><label for="d-cli-nombre">Proveedor (escribe para buscar entre los de «Proveedores»)</label><input id="d-cli-nombre" list="d-clientes" autocomplete="off" value="' + esc(d.cliente.nombre || '') + '"' + ro + '>' +
            '<datalist id="d-clientes">' + S.proveedores.map((p) => '<option value="' + esc(p.nombre) + '">' + esc(p.que || '') + '</option>').join('') + '</datalist></div>'
          // Customers: type part of the name, NIF, code, town or phone and pick from the list; their details fill in.
          : '<div class="campo ancho"><label for="d-cli-nombre">Cliente: escribe parte del nombre, NIF, teléfono o localidad y elígelo</label><div class="g-cli"><input id="d-cli-nombre" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="d-cli-res" aria-expanded="false" value="' + esc(d.cliente.nombre || '') + '"' + ro + '>' +
            '<div class="g-resultados" id="d-cli-res" role="listbox" hidden></div></div></div>') +
        campo('d-cli-nif', 'NIF / DNI', d.cliente.nif) + campo('d-cli-tel', 'Teléfono', d.cliente.telefono) + campo('d-cli-correo', 'Correo', d.cliente.correo, ' type="email"') +
        '<div class="campo ancho"><label for="d-cli-dir">Dirección</label><input id="d-cli-dir" value="' + esc(d.cliente.direccion || '') + '"' + ro + '></div>' +
        campo('d-cli-loc', 'CP y localidad', d.cliente.localidad) + campo('d-cli-pais', 'País', d.cliente.pais) + campo('d-cli-att', 'A la atención de', d.cliente.att) +
        (compra ? '' : '<label class="chk-linea campo ancho"><input type="checkbox" id="d-cli-guardar" checked' + ro + '> Guardar o actualizar este cliente en «Clientes»</label>') +
        '<label class="chk-linea campo ancho"' + (factura ? ' hidden' : '') + '><input type="checkbox" id="d-otro-envio"' + (otroEnvio ? ' checked' : '') + ro + '> ' + (compra ? 'Entregar en otra dirección (si no, en la nuestra)' : 'Enviar a otra dirección') + '</label>' +
        (factura ? '<p class="campo ancho" id="d-fac-ayuda" style="margin:0;font-size:13px;color:var(--muted)"></p>' : '') +
      '</div>' +
      '<div class="campos g-tres" id="d-envio"' + (!factura && (otroEnvio || tipo === 'albaran') ? '' : ' hidden') + '>' +
        '<div class="campo ancho"><label for="d-env-nombre">Nombre en el envío</label><input id="d-env-nombre" value="' + esc(env.nombre || '') + '"' + ro + '></div>' +
        '<div class="campo ancho"><label for="d-env-dir">Dirección de envío</label><input id="d-env-dir" value="' + esc(env.direccion || '') + '"' + ro + '></div>' +
        campo('d-env-loc', 'CP y localidad', env.localidad) + campo('d-env-pais', 'País', env.pais) + campo('d-env-contacto', 'Contacto para la entrega', env.contacto) +
        (tipo === 'albaran' ? campo('d-env-trans', 'Transporte', env.transportista) + campo('d-env-seg', 'Seguimiento', env.seguimiento) : '') +
      '</div>' +
      '<div class="separador">Productos</div>' +
      (S.escribir ? '<div class="g-busca"><input type="search" id="d-buscar" autocomplete="off" placeholder="Busca por nombre, referencia o categoría y pulsa Intro" aria-label="Buscar producto">' +
        '<button type="button" class="btn" id="d-libre">+ Línea libre</button><div class="g-resultados" id="d-resultados" hidden></div></div><div class="g-elegir" id="d-elegir" hidden></div>' : '') +
      '<div id="d-lineas" class="g-lineas"></div>' +
      '<div class="g-cierre"><div class="campos g-tres">' +
        campo('d-forma', 'Forma de pago', d.formaPago, ' maxlength="200"') +
        (tipo === 'pedido' ? campo('d-pagado', 'Pagado a cuenta (€)', decimal(d.pagado), ' inputmode="decimal"') : factura ? campo('d-pagado', 'Cobrado (€)', decimal(d.pagado), ' inputmode="decimal"') : '') +
        (S.escribir && !compra ? '<div class="campo"><label for="d-dtocom">Descuento comercial a todas las líneas (%)</label><div class="g-dtocom"><input id="d-dtocom" inputmode="decimal" placeholder="Ej.: 10"><button type="button" class="btn" id="d-dtocom-aplicar">Aplicar</button></div></div>' : '') +
        (tipo === 'albaran' ? '<label class="chk-linea campo"><input type="checkbox" id="d-valorado"' + (d.valorado ? ' checked' : '') + ro + '> Albarán con precios</label>' : '') +
        (factura ? '' : campo('d-bultos', 'Bultos', decimal(d.logistica.bultos), ' inputmode="decimal"') + campo('d-peso', 'Peso bruto (kg)', decimal(d.logistica.pesoBruto), ' inputmode="decimal"') +
        campo('d-pesoneto', 'Peso neto (kg)', decimal(d.logistica.pesoNeto), ' inputmode="decimal"') + campo('d-volumen', 'Volumen (m³)', decimal(d.logistica.volumen), ' inputmode="decimal"') +
        (S.escribir ? '<div class="campo" style="align-self:end"><button type="button" class="btn" id="d-calc-log">Calcular de los productos</button></div>' : '')) +
        '<div class="campo ancho"><label for="d-notas">Notas</label><textarea id="d-notas" maxlength="2000"' + ro + '>' + esc(d.notas || '') + '</textarea></div>' +
        '<div class="campo ancho"><label for="d-cond">Condiciones (una por línea)</label><textarea id="d-cond" maxlength="3000"' + ro + '>' + esc((d.condiciones || []).join('\n')) + '</textarea></div>' +
      '</div><div class="g-totales" id="d-totales"></div></div>' +
      // Invoices are never deleted (the numbering must stay correlative): a wrong one is marked «Anulada».
      '<div class="pie-hoja">' + (!nuevo && S.escribir && !factura ? '<button type="button" class="btn peligro" id="borrar">Eliminar</button>' : '') +
        '<div class="der"><button type="button" class="btn" id="cancelar">Cerrar</button><button type="button" class="btn" id="d-imprimir">Imprimir o PDF</button>' + conversion +
        (S.escribir ? '<button type="submit" class="btn primario" id="guardar">Guardar</button>' : '') + '</div></div>' +
      '</form></div>';

    const form = $('hoja');
    const v = (id) => ($(id) ? $(id).value.trim() : '');
    const cambiado = { valor: false };

    // Líneas. A price changed by hand (different from the catalogue one) is marked, with the catalogue price on hover.
    const cambiadoAMano = (l) => l.precioCatalogo != null && l.precioCatalogo !== '' && Math.abs((Number(l.precio) || 0) - Number(l.precioCatalogo)) > 0.004;
    const marcaPrecio = (l) => (cambiadoAMano(l) ? ' class="g-cambiado" title="Cambiado a mano. Precio de catálogo: ' + esc(euros(l.precioCatalogo)) + '"' : '');
    function pintarLineas() {
      const caja = $('d-lineas');
      if (!d.lineas.length) { caja.innerHTML = '<div class="vacio" style="margin:6px 0">Sin productos. Búscalos arriba o añade una línea libre.</div>'; pintarTotales(); return; }
      caja.innerHTML = '<div class="g-linea g-cab"><span></span><span>Ref.</span><span>Descripción y características</span><span>Cant.</span><span>Precio</span><span>Dto. 1 %</span><span>Dto. 2 %</span><span>IVA</span><span>Importe</span><span></span></div>' +
        d.lineas.map((l, i) => {
          const p = l.productoId && producto(l.productoId);
          const foto = p && p.foto ? '<img src="' + esc(p.foto) + '" alt="">' : '';
          return '<div class="g-linea" data-i="' + i + '">' +
            '<span class="g-mini-foto">' + foto + '</span>' +
            '<input data-k="ref" value="' + esc(l.ref) + '" placeholder="Ref." aria-label="Referencia"' + ro + '>' +
            '<span class="g-desc"><input data-k="descripcion" value="' + esc(l.descripcion) + '" placeholder="Descripción" aria-label="Descripción"' + ro + '><textarea data-k="detalle" rows="2" placeholder="Características" aria-label="Características"' + ro + '>' + esc(l.detalle || '') + '</textarea></span>' +
            '<input data-k="cantidad" inputmode="decimal" value="' + esc(decimal(l.cantidad)) + '" placeholder="Cant." aria-label="Cantidad"' + ro + '>' +
            '<input data-k="precio" inputmode="decimal" value="' + esc(decimal(l.precio)) + '" placeholder="Precio" aria-label="Precio sin IVA"' + marcaPrecio(l) + ro + '>' +
            '<input data-k="dto1" inputmode="decimal" value="' + esc(decimal(l.dto1 || '')) + '" placeholder="Dto. 1 %" aria-label="Descuento 1"' + ro + '>' +
            '<input data-k="dto2" inputmode="decimal" value="' + esc(decimal(l.dto2 || '')) + '" placeholder="Dto. 2 %" aria-label="Descuento 2"' + ro + '>' +
            '<select data-k="iva" aria-label="IVA"' + ro + '>' + [21, 10, 4, 0].map((t) => '<option value="' + t + '"' + (Number(l.iva ?? 21) === t ? ' selected' : '') + '>' + t + ' %</option>').join('') + '</select>' +
            '<b class="g-imp" data-imp="' + i + '"></b>' +
            (S.escribir ? '<span class="g-acc"><button type="button" data-sube="' + i + '" aria-label="Subir">↑</button><button type="button" data-baja="' + i + '" aria-label="Bajar">↓</button><button type="button" data-quita="' + i + '" aria-label="Quitar">×</button></span>' : '<span></span>') +
            '</div>';
        }).join('');
      pintarTotales();
    }
    function pintarTotales() {
      const c = calcular(Object.assign({}, d, { pagado: tipo === 'pedido' || factura ? num(v('d-pagado')) : 0 }));
      c.lineas.forEach((l, i) => { const el = form.querySelector('[data-imp="' + i + '"]'); if (el) el.textContent = l.precio ? euros(l.importe) : 'Incluido'; });
      $('d-totales').innerHTML = '<div><span>Bruto</span><b>' + euros(c.bruto) + '</b></div>' + (c.descuento ? '<div><span>Descuentos</span><b>−' + euros(c.descuento) + '</b></div>' : '') +
        c.tramos.map((t) => '<div><span>Base ' + t.tipo + ' %</span><b>' + euros(t.base) + '</b></div><div><span>IVA ' + t.tipo + ' %</span><b>' + euros(t.cuota) + '</b></div>').join('') +
        '<div class="g-total"><span>Total</span><b>' + euros(c.total) + '</b></div>' + (c.pagado ? '<div><span>Pendiente</span><b>' + euros(c.pendiente) + '</b></div>' : '') + margenInterno(c);
    }
    // Internal only (never printed): what the lines cost us against what they are sold for, after discounts and without VAT.
    function margenInterno(c) {
      if (compra) return '';
      const conCoste = d.lineas.map((l, i) => [l, c.lineas[i]]).filter(([l]) => Number(l.coste) > 0);
      if (!conCoste.length) return '';
      const venta = conCoste.reduce((a, [, x]) => a + (Number(x.importe) || 0), 0);
      const coste = conCoste.reduce((a, [l]) => a + Number(l.coste) * (Number(l.cantidad) || 0), 0);
      const m = venta - coste, pct = venta ? m / venta * 100 : 0;
      return '<div class="g-margen' + (m < 0 ? ' malo' : pct < 15 ? ' justo' : '') + '"><span>Margen sobre la compra (no sale en el documento)</span><b>' + euros(m) + ' · ' + fPct(pct) + '</b>' +
        '<small>Compra ' + euros(coste) + (conCoste.length < d.lineas.length ? ' · solo las líneas con coste' : '') + '. Sin restar envío, publicidad ni comisiones: eso está en el escandallo.</small></div>';
    }
    $('d-lineas').addEventListener('input', (e) => {
      const fila = e.target.closest('[data-i]'); const k = e.target.dataset.k; if (!fila || !k) return;
      const l = d.lineas[Number(fila.dataset.i)];
      l[k] = ['cantidad', 'precio', 'dto1', 'dto2', 'iva'].includes(k) ? num(e.target.value) : e.target.value;
      if (k === 'precio') { e.target.classList.toggle('g-cambiado', cambiadoAMano(l)); e.target.title = cambiadoAMano(l) ? 'Cambiado a mano. Precio de catálogo: ' + euros(l.precioCatalogo) : ''; }
      cambiado.valor = true; pintarTotales();
    });
    $('d-lineas').addEventListener('change', (e) => { if (e.target.dataset.k === 'iva') { d.lineas[Number(e.target.closest('[data-i]').dataset.i)].iva = Number(e.target.value); pintarTotales(); } });
    $('d-lineas').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const i = Number(b.dataset.sube ?? b.dataset.baja ?? b.dataset.quita);
      if (b.dataset.quita != null) d.lineas.splice(i, 1);
      else if (b.dataset.sube != null && i > 0) [d.lineas[i - 1], d.lineas[i]] = [d.lineas[i], d.lineas[i - 1]];
      else if (b.dataset.baja != null && i < d.lineas.length - 1) [d.lineas[i + 1], d.lineas[i]] = [d.lineas[i], d.lineas[i + 1]];
      cambiado.valor = true; pintarLineas();
    });

    // Buscador de productos
    if ($('d-buscar')) {
      let resultados = [], marcado = 0;
      const pintarRes = () => {
        const q = $('d-buscar').value.trim();
        resultados = q ? buscarProductos(q).slice(0, 8) : [];
        const caja = $('d-resultados');
        caja.hidden = !q;
        caja.innerHTML = resultados.length ? resultados.map((p, i) => '<button type="button" class="g-res' + (i === marcado ? ' marcado' : '') + '" data-prod="' + esc(p.id) + '">' +
          '<span class="g-mini-foto">' + (p.foto ? '<img src="' + esc(p.foto) + '" alt="">' : '') + '</span><span><b>' + esc(p.nombre) + '</b><small>' + esc([p.ref, variantesDe(p).length ? variantesDe(p).length + ' medidas' : p.medidas].filter(Boolean).join(' · ')) + '</small></span>' +
          '<span class="g-res-precio">' + (variantesDe(p).length > 1 ? 'desde ' : '') + (compra ? (desde(p, true) ? euros(desde(p, true)) + ' coste' : 'Sin coste') : desde(p) ? euros(desde(p)) : 'Sin precio') + '</span></button>').join('')
          : '<div class="g-res-vacio">Ningún producto coincide. ' + (S.productos.length ? '' : 'El catálogo está vacío: da de alta productos en Gestión → Productos.') + '</div>';
      };
      const limpiarBusqueda = () => { $('d-buscar').value = ''; marcado = 0; pintarRes(); };
      const anadir = (p) => {
        if (variantesDe(p).length || gruposDe(p).length) { limpiarBusqueda(); elegir(p); return; }
        d.lineas.push(lineaDeProducto(p, compra)); cambiado.valor = true; pintarLineas();
        limpiarBusqueda(); $('d-buscar').focus();
      };
      // Products with sizes or finishes: pick them before the line is added.
      const elegir = (p) => {
        const caja = $('d-elegir'), vs = variantesDe(p), gs = gruposDe(p);
        const valorVar = (v) => (compra ? costeDe(p, v) : precioDe(p, v));
        const valorExtra = (x) => (compra ? costeDe(p, x) : precioOpcion(p, x));
        const extraTxt = (x) => (valorExtra(x) ? ' (+' + euros(valorExtra(x)) + ')' : '');
        const versiones = [...new Set(vs.map((v) => v.version || ''))];
        const opcionesVar = versiones.map((ver) => {
          const ops = vs.filter((v) => (v.version || '') === ver).map((v) => '<option value="' + esc(v.id) + '">' + esc(v.medida) + ' — ' + (valorVar(v) ? euros(valorVar(v)) : 'sin ' + (compra ? 'coste' : 'precio')) + '</option>').join('');
          return versiones.length > 1 ? '<optgroup label="' + esc(ver || 'Normal') + '">' + ops + '</optgroup>' : ops;
        }).join('');
        caja.innerHTML = '<div class="g-eleg-cab"><span class="g-mini-foto">' + (p.foto ? '<img src="' + esc(p.foto) + '" alt="">' : '') + '</span><b>' + esc(p.nombre) + '</b><button type="button" class="p-x" id="e-cerrar" aria-label="Cancelar">×</button></div>' +
          '<div class="g-eleg-campos">' +
            (vs.length ? '<label>Medida<select id="e-var">' + opcionesVar + '</select></label>' : '') +
            gs.map((g, i) => '<label>' + esc(g.nombre) + '<select data-eg="' + i + '">' + (g.obligatoria ? '<option value="">Elige…</option>' : '<option value="">Sin ' + esc(g.nombre.toLowerCase()) + '</option>') +
              g.valores.map((x, xi) => '<option value="' + xi + '">' + esc(x.nombre) + esc(extraTxt(x)) + '</option>').join('') + '</select></label>').join('') +
            '<label>Cantidad<input id="e-cant" inputmode="decimal" value="1"></label>' +
          '</div><div class="g-eleg-pie"><span id="e-precio"></span><button type="button" class="btn" id="e-cancelar">Cancelar</button><button type="button" class="btn primario" id="e-anadir">Añadir al documento</button></div>';
        caja.hidden = false;
        const leerEleccion = () => {
          const v = vs.length ? vs.find((x) => x.id === $('e-var').value) : null;
          const elegidos = gs.map((g, i) => { const s = caja.querySelector('[data-eg="' + i + '"]').value; return s === '' ? null : [g, g.valores[Number(s)]]; });
          return { v, elegidos };
        };
        const precio = () => {
          const { v, elegidos } = leerEleccion();
          const l = lineaDeProducto(p, compra, v, elegidos.filter(Boolean), num($('e-cant').value) || 1);
          $('e-precio').innerHTML = (compra ? 'Coste' : 'Precio') + ' por unidad: <b>' + euros(l.precio) + '</b> sin IVA';
        };
        const cerrarEleccion = () => { caja.hidden = true; caja.innerHTML = ''; $('d-buscar').focus(); };
        const confirmar = () => {
          const { v, elegidos } = leerEleccion();
          if (vs.length && !v) { aviso('Elige la medida.'); $('e-var').focus(); return; }
          const falta = gs.findIndex((g, i) => g.obligatoria && !elegidos[i]);
          if (falta >= 0) { aviso('Elige ' + gs[falta].nombre.toLowerCase() + '.'); caja.querySelector('[data-eg="' + falta + '"]').focus(); return; }
          d.lineas.push(lineaDeProducto(p, compra, v, elegidos.filter(Boolean), num($('e-cant').value) || 1)); cambiado.valor = true; pintarLineas();
          cerrarEleccion();
        };
        caja.oninput = precio; caja.onchange = precio;
        caja.onkeydown = (e) => {
          if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarEleccion(); }
        };
        $('e-anadir').onclick = confirmar; $('e-cancelar').onclick = cerrarEleccion; $('e-cerrar').onclick = cerrarEleccion;
        precio();
        const primero = caja.querySelector('select'); if (primero) primero.focus();
      };
      $('d-buscar').addEventListener('input', () => { marcado = 0; pintarRes(); });
      $('d-buscar').addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (resultados.length) { marcado = (marcado + (e.key === 'ArrowDown' ? 1 : resultados.length - 1)) % resultados.length; pintarRes(); } }
        else if (e.key === 'Enter') { e.preventDefault(); if (resultados[marcado]) anadir(resultados[marcado]); }
        else if (e.key === 'Escape' && $('d-buscar').value) { e.stopPropagation(); $('d-buscar').value = ''; pintarRes(); }
      });
      $('d-resultados').addEventListener('click', (e) => { const b = e.target.closest('[data-prod]'); if (b) anadir(producto(b.dataset.prod)); });
      $('d-libre').onclick = () => { d.lineas.push({ ref: '', descripcion: '', detalle: '', cantidad: 1, precio: 0, dto1: 0, dto2: 0, iva: 21 }); cambiado.valor = true; pintarLineas(); const ult = form.querySelector('.g-linea:last-child [data-k="descripcion"]'); if (ult) ult.focus(); };
    }

    // Cliente: al elegir uno de la lista se rellenan sus datos. Proveedor: se enlaza y se pone su dirección.
    const rellenarCliente = () => {
      if (compra) {
        const p = S.proveedores.find((x) => x.nombre === v('d-cli-nombre'));
        if (!p) return;
        d.proveedorId = p.id;
        if (p.direccion && !v('d-cli-dir')) $('d-cli-dir').value = p.direccion;
        return;
      }
      const c = S.clientes.find((x) => sinTildes(x.nombre) === sinTildes(v('d-cli-nombre')));
      if (c) rellenarCon(c);
    };
    const rellenarCon = (c) => {
      d.clienteId = c.id;
      $('d-cli-nombre').value = c.nombre || '';
      [['d-cli-nif', c.nif], ['d-cli-tel', c.telefono], ['d-cli-correo', c.correo], ['d-cli-dir', c.direccion], ['d-cli-loc', c.localidad], ['d-cli-pais', c.pais || 'España'], ['d-cli-att', c.att]].forEach(([id, val]) => { $(id).value = val || ''; });
      if (c.envioDireccion && !factura) {
        $('d-otro-envio').checked = true; $('d-envio').hidden = false;
        [['d-env-nombre', c.envioNombre], ['d-env-dir', c.envioDireccion], ['d-env-loc', c.envioLocalidad], ['d-env-pais', c.envioPais], ['d-env-contacto', c.envioContacto]].forEach(([id, val]) => { $(id).value = val || ''; });
      }
      // A full invoice needs the customer's NIF: with it, the invoice switches to «completa».
      if (factura && nuevo && c.nif && $('d-modalidad') && $('d-modalidad').value !== 'completa') { $('d-modalidad').value = 'completa'; $('d-modalidad').dispatchEvent(new Event('change')); }
      cambiado.valor = true;
    };
    $('d-cli-nombre').addEventListener('change', rellenarCliente);
    // Customer search: words are matched against name, NIF, code, town, phone and email; arrows and Enter pick one.
    if ($('d-cli-res')) {
      const caja = $('d-cli-res'), inp = $('d-cli-nombre');
      let lista = [], marcado = 0;
      const textoCliente = (c) => sinTildes([c.codigo, c.nombre, c.nif, c.localidad, c.telefono, c.correo, c.att].join(' '));
      const buscar = (q) => {
        const t = sinTildes(q).split(/\s+/).filter(Boolean);
        return S.clientes.filter((c) => t.every((w) => textoCliente(c).includes(w)))
          .sort((a, b) => (sinTildes(b.nombre).startsWith(t[0]) ? 1 : 0) - (sinTildes(a.nombre).startsWith(t[0]) ? 1 : 0) || (a.nombre || '').localeCompare(b.nombre || '', 'es')).slice(0, 8);
      };
      const cerrarLista = () => { caja.hidden = true; inp.setAttribute('aria-expanded', 'false'); };
      const pintar = () => {
        const q = inp.value.trim();
        lista = q ? buscar(q) : [];
        if (!q) { cerrarLista(); return; }
        caja.innerHTML = lista.length ? lista.map((c, i) => '<button type="button" role="option" class="g-res g-res-cli' + (i === marcado ? ' marcado' : '') + '" data-cli="' + esc(c.id) + '"><span><b>' + esc(c.nombre) + '</b><small>' +
            esc([c.nif, c.localidad, c.telefono].filter(Boolean).join(' · ') || 'Sin más datos') + '</small></span><span class="g-res-precio">' + esc(c.codigo || '') + '</span></button>').join('')
          : '<div class="g-res-vacio">' + (S.clientes.length ? 'Ningún cliente coincide: es un cliente nuevo. Rellena sus datos y se guardará con el documento.' : 'Todavía no hay clientes: este se guardará al guardar el documento.') + '</div>';
        caja.hidden = false; inp.setAttribute('aria-expanded', 'true');
      };
      inp.addEventListener('input', () => {
        // Typing another name unlinks the customer picked before, so it is not overwritten with this one's data.
        const antes = S.clientes.find((c) => c.id === d.clienteId);
        if (antes && sinTildes(antes.nombre) !== sinTildes(inp.value)) d.clienteId = '';
        marcado = 0; pintar();
      });
      inp.addEventListener('focus', () => { if (inp.value.trim() && !d.clienteId) pintar(); });
      inp.addEventListener('keydown', (e) => {
        if (caja.hidden) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (lista.length) { marcado = (marcado + (e.key === 'ArrowDown' ? 1 : lista.length - 1)) % lista.length; pintar(); } }
        else if (e.key === 'Enter') { e.preventDefault(); if (lista[marcado]) { rellenarCon(lista[marcado]); cerrarLista(); } }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarLista(); }
      });
      // mousedown, so the pick happens before the field loses focus.
      caja.addEventListener('mousedown', (e) => { const b = e.target.closest('[data-cli]'); if (!b) return; e.preventDefault(); const c = S.clientes.find((x) => x.id === b.dataset.cli); if (c) { rellenarCon(c); cerrarLista(); } });
      inp.addEventListener('blur', () => setTimeout(cerrarLista, 150));
    }
    $('d-otro-envio').addEventListener('change', (e) => { $('d-envio').hidden = !e.target.checked && tipo !== 'albaran'; });
    if ($('d-calc-log')) $('d-calc-log').onclick = () => {
      const l = logisticaDe(d.lineas);
      if (!Object.keys(l).length) { aviso('Ningún producto del documento tiene peso o volumen en el catálogo.'); return; }
      $('d-bultos').value = decimal(l.bultos); $('d-peso').value = decimal(l.pesoBruto); $('d-volumen').value = decimal(l.volumen);
    };
    if ($('d-pagado')) $('d-pagado').addEventListener('input', pintarTotales);
    // Commercial discount: goes into «Dto. 1» of every line with a price (each line can still be changed by hand afterwards).
    if ($('d-dtocom-aplicar')) {
      const aplicarDto = () => {
        const x = num($('d-dtocom').value);
        if (x < 0 || x >= 100) { aviso('El descuento tiene que estar entre 0 y 99 %.'); return; }
        if (!d.lineas.length) { aviso('Añade antes los productos.'); return; }
        d.lineas.forEach((l) => { if (Number(l.precio)) l.dto1 = x; });
        cambiado.valor = true; pintarLineas();
        aviso(x ? 'Descuento del ' + fPct(x) + ' puesto en todas las líneas con precio.' : 'Descuento quitado de todas las líneas.');
      };
      $('d-dtocom-aplicar').onclick = aplicarDto;
      $('d-dtocom').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarDto(); } });
    }
    form.addEventListener('input', () => { cambiado.valor = true; });

    function leer() {
      const r = Object.assign({}, d, {
        numero: v('d-numero'), fecha: v('d-fecha'), estado: v('d-estado'), comercial: v('d-comercial'), suReferencia: v('d-suref'),
        cliente: { nombre: v('d-cli-nombre'), nif: v('d-cli-nif'), telefono: v('d-cli-tel'), correo: v('d-cli-correo'), direccion: v('d-cli-dir'), localidad: v('d-cli-loc'), pais: v('d-cli-pais'), att: v('d-cli-att') },
        envio: !factura && ($('d-otro-envio').checked || tipo === 'albaran')
          ? { nombre: v('d-env-nombre'), direccion: v('d-env-dir'), localidad: v('d-env-loc'), pais: v('d-env-pais'), contacto: v('d-env-contacto'), transportista: v('d-env-trans'), seguimiento: v('d-env-seg') } : {},
        formaPago: v('d-forma'), notas: $('d-notas').value.trim(), condiciones: lineasDe($('d-cond').value),
        logistica: { bultos: num(v('d-bultos')) || '', pesoBruto: num(v('d-peso')) || '', pesoNeto: num(v('d-pesoneto')) || '', volumen: num(v('d-volumen')) || '' },
        lineas: d.lineas.map((l) => ({ productoId: l.productoId || '', varianteId: l.varianteId || '', coste: Number(l.coste) || 0, precioCatalogo: l.precioCatalogo ?? '', ref: String(l.ref || '').trim(), descripcion: String(l.descripcion || '').trim(), detalle: String(l.detalle || '').trim(),
          cantidad: Number(l.cantidad) || 0, precio: Number(l.precio) || 0, dto1: Number(l.dto1) || 0, dto2: Number(l.dto2) || 0, iva: Number(l.iva ?? 21) }))
      });
      if (tipo === 'presupuesto') r.validoHasta = v('d-valido');
      if (tipo === 'pedido') { r.entregaPrevista = v('d-entrega'); r.pagado = num(v('d-pagado')); }
      if (factura) { r.modalidad = v('d-modalidad') || 'simplificada'; r.fechaOperacion = v('d-operacion'); r.pagado = num(v('d-pagado')); r.logistica = {}; }
      if (tipo === 'albaran') { r.fechaEntrega = v('d-entregado'); r.valorado = $('d-valorado').checked; }
      // En el albarán, si no hay otra dirección, se entrega en la del cliente.
      if (tipo === 'albaran' && !r.envio.direccion) r.envio = Object.assign({}, r.envio, { direccion: r.cliente.direccion, localidad: r.cliente.localidad, pais: r.cliente.pais });
      return r;
    }

    async function guardarCliente(r) {
      if (compra || !$('d-cli-guardar').checked || !r.cliente.nombre) return;
      const datos = Object.assign({}, r.cliente);
      if (!factura && $('d-otro-envio').checked) Object.assign(datos, { envioNombre: r.envio.nombre, envioDireccion: r.envio.direccion, envioLocalidad: r.envio.localidad, envioPais: r.envio.pais, envioContacto: r.envio.contacto });
      const existe = S.clientes.find((c) => c.id === r.clienteId) || S.clientes.find((c) => sinTildes(c.nombre) === sinTildes(r.cliente.nombre));
      if (existe) { r.clienteId = existe.id; r.cliente.codigo = existe.codigo; await col('clientes').doc(existe.id).update(Object.assign(datos, { actualizado: new Date().toISOString() })); return; }
      const id = nuevoId(); const codigo = siguienteCodigoCliente();
      await col('clientes').doc(id).set(Object.assign(datos, { codigo, creado: new Date().toISOString(), creadoPor: S.yo }));
      r.clienteId = id; r.cliente.codigo = codigo;
    }
    async function guardar() {
      const r = leer();
      if (!r.numero) { aviso('Falta el número.'); $('d-numero').focus(); return null; }
      const simplificada = factura && r.modalidad === 'simplificada';
      // A simplified invoice may go without the customer's name; everything else needs it.
      if (!r.cliente.nombre && !simplificada) { aviso(compra ? 'Falta el proveedor.' : 'Falta el cliente.'); $('d-cli-nombre').focus(); return null; }
      if (factura) {
        if (!r.lineas.length) { aviso('La factura no tiene líneas.'); return null; }
        if (simplificada && calcular(r).total > MAX_SIMPLIFICADA) { aviso('Una factura simplificada no puede pasar de 3.000 € con IVA: cámbiala a «Completa».'); $('d-modalidad').focus(); return null; }
        if (!simplificada) {
          if (!ajustesEmpresa().domicilio) { aviso('Para una factura completa falta tu domicilio fiscal: ponlo en Gestión → Datos de la empresa.'); return null; }
          if (!r.cliente.nif) { aviso('La factura completa necesita el NIF o DNI del cliente.'); $('d-cli-nif').focus(); return null; }
        }
      }
      const repetido = S.documentos.find((o) => o.id !== r.id && o.tipo === tipo && o.numero === r.numero);
      if (repetido) { aviso('Ya hay ' + (factura ? 'una ' : 'un ') + titulo.toLowerCase() + ' con el número ' + r.numero + '.'); return null; }
      const ok = await escribir(async () => {
        await guardarCliente(r);
        const ahora = new Date().toISOString();
        const cuerpo = Object.assign({}, r, { actualizado: ahora, total: calcular(r).total }); delete cuerpo.id;
        if (r.id) await col('documentos').doc(r.id).set(cuerpo);
        else { r.id = nuevoId(); await col('documentos').doc(r.id).set(Object.assign(cuerpo, { creado: ahora, creadoPor: S.yo })); }
        // Accepting a quote or serving an order moves the source forward; invoicing leaves it as it was.
        if (r.origenId && nuevo && !factura) {
          const origen = S.documentos.find((o) => o.id === r.origenId);
          if (origen) await col('documentos').doc(origen.id).update({ estado: origen.tipo === 'presupuesto' ? 'aceptado' : 'servido' });
        }
      }, tituloDe(r) + guardadoTxt, (nuevo ? 'hizo ' : 'editó ') + el + tituloDe(r).toLowerCase() + ' ' + r.numero + (compra ? ' a ' : ' para ') + (r.cliente.nombre || 'un cliente'));
      if (!ok) return null;
      Object.assign(d, r); cambiado.valor = false;
      return r;
    }

    pintarLineas();
    $('cancelar').onclick = () => { if (cambiado.valor && S.escribir && !confirm('Hay cambios sin guardar. ¿Cerrar igualmente?')) return; cerrar(); };
    $('velo').addEventListener('mousedown', (e) => { if (e.target.id === 'velo') $('cancelar').click(); });
    form.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('cancelar').click(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); if (!S.escribir) return;
      const b = $('guardar'); b.disabled = true; b.textContent = 'Guardando…';
      const r = await guardar();
      if (r) cerrar(); else if ($('guardar')) { $('guardar').disabled = false; $('guardar').textContent = 'Guardar'; }
    });
    $('d-imprimir').onclick = () => imprimir(leer());
    form.querySelectorAll('[data-convertir]').forEach((b) => { b.onclick = async () => {
      const r = cambiado.valor ? await guardar() : leer();
      if (!r) return;
      const a = b.dataset.convertir;
      const nuevoDoc = nuevoDocumento(a, Object.assign({
        cliente: r.cliente, clienteId: r.clienteId, lineas: r.lineas, suReferencia: r.suReferencia, referencia: r.numero, origenId: r.id,
        formaPago: r.formaPago, pagado: r.pagado || 0, comercial: r.comercial
      }, a === 'factura' ? {} : { envio: r.envio, logistica: r.logistica }));
      editorDocumento(null, nuevoDoc);
      aviso(a === 'factura' ? 'Revisa la factura (simplificada o completa) y pulsa Guardar.' : 'Revisa el ' + TIPOS[a].titulo.toLowerCase() + ' y pulsa Guardar.');
    }; });
    // Invoice type: the number follows the series (F- full, FS- simplified) while the invoice is new; the help line says what each needs.
    if ($('d-modalidad')) {
      const ayudaFactura = () => {
        const simp = $('d-modalidad').value === 'simplificada';
        $('d-fac-ayuda').textContent = simp
          ? 'Factura simplificada: lleva tu nombre y NIF, sin domicilio. El cliente es opcional. Máximo 3.000 € con IVA.'
          : 'Factura completa: lleva tu domicilio fiscal y el nombre, NIF y dirección del cliente. Obligatoria si el cliente es una empresa o la pide.';
      };
      $('d-modalidad').addEventListener('change', () => {
        if (nuevo) { $('d-numero').value = siguienteNumero('factura', v('d-fecha'), false, $('d-modalidad').value); $('d-titulo-num').textContent = $('d-numero').value; }
        $('d-titulo').textContent = tituloDe({ tipo: 'factura', modalidad: $('d-modalidad').value });
        ayudaFactura();
      });
      ayudaFactura();
    }
    if ($('borrar')) {
      let armado = false, t;
      $('borrar').onclick = async () => {
        const b = $('borrar');
        if (!armado) { armado = true; b.classList.add('armado'); b.textContent = 'Pulsa otra vez para eliminar'; t = setTimeout(() => { armado = false; b.classList.remove('armado'); b.textContent = 'Eliminar'; }, 4000); return; }
        clearTimeout(t);
        if (await escribir(() => col('documentos').doc(d.id).delete(), titulo + eliminadoTxt, 'borró ' + el + titulo.toLowerCase() + ' ' + d.numero)) cerrar();
      };
    }
    if (nuevo && $('d-cli-nombre') && !d.cliente.nombre) $('d-cli-nombre').focus();
  }

  /* ---------- Conexión con el panel ---------- */
  function alClic(b) {
    if (b.dataset.gsub) { S.gestion.sub = b.dataset.gsub; S.gestion.buscar = ''; render(); return true; }
    if (b.dataset.gtipo) { S.gestion.tipo = b.dataset.gtipo; render(); return true; }
    if (b.dataset.gcat) { S.gestion.categoria = b.dataset.gcat; render(); return true; }
    if (panelVentas.alClic(b)) return true;
    if (b.dataset.escCat) { formEscCategoria(b.dataset.escCat); return true; }
    if (b.dataset.escProd) { const p = producto(b.dataset.escProd); if (p) formEscProducto(p); return true; }
    if (b.dataset.gRepetidos) { quitarRepetidos(); return true; }
    return false;
  }
  function alEscribir(e) {
    if (e.target.id !== 'g-buscar') return false;
    S.gestion.buscar = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const x = $('g-buscar'); if (x) { x.focus(); try { x.setSelectionRange(pos, pos); } catch (err) {} }
    return true;
  }
  return {
    render: renderGestion, alClic, alEscribir,
    abrir: { productos: formProducto, clientes: formCliente, documentos: (doc) => editorDocumento(doc) },
    nuevo: {
      producto: () => formProducto(), cliente: () => formCliente(), empresa: formEmpresa,
      presupuesto: () => editorDocumento(null, nuevoDocumento('presupuesto')),
      pedido: () => editorDocumento(null, nuevoDocumento('pedido')),
      pedidoCompra: () => editorDocumento(null, nuevoDocumento('pedido', null, 'compra')),
      albaran: () => editorDocumento(null, nuevoDocumento('albaran')),
      factura: () => editorDocumento(null, nuevoDocumento('factura'))
    }
  };
}

// Estilos de la sección (van en el panel).
export const ESTILOS_GESTION = `
  .g-buscar { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 6px 12px; font-size: 13.5px; min-width: 200px; margin-left: auto; }
  .g-productos { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .g-prod { flex-direction: row; gap: 12px; }
  .g-prod.g-inactivo { opacity: .6; }
  .g-prod-txt { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
  .g-foto { width: 96px; height: 96px; flex: none; border-radius: 12px; background: var(--sunk); display: grid; place-items: center; overflow: hidden; color: var(--muted); font-size: 12px; }
  .g-foto img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
  .g-foto-sub { cursor: pointer; position: relative; border: 1px dashed transparent; }
  .g-foto-sub:hover, .g-foto-sub:focus-within { border-color: var(--ink); }
  .g-foto-sub > span:not(.g-foto-cambiar) { font-weight: 700; color: var(--ink); text-align: center; padding: 4px; }
  .g-foto-cambiar { position: absolute; left: 0; right: 0; bottom: 0; font-size: 11px; font-weight: 700; text-align: center; background: rgba(0,0,0,.55); color: #fff; padding: 2px 0; opacity: 0; transition: opacity .15s; }
  .g-foto-sub:hover .g-foto-cambiar, .g-foto-sub:focus-within .g-foto-cambiar { opacity: 1; }
  @media (hover: none) { .g-foto-cambiar { opacity: 1; } }
  .g-foto-edit { display: flex; gap: 12px; align-items: center; }
  .g-foto-edit .g-foto { width: 120px; height: 120px; }
  .g-foto-btns { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .g-foto-btns label.btn { cursor: pointer; }
  .hoja.hoja-doc { width: min(1180px, 100%); }
  .hoja.hoja-prod { width: min(980px, 100%); }
  .p-ayuda { margin: 0 0 6px; font-size: 13px; color: var(--muted); }
  .p-gen { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; background: var(--sunk); border-radius: 10px; padding: 10px; margin-bottom: 8px; }
  .p-gen label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: var(--muted); flex: 1 1 150px; }
  .p-gen input, .p-var input, .p-val input, .p-grupo-cab input, .p-grupo-cab select, .g-eleg-campos select, .g-eleg-campos input { width: 100%; min-width: 0; border: 1px solid var(--line); background: var(--bg); border-radius: 8px; padding: 6px 8px; font: inherit; font-size: 13.5px; color: var(--ink); }
  .p-var { display: grid; grid-template-columns: 92px minmax(0, 1.3fr) minmax(0, 1fr) 72px 72px 72px 78px 60px 60px 26px; gap: 5px; align-items: center; margin-bottom: 5px; }
  .p-var-cab, .p-val-cab { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-bottom: 2px; }
  .p-var [data-k="coste"], .p-var [data-k="precio"], .p-var [data-k="peso"], .p-var [data-k="volumen"], .p-val [data-xk="coste"], .p-val [data-xk="precio"] { text-align: right; font-variant-numeric: tabular-nums; }
  .p-civa { font-size: 12.5px; color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
  .p-x { border: 1px solid var(--line); background: transparent; border-radius: 6px; width: 26px; height: 28px; color: var(--muted); padding: 0; }
  .p-x:hover { color: var(--bad); border-color: var(--bad); }
  .p-acc { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 6px; }
  .p-tipicos { display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 13px; color: var(--muted); }
  .p-grupo { border: 1px solid var(--line); border-radius: 12px; padding: 10px; margin-bottom: 8px; }
  .p-grupo-cab { display: grid; grid-template-columns: minmax(0, 1fr) 190px auto; gap: 6px; align-items: center; margin-bottom: 8px; }
  .p-val { display: grid; grid-template-columns: minmax(0, 1fr) 84px 84px 84px 26px; gap: 5px; align-items: center; margin-bottom: 5px; max-width: 640px; }
  .g-elegir { border: 1.5px solid var(--accent); border-radius: 12px; padding: 10px 12px; margin: 0 0 10px; background: var(--accent-soft); }
  .g-eleg-cab { display: flex; gap: 10px; align-items: center; margin-bottom: 8px; }
  .g-eleg-cab .p-x { margin-left: auto; }
  .g-eleg-campos { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
  .g-eleg-campos label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: var(--muted); }
  .g-eleg-pie { display: flex; gap: 8px; align-items: center; justify-content: flex-end; margin-top: 10px; font-size: 14px; }
  .g-eleg-pie #e-precio { margin-right: auto; }
  @media (max-width: 760px) {
    .p-var { grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 8px; border: 1px solid var(--line); border-radius: 10px; }
    .p-var-cab { display: none; }
    .p-var [data-k="medida"], .p-var [data-k="version"] { grid-column: span 2; }
    .p-grupo-cab { grid-template-columns: 1fr; }
  }
  .g-tres { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .g-busca { position: relative; display: flex; gap: 8px; margin: 4px 0 10px; }
  .g-busca input { flex: 1; min-width: 0; border: 1.5px solid var(--accent); background: var(--bg); border-radius: 10px; padding: 10px 12px; font-size: 15px; }
  .g-resultados { position: absolute; z-index: 3; top: calc(100% + 4px); left: 0; right: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,.18); padding: 4px; max-height: 360px; overflow: auto; }
  .g-res { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; align-items: center; width: 100%; text-align: left; border: 0; background: transparent; padding: 6px 8px; border-radius: 8px; color: var(--ink); font: inherit; }
  .g-res small { display: block; color: var(--muted); font-size: 12.5px; }
  .g-res.marcado, .g-res:hover { background: var(--accent-soft); }
  .g-res-precio { font-variant-numeric: tabular-nums; font-weight: 700; }
  .g-res-vacio { padding: 10px; color: var(--muted); font-size: 13.5px; }
  .g-cli { position: relative; }
  .g-cli input { width: 100%; }
  .g-res-cli { grid-template-columns: minmax(0, 1fr) auto; }
  .g-res-cli .g-res-precio { font-weight: 400; color: var(--muted); font-size: 12.5px; }
  .g-mini-foto { width: 44px; height: 44px; border-radius: 8px; background: var(--sunk); overflow: hidden; display: grid; place-items: center; }
  .g-mini-foto img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
  .g-mini-foto:empty { background: transparent; }
  .g-lineas { display: grid; gap: 6px; }
  .g-linea { display: grid; grid-template-columns: 44px 90px minmax(0, 1fr) 60px 86px 62px 62px 70px 96px 84px; gap: 6px; align-items: start; }
  .g-linea input, .g-linea select, .g-linea textarea { width: 100%; min-width: 0; border: 1px solid var(--line); background: var(--bg); border-radius: 8px; padding: 6px 8px; font: inherit; font-size: 13.5px; }
  .g-linea [data-k="cantidad"], .g-linea [data-k="precio"], .g-linea [data-k^="dto"] { text-align: right; font-variant-numeric: tabular-nums; }
  .g-linea textarea { min-height: 0; resize: vertical; margin-top: 4px; font-size: 12.5px; color: var(--muted); }
  .g-cab { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); align-items: end; }
  .g-cab span:nth-child(n+4):nth-child(-n+9) { text-align: right; }
  .g-imp { text-align: right; padding-top: 7px; font-variant-numeric: tabular-nums; font-size: 13.5px; }
  .g-acc { display: flex; gap: 2px; padding-top: 3px; justify-content: flex-end; }
  .g-acc button { border: 1px solid var(--line); background: transparent; border-radius: 6px; width: 24px; height: 26px; color: var(--muted); padding: 0; }
  .g-acc button:hover { color: var(--ink); border-color: var(--ink); }
  .g-acc button[data-quita]:hover { color: var(--bad); border-color: var(--bad); }
  .g-cierre { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 22px; margin-top: 16px; align-items: start; }
  .g-totales { background: var(--sunk); border-radius: 12px; padding: 10px 14px; font-variant-numeric: tabular-nums; }
  .g-totales div { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; font-size: 14px; }
  .g-totales span { color: var(--muted); }
  .g-totales .g-total { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 8px; font-size: 17px; }
  .g-totales .g-total span, .g-totales .g-total b { color: var(--ink); font-weight: 700; }
  .g-totales .g-margen { display: grid; grid-template-columns: 1fr auto; margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: var(--ok-soft); }
  .g-totales .g-margen span { font-size: 12px; }
  .g-totales .g-margen b { color: var(--ink); font-size: 14px; }
  .g-totales .g-margen small { grid-column: 1 / -1; color: var(--muted); font-size: 11.5px; line-height: 1.35; }
  .g-totales .g-margen.justo { background: var(--warn-soft); }
  .g-totales .g-margen.malo { background: var(--bad-soft); }
  .g-linea input.g-cambiado { border-color: var(--warn); background: var(--warn-soft); }
  .g-dtocom { display: flex; gap: 6px; }
  .e-h2 { font-family: var(--f-display, inherit); font-size: 17px; margin: 22px 0 10px; }
  .e-cats { grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
  .e-prod { margin-bottom: 12px; display: block; }
  .e-prod-cab { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; margin-bottom: 8px; }
  .e-prod-cab .der { display: flex; gap: 6px; }
  .e-tabla td, .e-tabla th { white-space: nowrap; }
  .e-tabla .num { text-align: right; font-variant-numeric: tabular-nums; }
  .e-bien { color: var(--ok); font-weight: 700; }
  .e-justo { color: var(--warn); font-weight: 700; }
  .e-malo { color: var(--bad, #C0392B); font-weight: 700; }
  .e-nd { color: var(--muted); }
  .e-lin { display: grid; grid-template-columns: minmax(0, 1fr) 190px 90px 26px; gap: 6px; align-items: center; margin-bottom: 6px; }
  .e-lin input, .e-lin select { width: 100%; min-width: 0; border: 1px solid var(--line); background: var(--bg); border-radius: 8px; padding: 6px 8px; font: inherit; font-size: 13.5px; color: var(--ink); }
  .e-lin [data-lk="valor"] { text-align: right; }
  .e-lin-cab { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-bottom: 2px; }
  .e-ejemplo { background: var(--sunk); border-radius: 12px; padding: 10px 12px; font-size: 13.5px; }
  .e-ejemplo p { margin: 4px 0 8px; }
  @media (max-width: 640px) { .e-lin { grid-template-columns: 1fr 1fr; } .e-lin [data-lk="concepto"] { grid-column: 1 / -1; } }
  .g-dtocom input { flex: 1; min-width: 0; border: 1px solid var(--line); background: var(--bg); border-radius: 10px; padding: 8px 10px; font: inherit; }
  @media (max-width: 900px) {
    .g-tres { grid-template-columns: 1fr 1fr; }
    .g-cierre { grid-template-columns: minmax(0, 1fr); }
    .g-cab { display: none; }
    .g-linea { grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 8px; border: 1px solid var(--line); border-radius: 10px; }
    .g-linea .g-mini-foto { display: none; }
    .g-linea .g-desc { grid-column: 1 / -1; order: -1; }
    .g-linea > input[data-k="ref"] { grid-column: span 2; }
    .g-imp { grid-column: span 2; }
  }
  @media (max-width: 640px) { .g-tres { grid-template-columns: 1fr; } .g-buscar { margin-left: 0; width: 100%; } }
` + ESTILOS_VENTAS;
