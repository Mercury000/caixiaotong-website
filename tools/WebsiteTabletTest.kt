package com.mercury.yktwx

import android.content.Context
import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.activity.BackEventCompat
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import com.mercury.yktwx.ui.ThemeSettings
import com.mercury.yktwx.ui.YktApp
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Capture the app's actual wide-window navigation, without changing production UI. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "zh-rCN-w1280dp-h800dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WebsiteTabletTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun lightLayouts() = layouts(1)
    @Test fun darkLayouts() = layouts(2)
    @Test fun lightRail() = rail(1)
    @Test fun darkRail() = rail(2)
    @Test fun lightBack() = back(1)
    @Test fun darkBack() = back(2)
    private val output get() = File(System.getenv("WEBSITE_MOTION_FRAMES") ?: "D:/mercu/Desktop/yktwx/tools/website-tablet-frames").apply { mkdirs() }

    private fun setup(mode: Int): ThemeSettings {
        val app = compose.activity.application
        app.getSharedPreferences("ui_settings", Context.MODE_PRIVATE).edit().clear().commit()
        val settings = ThemeSettings(app).apply {
            setTheme(mode); setFloating(false); setNavigationRailExpanded(true)
        }
        val payment = PaymentViewModel(app).apply { initialize(true) }
        val bills = BillViewModel(app).apply { initialize(true) }
        compose.setContent {
            CompositionLocalProvider(LocalInspectionMode provides true) { YktApp(settings, payment, bills) }
        }
        compose.onNode(hasText("我的") and isSelectable()).performClick()
        return settings
    }

    private fun capture(file: File) {
        compose.runOnIdle { compose.activity.window.decorView.invalidate() }
        val roots = compose.onAllNodes(isRoot())
        val nodes = roots.fetchSemanticsNodes()
        val bitmap = roots[0].captureToImage().asAndroidBitmap().copy(Bitmap.Config.ARGB_8888, true)
        check(bitmap.width == 1280 && bitmap.height == 800) { "Unexpected tablet render: ${bitmap.width} x ${bitmap.height}" }
        val canvas = android.graphics.Canvas(bitmap)
        nodes.drop(1).forEachIndexed { index, node ->
            canvas.drawBitmap(roots[index + 1].captureToImage().asAndroidBitmap(), node.positionInWindow.x, node.positionInWindow.y, null)
        }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
    }

    private fun layouts(mode: Int) {
        val settings = setup(mode)
        val suffix = if (mode == 1) "light" else "dark"
        for (kind in listOf("docked", "floating", "ios")) for (blur in listOf(false, true)) for (topBlur in listOf(false, true)) {
            compose.runOnIdle {
                settings.setFloating(kind != "docked")
                settings.setFloatingStyle(if (kind == "ios") 1 else 0)
                settings.setBlurBottom(blur); settings.setBlurTop(topBlur)
            }
            compose.mainClock.advanceTimeBy(1000)
            compose.waitForIdle()
            if (kind == "docked") compose.onNodeWithTag("main-navigation-rail").assertExists()
            else compose.onNodeWithTag("main-bottom-navigation").assertExists()
            val variant = "$kind-${if (blur) "blur" else "plain"}${if (topBlur) "-top-blur" else ""}"
            capture(File(output, "theme-pad-$variant-$suffix.png"))
            println("CAPTURED theme-pad-$variant-$suffix")
        }
    }

    private fun rail(mode: Int) {
        val settings = setup(mode)
        val suffix = if (mode == 1) "light" else "dark"
        for (topBlur in listOf(false, true)) {
            compose.runOnIdle { settings.setBlurTop(topBlur); settings.setBlurBottom(false) }
            compose.mainClock.autoAdvance = true; compose.mainClock.advanceTimeBy(1000); compose.waitForIdle()
            val top = if (topBlur) "-top-blur" else ""
            for (expand in listOf(false, true)) {
                val scene = File(output, "theme-pad-rail-${if (expand) "expand" else "collapse"}$top-$suffix").apply { mkdirs() }
                compose.mainClock.autoAdvance = false
                capture(File(scene, "0000.png"))
                compose.onNodeWithContentDescription(if (expand) "Expand navigation rail" else "Collapse navigation rail").performClick()
                repeat(25) { index ->
                    compose.mainClock.advanceTimeBy(50, ignoreFrameDuration = true)
                    capture(File(scene, "%04d.png".format(index + 1)))
                }
                val width = compose.onNodeWithTag("main-navigation-rail").fetchSemanticsNode().boundsInRoot.width
                assertTrue("Rail button must change the native width", if (expand) width >= 200f else width < 200f)
                if (!expand) capture(File(output, "theme-pad-docked-plain$top-collapsed-$suffix.png"))
                println("CAPTURED ${scene.name}: 26")
            }
        }
    }

    private fun back(mode: Int) {
        val settings = setup(mode)
        compose.runOnIdle { settings.setPredictive(true) }
        val suffix = if (mode == 1) "light" else "dark"
        for (kind in listOf("docked", "floating", "ios")) for (blur in if (kind == "docked") listOf(false) else listOf(false, true))
            for (topBlur in listOf(false, true)) for (expanded in if (kind == "docked") listOf(true, false) else listOf(true)) {
            compose.mainClock.autoAdvance = true
            compose.runOnIdle {
                settings.setFloating(kind != "docked"); settings.setFloatingStyle(if (kind == "ios") 1 else 0)
                settings.setBlurBottom(blur); settings.setBlurTop(topBlur)
            }
            compose.mainClock.advanceTimeBy(1000); compose.waitForIdle()
            if (kind == "docked") {
                val current = compose.onNodeWithTag("main-navigation-rail").fetchSemanticsNode().boundsInRoot.width >= 200f
                if (current != expanded) compose.onNodeWithContentDescription(if (expanded) "Expand navigation rail" else "Collapse navigation rail").performClick()
            }
            compose.onNode(hasScrollToIndexAction() and SemanticsMatcher.keyIsDefined(androidx.compose.ui.semantics.SemanticsProperties.VerticalScrollAxisRange) and
                SemanticsMatcher("Visible content") { it.boundsInRoot.left >= 0f && it.boundsInRoot.right > 0f }).performScrollToIndex(0)
            compose.mainClock.advanceTimeBy(1000); compose.waitForIdle()
            val variant = "$kind-${if (blur) "blur" else "plain"}${if (topBlur) "-top-blur" else ""}${if (!expanded) "-collapsed" else ""}"
            val scene = File(output, "theme-pad-back-$variant-$suffix").apply { mkdirs() }
            compose.mainClock.autoAdvance = false
            var sequence = 0
            fun frames(count: Int, moving: Boolean = true) {
                var previous: File? = null
                repeat(count) {
                    compose.mainClock.advanceTimeBy(50, ignoreFrameDuration = true)
                    val file = File(scene, "%04d.png".format(sequence++))
                    if (moving || previous == null) capture(file) else previous.copyTo(file, overwrite = true)
                    previous = file
                }
            }
            frames(4, false)
            compose.onNodeWithContentDescription("个人信息").performClick(); frames(8); frames(4, false)
            val dispatcher = compose.activity.onBackPressedDispatcher
            fun event(progress: Float) = BackEventCompat(progress * 600f, 400f, progress, BackEventCompat.EDGE_LEFT)
            compose.runOnIdle { dispatcher.dispatchOnBackStarted(event(0f)) }
            repeat(12) { index -> compose.runOnIdle { dispatcher.dispatchOnBackProgressed(event((index + 1) / 12f)) }; frames(1) }
            compose.runOnIdle { dispatcher.onBackPressed() }; frames(8); frames(6, false)
            println("CAPTURED ${scene.name}: $sequence")
        }
    }
}
