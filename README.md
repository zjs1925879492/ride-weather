# 沿途 · 骑行天气

导入 GPX，查看骑行路线、附近区域和预计到达时的天气。

## 使用

1. 粘贴顽鹿详情链接导入，或上传 WGS84 坐标的 GPX，也可载入环滆湖示例。
2. 设置出发时间（北京时间）、骑行均速、总休息时间和采样间距。
3. 点击“查询沿途天气”，在天气卡片与地图之间查看各点详情。

支持温度、体感温度、降雨概率、降水量、风速、阵风及按局部行进方向估算的迎风/顺风分量。最多采样 18 个点。

## GitHub Pages

这是无需构建的静态网站。在仓库 Settings → Pages 中选择 Deploy from a branch，发布 main 分支的 / (root)。`.nojekyll` 禁用 Jekyll 处理。所有资源使用相对路径，支持仓库子路径部署。

后续更新网页文件并提交到 main 后，GitHub Pages 会自动重新发布。

## 地图提供商

地图左上角可以切换提供商：

- OpenTopoMap：备用地形图，不需要 Key，保留来源署名；服务在海外，国内网络仍需实测。
- OpenStreetMap：保留为备用。无底图成功加载时，会在超时或连续失败后尝试一次备用源，不循环重试。
- 天地图矢量／影像：默认使用矢量底图和中文注记，可切换影像。`map-config.js` 保存网站所有者提供的公开浏览器端配置；Key 需要限制到两个发布域名。此 Key 会在网页和瓦片请求中可见，不适用于服务端秘密。地图设置仍支持临时填写其他 Key，刷新后恢复网站默认值。

轨迹与天气查询沿用 GPX 地理坐标，天地图使用 `_w` 墨卡托瓦片；未接入需要 GCJ-02 或 BD-09 偏移的高德、百度瓦片。实际授权取决于天地图控制台的 Key 类型与域名白名单。

本次移除了 Google Fonts 请求，字体使用设备已有字体。地图、天气、地名是三个独立外部服务，更换地图或部署平台不会自动解决其他接口的网络问题。

## Cloudflare 部署

当前已通过 Cloudflare Workers Builds 连接本仓库的 main 分支。构建时只复制网页、脚本、`map-config.js` 和 assets 到 public 目录，再发布该目录；避免将 node_modules 作为地图资源上传。后续 main 提交自动发布。旧的 Pages 手动部署步骤见 [CLOUDFLARE.md](./CLOUDFLARE.md)。

## 本地运行与检查

使用已有 Python：`python -m http.server 8765`，然后访问 `http://127.0.0.1:8765`。

使用 Node.js 检查核心计算：`node check.mjs`，不需要安装依赖。

地图逻辑测试：`node maps-check.mjs`，检查 Key 校验与隔离、底图和注记顺序、缩放限制、仅一次自动备用、清除 Key。

## 数据与范围

- 天气：[Open-Meteo](https://open-meteo.com/)，其免费 API 限个人非商业用途，需遵守官方调用额度与署名要求。
- 地名：[Photon](https://photon.komoot.io/) / OpenStreetMap，公共服务仅适合合理请求量，可能限流或不可用。
- 地图：默认 [天地图](https://www.tianditu.gov.cn/)，备用 [OpenTopoMap](https://opentopomap.org/about)（地图署名 OpenStreetMap、SRTM、OpenTopoMap，CC-BY-SA），备用 [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，可选 [天地图](https://www.tianditu.gov.cn/)。地图组件 Leaflet 1.9.4 的许可见 assets/LEAFLET-LICENSE.txt。
- GPX 在浏览器解析，不上传完整文件；查询天气和地名时向相应服务发送采样点坐标。缓存仅在本次页面内存中。
- 区域是采样点附近地名，不是严格的行政边界相交结果，可能遗漏短距离跨界。预报按最近整点匹配，天气与到达时刻均有误差。
- 此版本支持未来 15 天内的骑行计划，不提供历史天气。所有输入和显示时间均为北京时间。
- 示例含 2,352 个轨迹点，几何长度约 127.32 km（平台标注 126.812 km），没有高程。原坐标按顽鹿编辑器逻辑推断为 BD-09 后转为 WGS84，未实地核验。


## 顽鹿链接导入

页面支持 myroute 分享路线和 route 数字 ID 公开路书。调用独立 Cloudflare Worker `https://onelap-gpx.changanxiaoxiang.workers.dev/api/convert`，接收 GPX 后复用本地 GPX 解析、地图、采样和天气查询。默认在导入成功后自动查询当前出发计划的天气，可取消勾选。保留上传、拖入 GPX、下载转换文件、示例、地图选择和“现在”按钮。

转换服务访问失败、限流或数据无效时不替换当前路书。导入期间禁止重复操作和并发修改路线；自动查询使用现有出发计划。源坐标默认 BD-09 为既有样本推断，提供手动坐标选择，不能保证所有路线原坐标一致。

转换接口依赖 workers.dev 的网络可达性，网页可打开不等于转换服务可达。本地 GPX 导入不依赖转换后端。天气、地名服务仍单独联网查询。测试：`node onelap-check.mjs`。
