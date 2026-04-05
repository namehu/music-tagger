# Playback Runtime And Modes

本文档专门解释当前播放器重构后的状态分层、运行时职责和业务流转。它对应代码中的：

- [playback-store.ts](/Users/namehu/github/music-tagger/web/store/playback-store.ts)
- [playback-runtime.tsx](/Users/namehu/github/music-tagger/web/components/playback/playback-runtime.tsx)
- [global-player.tsx](/Users/namehu/github/music-tagger/web/components/playback/global-player.tsx)
- [playback-state.ts](/Users/namehu/github/music-tagger/web/lib/playback-state.ts)

## 1. 总体目标

- 让播放状态不再依附某个页面或某个 provider 实例
- 让顺序、随机、单曲循环复用同一套全局 queue 语义
- 让浏览器刷新后能恢复当前会话，但不恢复失效的 URL / token
- 把副作用和业务状态拆开，方便调试和后续扩展

## 2. 播放状态分层图

```mermaid
flowchart TD
  UI["Library / Playlist / Dashboard / GlobalPlayer"]
  Store["Zustand Playback Store<br/>queue / displayTrack / mode / progress / resumeLock"]
  Computed["Computed Selectors<br/>currentTrack / previousTrack / nextTrack / canPlayNext"]
  Runtime["PlaybackRuntime<br/>resolve / polling / audio events"]
  Audio[HTMLAudioElement]
  API["tRPC playback.resolve<br/>playback.getPreparationStatus"]
  Stream["/api/stream/[trackId]"]
  Local[(localStorage)]

  UI --> Store
  Store --> Computed
  UI --> Computed
  Store --> Runtime
  Runtime --> API
  Runtime --> Audio
  Audio --> Runtime
  Runtime --> Store
  Store --> Local
  Runtime --> Stream
```

## 3. store 与 runtime 的职责边界

| 层 | 负责内容 | 不负责内容 |
| --- | --- | --- |
| `playback-store.ts` | 持有 queue、当前曲目、模式、恢复锁、进度、音量、错误态；提供切歌 action；用 computed 产出派生状态 | 不直接发网络请求；不轮询 job；不直接操作 `audio.play()` 之外的异步链路 |
| `playback-runtime.tsx` | 监听 `resolveRequest`、调用 `playback.resolve`、轮询 `getPreparationStatus`、消费 `audio` 事件、把结果回写 store | 不保存业务事实状态；不决定上一首/下一首算法 |
| `global-player.tsx` | 渲染底部播放器 UI、绑定 `audio` 元素、触发模式按钮和控制按钮 | 不持有独立播放状态；不决定 token 恢复策略 |
| 页面组件 | 注入当前页面 queue、触发用户主动点播 | 不自己管理全局播放会话 |

## 4. localStorage 恢复链路图

```mermaid
sequenceDiagram
  autonumber
  participant Boot as App Boot
  participant Store as Playback Store
  participant LS as localStorage
  participant RT as PlaybackRuntime
  participant API as playback.resolve
  participant Audio as HTMLAudioElement

  Boot->>Store: persist rehydrate
  Store->>LS: 读取 queue / displayTrack / mode / progress
  Store->>Store: restoreFromPersistedSession()
  Store->>Store: hydrationStatus = resolving
  Store->>Store: resumeLock = true
  Store->>RT: resolveRequest(seq, track, profile, autoPlay=false)
  RT->>API: playback.resolve(trackId, profile)
  API-->>RT: ready(url) 或 preparing(jobId)
  alt ready(url)
    RT->>Store: writeResolvedPlayback(url)
  else preparing(jobId)
    RT->>Store: writeResolvePreparing(jobId)
    RT->>API: 轮询 getPreparationStatus(jobId)
    API-->>RT: done
    RT->>Store: retryPreparingRequest()
    RT->>API: playback.resolve(trackId, profile)
    API-->>RT: ready(url)
    RT->>Store: writeResolvedPlayback(url)
  end
  Store->>Audio: pendingResumeTimeSec + autoPlayOnReady=false
  Audio->>Store: loadedmetadata
  Audio->>Audio: seek 到上次进度
  Audio->>Audio: pause()
  Store->>Store: hydrationStatus = ready
```

## 5. 业务流转图

### 5.1 用户从曲库点播

```mermaid
flowchart TD
  A["/library 结果集变化"] --> B["被动 setQueue(user-library)"]
  B --> C{"resumeLock 或旧上下文冲突?"}
  C -->|是| D["忽略覆盖"]
  C -->|否| E["更新 queue"]
  F["用户点击某首歌"] --> G{"当前 queueSourceKey 是否已是 user-library"}
  G -->|否| H["replaceQueueFromUserIntent"]
  G -->|是| I["沿用当前 queue"]
  H --> J["requestPlayTrack"]
  I --> J
  J --> K["PlaybackRuntime resolve"]
  K --> L["GlobalPlayer 播放"]
```

### 5.2 用户从歌单点播

```mermaid
flowchart TD
  A["/playlists/id 加载成功"] --> B["按歌单顺序被动 setQueue"]
  C["用户点击歌单项"] --> D{"当前上下文是否已是该歌单"}
  D -->|否| E["replaceQueueFromUserIntent: playlist:id"]
  D -->|是| F["直接 requestPlayTrack"]
  E --> F
  F --> G["ordered 模式按保存顺序切歌"]
  F --> H["shuffle 模式随机下一首"]
  F --> I["repeat_one 自然结束重播当前曲目"]
```

### 5.3 浏览器刷新恢复

```mermaid
flowchart TD
  A["刷新页面"] --> B["persist rehydrate"]
  B --> C{"有 displayTrack + profile?"}
  C -->|否| D["直接 ready"]
  C -->|是| E["restoreFromPersistedSession"]
  E --> F["resumeLock = true"]
  F --> G["重新 resolve 播放 URL"]
  G --> H["loadedmetadata 后 seek"]
  H --> I["保持暂停"]
  I --> J["等待用户继续播放或切换上下文"]
```

## 6. 模式切歌决策图

```mermaid
flowchart TD
  A["收到播放推进事件"] --> B{"触发来源"}
  B -->|手动上一首| C{"playbackMode"}
  B -->|手动下一首| D{"playbackMode"}
  B -->|自然播放结束| E{"playbackMode"}

  C -->|shuffle| F["从 shuffleHistory 取最后一首"]
  C -->|ordered / repeat_one| G["按 queue 线性取上一首"]

  D -->|shuffle| H["从 queue 中随机选非当前曲目"]
  D -->|ordered| I["按 queue 线性取下一首"]
  D -->|repeat_one| I

  E -->|repeat_one| J["重播当前曲目"]
  E -->|shuffle| H
  E -->|ordered| I
```

## 7. 为什么还需要 `PlaybackRuntime`

虽然业务状态已经迁到 `zustand`，但浏览器播放仍然需要一个常驻客户端组件承接这些副作用：

- 调 `playback.resolve`
- 轮询 `playback.getPreparationStatus`
- 绑定真实 `audio` 元素
- 接收 `play / pause / ended / loadedmetadata / timeupdate` 事件
- 在 `pagehide` 时强制同步最新进度

所以这次不是“没有运行时组件”，而是“运行时组件不再持有业务状态”。

## 8. 当前恢复策略的边界

- 只恢复当前浏览器，不做数据库同步
- 不保存 URL / token，只保存可重建状态
- 恢复后默认暂停，不自动续播
- 页面挂载时的被动 queue 不能覆盖恢复中的旧会话
- 只有明确用户意图，才允许替换当前恢复队列
