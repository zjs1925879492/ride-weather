# 顽鹿与行者路书导入服务

此目录为与网站版本一起保存的 Cloudflare Worker 源码。本机 `dev-server.mjs` 直接复用 `converter.mjs` 和 `xingzhe.mjs`，无需额外目录或安装依赖。网站静态构建不会复制此目录。

## 接口

- `POST /api/convert`：顽鹿链接，JSON 参数 `url`、`coordinateSystem`。
- `POST /api/xingzhe`：行者公开分享链接，JSON 参数 `url`。
- `GET /health`：版本及支持平台。

Worker 沿用既有来源检查、约每 IP 每分钟 12 次的限额绑定、响应与点数上限、超时、日志及追踪设置。不转发用户登录信息，不保存路线到数据库。行者通过分享页使用的匿名公开轨迹生成 GPX，不调用需要登录的官方 GPX 下载接口。

## 部署

上传 `worker.mjs`、`converter.mjs`、`xingzhe.mjs`、`gcoord.mjs`、`static-content.mjs` 五个 ES 代码模块，并以单独的 `metadata.json` 指定配置。`gcoord-LICENSE.txt` 记录 gcoord 0.3.2 的 MIT 许可，原独立转换工具首页也保留许可入口。

保留既有 `CONVERT_LIMITER` 绑定与兼容日期。部署服务名称为 `onelap-gpx`；只上传新版本会立即部署，应先完成检查，发布后复核 `/health` 和两个导入接口。代码不包含 Cloudflare API 令牌。

检查：从仓库根目录执行 `node services/route-import/check-worker.mjs`（模拟上游的 Node 检查）和 `node services/route-import/check-onelap.mjs`（访问顽鹿真实公开路书的 Node 检查）。Node 检查通过不等于已验证 Cloudflare 运行环境，发布后还需要实际请求。
