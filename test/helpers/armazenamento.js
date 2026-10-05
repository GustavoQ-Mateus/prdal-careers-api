const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'prdal-teste-storage-'));
process.env.STORAGE_DIR = pasta;
process.on('exit', () => fs.rmSync(pasta, { recursive: true, force: true }));

module.exports = { pasta };
