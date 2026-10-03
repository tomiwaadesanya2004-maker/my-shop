# Code review and implemented changes

| Original finding | Implemented change |
| --- | --- |
| Product prices and order totals were supplied by browser state. | Checkout reads the authenticated account’s database cart. A server-only transaction calculates prices and delivery from database products and snapshots order items. Browser totals, payer email and user IDs are ignored. |
| Orders were written directly from the browser with no demonstrated database policies. | Added a migration with RLS and explicit grants. Browsers can manage their own carts and profiles and read their own orders; only server credentials can create or settle orders. |
| The public email endpoint accepted arbitrary recipients and order content. | Retired that endpoint with HTTP 410. Verified payment queues a receipt from immutable database order data. |
| Confirmation appeared before payment or email delivery was verified. | Paystack hosted checkout is initialized on the server. The callback and signed webhook verify reference, amount, currency and payer email before settlement. The UI distinguishes payment received from queued email. |
| Cart logic and Supabase clients were duplicated across pages. | Introduced a shared shop provider, singleton browser client, cart page, checkout summary and persistent account carts. Guest bags merge on sign-in. |
| No order history, delivery details or durable email retries. | Added saved delivery profiles, order history, atomic payment settlement, a leased email outbox and a scheduler endpoint. |
| Scaffold metadata, emoji merchandise and minimal layout. | Added responsive storefront styling, categories, search, local SVG product illustrations, useful metadata, loading and empty states, labelled form controls and accessible quantity buttons. |

Validation: lint, TypeScript, production build and 17 mocked payment/checkout tests passed. Production HTTP checks passed for storefront, cart, checkout, payment result, orders and a product asset. Unauthenticated checkout returns 401; the old email endpoint returns 410.

The remote database migration, RLS behavior against the real project, Google console settings, actual Paystack transactions and Mailgun delivery still require service configuration and live testing. No browser was connected for visual QA. The existing prototype `orders` table is preserved; audit its legacy permissions and migrate historical data separately if needed. See [SETUP.md](SETUP.md) for activation steps and implementation limits.
