const ethers = require("ethers");
const colors = require("colors");
const readline = require("readline");
const fs = require("fs");
const config = require('./config');
const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const contractAddress = "0x2c9C959516e9AAEdB2C748224a41249202ca8BE7";
const gasLimitStake = 500000;
const gasLimitUnstake = 800000;

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
    const balance = await wallet.getBalance();
    const minPercentage = config.transactionLimits.minPercentage;
    const maxPercentage = config.transactionLimits.maxPercentage;
    
    const minAmount = balance.mul(min
