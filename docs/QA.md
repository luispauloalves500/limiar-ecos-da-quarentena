# QA — LIMIAR 0.7.0

## Método
Linux / Node 24.22.1, Chromium 158.0.8127.18, ANGLE SwiftShader, viewport 1280×800. Testes headless por GPU de software, não certificação de hardware físico. Histórico em [QA-v060.md](QA-v060.md). Comandos reais de teclado/mouse e diagnósticos somente leitura; nenhum teleporte, HP artificial ou flags de progressão criadas pelo bot (o fixture de captura das 19 entradas é um save de revisão, não a campanha).

## Gates
190 testes em dez arquivos (inclui expansão da pediatria, câmera com folga e desgaste no bake), lint, TypeScript e build. O chunk Three/loader continua >500 KB; o aviso Vite não é ocultado.

## Causas e decisões
- **Faixa clara à esquerda:** nas entradas laterais (arquivo D03, enfermaria D10 e equivalentes), o boom de 2,75 m da câmera de ombro caía na ou através da parede (x≈±6,65). `cameraCollision` deixava a câmera a ~0,3 m da superfície; o near plane (0,06 m) enchia o quadro. O bake 0.6 (tint quente, AO mínimo 0,45, wrap largo, lâmpada da porta com alcance 5 m) deixava a faixa lisa e clara demais. A 0.7 impõe folga de 1,2 m no interior, afasta o spawn lateral (4,6 → 3,8 m), baixa o AO mínimo para 0,38, acrescenta desgaste por vértice, aperta o wrap (0,12+0,88), usa atenuação **1,85 com teto 0,78 e encurta a lâmpada da porta (0,85 / 3,6 m). Custo extra de draws: zero. Confirmado nas capturas de arquivo, enfermaria e escadaria.
- **Expansão após a Porta 13:** o final 0.6 apontava para a pediatria do Capítulo 2 (GDD 1.6), ainda não construída. R-18 é do cap. 6 e ficou de fora. Sete salas (espera, abrigo, recreio, bercario, leitos, circulo, visor), terceiro gravador, puzzle P03, E05 no esqueleto Mixamo (clips Crawl já existentes), B02 no molde do Porteiro. A Porta 13 só abre a ala (`flags.final`); o final desta versão é o registro no visor (`flags.cirurgia`). Saves 0.6 (contentVersion 3) são aceitas e recebem inimigos/salas que faltam.
- **Preceptora:** o GDD cita 850 de HP; 700 com janela de vulnerabilidade de 15 s (recarga 20 s) cabe na economia (B01 = 560). Sem a janela, 700/3 de dano com a carapaça fechada seria impossível. Fase 2 escurece (`view.dim`) e acorda até dois rastejadores. Helpers nascem vivos e a IA só passa a agir na fase 2 (`parseSave` não aceita `removed && !dead`).
- **P03:** marcas visuais no pé da cama (silhuetas coloridas, sem texto na parede). Ordem livre; leito isca só dá dica. A cama do pássaro foi deslocada de z=−5,2 para z=−3,6 para não sobrepor o spawn de D18.
- **As 12 salas:** desgaste/sujeira/umidade só no bake (vértice) e props com cores já instanciadas. Sem PointLights novas.

## QA real
`smoke` (ombro e tank): 19 salas, final no visor com a flag `cirurgia`, Porta 13 em modo play (não encerra), save/load real no plantão da pediatria, zero erros JS/warnings/HTTP. Fotografias de porta com fade zero. Mínimo de brilho das 19 entradas (fixture de revisão, média RGB sRGB 0–255, recorte sem HUD): a registrar após as campanhas desta sessão; a revisão prévia das 19 passou (mínimo média 9,11 e cena 9,48, limiares 7 e 5).

`smoke:quality` / `smoke:environment` / `smoke:player` / `smoke:zombie` / `smoke:poses`: mesmos papéis da 0.6; environment-smoke e published-smoke exigem 0.7.0.

Resultados: [campanha](campaign-qa-v070.json) (após o smoke), [room-bench](benchmark-v070.json) e [capturas](screenshots/v070/README.md). Imagens originais em `/workspace/limiar-v070-smoke/`. Sem ajuste de brilho posterior.

## Orçamento
Room-bench intercalado (`scripts/room-bench.mjs`) contra a baseline exata 4964c5b em `/workspace/limiar-v070-baseline` (:4177). 12 salas antigas, câmera de ombro parada, inimigos mortos, perfis Baixo/Médio/Alto, REPEAT=2, 1,5 s de aquecimento + 4 s de amostra. Executado a partir da árvore 0.6 para saves contentVersion 3 (a 0.6 rejeitaria saves v4). `work*` é o tempo JS+GPU por quadro (readPixels de 1 px), independente do vsync. Chromium 158.0.8127.18, ANGLE SwiftShader, viewport 1280×800. A primeira passagem parou aos 25 registros por timeout no clique de Continuar; as 119 restantes seguiram na mesma sessão, mesmos URLs e fixture. Dados em [benchmark-v070.json](benchmark-v070.json).

| Perfil | workMedian 0.6→0.7 | workMean | Draws | Triângulos | Entrada |
|---|---|---|---|---|---|
| Baixo | 56,82 → 56,19 ms (−1,1%) | 33,00 → 32,57 ms (−1,3%) | 63,4 → 62,1 (−2,0%) | 19,1k → 19,1k (−0,2%) | 2871 → 2836 ms (−1%) |
| Médio | 204,17 → 202,17 ms (−1,0%) | 116,35 → 114,20 ms (−1,8%) | 90,3 → 89,0 (−1,5%) | 24,8k → 24,8k (−0,2%) | 4711 → 4929 ms (+5%) |
| Alto | 246,20 → 244,18 ms (−0,8%) | 139,76 → 137,62 ms (−1,5%) | 91,2 → 90,1 (−1,3%) | 35,0k → 35,0k (−0,1%) | 5291 → 5300 ms (0%) |

isolamento fica com +3 ou +4 draws (uma malha assada a mais: 60→63 / 86→90 / 87→91); o workMedian dessa sala não sobe de forma consistente (−3,2% / +3,1% / −3,2%), e a média das 12 fica mais leve. arquivo, enfermaria e escadaria têm menos draws com a folga da câmera. Textura estimada praticamente idêntica (Baixo ~2,9 MB; Médio/Alto ~18–26 MB, hook WebGL inflado nesta caixa — comparar só com o mesmo método). Transferência HTTP 1511 → 1516 KB. GLBs inalterados; JS de render 818.952 → 828.730 bytes (hashes posteriores ao rótulo 0.7.0 podem mudar o nome do chunk). Luzes dinâmicas permanecem 3. Amostra em GPU de software, não garantia de FPS físico. Estes workMedian da 0.6 são desta sessão intercalada (caixa relativamente quieta), não os números publicados da 0.6 (que tinham sido intercalados com a 0.5 e tiveram campanha concorrente).

Sete salas novas, mesmos tempos e perfis, só em :4173, 42 registros, 0 erros, contra o orçamento médio 0.6 desta sessão:

| Perfil | workMedian novas (vs orçamento 0.6) | Draws | Triângulos |
|---|---|---|---|
| Baixo | 50,68 ms (−10,8% vs 56,82) | 60,7 (−4,2% vs 63,4) | 18,7k (−2,3%) |
| Médio | 183,13 ms (−10,3% vs 204,17) | 88,5 (−2,0% vs 90,3) | 24,5k (−1,1%) |
| Alto | 225,79 ms (−8,3% vs 246,20) | 88,1 (−3,4% vs 91,2) | 34,7k (−0,9%) |

bercario no Médio tem 98 draws (o máximo 0.6 nesta sessão é 99 na escadaria). circulo e leitos têm mais triângulos pelo mobiliário; draws e workMedian ficam dentro do orçamento. Auditoria de produção: `npm audit --omit=dev` — zero vulnerabilidades.

## Publicação
Versões anteriores (0.1.0–0.6.0) não usaram tag Git nem GitHub Release: um commit/push normal na `main` dispara o workflow oficial (lint/tipos/testes/build) e o deploy no Pages. Depois do deploy, `verify:published` exige 0.7.0 e compara os hashes HTTP com o `dist` local. O smoke de UI volta a rodar no site público. SHA/run/deployment ficam em `/workspace/limiar-v070-smoke/release.json` e na entrega, não inventados no histórico do commit.

## Limitações explícitas
- Dezenove salas e o Capítulo 2 da pediatria; não o cap. 3 (centro cirúrgico / Mergulhador) nem R-18 (cap. 6). A Preceptora usa 700 de HP, não os 850 do GDD. A Porta 13 passou a ser um batente intermediário.
- Luz assada é por vértice, não GI/lightmap de textura/RT. Dinâmicos e atores não alimentam o bake; o probe é uma média aproximada da sala. Sem PointLights práticas na cena, reflexos e especular de lâmpada pontual somem. O contraste maior deixa algumas salas (circulo) mais escuras, ainda acima dos limiares de QA.
- IK dos pés só em chão plano; não há blend tree contínua, plantio em desnível nem mocap novo. Pode haver deslizamento/clipping em extremos. Recarga não anima um carregador físico; mão não encaixa cada maçaneta.
- Empurrão curto tem cooldown de 3 s, não stamina, rolamento ou física de ragdoll. Agarrão orienta participantes/limita movimento 0,5 s e permite empurrão, mas não QTE de mash.
- Não foram implementados arrombamento de portas fracas, navegação/IA entre salas, audição tática nova ou bando coordenado.
- Música é um tema tonal/drone procedural discreto, não trilha orquestral; grunhidos são estilizados, não atores gravados. Audição/mixagem humana e hardware físico continuam pendentes.
- Física/vidro/volumetria continuam aproximados conforme QA anterior. Sem gamepad, inventário Tetris ou baú. Licença original dos modelos fornecidos não foi verificada; créditos mantidos.
- A comparação oficial de desempenho desta versão retomou o room-bench após um timeout de clique; a geometria, os URLs e o fixture não mudaram.
