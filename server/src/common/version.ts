import * as fs from 'fs';
import * as path from 'path';

function getAppVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    if (fs.existsSync(pkgPath)) {
      const data = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (data.version) return data.version;
    }
  } catch {
    // Fallback if filesystem read fails
  }
  return process.env.npm_package_version || '0.1.0';
}

/**
 * Single source of truth for application version across Git Pulse Server.
 */
export const APP_VERSION: string = getAppVersion();
