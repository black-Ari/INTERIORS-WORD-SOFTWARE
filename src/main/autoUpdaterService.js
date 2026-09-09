import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { spawn } from 'child_process';

const GITHUB_REPO = 'black-Ari/INTERIORS-WORD-SOFTWARE';

function compareVersions(v1, v2) {
  const clean1 = (v1 || '').replace(/^[vV]/, '').trim();
  const clean2 = (v2 || '').replace(/^[vV]/, '').trim();

  const parts1 = clean1.split('.').map(Number);
  const parts2 = clean2.split('.').map(Number);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'INTERIORS-WORD-AutoUpdater/3.1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      },
      (res) => {
        // Handle redirect
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchJson(res.headers.location).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode === 404) {
          resolve(null);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${e.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Update check request timed out after 15s'));
    });
  });
}

class AutoUpdaterService {
  constructor({ onUpdateAvailable, onUpdateProgress, onUpdateDownloaded } = {}) {
    this.onUpdateAvailable = onUpdateAvailable;
    this.onUpdateProgress = onUpdateProgress;
    this.onUpdateDownloaded = onUpdateDownloaded;

    this.downloading = false;
    this.downloadedFilePath = null;
    this.latestReleaseInfo = null;
  }

  async checkForUpdates(currentVersion = app.getVersion()) {
    try {
      const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
      const release = await fetchJson(url);

      if (!release || !release.tag_name) {
        return { hasUpdate: false, message: 'You are running the latest version.' };
      }

      const tagVer = (release.tag_name || '').replace(/^[vV]/, '').trim();
      const nameMatch = (release.name || '').match(/\b\d+(\.\d+)+\b/);
      const nameVer = nameMatch ? nameMatch[0] : '';
      const targetVer = (nameVer && compareVersions(nameVer, tagVer) > 0) ? nameVer : tagVer;

      const isNewer = compareVersions(targetVer, currentVersion) > 0;
      if (!isNewer) {
        return {
          hasUpdate: false,
          currentVersion,
          latestVersion: targetVer,
          message: 'You are on the latest version.',
        };
      }

      // Find Windows executable asset
      const assets = release.assets || [];
      const exeAsset = assets.find((a) => a.name.toLowerCase().endsWith('.exe')) || assets[0];

      const info = {
        hasUpdate: true,
        version: release.tag_name,
        name: release.name || `INTERIORS WORD ${release.tag_name}`,
        notes: release.body || 'Performance enhancements and bug fixes.',
        publishedAt: release.published_at,
        downloadUrl: exeAsset?.browser_download_url || null,
        fileName: exeAsset?.name || 'INTERIORS_WORD_Update.exe',
        fileSize: exeAsset?.size || 0,
      };

      this.latestReleaseInfo = info;
      this.onUpdateAvailable?.(info);
      return info;
    } catch (err) {
      console.warn('Update check failed:', err.message);
      return { hasUpdate: false, error: err.message };
    }
  }

  downloadUpdate(downloadUrl, onProgress) {
    if (this.downloading) {
      throw new Error('An update download is already in progress.');
    }

    const urlToDownload = downloadUrl || this.latestReleaseInfo?.downloadUrl;
    if (!urlToDownload) {
      throw new Error('No update download URL available.');
    }

    this.downloading = true;
    const tempDir = app.getPath('temp');
    const targetPath = path.join(tempDir, this.latestReleaseInfo?.fileName || 'INTERIORS_WORD_Update.exe');

    return new Promise((resolve, reject) => {
      const downloadFile = (currentUrl) => {
        const parsed = new URL(currentUrl);
        const client = parsed.protocol === 'https:' ? https : http;

        const req = client.get(
          currentUrl,
          {
            headers: {
              'User-Agent': 'INTERIORS-WORD-AutoUpdater/3.1.0',
            },
          },
          (res) => {
            // Handle HTTP 301, 302, 307 redirects (AWS S3)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              downloadFile(res.headers.location);
              return;
            }

            if (res.statusCode !== 200) {
              this.downloading = false;
              reject(new Error(`Failed to download update: HTTP ${res.statusCode}`));
              return;
            }

            const totalBytes = parseInt(res.headers['content-length'], 10) || this.latestReleaseInfo?.fileSize || 0;
            let transferredBytes = 0;

            const fileStream = fs.createWriteStream(targetPath);

            res.on('data', (chunk) => {
              transferredBytes += chunk.length;
              const percent = totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : 0;
              const progressData = {
                percent,
                transferredBytes,
                totalBytes,
              };
              onProgress?.(progressData);
              this.onUpdateProgress?.(progressData);
            });

            res.pipe(fileStream);

            fileStream.on('finish', () => {
              fileStream.close(() => {
                this.downloading = false;
                this.downloadedFilePath = targetPath;
                this.onUpdateDownloaded?.({ filePath: targetPath });
                resolve({ success: true, filePath: targetPath });
              });
            });

            fileStream.on('error', (err) => {
              this.downloading = false;
              try { fs.unlinkSync(targetPath); } catch {}
              reject(err);
            });
          }
        );

        req.on('error', (err) => {
          this.downloading = false;
          reject(err);
        });
      };

      downloadFile(urlToDownload);
    });
  }

  installUpdate(filePath) {
    const fileToRun = filePath || this.downloadedFilePath;
    if (!fileToRun || !fs.existsSync(fileToRun)) {
      throw new Error('Downloaded update file not found.');
    }

    // Launch the downloaded executable in detached mode
    const child = spawn(fileToRun, [], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    // Gracefully exit current app so new executable can take over
    setTimeout(() => {
      try {
        app.quit();
      } catch (_) {}
      setTimeout(() => {
        try {
          app.exit(0);
        } catch (_) {}
      }, 1000);
    }, 400);

    return { success: true };
  }
}

export default AutoUpdaterService;
