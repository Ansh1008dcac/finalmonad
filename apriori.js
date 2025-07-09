const ethers = require("ethers");
const colors = require("colors");
const axios = require("axios");
const fs = require("fs");
const config = require('./config');
const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const contractAddress = "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A";
const gasLimitStake = 500000;
const gasLimitUnstake = 800000;
const gasLimitClaim = 800000;

const minimalABI = [
  "function getPendingUnstakeRequests(address) view returns (uint256[] memory)",
];

function readPrivateKeys() {
  try {
    const data = fs.readFileSync('wallet.txt', 'utf8');
    const privateKeys = data.split('\n')
      .map(key => key.trim())
      .filter(key => key.length > 0);
    
    console.log(`Found ${privateKeys.length} wallets in wallet.txt`.green);
    return privateKeys;
  } catch (error) {
    console.error("❌ Could not read file wallet.txt:".red, error.message);
    process.exit(1);
  }
}

async function getRandomAmount(wallet) {
  try {
    const balance = await provider.getBalance(wallet.address);
    const minPercentage = config.transactionLimits.minPercentage;
    const maxPercentage = config.transactionLimits.maxPercentage;
    
    const min = balance.mul(minPercentage * 10).div(1000); // minPercentage% of balance
    const max = balance.mul(maxPercentage * 10).div(1000); // maxPercentage% of balance
    
    if (min.lt(ethers.utils.parseEther(config.minimumTransactionAmount))) {
      console.log("Balance too low, using minimum amount".yellow);
      return ethers.utils.parseEther(config.minimumTransactionAmount);
    }
    
    const range = max.sub(min);
    const randomBigNumber = ethers.BigNumber.from(
      ethers.utils.randomBytes(32)
    ).mod(range);
    
    const randomAmount = min.add(randomBigNumber);
    
    return randomAmount;
  } catch (error) {
    console.error("❌ Error calculating random amount:".red, error.message);
    return ethers.utils.parseEther(config.defaultTransactionAmount);
  }
}

function getRandomDelay() {
  const minDelay = 30 * 1000;
  const maxDelay = 1 * 60 * 1000;
  return Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stakeMON(wallet, cycleNumber) {
  try {
    console.log(`\n[Cycle ${cycleNumber}] starting to stake MON...`.magenta);
    console.log(`Wallet: ${wallet.address}`.cyan);

    const stakeAmount = await getRandomAmount(wallet);
    console.log(
      `Random stake amount: ${ethers.utils.formatEther(stakeAmount)} MON (1-5% balance)`
    );

    const data =
      "0x6e553f65" +
      ethers.utils.hexZeroPad(stakeAmount.toHexString(), 32).slice(2) +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2);

    const tx = {
      to: contractAddress,
      data: data,
      gasLimit: ethers.utils.hexlify(gasLimitStake),
      value: stakeAmount,
    };

    console.log("🔄 Sending stake request...");
    const txResponse = await wallet.sendTransaction(tx);
    console.log(
      `➡️  Transaction sent: ${EXPLORER_URL}${txResponse.hash}`.yellow
    );

    console.log("Waiting for transaction confirmation...");
    const receipt = await txResponse.wait();
    console.log(`✔️ Stake successful!`.green.underline);

    return { receipt, stakeAmount };
  } catch (error) {
    console.error("❌ Stake failed:".red, error.message);
    throw error;
  }
}

async function requestUnstakeAprMON(wallet, amountToUnstake, cycleNumber) {
  try {
    console.log(
      `\n[Cycle ${cycleNumber}] preparing to unstake aprMON...`.magenta
    );
    console.log(`Wallet: ${wallet.address}`.cyan);
    console.log(
      `Unstake amount: ${ethers.utils.formatEther(
        amountToUnstake
      )} aprMON`
    );

    const data =
      "0x7d41c86e" +
      ethers.utils.hexZeroPad(amountToUnstake.toHexString(), 32).slice(2) +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2) +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2);

    const tx = {
      to: contractAddress,
      data: data,
      gasLimit: ethers.utils.hexlify(gasLimitUnstake),
      value: ethers.utils.parseEther("0"),
    };

    console.log("🔄 Sending unstake request...");
    const txResponse = await wallet.sendTransaction(tx);
    console.log(
      `➡️  Transaction sent: ${EXPLORER_URL}${txResponse.hash}`.yellow
    );

    console.log("🔄 Waiting for transaction confirmation...");
    const receipt = await txResponse.wait();
    console.log(`✔️  Unstake successful!`.green.underline);

    return receipt;
  } catch (error) {
    console.error("❌ Unstake failed:".red, error.message);
    throw error;
  }
}

async function claimMON(wallet, cycleNumber) {
  try {
    console.log(`\n[Cycle ${cycleNumber}] checking claimable MON...`);
    console.log(`Wallet: ${wallet.address}`.cyan);

    const apiUrl = `https://stake-api.apr.io/withdrawal_requests?address=${wallet.address}`;
    const response = await axios.get(apiUrl);

    const claimableRequest = response.data.find(
      (request) => !request.claimed && request.is_claimable
    );

    if (!claimableRequest) {
      console.log("No claimable withdrawal requests found at this time");
      return null;
    }

    const id = claimableRequest.id;
    console.log(`Withdrawal request with ID: ${id}`);

    const data =
      "0x492e47d2" +
      "0000000000000000000000000000000000000000000000000000000000000040" +
      ethers.utils.hexZeroPad(wallet.address, 32).slice(2) +
      "0000000000000000000000000000000000000000000000000000000000000001" +
      ethers.utils
        .hexZeroPad(ethers.BigNumber.from(id).toHexString(), 32)
        .slice(2);

    const tx = {
      to: contractAddress,
      data: data,
      gasLimit: ethers.utils.hexlify(gasLimitClaim),
      value: ethers.utils.parseEther("0"),
    };

    console.log("Creating transaction...");
    const txResponse = await wallet.sendTransaction(tx);
    console.log(`Transaction sent: ${EXPLORER_URL}${txResponse.hash}`);

    console.log("Waiting for transaction confirmation...");
    const receipt = await txResponse.wait();
    console.log(`Claim successful with ID: ${id}`.green.underline);

    return receipt;
  } catch (error) {
    console.error("❌ Claim failed:".red, error.message);
    throw error;
  }
}

async function run() {
  const privateKeys = readPrivateKeys();
  const cycles = Math.floor(Math.random() * 3) + 1; // Random cycles (1-3)
  
  for (const privateKey of privateKeys) {
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`\n🔄 Processing wallet: ${wallet.address}`.cyan);
    
    for (let cycle = 1; cycle <= cycles; cycle++) {
      await stakeMON(wallet, cycle);
      const delayTime = getRandomDelay();
      console.log(`⏱️ Delaying ${delayTime / 1000} seconds...`);
      await delay(delayTime);
      await claimMON(wallet, cycle);
    }
  }
}

module.exports = { run };
