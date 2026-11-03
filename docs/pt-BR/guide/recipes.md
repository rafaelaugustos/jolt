# Receitas nativas completas

Estas telas executáveis de Core NativeScript mostram a integração inteira, incluindo criação das views e limpeza. Usam APIs públicas e funcionam sem framework. O preview Vue apenas monta o Frame. Cada código abaixo vem do arquivo compilado pelo demo.

Execute o demo compilado com --recipe=gallery, --recipe=sheet ou --recipe=lists. No Android, use o extra de intenção recipe com o valor correspondente. A lista suportada é Core ListView; outros roteadores e plugins de virtualização precisam de seu próprio resolvedor. As gravações demonstram comportamento em simulador, não desempenho de aparelho físico.

## Galeria

Use chaves estáveis e resolva a célula atual da lista na volta. Carregue a imagem pelo src de cada view: compartilhar o mesmo wrapper mutável de ImageSource entre células recicladas pode limpar os pixels de outra view. O callback do Frame aplica as opções de navegação do Jolt antes de voltar. O visualizador mantém a posição de descarte até a navegação aceitar ou cancelar.

<Clip name="recipe-gallery-ios" caption="Simulador de iPhone 17 · iOS 26.2. Toques e arrastos reais de XCTest; interface em inglês, velocidade original. Zoom, pan, descarte cancelado, item selecionado movido ao fim, retorno à miniatura pela chave e novo arrasto para fechar." />

<<< @/../demo/src/recipes/gallery.ts

## Sheet

Um controlador cuida do painel, handle, ScrollView aninhado, teclado e retorno de foco. O unload da raiz descarta o controlador.

<Clip name="recipe-sheet-ios" caption="Simulador de iPhone 17 · iOS 26.2. Toques e arrastos reais de XCTest; interface em inglês, velocidade original. Abrir, redimensionar, adicionar conteúdo, digitar com o teclado virtual real, fechar/reabrir e rolar." />

<<< @/../demo/src/recipes/sheet.ts

## Lista

Crie um vínculo animateItems por lista carregada e libere-o no unload. itemLoading atualiza os labels reciclados com os dados atuais. Trocar os itens não exige outro vínculo.

<Clip name="recipe-list-ios" caption="Simulador de iPhone 17 · iOS 26.2. Toques e arrastos reais de XCTest; interface em inglês, velocidade original. Rolar uma Core ListView virtualizada e trocar seus dados duas vezes." />

No Core 9.1.3 usado no iOS, esta receita desativa o prefetch de células do UIKit: uma célula preparada antecipadamente podia perder seu conteúdo antes de aparecer. Alturas fixas e estimativas correspondentes mantêm o layout previsível. A configuração vale apenas para esta receita.

<<< @/../demo/src/recipes/lists.ts

## UI compartilhada

<<< @/../demo/src/recipes/ui.ts
