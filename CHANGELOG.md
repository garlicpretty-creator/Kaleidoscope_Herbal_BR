# 更新紀錄

## 1.1.0（重製版）

以舊線 1.2.13 為基準重新起算版本。玩法、數值、貼圖無變動。

- 版本號改為 1.1.0（UUID 沿用）；腳本的版本集中在 `scripts/data/version.js`。
- 新增對外 API 1：`api_ping`／`api_ready` 握手、`catalog` 查詢、寒熱讀取與調整、外部食物寒熱登記。見 `docs/API.md`。
- 新增方塊標籤 `kaleidoscope_herbal:heat_sources`，其他模組的方塊可作為砂鍋熱源。
- 新增事件 `constitution`（玩家上火／受寒）。
- 新增 SDK `sdk/herbal-client.js`。
- 新增 PBR 檢查工具、打包工具與測試。
