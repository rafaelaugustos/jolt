---
pageClass: showcase-page
motionSite: true
title: Showcase
sidebar: false
aside: false
prev: false
next: false
---

<ShowcaseExperience>

<div class="showcase-intro">
  <p class="showcase-kicker">用 JOLT 创作</p>

<h1>真实应用。<br /><em>真实触动。</em></h1>

探索使用 Jolt 制作的原生应用。观看录屏，了解其中的功能，也分享你自己的作品。

<a class="showcase-submit-link" href="#submit-app">提交你的应用 <span aria-hidden="true">↗</span></a>
<nav class="showcase-index" aria-label="Showcase"><a href="#auralis"><span>01</span>Auralis ↗</a><a href="#morrow"><span>02</span>Morrow ↗</a><a href="#jolt-drive"><span>03</span>Jolt Drive ↗</a><a href="#hexdrop"><span>04</span>Hexdrop ↗</a><a href="#submit-app"><span>05</span>你的项目 ↗</a></nav>
</div>

<section class="showcase-feature" aria-labelledby="auralis">
  <h2 id="auralis">Auralis<span>.</span></h2>
  <div class="showcase-copy">
    <p class="showcase-kicker">NATIVESCRIPT-VUE + JOLT RC.11 <span class="showcase-platform">iOS</span></p>
    <p class="showcase-lead">用光塑造第一印象。悬浮玻璃卡片、虹彩文字，三个自然流转的场景。</p>
    <p class="showcase-note">由 Rafael Augusto 使用 NativeScript-Vue 和 Jolt RC.11 构建。采用原生视图、矢量路径、渐变和粒子的引导演示。团队和服务仅为示意，不连接外部服务；未展示原生 Android 运行。</p>
    <div class="showcase-project-links"><a href="https://github.com/rafaelaugustos/auralis">查看项目 ↗</a><a href="/zh-Hans/recipes/?q=Auralis">探索两个配方 ↗</a></div>
    <button type="button" class="showcase-watch" data-watch="auralis">观看影片 <span aria-hidden="true">↗</span></button>
  </div>
  <div class="showcase-stage">
    <div class="showcase-art" aria-hidden="true"><img src="/media/auralis-workspace.png" alt="" width="804" height="1748" /></div>
    <Clip name="auralis-native-ios" :autoplay="false" poster="/media/auralis-native-ios.jpg" :width="280" caption="Auralis iOS 创作者录屏：动画开场、悬浮玻璃卡片、三个引导场景和页面控件。原始速度，无音频；省略最初 4.25 秒的系统主屏幕与启动转场。录制设备未说明；非性能测试。账户和服务均为示意。" />
  </div>
</section>

<section class="showcase-feature" aria-labelledby="morrow">
  <h2 id="morrow">Morrow<span>.</span></h2>
  <div class="showcase-copy">
    <p class="showcase-kicker">精选项目 <span class="showcase-platform">iOS · NativeScript + Jolt</span></p>
    <p class="showcase-lead">让音乐触动人心。可触碰的唱片播放器、鲜活的艺人页面，以及进入视频的转场。</p>
    <p class="showcase-note">由 Rafael Augusto 使用 NativeScript 和 Jolt 构建。创作者提供了真实应用录屏，录制设备与公开发布情况未说明。</p>
    <button type="button" class="showcase-watch" data-watch="morrow">播放演示 <span aria-hidden="true">↗</span></button>
  </div>
  <div class="showcase-stage showcase-morrow-stage">
    <div class="showcase-art" aria-hidden="true"><img src="/media/morrow-artist-ios.jpg" alt="" width="300" height="650" /></div>
    <Clip name="morrow-native-ios" :autoplay="false" poster="/media/morrow-native-ios.jpg" :width="280" caption="iOS 上的 Morrow：创作者提供的录屏展示动画开场、艺人页面、唱片播放器、进度拖动与视频转场。保持原始时间，以 60 fps 编码；仅省略最初 2.4 秒的系统主屏幕。录制设备未说明，并非真机性能测试。" />
  </div>
</section>

<section class="showcase-feature" aria-labelledby="jolt-drive">
  <h2 id="jolt-drive">Jolt Drive<span>.</span></h2>
  <div class="showcase-copy">
    <p class="showcase-kicker">精选应用 <span class="showcase-platform">iOS · SceneKit</span></p>
    <span id="jolt-car" aria-hidden="true"></span>
    <p class="showcase-lead">走进一座可以探索的车库。转动车辆、进入驾驶舱，感受每个控件的响应。</p>
    <ul class="showcase-points">
      <li>使用<a href="./rolling">滚动数字</a>显示里程和百分比。</li>
      <li>使用 <a href="./scene-camera">SceneKit</a> 摄像机探索车辆、驾驶舱和街道。</li>
      <li>控件使用<a href="./press">按压反馈</a>和弹簧动画。</li>
    </ul>
    <p class="showcase-note">由 Rafael Augusto 使用 NativeScript-Vue、Jolt 和 Vue Router NS 构建。SceneKit 车库、原生控件与 MapKit 路线相结合。电池、空调和接驾均为模拟；应用不连接真实车辆。</p>
    <div class="showcase-project-links"><a href="https://github.com/rafaelaugustos/jolt-drive">在 GitHub 查看 ↗</a><a href="https://github.com/rafaelaugustos/jolt-drive#run-it">运行项目 ↗</a></div>
    <button type="button" class="showcase-watch" data-watch="jolt-drive">播放演示 <span aria-hidden="true">↗</span></button>
  </div>
  <div class="showcase-stage">
    <Clip name="jolt-drive-entrance-ios" :autoplay="false" poster="/media/jolt-drive-entrance-ios.jpg" :width="280" caption="Jolt Drive 的 iOS 车库入场：来自项目发布的 GIF，转为 MP4 并保留每帧时间戳。录制设备未说明；此预览不用于衡量渲染性能。" />
  </div>
</section>

<section class="showcase-recipes">

## 把动效带入你的应用

来自真实项目的四个配方：联动控制台、弹簧驱动的氛围选择、背景模糊的充电面板，以及进入座舱的镜头。每个配方都有原生录屏、已核对的代码和适配提示词。

[探索 4 个配方](/zh-Hans/recipes/?q=Jolt%20Drive) · [阅读集成指南](./drive-recipes)

</section>

<div class="drive-screens">
  <figure><img src="/media/jolt-drive-garage.png" width="368" height="800" loading="lazy" alt="Jolt Drive 车库，展示 3D 汽车、续航与快捷控件" /><figcaption><span>01</span>车库</figcaption></figure>
  <figure><img src="/media/jolt-drive-cockpit.png" width="368" height="800" loading="lazy" alt="Jolt Drive 控制台，展示充电、空调与氛围选项" /><figcaption><span>02</span>控制台</figcaption></figure>
  <figure><img src="/media/jolt-drive-pickup.png" width="368" height="800" loading="lazy" alt="Jolt Drive 在奥斯汀模拟接驾，提供暂停与路线控件" /><figcaption><span>03</span>穿行奥斯汀</figcaption></figure>
</div>
<p class="showcase-note">来自已发布项目的界面。 <a href="https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/README.md">来源与安装 ↗</a></p>

<section class="showcase-feature" aria-labelledby="hexdrop">
  <h2 id="hexdrop"><img class="hexdrop-app-icon" src="/media/hexdrop-icon.png" width="72" height="72" alt="" />Hexdrop<span>.</span></h2>
  <div class="showcase-copy">
    <p class="showcase-kicker">NATIVESCRIPT-VUE + JOLT RC.11 <span class="showcase-platform">iOS</span></p>
    <p class="showcase-lead">一个文件，一点魔法。投下原料，唤醒绿色魔药，看小蜘蛛搭上摇摆的瓶塞。</p>
    <p class="showcase-note">由 Rafael Augusto 使用 NativeScript-Vue 和 Jolt RC.11 构建。原生视图、矢量路径、渐变与粒子。这是本地交互演示，不上传文件。尚未验证 Android 运行。</p>
    <div class="showcase-project-links"><a href="https://github.com/rafaelaugustos/hexdrop">查看项目 ↗</a><a href="/zh-Hans/recipes/hexdrop-drag">获取拖动配方 ↗</a><a href="/zh-Hans/recipes/hexdrop-launch">开场的小魔法。 ↗</a></div>
    <button type="button" class="showcase-watch" data-watch="hexdrop">观看魔法 <span aria-hidden="true">↗</span></button>
  </div>
  <div class="showcase-stage">
    <Clip name="hexdrop-creator-ios" :autoplay="false" poster="/media/hexdrop-creator-ios.jpg" :width="280" caption="Hexdrop iOS 创作者录屏：动画开场、拖动、酿制、文档选择与重播。原始速度，无音频；省略最初 3.8 秒的系统主屏幕与启动转场。录制设备未说明。本地演示，不上传文件。" />
  </div>
</section>

<section class="showcase-archive">

## 走进体验

以下保留的录屏展示早期 Jolt Car 版本。上方的入场动画与截图来自已发布的 Jolt Drive 项目。

<div class="showcase-scenes">
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>01</span><h3>车库与控件</h3><p>环绕汽车，体验原生控件。</p></div>
    <Clip name="film-car-ios" :autoplay="false" poster="/media/film-car-ios.jpg" :width="260" caption="Jolt Car 在专用 iPhone 17 模拟器（iOS 26.2）中的录屏。通过 XCTest 执行真实点击和拖动，展示进入场景、摄像机环绕、驾驶舱、充电、温度和前灯。原始速度。本地示例界面，不连接任何真实车辆或服务。录屏无法传达触觉反馈。" />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>02</span><h3>进入驾驶舱</h3><p>轻触控件，切换观察视角。</p></div>
    <Clip name="film-impulse-cabin-ios" :autoplay="false" poster="/media/film-impulse-cabin-ios.jpg" caption="Jolt Car 在 iPhone 17 模拟器（iOS 26.2）中的录屏。XCTest 对空调控件的真实交互使原生 SceneKit 摄像机进入驾驶舱，再返回外部。无剪辑，原始速度。车辆是本地示例界面，不控制任何实体车辆。SceneKit 仅适用于 iOS；录屏无法传达触觉反馈。" />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>03</span><h3>沿着 Congress Avenue</h3><p>从驾驶位欣赏奥斯汀街景。</p></div>
    <Clip name="jolt-car-drive-ios" :autoplay="false" poster="/media/jolt-car-drive-ios.jpg" caption="Jolt Car iOS 应用录屏。空驾驶舱沿着预设路线向北行驶，经过奥斯汀的 Congress Avenue，并在 5th and Congress 路口等待。屏幕上的车速和到达时间持续更新。本地示例界面，不连接任何真实车辆或服务。这不是实体设备性能测量。" />
  </article>
</div>

</section>

<section class="showcase-community">

## 你的应用也可以在这里展示 {#submit-app}

<ShowcaseBoard />

</section>
</ShowcaseExperience>
