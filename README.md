# 台灣網站流量排名抓取工具

從 [Tranco List](https://tranco-list.eu/) 下載全球前 100 萬網站排名清單，篩選出所有 `.tw` 結尾的台灣網站。

## 📋 需求

- Node.js v16 以上

## 🚀 使用方式

### 1. 安裝相依套件

```bash
npm install
```

### 2. 執行腳本

```bash
npm start
# 或
node fetch-tranco.js
```

## 📁 輸出檔案

執行後會產生 `tw_sites.json`，格式如下：

```json
[
  {
    "rank": 123,
    "domain": "example.com.tw",
    "url": "https://example.com.tw"
  },
  ...
]
```

## 📊 資料來源

[Tranco List](https://tranco-list.eu/) - 結合 Alexa, Cisco Umbrella, Majestic, Chrome User Experience Report 等多來源的網站排名，比單一來源更具可靠性與穩定性。

## 📝 備註

- 腳本會自動處理 HTTP 重新導向
- 篩選條件：網域結尾為 `.tw`（包含 `.com.tw`, `.edu.tw`, `.gov.tw` 等所有 `.tw` 網域）
- 清單每日更新，每次執行會下載最新版本

## 📜 授權

This project is licensed under the MIT License. See the [LICENSE](/LICENSE) file for details.

## 🙏 致謝

This work was supported by a grant from the APNIC Foundation, via the Information Society Innovation Fund (ISIF Asia).
