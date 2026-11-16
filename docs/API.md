# 森羅物語：草本 — 對外 API（API 1，自 v1.1.0）

其他模組透過 **Script Event** 與草本握手，命名空間一律是 `kaleidoscope_herbal`。
做法與 Cookery、Tavern 相同：`api_ping` → `api_ready`，再依 `capabilities` 決定要用哪些功能。

想直接用的話，把 [`sdk/herbal-client.js`](../sdk/herbal-client.js) 整個檔案複製進你的模組即可（只需要 `system`）。
不要 import 草本行為包內的路徑。

## 通用規則

| 項目 | 規定 |
|---|---|
| 傳輸 | `system.sendScriptEvent(id, message)`，`message` 為單行 JSON，長度不超過 2048 字元 |
| 來源 | 只接受腳本送出的事件（`sourceType === 'Server'`）；玩家輸入的 `/scriptevent` 與指令方塊一律忽略 |
| 請求必填 | `api: 1`、`source`：你的模組命名空間（`[a-z0-9_.-]`，1–64 字，不可為 `kaleidoscope_herbal`） |
| 回覆定址 | 事件是廣播，回覆帶 `to: <你的 source>`，請只處理 `to` 等於自己的訊息 |
| 對應請求 | 請求可帶 `req`（字串或數字，最長 32 字），回覆原樣帶回 |
| 不合格的請求 | JSON 壞掉、`api` 不是 1、`source` 不合規 → 不回覆 |
| 持久性 | 草本不保存任何外部註冊；每次收到 `api_ready` 都要重送一次（重送無副作用） |
| 沒裝草本 | 不會有任何回覆；你的模組應照常運作 |

## 握手

| 方向 | 事件 | 內容 |
|---|---|---|
| → 草本 | `kaleidoscope_herbal:api_ping` | 任意字串（建議放你的 `source`） |
| ← 草本 | `kaleidoscope_herbal:api_ready` | `{"api":1,"source":"kaleidoscope_herbal","version":"1.1.0","capabilities":[...],"limits":{"externalHeat":256,"itemsPerMessage":32,"heatAddMax":50}}` |

草本在世界載入後會主動廣播一次 `api_ready`；較晚載入的模組自己送 `api_ping` 會得到同樣的回覆。

### capabilities

| 名稱 | 意義 |
|---|---|
| `events` | 會廣播 `kaleidoscope_herbal:evt`（見下） |
| `catalog` | 可查詢藥材與藥膳清單 |
| `constitution` | 可讀取玩家的寒熱值 |
| `constitution_write` | 可調整玩家的寒熱值 |
| `external_heat` | 可替自己的食物登記寒熱值 |
| `heat_source_tag` | 砂鍋認得方塊標籤 `kaleidoscope_herbal:heat_sources` |

新功能只會**增加** capability，不會改動既有訊息的欄位意義；破壞性變更才會升 `api`。

## 清單查詢 `catalog`

請求 `kaleidoscope_herbal:catalog_request`：`{"api":1,"source":"my_pack","req":"1","kind":"herbs"}`

回覆 `kaleidoscope_herbal:catalog`（可能分成多封，收齊 `parts` 封後依 `index` 合併 `items`）：

```json
{"api":1,"to":"my_pack","req":"1","kind":"herbs","ok":true,"index":0,"parts":2,"items":[...]}
```

| `kind` | `items` 每筆 |
|---|---|
| `herbs` | `{key, fresh, dry, processed?, wild, cultivable}`，除 `key` 外皆為完整物品／方塊 ID |
| `foods` | `{id, heat, effects:[[效果名, ticks, amplifier], ...], clear?:[效果名...]}` |

未知的 `kind` 回 `{"ok":false,"code":"UNKNOWN_KIND","kinds":["herbs","foods"]}`。

## 寒熱（體質）

寒熱值範圍 −100（寒）到 +100（熱），0 為平和；每 5 秒向 0 回復 5。到達 ±100 會觸發上火／受寒並回到 ±60。

### 讀取 — `constitution`

請求 `kaleidoscope_herbal:heat_request`：`{"api":1,"source":"my_pack","req":"2","p":"<player.id>"}`
回覆 `kaleidoscope_herbal:heat`：`{"api":1,"to":"my_pack","req":"2","p":"...","ok":true,"heat":35}`

### 調整 — `constitution_write`

請求 `kaleidoscope_herbal:heat_add`：`{"api":1,"source":"my_pack","req":"3","p":"<player.id>","delta":-20}`
回覆 `kaleidoscope_herbal:heat`：`{"ok":true,"heat":15,"applied":-20}`；跨過上下限時多一個 `"effect":"overheat"` 或 `"chill"`。

- `delta` 會四捨五入並限制在 ±50（`limits.heatAddMax`）。
- 同一模組對同一玩家每 20 tick 只收一次，超過回 `THROTTLED`（附目前 `heat`）。

| `code` | 原因 |
|---|---|
| `NO_PLAYER` | `p` 不是線上玩家的 entity id |
| `BAD_DELTA` | `delta` 不是有限數字或為 0 |
| `THROTTLED` | 呼叫過於頻繁 |

### 替自己的食物登記寒熱值 — `external_heat`

請求 `kaleidoscope_herbal:heat_register`：

```json
{"api":1,"source":"my_pack","items":[{"id":"my_pack:iced_tea","heat":-30},{"id":"my_pack:hotpot","heat":25}]}
```

回覆 `kaleidoscope_herbal:heat_ack`：`{"api":1,"to":"my_pack","ok":true,"accepted":2,"rejected":[]}`

登記之後，玩家吃完／喝完該物品（`itemCompleteUse`，或 A Witch Way 背包自動餵食）就會套用寒熱值；
正值在地獄加倍，與草本自己的溫補品相同。草本只處理寒熱，藥水效果、飽食度仍由你的模組負責。

- `heat` 必須是 −100 到 100 的整數；`0` 表示撤回自己先前的登記。
- 一封最多 32 筆，全部模組合計最多 256 筆。
- 同一物品先登記的模組保有它；原登記者可以更新數值。

| `rejected[].code` | 原因 |
|---|---|
| `BAD_ID` | 不是 `namespace:name` 格式 |
| `RESERVED` | `kaleidoscope_herbal:` 或 `minecraft:` 的物品 |
| `BAD_HEAT` | 不是 −100..100 的整數 |
| `TAKEN` | 已被別的模組登記 |
| `FULL` | 已達 256 筆上限 |

整封不合格（`items` 不是陣列或超過 32 筆）時回 `{"ok":false,"code":"BAD_ITEMS"}`。

## 熱源標籤 — `heat_source_tag`

不需要腳本：在你的方塊加上標籤 `kaleidoscope_herbal:heat_sources`，砂鍋放在上面就視為文火。
方塊若有名為 `lit`（任何命名空間）的布林狀態，只有 `lit` 為真時才算加熱。
草本也認 `kaleidoscope_cookery:heat_sources`、`farmersdelight:heat_sources`、`c:heat_sources`、`c:heat_source`。

## 事件廣播 — `events`

`kaleidoscope_herbal:evt`，單行 JSON：`{"v":1,"t":"<事件>","p":"<player.id>", ...}`。
同一玩家同一事件每 20 tick 最多一次。

| `t` | 額外欄位 | 時機 |
|---|---|---|
| `decoction_served` | `id` | 從砂鍋盛出一份湯劑 |
| `ate_placed` | `id`, `kind`: `soup` \| `wine` | 食用擺放在地上的藥膳／藥酒 |
| `ginseng_dug` | `whole`（是否用藥鋤完整挖起） | 挖起人參 |
| `incense_lit` | `fuel` | 點燃香爐 |
| `constitution` | `state`: `overheat` \| `chill` | 玩家上火或受寒（v1.1.0 新增） |
| `powder_mixed` | `id`（成品，配錯時為 `kaleidoscope_herbal:strange_powder`） | 在藥缽配出散劑（v1.1.0 新增） |
| `formula_learned` | `id`（藥方成品） | 玩家用藥方籤學會一個藥方（v1.1.0 新增） |

## 草本會聽的外部事件（供參考）

| 事件 | 來源 | 草本的反應 |
|---|---|---|
| `kaleidoscope_cookery:api_ready` / `guidebook_ready` | Cookery | 註冊竹篩、砧板、石磨、茶壺等配方；發布圖鑑 |
| `kaleidoscope_tavern:api_ready` | Tavern | 註冊藥酒配方，圖鑑補上藥酒頁 |
| `aww:evt` `autofed` / `sky` / `reaction` | A Witch Way | 自動餵食套用藥效；天象期間作物加速；催化使附近作物成長 |
| `senluo_link:evt` `week` | 魔女手札 | 豐收週作物與曬籃 1.5 倍；薰香週香爐每份燃燒 9000 tick |

## SDK 範例

```js
import {system} from '@minecraft/server';
import {connectHerbal} from './herbal-client.js';

const herbal = connectHerbal(system, {
  source: 'my_pack',
  heat: [{id: 'my_pack:iced_tea', heat: -30}],
  onReady: info => console.info('Herbal ' + info.version),
  onEvent: e => { if (e.t === 'constitution') { /* 玩家上火或受寒 */ } },
});

// 之後任何時候：
const herbs = await herbal.requestCatalog('herbs');   // 沒裝草本時為 undefined
const state = await herbal.requestHeat(player.id);    // {heat} 或 {error}
await herbal.addHeat(player.id, -20);
```
