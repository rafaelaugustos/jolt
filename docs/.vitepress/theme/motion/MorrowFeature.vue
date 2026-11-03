<script setup lang="ts">
import { withBase } from 'vitepress'
import { ref } from 'vue'
import { useMotion } from './useMotion'
import { useWords } from './copy'
import NativeVideo from './NativeVideo.vue'

const { t, link } = useWords()
const section = ref<HTMLElement>()
const still = ref<HTMLElement>()
const phone = ref<HTMLElement>()
useMotion((runtime) => {
  const range = { element: section.value!, start: 'start end', end: 'end start' } as const
  runtime.scrollLinked(
    document,
    still.value!,
    { y: [65, -70], rotate: [-14, -6] },
    { range },
  )
  runtime.scrollLinked(
    document,
    phone.value!,
    { y: [-30, 55], rotate: [9, 3] },
    { range },
  )
  runtime.observeGeometry(still.value!)
  runtime.observeGeometry(phone.value!)
})
const caption = [
  'Morrow · NativeScript + Jolt. iOS recording provided by its creator: animated opening, artist page, vinyl player, seeking and video transition. Original playback timing; the first 2.4 seconds of the home screen are omitted. Capture device is unspecified.',
  'Morrow · NativeScript + Jolt. Gravação iOS enviada pelo criador: abertura animada, página da artista, player em vinil, busca na faixa e transição para vídeo. Velocidade original; os primeiros 2,4 segundos da tela inicial foram removidos. Dispositivo de captura não informado.',
  'Morrow · NativeScript + Jolt. Grabación iOS del creador: apertura animada, página de artista, reproductor de vinilo, búsqueda en la pista y transición a vídeo. Tiempo original; se omiten los primeros 2,4 segundos de la pantalla de inicio. Dispositivo no especificado.',
  'Morrow · NativeScript + Jolt。创作者提供的 iOS 录屏：动画开场、艺人页面、唱片播放器、进度拖动与视频转场。保持原始时间，仅省略最初 2.4 秒的系统主屏幕。录制设备未说明。',
] as const
</script>

<template>
  <section
    ref="section"
    class="morrow-section section-shell"
    aria-labelledby="morrow-title"
  >
    <div class="morrow-feature">
      <div class="morrow-copy">
        <p class="eyebrow">
          <span class="morrow-dot"></span
          >{{
            t([
              'MADE WITH JOLT / FEATURED PROJECT',
              'FEITO COM JOLT / PROJETO EM DESTAQUE',
              'HECHO CON JOLT / PROYECTO DESTACADO',
              '用 JOLT 构建 / 精选项目',
            ])
          }}
        </p>
        <h2 id="morrow-title">Morrow<span>.</span></h2>
        <p class="morrow-tagline">
          {{
            t([
              'Music. With feeling.',
              'Música. Para sentir.',
              'Música. Para sentir.',
              '音乐，触动人心。',
            ])
          }}
        </p>
        <p class="morrow-description">
          {{
            t([
              'A vinyl record you can touch. An artist page that comes alive. A music experience built with NativeScript and Jolt.',
              'Um vinil que você pode tocar. Uma página de artista que ganha vida. Uma experiência musical feita com NativeScript e Jolt.',
              'Un vinilo que puedes tocar. Una página de artista que cobra vida. Una experiencia musical creada con NativeScript y Jolt.',
              '可触碰的唱片，鲜活的艺人页面。用 NativeScript 和 Jolt 构建的音乐体验。',
            ])
          }}
        </p>
        <a class="morrow-link" :href="link('/guide/showcase#morrow')"
          >{{ t(['Meet Morrow', 'Conheça o Morrow', 'Conoce Morrow', '认识 Morrow']) }}
          <span aria-hidden="true">↗</span></a
        >
        <div class="morrow-stack">
          <span>NativeScript</span><span>Jolt</span><span>iOS</span>
        </div>
      </div>
      <div class="morrow-stage">
        <div class="morrow-orbit" aria-hidden="true"></div>
        <img
          ref="still"
          class="morrow-still"
          :src="withBase('/media/morrow-artist-ios.jpg')"
          :alt="
            t([
              'Morrow artist page, still from the supplied iOS recording',
              'Página da artista no Morrow, quadro da gravação iOS enviada',
              'Página de artista de Morrow, fotograma de la grabación iOS',
              'Morrow 艺人页面，来自提供的 iOS 录屏',
            ])
          "
          width="480"
          height="1044"
          loading="lazy"
        />
        <div ref="phone" class="morrow-phone">
          <NativeVideo
            name="morrow-native-ios"
            poster="/media/morrow-native-ios.jpg"
            :caption="t(caption)"
          />
        </div>
        <span class="morrow-video-label"
          >{{
            t([
              'WATCH THE REAL APP',
              'ASSISTA AO APP REAL',
              'MIRA LA APP REAL',
              '观看真实应用',
            ])
          }}
          ↗</span
        >
      </div>
      <p class="morrow-caption">{{ t(caption) }}</p>
    </div>
  </section>
</template>

<style scoped>
.morrow-section {
  padding-top: 72px;
}
.morrow-feature {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-radius: 9px;
  background: #efdae5;
  color: #30212e;
  overflow: hidden;
}
.morrow-copy {
  padding: 58px 0 48px 50px;
  position: relative;
  z-index: 2;
}
.morrow-copy .eyebrow {
  font-size: 8px;
  color: #8c4f70;
}
.morrow-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  background: #a8216e;
  border-radius: 50%;
  margin-right: 7px;
}
.morrow-copy h2 {
  margin: 42px 0 0;
  font-size: clamp(58px, 6.8vw, 96px);
  font-weight: 650;
  letter-spacing: -0.075em;
  line-height: 1;
}
.morrow-copy h2 > span {
  color: #a8216e;
}
.morrow-tagline {
  font:
    italic 29px/1.3 Georgia,
    serif;
  letter-spacing: -0.035em;
  color: #a33271;
  margin-top: 12px !important;
}
.morrow-description {
  max-width: 290px;
  margin-top: 23px !important;
  color: #806577;
  font-size: 12px;
  line-height: 1.8;
}
.morrow-link {
  display: inline-flex;
  gap: 40px;
  align-items: center;
  margin-top: 25px;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid #b397a6;
  padding-bottom: 9px;
}
.morrow-link span {
  color: #ac2d79;
  font-size: 20px;
}
.morrow-stack {
  display: flex;
  gap: 7px;
  margin-top: 35px;
}
.morrow-stack > span {
  font: 8px var(--vp-font-family-mono);
  color: #825c73;
  border: 1px solid #c3a5b5;
  padding: 5px 8px;
  border-radius: 3px;
}
.morrow-stage {
  position: relative;
  min-height: 540px;
}
.morrow-orbit {
  position: absolute;
  width: 560px;
  height: 560px;
  border: 1px solid #bd84a530;
  border-radius: 50%;
  top: 20px;
  left: -50px;
  box-shadow:
    0 0 0 28px #bd84a509,
    0 0 0 58px #bd84a507;
}
.morrow-still {
  position: absolute;
  width: 185px;
  height: auto;
  left: 0;
  top: 74px;
  rotate: -12deg;
  border: 5px solid #342532;
  border-radius: 29px;
  box-shadow: 8px 20px 40px #49162b22;
}
.morrow-phone {
  position: absolute;
  width: 220px;
  height: auto;
  top: 34px;
  left: 37%;
  border: 5px solid #352332;
  border-radius: 32px;
  background: #352332;
  overflow: hidden;
  box-shadow: 15px 24px 45px #49162b28;
}
.morrow-phone :deep(video) {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1206 / 2622;
}
.morrow-video-label {
  position: absolute;
  bottom: 20px;
  left: 39%;
  font: 8px var(--vp-font-family-mono);
  letter-spacing: 0.06em;
  color: #9a517c;
}
.morrow-caption {
  grid-column: 1 / -1;
  padding: 0 50px 22px;
  font-size: 9px;
  color: #987487;
  line-height: 1.7;
  max-width: 100%;
}
@media (max-width: 1100px) {
  .morrow-copy {
    padding-left: 30px;
  }
  .morrow-phone {
    width: 190px;
    left: 35%;
    top: 65px;
  }
  .morrow-still {
    width: 160px;
    top: 100px;
  }
  .morrow-caption {
    padding-inline: 30px;
  }
}
@media (max-width: 767px) {
  .morrow-section {
    padding-top: 45px;
  }
  .morrow-feature {
    grid-template-columns: 1fr;
  }
  .morrow-copy {
    padding: 30px 28px 0;
  }
  .morrow-copy .eyebrow {
    font-size: 7px;
  }
  .morrow-copy h2 {
    margin-top: 27px;
    font-size: 72px;
  }
  .morrow-tagline {
    font-size: 27px;
  }
  .morrow-description {
    font-size: 12px;
    max-width: 310px;
  }
  .morrow-stack {
    margin-top: 22px;
  }
  .morrow-stage {
    min-height: 480px;
    margin-top: 10px;
  }
  .morrow-still {
    width: 150px;
    left: 8%;
    top: 60px;
  }
  .morrow-phone {
    width: 180px;
    left: 38%;
    top: 35px;
    border-radius: 27px;
  }
  .morrow-caption {
    padding: 0 25px 25px;
    font-size: 9px;
  }
  .morrow-video-label {
    left: 32%;
    bottom: 20px;
  }
}
@media (max-width: 374px) {
  .morrow-phone {
    width: 155px;
    left: 38%;
  }
  .morrow-still {
    width: 130px;
  }
  .morrow-stage {
    min-height: 415px;
  }
}
</style>
