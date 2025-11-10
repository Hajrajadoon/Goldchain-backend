# goldchain-backend

Demo backend for **Transparent Gold Financial System** with Algorand TestNet NFT minting.

## What it includes
- Signup / Login (JWT, in-memory demo)
- /gold-price endpoint returning mock real-time gold price (USD per gram)
- /vault endpoint returning mock vault details
- /mint-nft endpoint that creates a single-copy ASA (NFT) on Algorand TestNet using a server mnemonic (for demo)

## Important: MNEMONIC & Security
- This demo requires a **TestNet account mnemonic** for the server to create assets.
- **Never commit your `.env` file or mnemonic to a public repo.**
- Use Render/Railway environment variables to set `MNEMONIC` securely.

## Setup (local)
1. Install:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and set `JWT_SECRET` and `MNEMONIC`.
3. Start server:
   ```
   node server.js
   ```

## Deploy (Render)
1. Push repo to GitHub.
2. Create a new Web Service on Render and connect the repo.
3. Set the environment variables in Render (JWT_SECRET, MNEMONIC, ALGOD_SERVER).
4. Deploy and use the Render URL as `VITE_BACKEND_URL` in frontend Netlify settings.

## Algorand notes
- Use TestNet and fund the account from the Algorand TestNet dispenser.
- For production, use secure signing (KMS/hardware wallets) and consider multisig.
