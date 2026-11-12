# Deploying BankExamsPro

Two hosts covered here. Pick by what you value:

|                          | AWS (EC2 / Lightsail VM)            | Firebase                                  |
|--------------------------|--------------------------------------|-------------------------------------------|
| Data survives restarts   | **Yes — persistent disk, no code changes** | No — needs Firestore migration first |
| Free                     | ~6 months via new-account credits (~$200), then ~$8/mo (or Lightsail ~$5/mo) | ₹0 indefinitely, but API needs Blaze (card on file) |
| Card required            | Yes (sign-up)                        | Yes (for the API, via Blaze)              |
| Effort                   | Upload + one script                  | One CLI deploy                            |

**Recommendation: AWS.** This codebase stores data in a file, and a VM is the
one kind of host where that just works — students' attempts survive restarts
and redeploys with zero migration work. Firebase is the better *eventual* home
only if you do the Firestore migration.

---

# Path 1 — AWS VM (recommended)

**The free-tier reality (changed July 2025).** New AWS accounts no longer get
the old "750 EC2 hours/month for 12 months". Instead you get **$100 in credits
at sign-up, up to $200 total, valid 6 months** — and EC2 usage draws from that
balance. A t3.micro in Mumbai plus disk and IP costs roughly $8–9/month, so
the credits cover about the full six months. **When the free plan ends, the
account closes unless you upgrade** — put a reminder in month five to upgrade
to paid (same prices, no surprise jump) or export your data. If your AWS
account predates July 15 2025, you still have the legacy 12-month tier and
t3.micro is simply free for a year.

## Launch the VM (once)

1. EC2 → Launch instance → **Ubuntu Server 24.04**, type **t3.micro**,
   region **ap-south-1 (Mumbai)**.
2. Security group: allow **22** (your IP only), **80**, **443**.
3. Create/download a key pair, launch, note the public IP.
   (Allocate an Elastic IP if you want the address to survive stops.)

## Deploy

From your machine, upload the repo and run the setup script:

```bash
rsync -az --exclude node_modules --exclude client/dist \
    ./ ubuntu@YOUR_IP:~/bankexamspro/
ssh ubuntu@YOUR_IP
cd ~/bankexamspro && sudo bash deploy/aws/setup.sh          # or: setup.sh yourdomain.com
```

The script is idempotent — run it again to redeploy. It installs Node 22 and
nginx, builds the client, **seeds only if no database exists** (redeploys never
wipe student data), generates a `JWT_SECRET` once into `/etc/bankexamspro.env`,
installs a hardened systemd service, serves the client via nginx with `/api`
proxied to Node, and adds a **daily 03:30 backup** of `db.json` keeping 14 days.

Useful afterwards:

```bash
journalctl -u bankexamspro -f        # live logs — OTP codes print here until a gateway is wired
sudo systemctl restart bankexamspro  # restart the API
ls /var/backups/bankexamspro/        # daily database backups
```

HTTPS, if you pointed a domain at the IP:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Before real candidates (AWS)

1. Wire `sendOtp()` in `server/src/routes/catalog.js` to a real SMS/email
   gateway and delete `devOtp` from the response — until then anyone can sign
   in as anyone.
2. Month-five reminder: upgrade the AWS plan or migrate, and copy
   `/var/backups/bankexamspro/` somewhere off the VM.
3. Optional: sync the daily backup to S3 (`aws s3 cp`) so a dead VM cannot
   take the data with it.

---

# Path 2 — Firebase

Read the two facts first, then pick your sub-path.

**Fact 1 — what "free" means on Firebase.** The Spark (no-card) plan can host the
**React client only**. Deploying the Node API as a Cloud Function requires the
**Blaze** plan: a credit card must be on file, but Blaze keeps the same free
quotas, so at this platform's scale the bill stays at zero. No card, no API on
Firebase — that is Google's rule, not ours.

**Fact 2 — persistence.** Cloud Functions has no durable disk. This kit bundles
the seeded database and copies it to `/tmp` on cold start, so the deployed demo
genuinely works — sign in, take a mock, see the analysis. But anything written
(new accounts, attempts, OTPs) lives only as long as that function instance.
When Google recycles it, writes are gone and the data resets to the seed.
**Ship this to show the product. Do not ship it to real candidates** — migrate
the store to Firestore first (the seam is `server/src/store.js`; Firestore's
own free quota on Spark covers this platform's traffic comfortably).

## Firebase A — everything on Firebase (needs Blaze)

One-time setup:

```bash
npm install -g firebase-tools
firebase login
firebase projects:create bankexamspro-yourname     # or use the console
cp .firebaserc.example .firebaserc                 # put your project id in it
# In the Firebase console: upgrade the project to Blaze (card required, ₹0 at this scale)
```

Every deploy:

```bash
cd server && npm run seed && cd ..        # fresh seed → bundled into the function
cd client && npm run build && cd ..       # client → client/dist
cd functions && npm install && cd ..      # first time only
firebase deploy
```

That is the whole thing. `firebase.json` already wires it: hosting serves
`client/dist`, rewrites `/api/**` to the `api` function (so the client needs no
`VITE_API_URL` — same origin), and everything else falls through to the SPA.
The predeploy hook copies `server/src` and the seeded database into `functions/`
automatically, because Firebase uploads only that folder.

The function runs in `asia-south1` (Mumbai) with `maxInstances: 2` so it cannot
run away from the free quota. First request after idle takes a few seconds
(cold start + seed copy); after that it is quick.

Set secrets if you want Claude-written insights:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

and add `secrets: ['ANTHROPIC_API_KEY']` to the `onRequest` options in
`functions/index.js`.

## Firebase B — no card at all (Spark only)

Spark can serve the static client, nothing more. Host the API elsewhere:

```bash
cd client && VITE_API_URL=https://your-api.example.com/api npm run build
firebase deploy --only hosting
```

Free API hosts without a card exist (e.g. Render's free web service runs
`npm run seed && npm start` fine), but note their free tiers also have
**ephemeral disks** — the same data-reset caveat as Path A, plus spin-down
after idle. There is no fully free host with a durable disk; durable-and-free
means the Firestore migration.

If the API is on a different origin, CORS is already open in `server/src/app.js`.

## Before real candidates (either Firebase sub-path)

1. **Migrate the store to Firestore** — the one change that makes data durable.
2. Set `JWT_SECRET` (Path A: `firebase functions:secrets:set JWT_SECRET`, then
   read it in the function options; locally it is just an env var).
3. Wire `sendOtp()` in `server/src/routes/catalog.js` to a real SMS/email
   gateway and delete `devOtp` from the response — until then, anyone can sign
   in as anyone, because the code is shown on screen.

## Local check of the exact code Functions will run

```bash
cd functions && npm install && npm run sync
firebase emulators:start --only functions,hosting
```
