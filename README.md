# 财小通官网

纯静态实现，无构建依赖。在仓库根目录运行本地预览：

```powershell
python .\tools\preview_server.py
```

随后访问 `http://127.0.0.1:4173`。

MP4、PNG 和 WebP 资源使用 Git LFS 管理，包括已有资源。克隆仓库前安装 Git LFS；已有工作目录可执行 `git lfs pull` 获取完整文件。部署时使用下载了 LFS 资源的工作目录，避免将指针文件当作图片或视频发布。

页面截图于 2026-10-31 从财小通当前代码的原生 Compose preview 重新渲染，账号、金额及付款码均为虚构数据。`assets/` 保留 PNG 原图，网页使用 480px / 960px 两档无损 WebP，并按需加载。

首屏“观看介绍”按钮打开 56 秒推广视频，支持声音、进度拖动和全屏。视频与封面在首次点击后加载；打开时暂停背景演示并锁定页面滚动，关闭后保留原来的页面位置和播放进度。`assets/promo/intro.mp4` 来自 Android 项目 `promo-video/财小通-推广介绍-1080p.mp4`，保留 1080p、H.264 / AAC 编码，仅将播放索引移到文件开头以便网页起播；封面从视频截取。

四页展示默认使用静态截图，切换时交叉淡入淡出。点击下方功能标签后保留当前画面，视频首帧呈现时再平滑接入，避免先跳到功能预览再倒回操作起点；缓冲时保持当前帧。播放结束保留最后一帧并释放解码器，加载失败使用功能静态预览。“号码保护”演示完整付款码号的查看与隐藏，条码与二维码保持可用；“轻触放大”依次展示二维码和条形码放大，其余标签对应充值、房间管理、账单与账户设置等操作。

浏览四页和主题区域不加载或自动播放视频，仅在接近模块时预载静态图片。点击演示后，静态底图保持显示，视频首帧就绪才淡入；加载失败时仍可切换页面和功能。播放完成、离开区域、切到后台或打开弹窗与手机导航时释放视频和解码器。播放期间可暂停、继续；减少动态效果偏好禁用过渡动画，手动点击仍可播放。

网站默认跟随系统的深浅偏好，顶部按钮可切换并记住选择。首屏、四页截图、功能预览和短演示使用对应模式的原生渲染素材；切换模式时停止正在播放的演示并回到静态图。初始配色在样式加载前确定，避免浅色背景闪烁。

主题区域的背景由柔和光晕与轻阴影融入页面。底栏贴底或悬浮、默认或 iOS 悬浮样式、底栏与顶栏模糊分别控制，组合时保留其他选项；切回贴底时隐藏悬浮样式，再次悬浮仍保留所选样式，按钮淡入显示。十二种组合各有当前深浅模式下的原生静态图、滚动和手势返回短演示，直接展示效果，不包含设置页。选择后先平滑切换截图，再按需播放当前组合的原生操作；手势返回使用相同组合。每次只加载一个短视频，缓冲或加载失败时保留完整预览，播放结束后释放视频。

同一区域可切换手机和平板，分别保留各自选项。平板使用 1280 × 800 的原生宽屏布局，默认展示展开的侧边导航；侧栏按钮对应应用左上角的收起和展开操作，用原生短片展示宽度变化，完成后回到相应静态图。仅显示当前布局适用的选项：悬浮模式隐藏侧栏按钮，侧栏模式隐藏底栏样式与底栏模糊；重新适用时按钮淡入，保留原选择。预测性返回保留当前侧栏状态、悬浮样式与模糊组合。其他平板选项使用对应深浅模式的原生截图交叉过渡，浏览及设备切换不请求视频。手机与平板双向切换时，原设备画面与新设备交叉淡化并轻微位移，保持滚动位置；新设备素材缺失时保留原设备的完整画面与比例。电脑直接显示选项，平板的侧栏操作与其他选项同排；手机和窄横屏收进“界面效果”面板，主页面仅保留设备切换和返回入口。面板打开时保留演示画面并释放视频，选择后收起面板以便查看效果。

首屏标题、说明、操作和手机依次渐入，其他模块在内容进入阅读区域后播放入场；完全离屏后重置，上下滑回看均可重播。四页预览、主题和隐私区域的文案与视觉分别入场，兼容手机布局；减少动态效果偏好下直接显示。顶部链接使用相同的点击范围与间距，右侧下载和主题按钮作为一组排列，窄屏保留菜单按钮。

手机屏幕、图标和介绍视频封面预留固定比例的占位内容；图片解码完成后淡入。初次加载失败时保持占位，切换时优先保留已显示的完整界面，不显示破图图标或加载、失败文案。

四页操作展示使用开启底栏模糊的 iOS 悬浮样式。主题区域的模糊开关独立控制三种底栏，iOS 样式关闭模糊时显示不透明表面。

手机演示和操作区根据可用屏幕高度布局，保持按钮至少 44px 的点击范围；手机横屏采用两列。宽度至少 1101px、高度至少 700px 的电脑端按模块翻页，一次滚轮或触控板手势只切换一段，过滤惯性；PageUp / PageDown 和空格使用相同翻页方式。手机页面跟随手指拖动，松手后落到下一段，轻微拖动回到原位。内容超过一屏时先在本段滚动，下载和安装说明合为一段。减少动态效果偏好保持自然滚动；点击、横向滑动、双指缩放和内部滚动容器不受影响。

动画由当前 Android Compose 组件逐帧渲染，使用 576px、20fps 的静音 H.264 MP4。`tools/WebsiteMotionTest.kt` 与 `tools/WebsiteThemeTest.kt` 记录操作；原始 PNG 帧留在 Android 项目的工具目录，网页仅包含短视频和 WebP 静态预览。本地预览服务器支持视频字节范围请求。重新生成全部素材（两个模式分别捕获）：

```powershell
.\tools\render_demos.ps1 -AndroidRepo D:\mercu\Desktop\yktwx
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-motion-frames --ffmpeg D:\ffmpeg\bin\ffmpeg.exe --showcase-only
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-motion-frames --ffmpeg D:\ffmpeg\bin\ffmpeg.exe --theme-only
.\tools\render_demos.ps1 -AndroidRepo D:\mercu\Desktop\yktwx -Frames D:\mercu\Desktop\yktwx\tools\website-motion-frames-dark -Mode dark
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-motion-frames-dark --ffmpeg D:\ffmpeg\bin\ffmpeg.exe --showcase-only --mode dark --pages
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-motion-frames-dark --ffmpeg D:\ffmpeg\bin\ffmpeg.exe --theme-only --mode dark
.\tools\render_demos.ps1 -AndroidRepo D:\mercu\Desktop\yktwx -Frames D:\mercu\Desktop\yktwx\tools\website-tablet-frames -TabletOnly
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-tablet-frames --tablet-only
.\tools\render_demos.ps1 -AndroidRepo D:\mercu\Desktop\yktwx -Frames D:\mercu\Desktop\yktwx\tools\website-tablet-frames -TabletOnly -Mode dark
python .\tools\encode_demos.py D:\mercu\Desktop\yktwx\tools\website-tablet-frames --tablet-only --mode dark
```

渲染脚本从 Android 仓库 HEAD 创建隔离快照，仅在快照内启用多个示例房间、隐藏预览提示。保留预览数据及支付限制，操作不提交订单，也不触发实际充值。需要 Android 项目的 JDK/SDK 环境，以及安装 Pillow 的 Python 和 FFmpeg。

`download.html` 是独立下载页，首页下载入口均指向该页面。通过同源 `/v1` 获取最新正式版与正式版历史记录，支持版本号/更新内容搜索、游标分页、多个安装包选择、更新说明和 SHA-256 校验值复制。版本、大小、系统要求及下载地址来自发布服务，不在页面硬编码。下载通过原生链接交由浏览器处理，避免将 APK 读入前端内存。

版本记录以独立卡片呈现，直接展示版本日期、前三条更新摘要、系统要求与下载按钮。最新版本与历史版本的安装包详情、校验信息和完整更新说明使用统一弹窗样式，关闭后保留原滚动位置并恢复入口焦点。复制校验值的反馈直接显示在弹窗内；正文独立滚动，支持关闭按钮、Esc 与遮罩关闭。电脑按版本信息与内容分列，手机纵向排列。下载卡片随内容紧凑排布，两侧卡片保持对齐。常见问题纵向排列，展开内容自然推动下一项。

搜索框使用轻中性色底与细边框区分下层内容，聚焦时仅切换单层蓝色边框；深色模式沿用中性底色。

下载页复用首页的模块翻页：首屏下载、版本记录、安装指引和常见问题分别成段，滚轮、PageUp / PageDown 与手机纵向拖动使用同一逻辑。电脑版本列表在本模块内滚动，到达边缘后才翻页；手机内容超过一屏时先读完本段。阅读面板打开时暂停翻页。首屏沿用主页的分步渐入；两页之间使用浏览器原生页面过渡，不支持时使用简短淡出。减少动态效果偏好保持自然滚动。

服务地址由 `download.html` 的 `<meta name="release-api">` 配置，默认 `content=""`，请求当前域名的 `/v1/...`。部署时将 `cxt.303889.xyz/v1/*` 反向代理到发布后端，保留完整路径、查询参数和下载 Range 请求头；APK 下载不使用代理缓存，以便后端统计每次回源下载。后端 `CXT_PUBLIC_ORIGIN` 配置为 `https://cxt.303889.xyz`，`CXT_ALLOWED_HOSTS` 按代理实际传递的 Host 配置。官网同源请求无需跨域配置；原有管理和 Webhook 域名可以继续使用。本地纯静态预览不提供 `/v1`，须另配同源代理，或临时填写后端地址并允许本地 Origin；请求始终不携带凭据。首次请求与失败时保留不可点击的静态骨架，不显示加载或失败文案；追加记录时保留已有卡片。请求失败后最多自动重试三次，网络恢复或返回前台时再次尝试；成功后淡入真实内容，不展示示例安装包。搜索无结果时显示简短提示。页面继续使用现有深浅主题、导航和静态图片，无构建依赖。
