# 沿途 · 骑行天气

导入 GPX，查看骑行路线、附近区域和预计到达时的天气。

## 使用

1. 打开网站，载入环滆湖示例或上传 WGS84 坐标的 GPX。
2. 设置出发时间（北京时间）、骑行均速、总休息时间和采样间距。
3. 点击“查询沿途天气”，在天气卡片与地图之间查看各点详情。

支持温度、体感温度、降雨概率、降水量、风速、阵风及按局部行进方向估算的迎风/顺风分量。最多采样 18 个点。

## GitHub Pages

这是无需构建的静态网站。在仓库 Settings → Pages 中选择 Deploy from a branch，发布 main 分支的 / (root)。`.nojekyll` 禁用 Jekyll 处理。所有资源使用相对路径，支持仓库子路径部署。

后续更新网页文件并提交到 main 后，GitHub Pages 会自动重新发布。

## 地图提供商

地图左上角可以切换提供商：

- OpenTopoMap：默认地形图，不需要 Key，保留来源署名；服务在海外，国内网络仍需实测。
- OpenStreetMap：保留为备用。无底图成功加载时，会在超时或连续失败后尝试一次备用源，不循环重试。
- 天地图矢量／影像：国内服务入口，包含中文注记，需要在地图设置中填写自己申请的浏览器端 Key。Key 只留在本页内存中，发送给天地图官方瓦片接口；不会提交到本仓库或网站服务器。不要在仓库中提交 Key。刷新页面后需重新填写。

轨迹与天气查询沿用 GPX 地理坐标，天地图使用 `_w` 墨卡托瓦片；未接入需要 GCJ-02 或 BD-09 偏移的高德、百度瓦片。天地图需要真实 Key 后继续验证授权与路线叠加。

本次移除了 Google Fonts 请求，字体使用设备已有字体。地图、天气、地名是三个独立外部服务，更换地图或部署平台不会自动解决其他接口的网络问题。

## Cloudflare Pages

详细步骤见 [CLOUDFLARE.md](./CLOUDFLARE.md)。选择 GitHub 中的此仓库，生产分支 main，框架 None，构建命令 exit 0，输出目录 `.`，根目录保持默认。仓库文件已位于根目录，此处不填写 dist。

## 本地运行与检查

使用已有 Python：`python -m http.server 8765`，然后访问 `http://127.0.0.1:8765`。

使用 Node.js 检查核心计算：`node check.mjs`，不需要安装依赖。

地图逻辑测试：`node maps-check.mjs`，检查 Key 校验与隔离、底图和注记顺序、缩放限制、仅一次自动备用、清除 Key。

## 数据与范围

- 天气：[Open-Meteo](https://open-meteo.com/)，其免费 API 限个人非商业用途，需遵守官方调用额度与署名要求。
- 地名：[Photon](https://photon.komoot.io/) / OpenStreetMap，公共服务仅适合合理请求量，可能限流或不可用。
- 地图：默认 [OpenTopoMap](https://opentopomap.org/about)（地图署名 OpenStreetMap、SRTM、OpenTopoMap，CC-BY-SA），备用 [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，可选 [天地图](https://www.tianditu.gov.cn/)。地图组件 Leaflet 1.9.4 的许可见 assets/LEAFLET-LICENSE.txt。
- GPX 在浏览器解析，不上传完整文件；查询天气和地名时向相应服务发送采样点坐标。缓存仅在本次页面内存中。
- 区域是采样点附近地名，不是严格的行政边界相交结果，可能遗漏短距离跨界。预报按最近整点匹配，天气与到达时刻均有误差。
- 此版本支持未来 15 天内的骑行计划，不提供历史天气。所有输入和显示时间均为北京时间。
- 示例含 2,352 个轨迹点，几何长度约 127.32 km（平台标注 126.812 km），没有高程。原坐标按顽鹿编辑器逻辑推断为 BD-09 后转为 WGS84，未实地核验。
