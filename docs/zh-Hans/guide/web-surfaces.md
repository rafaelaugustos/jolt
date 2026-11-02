# Web 粒子、表面与图像效果

**开发版本，尚未包含在 RC.9 中。** #359–#364 增加六个 runtime/scope 方法。SSR 导入 /web 安全；请在挂载后创建 runtime，并为图像效果提供已解码、具有正布局尺寸的 HTMLImageElement。Mavis 采用工作单独跟踪。

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const snow = scope.particles(scene, { source: 'top', angle: 90, rate: 30 })
scope.confetti(button, { count: 80 })
const soft = scope.blur(panel, { radius: 24 })
await soft.animate(0.7, 'smooth')
const line = scope.shape(canvasHost, {
  d: 'M10 10 L90 10 L90 90 L10 90 Z',
  viewBox: [0, 0, 100, 100],
  fill: '#6851c9',
  stroke: '#b9fff1',
})
await line.animate({ d: 'M50 0 L100 50 L50 100 L0 50 Z' })
await photo.decode()
const flow = scope.liquid(photo, { intensity: 0.8 })
flow.pause()
flow.resume()
flow.stop()
await nextPhoto.decode()
const swap = scope.imageEffect(photo, 'dissolve', { to: nextPhoto, paused: true })
swap.progress = 0.4
swap.play()
// scope.suspend(); scope.resume(); scope.dispose(); motion.dispose()
```

## 控制与生命周期 {#lifecycle}

六个方法都支持 motion.scope() 和 /web/vue。暂停保留当前状态，恢复继续播放，dispose 清理图层、监听器、调度任务和样式。隐藏文档的时间不计入。无效选项保留原效果，其他 runtime 不能抢占目标。装饰层不接收输入，也不进入无障碍树。可替换 ref 和 KeepAlive 使用 scope.use()。

内容 blur、liquid 和 imageEffect 共享一个 filter 所有者；backdrop blur 独立。清理保留原 CSS 滤镜和应用后来写入的样式。只过滤图像时，请把边框/背景放在外部容器。实现使用共享 JavaScript 调度器及 Canvas/CSS/SVG，不承诺脱离主线程，也不承诺与原生逐像素相同。

## 粒子与彩纸 {#particles}

particles() 接受[原生选项](./particles)，单位改为 CSS 像素。最多 10,000 个存活粒子，Canvas 最多 4,194,304 像素、DPR 上限 2。尺寸变化只改变新粒子的出生位置；繁忙帧后跳过过期粒子。duration 结束发射后等待剩余粒子过期。

confetti() 发射 200 ms、生命周期 2200 ms，固定捕获目标中心，在视口覆盖层中越过祖先裁剪，但仍低于浏览器 top-layer 对话框。两者返回可调用清理函数，并支持 pause/play、suspend/resume、dispose、finished 和 snapshot。自然结束返回 true，取消返回 false。减少动态效果时禁止新彩纸并清空连续粒子；恢复时不补发积压粒子。

<Clip name="web-particles-surfaces-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/恢复、替换、减少动态效果和清理，保持原速。浏览器录制，不代表真机性能。" />

<Clip name="web-confetti-surfaces-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/恢复、替换、减少动态效果和清理，保持原速。浏览器录制，不代表真机性能。" />

<Clip name="particles-ios" caption="iOS 模拟器，英文界面：经复核的真实原生播放和交互，作为原生参考复用。原速，非物理设备录制。" />

## 受控模糊 {#blur}

blur() 默认使用 CSS 内容滤镜；amount 为 0–1，radius 为 1–64，默认 24。mode: backdrop 使用 backdrop-filter，不支持时 snapshot().backend 为 none。style 接受 system/light/dark，但不模拟 iOS 材质色调。animate 从当前强度及弹簧速度重定向，支持暂停和 seek。set 立即设置，stop 保留，dispose 恢复原滤镜。减少动态效果时应用终点。原生 iOS 视频使用材质，Android 使用内容模糊。

<Clip name="web-blur-surfaces-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/恢复、替换、减少动态效果和清理，保持原速。浏览器录制，不代表真机性能。" />

<Clip name="blur-ios" caption="iOS 模拟器，英文界面：经复核的真实原生播放和交互，作为原生参考复用。原速，非物理设备录制。" />

## 形状与变形 {#shape}

shape() 创建带填充、描边、viewBox、端点和连接规则的装饰 SVG，复用可移植路径解析器。animate 要求标准化命令和子路径兼容；set 可以改变拓扑。strokeStart/End 范围为 0–1，只裁剪描边；部分描边要求单轮廓。支持暂停、seek、中断及减少动态效果。新曲线从当前几何形状开始；stop 保留形状，dispose 移除。drawPath 仍控制应用自己的 SVG 几何元素。

<Clip name="web-shape-surfaces-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/恢复、替换、减少动态效果和清理，保持原速。浏览器录制，不代表真机性能。" />

<Clip name="shapes-ios" caption="iOS 模拟器，英文界面：经复核的真实原生播放和交互，作为原生参考复用。原速，非物理设备录制。" />

## 液态图像 {#liquid}

liquid(image, { intensity: 0.7, duration: 8000 }) 通过 48 × 48 SVG 位移图复用 iOS 周期变形场。intensity 为 0–1，duration 为正数毫秒周期。pause/resume/stop 保持原生含义，也提供 play/suspend/dispose 和 diagnostics。减少动态效果时显示原图并暂停时钟。换源或移除目标会清理效果，请在下一张图加载后重建。调整尺寸更新 liquid；有限图像效果则取消。Android 原生 liquid 仍保持原图。未就绪或不支持的 Web 图像返回已停止的控制器和明确原因。

<Clip name="web-liquid-surfaces-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/恢复、替换、减少动态效果和清理，保持原速。浏览器录制，不代表真机性能。" />

<Clip name="liquid-ios" caption="iOS 模拟器，英文界面：经复核的真实原生播放和交互，作为原生参考复用。原速，非物理设备录制。" />

## 波纹、指针变形与溶解 {#image}

imageEffect 支持 ripple、distortion 和 dissolve。原点、振幅 0–64（默认 8）及正半径（默认 96）使用局部 CSS 像素。默认时长 650 ms，seed 为 0–65535 整数。distortion 使用真实指针捕获并临时拥有 touch-action，松开后恢复；不支持有限 seek/reverse。指针目标必须轴对齐，不应旋转或倾斜。

有限效果提供 finished、progress、pause/play、reverse 和 finish。seek 保持暂停状态；finish 到达当前方向终点。取消恢复原图并返回 false。正向 dissolve 提交已解码的 to: HTMLImageElement 源并清除 srcset/sizes；反向完成保留原图。框架应在成功后同步应用模型。

仅支持已加载静态栅格图、正布局及最多 4,194,304 个物理输出像素。dissolve 支持 fill/contain/cover/none/scale-down 和百分比 object-position；目标须允许 Canvas 读取，跨域需要合适 CORS。CSP 须允许 data 图像。不可用渲染器、不支持的定位或减少动态效果会保持装饰效果原图（false），但立即提交 dissolve（true），即使请求暂停。diagnostics 提供 backend/reason。有限播放中启用减少动态效果会完成到方向终点。源、响应式源或尺寸变化会取消效果。保留 alt 及应用加载/错误语义。

<Clip name="web-image-surfaces-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/恢复、替换、减少动态效果和清理，保持原速。浏览器录制，不代表真机性能。" />

<Clip name="image-effects-ios" caption="iOS 模拟器，英文界面：经复核的真实原生播放和交互，作为原生参考复用。原速，非物理设备录制。" />

## 验证与复现

运行 npm run web:surfaces:typecheck 和 npm run web:surfaces:test。Chromium、Firefox、WebKit 检查真实像素、指针、完成、所有权、隐藏时间、换源、Shadow DOM/base URL 和清理。使用 node benchmarks/web-surfaces/record.mjs 录制。原生视频保持不变。参见[验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-surfaces.md)。
