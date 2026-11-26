// Escandallo: from what a product costs us to the price it is sold at.
// Each category has a base escandallo (Gestión → Escandallos); a product can use it or have its own.
// Selling price without VAT P = (purchase cost × (1 + % on purchase) + € per unit) / (1 − % on sale − margin),
// then VAT is added, the price with VAT is rounded, and it is never left below the supplier's minimum retail price.
// A size can carry the supplier's minimum retail price with VAT (Azorín sets one): the price never goes below it.

export const TIPOS_COSTE = [['fijo', '€ por unidad'], ['compra', '% del coste de compra'], ['venta', '% del precio de venta']];
export const REDONDEOS = [['9', 'Hacia arriba, acabado en 9 € (349 €)'], ['euro', 'Hacia arriba, al euro (343 €)'], ['99', 'Acabado en ,99 € (342,99 €)'], ['5', 'Hacia arriba, a múltiplo de 5 € (345 €)'], ['no', 'Sin redondear']];

// Starting point for a category that has no escandallo yet: the usual concepts, at 0 until someone fills them in.
export const ESCANDALLO_BASE = {
  lineas: [
    { concepto: 'Transporte desde el proveedor', tipo: 'fijo', valor: 0 },
    { concepto: 'Envío al cliente', tipo: 'fijo', valor: 0 },
    { concepto: 'Embalaje', tipo: 'fijo', valor: 0 },
    { concepto: 'Comisión de cobro (tarjeta, Klarna…)', tipo: 'venta', valor: 0 },
    { concepto: 'Publicidad', tipo: 'venta', valor: 0 },
    { concepto: 'Devoluciones y garantía', tipo: 'venta', valor: 0 }
  ],
  margen: 30,
  redondeo: '9'
};

const r2 = (n) => Math.round(n * 100) / 100;

export function redondear(conIva, modo) {
  const x = r2(conIva);
  if (modo === 'no') return x;
  if (modo === '99') return r2(Math.ceil(x + 0.01 - 1e-9) - 0.01);
  if (modo === '5') return Math.ceil(x / 5 - 1e-9) * 5;
  const n = Math.ceil(x - 1e-9);
  if (modo === 'euro') return n;
  return n + ((9 - (n % 10)) + 10) % 10; // '9'
}

// The escandallo a product uses: its own one, or the one of its category, or the base one.
export function escandalloDe(p, plantillas) {
  if (p && p.escandallo && p.escandallo.propio) return p.escandallo;
  return (plantillas || {})[p && p.categoria] || ESCANDALLO_BASE;
}

// Purchase cost of a size, a finish or a product without sizes, as typed (with or without VAT, see costeConIva).
export const costeCompra = (p, x) => Number(x && x.coste) || 0;
// What the calculation needs from the product for that item: VAT, whether the cost includes VAT, and the minimum retail price.
export const datosCalculo = (p, x) => ({ iva: Number(p.iva ?? 21), costeConIva: !!p.costeConIva, pvpMin: Number(x && x.pvpMin) || 0 });

function sumas(e) {
  let fijos = 0, compra = 0, venta = 0;
  (e.lineas || []).forEach((l) => {
    const v = Number(l.valor) || 0;
    if (l.tipo === 'fijo') fijos += v; else if (l.tipo === 'compra') compra += v / 100; else venta += v / 100;
  });
  return { fijos, compra, venta, margen: (Number(e.margen) || 0) / 100 };
}

// Purchase cost without VAT.
export const costeNeto = (coste, o) => r2((Number(coste) || 0) / (o && o.costeConIva ? 1 + (Number(o.iva ?? 21) / 100) : 1));

// Full breakdown for one purchase cost. o = datosCalculo(...). With precioFijo (a price typed by hand, without VAT)
// it only works out what is left at that price.
export function desglose(coste, e, o = {}, precioFijo = 0) {
  const iva = Number(o.iva ?? 21) / 100;
  const C = costeNeto(coste, o);
  const s = sumas(e);
  const div = 1 - s.venta - s.margen;
  const minimo = Number(o.pvpMin) || 0;
  let conIva, subido = false;
  if (precioFijo > 0) conIva = precioFijo * (1 + iva);
  else {
    if (!(C > 0)) return { valido: false, motivo: 'Sin coste de compra' };
    if (div <= 0.01) return { valido: false, motivo: 'Los % sobre la venta y el margen suman 100 % o más' };
    conIva = redondear((C * (1 + s.compra) + s.fijos) / div * (1 + iva), e.redondeo || '9');
    if (minimo && conIva < minimo) { conIva = redondear(minimo, e.redondeo || '9'); subido = true; }
  }
  const precio = precioFijo > 0 ? r2(precioFijo) : r2(conIva / (1 + iva));
  const partes = (e.lineas || []).map((l) => {
    const v = Number(l.valor) || 0;
    return { concepto: l.concepto, tipo: l.tipo, valor: v, importe: r2(l.tipo === 'fijo' ? v : l.tipo === 'compra' ? C * v / 100 : precio * v / 100) };
  });
  const costeTotal = r2(C + partes.reduce((a, x) => a + x.importe, 0));
  const beneficio = r2(precio - costeTotal);
  return { valido: true, coste: C, partes, costeTotal, precio, conIva: r2(conIva), beneficio, margen: precio ? r2(beneficio / precio * 100) : 0, minimo, subido,
    bajoMinimo: !!(minimo && conIva < minimo - 0.005), aMano: precioFijo > 0 };
}

// Price without VAT of a finish or extra: same % costs and margin as the product (no € per unit, no rounding),
// and never below its own minimum retail price when it has one.
export function precioExtra(coste, e, o = {}) {
  const C = costeNeto(coste, o);
  const s = sumas(e);
  const div = 1 - s.venta - s.margen;
  const auto = C > 0 && div > 0.01 ? r2(C * (1 + s.compra) / div) : 0;
  const minimo = Number(o.pvpMin) ? r2(Number(o.pvpMin) / (1 + Number(o.iva ?? 21) / 100)) : 0;
  return Math.max(auto, minimo);
}
