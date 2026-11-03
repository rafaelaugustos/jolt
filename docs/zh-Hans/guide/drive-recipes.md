# Jolt Drive 动效配方

从 [Jolt Drive](https://github.com/rafaelaugustos/jolt-drive) 提取的四种可复用模式，固定于已核对的提交 `2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f`。每个配方提供完整源文件、适配提示词和新录制的原生交互演示。源码使用 Jolt RC.10 与 NativeScript-Vue 3，所需依赖见下文。

以下录屏来自运行真实应用的 iPhone 17 Pro 模拟器（iOS 26.2），通过 idb 执行真实交互并保留原始速度，不是真机性能测试。充电面板的已安装版本只在编译时会移除的 TypeScript 类型导入上不同，交互代码一致。

## 面板、镜头与卡片入场 {#cockpit}

[打开配方并复制源码](/zh-Hans/recipes/drive-cockpit) · [项目源码](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/useCockpitGesture.ts)

手势 hook 将纵向拖动绑定到面板，并把位置写入共享 offset。Home 用它调整镜头构图，ControlSheet 用它控制箭头、摘要和交错卡片入场。松手时使用速度 × 0.18 预测位置，再选择展开或收起。

<Clip name="drive-cockpit-ios" :width="320" caption="Jolt Drive · iPhone 17 Pro 模拟器，iOS 26.2。通过 idb 在原生应用中执行真实交互，保持原始速度。英文界面；非真机录屏，也不是性能测试。" />

**准备.** 需要 NativeScript-Vue 模板 ref：root（GestureSurface）和 scrollContent（ScrollView），以及 offset 动效值、测量后的 height/closed 位置和 active 状态。Home 与 ControlSheet 将 offset 映射到镜头和卡片；手势 hook 本身不创建 3D 场景。

**生命周期与适配.** 在 setup 中调用 useCockpitGesture，确保 hooks 执行时 root 与 scrollContent 已挂载。将 active 接入页面生命周期。停用时暂停输入，卸载时释放订阅、绑定和控制器。共享进度的使用方式见 Home/index.vue 与 ControlSheet.vue。

## 由弹簧驱动的选择状态 {#atmosphere}

[打开配方并复制源码](/zh-Hans/recipes/drive-atmosphere) · [项目源码](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/AtmosphereOption.vue)

目标值在 0 与 1 之间切换。刚度 420、阻尼 30、质量 1 的弹簧同时驱动背景色、边框色、圆角和文字颜色。父组件修改 selected，并管理应用主题。

<Clip name="drive-atmosphere-ios" :width="320" caption="Jolt Drive · iPhone 17 Pro 模拟器，iOS 26.2。通过 idb 在原生应用中执行真实交互，保持原始速度。英文界面；非真机录屏，也不是性能测试。" />

**准备.** 提供 name、color、selected，处理 select 事件，并安装 Jolt Vue 插件以使用 v-press。复制或替换 springs.snap 与 withAlpha 辅助函数。父组件管理选中项，无需 SceneKit。

**生命周期与适配.** 保留 Jolt Vue 插件和 useMotionScope，让弹簧与绑定归属组件作用域。替换 @/themes 导入或复制对应辅助函数。用状态驱动选中项，不要每次点击都创建新弹簧。继续遵循 Jolt 的减少动态效果设置。

## 模糊背景上的清晰面板 {#charge-sheet}

[打开配方并复制源码](/zh-Hans/recipes/drive-charge-sheet) · [项目源码](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/pages/Home/EnergyPlan.vue)

仅对车库背景应用模糊。面板作为同级元素保持清晰，提供 content 与 90% 吸附点、ScrollView 和遮罩。模糊后端不可用时提高遮罩不透明度。保存和关闭共享退出流程。

<Clip name="drive-charge-sheet-ios" :width="320" caption="Jolt Drive · iPhone 17 Pro 模拟器，iOS 26.2。通过 idb 在原生应用中执行真实交互，保持原始速度。英文界面；非真机录屏，也不是性能测试。" />

**准备.** 注册 GestureSurface 与 Jolt Vue 指令，提供 accent、level、limit 和已挂载的车库 background 视图；面板应为其同级元素。适配 Icon、safeArea 和主题辅助函数。处理 save/close 时等待退出完成再卸载。

**生命周期与适配.** 面板必须位于模糊背景的子树之外。onDismiss 等待模糊清除后才发出 close，并检查组件是否已卸载。保留 useMotionScope 并释放 blur 对象。宿主还需管理焦点恢复、语义和页面生命周期。

## 从环绕镜头进入座舱 {#cabin}

[打开配方并复制源码](/zh-Hans/recipes/drive-cabin) · [项目源码](https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/src/components/scene/Car3D.vue)

镜头先对齐车门，随后 inside 在 1900 毫秒内从 0 变为 1，退出耗时 1400 毫秒。渲染器把位置、焦点、视场角、灯光和材质绑定到进度。进门路径使用镜头坐标系下的二次插值。

<Clip name="drive-cabin-ios" :width="320" caption="Jolt Drive · iPhone 17 Pro 模拟器，iOS 26.2。通过 idb 在原生应用中执行真实交互，保持原始速度。英文界面；非真机录屏，也不是性能测试。" />

**准备.** 仅支持 iOS。依赖项目的 SceneView/createCarStage、camera-path、模型、材质、ClimatePanel 及 @rafaelaugusto/jolt-native。应使用自己的场景尺寸。Car3D 是完整源文件，并非独立镜头函数或 Web 实现。

**生命周期与适配.** 结合 car-stage.ios.ts 与 camera-path.ts 阅读 Car3D.vue，按模型调整门口、眼睛和焦点位置。保留修订号检查、减少动态效果、active/foreground 处理，以及原生属性对象与重建绑定的生命周期区分。SceneKit 仅限 iOS，不是 Web API。

## 录屏与源码来源 {#provenance}

源文件以已核对的快照保存，并通过 SHA-256 校验。源码按钮指向固定提交，避免随 main 静默变化。完整界面与资源请运行原项目。
