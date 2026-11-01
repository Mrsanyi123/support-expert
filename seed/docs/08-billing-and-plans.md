# Billing and plans

## Plans

| Plan | Price | Included events per month | Event log retention |
| --- | --- | --- | --- |
| Starter | $49 / month | 1 million | 30 days |
| Growth | $299 / month | 10 million | 30 days |
| Scale | Custom | Custom | 90 days |

Overage is billed at $0.40 per additional 10,000 events. Only live-mode events count. Each event counts once, no matter how many endpoints receive it or how many retries it needs.

## Changing plans

Upgrades take effect immediately and are **prorated**: you are charged for the remaining days of the billing period on the new plan, minus the unused time on the old plan. Downgrades take effect at the start of the next billing period.

## Invoices and payment

Invoices are issued on the first day of each billing period and are available under **Dashboard > Settings > Billing > Invoices**. We accept cards and, on annual Growth and Scale plans, bank transfer. Add a VAT or tax ID under **Billing details** before an invoice is issued for it to appear on that invoice; invoices are not reissued retroactively from the dashboard.

## Failed payments

If a payment fails we retry it 3 times over 7 days and email the billing contacts. Accounts with an unpaid invoice after 14 days are paused: API requests return `402 payment_required` and deliveries stop until the invoice is paid.

## Cancellation

You can cancel anytime from the billing page. Your plan stays active until the end of the paid period. We do not offer refunds for partial months.
