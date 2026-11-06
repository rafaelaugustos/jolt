<script setup lang="ts">
import { ref } from 'vue'
import { withBase } from 'vitepress'
import { useWords } from './copy'
import { useMotion } from './useMotion'
import { venaCaption } from './recipes'
import NativeVideo from './NativeVideo.vue'

const { t, link } = useWords()
const section = ref<HTMLElement>()
const phone = ref<HTMLElement>()
const heart = ref<HTMLElement>()
const { ready } = useMotion((motion) => {
  const range = { element: section.value!, start: 'start end', end: 'end start' } as const
  motion.scrollLinked(
    document,
    phone.value!,
    { y: [40, -40], rotate: [4, -2] },
    { range },
  )
  motion.scrollLinked(
    document,
    heart.value!,
    { y: [-35, 35], scale: [0.92, 1.06] },
    { range },
  )
  for (const item of [phone.value!, heart.value!]) motion.observeGeometry(item)
})
</script>

<template>
  <section
    ref="section"
    class="vena-feature"
    aria-labelledby="vena-title"
    :data-vena-ready="ready"
  >
    <div class="vena-topline">
      <span><i aria-hidden="true"></i> VENA / NATIVESCRIPT + JOLT</span>
      <span>{{
        t(['A RHYTHM OF YOUR OWN', 'UM RITMO SÓ SEU', 'UN RITMO PROPIO', '属于你的节奏'])
      }}</span>
    </div>
    <div class="vena-composition">
      <div class="vena-copy">
        <p class="vena-kicker">
          {{
            t([
              '200,000 POINTS OF LIGHT.',
              '200 MIL PONTOS DE LUZ.',
              '200 MIL PUNTOS DE LUZ.',
              '20 万个光点。',
            ])
          }}
        </p>
        <h2 id="vena-title">
          {{ t(['Every point.', 'Cada ponto.', 'Cada punto.', '每一点光，'])
          }}<br /><em>{{ t(['A pulse.', 'Um pulso.', 'Un pulso.', '一次心动。']) }}</em>
        </h2>
        <p class="vena-description">
          {{
            t([
              'A heart made of light. A body that moves with you. Get closer, change the rhythm, and watch every point come alive.',
              'Um coração feito de luz. Um corpo que responde a você. Chegue perto, mude o ritmo e veja cada ponto ganhar vida.',
              'Un corazón hecho de luz. Un cuerpo que responde a ti. Acércate, cambia el ritmo y mira cómo cada punto cobra vida.',
              '光点织成心脏，身体随你而动。靠近，改变节奏，看每一点光鲜活起来。',
            ])
          }}
        </p>
        <a class="vena-primary" :href="link('/guide/showcase#vena')"
          >{{ t(['Feel Vena', 'Sinta o Vena', 'Siente Vena', '感受 Vena']) }}
          <span aria-hidden="true">↗</span></a
        >
        <a class="vena-recipes" :href="link('/recipes/?q=Vena')"
          >{{
            t([
              'Take the motion with you',
              'Leve o movimento com você',
              'Llévate el movimiento',
              '把动效带走',
            ])
          }}
          <span aria-hidden="true">↗</span></a
        >
        <div class="vena-signal" aria-hidden="true">
          <svg viewBox="0 0 360 60" fill="none">
            <path
              d="M0 30H82L94 25L105 30H129L142 44L154 4L169 56L184 30H221Q238 12 254 30H360"
            />
          </svg>
          <span>01 — FORM / 02 — PULSE / 03 — FEEL</span>
        </div>
      </div>
      <div class="vena-stage">
        <div ref="heart" class="vena-heart" aria-hidden="true">
          <img
            :src="withBase('/media/vena-heart.jpg')"
            width="600"
            height="960"
            alt=""
            loading="lazy"
          />
        </div>
        <div ref="phone" class="vena-phone">
          <NativeVideo
            name="vena-native-ios"
            poster="/media/vena-native-ios.jpg"
            :caption="t(venaCaption)"
          />
        </div>
        <span class="vena-stage-label">{{
          t([
            'iOS / NATIVE RECORDING',
            'iOS / GRAVAÇÃO NATIVA',
            'iOS / GRABACIÓN NATIVA',
            'iOS / 原生录屏',
          ])
        }}</span>
      </div>
    </div>
    <div class="vena-bottom">
      <span class="vena-wordmark" aria-hidden="true">VENA<span>↗</span></span>
      <div class="vena-notes">
        <p>{{ t(venaCaption) }}</p>
        <a :href="link('/guide/vena-recipes#credits')"
          >BodyParts3D © DBCLS · CC BY 4.0 / MakeHuman · CC0 ↗</a
        >
      </div>
    </div>
  </section>
</template>

<style scoped>
.vena-feature {
  position: relative;
  overflow: hidden;
  background: #090709;
  color: #f9edf1;
  padding: 30px max(32px, calc((100vw - 1296px) / 2)) 26px;
}
.vena-topline {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 22px;
  border-bottom: 1px solid #f69cb52b;
  font: 9px/1.8 var(--vp-font-family-mono);
  letter-spacing: 0.09em;
}
.vena-topline > span:first-child {
  display: flex;
  align-items: center;
  gap: 9px;
}
.vena-topline i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #ff4067;
  box-shadow: 0 0 14px #ff4067;
}
.vena-topline > span:last-child {
  color: #b59da8;
}
.vena-composition {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 60px;
  padding: 70px 0 55px;
}
.vena-copy {
  z-index: 1;
}
.vena-kicker {
  color: #ff829b;
  font: 10px/1.8 var(--vp-font-family-mono);
  letter-spacing: 0.1em;
  margin-bottom: 28px;
}
.vena-copy h2 {
  font-size: clamp(62px, 7.8vw, 112px);
  font-weight: 500;
  line-height: 0.98;
  letter-spacing: -0.075em;
  margin: 0 0 28px;
}
.vena-copy h2 em {
  color: #ff4d73;
  font-family: Georgia, serif;
  font-weight: 400;
}
.vena-description {
  color: #bfaab4;
  max-width: 350px;
  font-size: 16px;
  line-height: 1.8;
  margin-bottom: 30px;
}
.vena-primary {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 60px;
  padding: 17px 24px;
  border-radius: 50px;
  background: #ff4d73;
  color: #200810;
  font-size: 13px;
}
.vena-recipes {
  display: flex;
  gap: 15px;
  width: fit-content;
  margin-top: 20px;
  font-size: 12px;
  color: #ddbdc9;
}
.vena-primary:hover {
  background: #ff91a9;
}
.vena-recipes:hover,
.vena-notes a:hover {
  color: white;
}
.vena-feature a:focus-visible {
  outline: 2px solid #ff91a9;
  outline-offset: 6px;
}
.vena-signal {
  max-width: 340px;
  margin-top: 48px;
  color: #b59da8;
}
.vena-signal svg {
  display: block;
  width: 100%;
  stroke: #e2375c;
  stroke-width: 1;
}
.vena-signal span {
  display: block;
  margin-top: 16px;
  font: 8px/1.8 var(--vp-font-family-mono);
  letter-spacing: 0.1em;
}
.vena-stage {
  position: relative;
  min-width: 0;
  min-height: 650px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.vena-heart {
  position: absolute;
  width: 460px;
  max-width: 110%;
  left: -38%;
  top: -10%;
  opacity: 0.65;
  mask-image: radial-gradient(ellipse, black 25%, transparent 68%);
}
.vena-heart img {
  width: 100%;
}
.vena-phone {
  width: min(284px, 80%);
  position: relative;
  z-index: 1;
}
.vena-phone :deep(video) {
  display: block;
  width: 100%;
  aspect-ratio: 804 / 1748;
  object-fit: cover;
  background: #000;
  border: 5px solid #30212a;
  border-radius: 38px;
  box-shadow:
    0 35px 80px #0008,
    20px 0 100px #ff174315;
}
.vena-stage-label {
  position: absolute;
  right: -18px;
  writing-mode: vertical-rl;
  color: #bb8596;
  font: 9px/1.8 var(--vp-font-family-mono);
  letter-spacing: 0.14em;
}
.vena-bottom {
  border-top: 1px solid #f69cb52b;
  padding-top: 28px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 40px;
}
.vena-wordmark {
  font-size: clamp(90px, 15vw, 216px);
  line-height: 0.85;
  letter-spacing: -0.09em;
  font-weight: 300;
}
.vena-wordmark > span {
  color: #ff4d73;
  font-size: 0.4em;
  vertical-align: top;
  margin-left: 20px;
}
.vena-notes {
  max-width: 360px;
  color: #b59da8;
  font-size: 9px;
  line-height: 1.8;
}
.vena-notes p {
  margin-bottom: 12px;
}
.vena-notes a {
  color: #e2a9bb;
}
@media (max-width: 960px) {
  .vena-composition {
    gap: 10px;
  }
  .vena-stage {
    min-height: 580px;
  }
  .vena-heart {
    left: -20%;
  }
  .vena-copy h2 {
    font-size: clamp(56px, 8vw, 82px);
  }
}
@media (max-width: 640px) {
  .vena-feature {
    padding: 24px;
  }
  .vena-topline {
    font-size: 8px;
  }
  .vena-topline > span:last-child {
    display: none;
  }
  .vena-composition {
    grid-template-columns: 1fr;
    gap: 30px;
    padding: 45px 0 35px;
  }
  .vena-copy h2 {
    font-size: clamp(56px, 12vw, 78px);
  }
  .vena-description {
    font-size: 14px;
  }
  .vena-signal {
    display: none;
  }
  .vena-stage {
    min-height: 570px;
  }
  .vena-heart {
    left: -25%;
    top: 0;
    width: 380px;
  }
  .vena-phone {
    width: min(260px, 85%);
  }
  .vena-stage-label {
    right: -12px;
  }
  .vena-bottom {
    align-items: flex-start;
    flex-direction: column;
    gap: 28px;
  }
  .vena-wordmark {
    font-size: 24vw;
  }
}
</style>
