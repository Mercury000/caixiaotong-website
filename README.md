# 财小通官网

纯静态实现，无构建依赖。在仓库根目录运行本地预览：

```powershell
python .\tools\preview_server.py
```

随后访问 `http://127.0.0.1:4173`。

MP4、PNG 和 WebP 资源使用 Git LFS 管理，包括已有资源。克隆仓库前安装 Git LFS；已有工作目录可执行 `git lfs pull` 获取完整文件。部署时使用下载了 LFS 资源的工作目录，避免将指针文件当作图片或视频发布。

页面截图于 2026-10-31 从财小通当前代码的原生 Compose preview 重新渲染，账号、金额及付款码均为虚构数据。`assets/` 保留 PNG 原图，网页使用 480px / 960px 两档无损 WebP，并按需加载。

首屏“观看介绍”按钮打开 56 秒推广视频，支持声音、进度拖动和全屏。视频与封面在首次点击后加载；打开时暂停背景演示并锁定页面滚动，关闭后保留原来的页面位置和播放进度。`assets/promo/intro.mp4` 来自 Android 项目 `promo-video/财小通-推广介绍-1080p.mp4`，保留 1080p、H.264 / AAC 编码，仅将播放索引移到文件开头以便网页起播；封面从视频截取。

四页展示默认使用静态截图，切换时交叉淡入淡出。点击下方功能标签后才加载对应的原生短演示，结束后显示该功能的静态预览。“双码展示”回到付款页面；“轻触放大”依次展示二维码和条形码放大，其余标签对应充值、房间管理、账单与账户设置等操作。

浏览四页和主题区域不加载或自动播放视频，仅在接近模块时预载静态图片。点击演示后，静态底图保持显示，视频首帧就绪才淡入；加载失败时仍可切换页面和功能。播放完成、离开区域、切到后台或打开弹窗与手机导航时释放视频和解码器。播放期间可暂停、继续；减少动态效果偏好禁用过渡动画，手动点击仍可播放。

主题区域使用三个手机：中间保持浅色的原生主题设置页，两侧显示浅色和深色应用效果。默认显示静态图；点击悬浮底栏、底栏样式、模糊效果或预测性返回时才加载三屏同步短演示。设置操作和效果按相同时间轴捕获；缓冲或加载失败时保留静态预览，播放结束后释放三屏视频。

四页操作展示使用开启底栏模糊的 iOS 悬浮样式。主题区域的样式切换保持模糊关闭，iOS 底栏显示不透明表面，模糊效果由对应开关单独控制。

手机演示和操作区根据可用屏幕高度布局，保持按钮至少 44px 的点击范围；手机横屏采用两列。宽度至少 1101px、高度至少 700px 的电脑端按模块翻页，一次滚轮或触控板手势只切换一段，过滤惯性；PageUp / PageDown 和空格使用相同翻页方式。手机页面跟随手指拖动，松手后落到下一段，轻微拖动回到原位。内容超过一屏时先在本段滚动，下载和安装说明合为一段。减少动态效果偏好保持自然滚动；点击、横向滑动、双指缩放和内部滚动容器不受影响。

动画由当前 Android Compose 组件逐帧渲染，使用 576px、20fps 的静音 H.264 MP4。`tools/WebsiteMotionTest.kt` 与 `tools/WebsiteThemeTest.kt` 记录操作；原始 PNG 帧留在 Android 项目的工具目录，网页仅包含短视频和 WebP 静态预览。本地预览服务器支持视频字节范围请求。重新生成：

```powershell
.\tools\render_demos.ps1 -AndroidRepo D:\mercu\Desktop\yktwx
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-motion-frames --ffmpeg D:\ffmpeg\bin\ffmpeg.exe --showcase-only
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-motion-frames --ffmpeg D:\ffmpeg\bin\ffmpeg.exe --theme-only
```

渲染脚本从 Android 仓库 HEAD 创建隔离快照，仅在快照内启用多个示例房间、隐藏预览提示。保留预览数据及支付限制，操作不提交订单，也不触发实际充值。需要 Android 项目的 JDK/SDK 环境，以及安装 Pillow 的 Python 和 FFmpeg。

当前仅作页面预览。下载区保留私有 GitHub 仓库的发布页链接；公开上线前替换为实际可访问的正式安装包地址，并同步版本信息。
