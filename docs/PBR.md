# PBR 貼圖規範與檢查（Vibrant Visuals）

資源包 `manifest.json` 宣告了 `"capabilities": ["pbr"]`。每張會出現在世界裡的貼圖都要有一組 texture set。

## 檔案規則

以 `foo.png` 為例，同一資料夾內要有：

| 檔案 | 內容 |
|---|---|
| `foo.png` | 顏色（RGBA 8-bit） |
| `foo_normal.png` | 法線貼圖，與顏色同尺寸 |
| `foo_mer.png` | R = 金屬度、G = 自發光、B = 粗糙度，與顏色同尺寸 |
| 或 `foo_mers.png` | 同上，另加 A = 次表面散射（葉片透光）；texture set 要 `1.21.30`，和 `_mer` 二選一 |
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

全部 117 個物品圖示由 `tools/icons.py` 產生（全部讀入 `tools/icon_src/rd/` 的 Retro Diffusion 圖，每張圖一種材質，另依顏色挑出燈籠紙面與餘燼的自發光、戥子秤的銅件、小鏟的鐵面；香爐是陶製，不給金屬度）：每個像素的材質決定 MER（例如液面粗糙度 40、銅件金屬度 255、燈籠紙自發光），法線由材質高度與亮度推出輕微的斜面。

待美術確認的項目（1.1.0 沒有修改既有貼圖）：

| # | 貼圖 | 現況 | 建議 |
|---|---|---|---|
| 1 | `models/clay_pot_water` | 已確認：水面與湯面粗糙度 17–39（舊的 235 是含透明格的整張平均） | 不用改 |
| 2 | `models/teas` | 已確認：茶湯面 9–25，杯身 40–57（舊的 224 同上） | 不用改 |
| 3 | 新湯劑的擺放模型；10 種單味藥粉圖示 | 已完成：四種湯劑各有模型（`tools/decoction_models.py`，湯面粗糙度 32）；藥粉圖示由 `tools/icons.py` 繪製 | 實機確認外觀 |
| 4 | `models/incense_burner`、`_lit` | 已完成（`tools/incense_burner_pbr.py`）：陶身 205–232、釉 105–125、金屬度 0；點燃版通氣孔兩格都發光，整圈約 16 格；把手誤發光的一格已移除 | 實機確認 |
| 5 | `models/plants`、`blocks/leaf`、作物與野生藥草 | 已完成（`tools/subsurface.py`）：texture set `1.21.30`，`metalness_emissive_roughness_subsurface`（`_mers.png`，A 通道＝次表面），葉 150、花果 100、菌 40 | 實機確認 |
| 6 | 全部方塊（355 個 material instance） | 一律 `alpha_test` | 貼圖無透明像素的面改 `opaque`；液面評估 `blend` |
| 7 | 紙燈籠（亮度 13）、香爐（亮度 5） | 已完成：`local_lighting/local_lighting.json`（格式 `1.21.120`），兩者 `point_light`，燈籠 `#F2A65A`、香爐 `#E8823C` | 實機確認 |

第 5、7 項的格式已對照官方文件（2026-11-18）：[Texture Set 參考](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/texturesetsreference/texturesetsconcepts/texturesetsintroduction)（MERS 與 MER 不可並存；次表面與金屬度互斥）、[Light Sources](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/lightingcustomization)（`point_lights/global.json` 在 1.21.120 改名為 `local_lighting/local_lighting.json`，資源包最低引擎版本要 1.21.120 以上，本包是 1.26.1）。
