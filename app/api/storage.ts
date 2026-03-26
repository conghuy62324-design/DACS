import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

function ensureDataDir() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
  } catch {
    // ignore
  }
}

export function readData<T>(fileName: string, defaultValue: T): T {
  ensureDataDir();
  const filePath = path.join(dataDir, fileName);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    try {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    } catch {
      // ignore
    }
    return defaultValue;
  }
}

export function writeData<T>(fileName: string, data: T) {
  ensureDataDir();
  const filePath = path.join(dataDir, fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch {
    // ignore
  }
}
