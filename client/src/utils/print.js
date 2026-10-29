import toast from 'react-hot-toast';
import api, { errMsg } from '../api';

const m = (n) => Number(n || 0).toFixed(2);
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const baseCss = (width) => `
  @page { size: ${width}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 3mm; width: ${width}mm; font-family: 'Courier New', monospace; font-size: ${width === 58 ? 10 : 12}px; color: #000; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: 700; }
  .big { font-size: 1.6em; font-weight: 800; } .xl { font-size: 2em; font-weight: 800; }
  hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  hr.d { border-top: 2px solid #000; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 1px 0; vertical-align: top; }
  th { text-align: left; border-bottom: 1px dashed #000; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .muted { font-size: .9em; }
  .note { font-style: italic; padding-left: 10px; }
`;

export function receiptHTML(order, branch) {
  const s = branch?.settings || {};
  const width = s.printer?.paperWidth || 80;
  const cur = s.currency || '₹';
  const items = order.items
    .map(
      (it) => `<tr><td>${esc(it.name)}${it.variant ? ` <span class="muted">(${esc(it.variant)})</span>` : ''}${
        it.notes ? `<div class="note muted">- ${esc(it.notes)}</div>` : ''
      }</td><td class="r">${it.qty}</td><td class="r">${m(it.price)}</td><td class="r">${m(it.total)}</td></tr>`
    )
    .join('');
  const row = (l, r, cls = '') => `<div class="row ${cls}"><span>${l}</span><span>${r}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(width)}</style></head><body>
    <div class="c">
      ${s.printer?.showLogo !== false ? '<div class="xl">☕</div>' : ''}
      <div class="big">${esc(branch?.name)}</div>
      ${branch?.address ? `<div>${esc(branch.address)}${branch.city ? ', ' + esc(branch.city) : ''}</div>` : ''}
      ${branch?.phone ? `<div>Ph: ${esc(branch.phone)}</div>` : ''}
      ${branch?.gstin ? `<div>GSTIN: ${esc(branch.gstin)}</div>` : ''}
      ${s.receiptHeader ? `<div class="muted">${esc(s.receiptHeader)}</div>` : ''}
    </div>
    <hr class="d"/>
    <div class="c b">${order.status === 'cancelled' ? '*** CANCELLED ***' : order.status === 'held' ? 'PRO-FORMA / UNPAID' : 'TAX INVOICE'}</div>
    ${row(`Bill: <b>${esc(order.invoiceNo)}</b>`, `Token: <b>${order.tokenNo || '-'}</b>`)}
    ${row(new Date(order.createdAt).toLocaleString('en-IN'), esc(order.orderType).toUpperCase())}
    ${order.tableName ? row('Table', `<b>${esc(order.tableName)}</b>`) : ''}
    ${order.customerPhone ? row('Customer', `${esc(order.customerName || '')} ${esc(order.customerPhone)}`) : ''}
    ${row('Cashier', esc(order.cashierName || ''))}
    <hr/>
    <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amt</th></tr></thead><tbody>${items}</tbody></table>
    <hr/>
    ${row('Sub Total', m(order.subTotal))}
    ${order.discountAmount ? row(`Discount${order.discountType === 'percent' ? ` (${order.discountValue}%)` : ''}`, '-' + m(order.discountAmount)) : ''}
    ${row(`${esc(s.taxLabel || 'Tax')}${order.taxInclusive ? ' (incl.)' : ''}`, m(order.taxAmount))}
    ${order.pointsValue ? row(`Points redeemed (${order.pointsRedeemed})`, '-' + m(order.pointsValue)) : ''}
    ${order.roundOff ? row('Round off', m(order.roundOff)) : ''}
    <hr class="d"/>
    ${row('<span class="big">TOTAL</span>', `<span class="big">${cur}${m(order.grandTotal)}</span>`)}
    <hr class="d"/>
    ${(order.payments || []).map((p) => row(`Paid (${p.method.toUpperCase()})`, m(p.amount))).join('')}
    ${order.changeDue ? row('Change', m(order.changeDue)) : ''}
    ${order.pointsEarned && order.status === 'completed' ? `<div class="c muted">You earned ${order.pointsEarned} loyalty points</div>` : ''}
    <hr/>
    <div class="c b">${esc(s.receiptFooter || 'Thank you!')}</div>
    <div class="c muted">Powered by BrewBill</div>
  </body></html>`;
}

export function kotHTML(order, branch) {
  const width = branch?.settings?.printer?.paperWidth || 80;
  const items = order.items
    .map((it) => `<tr><td class="big">${it.qty} ×</td><td class="big">${esc(it.name)}${it.variant ? ` <span class="muted">(${esc(it.variant)})</span>` : ''}${it.notes ? `<div class="note">» ${esc(it.notes)}</div>` : ''}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(width)} td{padding:3px 0}</style></head><body>
    <div class="c xl">KOT</div>
    <div class="c">${esc(branch?.name)}</div>
    <hr class="d"/>
    <div class="row"><span class="xl">#${order.tokenNo || '-'}</span><span class="big">${esc(order.orderType).toUpperCase()}</span></div>
    ${order.tableName ? `<div class="big">Table: ${esc(order.tableName)}</div>` : ''}
    <div class="row muted"><span>${esc(order.invoiceNo)}</span><span>${new Date(order.createdAt).toLocaleTimeString('en-IN')}</span></div>
    <hr/>
    <table>${items}</table>
    ${order.note ? `<hr/><div class="b">Note: ${esc(order.note)}</div>` : ''}
    <hr/>
  </body></html>`;
}

/** Print an HTML document through a hidden iframe (uses the default OS printer). */
export function printHTML(html) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position: 'fixed', right: 0, bottom: 0, width: 0, height: 0, border: 0 });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    const go = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 500);
    };
    if (doc.readyState === 'complete') setTimeout(go, 150);
    else iframe.onload = go;
  });
}

/** Print bill or KOT using the branch's configured printer mode. */
export async function printOrder(order, branch, type = 'bill') {
  const mode = branch?.settings?.printer?.mode || 'browser';
  if (mode === 'network') {
    try {
      const { data } = await api.post(`/print/order/${order._id}`, { type });
      toast.success(data.message);
      return;
    } catch (e) {
      toast.error(`${errMsg(e)} — falling back to browser print`);
    }
  }
  await printHTML(type === 'kot' ? kotHTML(order, branch) : receiptHTML(order, branch));
}
