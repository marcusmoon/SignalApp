import { execSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const preferredDeveloperDir = '/Applications/Xcode-27.app/Contents/Developer';

function xcodebuildPath() {
  if (process.env.DEVELOPER_DIR) {
    return `${process.env.DEVELOPER_DIR}/usr/bin/xcodebuild`;
  }
  return 'xcodebuild';
}

function readXcodeVersion() {
  return execSync(`"${xcodebuildPath()}" -version`, { encoding: 'utf8' }).trim();
}

const versionText = readXcodeVersion();
const match = versionText.match(/^Xcode (\d+)\./m);

if (!match || Number(match[1]) < 27) {
  console.error(`[ios] Xcode 27+ is required for the iOS 27 SDK (active toolchain:\n${versionText}).`);
  if (fs.existsSync(preferredDeveloperDir)) {
    console.error(`[ios] Switch with: sudo xcode-select -s ${preferredDeveloperDir}`);
  } else {
    console.error('[ios] Install Xcode 27, then point xcode-select at it.');
  }
  process.exit(1);
}
