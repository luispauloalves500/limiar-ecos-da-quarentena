# Changelog

## 0.8.0
- **A Preceptora (B02) refeita.** O bloco escuro da 0.7 vira uma enfermeira-chefe infectada, alta e magra (~2,5 m): uniforme rasgado com sangue seco, avental, touca com cruz vermelha, máscara cirúrgica, olhos que brilham, colar cervical, prancheta no cinto, crachá cirúrgico no peito, bisturi longo fundido na mão direita, seringa crescida no antebraço esquerdo, esporões de osso no cotovelo e na canela. Duas placas de bandeja de esterilização cobrem um núcleo incandescente entre as costelas. Rig procedural próprio (`src/preceptora.ts`), malhas mescladas por articulação e material, sem GLB novo.
- **Leitura no escuro:** material com rim de Fresnel (um uniforme, sem luz extra) que também carrega a cor do aviso e do impacto, e preenchimento pelo mesmo light probe dos zumbis (probe × albedo). Três luzes de emergência assadas na enfermaria circular (GDD), sem custo em tempo de execução; a fase escura continua escurecendo-as.
- **Animações:** despertar lento (cabeça pendida que se ergue), espreita com passada longa e cabeça inclinada, ociosa com tique de cabeça, aviso próprio para cada golpe, golpes ativos, recuperação (lâmina presa no chão/leito, tontura depois do giro), grito de fase, convulsão elétrica com placas se abrindo, reação a tiro (solavanco com armadura, cambaleio com núcleo exposto) e morte em três tempos (tranco para trás, joelhos, queda de bruços). O cadáver da B02 fica 12 s.
- **Luta (GDD B02):** fase 1 corte de bisturi (18), corrida de bisturi (18, em linha) e puxão por lençol (16, puxa até 1,2 m); fase 2 sequência de três cortes (14 cada, aviso luminoso de 1,3 s), escuridão e rastejadores; fase 3 giro cortante (24, 1,5 s de tontura) e golpe vertical (30). Todo golpe tem aviso de 0,95–1,3 s, decalque no chão (contorno = zona de perigo, preenchimento = tempo restante), som (tique de lâmina, varrida, grito) e dica na primeira vez. A troca de fase é um grito sem dano que **fecha as placas**: cada fase pede uma janela do gerador. O gerador dá descarga, atordoa 2 s, joga a chefe para longe dele e abre as placas por 15 s (recarga 20 s); com o núcleo exposto ela manca (72% da velocidade). Depois de acertar Helena, ela espera mais (1,4 s) antes do próximo golpe. Quando ela cai, os dois rastejadores auxiliares caem junto (antes podiam matar Helena no caminho do visor). HP 700, dano por tiro (3 com placas / 55 exposta) inalterados.
- Sons novos procedurais: lâmina, varrida, grito, metal da armadura e arco do gerador.
- Galeria técnica `qa-preceptora.html` (poses congeladas, câmera perto/média/arena e o modelo 0.7 para comparação). `scripts/shot-v080.mjs` para fotos no jogo; `ALIVE=` no room-bench.
- A fixture `docs/screenshots/v070/sala-visor.png` mostrava o HUD 0.6.0; agora o README dela aponta para a captura real do visor em `docs/screenshots/v080/` (HUD 0.8.0, campanha que derrotou a B02).
- **Medição (room-bench, SwiftShader, 0.7.0 exata × 0.8.0, médias pareadas das 19 salas):** tempo de quadro mediano −0,4% (baixa), −0,3% (média), +0,3% (alta); draw calls −0,1% / +0,1% / +0,4%; triângulos iguais. Enfermaria circular com a chefe viva: 93→120 draws na baixa, 145→149 na média, 146→150 na alta; quadro +0,9% / +1,6% / −6,6% (ruído de uma repetição). Brilho médio da enfermaria circular (PIL) 10,37 → 14,61. Bundle: main 44,4 → 46,8 kB, render 828,7 → 855,4 kB (gzip 222,3 → 231,3 kB). Detalhes em `docs/benchmark-v080.json`.
- **Campanha real (gravação real do abrigo → Preceptora → visor, comandos de teclado/mouse, sem teleporte nem HP falso):** ombro venceu de ponta a ponta até o final do visor numa build intermediária (r2, 3 janelas do gerador, Helena 100); na r5 a chefe caiu (Helena 100), mas os rastejadores restantes mataram Helena a caminho do visor, o que motivou a queda dos auxiliares. Na build final, o **tank venceu de ponta a ponta** (r6: 10 idas ao gerador, Helena 50, final do visor); o ombro na build final perdeu as 2 tentativas (chefe em 254 HP; e uma morte quando a rota da automação passou pelos rastejadores durante a sequência de três cortes). Limite: a automação lê o estado do jogo para fugir; a dificuldade para um humano não foi medida.
- Conhecido: na fase 2/3 os rastejadores e a Preceptora podem acertar Helena em sequência (a invulnerabilidade de 1,3 s após cada golpe limita o empilhamento, mas não o impede). Sem ajuste extra nesta versão.

## 0.7.0
- Corrige a faixa de parede lisa e clara demais à esquerda da câmera (arquivo, enfermaria e demais salas laterais): a câmera de ombro atravessava ou encostava na parede da porta de entrada; a 0.7 impõe folga de 1,2 m no interior e afasta o spawn lateral. O bake passa a ter desgaste por vértice, wrap mais direcional, atenuação **1,85 e teto de emissão, e a lâmpada da porta fica mais curta.
- Completa o capítulo 2 da pediatria (GDD 1.6) depois da Porta 13: sete salas novas (espera, plantão seguro, brinquedoteca, berçário, leitos infantis, enfermaria circular, ante-sala cirúrgica), com identidade visual própria, documentos só no leitor e conexão com mapa, save/load e migração das saves 0.6 (contentVersion 3→4).
- Novo puzzle P03 (três leitos marcados: baleia, pássaro, árvore; ordem livre; leito isca só dá dica). Novo inimigo E05 Rastejador (crawl no esqueleto Mixamo, mira baixa). Chefe B02 Preceptora (700 de HP, três fases, gerador de 15 s de vulnerabilidade, escurecimento e até dois rastejadores auxiliares). Após duas mortes com a chefe ainda em 700 de HP, a arena foi aberta (camas 1,5×1,5, anel de ~2,7 m) e o kit médico passou para junto do gerador; HP, dano e velocidade da chefe não mudaram. O registro no visor é o final desta versão e gancho para o centro cirúrgico (ainda não construído). A Porta 13 deixa de encerrar a campanha.
- Melhorias de baixo custo nas 12 salas antigas: desgaste/sujeira/umidade no bake, props de história só com materiais já instanciados, contraste maior da luz prática. Sem PointLights novas; merge, instancing e culling iguais aos da 0.6.
- Medição intercalada 0.6.0×0.7.0 (12 salas antigas, 3 perfis, REPEAT=2, room-bench a partir da árvore 0.6 para saves v3, ABBA): workMedian −1,1% / −1,0% / −0,8% (Baixo/Médio/Alto); draws −2,0% / −1,5% / −1,3%; triângulos −0,2% ou menos. A primeira passagem parou aos 25 registros por timeout no clique de Continuar; as 119 restantes foram medidas na mesma sessão, mesmos URLs e mesmo fixture, com clique mais resiliente. isolamento fica com +3 ou +4 draws (uma malha assada a mais); o workMedian dessa sala não sobe de forma consistente, e a média das 12 fica mais leve. Sete salas novas no mesmo orçamento: workMedian −10,8% / −10,3% / −8,3% vs a média 0.6 desta sessão; draws −4,2% / −2,0% / −3,4%. bercario no Médio tem 98 draws (o máximo 0.6 na mesma sessão é 99 na escadaria). circulo e leitos têm mais triângulos (mobiliário), com draws e work dentro do orçamento. Sem garantia de FPS físico.
- Testes (192), lint, tipos e build. Campanha em segmentos com gravações reais: o segmento 1 (início→abrigo, inclusive Porteiro e Porta 13) passou em ombro e tank; o segmento 2 (Preceptora→visor) não chegou ao final — melhor resto 22 HP na chefe. O modo tank acerta a Preceptora com entrada real (não era bug do jogo). Capturas das 19 entradas e meta 0.7.0. O final no visor (`flags.cirurgia`) não foi verificado de ponta a ponta ao vivo.


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
