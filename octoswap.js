const { ethers } = require("ethers");
const colors = require("colors");
const prompts = require("prompts");
const fs = require("fs");
const config = require('./config');

const RPC_URL = "https://testnet-rpc.monad.xyz/";
const TX_EXPLORER = "https://testnet.monadexplorer.com/tx/";
const WALLET_FILE = "wallet.txt";
const ACCOUNT_SWITCH_DELAY = 3000;

const ROUTER_CONTRACT = "0xb6091233aAcACbA45225a2B2121BBaC807aF4255";
const WMON_CONTRACT = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const USDC_CONTRACT = "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea";
const USDT_CONTRACT = "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D";
const TEST1_CONTRACT = "0xe42cFeCD310d9be03d3F80D605251d8D0Bc5cDF3";
const TEST2_CONTRACT = "0x73c03bc8F8f094c61c668AE9833D7Ed6C04FDc21";
const DAK_CONTRACT = "0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714";

const availableTokens = {
  MON:   { name: "MON",   address: null,           decimals: 18, native: true  },
  WMON:  { name: "WMON",  address: WMON_CONTRACT,  decimals: 18, native: false },
  USDC:  { name: "USDC",  address: USDC_CONTRACT,  decimals: 6,  native: false },
  DAK:   { name: "DAK",   address: DAK_CONTRACT,   decimals: 18, native: false },
  USDT:  { name: "USDT",  address: USDT_CONTRACT,  decimals: 6,  native: false },
  TEST1: { name: "TEST1", address: TEST1_CONTRACT, decimals: 18, native: false },
  TEST2: { name: "TEST2", address: TEST2_CONTRACT, decimals: 18, native: false }
};

const ROUTER_ABI = [
  {
    "type": "function",
    "name": "getAmountsOut",
    "inputs": [
      { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
      { "internalType": "address[]", "name": "path", "type": "address[]" }
    ],
    "outputs": [
      { "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "swapExactETHForTokens",
    "inputs": [
      { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" },
      { "internalType": "address[]", "name": "path", "type": "address[]" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" }
    ],
    "outputs": [
      { "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "swapExactTokensForETH",
    "inputs": [
      { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
      { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" },
      { "internalType": "address[]", "name": "path", "type": "address[]" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" }
    ],
    "outputs": [
      { "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "swapExactTokensForTokens",
    "inputs": [
      { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
      { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" },
      { "internalType": "address[]", "name": "path", "type": "address[]" },
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" }
    ],
    "outputs": [
      { "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }
    ],
    "stateMutability": "nonpayable"
  }
];

// Utility Functions
function readPrivateKeys() {
  try {
    const data = fs.readFileSync(WALLET_FILE, 'utf8');
    return data.split('\n').map(key => key.trim()).filter(key => key !== '');
  } catch (error) {
    console.error(`❌ Could not read wallet.txt file: ${error.message}`.red);
    process.exit(1);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Swap Functions
async function performSwap(wallet, tokenA, tokenB, amountIn) {
  try {
    const routerContract = new ethers.Contract(ROUTER_CONTRACT, ROUTER_ABI, wallet);
    const deadline = Math.floor(Date.now() / 1000) + 6 * 3600;
    const path = [tokenA.native ? WMON_CONTRACT : tokenA.address, tokenB.native ? WMON_CONTRACT : tokenB.address];
    console.log(`🔄 Swap ${ethers.utils.formatUnits(amountIn, tokenA.decimals)} ${tokenA.name} → ${tokenB.name}`.magenta);

    let tx;
    if (tokenA.native) {
      tx = await routerContract.swapExactETHForTokens(0, path, wallet.address, deadline, { value: amountIn });
    } else if (tokenB.native) {
      tx = await routerContract.swapExactTokensForETH(amountIn, 0, path, wallet.address, deadline);
    } else {
      tx = await routerContract.swapExactTokensForTokens(amountIn, 0, path, wallet.address, deadline);
    }

    console.log(`🚀 Swap Tx Sent: ${TX_EXPLORER}${tx.hash}`.yellow);
    await tx.wait();
    console.log(`✅ Swap ${tokenA.name} → ${tokenB.name} complete`.green);
    return true;
  } catch (error) {
    console.error(`❌ Error swapping ${tokenA.name} → ${tokenB.name}: ${error.message}`.red);
    return false;
  }
}

// Main Execution
async function processAllAccounts(cycles) {
  const privateKeys = readPrivateKeys();
  for (const [i, key] of privateKeys.entries()) {
    const wallet = new ethers.Wallet(key, new ethers.providers.JsonRpcProvider(RPC_URL));
    console.log(`🔄 Processing wallet ${i + 1} / ${privateKeys.length}`.cyan);

    for (let cycle = 1; cycle <= cycles; cycle++) {
      await performSwap(wallet, availableTokens.MON, availableTokens.USDC, ethers.utils.parseEther("0.1"));
      await delay(ACCOUNT_SWITCH_DELAY);
    }
  }
  console.log("✅ All wallets processed".green);
}

async function run() {
  const response = await prompts([
    {
      type: 'number',
      name: 'cycles',
      message: 'How many cycles per wallet?',
      initial: 1
    }
  ]);

  await processAllAccounts(response.cycles || 1);
}

async function runAutomated(cycles = 1) {
  await processAllAccounts(cycles);
}

module.exports = { run, runAutomated };

if (require.main === module) {
  run();
}
