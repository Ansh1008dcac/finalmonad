const { ethers } = require("ethers");
const colors = require("colors");
const fs = require("fs");
const config = require('./config');
const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const WALLET_FILE = "wallet.txt";
const ACCOUNT_SWITCH_DELAY = 3000;

const ROUTER_CONTRACT = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";
const WMON_CONTRACT = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";
const USDC_CONTRACT = "0x62534E4bBD6D9ebAC0ac99aeaa0aa48E56372df0";
const BEAN_CONTRACT = "0x268E4E24E0051EC27b3D27A95977E71cE6875a05";
const JAI_CONTRACT = "0x70F893f65E3C1d7f82aad72f71615eb220b74D10";

const availableTokens = {
  MON: { name: "MON", address: null, decimals: 18, native: true },
  WMON: { name: "WMON", address: WMON_CONTRACT, decimals: 18, native: false },
  USDC: { name: "USDC", address: USDC_CONTRACT, decimals: 6, native: false },
  BEAN: { name: "BEAN", address: BEAN_CONTRACT, decimals: 18, native: false },
  JAI: { name: "JAI", address: JAI_CONTRACT, decimals: 6, native: false },
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

async function readPrivateKeys() {
  try {
    const data = fs.readFileSync(WALLET_FILE, 'utf8');
    const privateKeys = data.split('\n')
      .map(key => key.trim())
      .filter(key => key !== '');
    
    return privateKeys;
  } catch (error) {
    console.error(`❌ Could not read file wallet.txt: ${error.message}`.red);
    process.exit(1);
  }
}

async function processAllAccounts(cycles) {
  const privateKeys = readPrivateKeys();
  console.log(`📋 Found ${privateKeys.length} accounts in wallet.txt`.cyan);

  for (let i = 0; i < privateKeys.length; i++) {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKeys[i], provider);
    const truncatedAddress = `${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}`;
    
    console.log(`\n🔄 Processing account ${truncatedAddress}`.cyan);
    
    for (let cycle = 1; cycle <= cycles; cycle++) {
      console.log(`=== Starting cycle ${cycle}/${cycles} ===`.magenta);
      // Call the cycle logic for swapping tokens
      await performSwapCycle(wallet, cycle, cycles);

      // Delay between cycles
      if (cycle < cycles) {
        const delayTime = Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000; // Random delay between 30-60 seconds
        console.log(`⏱️ Delaying ${delayTime / 1000} seconds before the next cycle...`.cyan);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }
    }
  }
}

async function performSwapCycle(wallet, cycleNumber, totalCycles) {
  console.log(`Cycle ${cycleNumber} of ${totalCycles}:`.magenta);
  // Add your token swapping logic here, similar to the original script
  console.log("Executing token swaps...");

  // Example: Call any method from the original script (e.g., checkAndSwapToMON)
  // await checkAndSwapToMON(wallet);

  console.log(`Completed cycle ${cycleNumber}/${totalCycles}`.green);
}

async function run() {
  const randomCycles = Math.floor(Math.random() * 3) + 1; // Random cycles (1-3)
  await processAllAccounts(randomCycles);
}

module.exports = { run };
