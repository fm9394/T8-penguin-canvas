# Upstream PR Draft

Status: prepared only, not submitted

Suggested base:

- `T8mars/T8-penguin-canvas:main`

Suggested head:

- `fm9394:codex/remote-comfyui-docker-support`

Suggested title:

`feat: 支援 Remote ComfyUI 與 Docker 部署`

Suggested body:

```md
## 摘要

這個 PR 以盡量小的改動，增加兩項能力：

- 讓 ComfyUI 擴展平台設定可在後端明確允許時使用非本機位址
- 補上 Web 前端 + Express 後端的 Docker 部署路徑

## 為什麼需要這個改動

目前 GUI 雖然可以填入自定 ComfyUI 位址，但非本機 ComfyUI URL 會被後端的正規化與執行期檢查擋掉。實際結果是：

- 設定中的遠端 ComfyUI 位址可能在後端被回退成內建本機預設值
- 畫面上只會看到模糊的連線失敗訊息，難以判斷真正原因

另外，專案目前也缺少一條可直接部署 Web + backend 的 Docker 路徑。

## 這個 PR 做了什麼

### 1. Remote ComfyUI 後端支援

- 新增 `backend/src/providers/comfyuiAccess.js`
  - 抽出 ComfyUI URL 是否允許使用的共用判斷
- 修改 `backend/src/providers/registry.js`
  - 讓 ComfyUI provider 設定與 instance 清單在允許 remote access 時保留非本機 URL
- 修改 `backend/src/providers/comfyui.js`
  - 讓 provider 測試與實際生成走同一套 URL 存取策略
  - 改善錯誤訊息，避免只剩下模糊的 fetch failed

### 2. Docker 部署支援

- 新增 `.dockerignore`
- 新增 `Dockerfile`
- 新增 `docker-compose.yml`
- 讓 Docker 部署預設啟用 `T8_COMFYUI_ALLOW_REMOTE=1`
  - 這是因為容器化部署常常需要連到另一台主機或另一個容器中的 ComfyUI

### 3. UI 文案與維護文件

- 修改 `src/components/ApiSettings.tsx`
  - 調整 ComfyUI 說明文字，避免 UI 文案仍暗示只能用 localhost
- 修改 `README.md`
  - 補上 remote ComfyUI 與 Docker 使用說明
- 新增 `docs/fork-maintenance.md`
  - 記錄 fork 的最小改動面與未來 rebase / sync 維護方式
- 新增 `docs/plans/2026-06-05-remote-comfyui-docker-support-plan.md`
  - 保留這次改動的實作計劃與後續維護脈絡

### 4. 回歸測試

- 修改 `tests/advancedProviders.test.ts`
- 修改 `tests/comfyuiProvider.test.ts`
- 修改 `tests/externalProvidersRoute.test.ts`
- 新增 `tests/dockerComposeConfig.test.ts`

## Remote ComfyUI 問題的根因

這次的 ComfyUI 問題不只是單純的網路連線錯誤。

其中一個關鍵路徑是：前端接受了遠端 ComfyUI 設定，但後端在正規化階段又把它濾掉，最後 provider 回退成內建本機預設位址。這會讓使用者看到像是 fetch failed 之類的症狀，但實際上後端根本沒有真的使用原本填入的遠端 URL。

後續補丁也一併修正了 Docker Compose 的 remote access 開關，避免容器部署時再次默默退回本機預設值。

## 最小改動檔案清單

### 功能必要檔案

- `backend/src/providers/comfyuiAccess.js`
- `backend/src/providers/registry.js`
- `backend/src/providers/comfyui.js`
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`

### 建議一起保留的維護與驗證檔案

- `src/components/ApiSettings.tsx`
- `tests/advancedProviders.test.ts`
- `tests/comfyuiProvider.test.ts`
- `tests/externalProvidersRoute.test.ts`
- `tests/dockerComposeConfig.test.ts`
- `README.md`
- `docs/fork-maintenance.md`
- `docs/plans/2026-06-05-remote-comfyui-docker-support-plan.md`

## 驗證方式

已執行：

- `node --test tests/*.test.ts`
- `npm run type-check`
- `npm run build`
- `docker compose up -d --force-recreate`
- 驗證容器化部署中的 `/api/status`
- 驗證 external provider test route 在開啟 remote access 時，會保留設定中的遠端 ComfyUI URL，而不是回退到 localhost

## 備註

- 非 Docker 部署仍維持 local-only 預設行為，除非後端明確開啟 remote access
- Docker Compose 設定刻意保持通用，不包含私人網路、個人路徑或機器專屬資訊
- 這個 PR 盡量把改動面維持在小範圍，降低未來同步 upstream 時的衝突成本
```

Suggested manual submit flow:

```bash
git checkout codex/remote-comfyui-docker-support
git fetch upstream main
git rebase upstream/main
git push --force-with-lease origin codex/remote-comfyui-docker-support
```

Then open a new PR in GitHub with:

- base repository: `T8mars/T8-penguin-canvas`
- base branch: `main`
- head repository: `fm9394/T8-penguin-canvas`
- compare branch: `codex/remote-comfyui-docker-support`

Optional note before submitting:

- if upstream prefers smaller review scope, split Remote ComfyUI and Docker support into separate PRs
