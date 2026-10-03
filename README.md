# My Shop

A Next.js shop with a responsive collection, product search and categories, cart page, delivery checkout, Google sign-in, Paystack hosted payments, order history, and Mailgun payment receipts.

## Start here

Follow [the step-by-step setup guide](docs/SETUP.md) to create the Supabase schema and configure Google Cloud, Paystack and Mailgun. Copy missing values from [.env.example](.env.example) into your local environment. Existing secrets are preserved.

```sh
npm install
npm run dev
```

## Validate

```sh
npm run lint
npm run test
npm run build
```

`npm run test` covers payment matching, ownership, failed payments, email outages and signed webhooks using mocked services. Live integrations require the database migration and credentials described in the setup guide.

## Code map

- `app/`: collection, cart, checkout, payment result and order history.
- `components/`: shared shop state, authentication, cart persistence and order summary.
- `lib/server.ts`: server-only credentials, verified bearer authentication and Paystack transport.
- `lib/payments.ts`: payment verification and leased Mailgun delivery.
- `app/api/`: checkout, verification, signed webhook and authenticated email worker.
- `supabase/migrations/001_shop.sql`: tables, RLS, atomic checkout snapshots, settlement and email outbox.
- `public/products/`: illustrative demo product artwork; replace with your actual catalog assets.

Guest bags persist locally and merge into the signed-in account. Account carts, profiles, orders, item snapshots and email jobs persist in Supabase. Currency is NGN. Configure an external scheduler for the email retry endpoint. Inventory management, refunds, fulfilment tracking and an admin dashboard are not included.
