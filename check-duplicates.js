/**
 * 檢查 tranco 資料中重複的網站
 *
 * 使用方式：
 *   node check-duplicates.js
 *
 * 功能說明：
 *   檢查 tranco_list_tw.json 中所有在標準化後會重複的網站
 *   （例如 www.example.com 和 example.com 會標準化為同一個）
 */

const fs = require('fs');
const path = require('path');

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
 * 主函數：檢查重複的網站
 */
function checkDuplicates() {
  console.log('開始檢查重複網站...\n');

  // 讀取 tranco 資料
  const trancoPath = path.join(__dirname, 'tranco_list_tw.json');
  const trancoData = JSON.parse(fs.readFileSync(trancoPath, 'utf8'));

  // 使用 Map 來追蹤每個標準化網址對應的所有原始網址
  // key: 標準化後的網址
  // value: 陣列，包含所有對應的原始網址及其 rank 和 url
  const normalizedMap = new Map();

  for (const item of trancoData) {
    const domain = item.domain;
    if (!domain) continue;

    const normalized = normalizeWebsite(domain);

    if (!normalizedMap.has(normalized)) {
      normalizedMap.set(normalized, []);
    }

    normalizedMap.get(normalized).push({
      domain: domain,
      rank: item.rank,
      url: item.url
    });
  }

  // 找出所有重複的網站（標準化後有多個原始網址）
  const duplicates = [];

  for (const [normalized, domains] of normalizedMap.entries()) {
    if (domains.length > 1) {
      duplicates.push({
        normalized: normalized,
        domains: domains
      });
    }
  }

  // 按標準化網址排序
  duplicates.sort((a, b) => a.normalized.localeCompare(b.normalized));

  // 輸出結果到終端
  console.log(`總共 ${trancoData.length} 筆 tranco 資料`);
  console.log(`標準化後唯一網址: ${normalizedMap.size}`);
  console.log(`重複的網站數量: ${duplicates.length}`);
  console.log(`\n所有重複的網站清單：\n`);

  duplicates.forEach((dup, index) => {
    console.log(`${index + 1}. ${dup.normalized} (標準化後)`);
    dup.domains.forEach(d => {
      console.log(`   - ${d.domain} (rank: ${d.rank}, url: ${d.url})`);
    });
    console.log('');
  });

  // 寫入 JSON 檔案
  const output = {
    total: trancoData.length,
    unique: normalizedMap.size,
    duplicates: duplicates.length,
    duplicateList: duplicates.map(dup => ({
      normalized: dup.normalized,
      domains: dup.domains
    }))
  };

  const outputPath = path.join(__dirname, 'duplicates-check.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n詳細結果已寫入 duplicates-check.json`);
}

// 執行主函數
checkDuplicates();
