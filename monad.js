const fs = require('fs');
const path = require('path');

// Configuration
const DAPPS_DIR = './dapps'; // Directory where individual DApp scripts are located
const MIN_RUN_INTERVAL_HOURS = 24;
const MAX_RUN_INTERVAL_HOURS = 26;
const MIN_CYCLES = 1;
const MAX_CYCLES = 3;
const MIN_DELAY_SECONDS = 5;
const MAX_DELAY_SECONDS = 50;

// Utility Functions
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Load DApp Scripts Dynamically
const loadDApps = () => {
    const dappFiles = fs.readdirSync(DAPPS_DIR).filter(file => file.endsWith('.js'));
    return dappFiles.map(file => ({
        name: file,
        path: path.join(DAPPS_DIR, file),
    }));
};

// Execute a DApp Script
const executeDApp = async (dapp, cycles) => {
    console.log(`Starting DApp: ${dapp.name} with ${cycles} cycle(s)...`);
    const dappScript = require(dapp.path);

    for (let cycle = 1; cycle <= cycles; cycle++) {
        console.log(`Cycle ${cycle} for ${dapp.name}`);
        if (typeof dappScript.run === 'function') {
            await dappScript.run();
        } else {
            console.error(`Error: ${dapp.name} does not export a 'run' function.`);
        }

        // Delay between actions
        const actionDelay = randomBetween(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS);
        console.log(`Delaying for ${actionDelay} seconds before next action...`);
        await delay(actionDelay * 1000);
    }

    console.log(`Finished DApp: ${dapp.name}`);
};

// Main Orchestrator
const orchestrateDApps = async () => {
    const dapps = loadDApps();

    while (true) {
        for (const dapp of dapps) {
            const cycles = randomBetween(MIN_CYCLES, MAX_CYCLES);
            await executeDApp(dapp, cycles);

            // Delay before next DApp
            const runInterval = randomBetween(
                MIN_RUN_INTERVAL_HOURS * 3600,
                MAX_RUN_INTERVAL_HOURS * 3600
            );
            console.log(`Delaying for ${runInterval / 3600} hours before running the next DApp...`);
            await delay(runInterval * 1000);
        }
    }
};

// Start the Orchestration
orchestrateDApps().catch(err => {
    console.error('Error in orchestrating DApps:', err);
});
