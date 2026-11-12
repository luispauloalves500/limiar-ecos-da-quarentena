# Changelog

## 0.7.0
- Corrige a faixa de parede lisa e clara demais à esquerda da câmera (arquivo, enfermaria e demais salas laterais): a câmera de ombro atravessava ou encostava na parede da porta de entrada; a 0.7 impõe folga de 1,2 m no interior e afasta o spawn lateral. O bake passa a ter desgaste por vértice, wrap mais direcional, atenuação **1,85 e teto de emissão, e a lâmpada da porta fica mais curta.
- Completa o capítulo 2 da pediatria (GDD 1.6) depois da Porta 13: sete salas novas (espera, plantão seguro, brinquedoteca, berçário, leitos infantis, enfermaria circular, ante-sala cirúrgica), com identidade visual própria, documentos só no leitor e conexão com mapa, save/load e migração das saves 0.6 (contentVersion 3→4).
- Novo puzzle P03 (três leitos marcados: baleia, pássaro, árvore; ordem livre; leito isca só dá dica). Novo inimigo E05 Rastejador (crawl no esqueleto Mixamo, mira baixa). Chefe B02 Preceptora (700 de HP, três fases, gerador de 15 s de vulnerabilidade, escurecimento e até dois rastejadores auxiliares). O registro no visor é o final desta versão e gancho para o centro cirúrgico (ainda não construído). A Porta 13 deixa de encerrar a campanha.
- Melhorias de baixo custo nas 12 salas antigas: desgaste/sujeira/umidade no bake, props de história só com materiais já instanciados, contraste maior da luz prática. Sem PointLights novas; merge, instancing e culling iguais aos da 0.6.
- Medição intercalada 0.6.0×0.7.0 (12 salas antigas, 3 perfis, REPEAT=2, room-bench a partir da árvore 0.6 para saves v3): _números após o A/B oficial_. Sete salas novas medidas contra o mesmo orçamento. Sem garantia de FPS físico.
- Testes, smoke da ala nova até o visor (ombro e tank), capturas das 19 entradas e meta 0.7.0.


## 0.6.0
- Assa luz prática e AO por vértice nas 12 salas, com tessellation das caixas grandes e merge por material. Luzes práticas saem da cena: o flicker vai por um ganho compartilhado e Helena/zumbis leem um light probe. O fill de câmera e as PointLights por porta deixam de existir.
- Remove as flags temporárias de experimento (`?exp=`); fica a configuração vencedora (arquitetura + bake completo + tessellation + luz assada + cores por vértice, casters separados para a sombra da lanterna).
- Animações de Helena: sincronia da passada, backpedal/strafe com quadril, inclinação, respiração, recuo com as duas mãos, IK dos pés em chão plano, corpo morto que não afunda e rampa de aceleração.
- Zumbis: sincronia da passada, telegraph de ataque, marcha e postura por ID (mais contida, sem cobrir a cabeça), impacto por região, giro limitado, orientação da morte e clamp no chão. As camadas de postura também aparecem nas páginas de QA.
- Testes de locomoção e cenário (184 no total), script de folha de poses, campanhas reais de ombro e tank, meta description corrigida para 0.6.0.
- Medição intercalada 0.5.0×0.6.0 em SwiftShader, 12 salas, 3 perfis, REPEAT=2: draws −41% a −44%; workMedian −2,0% / −0,1% / −1,5% (Baixo/Médio/Alto); entrada igual ou um pouco mais rápida. workMean no Baixo ficou +5,9% com campanha concorrente (load 15); a mediana e uma passagem anterior mais ociosa indicam custo igual ou menor. Triângulos +33% a +55% pela tessellation. Sem garantia de FPS físico.

## 0.5.0
- Retira frases/etiquetas do mundo; preserva pistas em documentos, HUD, mapa e diário. Números pequenos nas portas e brilho de coleta próximo.
- Corrige câmera atrás de folhas fechadas (mundo preto), elapsed negativo de RAF na porta e fade prolongado por delta limitado, reforça luz mínima e espera opacidade zero nas capturas.
- Corrige QuickTurn involuntário em qualquer tecla e arma ocultada em interação/porta; baixo pronto e lanterna recebem CCD, crossfades e ritmo variável.
- Adiciona áudio procedural em camadas/reverb, recarga por etapas, grunhidos 3D, tensão musical, respiração/batimento e quatro volumes/legendas persistentes.
- Título 3D animado com chuva/silhueta, navegação por teclado e créditos; recuo leve e empurrão frontal com cooldown.
- Testes e QA real da campanha, poses, entradas legíveis e publicação em docs/QA.md.

## 0.4.0
- Corrige enquadramento/pose de mira no jogo real, orientação física da pistola, margem da câmera e evidência de spawn.
- Acrescenta movimento, fauna, props reativos, vidro quebrável, impactos persistentes e identidade ambiental às 12 salas.
- Eventos únicos por sala persistidos; áudio espacial/reverb/solos; densidade configurável por perfil.
- Instancing/merge, cache de transforms estáticos, animação GPU e throttling de mixers distantes. Comparação SwiftShader com seis GLBs: 64,51 → 59,81 ms/frame (−7,3%), sem garantia de FPS físico.
- Corrigida acumulação de pitch/IK em tracks constantes do mixer, com teste de 600 frames.
- Testes de migração/validação ambiental, idempotência, física leve, densidade e volume da câmera. QA real e limitações em docs/QA.md.

## 0.3.0
- Expansão de seis salas, E02/E04, segundo posto seguro, puzzle de pressão e final Porta 13.
- Modelos GLB fornecidos pelo usuário, animações adicionais e otimização/LODs.
- Corpos removidos em cinco segundos e coleta persistente com remoção imediata.

## 0.2.0
- Visão sobre o ombro padrão, tank secundário e materiais/iluminação procedural.
