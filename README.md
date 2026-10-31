# 财小通官网

纯静态实现，无构建依赖。在仓库根目录运行本地预览：

```powershell
python .\tools\preview_server.py
```

随后访问 `http://127.0.0.1:4173`。

MP4、PNG 和 WebP 资源使用 Git LFS 管理，包括已有资源。克隆仓库前安装 Git LFS；已有工作目录可执行 `git lfs pull` 获取完整文件。部署时使用下载了 LFS 资源的工作目录，避免将指针文件当作图片或视频发布。

页面截图于 2026-10-31 从财小通当前代码的原生 Compose preview 重新渲染，账号、金额及付款码均为虚构数据。`assets/` 保留 PNG 原图，网页使用 480px / 960px 两档无损 WebP，并按需加载。

四页展示使用约 74 秒的连续原生录制，涵盖付款码放大、充值金额选择、房间切换、水电及校园网缴费、账单筛选及统计、账户与主题设置等 12 项操作。页面切换、弹层收起和滚动保留同一应用会话的连续状态。原有功能标签根据 `assets/demos/tour.json` 跳转章节，手动选择只播放该项并停留；点击播放按钮可继续完整演示。

演示屏幕和控制区完整进入视口、停留 500ms 后才自动播放。离开区域、切到后台或打开手机导航菜单会暂停，回来后继续当前进度。接近展示区时只预载素材，减少动态效果偏好默认暂停。素材未就绪时保留当前画面，不显示加载或失败文案。

主题区域使用三个手机：中间保持浅色的原生主题设置页，两侧同步播放浅色和深色应用效果。展示悬浮底栏开关、默认 / iOS 样式、顶底栏模糊与预测性返回手势。设置操作和效果按相同时间轴捕获，页面滚动与个人页进入也实际录制；任一视频缓冲时三屏一起等待。手动选择的效果结束后停留，不叠加挡住界面的标签。

四页操作展示使用开启底栏模糊的 iOS 悬浮样式。主题区域的样式切换保持模糊关闭，iOS 底栏显示不透明表面，模糊效果由对应开关单独控制。

手机演示和操作区根据可用屏幕高度布局，保持按钮至少 44px 的点击范围；手机横屏采用两列。宽度至少 1101px、高度至少 700px 的电脑端按模块翻页，一次滚轮或触控板手势只切换一段，过滤惯性；PageUp / PageDown 和空格使用相同翻页方式。手机页面跟随手指拖动，松手后落到下一段，轻微拖动回到原位。内容超过一屏时先在本段滚动，下载和安装说明合为一段。减少动态效果偏好保持自然滚动；点击、横向滑动、双指缩放和内部滚动容器不受影响。

动画由当前 Android Compose 组件逐帧渲染，使用 576px、20fps 的静音 H.264 MP4。`tools/WebsiteMotionTest.kt` 与 `tools/WebsiteThemeTest.kt` 记录操作；原始 PNG 帧留在 Android 项目的工具目录，网页仅包含视频和 WebP 封面。本地预览服务器支持视频字节范围请求，便于章节跳转和同步播放。重新生成：

```powershell
.\tools\render_demos.ps1 -AndroidRepo D:\mercu\Desktop\yktwx
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-motion-frames --ffmpeg D:\ffmpeg\bin\ffmpeg.exe --tour
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-motion-frames --ffmpeg D:\ffmpeg\bin\ffmpeg.exe --theme-only
```

渲染脚本从 Android 仓库 HEAD 创建隔离快照，仅在快照内启用多个示例房间、隐藏预览提示。保留预览数据及支付限制，操作不提交订单，也不触发实际充值。需要 Android 项目的 JDK/SDK 环境，以及安装 Pillow 的 Python 和 FFmpeg。

当前仅作页面预览。下载区保留私有 GitHub 仓库的发布页链接；公开上线前替换为实际可访问的正式安装包地址，并同步版本信息。
