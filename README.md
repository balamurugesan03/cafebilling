# ☕ BrewBill — Multi-Branch Coffee Shop Billing (MERN)

React + Vite + Tailwind frontend · Node/Express + MongoDB backend.

## Quick start

```bash
# 1. Start MongoDB (Windows: run "net start MongoDB" in an Admin terminal)
# 2. Install everything
npm run install:all
# 3. Load demo data (3 branches, staff, menu, 30 days of sales)
npm run seed
# 4. Run API (5000) + web app (5173)
npm run dev
```

Open http://localhost:5173

| Role        | Email                     | Password |
|-------------|---------------------------|----------|
| Super Admin | admin@brewbill.com        | admin123 |
| Manager     | manager.ann@brewbill.com  | 123456   |
| Cashier     | cashier.ann@brewbill.com  | 123456   |
| Kitchen     | kitchen.ann@brewbill.com  | 123456   |

(`.tnr` and `.cbe` accounts exist for the other two branches.)

> Running the seed **wipes the database**. Change the passwords and `JWT_SECRET` in `server/.env` before going live.

## Modules

- **Super Admin head-office dashboard**: totals for all branches, growth vs the previous period, sales trend per branch, revenue share, a ranked branch table (sales, average bill, expenses, net, low stock, cancellations), top items, payment split, and a live feed of bills. Click a branch to open its dashboard.
- **Branch dashboard**: today's sales compared with yesterday, hourly sales, last 7 days, best sellers, payment split, held orders, kitchen queue, low-stock alerts, and month to date.
- **Branch switcher**: the super admin can switch between "All Branches" and any single branch. Other users only see their own branch, and the server enforces this.
- **POS billing**:
  - Order types: dine-in (with tables), takeaway, delivery.
  - Item options: variants and sizes, item notes (e.g. "less sugar").
  - Discounts: flat or percentage.
  - Loyalty: look up the customer by phone and redeem points.
  - Orders: hold or run orders and send KOTs.
  - Payment: cash with change calculation, UPI, card, or split payment.
  - Shortcuts: F2 to search, F9 to pay.
- **Kitchen display (KDS)**: New, Preparing and Ready columns, a timer per order, a sound alert for new orders, and fullscreen mode.
- **Orders**: filter, search, view, reprint the bill or KOT, cancel (manager only; this restores stock and reverses loyalty points), and export to CSV.
- **Menu**:
  - Categories with an icon, colour and sort order.
  - Products with variants, a tax override, veg/non-veg flag, cost price, and an availability toggle.
  - Recipes, so selling a product deducts its ingredients from stock.
  - The super admin can copy the menu from one branch to another.
- **Inventory**: stock in, stock out (wastage) and stock audit; a movement log; low-stock alerts; total stock value.
- **Tables**: a live floor view by area. A table is marked occupied automatically while it has a running order.
- **Customers and loyalty**: one customer list shared by all branches, with Gold/Silver tiers, order history and CSV export.
- **Expenses**: recorded by category per branch, with date filters and export.
- **Reports**: summary plus item, category, day, payment, cashier, hour, branch and expense breakdowns. Each table exports to CSV, and a thermal Z-report can be printed.
- **Staff**: roles are Super Admin, Manager, Cashier and Kitchen. Accounts can be enabled or disabled.
- **Settings**: per branch. GST rate (inclusive or exclusive), invoice prefix, receipt header and footer, loyalty rules, and printer setup.

## Printing

Choose the printer mode per branch in **Settings & Printer**:

1. **Browser / USB / Bluetooth**: prints receipts sized for 80 mm or 58 mm paper on any printer installed in Windows.
   - For silent one-click printing, make the thermal printer the default and start Chrome with
     `chrome.exe --kiosk-printing http://localhost:5173`
2. **Network (LAN/WiFi)**: the server sends raw ESC/POS commands to `printer-ip:9100`.
   - You can set a separate kitchen printer for KOTs.
   - The cash drawer opens automatically for cash payments.
   - Use the test-print buttons to check the setup.

## Production

```bash
npm run build      # builds client/dist
npm start          # Express serves the API and the built app on :5000
```
