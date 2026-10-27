# Contest Compass

一个适合日常算法训练的随机抽题工具。支持 Codeforces、AtCoder 或两站混合随机抽题，可按难度与标签筛选、排除 Codeforces 已 AC 题目、管理收藏与练习历史，并导出题面。

## 本地运行

需要 Node.js 20 或更新版本。

```powershell
npm ci
npm run dev
```

访问终端显示的本地地址。生产构建和检查：

```powershell
npm run check
```

## 题面导出

- **Codeforces**：使用公开 `problemset.problems` API 获取题目、分数与算法标签。
- **AtCoder**：使用 [AtCoder Problems](https://kenkoooo.com/atcoder/) 的 `problems.json` 与 `problem-models.json` 获取题目和难度。该 API 没有算法标签，页面用 ABC / ARC / AGC 等比赛系列作为标签。
- **题面正文**：这两个题库 API 均不提供正文。打开原题复制文字，粘贴到「题面导出」页面后自动保存在本机，再导出 Markdown、HTML 或通过打印窗口保存 PDF。
- 收藏题单可以导出 CSV 或 JSON。题单、历史、已完成状态和补充题面保存在浏览器或桌面客户端的本地存储中。

在线题库失败时，自动使用随项目提供的两个备用元数据题库。要更新备用数据，可运行 `node scripts/refresh-fallback.mjs`。两站难度来自各自的评级体系，混合筛选时仅作粗略参考。

## 部署 GitHub Pages

1. 将此目录推送到 GitHub 仓库的 `main` 分支。
2. 在仓库 **Settings → Pages → Build and deployment** 选择 **GitHub Actions**。
3. `.github/workflows/pages.yml` 会在每次推送到 `main` 时检查并部署 `dist/`。

Vite 使用相对资源路径，项目站点与用户主页站点均可部署。

## 下载客户端

网页支持安装为 PWA。将站点发布到 HTTPS 后，在支持的浏览器中可点击「客户端与设置 → 安装网页客户端」或通过浏览器菜单安装。备用题库和已缓存资源可离线使用。

桌面版基于 Electron。推送版本标签，例如 `v1.0.0`，`.github/workflows/client.yml` 会并行构建以下文件并上传到 GitHub Releases：

| 系统 | 下载格式 |
| --- | --- |
| Windows x64 | 便携版 `.exe` |
| macOS Intel / Apple Silicon | `.dmg` 与 `.zip` |
| Linux x64 | `.AppImage` 与 `.deb` |

站内三个平台的下载入口会打开最新 Release 页面。工作流也可以手动启动，此时构建产物可从 Actions 下载。各系统可在本机运行：

```powershell
npm run desktop
npm run desktop:pack:win
npm run desktop:pack:mac
npm run desktop:pack:linux
```

桌面版不会自动同步浏览器的本地数据；两者各自保存自己的题单和题面。
