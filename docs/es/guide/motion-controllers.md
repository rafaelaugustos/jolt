# Ámbitos y estados {#motion-scopes-and-states}

Utilice `motionScope()` para darle a una página, componente o elemento reciclado un propietario para sus animaciones y suscripciones. Utilice `motionStates()` para mover varias vistas entre estados visuales interrumpibles y con nombre. Ambos utilizan los controladores de animación nativos existentes; ninguno agrega un bucle de cuadro JavaScript. La propiedad del alcance no cambia la ejecución: recursos como [`animateSize()`](./size) conservan su costo de diseño JS por cuadro documentado.

<Clip name="motion-controllers-ios" caption="Estados de carga, error, reintento y éxito, controles de alcance y desmontaje/remontaje en el simulador iOS." />

## Propiedad del trabajo {#owning-work}

```ts
import { motionScope, followKeyboard, zoomable } from '@rafaelaugusto/jolt'

const motion = motionScope()
motion.animate(icon, 'spin', { repeat: Infinity })
motion.press(button)
motion.use(() => followKeyboard(composer))
motion.use(() => zoomable(photo, { viewport }))

// At the actual destruction/unmount boundary:
motion.dispose()
```

El alcance tiene ayudantes `animate()`, `decay()`, `sequence()`, `press()`, `drag()` y `states()`. `add(handle)` adopta cualquier función de limpieza u objeto que exponga `stop()` o `dispose()`; `dispose()` tiene prioridad cuando ambos existen. Un recurso pertenece a un ámbito. Las llamadas `add()` duplicadas en ese ámbito no duplican la limpieza. Los identificadores de animación con promesas `finished` se liberan del alcance cuando se liquidan.

La eliminación es idempotente. Cancela animaciones retrasadas y aún no cargadas, pasos de secuencia programados, reproducción nativa y suscripciones registradas. Los identificadores de animación cancelados resuelven `false`. La eliminación detiene los identificadores de propiedad en lugar de llamar a `stop(view)`, por lo que sobreviven las animaciones más nuevas o no relacionadas que se poseen en otros lugares. Todas las limpiezas se ejecutan incluso si uno tira; sus errores se informan juntos como `AggregateError`.

Sólo es propiedad la obra registrada. Para un temporizador, por ejemplo, registre `motion.add(() => clearTimeout(timer))`. Las fábricas personalizadas deben limpiar su propia configuración parcial si tiran antes de devolver un recurso.

## Suspensión, reutilización y eliminación {#suspension-reuse-and-disposal}

| Operación   | Comportamiento                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suspend()` | Pausa los identificadores con `pause()/play()`, preservando los identificadores ya pausados. Desconecta las suscripciones `use()`. Cancela recursos no reproducibles, incluidas secuencias. |
| `resume()`  | Reanuda solo la reproducción pausada por el osciloscopio y recrea las suscripciones `use()`. Las secuencias canceladas no se reinician.                                                     |
| `reset()`   | Elimina todo el trabajo actual manteniendo un alcance reutilizable. Llame antes de asignar una nueva identidad de elemento a una celda reciclada y luego registre su nuevo trabajo.         |
| `dispose()` | Termina permanentemente la propiedad. Iniciar o registrar más lanzamientos de trabajo.                                                                                                      |

Los controladores de arrastre cancelan su contacto/liberación al suspender el alcance y aceptan nuevos gestos al reanudar. Ver [ciclo de vida del arrastre](./drag#ownership-and-lifecycle).

`use(setup)` devuelve una función de eliminación idempotente. Las suscripciones registradas durante la suspensión esperan a que el ámbito se reanude. Los helpers y `add()` rechazan trabajo nuevo tras un `suspend()` explícito; el trabajo creado mientras solo la app está en segundo plano se registra y se suspende inmediatamente. No reanude handles individuales mientras su ámbito esté suspendido.

Un evento nativo `unloaded` no destruye permanentemente el componente. La eliminación normal de una vista sigue cancelando sus animaciones, sin reiniciarlas al recargar. La excepción es la descarga temporal de la raíz al pasar la app a segundo plano: el ámbito pausa la reproducción antes de la descarga y la conserva para el regreso. El ámbito sigue siendo reutilizable hasta `dispose()`. Use `suspend()/resume()` para páginas conservadas y libere los recursos al desmontar realmente. `size` cuenta recursos registrados, no asignaciones de GPU.

## Segundo plano y regreso a la app {#app-background}

Los ámbitos siguen automáticamente los eventos de suspensión y reanudación de NativeScript. La reproducción bajo su control continúa desde la posición conservada cuando vuelve la app, incluidos paths infinitos, stagger, repeticiones inversas y capas compuestas. Un handle pausado manualmente sigue pausado. La suspensión manual del ámbito y KeepAlive son independientes de la suspensión de la app: volver a la app no reactiva un componente inactivo. Las animaciones detenidas, eliminadas con `reset()` o liberadas no se reinician.

La política de la tabla también se aplica en segundo plano: las suscripciones de `use()` se desconectan y se recrean; los recursos sin control de reproducción, incluidas las secuencias, se cancelan. Los listeners de la app se eliminan cuando el ámbito no tiene recursos. Esto se aplica al trabajo de `motionScope()` o `useMotionScope()`; las animaciones externas al ámbito conservan su ciclo de vida existente.

<Clip name="background-playback-ios" caption="Simulador iOS 26.2: bucles nativos en Vue antes y después de salir mediante Home. Órbita, stagger, repetición inversa y dos capas continúan; el punto pausado manualmente queda inmóvil. Reproducción nativa real, sin dispositivo físico." />

<Clip name="background-playback-android" caption="Emulador Android 16: la misma escena nativa en Vue continúa después de Home sin recrear los handles. El punto pausado manualmente queda inmóvil. La grabación no demuestra rendimiento en dispositivos físicos." />

Las [pruebas automatizadas de segundo plano](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/background-playback.md) también cubren intervalos de 20 segundos, pausa/reanudación del ámbito y stop seguido de otro regreso a la app.

## Ciclo de vida de Vue {#vue-lifecycle}

```ts
import { useMotionScope } from '@rafaelaugusto/jolt/vue'

// Inside setup(); create animations once template refs are available.
const motion = useMotionScope()
```

Este asistente se elimina al desmontar Vue, se suspende al desactivar KeepAlive y se reanuda al activarse. La descarga nativa por sí sola no lo elimina. El alcance principal funciona sin Vue; Los ganchos del ciclo de vida de Angular/React/Svelte/Solid pertenecen a sus adaptadores o al código de la aplicación.

## Estados visuales nombrados {#named-visual-states}

```ts
const upload = motion.states(
  { icon, label, progress },
  {
    idle: {
      icon: { scale: 1, rotate: 0 },
      label: { opacity: 1 },
      progress: { scaleX: 0 },
    },
    sending: {
      icon: { scale: 0.8, rotate: 180 },
      label: { opacity: 0.4 },
      progress: { scaleX: 0.65 },
    },
    success: {
      icon: { scale: 1, rotate: 360 },
      label: { opacity: 1 },
      progress: { scaleX: 1 },
    },
  },
  { transition: 'snappy' },
)

const completed = await upload.to('sending')
if (completed) showSendingStatus()
```

O construir `motionStates(targets, definitions, { scope, transition })` directamente. Los nombres de destino y estado se infieren mediante TypeScript. La creación del controlador valida las definiciones sin mover las vistas; Llame a `to('idle')` explícitamente para ingresar al estado inicial.

Los estados contienen puntos finales absolutos numéricos/de color. No aceptan matrices de fotogramas clave, rutas, desplazamientos relativos ni bucles. Una transición acepta un nombre de resorte o una configuración de interpolación finita/resorte, incluido el retraso. `to(name, transition)` anula la transición del controlador para esa solicitud. Utilice `sequence()` por separado para coreografías cronometradas.

### Una transición por objetivo {#a-transition-per-target}

Una transición puede separar objetivos por nombre, de la misma manera que las opciones `animate()` nombran propiedades. En esta presentación, un controlador introduce el logotipo, dibuja el trazo con una interpolación 250 ms después y desvanece el título al final:

```ts
const splash = motionStates(
  { logo, stroke, title },
  {
    hidden: {
      logo: { opacity: 0, scale: 0.5 },
      stroke: { scaleX: 0 },
      title: { opacity: 0, y: 12 },
    },
    shown: {
      logo: { opacity: 1, scale: 1 },
      stroke: { scaleX: 1 },
      title: { opacity: 1, y: 0 },
    },
  },
)

splash.to('shown', {
  type: 'spring',
  bounce: 0.4,
  duration: 600,
  stroke: { duration: 650, ease: 'cubicOut', delay: 250 },
  title: { duration: 400, ease: 'easeOut', delay: 500 },
})
```

<Clip name="state-transitions-ios" caption="Un controlador de estado activa el logotipo, dibuja el trazo con una interpolación retardada y desvanece el título al final, en el simulador iOS. Reproducción en tiempo real." />

La transición de un objetivo se fusiona con el principal como un [transición por propiedad](./transitions#per-property): sobre una interpolación cambia solo lo que establece, sobre un resorte reemplaza la curva y mantiene el retraso principal a menos que establezca el suyo propio. También puede ser un nombre resortel. Una transición que solo nombra objetivos mantiene la transición del controlador para los demás, y la opción `transition` del controlador también toma nombres de objetivos. Una vista adjunta durante una transición la une a la transición de su objetivo. Un objetivo no puede denominarse como una opción de transición (`delay`, `duration`, `ease`...). Los `Animation`, `current`, `settled`, `pause()` y `stop()` devueltos aún cubren todos los objetivos.

<Clip name="state-transitions-android" caption="El mismo chapoteo en el emulador Android. Reproducción en tiempo real." />

Cada objetivo se valida antes de que el nuevo estado cambie de propietario. Las pistas de reemplazo comienzan antes de que se cancelen los identificadores antiguos, lo que permite que el motor nativo herede los valores de presentación actuales y la velocidad del resorte. Las propiedades propiedad de la antigua transición pero omitidas del nuevo estado se detienen en sus valores visibles; las propiedades externas no relacionadas siguen ejecutándose. Defina el punto final de una propiedad en cada estado relevante si debe volver a un valor en reposo. Un estado vacío congela la transición anterior. Cada nombre de destino debe identificar una vista distinta.

Una transición reemplazada, detenida o eliminada resuelve `false`, incluidas las transiciones rápidas bajo movimiento reducido. Las devoluciones de llamada esperadas aún se ejecutan: verifique el valor booleano antes de aplicar los efectos secundarios de finalización. `current` es el último estado solicitado; `settled` es el último estado completado con éxito, no una medición en vivo de la vista. `stop()` cancela el trabajo actual; `pause()/play()` controlarlo; `dispose()` también evita futuras transiciones. La suspensión del alcance detiene a un controlador estatal de propiedad. Reorientar ese controlador en pausa mantiene el reemplazo en pausa.

El ejemplo **Estados de movimiento y alcances** del área de juegos proporciona controles de carga, cancelación, reintento, éxito/error, pausa/reanudación y desmontaje/remontaje. Su propietario es `useMotionScope()`; utilice la palanca global Reducir movimiento para realizar transiciones inmediatas. Las sondas de ciclo de vida nativas están documentadas en [el directorio de referencia](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/motion-lifecycle.md).

## Vistas que vuelven {#views-that-come-back}

Una vista dentro de `v-if`, o un diseño que intercambia entre una versión compacta y una completa, es una vista nueva cada vez que aparece. Por sí solo, parte de los valores de su plantilla: un logotipo que se desvaneció vuelve a ser invisible. En cambio, un controlador estatal puede sobrevivir a sus opiniones. Inicie un objetivo con `null` y adjunte vistas a medida que aparecen y desaparecen:

```vue
<script setup lang="ts">
const stage = useMotionScope().states(
  { logo: null },
  {
    hidden: { logo: { opacity: 0, scale: 0.6 } },
    shown: { logo: { opacity: 1, scale: 1 } },
  },
)
onMounted(() => stage.to('shown'))
</script>

<template>
  <Label v-if="compact" :ref="stage.ref('logo')" class="small" text="J" />
  <Label v-else :ref="stage.ref('logo')" text="J" />
</template>
```

`attach(target, view)` apunta un objetivo a una nueva vista, o a ninguna con `null`. Una vista que llega después de que se haya establecido su estado toma los valores de ese estado de inmediato, sin animación, a través de [`set()`](./interrupting#setting-values-without-animating). Uno que llega durante una transición se suma a él desde donde está, en el mismo momento. `ref(target)` devuelve una devolución de llamada estable por objetivo para una referencia de plantilla: Vue lo llama con el elemento en montaje y `null` en desmontaje. Una función creada en la plantilla se volvería a llamar en cada renderizado.

`to()` omite un objetivo vacío y lo recuerda cuando llega una vista. Sus definiciones todavía están validadas desde el principio. Una vista que se desmonta durante una transición cancela su parte, de modo que la transición resuelve `false`.

<Clip name="recreated-views-ios" caption="En el simulador iOS, al cambiar el diseño se recrean ambos logotipos. El adjunto a los estados vuelve a mostrarse u ocultarse después de Ocultar logotipo; el que sólo tiene una entrada vuelve invisible. Reproducción en tiempo real." />
