# PBR 貼圖規範與檢查（Vibrant Visuals）

資源包 `manifest.json` 宣告了 `"capabilities": ["pbr"]`。每張會出現在世界裡的貼圖都要有一組 texture set。

## 檔案規則

以 `foo.png` 為例，同一資料夾內要有：

| 檔案 | 內容 |
|---|---|
| `foo.png` | 顏色（RGBA 8-bit） |
| `foo_normal.png` | 法線貼圖，與顏色同尺寸 |
| `foo_mer.png` | R = 金屬度、G = 自發光、B = 粗糙度，與顏色同尺寸 |
| `foo.texture_set.json` | `color` 必須等於檔名 `foo`；`normal` 與 `heightmap` 不可並存 |

不需要 texture set 的：`ui/`、`particle/`、物品欄平面圖示 `items/icon_*`。

## 檢查

```bash
python3 tools/pbr_audit.py
```

缺圖、尺寸不一致、`color` 與檔名不符、或方塊／模型／物品貼圖沒有 texture set 時會以結束碼 1 失敗。

## MER 取值參考

| 材質 | 金屬度 R | 粗糙度 B | 備註 |
|---|---|---|---|
| 新鮮葉、花、果 | 0 | 150–200 | 帶水分，略有光澤 |
| 乾燥藥材、紙、竹編、木 | 0 | 215–245 | |
| 陶、石 | 0 | 200–235 | 上釉處可降到 90–140 |
| 液面（水、茶、湯、酒） | 0 | 15–60 | 目前偏高，見下 |
| 鐵製刀刃 | 255 | 90–140 | 鏽蝕處金屬度降為 0 |
| 銅、黃銅 | 255 | 110–170 | |
| 火星、燈芯、燈籠紙 | 0 | 視底材 | 另在 G 通道給自發光 |

## v1.1.0 檢查結果

141 組 texture set 全數通過：顏色、法線、MER 三張齊全，尺寸一致。
尺寸分布：16×16 共 130 組，64×64 共 8 組，128×128 共 2 組，128×64 共 1 組。

全部 117 個物品圖示由 `tools/icons.py` 產生（全部讀入 `tools/icon_src/rd/` 的 Retro Diffusion 圖，每張圖一種材質，另依顏色挑出燈籠紙面與餘燼的自發光、香爐與戥子秤的銅件、小鏟的鐵面）：每個像素的材質決定 MER（例如液面粗糙度 40、銅件金屬度 255、燈籠紙自發光），法線由材質高度與亮度推出輕微的斜面。

待美術確認的項目（1.1.0 沒有修改既有貼圖）：

| # | 貼圖 | 現況 | 建議 |
|---|---|---|---|
| 1 | `models/clay_pot_water` | 平均粗糙度 235，與空鍋 `clay_pot` 完全相同 | 水面區域降到 15–60 |
| 2 | `models/teas` | 平均粗糙度 224 | 茶湯面降到 15–60，杯身維持 |
| 3 | 新湯劑的擺放模型；10 種單味藥粉圖示 | 已完成：四種湯劑各有模型（`tools/decoction_models.py`，湯面粗糙度 32）；藥粉圖示由 `tools/icons.py` 繪製 | 實機確認外觀 |
| 4 | `models/incense_burner`、`_lit` | 金屬度全為 0；點燃版只有 2 個自發光像素 | 若設定為銅爐則給金屬度；香頭自發光可略增 |
| 5 | `models/plants`、`blocks/leaf`、作物與野生藥草 | 無次表面散射 | texture set 升到 `1.21.30` 改用 `metalness_emissive_roughness_subsurface`，葉片透光 |
| 6 | 全部方塊（355 個 material instance） | 一律 `alpha_test` | 貼圖無透明像素的面改 `opaque`；液面評估 `blend` |
| 7 | 紙燈籠（亮度 13）、香爐（亮度 5） | 僅方塊亮度 | 評估 Vibrant Visuals 的區域光源設定，給暖色點光 |

第 5、7 項用到較新的格式，動工前先對照官方文件確認欄位名稱與最低版本。
