<p align="center">
  <img src="docs/banner.png" alt="Kaleidoscope Herbal" width="640">
</p>

# 森羅物語：草本 | Kaleidoscope Herbal（重製版 v1.1）

讓草木的芬芳融入 Minecraft，展開一段充滿自然氣息的草藥生活。

《森羅物語：草本》是一款以東方傳統草藥文化、藥材採集、炮製工藝與藥膳料理為主題的 Minecraft 基岩版附加模組。
從山林間尋找珍貴藥草，到親手晾曬、切製、研磨藥材，再利用砂鍋熬煮草本湯劑，體驗從採集到製作的完整過程。

## 內容

| 路徑 | 說明 |
|---|---|
| `Kaleidoscope Herbal [BP]/` | 行為包（方塊、物品、配方、世界生成、腳本） |
| `Kaleidoscope Herbal [RP]/` | 資源包（模型、貼圖、PBR texture set、語言） |
| `sdk/herbal-client.js` | 給其他模組用的握手 SDK，複製單檔即可 |
| `docs/改善企劃書.md` | 重製版改善企劃書（1.1） |
| `docs/1.2企劃書.md` | 1.2 企劃書 |
| `docs/美術需求.md` | 1.2 美術需求（給美術） |
| `docs/API.md` | 對外 API 契約 |
| `docs/測試表.md` | 進遊戲測試表 |
| `docs/待測清單.md` | 還沒在遊戲裡確認的項目 |
| `docs/PBR.md` | PBR 貼圖規範與檢查結果 |
| `tools/` | 物品圖示與 banner 繪製、引用與 PBR 檢查、打包 |
| `tests/` | 測試 |

需求：Minecraft 基岩版 1.26.1 以上，以及森羅物語：廚房（Cookery）——晾曬、切片、研磨、藥膳與茶都在 Cookery 的器具上完成。
Tavern、A Witch Way、魔女手札，以及姊妹包樂牧、漁歌、豐收為選用聯動（見 `docs/API.md`）。

## 開發

```bash
node --test tests/*.test.mjs
```

```bash
python3 tools/check_refs.py
```

```bash
python3 tools/pbr_audit.py
```

```bash
python3 tools/audit.py
```

```bash
python3 tools/build.py
```

打包結果在 `dist/`。
