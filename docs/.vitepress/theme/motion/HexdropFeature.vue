<script setup lang="ts">
import { ref } from 'vue'
import { withBase } from 'vitepress'
import { useWords } from './copy'
import { useMotion } from './useMotion'
import { hexdropCaption } from './recipes'
import NativeVideo from './NativeVideo.vue'

const { t, link } = useWords()
const section = ref<HTMLElement>()
const phone = ref<HTMLElement>()
const orbit = ref<HTMLElement>()
const { ready } = useMotion((motion) => {
  const range = { element: section.value!, start: 'start end', end: 'end start' } as const
  motion.scrollLinked(
    document,
    phone.value!,
    { y: [35, -35], rotate: [-5, 3] },
    { range },
  )
  motion.scrollLinked(document, orbit.value!, { rotate: [-25, 30] }, { range })
  motion.observeGeometry(phone.value!)
  motion.observeGeometry(orbit.value!)
})
</script>

<template>
  <section
    ref="section"
    class="hexdrop-feature"
    aria-labelledby="hexdrop-title"
    :data-hexdrop-ready="ready"
  >
    <div class="hexdrop-topline">
      <span class="hexdrop-brand"
        ><img
          :src="withBase('/media/hexdrop-icon.png')"
          width="34"
          height="34"
          alt=""
        />HEXDROP / NATIVESCRIPT + JOLT</span
      ><span>RC.11 ↗</span>
    </div>
    <div class="hexdrop-composition">
      <div class="hexdrop-copy">
        <p class="hexdrop-kicker">
          {{
            t([
              'A SMALL INTERACTION. A WHOLE LITTLE WORLD.',
              'UM PEQUENO GESTO. UM UNIVERSO INTEIRO.',
              'UN PEQUEÑO GESTO. TODO UN MUNDO.',
              '一个小小手势，一个奇妙世界。',
            ])
          }}
        </p>
        <h2 id="hexdrop-title">
          {{ t(['A little', 'Um pouco', 'Un poco', '一点']) }}<br /><em>{{
            t(['alchemy.', 'de magia.', 'de magia.', '魔法。'])
          }}</em>
        </h2>
        <p class="hexdrop-description">
          {{
            t([
              'Drop a file. Wake the potion. Watch a tiny spider hitch a ride. Even waiting can feel wonderful.',
              'Solte um arquivo. Desperte a poção. Veja uma aranhinha pegar carona. Até esperar pode ser encantador.',
              'Suelta un archivo. Despierta la poción. Mira cómo una arañita se sube al viaje. Hasta esperar puede ser maravilloso.',
              '拖入文件，唤醒魔药，看小蜘蛛搭上旅程。连等待也可以充满惊喜。',
            ])
          }}
        </p>
        <a class="hexdrop-primary" :href="link('/guide/showcase#hexdrop')"
          >{{ t(['Meet Hexdrop', 'Conheça o Hexdrop', 'Conoce Hexdrop', '认识 Hexdrop'])
          }}<span aria-hidden="true">↗</span></a
        >
        <a class="hexdrop-recipe" :href="link('/recipes/?q=Hexdrop')"
          >{{
            t([
              'Get both motion recipes',
              'Explore as duas receitas',
              'Explora las dos recetas',
              '获取两个动效配方',
            ])
          }}
          <span aria-hidden="true">↗</span></a
        >
        <ol class="hexdrop-sequence">
          <li><span>01</span>{{ t(['Drop', 'Solte', 'Suelta', '投放']) }}</li>
          <li><span>02</span>{{ t(['Brew', 'Prepare', 'Prepara', '酿制']) }}</li>
          <li><span>03</span>{{ t(['Delight', 'Encante', 'Encanta', '惊喜']) }}</li>
        </ol>
      </div>
      <div class="hexdrop-stage">
        <div ref="orbit" class="hexdrop-orbit" aria-hidden="true">
          <i></i><i></i><span>✧</span><b>✦</b>
        </div>
        <div ref="phone" class="hexdrop-phone">
          <NativeVideo
            name="hexdrop-creator-ios"
            poster="/media/hexdrop-creator-ios.jpg"
            :caption="t(hexdropCaption)"
          />
        </div>
        <span class="hexdrop-stage-note">{{
          t([
            'NATIVE VIEWS. A LITTLE WITCHCRAFT.',
            'VIEWS NATIVAS. UM POUCO DE FEITIÇARIA.',
            'VISTAS NATIVAS. UN POCO DE HECHICERÍA.',
            '原生视图，一点魔法。',
          ])
        }}</span>
      </div>
    </div>
    <div class="hexdrop-bottom">
      <span class="hexdrop-wordmark" aria-hidden="true">Hexdrop<span>✳︎</span></span>
      <p>{{ t(hexdropCaption) }}</p>
    </div>
  </section>
</template>

<style scoped>
.hexdrop-feature {
  position: relative;
  overflow: hidden;
  padding: 32px max(32px, calc((100vw - 1296px) / 2)) 28px;
  background: #20162e;
  color: #ece1f7;
}
.hexdrop-topline {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #a78ab938;
  padding-bottom: 24px;
  font: 10px/1.6 var(--vp-font-family-mono);
  letter-spacing: 0.08em;
  color: #bba8c9;
}
.hexdrop-topline > span:last-child {
  color: #b7f466;
}
.hexdrop-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.hexdrop-brand img {
  border-radius: 8px;
}
.hexdrop-composition {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 48px;
  padding: 80px 0 70px;
}
.hexdrop-kicker {
  font: 9px/1.8 var(--vp-font-family-mono);
  letter-spacing: 0.08em;
  color: #b7f466;
  margin-bottom: 30px;
}
.hexdrop-copy h2 {
  font-size: clamp(64px, 7.9vw, 114px);
  line-height: 0.94;
  letter-spacing: -0.075em;
  font-weight: 500;
  margin: 0 0 30px;
}
.hexdrop-copy h2 em {
  font-family: Georgia, serif;
  font-weight: 400;
  color: #c6a8e3;
}
.hexdrop-description {
  font-size: 16px;
  line-height: 1.8;
  max-width: 370px;
  color: #c0afcb;
  margin-bottom: 32px;
}
.hexdrop-primary {
  display: inline-flex;
  gap: 48px;
  align-items: center;
  border-radius: 50px;
  background: #b7f466;
  color: #20162e;
  padding: 17px 24px;
  font-size: 13px;
  transition: background 0.2s;
}
.hexdrop-primary:hover {
  background: #d4ffa0;
}
.hexdrop-recipe {
  display: block;
  width: fit-content;
  font-size: 12px;
  margin-top: 20px;
  border-bottom: 1px solid #bba8c950;
  padding-bottom: 5px;
}
.hexdrop-sequence {
  display: flex;
  gap: 32px;
  list-style: none;
  padding: 0;
  margin: 48px 0 0;
  font-size: 11px;
}
.hexdrop-sequence span {
  display: block;
  font: 9px/1.8 var(--vp-font-family-mono);
  color: #9478a9;
  margin-bottom: 8px;
}
.hexdrop-stage {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 0;
}
.hexdrop-orbit {
  position: absolute;
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid #a890bd42;
  border-radius: 50%;
}
.hexdrop-orbit i {
  position: absolute;
  inset: 8%;
  border: 1px solid #a890bd21;
  border-radius: 50%;
}
.hexdrop-orbit i + i {
  inset: -8%;
  border-style: dashed;
  border-color: #a890bd17;
}
.hexdrop-orbit span {
  position: absolute;
  top: 6%;
  left: 4%;
  color: #b7f466;
  font-size: 65px;
  line-height: 1;
}
.hexdrop-orbit b {
  position: absolute;
  bottom: 3%;
  right: 9%;
  color: #c6a8e3;
  font-size: 42px;
  font-weight: 400;
  line-height: 1;
}
.hexdrop-phone {
  position: relative;
  z-index: 1;
  width: min(280px, 72%);
  border: 5px solid #594568;
  border-radius: 35px;
  background: #0c0a10;
  box-shadow: 15px 35px 70px #09050d80;
}
.hexdrop-phone video {
  display: block;
  width: 100%;
  aspect-ratio: 420/914;
  border-radius: 30px;
}
.hexdrop-stage-note {
  position: relative;
  margin-top: 45px;
  font: 8px/1.8 var(--vp-font-family-mono);
  letter-spacing: 0.1em;
  text-align: center;
  color: #bba8c9;
}
.hexdrop-bottom {
  display: flex;
  align-items: end;
  gap: 60px;
  justify-content: space-between;
  border-top: 1px solid #a78ab938;
  padding-top: 24px;
}
.hexdrop-wordmark {
  font-size: clamp(45px, 7.5vw, 110px);
  letter-spacing: -0.075em;
  line-height: 1;
  color: #9677b1;
}
.hexdrop-wordmark span {
  color: #b7f466;
  font-size: 0.48em;
  vertical-align: top;
  margin-left: 8px;
}
.hexdrop-bottom p {
  color: #a48fb5;
  font-size: 10px;
  line-height: 1.8;
  max-width: 420px;
  margin: 0;
}
@media (max-width: 959px) {
  .hexdrop-composition {
    gap: 24px;
    padding-block: 60px;
  }
  .hexdrop-copy h2 {
    font-size: 76px;
  }
  .hexdrop-description {
    font-size: 14px;
  }
  .hexdrop-phone {
    border-width: 4px;
  }
  .hexdrop-bottom {
    gap: 25px;
  }
}
@media (max-width: 639px) {
  .hexdrop-feature {
    padding: 26px 24px;
  }
  .hexdrop-topline {
    font-size: 8px;
    letter-spacing: 0;
  }
  .hexdrop-composition {
    grid-template-columns: minmax(0, 1fr);
    gap: 70px;
    padding: 48px 0 42px;
  }
  .hexdrop-copy h2 {
    font-size: clamp(64px, 15.5vw, 98px);
  }
  .hexdrop-kicker {
    font-size: 8px;
  }
  .hexdrop-description {
    max-width: 330px;
  }
  .hexdrop-sequence {
    margin-top: 32px;
    gap: 40px;
  }
  .hexdrop-stage {
    max-width: 400px;
    width: 100%;
    margin: auto;
  }
  .hexdrop-bottom {
    display: block;
  }
  .hexdrop-wordmark {
    font-size: 70px;
  }
  .hexdrop-bottom p {
    margin-top: 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hexdrop-primary {
    transition: none;
  }
}
</style>
