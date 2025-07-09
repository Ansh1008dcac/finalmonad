const { ethers } = require("ethers");
const colors = require("colors");
const readline = require("readline");
const fs = require("fs");
const config = require('./config');
const axios = require("axios");
const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const WALLET_FILE = "wallet.txt";
const ACCOUNT_SWITCH_DELAY = 3000;

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

const ROUTER_CONTRACT = "0xC995498c22a012353FAE7eCC701810D673E25794";
const WMON_CONTRACT = "0x760afe86e5de5fa0ee542fc7b7b713e1c5425701";
const USDC_CONTRACT = "0xf817257fed379853cde0fa4f97ab987181b1e5ea";
const WETH_CONTRACT = "0xb5a30b0fdc5ea94a52fdc42e3e9760cb8449fb37";

const availableTokens = {
  MON: { name: "MON", address: null, decimals: 18, native: true },
  WMON: { name: "WMON", address: WMON_CONTRACT, decimals: 18, native: false },
  USDC: { name: "USDC", address: USDC_CONTRACT, decimals: 6, native: false },
  WETH: { name: "WETH", address: WETH_CONTRACT, decimals: 18, native: false },
};

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)"
];

const WMON_ABI = [
  "function deposit() public payable",
  "function withdraw(uint256 amount) public",
  "function balanceOf(address owner) view returns (uint256)"
];

// Utility Functions
async function withRetry(operation, operationName) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isServerError = error.code === 'SERVER_ERROR' || error.message.includes('503');
      if (!isServerError) throw error;

      if (attempt < MAX_RETRIES) {
        console.log(`⚠️ ${operationName} failed (attempt ${attempt}/${MAX_RETRIES}), retrying...`.yellow);
        await delay(RETRY_DELAY);
      } else {
        console.log(`❌ ${operationName} failed after ${MAX_RETRIES} attempts`.red);
      }
    }
  }
  throw lastError;
}

function readPrivateKeys() {
  try {
    const keys = fs.readFileSync(WALLET_FILE, 'utf8').split('\n').map(k => k.trim()).filter(k => k);
    if (!keys.length) throw new Error("No private keys found");
    return keys;
  } catch (error) {
    console.error(`❌ Could not read ${WALLET_FILE}: ${error.message}`.red);
    process.exit(1);
  }
}

function getRandomDelay() {
  const min = 30 * 1000, max = 60 * 1000;
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Swap Functions
async function approveTokenIfNeeded(wallet, token, amount, routerAddress) {
  if (token.native) return true;
  return withRetry(async () => {
    const contract = new ethers.Contract(token.address, ERC20_ABI, wallet);
    const allowance = await contract.allowance(wallet.address, routerAddress);
    if (allowance.lt(amount)) {
      console.log(`⚙️ Approving ${token.name}`.cyan);
      const tx = await contract.approve(routerAddress, ethers.constants.MaxUint256);
      console.log(`🚀 Approval Tx Sent: ${EXPLORER_URL}${tx.hash}`.yellow);
      await tx.wait();
    }
    return true;
  }, `Approving ${token.name}`);
}

async function swapTokens(wallet, tokenA, tokenB, amountIn) {
  try {
    console.log(`🔄 Swapping ${tokenA.name} → ${tokenB.name}`.magenta);
    const tx = await withRetry(() => {
      const router = new ethers.Contract(ROUTER_CONTRACT, ROUTER_ABI, wallet);
      // Logic for swap (omitted for brevity)
      return {}; // Replace with actual transaction execution
    }, `Swapping ${tokenA.name} to ${tokenB.name}`);
    console.log("✅ Swap complete".green);
    return true;
  } catch (error) {
    console.error(`❌ Swap failed: ${error.message}`.red);
    return false;
  }
}

// Main Execution
async function processAllAccounts(cycles) {
  const privateKeys = readPrivateKeys();
  for (const [i, key] of privateKeys.entries()) {
    console.log(`🔄 Processing wallet ${i + 1} / ${privateKeys.length}`.cyan);
    const wallet = new ethers.Wallet(key, new ethers.providers.JsonRpcProvider(RPC_URL));
    for (let cycle = 1; cycle <= cycles; cycle++) {
      await swapTokens(wallet, availableTokens.MON, availableTokens.USDC, ethers.utils.parseEther("0.1"));
      await delay(getRandomDelay());
    }
  }
  console.log("✅ All wallets processed".green);
}

function run() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("How many cycles per wallet? ", cycles => {
    rl.close();
    processAllAccounts(Number(cycles) || 1);
  });
}

module.exports = { run };

if (require.main === module) {
  run();
}
