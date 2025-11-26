/**
 * 台灣網站流量排名抓取工具
 *
 * 功能說明：
 *   從 Tranco List (https://tranco-list.eu/) 下載全球前 100 萬網站排名清單，
 *   篩選出所有 .tw 結尾的網站（包含 .com.tw, .edu.tw, .gov.tw 等），
 *   並輸出成 JSON 檔案。
 *
 * 使用方式：
 *   1. 安裝 Node.js (建議 v16 以上)
 *   2. 安裝相依套件：npm install adm-zip
 *   3. 執行腳本：node fetch-tranco.js
 *
 * 輸出檔案：
 *   tw_sites.json - 包含篩選後的 .tw 網站清單
 *   格式：[{ rank: 排名, domain: 網域, url: 完整網址 }, ...]
 *
 * 資料來源：
 *   Tranco List - 結合 Alexa, Cisco Umbrella, Majestic 等多來源的網站排名
 *   https://tranco-list.eu/
 */

const https = require('https');
const fs = require('fs');
const AdmZip = require('adm-zip');

const TRANCO_URL = 'https://tranco-list.eu/top-1m.csv.zip';
const OUTPUT_FILE = 'tranco_list_tw.json';

// 設定 HTTPS agent 來處理某些環境下的 SSL 證書問題
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

function download(url, baseUrl = undefined) {
  return new Promise((resolve, reject) => {
    // 解析 URL 以便處理相對路徑的重新導向
    const parsedUrl = baseUrl ? new URL(url, baseUrl) : new URL(url);
    const currentBase = `${parsedUrl.protocol}//${parsedUrl.host}`;

    https.get(parsedUrl.href, { agent: httpsAgent }, (res) => {
      // 處理 redirect（301 / 302）
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error(`Redirect (${res.statusCode}) 但無 Location header`));
        console.log(`發現重新導向 -> ${loc}`);
        // 使用 currentBase 來處理相對路徑的重新導向
        return resolve(download(loc, currentBase));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`下載失敗，HTTP 狀態碼: ${res.statusCode}`));
      }

      const data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    console.log('正在下載 Tranco 最新清單...');

    const buffer = await download(TRANCO_URL);

    console.log('下載完成，正在解壓縮與處理資料...');

    // 解壓縮 ZIP
    const zip = new AdmZip(buffer);
    const csvEntry = zip.getEntries().find(e => e.entryName === 'top-1m.csv');

    if (!csvEntry) {
      throw new Error('ZIP 檔案中找不到 top-1m.csv');
    }

    const csvText = csvEntry.getData().toString('utf8');

    const lines = csvText.split('\n');
    const twSites = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue; // 跳過空行

      const parts = trimmed.split(',');
      if (parts.length < 2) continue;

      const rank = parseInt(parts[0], 10);
      const domain = parts[1].trim();

      // 排除 rank 解析失敗的狀況
      if (!Number.isFinite(rank)) continue;

      // 結尾是 .tw（包含 .com.tw, .edu.tw, .gov.tw 等）
      if (domain.endsWith('.tw')) {
        twSites.push({
          rank,
          domain,
          url: `https://${domain}`,
        });
      }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(twSites, null, 2));

    console.log('------------------------------------------------');
    console.log('處理完成！');
    console.log(`原始清單總行數（含空行）: ${lines.length}`);
    console.log(`篩選出 .tw 網站: ${twSites.length} 筆`);
    console.log(`結果已儲存至: ${OUTPUT_FILE}`);
    console.log('前 5 筆範例:', twSites.slice(0, 5));
  } catch (err) {
    console.error('處理過程中發生錯誤:', err);
  }
}

main();