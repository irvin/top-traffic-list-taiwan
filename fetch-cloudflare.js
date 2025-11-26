/**
 * Cloudflare Radar 台灣流量排名抓取工具
 *
 * 使用方式：
 *   1. 申請 Cloudflare API Token: https://dash.cloudflare.com/profile/api-tokens
 *   2. 複製 .env.example 為 .env 並填入你的 API Token
 *   3. 執行腳本：node fetch-cloudflare.js
 */

require('dotenv').config();

const https = require('https');
const fs = require('fs');

// 從 .env 檔案讀取 API Token
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!API_TOKEN || API_TOKEN === 'YOUR_API_TOKEN_HERE') {
  console.error('錯誤：請在 .env 檔案中設定 CLOUDFLARE_API_TOKEN');
  console.error('步驟：');
  console.error('  1. 開啟 .env 檔案');
  console.error('  2. 將 YOUR_API_TOKEN_HERE 替換成你的 Cloudflare API Token');
  process.exit(1);
}
const OUTPUT_FILE = 'cloudflare_radar_tw.json';

// Cloudflare Radar API 端點
const API_BASE = 'https://api.cloudflare.com/client/v4/radar/ranking/top';

function fetchRadarData(location = 'TW', limit = 100) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE);
    url.searchParams.set('location', location);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('format', 'json');

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success) {
            resolve(json.result);
          } else {
            reject(new Error(`API 錯誤: ${JSON.stringify(json.errors)}`));
          }
        } catch (e) {
          reject(new Error(`解析 JSON 失敗: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function main() {
  try {
    console.log('正在從 Cloudflare Radar 下載台灣流量排名...');

    // 可以調整 limit 來獲取更多結果（最大通常是 100 或 200）
    const result = await fetchRadarData('TW', 100);

    // 處理並格式化資料（Cloudflare API 回傳格式為 top_0）
    const topDomains = result.top_0 || result.top || [];
    const domains = topDomains.map((item) => ({
      rank: item.rank,
      domain: item.domain,
      categories: item.categories || []
    }));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(domains, null, 2));

    console.log('------------------------------------------------');
    console.log('下載完成！');
    console.log(`共取得 ${domains.length} 筆網域排名`);
    console.log(`結果已儲存至: ${OUTPUT_FILE}`);
    console.log('前 5 筆範例:', domains.slice(0, 5));
  } catch (err) {
    console.error('發生錯誤:', err.message);
  }
}

main();