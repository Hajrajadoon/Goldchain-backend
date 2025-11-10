import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bodyParser from 'body-parser';
import algosdk from 'algosdk';

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// Algorand config (TestNet)
const ALGOD_SERVER = process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || '';
const ALGOD_PORT = process.env.ALGOD_PORT || '';
const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

// Admin account mnemonic (REPLACE in .env)
const MNEMONIC = process.env.MNEMONIC || '';
let adminAccount = null;
if(MNEMONIC){
  try{
    adminAccount = algosdk.mnemonicToSecretKey(MNEMONIC);
    console.log('Algorand admin account set:', adminAccount.addr);
  }catch(e){
    console.warn('Invalid MNEMONIC format. NFT endpoints will fail until corrected.');
  }
} else {
  console.warn('MNEMONIC not provided. NFT minting disabled until set in environment.');
}

// In-memory demo stores
const users = {};
let vault = {
  total: 100000,
  locations: [
    { name: 'Vault A', grams: 50000, location: 'Dubai' },
    { name: 'Vault B', grams: 30000, location: 'Pakistan' },
    { name: 'Vault C', grams: 20000, location: 'Singapore' },
  ]
};

let basePrice = 65.0;
function randomPrice(){
  const change = (Math.random() - 0.5) * 0.4;
  basePrice = Math.max(40, basePrice + change);
  return parseFloat(basePrice.toFixed(2));
}

app.get('/', (req,res)=> res.send('Transparent Gold Financial System API'));

app.post('/auth/signup', (req,res)=>{
  const { email, password } = req.body;
  if(!email || !password) return res.status(400).json({ message: 'email and password required' });
  if(users[email]) return res.status(400).json({ message: 'user exists' });
  users[email] = { email, password, gold: 0 };
  res.json({ message: 'ok' });
});

app.post('/auth/login', (req,res)=>{
  const { email, password } = req.body;
  const u = users[email];
  if(!u || u.password !== password) return res.status(401).json({ message: 'invalid credentials' });
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

app.get('/profile', (req,res)=>{
  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({ message: 'no auth' });
  const token = auth.replace('Bearer ','');
  try{
    const data = jwt.verify(token, JWT_SECRET);
    const u = users[data.email];
    return res.json({ email: u.email, gold: u.gold });
  }catch(err){
    return res.status(401).json({ message: 'invalid token' });
  }
});

app.get('/gold-price', (req,res)=>{
  res.json({ price: randomPrice() });
});

app.get('/vault', (req,res)=>{
  res.json(vault);
});

// wait for confirmation helper
async function waitForConfirmation(algodClient, txId, timeout = 10) {
  const status = await algodClient.status().do();
  let lastRound = status['last-round'];
  for (let i = 0; i < timeout; i++) {
    const pendingInfo = await algodClient.pendingTransactionInformation(txId).do();
    if (pendingInfo && pendingInfo['confirmed-round'] && pendingInfo['confirmed-round'] > 0) {
      return pendingInfo;
    }
    await algodClient.statusAfterBlock(lastRound + 1).do();
    lastRound++;
  }
  throw new Error('Transaction not confirmed after timeout');
}

/**
 * POST /mint-nft
 * Body: { name, desc, metadataUrl }
 * Requires Authorization: Bearer <token>
 */
app.post('/mint-nft', async (req,res)=>{
  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({ message: 'no auth' });
  const token = auth.replace('Bearer ','');
  try{
    jwt.verify(token, JWT_SECRET);
    if(!adminAccount) return res.status(500).json({ message: 'Server mint account not configured (MNEMONIC missing)' });

    const { name = 'Gold Certificate', desc = '', metadataUrl = '' } = req.body;
    const params = await algodClient.getTransactionParams().do();

    const defaultFrozen = false;
    const total = 1;
    const decimals = 0;
    const unitName = 'GOLDNFT';
    const assetName = name;
    const assetURL = metadataUrl || ('https://example.com/metadata/' + Date.now());

    const managerAddr = adminAccount.addr;
    const reserveAddr = adminAccount.addr;
    const freezeAddr = adminAccount.addr;
    const clawbackAddr = adminAccount.addr;

    const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
      from: adminAccount.addr,
      total,
      decimals,
      assetName,
      unitName,
      assetURL,
      defaultFrozen,
      manager: managerAddr,
      reserve: reserveAddr,
      freeze: freezeAddr,
      clawback: clawbackAddr,
      suggestedParams: params
    });

    const signedTxn = txn.signTxn(adminAccount.sk);
    const sendTx = await algodClient.sendRawTransaction(signedTxn).do();
    const txId = sendTx.txId;
    const confirmedTxn = await waitForConfirmation(algodClient, txId, 10);

    const ptx = await algodClient.pendingTransactionInformation(txId).do();
    const assetID = ptx['asset-index'];
    const explorerUrl = `https://testnet.algoexplorer.io/asset/${assetID}`;

    return res.json({ assetId: assetID, txId, explorerUrl });
  }catch(err){
    console.error('mint-nft error:', err);
    return res.status(400).json({ message: err.message || 'mint failed' });
  }
});

app.get('/balance/:address', (req,res)=>{
  res.json({ address: req.params.address, balance: Math.floor(Math.random()*1000) });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=> console.log('Server running on', PORT));
