# 财小通官网

纯静态实现，无构建依赖。直接打开 `index.html`，或在仓库根目录运行：

```powershell
python .\tools\preview_server.py
```

随后访问 `http://127.0.0.1:4173`。

页面截图于 2026-10-31 从财小通当前代码的原生 Compose preview 重新渲染，账号、金额及付款码均为虚构数据。`assets/` 保留 PNG 原图，网页使用 480px / 960px 两档无损 WebP，并按需加载。

四页展示进入视口后自动依次播放付款码放大、充值金额选择、房间切换、水电及校园网缴费、账单筛选及统计、账户与主题设置等 12 段原生操作。沿用原有功能标签，点选可切换，右下角图标可暂停；离开视口或切到后台会暂停，减少动态效果偏好默认停在静态画面。素材未就绪时保留当前画面，不显示加载或失败文案。

主题区域使用三个手机：中间始终保持浅色的原生主题设置页，两侧同步播放浅色和深色应用效果。展示悬浮底栏开关、默认 / iOS 样式、顶底栏模糊与预测性返回手势。设置操作和效果按相同时间轴捕获，不叠加挡住界面的标签。素材切换仅对屏幕内容做短暂淡入，手机外框保持稳定。

动画由当前 Android Compose 组件逐帧渲染，使用 576px、20fps 的静音 H.264 MP4，并只预载下一组。`tools/WebsiteMotionTest.kt` 与 `tools/WebsiteThemeTest.kt` 记录操作；原始 PNG 帧留在 Android 项目的工具目录，网页仅包含视频和 WebP 封面。本地预览服务器支持视频字节范围请求，便于暂停、拖动和同步播放。重新生成：

```powershell
.\tools\render_demos.ps1 -AndroidRepo D:\mercu\Desktop\yktwx
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-motion-frames --ffmpeg D:\ffmpeg\bin\ffmpeg.exe
```

渲染脚本从 Android 仓库 HEAD 创建隔离快照，仅在快照内启用多个示例房间、隐藏预览提示。保留预览数据及支付限制，操作不提交订单，也不触发实际充值。需要 Android 项目的 JDK/SDK 环境，以及安装 Pillow 的 Python 和 FFmpeg。

当前仅作页面预览。下载区保留私有 GitHub 仓库的发布页链接；公开上线前替换为实际可访问的正式安装包地址，并同步版本信息。
