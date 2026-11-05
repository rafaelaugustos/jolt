<script setup lang="ts">
import { ref } from 'vue'
import { withBase } from 'vitepress'
import { useWords } from './copy'
import { useMotion } from './useMotion'
import { auralisCaption } from './recipes'
import NativeVideo from './NativeVideo.vue'

const { t, link } = useWords()
const section = ref<HTMLElement>()
const phone = ref<HTMLElement>()
const still = ref<HTMLElement>()
const emblem = ref<HTMLElement>()
const { ready } = useMotion((motion) => {
  const range = { element: section.value!, start: 'start end', end: 'end start' } as const
  motion.scrollLinked(
    document,
    phone.value!,
    { y: [35, -35], rotate: [5, -2] },
    { range },
  )
  motion.scrollLinked(
    document,
    still.value!,
    { y: [-25, 45], rotate: [-15, -8] },
    { range },
  )
  motion.scrollLinked(
    document,
    emblem.value!,
    { y: [15, -25], rotate: [-12, 18] },
    { range },
  )
  for (const item of [phone.value!, still.value!, emblem.value!])
    motion.observeGeometry(item)
})
</script>

<template>
  <section
    ref="section"
    class="auralis-feature"
    aria-labelledby="auralis-title"
    :data-auralis-ready="ready"
  >
    <div class="auralis-topline">
      <span>AURALIS / NATIVESCRIPT + JOLT</span
      ><span>{{
        t(['THE ART OF ARRIVING', 'A ARTE DE CHEGAR', 'EL ARTE DE LLEGAR', '登场的艺术'])
      }}</span>
    </div>
    <div class="auralis-composition">
      <div class="auralis-copy">
        <p class="auralis-kicker">
          {{
            t([
              'A FIRST IMPRESSION THAT STAYS.',
              'UMA PRIMEIRA IMPRESSÃO QUE FICA.',
              'UNA PRIMERA IMPRESIÓN QUE PERDURA.',
              '让初见留在心间。',
            ])
          }}
        </p>
        <h2 id="auralis-title">
          {{ t(['Make an', 'Chegue', 'Una gran', '初见，']) }}<br /><em>{{
            t(['entrance.', 'marcando.', 'entrada.', '心动。'])
          }}</em>
        </h2>
        <p class="auralis-description">
          {{
            t([
              'Glass that floats. Light that leads. Three scenes that make the very first touch feel like the start of something.',
              'Vidro que flutua. Luz que guia. Três cenas que fazem o primeiro toque parecer o começo de algo.',
              'Cristal que flota. Luz que guía. Tres escenas que convierten el primer toque en el comienzo de algo.',
              '玻璃轻浮，光影引路。三个场景，让第一次触碰成为美好的开始。',
            ])
          }}
        </p>
        <a class="auralis-primary" :href="link('/guide/showcase#auralis')"
          >{{ t(['Meet Auralis', 'Conheça o Auralis', 'Conoce Auralis', '认识 Auralis'])
          }}<span aria-hidden="true">↗</span></a
        >
        <a class="auralis-recipes" :href="link('/recipes/?q=Auralis')"
          >{{
            t([
              'Two recipes. Yours to remix.',
              'Duas receitas. Crie do seu jeito.',
              'Dos recetas. Hazlas tuyas.',
              '两个配方，任你改编。',
            ])
          }}
          <span aria-hidden="true">↗</span></a
        >
        <ol class="auralis-chapters">
          <li>
            <span>01</span
            >{{ t(['Possibility', 'Possibilidades', 'Posibilidades', '可能']) }}
          </li>
          <li><span>02</span>{{ t(['Connection', 'Conexão', 'Conexión', '连接']) }}</li>
          <li><span>03</span>{{ t(['Flow', 'Fluxo', 'Flujo', '流动']) }}</li>
        </ol>
      </div>
      <div class="auralis-stage">
        <div class="auralis-halo" aria-hidden="true"></div>
        <div ref="still" class="auralis-still" aria-hidden="true">
          <img
            :src="withBase('/media/auralis-workspace.png')"
            width="804"
            height="1748"
            alt=""
            loading="lazy"
          />
        </div>
        <div ref="phone" class="auralis-phone">
          <NativeVideo
            name="auralis-native-ios"
            poster="/media/auralis-native-ios.jpg"
            :caption="t(auralisCaption)"
          />
        </div>
        <div ref="emblem" class="auralis-emblem" aria-hidden="true">
          <img
            :src="withBase('/media/auralis-mark.png')"
            width="160"
            height="160"
            alt=""
            loading="lazy"
          />
        </div>
      </div>
    </div>
    <div class="auralis-bottom">
      <span class="auralis-wordmark">Auralis<span aria-hidden="true">✧</span></span>
      <p>{{ t(auralisCaption) }}</p>
    </div>
  </section>
</template>

<style scoped>
.auralis-feature {
  overflow: hidden;
  background: #e2e7f5;
  color: #252b54;
  padding: 30px max(32px, calc((100vw - 1296px) / 2)) 28px;
}
.auralis-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #59608b30;
  padding-bottom: 22px;
  font: 9px/1.8 var(--vp-font-family-mono);
  letter-spacing: 0.09em;
}
.auralis-topline > span:last-child {
  color: #6d7298;
}
.auralis-composition {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  align-items: center;
  gap: 50px;
  padding: 70px 0 60px;
}
.auralis-kicker {
  font: 9px/1.8 var(--vp-font-family-mono);
  letter-spacing: 0.07em;
  color: #657099;
  margin-bottom: 28px;
}
.auralis-copy h2 {
  font-size: clamp(65px, 8.2vw, 118px);
  line-height: 0.94;
  letter-spacing: -0.075em;
  font-weight: 500;
  margin: 0 0 28px;
}
.auralis-copy h2 em {
  font-family: Georgia, serif;
  font-weight: 400;
  color: #7176aa;
}
.auralis-description {
  max-width: 365px;
  font-size: 16px;
  line-height: 1.8;
  color: #616888;
  margin-bottom: 30px;
}
.auralis-primary {
  display: inline-flex;
  gap: 50px;
  align-items: center;
  padding: 17px 24px;
  background: #30365d;
  border-radius: 50px;
  color: #f1f1fa;
  font-size: 13px;
}
.auralis-primary:hover {
  background: #4b507d;
}
.auralis-recipes {
  display: block;
  width: fit-content;
  font-size: 12px;
  border-bottom: 1px solid #6d729855;
  margin-top: 20px;
  padding-bottom: 5px;
}
.auralis-chapters {
  display: flex;
  gap: 36px;
  padding: 0;
  list-style: none;
  margin: 48px 0 0;
  font-size: 11px;
}
.auralis-chapters span {
  display: block;
  font: 9px/1.8 var(--vp-font-family-mono);
  margin-bottom: 8px;
  color: #8188ab;
}
.auralis-stage {
  position: relative;
  min-width: 0;
  padding: 20px 15px 35px 100px;
}
.auralis-halo {
  position: absolute;
  inset: 12% -15% 8% -15%;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at 45% 35%,
    #ffffff 0%,
    #c6e9f0bb 25%,
    #b8b6e78c 46%,
    #e2e7f500 70%
  );
}
.auralis-phone {
  position: relative;
  width: min(290px, 100%);
  margin-inline: auto;
  border: 5px solid #414563;
  border-radius: 38px;
  box-shadow: 12px 28px 55px #3d447238;
  z-index: 2;
  background: #090b26;
}
.auralis-phone video {
  display: block;
  width: 100%;
  aspect-ratio: 1206/2622;
  border-radius: 32px;
}
.auralis-still {
  position: absolute;
  width: 200px;
  max-width: 48%;
  top: 70px;
  left: 8px;
}
.auralis-still img {
  width: 100%;
  border: 4px solid #777c9c;
  border-radius: 29px;
  box-shadow: 0 22px 45px #3d44722b;
}
.auralis-emblem {
  position: absolute;
  width: 150px;
  right: -15px;
  bottom: 15px;
  z-index: 1;
  pointer-events: none;
}
.auralis-emblem img {
  width: 100%;
}
.auralis-bottom {
  display: flex;
  gap: 55px;
  justify-content: space-between;
  align-items: end;
  border-top: 1px solid #59608b30;
  padding-top: 24px;
}
.auralis-wordmark {
  font-size: clamp(65px, 8vw, 116px);
  line-height: 1;
  letter-spacing: -0.08em;
  color: #9a9fc1;
}
.auralis-wordmark > span {
  font-size: 0.6em;
  vertical-align: top;
  color: #69709b;
  margin-left: 6px;
}
.auralis-bottom p {
  max-width: 470px;
  font-size: 10px;
  line-height: 1.8;
  color: #707797;
  margin: 0;
}
@media (max-width: 959px) {
  .auralis-composition {
    gap: 20px;
    padding-block: 60px;
  }
  .auralis-copy h2 {
    font-size: 74px;
  }
  .auralis-description {
    font-size: 14px;
  }
  .auralis-stage {
    padding-left: 45px;
    padding-right: 0;
  }
  .auralis-still {
    left: -15px;
  }
  .auralis-emblem {
    width: 110px;
  }
}
@media (max-width: 639px) {
  .auralis-feature {
    padding: 26px 24px;
  }
  .auralis-topline {
    font-size: 8px;
    letter-spacing: 0;
  }
  .auralis-topline > span:last-child {
    max-width: 95px;
    text-align: right;
  }
  .auralis-composition {
    grid-template-columns: minmax(0, 1fr);
    gap: 50px;
    padding: 44px 0 40px;
  }
  .auralis-copy h2 {
    font-size: clamp(59px, 14.5vw, 92px);
  }
  .auralis-kicker {
    font-size: 8px;
  }
  .auralis-chapters {
    gap: 28px;
    margin-top: 30px;
  }
  .auralis-stage {
    width: min(380px, 100%);
    margin: auto;
    padding: 15px 5px 30px 50px;
  }
  .auralis-phone {
    border-width: 4px;
    border-radius: 30px;
  }
  .auralis-phone video {
    border-radius: 25px;
  }
  .auralis-still {
    left: 0;
    top: 40px;
  }
  .auralis-still img {
    border-radius: 21px;
    border-width: 3px;
  }
  .auralis-emblem {
    left: -12px;
    right: auto;
    width: 90px;
  }
  .auralis-bottom {
    display: block;
  }
  .auralis-bottom p {
    margin-top: 18px;
  }
}
</style>
