/**
 * 合併五個 JSON 檔案為統一格式
 *
 * 使用方式：
 *   node merge-lists.js
 *
 * 功能說明：
 *   從五個 JSON 檔案中提取所有網址清單及其對應的 rank 資訊，
 *   合併成統一的格式輸出。
 */

const fs = require('fs');
const path = require('path');

// 檔案配置
const FILES = [
  {
    path: 'ahrefs_top_tw.json',
    listName: 'ahrefs',
    domainField: 'website'
  },
  {
    path: 'cloudflare_radar_tw.json',
    listName: 'cloudflare',
    domainField: 'domain'
  },
  {
    path: 'similarweb_top_taiwan.json',
    listName: 'similarweb',
    domainField: 'website'
  },
  {
    path: 'semrush_top_tw.json',
    listName: 'semrush',
    domainField: 'domain_name'
  },
  {
    path: 'tranco_list_tw.json',
    listName: 'tranco',
    domainField: 'domain',
    urlField: 'url' // tranco 有 url 欄位
  }
];

const OUTPUT_FILE = 'merged_lists_tw.json';

/**
 * 標準化網址：移除 www. 前綴，但保留其他 subdomain
 * @param {string} domain - 原始網址
 * @returns {string} - 標準化後的網址
 */
function normalizeWebsite(domain) {
  if (!domain) return '';

  // 轉小寫
  let normalized = domain.toLowerCase().trim();

  // 移除 www. 前綴（僅當開頭是 www. 時）
  if (normalized.startsWith('www.')) {
    normalized = normalized.substring(4);
  }

  return normalized;
}

/**
 * 讀取並解析 JSON 檔案
 * @param {string} filePath - 檔案路徑
 * @returns {Array} - 解析後的資料陣列
 */
function readJsonFile(filePath) {
  try {
    const fullPath = path.join(__dirname, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`錯誤：無法讀取檔案 ${filePath}:`, error.message);
    return [];
  }
}

/**
 * 主函數：合併所有資料
 */
function mergeLists() {
  console.log('開始合併資料...');

  // 使用 Map 儲存所有網址（key: 標準化後的 website）
  const websitesMap = new Map();

  // 優先處理 tranco 資料（因為 url 欄位以 tranco 為主）
  const trancoFile = FILES.find(f => f.listName === 'tranco');
  if (trancoFile) {
    console.log(`讀取 ${trancoFile.path}...`);
    const trancoData = readJsonFile(trancoFile.path);

    for (const item of trancoData) {
      const domain = item[trancoFile.domainField];
      if (!domain) continue;

      const normalizedWebsite = normalizeWebsite(domain);
      const url = item[trancoFile.urlField] || null;
      const rank = item.rank;

      // 如果網址已存在，比較 rank，保留 rank 較小的
      if (websitesMap.has(normalizedWebsite)) {
        const existing = websitesMap.get(normalizedWebsite);
        const existingTrancoRank = existing.rank[trancoFile.listName];

        // 如果新 rank 更小，則更新 url 和 tranco rank
        if (existingTrancoRank !== undefined && rank < existingTrancoRank) {
          existing.url = url;
          existing.rank[trancoFile.listName] = rank;
        } else if (existingTrancoRank === undefined) {
          // 如果沒有 tranco 項目（不應該發生，但以防萬一）
          existing.url = url;
          existing.rank[trancoFile.listName] = rank;
        }
        // 如果新 rank 更大或相等，則保留原有的，不做任何更新
      } else {
        // 如果網址不存在，建立新項目
        websitesMap.set(normalizedWebsite, {
          website: normalizedWebsite,
          url: url,
          rank: {
            [trancoFile.listName]: rank
          }
        });
      }
    }

    console.log(`已處理 ${trancoData.length} 筆 tranco 資料`);
  }

  // 處理其他檔案
  for (const fileConfig of FILES) {
    if (fileConfig.listName === 'tranco') continue; // tranco 已經處理過了

    console.log(`讀取 ${fileConfig.path}...`);
    const data = readJsonFile(fileConfig.path);

    for (const item of data) {
      const domain = item[fileConfig.domainField];
      if (!domain) continue;

      const normalizedWebsite = normalizeWebsite(domain);

      // 如果網址已存在，新增 rank 資訊
      if (websitesMap.has(normalizedWebsite)) {
        const existing = websitesMap.get(normalizedWebsite);
        existing.rank[fileConfig.listName] = item.rank;
      } else {
        // 如果網址不存在，建立新項目（url 為 null，因為不在 tranco 中）
        websitesMap.set(normalizedWebsite, {
          website: normalizedWebsite,
          url: null,
          rank: {
            [fileConfig.listName]: item.rank
          }
        });
      }
    }

    console.log(`已處理 ${data.length} 筆 ${fileConfig.listName} 資料`);
  }

  // 轉換為陣列格式
  const result = Array.from(websitesMap.values());

  // 按照優先順序排序：1. cloudflare 2. similarweb 3. ahrefs 4. semrush 5. tranco
  result.sort((a, b) => {
    // 取得排序用的 rank（按照優先順序）
    const getSortRank = (item) => {
      if (item.rank.cloudflare !== undefined) {
        return { priority: 1, rank: item.rank.cloudflare };
      } else if (item.rank.similarweb !== undefined) {
        return { priority: 2, rank: item.rank.similarweb };
      } else if (item.rank.ahrefs !== undefined) {
        return { priority: 3, rank: item.rank.ahrefs };
      } else if (item.rank.semrush !== undefined) {
        return { priority: 4, rank: item.rank.semrush };
      } else if (item.rank.tranco !== undefined) {
        return { priority: 5, rank: item.rank.tranco };
      } else {
        // 如果都沒有，使用其他來源或使用很大的數字
        const otherRank = Object.values(item.rank)[0];
        return { priority: 6, rank: otherRank !== undefined ? otherRank : Infinity };
      }
    };

    const aSort = getSortRank(a);
    const bSort = getSortRank(b);

    // 先按優先順序排序
    if (aSort.priority !== bSort.priority) {
      return aSort.priority - bSort.priority;
    }

    // 如果優先順序相同，按 rank 值排序（rank 越小越前面）
    if (aSort.rank !== bSort.rank) {
      return aSort.rank - bSort.rank;
    }

    // 如果 rank 也相同，按 website 字母順序排序
    return a.website.localeCompare(b.website);
  });

  // 如果沒有 url，補上 https://{website}
  for (const item of result) {
    if (!item.url) {
      item.url = `https://${item.website}`;
    }
  }

  // 寫入檔案
  const outputPath = path.join(__dirname, OUTPUT_FILE);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(result, null, 2),
    'utf8'
  );

  console.log(`\n合併完成！`);
  console.log(`總共 ${result.length} 個網站`);
  console.log(`結果已寫入 ${OUTPUT_FILE}`);
}

// 執行主函數
mergeLists();
