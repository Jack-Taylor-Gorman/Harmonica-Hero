const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CSV_FILE = 'PDMX.csv';
const OUTPUT_DIR = 'temp/pdmx_downloads';
const TARGET_COUNT = 10;
const TIMEOUT_MS = 60000; // 60s timeout

// Gateways
const GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://cf-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://4everland.io/ipfs/',
    'https://w3s.link/ipfs/'
];

// Helper: Fetch with timeout and user-agent
async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' } // sometimes helps
        });
        clearTimeout(id);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

async function downloadFile(hash, filename) {
    console.log(` Attempting ${filename} (${hash})...`);

    // Race all gateways? Or sequence? 
    // Sequence is safer for rate limits, but race is faster for finding a live one.
    // Let's try racing groups of 3.

    for (const gateway of GATEWAYS) {
        const url = `${gateway}${hash}`;
        // console.log(`   Trying ${gateway}...`);

        try {
            const res = await fetchWithTimeout(url);
            // Verify content type? 
            // const type = res.headers.get('content-type');
            // if (type && !type.includes('xml') && !type.includes('text') && !type.includes('application/octet-stream')) {
            //      throw new Error(`Invalid content-type: ${type}`);
            // }

            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Basic sanity check: is it XML?
            const start = buffer.subarray(0, 100).toString('utf8');
            if (start.includes('<?xml') || start.includes('<score-partwise')) {
                fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);
                console.log(`   SUCCESS via ${gateway}`);
                return true;
            } else {
                throw new Error("Content likely not XML");
            }

        } catch (err) {
            // console.log(`   Failed ${gateway}: ${err.message}`);
        }
    }

    console.log(`   FAILED all gateways.`);
    return false;
}

async function main() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log("Reading CSV...");
    const samples = [];
    let count = 0;

    const fileStream = fs.createReadStream(CSV_FILE);
    const rl = require('readline').createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let header = null;

    for await (const line of rl) {
        if (!header) {
            header = line.split(',');
            continue;
        }

        count++;
        // Reservoir sampling
        if (samples.length < TARGET_COUNT * 2) { // Pick pool of 20
            samples.push(line);
        } else {
            const r = Math.floor(Math.random() * count);
            if (r < TARGET_COUNT * 2) {
                samples[r] = line;
            }
        }
    }

    console.log(`Selected candidate pool from ${count} entries.`);

    let successes = 0;

    for (const rowStr of samples) {
        if (successes >= TARGET_COUNT) break;

        try {
            // naive split handles simple cases
            // PDMX has quotes? 
            // Let's assume naive split by comma is risky but likely okay for col 2 (path)
            // But title might have commas.
            // Better to use csv-parse on line.

            const records = parse(rowStr, { columns: false });
            const row = records[0];

            /* 
               Header: 
               0: path
               1: metadata
               2: mxl -> ./mxl/1/11/Hash.mxl
               27: song_name
            */
            const mxlPath = row[2];
            let title = row[27] || "Unknown";

            if (!mxlPath || !mxlPath.endsWith('.mxl')) continue;

            const filename = path.basename(mxlPath);
            const hash = filename.replace('.mxl', '');

            // Clean title
            title = title.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50);

            const downloaded = await downloadFile(hash, `${title}_${hash}.xml`); // Save as .xml

            if (downloaded) {
                successes++;
            }

        } catch (e) {
            console.error("Parse error", e);
        }
    }

    console.log(`Done. Downloaded ${successes} files.`);
}

main();
