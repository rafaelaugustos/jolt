# 放置目标、音频提示与深度

自 `0.1.0-rc.12` 起可用。 六项能力分别说明原生与 Web 契约。卸载时销毁 scope。可选 Web 入口支持 SSR 安全导入；挂载后再创建 runtime 和解析目标。

旧 Android 设备仅用于兼容性验证。按维护者要求，进一步实机性能验收等待较新的手机；这些视频和探索性数据不证明 CPU/PSS 优势。

## 放置目标

原生 `dropZones(view, options)` 与 Web `runtime.dropZones(element, options)` 在应用内协调拖动目标；两种 scope 都提供 dropZones。targets 声明 id、target、priority 和同步 accept。onDrop 可返回 stop/dispose 资源或清理函数；`drag: { snap: [0] }` 保留拒绝后的回弹。

默认检测源中心是否进入目标矩形；`hitTest: 'overlap'` 要求正面积交集。优先级较高者优先，同级按声明顺序；首个目标拒绝时不会继续尝试其他目标。松手时重新检查几何和接受条件。`request(id)` 为按钮/键盘提供不要求相交的操作，仍检查可用性与接受条件；不会修改应用数据或把元素移到容器。

完成、取消、再次拖动、暂停、目标移除和销毁都会清理拥有的效果。refresh() 用于应用布局变化。原生坐标是同一窗口内 DIP，Web 是同一文档内 CSS 像素。它不是遮挡/逐像素检测，也不支持系统文件拖入。变换父级仍受现有 drag 限制；示例避免外层 ScrollView 抢占手势。焦点、播报和可访问替代控件由应用负责。

<Clip :autoplay="false" name="interaction-drop-ios" caption="iOS 26.2 模拟器：真实 XCTest 输入与原生播放。 拒绝、接受、按钮替代与重新挂载。" />
<Clip :autoplay="false" name="interaction-drop-android" caption="实体 ASUS ZenFone 3，Android 8：通过 ADB 注入真实触摸。 拒绝、接受、按钮替代与重新挂载。" />
<Clip :autoplay="false" name="interaction-drop-web" caption="Chromium：真实浏览器输入；检查器使用软件 WebGL。 拒绝、接受、按钮替代与重新挂载。" />

## 可选音频与时间线提示

从 `@rafaelaugusto/jolt/audio` 或 `@rafaelaugusto/jolt/web/audio` 导入 audioCue。原生用 `scope.resource(() => audioCue('~/assets/cue.wav'))`，Web 用 `scope.add(audioCue(document, '/cue.wav'))`。原生只支持本地文件；Web 支持同源 HTTP(S) 资源或本地 blob。等待 ready，并在用户操作后播放。失败返回 false、通知 onError，不阻断视觉动画。

每个 cue 只有一个声音实例。sound.play() 替换旧实例；voice.play() 只恢复尚未结束的实例，不重播已完成声音。暂停保留时间，stop 取消并归零，静音只改变音量。后台/页面不可见时暂停，手动暂停的声音在返回后仍暂停。dispose 释放播放器和监听。AVAudioPlayer、MediaPlayer、HTMLAudioElement 自己维护时钟，没有 Jolt 音频逐帧循环。

Web 用 `scope.withTimelineCues(motion, [{ name: 'impact', at: 300, effect: () => sound.play() }])`；原生用 `scope.add(withTimelineCues(motion, cues))`。seek 取消活跃效果且不在跳转点触发，之后重新跨越标记可再次触发。音频**固定速率 1，没有 seek/progress**。视觉 time scale 只改变未来触发时间，不拉伸已播放声音。减少动态效果会抑制时间线 cues，但显式直接音频调用仍有效。定时器不保证采样级同步。

iOS 默认 ambient，遵守系统静音与混音策略；已有非 ambient 会话必须选择 `iosSession: 'application'`。只恢复仍由模块拥有的配置；iOS 中断停止声音。Android 使用提示音属性和应用后台暂停，不请求 audio focus，也不管理全局中断。浏览器自动播放可能失败。不支持流媒体、录音、循环或混音器。**视频没有录制声音，原生完成回调单独验证；尚未验证真实 iPhone 静音开关。**

<Clip :autoplay="false" name="interaction-audio-ios" caption="iOS 26.2 模拟器：真实 XCTest 输入与原生播放。 暂停、无触发 seek、静音与重播。录屏无声音；完成回调单独验证。" />
<Clip :autoplay="false" name="interaction-audio-android" caption="实体 ASUS ZenFone 3，Android 8：通过 ADB 注入真实触摸。 暂停、无触发 seek、静音与重播。录屏无声音；完成回调单独验证。" />
<Clip :autoplay="false" name="interaction-audio-web" caption="Chromium：真实浏览器输入；检查器使用软件 WebGL。 暂停、无触发 seek、静音与重播。录屏无声音；完成回调单独验证。" />

## 检查器与语义回放

原生检查器新增 adapters；Web 使用可选 `@rafaelaugusto/jolt/web/inspector`，要求 development:true。adapters.watch(property,id)、activity(activity,id)、label(playback,label) 关联属性、拥有者与渲染活动。read() 按需采集，不安装采样计时器或启动渲染。

Web watch(element,id) 读取计算后的 transform/opacity；track(playback,id) 注册现有句柄，control 控制暂停、播放、seek、stop。tune(settings,apply) 验证弹簧并让应用回调决定替换；springCode 生成可复制代码。可以借用已有 diagnostics，而不接管其销毁。最多 128 个显式资源、8–2,000 条历史记录；ID 不应包含个人数据。断开或销毁的目标在读取时移除。

事件包括启动、替换、绑定、暂停、播放、seek、取消、完成和销毁。数值来自 adapter，并不自动代表呈现值。耗时只覆盖 **JS 准备、读取和写入**，不推断原生采样、GPU 或总分配字节。updateMs 不是完整桥接初始化或异步渲染耗时。Android 示例使用三个无 shader 绘图属性，iOS 还包括三个 SceneKit uniform，Web 使用软件 WebGL。

`@rafaelaugusto/jolt/web/testing` 共享 v1 格式及 recordInteraction/parseTrace/serializeTrace/replayInteraction。应用提供 adapter、advanceTo 时钟、输入、读取和销毁，并明确拒绝不支持的操作。没有全局拦截、系统手势自动注入或 GPU 确定性保证。测试两次回放单指水平拖动与公开弹簧 seek，包含大时间跳转，检查相同结果与零残留资源。限制为 5,000 事件、300 秒、2 MB。

原生检查器用 `scope.resource(() => inspector)` 保留。Web scope.add 会在 scope 暂停时销毁不能暂停播放的工具；用 scope.use 在恢复时重新创建并更新引用。显式暂停 Web scope 时音频资源也遵守此规则；cue 的文档可见性处理是独立机制。

<Clip :autoplay="false" name="interaction-inspector-ios" caption="iOS 26.2 模拟器：真实 XCTest 输入与原生播放。 拥有者替换、按需检查与重新挂载；不测量 GPU。" />
<Clip :autoplay="false" name="interaction-inspector-android" caption="实体 ASUS ZenFone 3，Android 8：通过 ADB 注入真实触摸。 拥有者替换、按需检查与重新挂载；不测量 GPU。" />
<Clip :autoplay="false" name="interaction-inspector-web" caption="Chromium：真实浏览器输入；检查器使用软件 WebGL。 拥有者替换、按需检查与重新挂载；不测量 GPU。" />

<Clip :autoplay="false" name="interaction-tools-web" caption="Chromium：真实按钮交互暂停和定位应用拥有的动画，调整弹簧并显示可复制代码。显式数值目标变更轨迹重放两次，验证终点且重放资源清零；不捕获操作系统输入。" />
<Clip :autoplay="false" name="motion-inspector-ios" caption="iOS 模拟器，现有原生检查器：真实 XCTest 点击检查中断、调整弹簧、暂停播放并复制 TypeScript。复用原生对应功能录像；不是物理设备性能测量。" />
<Clip :autoplay="false" name="interaction-replay-ios" caption="iOS 模拟器，现有原生重放：真实 XCTest 点击和拖动记录并重放弹簧与拖动，检测故意错误的检查点。复用原生对应功能录像；重放使用逻辑时间。" />

## 路径与切线方向

`scope.animate(card, { path: 'M0 0 C40 -150 160 90 190 -80', orient: true }, { duration: 2600, ease: 'linear' })` 在原生和 Web 共享几何与进度轨道。单位为 DIP/CSS 像素及角度。暂停、seek、重复、反向、重复间隔、减少动态效果和替换使用常规控制；Web sequence 与可拖动时间线也支持路径。

初始相对 m 基于当前姿态，绝对 M 选择声明的起点。不要把 path 与显式 x/y 或切线方向与 rotate 混用。替换为普通弹簧可继承采样位置/速度；显式不连续路径不保证切线或速度连续。

<Clip :autoplay="false" name="interaction-path-ios" caption="iOS 26.2 模拟器：真实 XCTest 输入与原生播放。 三次曲线路径、切线方向、暂停、seek 与替换。" />
<Clip :autoplay="false" name="interaction-path-android" caption="实体 ASUS ZenFone 3，Android 8：通过 ADB 注入真实触摸。 三次曲线路径、切线方向、暂停、seek 与替换。" />
<Clip :autoplay="false" name="interaction-path-web" caption="Chromium：真实浏览器输入；检查器使用软件 WebGL。 三次曲线路径、切线方向、暂停、seek 与替换。" />

## 三轴旋转

Web 支持角度单位的 rotateX/Y。顺序为初始 2D 变换、平移、rotateZ、rotateY、rotateX、缩放。需要投影时在父级设置 `container.style.perspective = '700px'`，动画作用于子元素。不支持目标的初始投影变换或 3D layout/FLIP。原生契约保持不变，不保证相同投影像素。暂停、seek、替换保留独立通道。

<Clip :autoplay="false" name="interaction-depth-ios" caption="iOS 26.2 模拟器：真实 XCTest 输入与原生播放。 轴旋转、seek 与替换；Web 在父级显式设置 perspective。" />
<Clip :autoplay="false" name="interaction-depth-android" caption="实体 ASUS ZenFone 3，Android 8：通过 ADB 注入真实触摸。 轴旋转、seek 与替换；Web 在父级显式设置 perspective。" />
<Clip :autoplay="false" name="interaction-depth-web" caption="Chromium：真实浏览器输入；检查器使用软件 WebGL。 轴旋转、seek 与替换；Web 在父级显式设置 perspective。" />

## 阴影与深度

Web 支持 shadowOpacity、shadowRadius、带符号的 X/Y 偏移，以及仅 Web 的 shadowColor。只拥有一个无 spread 外部 box-shadow；inset、多阴影和非零 spread 会在替换动画前报错。从 none 或兼容阴影开始；颜色 alpha 与阴影 opacity 相乘。

shadowRadius 是 CSS blur 距离的一半，沿用 iOS 半径数值约定。Web 用 CSS 像素，原生用 DIP。Web 半径不小于零，opacity 限制到 0–1；原生显式无效值验证不变。部分替换保留其他通道。release 恢复初始样式，除非应用已有外部写入；拥有期间的外部修改仍是冲突，应先释放再接管。

Android elevation/translationZ 仍是原生光照/层级能力，不是 CSS 阴影或 translateZ 别名。iOS 阴影通道不变。API 相似不代表像素一致、CPU/PSS 更低或绘制成本下降。

<Clip :autoplay="false" name="interaction-shadow-ios" caption="iOS 26.2 模拟器：真实 XCTest 输入与原生播放。 iOS/Web 阴影；Android 原生 elevation/translationZ。" />
<Clip :autoplay="false" name="interaction-shadow-android" caption="实体 ASUS ZenFone 3，Android 8：通过 ADB 注入真实触摸。 iOS/Web 阴影；Android 原生 elevation/translationZ。" />
<Clip :autoplay="false" name="interaction-shadow-web" caption="Chromium：真实浏览器输入；检查器使用软件 WebGL。 iOS/Web 阴影；Android 原生 elevation/translationZ。" />

<Clip :autoplay="false" name="interaction-audio-lifecycle-ios" caption="iOS 26.2 模拟器：手动暂停在后台切换后保留，重新挂载会取消旧资源。真实 XCTest 操作；录屏无声音。" />
<Clip :autoplay="false" name="interaction-inspector-lifecycle-ios" caption="iOS 26.2 模拟器：手动暂停在后台切换后保留，重新挂载会取消旧资源。真实 XCTest 操作；录屏无声音。" />
