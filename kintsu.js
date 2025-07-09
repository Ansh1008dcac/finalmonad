const { ethers } = require("ethers");
const colors = require("colors");
const fs = require("fs");
const config = require('./config');

const CHAIN_CONFIG = {
  RPC_URL: "https://testnet-rpc.monad.xyz",
  CHAIN_ID: 10143,
  SYMBOL: "MON",
  TX_EXPLORER: "https://testnet.monadexplorer.com/tx/",
  ADDRESS_EXPLORER: "https://testnet.monadexplorer.com/address/",
  WMON_ADDRESS: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701"
};

const KINTSU_CONTRACT = {
  SMON_STAKE_CONTRACT: "0x07AabD925866E8353407E67C1D157836f7Ad923e",
  KINTSU_ABI: [
    {
      name: "stake",
      type: "function",
      stateMutability: "payable",
      inputs: [],
      outputs: []
    },
    {
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ type: "uint256" }]
    },
    {
      name: "decreaseStake",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "tokenId", type: "uint256" },
        { name: "stakeAmount", type: "uint256" }
      ],
      outputs: []
    }
  ]
};

const provider = new ethers.providers.JsonRpcProvider(CHAIN_CONFIG.RPC_URL);
const contractAddress = KINTSU_CONTRACT.SMON_STAKE_CONTRACT;

function readPrivateKeys() {
  try {
    const fileContent = fs.readFileSync("wallet.txt", "utf8");
    const privateKeys = fileContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (privateKeys.length === 0) {
      console.error("No private keys found in wallet.txt".red);
      process.exit(1);
    }
    return privateKeys;
  } catch (error) {
    console.error("Unable to read wallet.txt file:".red, error.message);
    process.exit(1);
  }
}

async function getRandomAmount(wallet) {
  try {
    const minAmount = ethers.utils.parseEther("0.05");
    const maxAmount = ethers.utils.parseEther("0.1");
    const range = maxAmount.sub(minAmount);
    const randomAmount = minAmount.add(ethers.BigNumber.from(ethers.utils.randomBytes(4)).mod(range.add(1)));
    console.log(`Amount of MON to use: ${ethers.utils.formatEther(randomAmount)} ${CHAIN_CONFIG.SYMBOL}`);
    return randomAmount;
  } catch (error) {
    console.error("Error calculating random amount:".red, error.message);
    return ethers.utils.parseEther("0.01");
  }
}

function getRandomDelay() {
  const minDelay = 30 * 1000;
  const maxDelay = 2 * 60 * 1000;
  return Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function stakeMON(wallet, cycleNumber) {
  try {
    console.log(`\n[Cycle ${cycleNumber}] Starting to stake MON...`.magenta);
    const contract = new ethers.Contract(contractAddress, KINTSU_CONTRACT.KINTSU_ABI, wallet);
    const stakeAmount = await getRandomAmount(wallet);
    const txResponse = await contract.stake({ value: stakeAmount });
    console.log(`Transaction sent: ${CHAIN_CONFIG.TX_EXPLORER}${txResponse.hash}`.yellow);
    await txResponse.wait();
    console.log(`✔️ Stake successful!`.green.underline);
    return stakeAmount;
  } catch (error) {
    console.error("❌ Stake failed:".red, error.message);
    throw error;
  }
}

async function unStake(wallet, tokenId, stakeAmount, cycleNumber) {
  try {
    console.log(`\n[Cycle ${cycleNumber}] Starting unstake...`.magenta);
    const contract = new ethers.Contract(contractAddress, KINTSU_CONTRACT.KINTSU_ABI, wallet);
    const stakeBalance = await contract.balanceOf(await wallet.getAddress());
    if (stakeBalance.isZero()) {
      console.log(`No balance to unstake.`.yellow);
      return null;
    }
    const txResponse = await contract.decreaseStake(tokenId, stakeAmount);
    console.log(`Transaction sent: ${CHAIN_CONFIG.TX_EXPLORER}${txResponse.hash}`.yellow);
    await txResponse.wait();
    console.log(`✔️ Unstake successful!`.green.underline);
  } catch (error) {
    console.error("❌ Unstake failed:".red, error.message);
    throw error;
  }
}

async function processWallet(privateKey, cycles, tokenId) {
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    for (let i = 0; i < cycles; i++) {
      await stakeMON(wallet, i + 1);
      const delayTime = getRandomDelay();
      console.log(`Waiting ${delayTime / 1000} seconds before unstaking...`);
      await delay(delayTime);
      await unStake(wallet, tokenId, ethers.utils.parseEther("0.1"), i + 1);
    }
  } catch (error) {
    console.error(`Error processing wallet: ${error.message}`.red);
  }
}

async function run() {
  console.log("Starting Kintsu script...".green);
  const privateKeys = readPrivateKeys();
  for (const privateKey of privateKeys) {
    await processWallet(privateKey, 1, 1);
  }
  console.log(`All wallets processed successfully!`.green.bold);
}

module.exports = { run, stakeMON, unStake, getRandomAmount, getRandomDelay };

if (require.main === module) {
  run();
}
