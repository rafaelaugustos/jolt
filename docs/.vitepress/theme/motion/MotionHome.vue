<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from 'vitepress'
import { labels, useWords } from './copy'
import { recipes } from './recipes'
import { useMotion } from './useMotion'
import HeroSculpture from './HeroSculpture.vue'
import MotionLab from './MotionLab.vue'
import MotionEvidence from './MotionEvidence.vue'
import RecipeGrid from './RecipeGrid.vue'
import NativeVideo from './NativeVideo.vue'
import MorrowFeature from './MorrowFeature.vue'
import HexdropFeature from './HexdropFeature.vue'
import AuralisFeature from './AuralisFeature.vue'
import VenaFeature from './VenaFeature.vue'
import { version } from '../../../../package.json'

const { t, link } = useWords()
const { frontmatter } = useData()
const root = ref<HTMLElement>()
const copied = ref(false)
const copyFailed = ref(false)
const driveCaption = [
  'Jolt Drive on iOS: the garage entrance from the project’s published GIF, converted to MP4 with every frame timestamp preserved. Capture device unspecified; this preview does not measure rendering performance.',
  'Jolt Drive no iOS: entrada da garagem do GIF publicado pelo projeto, convertido para MP4 preservando o tempo de cada quadro. Dispositivo de captura não informado; esta prévia não mede desempenho de renderização.',
  'Jolt Drive en iOS: entrada del garaje del GIF publicado por el proyecto, convertido a MP4 conservando el tiempo de cada fotograma. Dispositivo no especificado; esta vista previa no mide rendimiento.',
  'Jolt Drive 的 iOS 车库入场：来自项目发布的 GIF，转为 MP4 并保留每帧时间戳。录制设备未说明；此预览不用于衡量渲染性能。',
] as const
const featured = computed(() =>
  [
    'vena-heart',
    'vena-opening',
    'auralis-cards',
    'hexdrop-drag',
    'drive-cabin',
    'spring-feeling',
  ].map((slug) => recipes.find((recipe) => recipe.slug === slug)!),
)
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
    await navigator.clipboard.writeText(`npm install @rafaelaugusto/jolt@${version}`)
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
          >{{ version.replace('0.1.0-', '').toUpperCase() }}
          <span aria-hidden="true">↗</span></a
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

    <VenaFeature />

    <AuralisFeature />

    <MorrowFeature />

    <HexdropFeature />

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
                `All ${recipes.length} recipes`,
                `Todas as ${recipes.length} receitas`,
                `Las ${recipes.length} recetas`,
                `全部 ${recipes.length} 个配方`,
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

    <MotionEvidence />

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
        <article id="jolt-drive" class="app-feature drive-feature">
          <div class="app-feature-copy">
            <p class="eyebrow">
              {{
                t([
                  'BUILT WITH JOLT · iOS',
                  'FEITO COM JOLT · iOS',
                  'HECHO CON JOLT · iOS',
                  '使用 JOLT 构建 · iOS',
                ])
              }}
            </p>
            <h3>Jolt<br /><span>Drive.</span></h3>
            <p class="drive-description">
              {{
                t([
                  'Orbit the car. Step into the cabin. Ride through Austin. Native views and a 3D world, moving together.',
                  'Gire o carro. Entre na cabine. Passeie por Austin. Views nativas e um mundo 3D, em movimento juntos.',
                  'Gira el coche. Entra en la cabina. Recorre Austin. Vistas nativas y un mundo 3D que se mueven juntos.',
                  '环绕汽车，进入座舱，穿行奥斯汀。原生视图与 3D 世界，一起律动。',
                ])
              }}
            </p>
            <div class="drive-actions">
              <a class="text-link" :href="link('/recipes/?q=Jolt%20Drive')"
                >{{
                  t([
                    'Get the 4 recipes',
                    'Explore as 4 receitas',
                    'Explora las 4 recetas',
                    '探索 4 个配方',
                  ])
                }}
                <span aria-hidden="true">↗</span></a
              >
              <a class="text-link" :href="link('/guide/showcase#jolt-drive')"
                >{{
                  t(['Explore the app', 'Conheça o app', 'Explora la app', '探索应用'])
                }}
                <span aria-hidden="true">↗</span></a
              >
              <a class="text-link" href="https://github.com/rafaelaugustos/jolt-drive"
                >GitHub <span aria-hidden="true">↗</span></a
              >
            </div>
          </div>
          <NativeVideo
            name="jolt-drive-entrance-ios"
            poster="/media/jolt-drive-entrance-ios.jpg"
            :caption="t(driveCaption)"
          />
          <p class="native-caption">{{ t(driveCaption) }}</p>
        </article>
      </div>
      <details class="drive-prototype">
        <summary>
          {{
            t([
              'Watch the earlier Jolt Car walkthrough',
              'Veja o tour anterior do Jolt Car',
              'Ver el recorrido anterior de Jolt Car',
              '观看早期 Jolt Car 演示',
            ])
          }}
          <span>02:04</span>
        </summary>
        <NativeVideo
          :name="frontmatter.homeVideos.items[1].name"
          :poster="`/media/${frontmatter.homeVideos.items[1].name}.jpg`"
          :caption="frontmatter.homeVideos.items[1].caption"
        />
        <p class="native-caption">{{ frontmatter.homeVideos.items[1].caption }}</p>
      </details>
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
          ><code>npm install<br />@rafaelaugusto/jolt@{{ version }}</code>
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
