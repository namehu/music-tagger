# 本地音乐管理工具（NAS 音乐库）— 需求说明 & 架构设计（标准版）

> 版本：v1（草案）  
> 日期：2026-04-01  
> 目标读者：产品/研发（偏前端架构师视角）、自托管部署使用者  

## 0. 背景与目标

你有一台 NAS 存放原始音乐文件（FLAC/MP3 等），文件大多带有可用元数据（封面/歌词/标签），并希望：

- **整理维护** NAS 音乐库：重命名、修改/补全元数据（封面/歌词/标签）、移动/删除、忽略曲目
- **在线播放**：内网原始格式直出；外网节省流量（AAC/MP3 转码）
- **多用户**：本地账号体系（better-auth），不同用户有各自歌单/忽略
- **Docker Compose 部署**：轻量依赖（SQLite），可在另一台主机通过 NFS/SMB 挂载 NAS

### 0.1 产品阶段规划（关键调整）

- **V1：PC 优先**  
  先把“元数据整理 / diff 对比 / 批量操作 / 管理控制台体验”在 PC Web 上做完整。
- **V2：移动端播放体验**  
  新增移动端优先的播放 UI（更大按钮、更少信息密度、离线/后台播放可选），整理功能仍以 PC 为主。

## 1. 范围（Scope）

### 1.1 V1 必做（MVP+）

1. **库管理**
   - 扫描 NAS 音乐目录，建立索引（曲目/专辑/艺人）
   - 增量更新（检测新增/删除/变更）
2. **播放**
   - 内网：原始文件直出（支持 Seek/Range）
   - 外网：AAC/MP3 档位转码播放（支持 Seek/Range；缓存）
3. **整理维护（先预览后执行）**
   - 重命名/移动/删除（文件级）
   - 标签编辑：标题/艺人/专辑/曲序/碟号/流派/年份/备注等（按格式能力）
   - 封面编辑：读取、替换、写回（嵌入或同目录图片，策略可配置）
   - 歌词：读取、补全、写回（嵌入或 sidecar，策略可配置）
   - 忽略曲目（不出现在默认库/搜索/随机播放中）
4. **歌单（CRUD）**
   - 每用户：创建/改名/删除/添加曲目/排序
5. **账号与权限**
   - 本地账号（better-auth）
   - 角色：管理员 / 普通用户（最小可行）
6. **部署与运维**
   - docker compose 一键启动
   - SQLite（WAL），可备份
   - 基本日志与任务可观测（任务列表、失败原因）

### 1.2 V1 不做（Non-goals）

- 完整的移动端优先 UI（V2）
- 强依赖联网自动匹配（指纹识别、全自动刮削）；V1 仅“本地优先 + 可手动联网补全”
- 与第三方音乐服务器（Navidrome/Jellyfin）深度集成或复用其数据库
- 复杂的组织/共享权限矩阵（如细粒度到目录级 ACL），V1 先做“库全可见 + 歌单/忽略按用户”

## 2. 术语

- **曲目 Track**：单个音频文件（FLAC/MP3…）
- **专辑 Album**：按标签聚合（album + album_artist 等）
- **索引 Index**：SQLite 中的曲目/专辑/艺人等结构化数据
- **Plan（变更计划）**：整理操作的预览结果（diff），用户确认后才执行
- **Job（任务）**：后台执行单元（扫描、执行计划、转码等）

## 3. 用户与核心使用场景

### 3.1 角色

- **管理员**
  - 配置库路径、扫描策略、转码档位、写回策略
  - 执行整理计划（rename/move/delete/tag-write）
  - 处理失败任务、回滚/重试
- **普通用户**
  - 播放、搜索、建歌单、忽略曲目
  - （可选）提交“整理建议/草稿”，由管理员确认执行

### 3.2 用户故事（摘选）

1. 作为管理员，我想批量把某个专辑下文件按“01 - Title.flac”重命名，并在执行前看到所有将受影响的路径 diff。
2. 作为管理员，我想替换专辑封面，并写回到文件标签（或保存为 cover.jpg），执行前可预览新封面。
3. 作为用户，我想在外网用 192kbps MP3 播放，并能拖动进度条 seek。
4. 作为用户，我想把喜欢的曲目加入歌单，随时编辑排序。
5. 作为用户，我想忽略一些重复/低质量版本，不让它们出现在搜索与随机播放。

## 4. 功能需求（Functional Requirements）

### 4.1 库扫描与索引

- 支持配置 1..N 个根目录
- 扫描策略
  - 全量扫描（手动触发）
  - 增量扫描（定时触发、或基于文件 mtime/size/etag）
- 索引内容（最小集合）
  - Track：路径、格式、时长、码率/采样率、标题、艺人、专辑、专辑艺人、曲序/碟号、年份、流派、封面存在性、歌词存在性、哈希/指纹（可选）
  - Album/Artist：聚合字段与封面代表
- 忽略规则
  - 用户级 ignore（逻辑忽略，不改文件）
  - 系统级 ignore（如隐藏目录、特定后缀）

### 4.2 播放与流媒体

- 内网：原始文件直出
  - 支持 HTTP Range（seek）
  - 支持直出 FLAC/MP3（取决于浏览器解码能力；不支持时提示/建议转码）
- 外网：转码播放
  - 输出：AAC/MP3 多档位（如 128/192/320kbps，可配置）
  - 缓存：按（track_id + 档位 + 输出参数）缓存到磁盘
  - 过期策略：LRU/TTL/配额（可配置）

> 注：V1 默认采用 “progressive 文件 + Range” 交付形态；HLS 可作为 V2/V3 增强项。

### 4.3 整理与维护（Plan → 预览 → 执行）

#### 4.3.1 Plan 生成

- 输入：用户选择对象（track/album/目录）、操作类型、目标值（如新专辑名/新封面/新路径模板）
- 输出：Plan（包含 plan_items）
  - 每个 item 显示：
    - 受影响文件路径（old → new）
    - 将写入的 tag diff（字段级）
    - 封面/歌词变更（旧/新预览）
    - 风险提示（冲突、覆盖、权限不足、命名非法等）

#### 4.3.2 执行策略

- 执行前校验：
  - 路径冲突、目标存在、权限检查
  - 写入能力检查（格式不支持则降级或提示）
- 执行顺序：
  - rename/move 尽量使用原子操作（同文件系统内 rename）
  - tag 写入尽量按单文件事务处理（失败则记录并中止/继续取决于策略）
- 回滚策略（默认：尽力回滚）
  - 对 rename/move：记录 old/new，失败则尝试反向 rename
  - 对 tag 写入：保存“旧标签快照”（存 DB），必要时可回写
  - （可选增强）执行前生成备份副本（强保证但空间/耗时更高）

### 4.4 元数据：本地优先 + 可联网补全（可选）

- 本地优先：
  - 从文件标签读取（ID3/Vorbis/FLAC 等）
  - 从同目录图片读取封面（cover.jpg/folder.jpg）
  - 从同目录歌词文件读取（*.lrc/*.txt，命名可配置）
- 联网补全（可开关）：
  - 手动搜索并选择候选：MusicBrainz/Discogs（专辑/艺人），歌词来源（待定）
  - 写回前仍走 Plan 预览与确认

### 4.5 歌单（每用户）

- CRUD：创建/重命名/删除
- 内容管理：添加 track、移除、排序（拖拽排序，PC 优先）
- 播放：歌单顺序播放、随机播放

### 4.6 账号与权限

- 认证：better-auth 本地账号（邮箱/用户名 + 密码）
- 授权（V1 最小化）：
  - 管理员：配置、执行整理计划、处理任务
  - 普通用户：播放、歌单、忽略；可提交整理草稿（可选）

## 5. 非功能需求（NFR）

### 5.1 性能

- 库规模：1 万–10 万首
- 目标：
  - 搜索响应：常用查询 < 300ms（热缓存下）
  - 扫描：支持分批增量、可中断恢复
  - 转码：可限流（并发 N），避免打满 CPU

### 5.2 可靠性

- 任务可恢复：worker 重启后继续未完成任务
- 可追踪：每个任务/plan item 有明确状态与错误原因

### 5.3 安全

- 对外仅暴露 Next.js（HTTPS 建议由反代提供）
- media-worker 不暴露公网端口（仅 docker 内网）
- 基本防护：鉴权、CSRF/同源策略、速率限制（可选）
- 外网建议：配合 VPN / 反代认证（可选）

### 5.4 可运维

- docker compose：环境变量配置
- SQLite 备份：提供手动备份与建议策略（定时拷贝 DB 文件+WAL）
- 日志：结构化日志（任务、转码、写入）

## 6. 架构设计（Architecture）

### 6.1 总体架构

**核心原则：业务编排在 Next.js；媒体作业在 Python worker；重计算交给 ffmpeg。**

- Next.js（App Router）
  - UI + Route Handlers（Control API）
  - 与 SQLite 交互
  - 写入任务队列（jobs 表）
- Python media-worker
  - 轮询/订阅 jobs 表（或轻量队列实现）
  - 执行扫描/plan/转码
  - 结果回写（jobs、tracks、plan_items 等）
- ffmpeg/ffprobe
  - 由 worker 调用（子进程）
- NAS 音乐目录
  - 宿主机挂载（NFS/SMB）→ bind mount

### 6.2 模块划分（建议代码边界）

**Next.js**
- `app/`：页面（PC 优先 UI）
- `app/api/**/route.ts`：Control API（鉴权后）
- `lib/auth/*`：better-auth 适配
- `lib/db/*`：SQLite 访问层（如 Kysely/Drizzle/Prisma 任选其一）
- `lib/plan/*`：Plan 生成与校验（纯业务逻辑）

**media-worker（Python）**
- `scanner/`：目录遍历、变更检测、标签读取
- `tagger/`：标签读写、封面/歌词处理（mutagen）
- `transcoder/`：ffmpeg 参数、档位、缓存
- `executor/`：plan 执行器（rename/move/delete/tag-write）
- `jobs/`：任务领取、心跳、重试、幂等

### 6.3 数据模型（SQLite，概念表）

> 这里是“概念模型”，用于架构对齐；实施时可细化字段与索引。

- `users`：用户
- `roles` / `user_roles`：角色（管理员/普通用户）
- `tracks`：曲目（路径、标签字段、技术信息、封面/歌词状态、更新时间）
- `albums` / `artists`：聚合实体（可选：也可查询时聚合）
- `playlists`：歌单（user_id、name）
- `playlist_items`：歌单项（playlist_id、track_id、position）
- `user_ignored_tracks`：用户忽略
- `plans`：变更计划（创建者、状态：draft/confirmed/running/done/failed）
- `plan_items`：计划项（类型、old/new、tag_diff_json、status、error）
- `jobs`：任务队列（type、payload_json、status、attempts、locked_at、locked_by、error）
- `transcode_cache`：转码缓存索引（track_id、profile、path、size、created_at、last_access）

索引建议：
- `tracks(path)` 唯一
- `tracks(updated_at)`、`jobs(status, locked_at)`
- 全文检索：FTS5（title/artist/album/path…）

### 6.4 任务系统（SQLite 队列）

任务类型（示例）：
- `scan_full` / `scan_incremental`
- `plan_execute`
- `transcode_prepare`（可按需）

机制：
1. Next.js 写入 `jobs`（pending）
2. worker 领取（原子更新：pending → running + lock）
3. 心跳/超时：running 超时可被重新领取（attempts+1）
4. 幂等：payload 中包含 plan_id/job_key，重复执行可识别并跳过

### 6.5 扫描与变更检测

V1 推荐做法（足够实用、实现成本低）：
- 遍历文件树，收集（path、mtime、size）
- 对比 DB 中记录判断新增/删除/疑似变更
- 疑似变更时再读标签（避免全量读标签）

后续可增强：
- 文件内容 hash（成本高）
- inotify/fanotify（依赖宿主文件系统与挂载方式）

### 6.6 转码与缓存策略

档位（可配置）：
- MP3：128/192/320 kbps
- AAC：128/192 kbps（可选）

缓存键：
- `track_id + profile + encoder_version + source_mtime`

策略：
- 命中即用
- 不命中则后台转码（可先返回“正在准备”，或边转码边输出——V1 先不做边转边播，降低复杂度）

### 6.7 部署拓扑（docker compose 概念）

服务建议：
- `web`：Next.js
- `worker`：Python media-worker（同网段、同卷）

卷挂载：
- `music_library:/music:rw`（来自宿主机对 NAS 的挂载路径 bind）
- `data:/data`（SQLite、缓存、日志）
- `transcode_cache:/cache`

网络：
- 对外只暴露 `web`（80/443 由反代提供更佳）

#### 6.7.1 docker compose 示例（参考）

> 说明：这不是最终实现，只是帮助你评估部署形态与卷挂载是否合理。

```yaml
services:
  web:
    image: yourapp/web:latest
    environment:
      - DATABASE_URL=file:/data/app.db
      - MUSIC_ROOT=/music
      - TRANSCODE_CACHE=/cache
      - AUTH_SECRET=change-me
      # - BASE_URL=https://music.example.com
    volumes:
      - data:/data
      - transcode_cache:/cache
      - /mnt/nas/music:/music:rw   # 宿主机先通过 NFS/SMB 挂载 NAS
    ports:
      - "3000:3000"

  worker:
    image: yourapp/worker:latest
    environment:
      - DATABASE_URL=file:/data/app.db
      - MUSIC_ROOT=/music
      - TRANSCODE_CACHE=/cache
      - WORKER_CONCURRENCY=2
    volumes:
      - data:/data
      - transcode_cache:/cache
      - /mnt/nas/music:/music:rw
    depends_on:
      - web

volumes:
  data:
  transcode_cache:
```

## 7. UI/交互（V1 PC 优先）

V1 重点页面：
- 库浏览：按艺人/专辑/文件夹视图切换
- 搜索：全局搜索 + 过滤（格式/码率/采样率/是否有歌词等）
- 曲目详情：标签、封面、歌词预览与编辑
- 专辑编辑：批量改字段、批量替换封面、批量重命名模板
- Plan 预览页：清晰的 diff（路径变更 + 标签变更 + 资源变更），支持勾选/分批执行
- 任务中心：扫描/执行/转码任务列表、日志、重试

V2（移动端播放）重点：
- 播放器优先：大按钮、队列、后台播放（Web 能力受限）
- 下载/离线（可选增强）

## 8. 风险与权衡

- 浏览器对 FLAC 支持不一：内网“原始直出”不代表浏览器一定能播；需要在 UI 提示“需转码”或提供“一键转码播放”。
- SMB/NFS 挂载差异：rename 原子性、权限、大小写敏感、锁行为都可能不同，需要在执行前做能力检测与清晰错误提示。
- 写标签的边界：不同格式支持字段不同；必须在 Plan 里明确“将写入/将忽略”的字段。

## 9. 里程碑（建议）

- M0：跑通部署与索引（扫描 + 库浏览 + 搜索）
- M1：播放（内网直出 + 外网转码缓存）
- M2：Plan（预览）与执行器（rename/move/tag-write/cover/lyrics）
- M3：歌单与忽略（多用户）
- M4：运维与体验打磨（任务中心、失败处理、配置页）
- V2：移动端播放体验（独立 UI 优化）

---
如需我把这份文档进一步“落到可实施层面”，下一步可以补充：API 草案（路由与 payload）、SQLite 表结构草案（字段级）、以及 docker compose 示例配置。

## 10. API 草案（Route Handlers，路由与 Payload）

> 说明：以下均以 `Next.js App Router` 的 Route Handlers 为前提（`/app/api/**/route.ts`）。  
> 认证：由 better-auth 提供会话（cookie/session）。下文以“已鉴权”为默认前置条件。  
> 响应约定：成功返回 `200/201/204`；异步任务返回 `202` + `jobId`；错误返回 `{ error: { code, message, details? } }`。

### 10.1 鉴权与用户

better-auth 通常会挂载类似以下路由（具体以你的集成方式为准）：
- `POST /api/auth/*`：登录、注册、登出、刷新会话等（由 better-auth 处理）

应用侧补充：
- `GET /api/me`
  - 返回当前用户
  - Response
    ```json
    { "id":"u_xxx","role":"admin","email":"a@b.com","name":"Alice" }
    ```

### 10.2 系统配置（管理员）

- `GET /api/admin/settings`
- `PUT /api/admin/settings`
  - 用于配置库根目录、扫描计划、转码档位、写回策略等
  - Request（示例）
    ```json
    {
      "musicRoots":[ "/music" ],
      "scan": { "mode":"scheduled", "cron":"0 */6 * * *" },
      "transcodeProfiles":[
        { "id":"mp3_192", "codec":"mp3", "bitrateKbps":192 },
        { "id":"mp3_320", "codec":"mp3", "bitrateKbps":320 }
      ],
      "writeback": {
        "coverStrategy":"embed_or_sidecar",
        "lyricsStrategy":"sidecar_lrc_preferred"
      }
    }
    ```

### 10.3 索引/扫描任务

- `POST /api/admin/scan/full`
  - Response（202）
    ```json
    { "jobId":"job_123", "type":"scan_full" }
    ```
- `POST /api/admin/scan/incremental`
  - Response（202）
    ```json
    { "jobId":"job_124", "type":"scan_incremental" }
    ```
- `GET /api/jobs?status=pending|running|done|failed&type=scan_full`
  - Response（示例）
    ```json
    {
      "items":[
        { "id":"job_124","type":"scan_incremental","status":"running","progress":0.42,"startedAt":"...","updatedAt":"..." }
      ]
    }
    ```
- `GET /api/jobs/:jobId`
  - Response（示例）
    ```json
    {
      "id":"job_124",
      "type":"scan_incremental",
      "status":"running",
      "progress":0.42,
      "logTail":[ "scan: changed=123 added=7 removed=2" ],
      "error": null
    }
    ```
- `POST /api/jobs/:jobId/retry`（管理员）

### 10.4 浏览库与搜索

- `GET /api/library/stats`
  - Response
    ```json
    { "tracks": 54321, "albums": 4200, "artists": 1200 }
    ```

- `GET /api/tracks?cursor=...&limit=50&order=recent|title|artist&filter[codec]=flac`
  - Response
    ```json
    { "items":[{ "id":"t_1","title":"...","artist":"...","album":"...","durationMs":123000 }], "nextCursor":"..." }
    ```

- `GET /api/tracks/:trackId`
  - Response（示例，字段可裁剪）
    ```json
    {
      "id":"t_1",
      "path":"/music/A/Album/01 - Title.flac",
      "container":"flac",
      "durationMs":123000,
      "audio": { "sampleRate":96000, "bitDepth":24, "channels":2 },
      "tags": { "title":"Title","artist":"Artist","album":"Album","trackNo":1,"discNo":1,"year":2020,"genre":"Rock" },
      "artwork": { "kind":"embedded", "mime":"image/jpeg", "updatedAt":"..." },
      "lyrics": { "kind":"sidecar_lrc", "updatedAt":"..." }
    }
    ```

- `GET /api/search?q=xxx&scope=tracks|albums|artists`
  - Response
    ```json
    { "tracks":[...], "albums":[...], "artists":[...] }
    ```

### 10.5 播放与流媒体

> 设计要点：  
> 1) 由 Next.js 做鉴权与授权；  
> 2) 真正的大文件输出建议走“受控直出”（同一服务输出 Range），或返回短期有效的 token 再走下载路由；  
> 3) V1 先用 progressive + Range；转码采用“先生成再播放”（不做边转边播）。

- `POST /api/playback/resolve`
  - 用于把“我想播放某首歌 + 想要的档位”解析成一个可拉取的 stream URL
  - Request
    ```json
    { "trackId":"t_1", "profile":"original" }
    ```
    或
    ```json
    { "trackId":"t_1", "profile":"mp3_192" }
    ```
  - Response（200，已可播放）
    ```json
    { "url":"/api/stream/t_1?profile=mp3_192&token=st_xxx", "contentType":"audio/mpeg" }
    ```
  - Response（202，需转码）
    ```json
    { "jobId":"job_900","status":"preparing","pollUrl":"/api/jobs/job_900" }
    ```

- `GET /api/stream/:trackId?profile=original|mp3_192&token=...`
  - 行为：
    - `profile=original`：直出原文件（尽量透传）
    - `profile=mp3_192`：直出缓存文件；若不存在返回 `404` 或 `425 Too Early`（更推荐前端先 resolve）
  - 要求：支持 `Range` 请求头（seek）

### 10.6 歌单（每用户）

- `GET /api/playlists`
- `POST /api/playlists`
  - Request
    ```json
    { "name":"通勤" }
    ```
- `GET /api/playlists/:playlistId`
- `PATCH /api/playlists/:playlistId`
- `DELETE /api/playlists/:playlistId`
- `POST /api/playlists/:playlistId/items`
  - Request
    ```json
    { "trackId":"t_1", "position": 0 }
    ```
- `DELETE /api/playlists/:playlistId/items/:itemId`
- `PATCH /api/playlists/:playlistId/items/reorder`
  - Request
    ```json
    { "order":[ "item_3","item_1","item_2" ] }
    ```

### 10.7 忽略（每用户）

- `GET /api/ignored`
- `POST /api/ignored`
  - Request
    ```json
    { "trackId":"t_1" }
    ```
- `DELETE /api/ignored/:trackId`

### 10.8 整理维护：Plan（预览 → 确认 → 执行）

> V1 的核心交互：所有会修改文件系统/标签的操作，必须走 Plan。

- `POST /api/plans`
  - Request（示例：批量重命名模板）
    ```json
    {
      "type":"rename",
      "scope": { "albumId":"alb_1" },
      "params": { "template":"{trackNo:02} - {title}" }
    }
    ```
  - Response（201）
    ```json
    { "planId":"plan_1", "status":"draft" }
    ```

- `POST /api/plans/:planId/preview`
  - Response（示例：返回 diff）
    ```json
    {
      "planId":"plan_1",
      "status":"draft",
      "summary": { "items": 12, "warnings": 1 },
      "items":[
        {
          "id":"pi_1",
          "kind":"rename",
          "path": { "from":"/music/A/01.flac", "to":"/music/A/01 - Title.flac" },
          "tagDiff": null,
          "warnings":[]
        }
      ]
    }
    ```

- `POST /api/plans/:planId/confirm`（管理员）
  - 将 plan 冻结为 confirmed，防止 preview 与执行不一致

- `POST /api/plans/:planId/execute`（管理员）
  - Response（202）
    ```json
    { "jobId":"job_777", "type":"plan_execute", "planId":"plan_1" }
    ```

- `GET /api/plans/:planId`
- `GET /api/plans/:planId/items?status=...`

### 10.9 元数据联网补全（可选）

- `GET /api/metadata/search?provider=musicbrainz&type=album&q=...`
- `POST /api/metadata/apply`
  - 仍然产出 Plan（例如：写入 album/artist/year/cover）

## 11. SQLite 表结构草案（字段级）

> 说明：  
> - better-auth 的表结构取决于其 adapter（可能会生成 `users/sessions/accounts/verification_tokens` 等表）。  
> - 下面给出“业务/媒体索引/任务系统”部分的 DDL 草案，便于你直接落地；`user_id` 类型用 TEXT（存 UUID/ULID 均可）。

### 11.1 业务表（歌单/忽略/设置）

```sql
-- 用户设置（可选）
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);

CREATE TABLE IF NOT EXISTS playlist_items (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_items_track ON playlist_items(track_id);

CREATE TABLE IF NOT EXISTS user_ignored_tracks (
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_user_ignored_track ON user_ignored_tracks(track_id);
```

### 11.2 媒体索引表（tracks 等）

```sql
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  dir_path TEXT NOT NULL,
  filename TEXT NOT NULL,

  -- 文件属性（用于增量检测）
  file_size INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,

  -- 容器/编码信息（来自 ffprobe 或解析）
  container TEXT NOT NULL,       -- flac/mp3/m4a/...
  duration_ms INTEGER NOT NULL,
  bitrate_kbps INTEGER,
  sample_rate INTEGER,
  bit_depth INTEGER,
  channels INTEGER,

  -- 标签（常用字段，便于查询/排序；全量标签也可放 tags_json）
  title TEXT,
  artist TEXT,
  album TEXT,
  album_artist TEXT,
  track_no INTEGER,
  disc_no INTEGER,
  year INTEGER,
  genre TEXT,

  tags_json TEXT,                -- 保留原始/扩展标签

  artwork_kind TEXT,             -- embedded/sidecar/none
  artwork_mime TEXT,
  artwork_hash TEXT,

  lyrics_kind TEXT,              -- embedded/sidecar_lrc/sidecar_txt/none
  lyrics_hash TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tracks_dir_path ON tracks(dir_path);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album, album_artist);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_updated_at ON tracks(updated_at);

-- FTS5：全文搜索（title/artist/album/path）
CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts
USING fts5(
  track_id UNINDEXED,
  title,
  artist,
  album,
  album_artist,
  path,
  content=''
);

-- 同步触发器（简化版：插入/更新/删除时同步 FTS）
CREATE TRIGGER IF NOT EXISTS trg_tracks_fts_insert AFTER INSERT ON tracks BEGIN
  INSERT INTO tracks_fts(track_id, title, artist, album, album_artist, path)
  VALUES (new.id, new.title, new.artist, new.album, new.album_artist, new.path);
END;
CREATE TRIGGER IF NOT EXISTS trg_tracks_fts_update AFTER UPDATE ON tracks BEGIN
  DELETE FROM tracks_fts WHERE track_id = old.id;
  INSERT INTO tracks_fts(track_id, title, artist, album, album_artist, path)
  VALUES (new.id, new.title, new.artist, new.album, new.album_artist, new.path);
END;
CREATE TRIGGER IF NOT EXISTS trg_tracks_fts_delete AFTER DELETE ON tracks BEGIN
  DELETE FROM tracks_fts WHERE track_id = old.id;
END;
```

### 11.3 Plan（变更计划）与执行记录

```sql
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  type TEXT NOT NULL,            -- rename/move/tag_write/cover_write/lyrics_write/delete/...
  scope_json TEXT NOT NULL,
  params_json TEXT NOT NULL,
  status TEXT NOT NULL,          -- draft/confirmed/running/done/failed/cancelled
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plans_created_by ON plans(created_by, created_at);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status, updated_at);

CREATE TABLE IF NOT EXISTS plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  kind TEXT NOT NULL,            -- rename/move/tag_write/...
  track_id TEXT,                 -- 有些操作可能是目录级/文件级
  from_path TEXT,
  to_path TEXT,
  tag_diff_json TEXT,
  warnings_json TEXT,
  status TEXT NOT NULL,          -- pending/running/done/failed/skipped
  error_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON plan_items(plan_id, status);
CREATE INDEX IF NOT EXISTS idx_plan_items_track ON plan_items(track_id);
```

### 11.4 Jobs（SQLite 队列）

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,            -- scan_full/scan_incremental/plan_execute/transcode_prepare/...
  status TEXT NOT NULL,          -- pending/running/done/failed/cancelled
  priority INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,

  progress REAL NOT NULL DEFAULT 0.0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,

  locked_by TEXT,
  locked_at TEXT,
  heartbeat_at TEXT,

  error_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_pri ON jobs(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_locked ON jobs(locked_at, locked_by);
```

### 11.5 转码缓存索引

```sql
CREATE TABLE IF NOT EXISTS transcode_cache (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  profile TEXT NOT NULL,         -- mp3_192 / aac_128 / ...
  source_mtime_ms INTEGER NOT NULL,
  encoder_version TEXT NOT NULL, -- 便于参数变化后失效缓存
  path TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_access_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_transcode_cache_key
ON transcode_cache(track_id, profile, source_mtime_ms, encoder_version);
```

## 12. docker compose（可直接落地的示例）

> 建议：对外用 Caddy/Nginx/Traefik 做 HTTPS；内网可先直连 `:3000`。

### 12.1 环境变量（建议）

- `DATABASE_URL=file:/data/app.db`
- `MUSIC_ROOT=/music`
- `TRANSCODE_CACHE=/cache`
- `AUTH_SECRET=...`
- `WORKER_CONCURRENCY=2`
- `TRANSCODE_MAX_JOBS=1`（可选：更严格的转码并发控制）

### 12.2 docker-compose.yml 示例

> 详见仓库根目录示例文件：`docker-compose.yml`（下方亦给出）。
