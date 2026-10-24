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

## 本地运行与检查

使用已有 Python：`python -m http.server 8765`，然后访问 `http://127.0.0.1:8765`。

使用 Node.js 检查核心计算：`node check.mjs`，不需要安装依赖。

## 数据与范围

- 天气：[Open-Meteo](https://open-meteo.com/)，其免费 API 限个人非商业用途，需遵守官方调用额度与署名要求。
- 地名：[Photon](https://photon.komoot.io/) / OpenStreetMap，公共服务仅适合合理请求量，可能限流或不可用。
- 地图：[OpenStreetMap contributors](https://www.openstreetmap.org/copyright)。地图组件 Leaflet 1.9.4 的许可见 assets/LEAFLET-LICENSE.txt。
- GPX 在浏览器解析，不上传完整文件；查询天气和地名时向相应服务发送采样点坐标。缓存仅在本次页面内存中。
- 区域是采样点附近地名，不是严格的行政边界相交结果，可能遗漏短距离跨界。预报按最近整点匹配，天气与到达时刻均有误差。
- 此版本支持未来 15 天内的骑行计划，不提供历史天气。所有输入和显示时间均为北京时间。
- 示例含 2,352 个轨迹点，几何长度约 127.32 km（平台标注 126.812 km），没有高程。原坐标按顽鹿编辑器逻辑推断为 BD-09 后转为 WGS84，未实地核验。
