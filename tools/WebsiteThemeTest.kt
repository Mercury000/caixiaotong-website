package com.mercury.yktwx

import android.content.Context
import android.graphics.Bitmap
import androidx.activity.BackEventCompat
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import com.mercury.yktwx.ui.AppTheme
import com.mercury.yktwx.ui.ThemeSettings
import com.mercury.yktwx.ui.YktApp
import com.mercury.yktwx.ui.pages.ThemeSettingsPage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import top.yukonga.miuix.kmp.basic.*
import top.yukonga.miuix.kmp.theme.ColorSchemeMode
import top.yukonga.miuix.kmp.theme.MiuixTheme
import java.io.File

/** Real settings controls and app renders follow the selected website color mode. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "zh-rCN-w411dp-h891dp-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WebsiteThemeTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private lateinit var settings: ThemeSettings
    private lateinit var scene: File
    private var sequence = 0
    private val output get() = System.getenv("WEBSITE_MOTION_FRAMES") ?: "D:/mercu/Desktop/yktwx/tools/website-motion-frames"

    private fun setup(mode: Int = 1, controls: Boolean = false) {
        val app = compose.activity.application
        app.getSharedPreferences("ui_settings", Context.MODE_PRIVATE).edit().clear().commit()
        settings = ThemeSettings(app).apply { setTheme(mode); setFloating(true); setFloatingStyle(if (controls) 0 else 1); setPredictive(true) }
        if (controls) compose.setContent {
            AppTheme(if (System.getenv("WEBSITE_COLOR_MODE") == "dark") ColorSchemeMode.Dark else ColorSchemeMode.Light) {
                Scaffold(topBar = { TopAppBar(title = "主题", largeTitle = "主题", color = Color.Transparent) }) { padding ->
                    ThemeSettingsPage(Modifier.fillMaxSize().background(MiuixTheme.colorScheme.surface), padding,
                        themeMode = settings.themeMode, onThemeModeChange = settings::setTheme,
                        accentMode = settings.accentMode, onAccentModeChange = settings::setAccent,
                        floatingBottomBar = settings.floatingBottomBar, onFloatingBottomBarChange = settings::setFloating,
                        floatingBottomBarStyle = settings.floatingBottomBarStyle, onFloatingBottomBarStyleChange = settings::setFloatingStyle,
                        blurBottomBar = settings.blurBottomBar, onBlurBottomBarChange = settings::setBlurBottom,
                        blurTopBar = settings.blurTopBar, onBlurTopBarChange = settings::setBlurTop,
                        predictiveBack = settings.predictiveBack, onPredictiveBackChange = settings::setPredictive,
                        predictiveBackDistance = settings.predictiveBackDistance, onPredictiveBackDistanceChange = settings::setDistance)
                }
            }
        } else {
            val payment = PaymentViewModel(app).apply { initialize(true) }
            val bills = BillViewModel(app).apply { initialize(true) }
            compose.setContent { CompositionLocalProvider(LocalInspectionMode provides true) { YktApp(settings, payment, bills) } }
            click("我的")
            settle()
            compose.runOnIdle { settings.setFloatingStyle(0) }
        }
        settle()
    }
    private fun settle() { compose.mainClock.autoAdvance = true; compose.mainClock.advanceTimeBy(1200); compose.waitForIdle() }
    private fun click(label: String) = compose.onNode(hasText(label) and hasClickAction()).performClick()
    private fun dropdown(label: String) = compose.onNode(hasText(label) and SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.DropdownList)).performClick()
    private fun option(label: String) = compose.onNode(hasText(label) and SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.RadioButton)).performClick()
    private fun begin(name: String) { settle(); scene = File(output, name).apply { mkdirs() }; sequence = 0; compose.mainClock.autoAdvance = false; frames(10, 1) }
    private fun frames(count: Int, moving: Int = 8) {
        var data: ByteArray? = null
        repeat(count) { index ->
            compose.mainClock.advanceTimeBy(50, ignoreFrameDuration = true)
            if (index < moving || index == count - 1) {
                compose.runOnIdle { compose.activity.window.decorView.invalidate() }
                val roots = compose.onAllNodes(isRoot())
                val nodes = roots.fetchSemanticsNodes()
                val bitmap = roots[0].captureToImage().asAndroidBitmap().copy(Bitmap.Config.ARGB_8888, true)
                val canvas = android.graphics.Canvas(bitmap)
                nodes.drop(1).forEachIndexed { i, node -> canvas.drawBitmap(roots[i + 1].captureToImage().asAndroidBitmap(), node.positionInWindow.x, node.positionInWindow.y, null) }
                val resized = Bitmap.createScaledBitmap(bitmap, 576, 1248, true)
                data = java.io.ByteArrayOutputStream().use { resized.compress(Bitmap.CompressFormat.PNG, 100, it); it.toByteArray() }
                resized.recycle(); bitmap.recycle()
            }
            File(scene, "%04d.png".format(sequence++)).writeBytes(checkNotNull(data))
        }
    }
    private fun finish() { frames(20); settle(); println("CAPTURED ${scene.name}: $sequence") }

    private fun dragContent(up: Boolean, count: Int) {
        val list = visibleContent()
        val bounds = list.fetchSemanticsNode().boundsInRoot
        val start = androidx.compose.ui.geometry.Offset(bounds.width / 2, bounds.height * if (up) .75f else .25f)
        list.performTouchInput { down(start) }
        repeat(count) { index ->
            list.performTouchInput { moveTo(start.copy(y = start.y + bounds.height * .025f * (index + 1) * if (up) -1 else 1)) }
            frames(1)
        }
        list.performTouchInput { up() }
    }

    private fun visibleContent() = compose.onNode(hasScrollAction() and
        SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange) and
        SemanticsMatcher("Visible vertical content") { it.boundsInRoot.left >= 0f && it.boundsInRoot.right > 0f })

    @Test fun settingsControls() {
        setup(mode = if (System.getenv("WEBSITE_COLOR_MODE") == "dark") 2 else 1, controls = true)
        begin("settings-floating"); click("悬浮底栏"); frames(30); click("悬浮底栏"); frames(30); finish()
        begin("settings-style"); dropdown("悬浮底栏样式"); frames(20); option("iOS"); frames(30); dropdown("悬浮底栏样式"); frames(20); option("默认"); frames(30); finish()
        recordBlurControls()
        begin("settings-back"); click("预测性返回动画"); frames(20); click("预测性返回动画"); frames(20); frames(40, 1); frames(40, 1); finish()
    }

    @Test fun settingsBlur() { setup(controls = true); recordBlurControls() }
    private fun recordBlurControls() {
        begin("settings-blur"); frames(20, 1)
        click("底栏模糊"); frames(18)
        click("顶栏模糊"); frames(18)
        click("底栏模糊"); click("顶栏模糊"); frames(18)
        frames(16, 1); finish()
    }

    @Test fun lightEffects() = effects(1)
    @Test fun darkEffects() = effects(2)
    private fun effects(mode: Int) {
        setup(mode)
        val suffix = if (mode == 1) "light" else "dark"
        val onlyScene = System.getenv("WEBSITE_THEME_SCENE")
        if (onlyScene == null || onlyScene == "floating") {
            begin("effect-floating-$suffix"); compose.runOnIdle { settings.setFloating(false) }; frames(30); compose.runOnIdle { settings.setFloating(true) }; frames(30); finish()
        }
        if (onlyScene == null || onlyScene == "style") {
            begin("effect-style-$suffix"); frames(20, 1); compose.runOnIdle { settings.setFloatingStyle(1) }; frames(30); frames(20, 1); compose.runOnIdle { settings.setFloatingStyle(0) }; frames(30); finish()
        }
        if (onlyScene == null || onlyScene == "blur") {
            begin("effect-blur-$suffix"); dragContent(up = true, count = 12); frames(8)
            compose.runOnIdle { settings.setBlurBottom(true) }; frames(18)
            compose.runOnIdle { settings.setBlurTop(true) }; frames(18)
            compose.runOnIdle { settings.setBlurBottom(false); settings.setBlurTop(false) }; frames(18)
            dragContent(up = false, count = 12); frames(4); finish()
        }
    }

    @Test fun lightBack() = backEffect(1)
    @Test fun darkBack() = backEffect(2)
    private fun backEffect(mode: Int) {
        setup(mode)
        val suffix = if (mode == 1) "light" else "dark"
        begin("effect-back-$suffix")
        compose.onNodeWithContentDescription("个人信息").performClick(); frames(30); frames(10, 1)
        compose.onNodeWithText("学工号").assertExists()
        val dispatcher = compose.activity.onBackPressedDispatcher
        fun event(progress: Float) = BackEventCompat(progress * 400f, 400f, progress, BackEventCompat.EDGE_LEFT)
        compose.runOnIdle { dispatcher.dispatchOnBackStarted(event(0f)) }
        repeat(16) { i -> compose.runOnIdle { dispatcher.dispatchOnBackProgressed(event((i + 1) / 20f)) }; frames(1) }
        compose.runOnIdle { dispatcher.dispatchOnBackCancelled() }; frames(20)
        compose.runOnIdle { dispatcher.dispatchOnBackStarted(event(0f)) }
        repeat(16) { i -> compose.runOnIdle { dispatcher.dispatchOnBackProgressed(event((i + 1) / 16f)) }; frames(1) }
        compose.runOnIdle { dispatcher.onBackPressed() }; frames(20); frames(28, 1)
        settle(); println("CAPTURED ${scene.name}: $sequence")
    }

    @Test fun lightVariants() = variants(1)
    @Test fun darkVariants() = variants(2)
    @Test fun lightTopVariants() = variants(1, listOf(true))
    @Test fun darkTopVariants() = variants(2, listOf(true))
    private fun variants(mode: Int, topModes: List<Boolean> = listOf(false, true)) {
        setup(mode)
        val suffix = if (mode == 1) "light" else "dark"
        for (kind in listOf("docked", "floating", "ios")) for (blur in listOf(false, true)) for (topBlur in topModes) {
            val id = "$kind-${if (blur) "blur" else "plain"}${if (topBlur) "-top-blur" else ""}-$suffix"
            compose.runOnIdle {
                settings.setFloating(kind != "docked")
                settings.setFloatingStyle(if (kind == "ios") 1 else 0)
                settings.setBlurBottom(blur)
                settings.setBlurTop(topBlur)
                settings.setPredictive(true)
            }
            visibleContent().performScrollToIndex(0)
            begin("theme-bar-$id")
            dragContent(up = true, count = 12); frames(10)
            dragContent(up = false, count = 12); frames(20, 16)
            settle(); println("CAPTURED ${scene.name}: $sequence")

            visibleContent().performScrollToIndex(0)
            begin("theme-back-$id")
            compose.onNodeWithContentDescription("个人信息").performClick(); frames(18, 18)
            val dispatcher = compose.activity.onBackPressedDispatcher
            fun event(progress: Float) = BackEventCompat(progress * 400f, 400f, progress, BackEventCompat.EDGE_LEFT)
            compose.runOnIdle { dispatcher.dispatchOnBackStarted(event(0f)) }
            repeat(14) { i -> compose.runOnIdle { dispatcher.dispatchOnBackProgressed(event((i + 1) / 14f)) }; frames(1) }
            compose.runOnIdle { dispatcher.onBackPressed() }; frames(18, 18); frames(10, 1)
            settle(); println("CAPTURED ${scene.name}: $sequence")
        }
    }
}
