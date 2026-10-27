# Animaciones vinculadas al desplazamiento {#scroll-linked-animations}

Crea una animación una vez, luego deja que un `ScrollView` elija su fotograma:

<Clip name="scroll-linked-ios" caption="El desplazamiento real colapsa el encabezado grande y revela el título compacto, luego lo restaura. Simulador iOS." />

```ts
import { scrollLinked } from '@rafaelaugusto/jolt'

const unlink = scrollLinked(
  scrollView,
  header,
  { y: [0, -60], opacity: [1, 0] },
  { range: [0, 120] },
)
```

En el desplazamiento 0, el encabezado comienza en `y: 0`, opacidad 1. En 60 DIPs llega a `y: -30`, opacidad 0.5. En 120 DIPs tiene el último cuadro. Desplazarse hacia atrás lo invierte, incluso después de llegar a cualquiera de los puntos finales. El desplazamiento excesivo está bloqueado.

La interpolación es lineal, con fotogramas clave igualmente espaciados. Todas las propiedades admitidas por [`animate()`](./animating) están disponibles, incluidas [colores](./colors) y [decoraciones](./decorations) dentro de los límites de su plataforma. Un valor escalar o `null` captura el valor inicial cuando se carga el objetivo.

## Rango y eje {#range-and-axis}

`range` es un par de compensaciones finitas distintas en DIPs. Un rango descendente invierte el mapeo:

```ts
scrollLinked(scrollView, badge, { opacity: [0, 1] }, { range: [120, 0] })
```

El eje predeterminado es `y`. Para un ScrollView horizontal, elija `x`:

```ts
scrollLinked(
  carousel,
  artwork,
  { rotateY: [-15, 15] },
  {
    range: [0, 300],
    axis: 'x',
  },
)
```

Ambos argumentos aceptan vistas nativas o contenedores de marco, al igual que `animate()`. La fuente debe contener un NativeScript `ScrollView`; Este asistente no se adjunta a un ListView ni a un desplazador nativo personalizado. El desplazamiento actual se aplica inmediatamente y se actualiza al cargar, por lo que una posición de desplazamiento restaurada no necesita un nuevo gesto para actualizar el objetivo. Las llamadas realizadas antes de que se cargue el objetivo recuerdan el último progreso.

## Limpieza e interrupción {#cleanup-and-interruption}

El valor de retorno es una función de limpieza idempotente:

```ts
unlink() // remove the binding and freeze the properties at their current frame
```

Al descargar cualquiera de las vistas también se elimina el enlace y se libera su animación. Cree un nuevo enlace al reutilizar una pantalla descargada. Detener o reemplazar cada propiedad vinculada también elimina al oyente. Reemplazar solo una propiedad permite que las restantes sigan el desplazamiento sin recuperar la propiedad reemplazada. Otras animaciones y oyentes de desplazamiento siguen siendo independientes.

La animación permanece en pausa durante todo el enlace, incluso en el progreso 1. No finaliza solo porque el usuario llegó al final del rango. Utilice `animate()` por separado después de desvincularlo si la vista debe continuar moviéndose por sí sola.

## Plazo y coste {#timing-and-cost}

Cada evento de desplazamiento establece sincrónicamente un valor `progress` en la animación pausada. Se omiten los valores repetidos, incluido el desplazamiento excesivo fijado. No hay temporizador, devolución de llamada de fotograma de animación, cálculo de nueva curva ni llamada a `animate()` por evento.

Los controladores de reproducción aún buscan cada propiedad que poseen: esta no es una única llamada de puente nativo para un número arbitrario de propiedades. iOS aplica las correspondientes copias pausadas de Core Animation; Android reposiciona animadores nativos. La entrega de desplazamiento y las actualizaciones de progreso necesitan JavaScript en el hilo principal. Esta no es una línea de tiempo de desplazamiento nativa que pueda seguir la entrada mientras JavaScript está bloqueado; El [Limitación de subprocesos de UI](./android-performance) de Android todavía se aplica.

El área de juegos utiliza el ScrollView principal para mover y atenuar el título grande mientras revela un título compacto fijo. Ambas direcciones utilizan esta API pública.

Para controlar varias vistas desde un desplazamiento, o asignarlo a través de rangos por propiedad, use [`scrollValue()`](./motion-values#scroll-offsets) con `bind()`. Escribe las propiedades enlazadas directamente y cuesta aproximadamente la mitad por evento en Android.
