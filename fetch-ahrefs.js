/**
 * AhrefsTop 台灣流量排名抓取工具
 *
 * 使用方式：
 *   node fetch-ahrefs.js
 *
 * 功能說明：
 *   從 AhrefsTop (https://ahrefstop.com/websites/taiwan) 下載台灣 top 100 網站排名，
 *   解析 HTML 表格並轉換成 JSON 格式儲存。
 */

const https = require('https');
const fs = require('fs');
const { URL } = require('url');

const AHREFS_URL = 'https://ahrefstop.com/websites/taiwan';
const OUTPUT_FILE = 'ahrefs_top_tw.json';

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

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve(data));
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 解碼 HTML 實體
 * @param {string} str - 包含 HTML 實體的字串
 * @returns {string} - 解碼後的字串
 */
function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * 將 traffic 字串轉換成以 K 為單位的純數字
 * @param {string} trafficStr - 例如 "80.4M", "1M", "500K", "1.2K"
 * @returns {number} - 以 K 為單位的數字，例如 80400, 1000, 500, 1.2
 */
function convertTrafficToK(trafficStr) {
  if (!trafficStr || typeof trafficStr !== 'string') {
    return 0;
  }

  // 移除空白和特殊字元
  const cleaned = trafficStr.trim().replace(/[,\s]/g, '');

  // 提取數字和單位
  const match = cleaned.match(/^([\d.]+)([KMkm]?)$/);
  if (!match) {
    return 0;
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || '').toUpperCase();

  if (isNaN(value)) {
    return 0;
  }

  // 轉換成 K
  if (unit === 'M') {
    return Math.round(value * 1000); // M -> K (乘以 1000)
  } else if (unit === 'K') {
    return Math.round(value); // K 或無單位 -> 直接使用
  }
  throw new Error(`無效的單位: ${unit}`);
}

/**
 * 從 HTML 中解析表格資料
 * @param {string} html - HTML 內容
 * @returns {Array} - 解析後的網站資料陣列
 */
function parseTable(html) {
  const sites = [];

  // 找到 tbody 開始位置
  const tbodyStart = html.indexOf('<tbody');
  if (tbodyStart === -1) {
    throw new Error('找不到表格 tbody 標籤');
  }

  // 找到 tbody 結束位置
  const tbodyEnd = html.indexOf('</tbody>', tbodyStart);
  if (tbodyEnd === -1) {
    throw new Error('找不到表格 tbody 結束標籤');
  }

  const tbodyContent = html.substring(tbodyStart, tbodyEnd);

  // 使用正則表達式找到所有 <tr> 標籤
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch;

  while ((trMatch = trRegex.exec(tbodyContent)) !== null) {
    const trContent = trMatch[1];

    // 提取 Rank (第一個 <td>)
    const rankMatch = trContent.match(/<td[^>]*>(\d+)<\/td>/);
    if (!rankMatch) continue;
    const rank = parseInt(rankMatch[1], 10);

    // 提取 Website (第三個 <td> 中的 <a> 標籤文字)
    const websiteMatch = trContent.match(/<a[^>]*href="\/websites\/([^"]+)"[^>]*>([^<]+)<\/a>/);
    if (!websiteMatch) continue;
    const website = websiteMatch[2].trim();

    // 提取 Category (第四個 <td> 中的 <a> 標籤文字，可能被 hidden)
    const categoryMatch = trContent.match(/<a[^>]*href="\/websites\/taiwan\/[^"]*"[^>]*>([^<]+)<\/a>/);
    const category = categoryMatch ? decodeHtmlEntities(categoryMatch[1].trim()) : '';

    // 提取 Search traffic (第五個 <td> 中的第一個 <span>)
    // 格式可能是 <span>80.4M</span> 或 <div><span>80.4M</span>...</div>
    const trafficMatch = trContent.match(/<td[^>]*>[\s\S]*?<span>([\d.]+[KMkm]?)<\/span>/);
    if (!trafficMatch) continue;
    const trafficStr = trafficMatch[1].trim();
    const searchTrafficK = convertTrafficToK(trafficStr);

    sites.push({
      rank,
      website,
      category: category || null,
      search_traffic_K: searchTrafficK
    });
  }

  return sites;
}

async function main() {
  try {
    console.log('正在從 AhrefsTop 下載台灣流量排名...');

    const html = await download(AHREFS_URL);

    console.log('下載完成，正在解析表格資料...');

    const sites = parseTable(html);

    if (sites.length === 0) {
      throw new Error('未能解析到任何網站資料');
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sites, null, 2));

    console.log('------------------------------------------------');
    console.log('處理完成！');
    console.log(`共取得 ${sites.length} 筆網站排名`);
    console.log(`結果已儲存至: ${OUTPUT_FILE}`);
    console.log('前 5 筆範例:', JSON.stringify(sites.slice(0, 5), null, 2));
  } catch (err) {
    console.error('處理過程中發生錯誤:', err.message);
    process.exit(1);
  }
}

main();
