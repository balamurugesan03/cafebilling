import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, Printer, Receipt, Percent, Gift, Store, Wifi, Monitor, Eye } from 'lucide-react';
import api, { toastErr } from '../api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, NeedBranch, Field, Toggle, Modal } from '../components/ui';
import { printHTML, receiptHTML, kotHTML } from '../utils/print';

const SAMPLE = {
  invoiceNo: 'BB-DEMO-00001',
  tokenNo: 12,
  orderType: 'dine-in',
  tableName: 'T4',
  customerName: 'Anand',
  customerPhone: '9840012345',
  cashierName: 'Cashier',
  createdAt: new Date(),
  status: 'completed',
  items: [
    { name: 'Cappuccino', variant: 'Large', qty: 2, price: 190, total: 380, notes: 'Less sugar' },
    { name: 'Chocolate Brownie', qty: 1, price: 120, total: 120 },
  ],
  subTotal: 500,
  discountAmount: 50,
  discountType: 'flat',
  taxAmount: 22.5,
  roundOff: 0.5,
  grandTotal: 473,
  payments: [{ method: 'cash', amount: 500 }],
  changeDue: 27,
  pointsEarned: 9,
};

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card p-6">
      <h3 className="font-bold text-espresso-900 flex items-center gap-2 mb-5">
        <Icon size={18} className="text-amber-600" /> {title}
      </h3>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { isAllBranches, currentBranch, loadBranches } = useAuth();
  const [b, setB] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (currentBranch) setB(JSON.parse(JSON.stringify(currentBranch)));
  }, [currentBranch]);

  if (isAllBranches) return <NeedBranch what="settings" />;
  if (!b) return null;

  const s = b.settings;
  const p = s.printer;
  const setS = (k, v) => setB({ ...b, settings: { ...s, [k]: v } });
  const setP = (k, v) => setB({ ...b, settings: { ...s, printer: { ...p, [k]: v } } });

  const save = async () => {
    setBusy(true);
    try {
      const { invoiceSeq, createdAt, updatedAt, __v, ...body } = b;
      await api.put(`/branches/${b._id}`, body);
      await loadBranches();
      toast.success('Settings saved');
    } catch (e) {
      toastErr(e);
    } finally {
      setBusy(false);
    }
  };

  const testNetwork = async (target) => {
    try {
      const { data } = await api.post('/print/test', { target, printer: p });
      toast.success(data.message);
    } catch (e) {
      toastErr(e);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle={b.name}>
        <button className="btn-primary" onClick={save} disabled={busy}>
          <Save size={16} /> Save changes
        </button>
      </PageHeader>

      <div className="grid xl:grid-cols-2 gap-6">
        <Section icon={Store} title="Branch details (printed on bill)">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Display name" className="col-span-2">
              <input className="input" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} />
            </Field>
            <Field label="Address" className="col-span-2">
              <input className="input" value={b.address} onChange={(e) => setB({ ...b, address: e.target.value })} />
            </Field>
            <Field label="City">
              <input className="input" value={b.city} onChange={(e) => setB({ ...b, city: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className="input" value={b.phone} onChange={(e) => setB({ ...b, phone: e.target.value })} />
            </Field>
            <Field label="GSTIN">
              <input className="input" value={b.gstin} onChange={(e) => setB({ ...b, gstin: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Invoice prefix">
              <input className="input" value={s.invoicePrefix} onChange={(e) => setS('invoicePrefix', e.target.value.toUpperCase())} />
            </Field>
          </div>
        </Section>

        <Section icon={Percent} title="Tax & currency">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Tax label">
              <input className="input" value={s.taxLabel} onChange={(e) => setS('taxLabel', e.target.value)} />
            </Field>
            <Field label="Default tax %">
              <input className="input" type="number" step="0.01" value={s.taxRate} onChange={(e) => setS('taxRate', Number(e.target.value))} />
            </Field>
            <Field label="Currency symbol">
              <input className="input" value={s.currency} onChange={(e) => setS('currency', e.target.value)} />
            </Field>
          </div>
          <div className="mt-5">
            <Toggle checked={s.taxInclusive} onChange={(v) => setS('taxInclusive', v)} label="Menu prices already include tax (inclusive)" />
          </div>
          <p className="text-xs text-stone-500 mt-3">Individual products can override the tax rate from the Menu page.</p>
        </Section>

        <Section icon={Gift} title="Loyalty program">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Points earned (% of bill)">
              <input className="input" type="number" step="0.1" value={s.loyaltyEarnPercent} onChange={(e) => setS('loyaltyEarnPercent', Number(e.target.value))} />
            </Field>
            <Field label="Value of 1 point">
              <input className="input" type="number" step="0.01" value={s.pointValue} onChange={(e) => setS('pointValue', Number(e.target.value))} />
            </Field>
          </div>
          <p className="text-xs text-stone-500 mt-3">
            Example: a {s.currency}500 bill earns {Math.floor((500 * s.loyaltyEarnPercent) / 100)} points worth {s.currency}
            {(Math.floor((500 * s.loyaltyEarnPercent) / 100) * s.pointValue).toFixed(2)}.
          </p>
        </Section>

        <Section icon={Receipt} title="Receipt text">
          <Field label="Header line (under address)">
            <input className="input" value={s.receiptHeader} onChange={(e) => setS('receiptHeader', e.target.value)} />
          </Field>
          <Field label="Footer message" className="mt-4">
            <textarea className="input" rows={2} value={s.receiptFooter} onChange={(e) => setS('receiptFooter', e.target.value)} />
          </Field>
          <div className="flex gap-2 mt-4">
            <button className="btn-outline btn-sm" onClick={() => setPreview(receiptHTML(SAMPLE, b))}>
              <Eye size={14} /> Preview bill
            </button>
            <button className="btn-outline btn-sm" onClick={() => setPreview(kotHTML(SAMPLE, b))}>
              <Eye size={14} /> Preview KOT
            </button>
          </div>
        </Section>

        <div className="xl:col-span-2">
          <Section icon={Printer} title="Printer setup">
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {[
                ['browser', Monitor, 'USB / Bluetooth / System printer', 'Prints through the browser to any printer installed on this PC (thermal 58/80mm, A4). Tip: set the thermal printer as default and launch Chrome with --kiosk-printing for silent one-click printing.'],
                ['network', Wifi, 'Network (LAN / WiFi) thermal printer', 'Sends raw ESC/POS commands from the server to the printer IP on port 9100. Supports separate kitchen printer for KOT and auto cash-drawer kick.'],
              ].map(([k, Icon, t, d]) => (
                <button key={k} onClick={() => setP('mode', k)} className={`text-left rounded-2xl border-2 p-4 transition ${p.mode === k ? 'border-amber-500 bg-amber-50' : 'border-stone-200 hover:border-stone-300'}`}>
                  <p className="font-bold flex items-center gap-2">
                    <Icon size={18} /> {t}
                  </p>
                  <p className="text-xs text-stone-600 mt-1">{d}</p>
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <Field label="Paper width">
                <select className="input" value={p.paperWidth} onChange={(e) => setP('paperWidth', Number(e.target.value))}>
                  <option value={80}>80 mm (3 inch)</option>
                  <option value={58}>58 mm (2 inch)</option>
                </select>
              </Field>
              {p.mode === 'network' && (
                <>
                  <Field label="Bill printer IP">
                    <div className="flex gap-2">
                      <input className="input" placeholder="192.168.1.100" value={p.ip} onChange={(e) => setP('ip', e.target.value)} />
                      <input className="input w-24" type="number" value={p.port} onChange={(e) => setP('port', Number(e.target.value))} />
                    </div>
                  </Field>
                  <Field label="Kitchen (KOT) printer IP">
                    <div className="flex gap-2">
                      <input className="input" placeholder="blank = same as bill" value={p.kotIp} onChange={(e) => setP('kotIp', e.target.value)} />
                      <input className="input w-24" type="number" value={p.kotPort} onChange={(e) => setP('kotPort', Number(e.target.value))} />
                    </div>
                  </Field>
                  <div className="flex items-end gap-2">
                    <button className="btn-outline btn-sm" onClick={() => testNetwork('bill')} disabled={!p.ip}>
                      Test bill printer
                    </button>
                    <button className="btn-outline btn-sm" onClick={() => testNetwork('kot')} disabled={!p.kotIp}>
                      Test KOT
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-8 mt-6">
              <Toggle checked={p.autoPrintBill} onChange={(v) => setP('autoPrintBill', v)} label="Auto-print bill after payment" />
              <Toggle checked={p.autoPrintKOT} onChange={(v) => setP('autoPrintKOT', v)} label="Auto-print KOT for direct sales" />
              <Toggle checked={p.showLogo} onChange={(v) => setP('showLogo', v)} label="Show logo on bill" />
            </div>
            {p.mode === 'browser' && (
              <button className="btn-outline mt-6" onClick={() => printHTML(receiptHTML(SAMPLE, b))}>
                <Printer size={16} /> Print test receipt
              </button>
            )}
          </Section>
        </div>
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Print preview" size="sm">
        <div className="bg-stone-100 rounded-xl p-4 flex justify-center">
          <iframe title="preview" srcDoc={preview || ''} className="bg-white shadow" style={{ width: p.paperWidth === 58 ? 240 : 320, height: 560, border: 0 }} />
        </div>
      </Modal>
    </div>
  );
}
