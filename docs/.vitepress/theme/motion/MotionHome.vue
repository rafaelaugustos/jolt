<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from 'vitepress'
import { labels, useWords } from './copy'
import { recipes } from './recipes'
import { useMotion } from './useMotion'
import HeroSculpture from './HeroSculpture.vue'
import MotionLab from './MotionLab.vue'
import RecipeGrid from './RecipeGrid.vue'
import NativeVideo from './NativeVideo.vue'
import MorrowFeature from './MorrowFeature.vue'

const { t, link } = useWords()
const { frontmatter } = useData()
const root = ref<HTMLElement>()
const copied = ref(false)
const copyFailed = ref(false)
const featured = computed(() => [
  recipes[0],
  recipes[2],
  recipes[5],
  recipes[6],
  recipes[8],
  recipes[11],
])
useMotion((runtime) => {
  const headline = [...root.value!.querySelectorAll<HTMLElement>('h1 > span')]
  runtime.animate(
    headline,
    { y: [70, 0], opacity: [0, 1] },
    { duration: 950, ease: 'easeOut', stagger: 120 },
  )
  headline.forEach((line) => runtime.observeGeometry(line))
  const actionRegion = root.value!.querySelector<HTMLElement>('.hero-actions')!
  const action = actionRegion.querySelector<HTMLElement>('.button-acid')!
  const magnet = runtime.pointerFollow(actionRegion, {
    range: { x: [-7, 7], y: [-5, 5] },
    spring: { stiffness: 180, damping: 16 },
  })
  runtime.bind(action, { x: magnet.x, y: magnet.y })
  runtime.press(action, { scale: 0.95 }, { transition: 'snappy' })
  runtime.observeGeometry(action)
  const items = [...root.value!.querySelectorAll<HTMLElement>('[data-entrance]')]
  runtime.viewportEnter(items, {
    keyframes: { y: [36, 0], opacity: [0, 1] },
    transition: { duration: 700, ease: 'easeOut' },
    threshold: 0.08,
  })
})
async function copyInstall() {
  try {
    await navigator.clipboard.writeText('npm install @rafaelaugusto/jolt')
    copied.value = true
    copyFailed.value = false
  } catch {
    copied.value = false
    copyFailed.value = true
  }
}
</script>

<template>
  <div ref="root" class="motion-home">
    <section class="motion-hero section-shell">
      <div class="hero-topline">
        <span class="hero-release"
          ><span class="live-dot"></span>
          {{
            t([
              'NATIVE FEEL. LIMITLESS EXPRESSION.',
              'SENSAÇÃO NATIVA. EXPRESSÃO SEM LIMITES.',
              'SENSACIÓN NATIVA. EXPRESIÓN SIN LÍMITES.',
              '原生质感，无限表达。',
            ])
          }}</span
        ><a :href="link('/guide/release-history')"
          >RC.10 <span aria-hidden="true">↗</span></a
        >
      </div>
      <div class="hero-composition">
        <div class="hero-type">
          <h1>
            <span class="hero-line-one"
              >{{ t(['FEEL', 'SINTA', 'SIENTE', '感受'])
              }}<span class="hero-type-star" aria-hidden="true">✳︎</span></span
            >
            <span class="hero-line-two">{{
              t(['EVERY FRAME.', 'CADA FRAME.', 'CADA FRAME.', '每一帧。'])
            }}</span>
          </h1>
          <p class="hero-description">
            {{
              t([
                'The motion engine for interfaces you don’t just use. You feel. Built for NativeScript. Alive on the web.',
                'O motor de animações para interfaces que você não só usa. Você sente. Feito para NativeScript. Vivo na web.',
                'El motor de animación para interfaces que no solo usas. Las sientes. Creado para NativeScript. Vivo en la web.',
                '不止于使用，更触动感官。为 NativeScript 打造的动效引擎，在 Web 同样鲜活。',
              ])
            }}
          </p>
          <div class="hero-actions">
            <a class="button-acid" :href="link('/recipes/')"
              >{{ t(labels.explore) }}<span aria-hidden="true">↗</span></a
            ><a class="button-text" href="#playground"
              >{{ t(['Try it live', 'Experimente agora', 'Pruébalo ahora', '立即体验']) }}
              <span aria-hidden="true">↓</span></a
            >
          </div>
        </div>
        <HeroSculpture />
      </div>
      <div class="hero-bottomline">
        <span>{{
          t([
            'BUILT FOR THE WAY YOU BUILD.',
            'FEITO PARA O SEU JEITO DE CRIAR.',
            'HECHO PARA TU FORMA DE CREAR.',
            '为你的创作方式而生。',
          ])
        }}</span>
        <div>
          <span>NativeScript</span><span class="hero-divider">/</span><span>iOS</span
          ><span>Android</span><span class="hero-divider">/</span
          ><span>Web <sup>EXPERIMENTAL</sup></span>
        </div>
        <a href="#collection" :aria-label="t(labels.explore)">↓</a>
      </div>
    </section>

    <MorrowFeature />

    <section id="collection" class="home-collection section-shell">
      <div class="section-heading" data-entrance>
        <div>
          <p class="eyebrow">
            01 /
            {{
              t([
                'THE MOTION COLLECTION',
                'A COLEÇÃO DE MOVIMENTOS',
                'LA COLECCIÓN DE MOVIMIENTO',
                '动效精选',
              ])
            }}
          </p>
          <h2>
            {{
              t([
                'Steal the feeling.',
                'Leve essa sensação.',
                'Llévate la sensación.',
                '把心动带走。',
              ])
            }}<br /><span class="muted-heading">{{
              t(['Make it yours.', 'Crie do seu jeito.', 'Hazla tuya.', '创造你的动效。'])
            }}</span>
          </h2>
        </div>
        <div class="section-heading-aside">
          <p>
            {{
              t([
                'Real interfaces. Real native recordings. Find your next “how did they do that?”.',
                'Interfaces reais. Gravações nativas reais. Encontre seu próximo “como fizeram isso?”.',
                'Interfaces reales. Grabaciones nativas reales. Encuentra tu próximo «¿cómo hicieron eso?».',
                '真实界面，真实原生录屏。发现下一个让你好奇的动效。',
              ])
            }}
          </p>
          <a class="text-link" :href="link('/recipes/')"
            >{{
              t([
                'All 12 recipes',
                'Todas as 12 receitas',
                'Las 12 recetas',
                '全部 12 个配方',
              ])
            }}
            <span aria-hidden="true">↗</span></a
          >
        </div>
      </div>
      <RecipeGrid :items="featured" />
    </section>

    <div class="motion-manifesto" aria-hidden="true">
      <span>{{
        t(['LESS FRICTION.', 'MENOS FRICÇÃO.', 'MENOS FRICCIÓN.', '更少阻力。'])
      }}</span
      ><span class="manifesto-star">✳︎</span
      ><span>{{
        t(['MORE FEELING.', 'MAIS SENSAÇÃO.', 'MÁS SENSACIÓN.', '更多感受。'])
      }}</span
      ><span class="manifesto-star">✳︎</span>
    </div>

    <MotionLab />

    <section class="native-feature section-shell">
      <div class="section-heading" data-entrance>
        <div>
          <p class="eyebrow">
            02 /
            {{
              t(['BEYOND THE DEMO', 'ALÉM DA DEMO', 'MÁS ALLÁ DE LA DEMO', '不止于演示'])
            }}
          </p>
          <h2>
            {{
              t([
                'Built to move you.',
                'Feito para impressionar.',
                'Hecho para impresionarte.',
                '为触动你而造。',
              ])
            }}
          </h2>
        </div>
        <a class="text-link" :href="link('/guide/showcase')"
          >{{
            t([
              'Explore the showcase',
              'Explore o showcase',
              'Explora los proyectos',
              '探索作品展示',
            ])
          }}
          <span aria-hidden="true">↗</span></a
        >
      </div>
      <div class="native-feature-grid">
        <article class="film-feature">
          <div class="film-poster">
            <NativeVideo
              :name="frontmatter.homeVideos.items[0].name"
              :poster="`/media/${frontmatter.homeVideos.items[0].name}.jpg`"
              :caption="frontmatter.homeVideos.items[0].caption"
            />
          </div>
          <div class="film-feature-copy">
            <div>
              <p class="eyebrow">
                {{ t(['THE FILM', 'O FILME', 'LA PELÍCULA', '品牌短片']) }} · 01:00
              </p>
              <h3>{{ frontmatter.homeVideos.items[0].title }}</h3>
            </div>
            <span aria-hidden="true">↗</span>
          </div>
          <p class="native-caption">{{ frontmatter.homeVideos.items[0].caption }}</p>
        </article>
        <article class="app-feature">
          <div class="app-feature-copy">
            <p class="eyebrow">
              {{
                t([
                  'A NATIVE EXPERIENCE',
                  'UMA EXPERIÊNCIA NATIVA',
                  'UNA EXPERIENCIA NATIVA',
                  '原生体验',
                ])
              }}
            </p>
            <h3>
              {{ t(['Every touch.', 'Cada toque.', 'Cada toque.', '每一次触碰。'])
              }}<br /><span>{{
                t([
                  'A little magic.',
                  'Um pouco de mágica.',
                  'Un poco de magia.',
                  '都有一点魔法。',
                ])
              }}</span>
            </h3>
            <p>
              {{
                t([
                  'A 3D garage. Tactile controls. A whole world of motion, made with Jolt.',
                  'Uma garagem 3D. Controles que respondem. Um mundo de movimento, feito com Jolt.',
                  'Un garaje 3D. Controles que responden. Un mundo de movimiento, hecho con Jolt.',
                  '3D 车库，灵敏控件。用 Jolt 构建一个充满动感的世界。',
                ])
              }}
            </p>
          </div>
          <NativeVideo
            :name="frontmatter.homeVideos.items[1].name"
            :poster="`/media/${frontmatter.homeVideos.items[1].name}.jpg`"
            :caption="frontmatter.homeVideos.items[1].caption"
          />
          <p class="native-caption">{{ frontmatter.homeVideos.items[1].caption }}</p>
        </article>
      </div>
    </section>

    <section class="build-section section-shell" data-entrance>
      <div>
        <p class="eyebrow">
          {{
            t([
              'YOUR NEXT GREAT INTERFACE STARTS HERE.',
              'SUA PRÓXIMA GRANDE INTERFACE COMEÇA AQUI.',
              'TU PRÓXIMA GRAN INTERFAZ EMPIEZA AQUÍ.',
              '下一个精彩界面，从这里开始。',
            ])
          }}
        </p>
        <h2>
          {{
            t([
              'Less setup.',
              'Menos configuração.',
              'Menos configuración.',
              '少一点配置。',
            ])
          }}<br /><em>{{
            t([
              'More possibility.',
              'Mais possibilidades.',
              'Más posibilidades.',
              '多一些可能。',
            ])
          }}</em>
        </h2>
        <p>
          {{
            t([
              'Open source. Yours to explore, remix and make your own.',
              'Código aberto. Para explorar, adaptar e criar do seu jeito.',
              'Código abierto. Para explorar, adaptar y crear a tu manera.',
              '开放源码，尽情探索、改造，创造自己的作品。',
            ])
          }}
        </p>
        <a class="button-acid" :href="link('/guide/install')"
          >{{ t(labels.start) }} <span aria-hidden="true">↗</span></a
        >
      </div>
      <div class="install-card">
        <p>
          {{
            t([
              'ONE SMALL FIRST STEP',
              'UM PEQUENO PRIMEIRO PASSO',
              'UN PEQUEÑO PRIMER PASO',
              '迈出小小的第一步',
            ])
          }}
        </p>
        <div>
          <span class="install-dollar">$</span
          ><code>npm install<br />@rafaelaugusto/jolt</code>
        </div>
        <button @click="copyInstall">
          {{
            copied
              ? t(labels.copied)
              : copyFailed
                ? t(labels.copyFailed)
                : t(['Copy command', 'Copiar comando', 'Copiar comando', '复制命令'])
          }}
          <span aria-hidden="true">⧉</span></button
        ><a :href="link('/guide/install')"
          >{{
            t([
              'Installation & platform setup',
              'Instalação e configuração',
              'Instalación y configuración',
              '安装与平台配置',
            ])
          }}
          ↗</a
        >
      </div>
    </section>
  </div>
</template>
