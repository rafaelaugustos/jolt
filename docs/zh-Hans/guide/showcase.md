---
pageClass: showcase-page
sidebar: false
aside: false
prev: false
next: false
---

<div class="showcase-intro">
  <p class="showcase-kicker">用 JOLT 创作</p>

# 细节虽小，应用出众。

探索使用 Jolt 制作的原生应用。观看录屏，了解其中的功能，也分享你自己的作品。

<a class="showcase-submit-link" href="#submit-app">提交你的应用 <span aria-hidden="true">↗</span></a>
</div>

<section class="showcase-feature" aria-labelledby="jolt-car">
  <div class="showcase-copy">
    <p class="showcase-kicker">精选应用 <span class="showcase-platform">iOS · SceneKit</span></p>
    <h2 id="jolt-car">Jolt Car<span>.</span></h2>
    <p class="showcase-lead">走进一座可以探索的车库。转动车辆、进入驾驶舱，感受每个控件的响应。</p>
    <ul class="showcase-points">
      <li>使用<a href="./rolling">滚动数字</a>显示里程和百分比。</li>
      <li>使用 <a href="./scene-camera">SceneKit</a> 摄像机探索车辆、驾驶舱和街道。</li>
      <li>控件使用<a href="./press">按压反馈</a>和弹簧动画。</li>
    </ul>
    <p class="showcase-note">这是本地示例。充电、空调和行驶过程都在手机上模拟。详细模型属于 <code>jolt-car</code> 预览，不包含在此仓库中。</p>
  </div>
  <div class="showcase-stage">
    <Clip name="film-car-ios" :width="260" caption="Jolt Car 在专用 iPhone 17 模拟器（iOS 26.2）中的录屏。通过 XCTest 执行真实点击和拖动，展示进入场景、摄像机环绕、驾驶舱、充电、温度和前灯。原始速度。本地示例界面，不连接任何真实车辆或服务。录屏无法传达触觉反馈。" />
  </div>
</section>

## 走进体验

从摄像机到控件，看看细节如何动起来。

<div class="showcase-scenes">
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>01</span><h3>进入驾驶舱</h3><p>轻触控件，切换观察视角。</p></div>
    <Clip name="film-impulse-cabin-ios" caption="Jolt Car 在 iPhone 17 模拟器（iOS 26.2）中的录屏。XCTest 对空调控件的真实交互使原生 SceneKit 摄像机进入驾驶舱，再返回外部。无剪辑，原始速度。车辆是本地示例界面，不控制任何实体车辆。SceneKit 仅适用于 iOS；录屏无法传达触觉反馈。" />
  </article>
  <article class="showcase-scene">
    <div class="showcase-scene-heading"><span>02</span><h3>沿着 Congress Avenue</h3><p>从驾驶位欣赏奥斯汀街景。</p></div>
    <Clip name="jolt-car-drive-ios" caption="Jolt Car iOS 应用录屏。空驾驶舱沿着预设路线向北行驶，经过奥斯汀的 Congress Avenue，并在 5th and Congress 路口等待。屏幕上的车速和到达时间持续更新。本地示例界面，不连接任何真实车辆或服务。这不是实体设备性能测量。" />
  </article>
</div>

## 你的应用也可以在这里展示 {#submit-app}

<ShowcaseBoard />
