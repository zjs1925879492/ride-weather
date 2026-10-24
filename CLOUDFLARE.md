# 把沿途部署到 Cloudflare Pages

使用现有仓库 https://github.com/zjs1925879492/ride-weather 即可，不需要另买服务器或域名。

## 推荐：连接 GitHub 自动部署

1. 登录 https://dash.cloudflare.com/ 。
2. 进入 Workers & Pages → Create application → Pages → Import an existing Git repository / Connect to Git。
3. 选择 GitHub，按界面完成授权，只授权 `ride-weather` 这一个仓库即可。此授权需要由账号所有者完成。
4. 选择 `zjs1925879492/ride-weather`，开始设置。
5. 按下表填写，然后 Save and Deploy。

| 设置 | 值 |
| --- | --- |
| Project name | `ride-weather` 或未被占用的名称 |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `exit 0` |
| Build output directory | `.` |
| Root directory / Path | 留空，使用仓库根目录 |
| Environment variables | 不需要 |

本仓库的 index.html、app.js、maps.js、assets 已直接放在根目录；不要将输出目录填成 dist，也不要使用 Next.js / React 模板或 Workers 的 wrangler 部署命令。

部署成功后，Cloudflare 会给出实际的 `https://<项目名>.pages.dev` 地址，以控制台显示为准。GitHub Pages 可以继续保留，两边各用各的网址。

连接 GitHub 后，后续提交到 main 会自动更新 Cloudflare Pages。初次部署失败时，查看部署日志，重点确认输出目录中有 index.html。

## 备选：直接上传

不连接 GitHub 时，可在创建 Pages 项目时选择 Direct Upload / Upload assets，把部署包解压后的所有网站文件上传。上传根目录应直接出现 index.html，而不是在外面再套一层 ride-weather 或 dist 文件夹。直接上传模式不自动跟随 GitHub 提交更新；需重新上传。

## 地图和接口

- OpenTopoMap 不需要 Key，但属于海外服务，国内是否稳定需要在你的网络测试。
- 天地图需要你自己的浏览器端 Key。在页面“地图设置”中填写，并在天地图控制台配置实际使用的网站来源。Cloudflare 地址与 GitHub Pages 地址不同，需要分别配置。
- 天地图 Key 仅在当前页面中使用，不需要放入 Cloudflare 环境变量或 GitHub 仓库。当前设计刷新后需要重新填写。
- 免费 Pages 托管不意味着地图、天气和地名服务无限额，也不保证中国大陆所有网络访问稳定。当前天气 Open-Meteo、地名 Photon 仍是独立海外接口。
- 如果后续使用需要保密的服务端 Key，要改为后端代理并使用服务端环境变量；纯静态网页无法隐藏写进 JavaScript 的秘密。

## 验证

1. 打开发布网址，确认能载入环滆湖示例。
2. 左上角地图选择器能切换 OpenTopoMap / OpenStreetMap。
3. 如配置了真实天地图 Key，确认中文底图和路线叠加位置，并测试矢量／影像切换。
4. 设置未来 15 天内的北京时间，查询天气，检查地名、温度、降雨和风况。

官方说明：

- https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/get-started/direct-upload/
