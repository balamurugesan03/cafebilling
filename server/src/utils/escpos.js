import net from 'net';

/**
 * Minimal ESC/POS builder for network thermal printers (Epson / TVS / Xprinter / Rugtek etc.)
 * Sends raw bytes to <ip>:9100 — no driver needed.
 */
const ESC = '\x1b';
const GS = '\x1d';

class Receipt {
  constructor(width = 80) {
    this.cols = width === 58 ? 32 : 48;
    this.parts = [ESC + '@']; // init
  }
  raw(s) { this.parts.push(s); return this; }
  align(a) { return this.raw(ESC + 'a' + String.fromCharCode({ left: 0, center: 1, right: 2 }[a] ?? 0)); }
  bold(on) { return this.raw(ESC + 'E' + (on ? '\x01' : '\x00')); }
  size(w = 1, h = 1) { return this.raw(GS + '!' + String.fromCharCode(((w - 1) << 4) | (h - 1))); }
  line(s = '') { return this.raw(s + '\n'); }
  hr(ch = '-') { return this.line(ch.repeat(this.cols)); }
  cols2(left, right) {
    left = String(left); right = String(right);
    const space = Math.max(1, this.cols - left.length - right.length);
    if (left.length + right.length >= this.cols) return this.line(left).line(' '.repeat(Math.max(0, this.cols - right.length)) + right);
    return this.line(left + ' '.repeat(space) + right);
  }
  row(cells, widths) {
    const out = cells.map((c, i) => {
      const s = String(c);
      const w = widths[i];
      return i === 0 ? s.slice(0, w).padEnd(w) : s.slice(0, w).padStart(w);
    });
    return this.line(out.join(''));
  }
  feed(n = 3) { return this.raw(ESC + 'd' + String.fromCharCode(n)); }
  cut() { return this.raw(GS + 'V' + '\x41' + '\x03'); }
  drawer() { return this.raw(ESC + 'p' + '\x00' + '\x19' + '\xfa'); }
  buffer() { return Buffer.from(this.parts.join(''), 'latin1'); }
}

// Thermal printers' default code page has no ₹ — use "Rs."
const money = (n) => Number(n || 0).toFixed(2);
const ascii = (s = '') => String(s).replace(/₹/g, 'Rs.').replace(/[^\x20-\x7E\n]/g, '');

export function buildBill(order, branch) {
  const s = branch.settings || {};
  const r = new Receipt(s.printer?.paperWidth || 80);
  const W = r.cols;
  const nameW = W - 22;

  r.align('center').bold(true).size(2, 2).line(ascii(branch.name)).size(1, 1).bold(false);
  if (branch.address) r.line(ascii(branch.address));
  if (branch.phone) r.line(`Ph: ${branch.phone}`);
  if (branch.gstin) r.line(`GSTIN: ${branch.gstin}`);
  if (s.receiptHeader) r.line(ascii(s.receiptHeader));
  r.hr('=').bold(true).line(order.status === 'cancelled' ? '*** CANCELLED ***' : 'TAX INVOICE').bold(false).align('left');
  r.cols2(`Bill: ${order.invoiceNo}`, `Token: ${order.tokenNo || '-'}`);
  r.cols2(new Date(order.createdAt).toLocaleString('en-IN'), order.orderType.toUpperCase());
  if (order.tableName) r.line(`Table: ${ascii(order.tableName)}`);
  if (order.customerPhone) r.line(`Customer: ${ascii(order.customerName || '')} ${order.customerPhone}`);
  r.line(`Cashier: ${ascii(order.cashierName || '')}`);
  r.hr();
  r.bold(true).row(['Item', 'Qty', 'Rate', 'Amt'], [nameW, 5, 8, 9]).bold(false);
  r.hr();
  for (const it of order.items) {
    const name = ascii(it.name + (it.variant ? ` (${it.variant})` : ''));
    r.row([name, it.qty, money(it.price), money(it.total)], [nameW, 5, 8, 9]);
    if (name.length > nameW) r.line('  ' + name.slice(nameW));
  }
  r.hr();
  r.cols2('Sub Total', money(order.subTotal));
  if (order.discountAmount) r.cols2(`Discount${order.discountType === 'percent' ? ` (${order.discountValue}%)` : ''}`, '-' + money(order.discountAmount));
  r.cols2(`${s.taxLabel || 'Tax'}${order.taxInclusive ? ' (incl.)' : ''}`, money(order.taxAmount));
  if (order.pointsValue) r.cols2(`Points redeemed (${order.pointsRedeemed})`, '-' + money(order.pointsValue));
  if (order.roundOff) r.cols2('Round off', money(order.roundOff));
  r.hr('=').bold(true).size(1, 2).cols2('TOTAL', 'Rs.' + money(order.grandTotal)).size(1, 1).bold(false).hr('=');
  for (const p of order.payments || []) r.cols2(`Paid (${p.method.toUpperCase()})`, money(p.amount));
  if (order.changeDue) r.cols2('Change', money(order.changeDue));
  if (order.pointsEarned) r.line(`Points earned: ${order.pointsEarned}`);
  r.align('center').line('').line(ascii(s.receiptFooter || 'Thank you!'));
  r.feed(4).cut();
  if ((order.payments || []).some((p) => p.method === 'cash')) r.drawer();
  return r.buffer();
}

export function buildKOT(order, branch) {
  const r = new Receipt(branch.settings?.printer?.paperWidth || 80);
  r.align('center').bold(true).size(2, 2).line('KOT').size(1, 1).line(ascii(branch.name)).bold(false);
  r.hr('=').align('left');
  r.bold(true).size(1, 2).cols2(`Token #${order.tokenNo || '-'}`, order.orderType.toUpperCase()).size(1, 1).bold(false);
  if (order.tableName) r.bold(true).line(`Table: ${ascii(order.tableName)}`).bold(false);
  r.line(`${order.invoiceNo}   ${new Date(order.createdAt).toLocaleTimeString('en-IN')}`);
  r.hr();
  for (const it of order.items) {
    r.bold(true).size(1, 2).line(`${it.qty} x ${ascii(it.name)}${it.variant ? ` (${ascii(it.variant)})` : ''}`).size(1, 1).bold(false);
    if (it.notes) r.line(`   >> ${ascii(it.notes)}`);
  }
  if (order.note) r.hr().line(`Note: ${ascii(order.note)}`);
  r.hr().feed(4).cut();
  return r.buffer();
}

export function buildTest(branch) {
  const r = new Receipt(branch.settings?.printer?.paperWidth || 80);
  r.align('center').bold(true).size(2, 2).line('BrewBill').size(1, 1).bold(false).line(ascii(branch.name)).hr().line('Printer test OK').line(new Date().toLocaleString('en-IN')).feed(4).cut();
  return r.buffer();
}

export function sendToPrinter(ip, port, data, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (!ip) return reject(new Error('Printer IP not configured in Settings'));
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Printer ${ip}:${port} not reachable`));
    }, timeout);
    socket.connect(port || 9100, ip, () => {
      socket.write(data, () => {
        clearTimeout(timer);
        socket.end();
        resolve();
      });
    });
    socket.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`Printer error: ${e.message}`));
    });
  });
}
