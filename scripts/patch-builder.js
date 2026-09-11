const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes('if ((0, macosVersion_1.isMacOsCatalina)()) {')) {
    content = content.replace(
      'if ((0, macosVersion_1.isMacOsCatalina)()) {',
      'if (true) { // Windows 11 NSIS UninstallerReader patch'
    );
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-builder] Successfully applied UninstallerReader patch to NsisTarget.js');
  }
}
