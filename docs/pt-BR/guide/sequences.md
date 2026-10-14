# Sequências

```ts
await sequence([
  [logo, 'popIn'],
  [[title, subtitle], 'fadeInUp', { stagger: 80 }],
  () => animate(button, 'fadeIn'),
])
```

Cada passo recebe os mesmos argumentos do `animate`, ou é uma função que inicia uma animação. Um passo começa quando o anterior parece pronto: um spring que está perto do alvo e ficando ali conta, mesmo que ainda esteja assentando, então os passos não esperam o último pixel. A sequência inteira termina quando todos os passos terminaram.

Views de passos posteriores assumem o primeiro keyframe quando a sequência começa, então o título acima fica escondido até sua vez em vez de aparecer e sumir.
