// Gestión: catálogo de productos, clientes y documentos (presupuestos, pedidos y albaranes).
// El documento se monta buscando productos del catálogo: al elegir uno se añade con su foto, características y precio.
// Recibe del panel (index.html) su estado y sus utilidades; devuelve la vista y los formularios.
import { documentoHTML, ESTILOS_DOCUMENTO, calcular, EMPRESA, TIPOS } from './documento.js';

export const CATEGORIAS = ['Colchones', 'Canapés', 'Bases y somieres', 'Almohadas', 'Textil', 'Accesorios', 'Servicios'];
export const ESTADOS_DOC = {
  presupuesto: [['borrador', 'Borrador'], ['enviado', 'Enviado'], ['aceptado', 'Aceptado'], ['rechazado', 'Rechazado']],
  pedido: [['abierto', 'En curso'], ['servido', 'Servido'], ['cancelado', 'Cancelado']],
  albaran: [['pendiente', 'Por entregar'], ['entregado', 'Entregado']]
};
const CLASE_ESTADO = { aceptado: 'ok', servido: 'ok', entregado: 'ok', rechazado: 'bad', cancelado: 'bad', enviado: 'azul', abierto: 'azul', pendiente: 'warn', borrador: '' };
const CONDICIONES_BASE = {
  presupuesto: 'Portes incluidos a península.\nPlazo de entrega: 7 a 10 días laborables desde la aceptación.\n3 años de garantía.',
  pedido: 'Plazo de entrega: 7 a 10 días laborables.\n3 años de garantía.',
  albaran: ''
};
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const decimal = (v) => (v === '' || v == null ? '' : String(v).replace('.', ','));
const lineasDe = (txt) => String(txt || '').split('\n').map((x) => x.trim()).filter(Boolean);

export function crearGestion(x) {
  const { S, $, esc, escribir, col, aviso, cerrar, render, euros, num, nuevoId, hoyIso, sumaDias, textoFecha, cabecera, abrirHoja, PERSONAS } = x;
  S.gestion = Object.assign({ sub: 'documentos', tipo: 'todos', buscar: '', categoria: 'todas' }, S.gestion || {});

  /* ---------- Datos de apoyo ---------- */
  const ajustesEmpresa = () => S.ajustes.find((a) => a.id === 'empresa') || {};
  function empresa() {
    const guardado = ajustesEmpresa(), e = Object.assign({}, EMPRESA);
    for (const k of Object.keys(e)) if (guardado[k]) e[k] = guardado[k];
    return e;
  }
  function siguienteNumero(tipo, fecha) {
    const pre = TIPOS[tipo].prefijo + '-' + (fecha || hoyIso()).slice(0, 4) + '-';
    let max = 0;
    S.documentos.forEach((d) => { if (d.tipo === tipo && String(d.numero || '').startsWith(pre)) max = Math.max(max, parseInt(d.numero.slice(pre.length), 10) || 0); });
    return pre + String(max + 1).padStart(4, '0');
  }
  function siguienteCodigoCliente() {
    const max = S.clientes.reduce((m, c) => Math.max(m, parseInt(c.codigo, 10) || 0), 0);
    return String(max + 1).padStart(4, '0');
  }
  const producto = (id) => S.productos.find((p) => p.id === id);
  const buscarProductos = (q) => {
    const t = sinTildes(q).split(/\s+/).filter(Boolean);
    return S.productos.filter((p) => p.activo !== false).filter((p) => {
      const texto = sinTildes([p.ref, p.nombre, p.categoria, p.medidas, p.detalle].join(' '));
      return t.every((w) => texto.includes(w));
    }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
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

  /* ---------- Vista ---------- */
  function renderGestion() {
    const G = S.gestion;
    const subs = [['documentos', 'Documentos', S.documentos.length], ['productos', 'Productos', S.productos.length], ['clientes', 'Clientes', S.clientes.length], ['empresa', 'Datos de la empresa', null]];
    const acciones = {
      documentos: '<button class="btn primario" type="button" data-nuevo="presupuesto">+ Presupuesto</button><button class="btn" type="button" data-nuevo="pedido">+ Pedido</button><button class="btn" type="button" data-nuevo="albaran">+ Albarán</button>',
      productos: '<button class="btn primario" type="button" data-nuevo="producto">+ Producto</button>',
      clientes: '<button class="btn primario" type="button" data-nuevo="cliente">+ Cliente</button>',
      empresa: ''
    }[G.sub];
    let html = cabecera('Gestión', 'Productos, clientes, presupuestos, pedidos y albaranes.', acciones) +
      '<div class="filtros">' + subs.map(([k, n, c]) => '<button class="chip" type="button" data-gsub="' + k + '" aria-pressed="' + (G.sub === k) + '">' + n + (c ? ' <span style="opacity:.6">' + c + '</span>' : '') + '</button>').join('') + '</div>';
    if (G.sub === 'productos') html += vistaProductos();
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
    const lista = S.documentos.filter((d) => G.tipo === 'todos' || d.tipo === G.tipo)
      .filter((d) => !q || sinTildes([d.numero, (d.cliente || {}).nombre, d.suReferencia].join(' ')).includes(q))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || '').localeCompare(a.creado || ''));
    let html = '<div class="filtros">' + [['todos', 'Todos'], ['presupuesto', 'Presupuestos'], ['pedido', 'Pedidos'], ['albaran', 'Albaranes']]
      .map(([k, n]) => '<button class="chip" type="button" data-gtipo="' + k + '" aria-pressed="' + (G.tipo === k) + '">' + n + '</button>').join('') + buscador('Buscar por número o cliente') + '</div>';
    if (!S.documentos.length) return html + '<div class="vacio">Todavía no hay documentos. Empieza con «+ Presupuesto». Antes conviene dar de alta los productos en «Productos».</div>';
    if (!lista.length) return html + '<div class="vacio">Nada con este filtro.</div>';
    return html + '<div class="tabla-wrap"><table class="mov"><thead><tr><th>Número</th><th>Tipo</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th class="num">Total</th></tr></thead><tbody>' +
      lista.map((d) => {
        const est = (ESTADOS_DOC[d.tipo] || []).find((e) => e[0] === d.estado);
        return '<tr class="clic" tabindex="0" data-abrir="documentos:' + esc(d.id) + '"><td><b>' + esc(d.numero) + '</b></td><td>' + esc((TIPOS[d.tipo] || {}).titulo || '') + '</td><td>' + esc(textoFecha(d.fecha)) + '</td><td>' + esc((d.cliente || {}).nombre || '') + '</td>' +
          '<td>' + (est ? '<span class="pill ' + (CLASE_ESTADO[est[0]] || '') + '">' + esc(est[1]) + '</span>' : '') + '</td><td class="num">' + (d.tipo === 'albaran' && !d.valorado ? '' : euros(calcular(d).total)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function vistaProductos() {
    const G = S.gestion;
    if (!S.listo.productos) return '<div class="vacio">Cargando productos…</div>';
    const cats = ['todas'].concat(CATEGORIAS.filter((c) => S.productos.some((p) => p.categoria === c)));
    const q = sinTildes(G.buscar);
    const lista = S.productos.filter((p) => G.categoria === 'todas' || p.categoria === G.categoria)
      .filter((p) => !q || sinTildes([p.ref, p.nombre, p.categoria, p.medidas, p.detalle].join(' ')).includes(q))
      .sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '') || (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    let html = '<div class="filtros">' + cats.map((c) => '<button class="chip" type="button" data-gcat="' + esc(c) + '" aria-pressed="' + (G.categoria === c) + '">' + esc(c === 'todas' ? 'Todas' : c) + '</button>').join('') + buscador('Buscar producto') + '</div>';
    if (!S.productos.length) return html + '<div class="vacio">El catálogo está vacío. Da de alta cada producto con «+ Producto»: foto, referencia, características y precio. Luego, al hacer un documento, basta con buscarlo.</div>';
    if (!lista.length) return html + '<div class="vacio">Ningún producto con este filtro.</div>';
    return html + '<div class="rejilla-cards g-productos">' + lista.map((p) => {
      const iva = Number(p.iva ?? 21);
      return '<article class="card g-prod' + (p.activo === false ? ' g-inactivo' : '') + '">' +
        '<div class="g-foto">' + (p.foto ? '<img src="' + esc(p.foto) + '" alt="">' : '<span>Sin foto</span>') + '</div>' +
        '<div class="g-prod-txt"><h3>' + esc(p.nombre) + '</h3><div class="linea"><span>' + esc(p.ref) + '</span>' + (p.categoria ? '<span class="pill">' + esc(p.categoria) + '</span>' : '') + (p.activo === false ? '<span class="pill bad">De baja</span>' : '') + '</div>' +
        (p.medidas ? '<div class="linea">' + esc(p.medidas) + '</div>' : '') +
        '<div class="linea"><b style="color:var(--ink)">' + euros(p.precio) + '</b><span>+ IVA · ' + euros(Math.round(p.precio * (1 + iva / 100) * 100) / 100) + ' con IVA</span></div>' +
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
    const faltan = ['razonSocial', 'nif', 'domicilio'].filter((k) => !g[k]);
    return (faltan.length ? '<div class="est-aviso">Faltan datos que deben salir en los documentos: ' + faltan.map((k) => ({ razonSocial: 'razón social', nif: 'NIF', domicilio: 'domicilio' }[k])).join(', ') + '.</div>' : '') +
      '<div class="card" style="margin-top:12px;max-width:640px"><h3>' + esc(e.razonSocial) + '</h3><div class="txt">NIF ' + esc(e.nif) + '\n' + esc(e.domicilio) + '\n' + esc(e.localidad) + '\n' + esc(e.telefono) + ' · ' + esc(e.correo) + '\n' + esc(e.web) + (e.registro ? '\n' + esc(e.registro) : '') + '</div>' +
      '<div class="pie"><span>Validez de los presupuestos: ' + (g.validez || 15) + ' días</span><span class="der">' + (S.escribir ? '<button class="mini" type="button" data-nuevo="empresa">Editar</button>' : '') + '<a class="mini" href="plantilla.html" target="_blank" rel="noopener">Ver la plantilla</a></span></div></div>';
  }

  /* ---------- Producto ---------- */
  function formProducto(p) {
    const nuevo = !p;
    p = p || { categoria: 'Colchones', iva: '21', activo: true };
    let foto = p.foto || '';
    const campos = [
      { n: 'nombre', l: 'Nombre', req: true, ancho: true, max: 140, ph: 'Ej.: Colchón Landez 135 × 190' },
      { n: 'ref', l: 'Referencia', req: true, max: 40, ph: 'Ej.: COL-135' },
      { n: 'categoria', l: 'Categoría', t: 'select', op: CATEGORIAS },
      { n: 'medidas', l: 'Medidas', max: 80, ph: 'Ej.: 135 × 190 × 30 cm' },
      { n: 'proveedor', l: 'Proveedor', max: 120, lista: S.proveedores.map((x) => x.nombre) },
      { n: 'detalle', l: 'Características (una por línea; salen en el documento)', t: 'textarea', ancho: true, ph: 'Núcleo: muelle ensacado y viscoelástica\nFirmeza: media\nFunda: tejido 3D desenfundable' },
      { n: 'sep1', l: 'Precio', t: 'sep' },
      { n: 'precio', l: 'Precio de venta sin IVA (€)', t: 'dinero', req: true },
      { n: 'iva', l: 'IVA', t: 'select', op: [['21', '21 %'], ['10', '10 %'], ['4', '4 %'], ['0', 'Sin IVA']] },
      { n: 'coste', l: 'Coste de compra sin IVA (€, no sale en documentos)', t: 'dinero' },
      { n: 'sep2', l: 'Envío', t: 'sep' },
      { n: 'peso', l: 'Peso por unidad (kg)', t: 'dinero' },
      { n: 'volumen', l: 'Volumen por unidad (m³)', t: 'dinero' },
      { n: 'bultos', l: 'Bultos por unidad', t: 'dinero', def: 1 },
      { n: 'activo', l: 'Se sigue vendiendo (si no, no sale al buscar)', t: 'check' }
    ];
    const extra = '<div class="campo ancho"><span class="lbl">Foto</span><div class="g-foto-edit"><div class="g-foto" id="p-foto">' + (foto ? '<img src="' + esc(foto) + '" alt="">' : '<span>Sin foto</span>') + '</div>' +
      (S.escribir ? '<div class="g-foto-btns"><label class="btn" for="p-foto-in">Elegir foto</label><input type="file" id="p-foto-in" accept="image/*" hidden><button type="button" class="btn" id="p-foto-quitar"' + (foto ? '' : ' hidden') + '>Quitar</button></div>' : '') + '</div></div>' +
      '<div class="campo ancho" id="p-pvp" style="font-size:13px;color:var(--muted)"></div>';
    abrirHoja({
      titulo: nuevo ? 'Nuevo producto' : p.nombre, campos, valores: Object.assign({}, p, { iva: String(p.iva ?? 21) }), extra,
      alMontar(form) {
        const pvp = () => { const pr = num(form.elements.precio.value), iv = Number(form.elements.iva.value); $('p-pvp').textContent = pr ? 'Con IVA: ' + euros(Math.round(pr * (1 + iv / 100) * 100) / 100) : ''; };
        form.elements.precio.addEventListener('input', pvp); form.elements.iva.addEventListener('change', pvp); pvp();
        const pintar = () => { $('p-foto').innerHTML = foto ? '<img src="' + esc(foto) + '" alt="">' : '<span>Sin foto</span>'; if ($('p-foto-quitar')) $('p-foto-quitar').hidden = !foto; };
        if ($('p-foto-in')) $('p-foto-in').addEventListener('change', async (e) => {
          const f = e.target.files[0]; if (!f) return;
          try { foto = await fotoReducida(f); pintar(); } catch (err) { aviso(err.message); }
          e.target.value = '';
        });
        if ($('p-foto-quitar')) $('p-foto-quitar').onclick = () => { foto = ''; pintar(); };
      },
      alGuardar(d) {
        ['sep1', 'sep2'].forEach((k) => delete d[k]);
        const repetida = S.productos.find((o) => o.id !== p.id && sinTildes(o.ref) === sinTildes(d.ref));
        if (repetida) { aviso('La referencia ' + d.ref + ' ya es de «' + repetida.nombre + '».'); return false; }
        const cuerpo = Object.assign(d, { foto, actualizado: new Date().toISOString() });
        if (nuevo) return escribir(() => col('productos').add(Object.assign(cuerpo, { creado: cuerpo.actualizado, creadoPor: S.yo })), 'Producto añadido', 'añadió el producto «' + d.nombre + '»');
        return escribir(() => col('productos').doc(p.id).update(cuerpo), 'Producto guardado', 'editó el producto «' + d.nombre + '»');
      },
      alBorrar: nuevo ? null : () => escribir(() => col('productos').doc(p.id).delete(), 'Producto eliminado', 'borró el producto «' + p.nombre + '»')
    });
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
      { n: 'razonSocial', l: 'Razón social', req: true, ancho: true, max: 160 },
      { n: 'nif', l: 'NIF', req: true, max: 20 },
      { n: 'telefono', l: 'Teléfono', max: 40 },
      { n: 'domicilio', l: 'Domicilio', req: true, ancho: true, max: 160 },
      { n: 'localidad', l: 'CP, localidad y provincia', ancho: true, max: 120 },
      { n: 'correo', l: 'Correo', max: 120 },
      { n: 'web', l: 'Web', max: 120 },
      { n: 'registro', l: 'Registro Mercantil (si sois sociedad)', ancho: true, max: 240, ph: 'Registro Mercantil de Murcia, tomo …, folio …, hoja …' },
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
        delete d.sepC;
        d.validez = Math.max(1, parseInt(d.validez, 10) || 15);
        return escribir(() => col('ajustes').doc('empresa').set(d), 'Datos guardados', 'cambió los datos de la empresa para los documentos');
      }
    });
  }

  /* ---------- Documento ---------- */
  function nuevoDocumento(tipo, base) {
    const g = ajustesEmpresa();
    const fecha = hoyIso();
    const d = Object.assign({
      tipo, fecha, numero: siguienteNumero(tipo, fecha), estado: ESTADOS_DOC[tipo][0][0], comercial: S.yo || '',
      cliente: { pais: 'España' }, envio: {}, lineas: [], logistica: {},
      formaPago: g.formaPago || '', notas: '',
      condiciones: lineasDe({ presupuesto: g.condPresupuesto ?? CONDICIONES_BASE.presupuesto, pedido: g.condPedido ?? CONDICIONES_BASE.pedido, albaran: g.condAlbaran ?? CONDICIONES_BASE.albaran }[tipo])
    }, base || {});
    if (tipo === 'presupuesto' && !d.validoHasta) d.validoHasta = sumaDias(fecha, Number(g.validez) || 15);
    return d;
  }

  function lineaDeProducto(p) {
    return { productoId: p.id, ref: p.ref || '', descripcion: p.nombre || '', detalle: [p.medidas ? 'Medidas: ' + p.medidas : '', p.detalle || ''].filter(Boolean).join('\n'),
      cantidad: 1, precio: Number(p.precio) || 0, dto1: 0, dto2: 0, iva: Number(p.iva ?? 21) };
  }

  // Bultos, peso y volumen sumados de los productos del catálogo.
  function logisticaDe(lineas) {
    let bultos = 0, peso = 0, volumen = 0, alguno = false;
    lineas.forEach((l) => {
      const p = l.productoId && producto(l.productoId); if (!p) return;
      const n = Number(l.cantidad) || 0; alguno = true;
      bultos += n * (Number(p.bultos) || (p.categoria === 'Servicios' ? 0 : 1)); peso += n * (Number(p.peso) || 0); volumen += n * (Number(p.volumen) || 0);
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
    const titulo = (TIPOS[tipo] || {}).titulo || 'Documento';
    const ro = S.escribir ? '' : ' disabled';
    const campo = (id, l, v, extra = '') => '<div class="campo"><label for="' + id + '">' + l + '</label><input id="' + id + '" value="' + esc(v ?? '') + '"' + extra + ro + '></div>';
    const fechaCampo = (id, l, v) => campo(id, l, v, ' type="date"');
    const estados = ESTADOS_DOC[tipo].map(([k, n]) => '<option value="' + k + '"' + (d.estado === k ? ' selected' : '') + '>' + n + '</option>').join('');
    const personas = Object.keys(PERSONAS).filter((k) => k !== 'todos').map((k) => '<option value="' + k + '"' + (d.comercial === k ? ' selected' : '') + '>' + esc(PERSONAS[k].n) + '</option>').join('');
    const env = d.envio;
    const otroEnvio = !!(env.direccion || env.nombre);
    const conversion = !nuevo && S.escribir ? (tipo === 'presupuesto' ? '<button type="button" class="btn" id="d-convertir" data-a="pedido">Pasar a pedido</button>' : tipo === 'pedido' ? '<button type="button" class="btn" id="d-convertir" data-a="albaran">Hacer albarán</button>' : '') : '';

    $('capa').innerHTML = '<div class="velo" id="velo"><form class="hoja hoja-doc" id="hoja" novalidate>' +
      '<h2>' + esc(titulo) + ' <span style="color:var(--muted);font-weight:500">' + esc(d.numero) + '</span></h2>' +
      '<div class="campos g-tres">' +
        campo('d-numero', 'Número', d.numero) + fechaCampo('d-fecha', 'Fecha', d.fecha) +
        (tipo === 'presupuesto' ? fechaCampo('d-valido', 'Válido hasta', d.validoHasta) : tipo === 'pedido' ? fechaCampo('d-entrega', 'Entrega prevista', d.entregaPrevista) : fechaCampo('d-entregado', 'Fecha de entrega', d.fechaEntrega)) +
        '<div class="campo"><label for="d-estado">Estado</label><select id="d-estado"' + ro + '>' + estados + '</select></div>' +
        '<div class="campo"><label for="d-comercial">Atendido por</label><select id="d-comercial"' + ro + '><option value=""></option>' + personas + '</select></div>' +
        campo('d-suref', 'Su referencia', d.suReferencia, ' maxlength="80"') +
      '</div>' +
      '<div class="separador">Cliente</div>' +
      '<div class="campos g-tres">' +
        '<div class="campo ancho"><label for="d-cli-nombre">Nombre o empresa (escribe para buscar entre los clientes)</label><input id="d-cli-nombre" list="d-clientes" autocomplete="off" value="' + esc(d.cliente.nombre || '') + '"' + ro + '>' +
        '<datalist id="d-clientes">' + S.clientes.map((c) => '<option value="' + esc(c.nombre) + '">' + esc([c.codigo, c.nif, c.localidad].filter(Boolean).join(' · ')) + '</option>').join('') + '</datalist></div>' +
        campo('d-cli-nif', 'NIF / DNI', d.cliente.nif) + campo('d-cli-tel', 'Teléfono', d.cliente.telefono) + campo('d-cli-correo', 'Correo', d.cliente.correo, ' type="email"') +
        '<div class="campo ancho"><label for="d-cli-dir">Dirección</label><input id="d-cli-dir" value="' + esc(d.cliente.direccion || '') + '"' + ro + '></div>' +
        campo('d-cli-loc', 'CP y localidad', d.cliente.localidad) + campo('d-cli-pais', 'País', d.cliente.pais) + campo('d-cli-att', 'A la atención de', d.cliente.att) +
        '<label class="chk-linea campo ancho"><input type="checkbox" id="d-cli-guardar" checked' + ro + '> Guardar o actualizar este cliente en «Clientes»</label>' +
        '<label class="chk-linea campo ancho"><input type="checkbox" id="d-otro-envio"' + (otroEnvio ? ' checked' : '') + ro + '> Enviar a otra dirección</label>' +
      '</div>' +
      '<div class="campos g-tres" id="d-envio"' + (otroEnvio || tipo === 'albaran' ? '' : ' hidden') + '>' +
        '<div class="campo ancho"><label for="d-env-nombre">Nombre en el envío</label><input id="d-env-nombre" value="' + esc(env.nombre || '') + '"' + ro + '></div>' +
        '<div class="campo ancho"><label for="d-env-dir">Dirección de envío</label><input id="d-env-dir" value="' + esc(env.direccion || '') + '"' + ro + '></div>' +
        campo('d-env-loc', 'CP y localidad', env.localidad) + campo('d-env-pais', 'País', env.pais) + campo('d-env-contacto', 'Contacto para la entrega', env.contacto) +
        (tipo === 'albaran' ? campo('d-env-trans', 'Transporte', env.transportista) + campo('d-env-seg', 'Seguimiento', env.seguimiento) : '') +
      '</div>' +
      '<div class="separador">Productos</div>' +
      (S.escribir ? '<div class="g-busca"><input type="search" id="d-buscar" autocomplete="off" placeholder="Busca por nombre, referencia o categoría y pulsa Intro" aria-label="Buscar producto">' +
        '<button type="button" class="btn" id="d-libre">+ Línea libre</button><div class="g-resultados" id="d-resultados" hidden></div></div>' : '') +
      '<div id="d-lineas" class="g-lineas"></div>' +
      '<div class="g-cierre"><div class="campos g-tres">' +
        campo('d-forma', 'Forma de pago', d.formaPago, ' maxlength="200"') +
        (tipo === 'pedido' ? campo('d-pagado', 'Pagado a cuenta (€)', decimal(d.pagado), ' inputmode="decimal"') : '') +
        (tipo === 'albaran' ? '<label class="chk-linea campo"><input type="checkbox" id="d-valorado"' + (d.valorado ? ' checked' : '') + ro + '> Albarán con precios</label>' : '') +
        campo('d-bultos', 'Bultos', decimal(d.logistica.bultos), ' inputmode="decimal"') + campo('d-peso', 'Peso bruto (kg)', decimal(d.logistica.pesoBruto), ' inputmode="decimal"') +
        campo('d-pesoneto', 'Peso neto (kg)', decimal(d.logistica.pesoNeto), ' inputmode="decimal"') + campo('d-volumen', 'Volumen (m³)', decimal(d.logistica.volumen), ' inputmode="decimal"') +
        (S.escribir ? '<div class="campo" style="align-self:end"><button type="button" class="btn" id="d-calc-log">Calcular de los productos</button></div>' : '') +
        '<div class="campo ancho"><label for="d-notas">Notas</label><textarea id="d-notas" maxlength="2000"' + ro + '>' + esc(d.notas || '') + '</textarea></div>' +
        '<div class="campo ancho"><label for="d-cond">Condiciones (una por línea)</label><textarea id="d-cond" maxlength="3000"' + ro + '>' + esc((d.condiciones || []).join('\n')) + '</textarea></div>' +
      '</div><div class="g-totales" id="d-totales"></div></div>' +
      '<div class="pie-hoja">' + (!nuevo && S.escribir ? '<button type="button" class="btn peligro" id="borrar">Eliminar</button>' : '') +
        '<div class="der"><button type="button" class="btn" id="cancelar">Cerrar</button><button type="button" class="btn" id="d-imprimir">Imprimir o PDF</button>' + conversion +
        (S.escribir ? '<button type="submit" class="btn primario" id="guardar">Guardar</button>' : '') + '</div></div>' +
      '</form></div>';

    const form = $('hoja');
    const v = (id) => ($(id) ? $(id).value.trim() : '');
    const cambiado = { valor: false };

    // Líneas
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
            '<input data-k="precio" inputmode="decimal" value="' + esc(decimal(l.precio)) + '" placeholder="Precio" aria-label="Precio sin IVA"' + ro + '>' +
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
      const c = calcular(Object.assign({}, d, { pagado: tipo === 'pedido' ? num(v('d-pagado')) : 0 }));
      c.lineas.forEach((l, i) => { const el = form.querySelector('[data-imp="' + i + '"]'); if (el) el.textContent = l.precio ? euros(l.importe) : 'Incluido'; });
      $('d-totales').innerHTML = '<div><span>Bruto</span><b>' + euros(c.bruto) + '</b></div>' + (c.descuento ? '<div><span>Descuentos</span><b>−' + euros(c.descuento) + '</b></div>' : '') +
        c.tramos.map((t) => '<div><span>Base ' + t.tipo + ' %</span><b>' + euros(t.base) + '</b></div><div><span>IVA ' + t.tipo + ' %</span><b>' + euros(t.cuota) + '</b></div>').join('') +
        '<div class="g-total"><span>Total</span><b>' + euros(c.total) + '</b></div>' + (c.pagado ? '<div><span>Pendiente</span><b>' + euros(c.pendiente) + '</b></div>' : '');
    }
    $('d-lineas').addEventListener('input', (e) => {
      const fila = e.target.closest('[data-i]'); const k = e.target.dataset.k; if (!fila || !k) return;
      const l = d.lineas[Number(fila.dataset.i)];
      l[k] = ['cantidad', 'precio', 'dto1', 'dto2', 'iva'].includes(k) ? num(e.target.value) : e.target.value;
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
          '<span class="g-mini-foto">' + (p.foto ? '<img src="' + esc(p.foto) + '" alt="">' : '') + '</span><span><b>' + esc(p.nombre) + '</b><small>' + esc([p.ref, p.medidas].filter(Boolean).join(' · ')) + '</small></span><span class="g-res-precio">' + euros(p.precio) + '</span></button>').join('')
          : '<div class="g-res-vacio">Ningún producto coincide. ' + (S.productos.length ? '' : 'El catálogo está vacío: da de alta productos en Gestión → Productos.') + '</div>';
      };
      const anadir = (p) => {
        d.lineas.push(lineaDeProducto(p)); cambiado.valor = true; pintarLineas();
        $('d-buscar').value = ''; marcado = 0; pintarRes(); $('d-buscar').focus();
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

    // Cliente: al elegir uno de la lista se rellenan sus datos.
    const rellenarCliente = () => {
      const c = S.clientes.find((x) => x.nombre === v('d-cli-nombre'));
      if (!c) return;
      d.clienteId = c.id;
      [['d-cli-nif', c.nif], ['d-cli-tel', c.telefono], ['d-cli-correo', c.correo], ['d-cli-dir', c.direccion], ['d-cli-loc', c.localidad], ['d-cli-pais', c.pais], ['d-cli-att', c.att]].forEach(([id, val]) => { $(id).value = val || ''; });
      if (c.envioDireccion) {
        $('d-otro-envio').checked = true; $('d-envio').hidden = false;
        [['d-env-nombre', c.envioNombre], ['d-env-dir', c.envioDireccion], ['d-env-loc', c.envioLocalidad], ['d-env-pais', c.envioPais], ['d-env-contacto', c.envioContacto]].forEach(([id, val]) => { $(id).value = val || ''; });
      }
    };
    $('d-cli-nombre').addEventListener('change', rellenarCliente);
    $('d-otro-envio').addEventListener('change', (e) => { $('d-envio').hidden = !e.target.checked && tipo !== 'albaran'; });
    if ($('d-calc-log')) $('d-calc-log').onclick = () => {
      const l = logisticaDe(d.lineas);
      if (!Object.keys(l).length) { aviso('Ningún producto del documento tiene peso o volumen en el catálogo.'); return; }
      $('d-bultos').value = decimal(l.bultos); $('d-peso').value = decimal(l.pesoBruto); $('d-volumen').value = decimal(l.volumen);
    };
    if ($('d-pagado')) $('d-pagado').addEventListener('input', pintarTotales);
    form.addEventListener('input', () => { cambiado.valor = true; });

    function leer() {
      const r = Object.assign({}, d, {
        numero: v('d-numero'), fecha: v('d-fecha'), estado: v('d-estado'), comercial: v('d-comercial'), suReferencia: v('d-suref'),
        cliente: { nombre: v('d-cli-nombre'), nif: v('d-cli-nif'), telefono: v('d-cli-tel'), correo: v('d-cli-correo'), direccion: v('d-cli-dir'), localidad: v('d-cli-loc'), pais: v('d-cli-pais'), att: v('d-cli-att') },
        envio: $('d-otro-envio').checked || tipo === 'albaran'
          ? { nombre: v('d-env-nombre'), direccion: v('d-env-dir'), localidad: v('d-env-loc'), pais: v('d-env-pais'), contacto: v('d-env-contacto'), transportista: v('d-env-trans'), seguimiento: v('d-env-seg') } : {},
        formaPago: v('d-forma'), notas: $('d-notas').value.trim(), condiciones: lineasDe($('d-cond').value),
        logistica: { bultos: num(v('d-bultos')) || '', pesoBruto: num(v('d-peso')) || '', pesoNeto: num(v('d-pesoneto')) || '', volumen: num(v('d-volumen')) || '' },
        lineas: d.lineas.map((l) => ({ productoId: l.productoId || '', ref: String(l.ref || '').trim(), descripcion: String(l.descripcion || '').trim(), detalle: String(l.detalle || '').trim(),
          cantidad: Number(l.cantidad) || 0, precio: Number(l.precio) || 0, dto1: Number(l.dto1) || 0, dto2: Number(l.dto2) || 0, iva: Number(l.iva ?? 21) }))
      });
      if (tipo === 'presupuesto') r.validoHasta = v('d-valido');
      if (tipo === 'pedido') { r.entregaPrevista = v('d-entrega'); r.pagado = num(v('d-pagado')); }
      if (tipo === 'albaran') { r.fechaEntrega = v('d-entregado'); r.valorado = $('d-valorado').checked; }
      // En el albarán, si no hay otra dirección, se entrega en la del cliente.
      if (tipo === 'albaran' && !r.envio.direccion) r.envio = Object.assign({}, r.envio, { direccion: r.cliente.direccion, localidad: r.cliente.localidad, pais: r.cliente.pais });
      return r;
    }

    async function guardarCliente(r) {
      if (!$('d-cli-guardar').checked || !r.cliente.nombre) return;
      const datos = Object.assign({}, r.cliente);
      if ($('d-otro-envio').checked) Object.assign(datos, { envioNombre: r.envio.nombre, envioDireccion: r.envio.direccion, envioLocalidad: r.envio.localidad, envioPais: r.envio.pais, envioContacto: r.envio.contacto });
      const existe = S.clientes.find((c) => c.id === r.clienteId) || S.clientes.find((c) => sinTildes(c.nombre) === sinTildes(r.cliente.nombre));
      if (existe) { r.clienteId = existe.id; r.cliente.codigo = existe.codigo; await col('clientes').doc(existe.id).update(Object.assign(datos, { actualizado: new Date().toISOString() })); return; }
      const id = nuevoId(); const codigo = siguienteCodigoCliente();
      await col('clientes').doc(id).set(Object.assign(datos, { codigo, creado: new Date().toISOString(), creadoPor: S.yo }));
      r.clienteId = id; r.cliente.codigo = codigo;
    }
    async function guardar() {
      const r = leer();
      if (!r.numero) { aviso('Falta el número.'); $('d-numero').focus(); return null; }
      if (!r.cliente.nombre) { aviso('Falta el cliente.'); $('d-cli-nombre').focus(); return null; }
      const repetido = S.documentos.find((o) => o.id !== r.id && o.tipo === tipo && o.numero === r.numero);
      if (repetido) { aviso('Ya hay un ' + titulo.toLowerCase() + ' con el número ' + r.numero + '.'); return null; }
      const ok = await escribir(async () => {
        await guardarCliente(r);
        const ahora = new Date().toISOString();
        const cuerpo = Object.assign({}, r, { actualizado: ahora, total: calcular(r).total }); delete cuerpo.id;
        if (r.id) await col('documentos').doc(r.id).set(cuerpo);
        else { r.id = nuevoId(); await col('documentos').doc(r.id).set(Object.assign(cuerpo, { creado: ahora, creadoPor: S.yo })); }
        if (r.origenId && nuevo) {
          const origen = S.documentos.find((o) => o.id === r.origenId);
          if (origen) await col('documentos').doc(origen.id).update({ estado: origen.tipo === 'presupuesto' ? 'aceptado' : 'servido' });
        }
      }, titulo + ' guardado', (nuevo ? 'hizo el ' : 'editó el ') + titulo.toLowerCase() + ' ' + r.numero + ' para ' + r.cliente.nombre);
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
    if ($('d-convertir')) $('d-convertir').onclick = async () => {
      const r = cambiado.valor ? await guardar() : leer();
      if (!r) return;
      const a = $('d-convertir').dataset.a;
      const nuevoDoc = nuevoDocumento(a, {
        cliente: r.cliente, clienteId: r.clienteId, envio: r.envio, lineas: r.lineas, suReferencia: r.suReferencia, referencia: r.numero, origenId: r.id,
        formaPago: r.formaPago, logistica: r.logistica, pagado: r.pagado || 0, comercial: r.comercial
      });
      editorDocumento(null, nuevoDoc);
      aviso('Revisa el ' + TIPOS[a].titulo.toLowerCase() + ' y pulsa Guardar.');
    };
    if ($('borrar')) {
      let armado = false, t;
      $('borrar').onclick = async () => {
        const b = $('borrar');
        if (!armado) { armado = true; b.classList.add('armado'); b.textContent = 'Pulsa otra vez para eliminar'; t = setTimeout(() => { armado = false; b.classList.remove('armado'); b.textContent = 'Eliminar'; }, 4000); return; }
        clearTimeout(t);
        if (await escribir(() => col('documentos').doc(d.id).delete(), titulo + ' eliminado', 'borró el ' + titulo.toLowerCase() + ' ' + d.numero)) cerrar();
      };
    }
    if (nuevo && $('d-cli-nombre') && !d.cliente.nombre) $('d-cli-nombre').focus();
  }

  /* ---------- Conexión con el panel ---------- */
  function alClic(b) {
    if (b.dataset.gsub) { S.gestion.sub = b.dataset.gsub; S.gestion.buscar = ''; render(); return true; }
    if (b.dataset.gtipo) { S.gestion.tipo = b.dataset.gtipo; render(); return true; }
    if (b.dataset.gcat) { S.gestion.categoria = b.dataset.gcat; render(); return true; }
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
      albaran: () => editorDocumento(null, nuevoDocumento('albaran'))
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
  .g-foto-edit { display: flex; gap: 12px; align-items: center; }
  .g-foto-edit .g-foto { width: 120px; height: 120px; }
  .g-foto-btns { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .g-foto-btns label.btn { cursor: pointer; }
  .hoja.hoja-doc { width: min(1180px, 100%); }
  .g-tres { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .g-busca { position: relative; display: flex; gap: 8px; margin: 4px 0 10px; }
  .g-busca input { flex: 1; min-width: 0; border: 1.5px solid var(--accent); background: var(--bg); border-radius: 10px; padding: 10px 12px; font-size: 15px; }
  .g-resultados { position: absolute; z-index: 3; top: calc(100% + 4px); left: 0; right: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,.18); padding: 4px; max-height: 360px; overflow: auto; }
  .g-res { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; align-items: center; width: 100%; text-align: left; border: 0; background: transparent; padding: 6px 8px; border-radius: 8px; color: var(--ink); font: inherit; }
  .g-res small { display: block; color: var(--muted); font-size: 12.5px; }
  .g-res.marcado, .g-res:hover { background: var(--accent-soft); }
  .g-res-precio { font-variant-numeric: tabular-nums; font-weight: 700; }
  .g-res-vacio { padding: 10px; color: var(--muted); font-size: 13.5px; }
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
`;
