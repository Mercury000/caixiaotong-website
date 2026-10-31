package com.mercury.yktwx

import android.content.Context
import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import com.mercury.yktwx.ui.ThemeSettings
import com.mercury.yktwx.ui.YktApp
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Offline capture harness, copied into an isolated Android source checkout for rendering. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "zh-rCN-w411dp-h891dp-hdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WebsiteMotionTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private lateinit var settings: ThemeSettings
    private var sequence = 0
    private lateinit var scene: File

    private fun start(tab: String) {
        val app = compose.activity.application
        app.getSharedPreferences("ui_settings", Context.MODE_PRIVATE).edit().clear().commit()
        settings = ThemeSettings(app).apply { setTheme(1); setFloating(true); setFloatingStyle(1) }
        val payment = PaymentViewModel(app).apply { initialize(true) }
        val bills = BillViewModel(app).apply { initialize(true) }
        compose.setContent {
            CompositionLocalProvider(LocalInspectionMode provides true) { YktApp(settings, payment, bills) }
        }
        compose.onNode(hasText(tab) and hasClickAction()).performClick()
        settle()
    }

    private fun settle() {
        compose.mainClock.autoAdvance = true
        compose.mainClock.advanceTimeBy(1000)
        compose.waitForIdle()
    }

    private fun click(label: String) = compose.onNode(hasText(label) and hasClickAction()).performClick()
    private fun dropdown(label: String) = compose.onNode(hasText(label) and
        SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.DropdownList)).performClick()
    private fun back() = compose.runOnIdle { compose.activity.onBackPressedDispatcher.onBackPressed() }

    private fun begin(name: String) {
        settle()
        val output = System.getenv("WEBSITE_MOTION_FRAMES") ?: "D:/mercu/Desktop/yktwx/tools/website-motion-frames"
        scene = File(output, name).apply { mkdirs() }
        sequence = 0
        compose.mainClock.autoAdvance = false
        frames(10, movingFrames = 1)
    }

    private fun frames(count: Int = 24, movingFrames: Int = 16) {
        var lastFrame: ByteArray? = null
        repeat(count) { index ->
            compose.mainClock.advanceTimeBy(50, ignoreFrameDuration = true)
            // Render each native animation frame, then reuse the settled image for its hold.
            if (index < movingFrames || index == count - 1) {
                compose.runOnIdle { compose.activity.window.decorView.invalidate() }
                compose.waitForIdle()
                val roots = compose.onAllNodes(isRoot())
                val nodes = roots.fetchSemanticsNodes()
                val base = roots[0].captureToImage().asAndroidBitmap()
                val bitmap = base.copy(Bitmap.Config.ARGB_8888, true)
                val canvas = android.graphics.Canvas(bitmap)
                nodes.drop(1).forEachIndexed { rootIndex, node ->
                    val overlay = roots[rootIndex + 1].captureToImage().asAndroidBitmap()
                    canvas.drawBitmap(overlay, node.positionInWindow.x, node.positionInWindow.y, null)
                }
                val resized = Bitmap.createScaledBitmap(bitmap, 576, 1248, true)
                lastFrame = java.io.ByteArrayOutputStream().use {
                    resized.compress(Bitmap.CompressFormat.PNG, 100, it)
                    it.toByteArray()
                }
                if (resized !== bitmap) resized.recycle()
            }
            File(scene, "%04d.png".format(sequence++)).writeBytes(checkNotNull(lastFrame))
        }
    }

    private fun finish() {
        frames(20)
        settle()
        println("CAPTURED ${scene.name}: $sequence native frames")
    }

    @Test fun paymentScenes() {
        start("付款")
        begin("payment-qr")
        compose.onNodeWithContentDescription("付款二维码").performClick(); frames(32)
        click("收起"); finish()

        begin("payment-barcode")
        compose.onNodeWithContentDescription("付款条形码").performClick(); frames(32)
        click("收起"); finish()
    }

    @Test fun paymentRecharge() {
        start("付款")
        begin("payment-recharge")
        compose.onNode(hasText("充值") and hasClickAction() and !hasTestTag("network-recharge")).performClick(); frames(24)
        click("¥ 10"); frames(16)
        click("¥ 50"); frames(20)
        back(); finish()
    }

    @Test fun hallScenes() {
        start("大厅")
        begin("hall-electricity")
        click("照明充值"); frames(28)
        click("¥ 10"); frames(20)
        back(); finish()

        begin("hall-network")
        compose.onNodeWithTag("network-recharge").performClick(); frames(36)
        back(); finish()
    }

    @Test fun hallRooms() {
        start("大厅")
        begin("hall-rooms")
        click("切换"); frames(28)
        compose.onNodeWithTag("hall-room-1").performClick(); frames(24)
        finish()
    }

    @Test fun billScenes() {
        start("账单")
        begin("bill-stats")
        click("统计"); frames(28)
        compose.onNodeWithTag("bill-trend-plot").performTouchInput { click(center) }; frames(24)
        click("明细"); finish()

        begin("bill-filter")
        compose.onNodeWithContentDescription("筛选账单").performClick(); frames(36)
        back(); finish()

        begin("bill-date")
        compose.onNodeWithContentDescription("选择日期").performClick(); frames(36)
        back(); finish()
    }

    @Test fun mineScenes() {
        start("我的")
        begin("mine-profile")
        compose.onNodeWithContentDescription("个人信息").performClick(); frames(36)
        back(); finish()

        begin("mine-account")
        click("账户详情"); frames(36)
        back(); finish()
    }

    @Test fun mineTheme() {
        start("我的")
        compose.onNodeWithText("应用设置").performScrollTo(); settle()
        begin("mine-theme")
        click("应用设置"); frames(24)
        click("主题"); frames(20)
        dropdown("主题"); frames(16)
        click("深色"); frames(24)
        back(); frames(16)
        back(); frames(16)
        compose.runOnIdle { settings.setTheme(1) }; finish()
    }

}
