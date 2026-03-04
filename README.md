# Music Tagger

音乐标签管理应用 - 扫描音乐文件、编辑元数据、在线播放

## 功能

- 📂 音乐扫描 - 扫描本地目录，解析 ID3 标签
- ✏️ 元数据编辑 - 手动编辑/批量修改歌曲信息
- 🎵 在线播放 - Web 端播放音乐
- 🏷️ 标签管理 - 艺术家、专辑、流派分类

## 技术栈

- Next.js 16 + tRPC + Prisma
- SQLite 数据库
- React 19.2 + TypeScript
- Tailwind CSS
- music-metadata (音频解析)

## 开发

```bash
# 安装依赖
npm install

# 运行开发服务器
npm run dev

# 构建
npm run build
```

## 部署 (Docker)

```bash
docker build -t music-tagger .
docker run -p 3000:3000 -v /path/to/music:/app/music -v /path/to/data:/app/data music-tagger
```
