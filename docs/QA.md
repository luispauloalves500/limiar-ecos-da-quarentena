# QA — LIMIAR 0.9.0

## 0.9.0 — rastejador e Preceptora com os modelos do usuário
**Gates:** 217 testes em 12 arquivos (9 novos em `tests/crawler.test.ts`: fases da passada, aviso/bote/recuperação, morte, migração de save v4 → v5 com o `rastejador05`), lint, TypeScript, Prettier em src/tests/scripts, build e `npm audit --omit=dev` (0 vulnerabilidades). Chromium 158, SwiftShader.

**Assets:** rastejador 16.183.396 → 608.428 bytes (8.661 triângulos), Preceptora 11.874.432 → 574.924 bytes (7.785 triângulos); detalhes em [MODELOS.md](MODELOS.md). Os dois carregam só no Capítulo 2. JS de render 855 → 869 KB (gzip 231 → 236 KB).

**Galeria (draws/triângulos na mesma câmera):** rastejador GLB ~46–49 draws / 15,7k triângulos contra 67 / 9k do rastejador zumbi; Preceptora GLB ~60–68 draws / 18k contra 103 / 13,6k da procedural 0.8.

**Benchmark** (`scripts/room-bench.mjs` da árvore 0.8, base = build exata 0.8.0 fb71ed5, dev = 0.9.0, alternados, uma repetição; `docs/benchmark-v090.json`). Reduzido às salas do Capítulo 2 que mudam e às qualidades Baixa/Média: cada amostra levou ~100 s e as 19 salas × 3 perfis passariam de 3 h.

| Sala (quadro mediano, ms) | Baixa 0.8 → 0.9 | Média 0.8 → 0.9 | Draws (baixa/média) |
|---|---|---|---|
| Berçário (0.9 tem o rastejador05 vivo; a 0.8 não tem inimigo) | 47,5 → 50,6 (+6,5%) | 168,9 → 172,0 (+1,8%) | 66→67 / 98→99 |
| Brinquedoteca, leitos, circular sem inimigos | −7,4% a +1,9% (ruído) | | iguais |
| Brinquedoteca com rastejador vivo | 55,7 → 57,8 (+3,8%) | 175,7 → 180,1 (+2,5%) | 63→65 / 91→91 |
| Leitos com rastejador vivo | 54,3 → 59,5 (+9,6%) | 179,1 → 190,2 (+6,2%) | 57→57 / 82→81 |
| Circular com a Preceptora viva | 49,8 → 62,1 (**+24,7%**) | 178,0 → 186,5 (+4,8%) | **120→77 / 154→106** |

Os GLBs têm menos draws que os atores 0.8 (a Preceptora cai 31–36%), mas a malha skinned com 69 ossos e o retarget custam mais no SwiftShader, onde o skinning roda na CPU; na Baixa com a chefe viva o quadro sobe ~25%. Memória de textura estimada: +6,6 MB na Baixa e +7 a +24 MB na Média (WebP é compressão de transmissão, não de GPU). Não é FPS de GPU física.

**Campanha real a partir das gravações do abrigo da 0.8 (r6), uma tentativa de chefe por modo:**
- Ombro até os leitos (run-shoulder3): rastejador05 morto no berçário, P03 resolvido, Helena com 76. Uma rodada anterior (run-shoulder2) morreu nos leitos: o rastejador colou a 0,7 m, abaixo do limite de inclinação da câmera de ombro (−1,05), e a automação insistiu na mira. A 0.8 exata no mesmo save também travou a mira a ~0,7 m (run-080), mas matou o rastejador; depois falhou no puzzle dos leitos. O smoke passou a empurrar e recuar quando um rastejador cola.
- Tank, chefe: **Preceptora 700 → 28 HP**, Helena morreu na fase 3 (sem kits). Sem vitória.
- Ombro, chefe (boss-shoulder3; a boss-shoulder2 não chegou à chefe, ficou presa atrás de um leito depois do empurrão e o smoke passou a voltar pelo centro antes do P03): rastejadores e P03 ok, **Preceptora 700 → 309 HP**, Helena morreu. Sem vitória.
- **Nesta build a chefe não foi derrotada pela automação em nenhum modo, e o final no visor não foi verificado.** As rodadas pararam aqui para não gastar horas na luta; a lógica da luta é a da 0.8 (que venceu no tank na build final).

**Limitações:** a automação lê o estado para fugir no aviso; a dificuldade para um humano não foi medida. A Preceptora GLB é escura (cabelo preto, camisola) e na câmera alta do modo tank se lê pior que a 0.8; o rim de Fresnel e os olhos ajudam de perto. Os GLBs não têm clips: rastejador animado por pose procedural e Preceptora por retarget, sem mocap. As placas de bandeja continuam procedurais sobre o peito. Um rastejador colado na Helena fica abaixo do limite da câmera de ombro (igual na 0.8): é preciso empurrar (Espaço) ou recuar. Medições em GPU de software.

---

# Histórico — QA 0.8.0

## 0.8.0 — Preceptora (B02)
**Gates:** 208 testes em 11 arquivos (11 novos em `tests/preceptora.test.ts`: fases, escolha de golpe sem repetir 3×, avisos e alcance, puxão por lençol, descarga do gerador, grito de fase fechando as placas), lint, TypeScript e build. Mesmo ambiente da 0.7 (Chromium 158, SwiftShader).

**Benchmark** (`scripts/room-bench.mjs`, base = build exata 0.7.0 c0cc6b5, dev = 0.8.0, alternados; `docs/benchmark-v080.json`):

| Qualidade | Quadro mediano 0.7 → 0.8 | Draws | Triângulos |
|---|---|---|---|
| Baixa (19 salas) | 46,0 → 45,8 ms (−0,4%) | 61,9 → 61,8 | iguais |
| Média (19 salas) | 167,6 → 167,1 ms (−0,3%) | 89,5 → 89,5 | iguais |
| Alta (18 salas*) | 205,2 → 205,8 ms (+0,3%) | 89,9 → 90,3 | iguais |
| Circular com a chefe viva (baixa/média/alta) | 69,8/207,7/269,9 → 70,4/211,1/252,0 ms | 93/145/146 → 120/149/150 | 22,2k/31,1k/41,3k → 24,2k/31,3k/41,5k |

\* a linha dev-alta-visor se perdeu num reinício da máquina; as médias são pareadas por sala. Uma repetição; diferenças abaixo de ~2% são ruído. O salto de draws na baixa com a chefe viva (+27) vem das partes do rig por material e dos decalques de aviso; na média/alta a diferença é de +4.

**Brilho (PIL, escala de cinza):** enfermaria circular 10,37 → 14,61 (três luzes de emergência assadas). Galeria: modelo 0.7 17,1 × 0.8 20,1 na mesma câmera.

**Campanha real** (`scripts/run-segments.mjs`, SKIP_SEG1 a partir das gravações reais do abrigo da 0.7, máx. 2 tentativas por modo):
- r1 (build inicial): ombro venceu, mas fácil demais (700 → 0 em 2 janelas). O grito de fase passou a fechar as placas (mínimo de 3 janelas).
- r2 (3f04ed3): **ombro venceu de ponta a ponta até o final do visor** (3 janelas, Helena 100). Tank morreu 2× na rota de entrada. Ajustes: espera de 1,4 s após acertar Helena, puxão limitado a 1,2 m.
- r3/r4: máquina com carga 11–15 de outros projetos; tank chegou a deixar a chefe com 25 HP; r4 falhou antes do chefe (puzzle dos leitos, instabilidade da automação).
- r5: ombro derrubou a chefe (Helena 100), mas os rastejadores restantes mataram Helena a caminho do visor. Ajuste: os auxiliares caem com a chefe.
- r6 (build final): **tank venceu de ponta a ponta** (10 idas ao gerador, Helena 50, final do visor). Ombro perdeu as 2 tentativas: chefe em 254 HP; e uma morte quando a rota da automação até o gerador passou entre os dois rastejadores durante a sequência de três cortes.

**Limitações:** a automação lê o estado do jogo para fugir no aviso; a dificuldade para um humano não foi medida. Na fase 2/3, rastejadores e chefe podem acertar Helena em sequência (a invulnerabilidade de 1,3 s após cada golpe limita, mas não impede). Não houve vitória do ombro na build exata final (só na intermediária r2 e a queda da chefe na r5). HP 700 mantido (GDD cita 850). Medições em GPU de software.

---

# Histórico — QA 0.7.0

## Método
Linux / Node 24.22.1, Chromium 158.0.8127.18, ANGLE SwiftShader, viewport 1280×800. Testes headless por GPU de software, não certificação de hardware físico. Histórico em [QA-v060.md](QA-v060.md). Comandos reais de teclado/mouse e diagnósticos somente leitura; nenhum teleporte, HP artificial ou flags de progressão criadas pelo bot (o fixture de captura das 19 entradas é um save de revisão, não a campanha).

## Gates
192 testes em dez arquivos (inclui expansão da pediatria, folga do anel da Preceptora e kit junto ao gerador), lint, TypeScript e build. O chunk Three/loader continua >500 KB; o aviso Vite não é ocultado.

## Causas e decisões
- **Faixa clara à esquerda:** nas entradas laterais (arquivo D03, enfermaria D10 e equivalentes), o boom de 2,75 m da câmera de ombro caía na ou através da parede (x≈±6,65). `cameraCollision` deixava a câmera a ~0,3 m da superfície; o near plane (0,06 m) enchia o quadro. O bake 0.6 (tint quente, AO mínimo 0,45, wrap largo, lâmpada da porta com alcance 5 m) deixava a faixa lisa e clara demais. A 0.7 impõe folga de 1,2 m no interior, afasta o spawn lateral (4,6 → 3,8 m), baixa o AO mínimo para 0,38, acrescenta desgaste por vértice, aperta o wrap (0,12+0,88), usa atenuação **1,85 com teto 0,78 e encurta a lâmpada da porta (0,85 / 3,6 m). Custo extra de draws: zero. Confirmado nas capturas de arquivo, enfermaria e escadaria.
- **Expansão após a Porta 13:** o final 0.6 apontava para a pediatria do Capítulo 2 (GDD 1.6), ainda não construída. R-18 é do cap. 6 e ficou de fora. Sete salas (espera, abrigo, recreio, bercario, leitos, circulo, visor), terceiro gravador, puzzle P03, E05 no esqueleto Mixamo (clips Crawl já existentes), B02 no molde do Porteiro. A Porta 13 só abre a ala (`flags.final`); o final desta versão é o registro no visor (`flags.cirurgia`). Saves 0.6 (contentVersion 3) são aceitas e recebem inimigos/salas que faltam.
- **Preceptora:** o GDD cita 850 de HP; 700 com janela de vulnerabilidade de 15 s (recarga 20 s) cabe na economia (B01 = 560). Sem a janela, 700/3 de dano com a carapaça fechada seria impossível. Fase 2 escurece (`view.dim`) e acorda até dois rastejadores. Helpers nascem vivos e a IA só passa a agir na fase 2 (`parseSave` não aceita `removed && !dead`). A intro de 5 s (C6i) aponta o gerador e segura a chefe no início.
- **Justiça da luta B02 (C6j):** dois smokes morreram com a chefe ainda em 700 de HP, antes de usar o gerador — C6h presa no norte (Helena com 10 de HP, a Preceptora em (−0,62, 5,45) bloqueava o waypoint da porta) e C6i interceptada no corredor leste (3,7, 3,2), Helena morta. Avaliação para um jogador humano, não só para a automação:
  - **Espaço:** as quatro camas 2,2×2,2 em (±3,6, 1,5) e (±3,6, −3,2) deixavam o centro com ~5 m, mas os corredores laterais com ~1,84 m. A Preceptora (colisão r=0,6, escala 1,12) fecha esse vão. O gerador (4, −6,2) ficava num canto atrás da cama sudeste. Helena corre a 3,7 m/s e a chefe persegue a 1,2 (fase 3: 1,55): em espaço aberto o kiting é possível; o problema era a geometria, não a velocidade pura. A chefe inicia o wind-up a 5,5 m e, acima de 2,6 m, investe 2,8 m (24 de dano se o jogador ainda está à frente e a menos de 5 m) — num corredor estreito não há como desviar.
  - **Telegraph:** wind-up de 1,0 s (B01: 1,2 s), grunhido e animação AttackBite com `telegraphScale` (lento no início, golpe rápido). Legível em espaço aberto; no corredor o aviso existia, mas não dava para usá-lo. O escurecimento da fase 2 (`view.dim` 0,32 fora da janela do gerador) é o mecânico documentado e permanece.
  - **Munição e kits:** o caminho pediátrico já tem abr-kit, rec2-herb, lei-herb e caixas de 12 tiros (abr, ber, lei). Um dos smokes chegou com reserva 97. 700 HP / 55 por tiro na vulnerabilidade ≈ 13 disparos em uma ou duas janelas de 15 s — munição suficiente. O que falhava era o posicionamento: cir-kit (−4, 6) e cir-ammo (4, 6) estavam na entrada norte, no extremo oposto do gerador. Quem corre para o gerador nos 5 s de stun não pega a cura, e não havia kit ao lado do único ponto seguro da luta.
  - **Veredito:** a luta era injusta para um humano. O conceito (carapaça 3 / 55 aberta, gerador 15/20, ajudantes só na fase 2) é o mesmo do Porteiro e é justo. O que falhava era o palco: corredores laterais viravam armadilha, o gerador era um beco, e o kit ficava do lado errado. Duas mortes com 700 de HP mostram que o jogador pode morrer antes de usar a mecânica.
  - **Ajustes no jogo (não na automação):** camas reduzidas para 1,5×1,5 e puxadas para dentro (±3,1; z=1,4 e −2,8), abrindo um anel perimetral de ~2,69 m (era ~1,84 m no corredor leste), no estilo das colunas do átrio. cir-kit movido para (5,2, −5,0), a menos de 2 m do gerador; cir-ammo permanece na entrada (4, 6). Mantidos HP 700, dano 18/28, velocidade 1,2/1,55, alcance de wind-up 5,5 m, gerador 15/20, intro de 5 s e ajudantes na fase 2. Sem teleporte, invulnerabilidade ou HP falso no smoke.
  - **Campanha C6k (arena já aberta):** o smoke chegou ao gerador, matou os dois auxiliares e baixou a Preceptora de 700 para 147 de HP, ainda com 7,7 s de vulnerabilidade. Helena morreu em (4,46, −6,04), parada no canto do gerador, mirando — a 1,6 m da chefe em fase 3 (28 de dano). cir-kit não foi recolhido; reserva 67. Isso confirma que a luta é justa para um humano (espaço, telegraph e recursos bastam para terminar a janela). Sem novo nerf no jogo. O smoke passou a recolher o kit, sair do canto depois de ligar o gerador, circular pelo anel e desviar no wind-up (jogada honesta, sem trapaça).
- **P03:** marcas visuais no pé da cama (silhuetas coloridas, sem texto na parede). Ordem livre; leito isca só dá dica. A cama do pássaro foi deslocada de z=−5,2 para z=−3,6 para não sobrepor o spawn de D18.
- **As 12 salas:** desgaste/sujeira/umidade só no bake (vértice) e props com cores já instanciadas. Sem PointLights novas.

## Campanha em segmentos (C7)
A campanha oficial da 0.7.0 passou a rodar em **dois segmentos encadeados por gravações reais do jogo**, não numa única sessão de ponta a ponta. Motivo: falhas da automação no Capítulo 1 (Porteiro, timeouts de porta/tiro) repetiam uma hora de jogo que já havia passado várias vezes nesta sessão (C6k, C6l3, C6m, C6n). Avaliação honesta, registada aqui:

- Os saves vêm só do gravador do próprio jogo (`save()` → `localStorage["limiar-save-v1"]`), despejados em disco no instante em que a Helena usa o gravador em segura, posto e abrigo. Não há saves montados à mão, teleporte, HP falso nem flags inventadas.
- **Segmento 1:** do início ao plantão da pediatria (abrigo), passando pelo posto e pela Porta 13. Na segunda tentativa, se existir uma gravação real de segura ou do posto desta própria execução, o smoke a carrega pelo botão Continuar e segue dali.
- **Segmento 2:** carrega a gravação real do abrigo e vai até o visor, pela Preceptora (luta justa após C6j; o smoke foge e atira de longe, sem trapaça).
- Cada segmento tem no máximo **2 tentativas**. Os dois segmentos rodam em **ombro e tank**, em série, nunca em paralelo. `scripts/run-segments.mjs`, com setsid/nohup e log em disco.
- Se uma rodada anterior desta sessão já tivesse deixado um save real do abrigo, ele poderia ser usado no segmento 2. No início do C7 não havia; o segmento 1 precisa gerá-lo.

**Resultados oficiais do C7** (12 de nov. de 2026, 17:59–18:32 America/Sao_Paulo; log `/workspace/limiar-v070-smoke/segments/`; `summary-c7-oficial.json`):

- **Segmento 1, ombro:** passou na 1ª tentativa (17:59:33–18:07:33). Gravações reais em segura, posto e abrigo (`contentVersion` 4, Helena 100 HP, 2 kits, 12+63 munição, `flags.final`, posição do gravador). Inclui o Porteiro, que a campanha única tinha perdido em C6p/C6q.
- **Segmento 1, tank:** passou na 1ª tentativa (18:15:31–18:25:39). Gravação real do abrigo: 100 HP, 1 kit, 12+62, `flags.final`.
- **Segmento 2, ombro:** falhou nas 2 tentativas, ambas a partir da mesma gravação real do abrigo.
  - Tentativa 1: Preceptora a 535 HP, Helena a 76, 1 kit, distância 6,36 m; a automação morreu mirando um ajudante (`rastejador03`). Tela de morte honesta («Nenhum kit médico»).
  - Tentativa 2: teto de 24 ciclos do smoke encerrou a luta com a Preceptora a 639 HP e **Helena viva** (52 HP, 0 kits, 9+82 munição, foto `seg2-a2-fail/failure.png`). Não foi morte no jogo; a automação desistiu.
- **Segmento 2, tank:** falhou nas 2 tentativas, teto de 24 ciclos, Preceptora ainda a 700 HP, Helena viva a 100 HP. A mira tank soltava o ADS, esperava 100 ms e o `shoot()` abortava com `!aiming` — zero dano. Quando o chefe acampava o gerador, o smoke só fugia e não o atraía para fora.
- Nenhuma trapaça, nenhum save fabricado. O jogo (HP 700, dano, velocidade, arena C6j) não mudou. A luta continua justa (C6k chegou a 147 HP).

**C7b (correção só da automação, 18:37–18:45 America/Sao_Paulo):** segmento 2 a partir das **mesmas gravações reais do abrigo** do C7, 2 tentativas, ombro e tank. Sem mudança no jogo. Teto de 90 ciclos, sem tiros nos ajudantes, rajada de 3, espera de ADS, atração para fora do gerador.

- **Ombro tentativa 1 (melhor de toda a sessão):** Preceptora de 700 a **22 HP** (volleys 364→199, 199→34, 34→28, 28→22). Fase 2 (≤497) e fase 3 (≤217) ocorreram. O gerador abriu várias janelas de 15 s («Quinze segundos de claridade»). Helena morreu ao caminhar até o gerador com a chefe a 4,59 m (`generator-go`, `moveTo`). Não é injustiça da luta: a C6k já tinha chegado a 147 HP com janela sobrando.
- **Ombro tentativa 2:** não confirmou os prontuários em leitos (`flags.prontuarios` ausente) e não chegou à Preceptora.
- **Tank tentativas 1 e 2:** morreu no recreio mirando o `rastejador01`. O loop novo de ADS (até 18 ciclos parado) deixou a Helena parada tempo demais. **Não chegou à chefe nesta passagem.**

**C7c — o modo tank acerta a Preceptora? (entrada real, não é bug do jogo).** Antes de culpar o jogo pelo dano zero do C7 tank, `scripts/tank-hit-probe.mjs` carregou o save real do abrigo tank, caminhou até o círculo e disparou com **J, 2 e K reais** (sem chamar `fire()` internamente, sem teleporte, sem HP falso). Relatório em `/workspace/limiar-v070-smoke/tank-probe-run2/report.json`, foto `docs/screenshots/v070/b02-tank-ads.png`.

- ADS registra em **108–124 ms** (HUD «MIRA: TRONCO», indicador de alvo visível).
- Rastejadores: 22 de dano por tiro no tronco, «Ameaça neutralizada». Mesa de controle ok.
- Preceptora, no stun de entrada, armadura fechada: dois tiros **700→697→694** (3+3, regra `damage()` para chefe fechado), aviso honesto **«Armadura fechada. Use a trava elétrica.»**
- O gerador no tank também responde: «Quinze segundos de claridade. A Preceptora está exposta», `vulnerable ≈ 15`.
- **Conclusão:** não é bug do jogo. O dano zero do C7 oficial era a automação (espera de 100 ms + aborto em `!aiming` sem disparar).

**C7d (19:00–19:24 America/Sao_Paulo), última passagem oficial do segmento 2**, mesmas gravações reais, 2 tentativas, ombro e tank. Ajustes só no smoke: mira tank curta (~480 ms; o loop longo matava no recreio) e gerador só com o chefe a mais de 6,5 m (morte da C7b a 22 HP). Sem mudança no jogo. Pedido explícito: se ainda falhasse, não gastar mais horas na automação da chefe.

- **Ombro a1:** 700→306, Helena viva a 100 com 1 kit, 90 ciclos. A chefe acampou o gerador (~(4,5, −4)); o «lure» para (−5,2, 6,2) não a tirou do lugar. Erro honesto de esgotamento.
- **Ombro a2:** 700→**196** (fase 3). Helena logada a 100 HP / 1 kit, vulnerável 6,3 s, depois morreu ao fugir no meio de um `shoot` (`fleePreceptora`/`moveTo`).
- **Tank a1:** chegou à chefe e **causou dano na campanha** (700→581). Mesmo esgotamento a 90 ciclos, Helena 100, 2 kits, lure preso. Confirma o probe: o tank acerta a B02 no jogo publicado.
- **Tank a2:** 700→691, mesmo teto de 90 ciclos, Helena 100.

## O que foi e o que não foi verificado de ponta a ponta

**Verificado, com entrada real e gravações do próprio jogo:**

1. **Segmento 1 (início → abrigo)** nos modos ombro e tank, 1ª tentativa. Inclui recepção, arquivo, gerador, **Porteiro (B01)**, escadaria, internação, enfermaria, posto, lavanderia (P02 3→1→2), isolamento, **Porta 13 em modo play** (não encerra), espera e plantão. Save/load real (`limiar-save-v1`, contentVersion 4, `flags.final`).
2. **Caminho pediátrico do abrigo até a enfermaria circular** (espera, recreio, berçário, leitos/P03, círculo), várias vezes, ombro e tank.
3. **A luta da Preceptora, como mecânica:** gerador 15/20, fases 2 e 3, dano com armadura aberta (volleys de ~55–165) e fechada (3), ADS tank, aviso de armadura e de claridade. A arena após C6j é justa (C6k: 147 HP com janela sobrando; C7b: **22 HP** restantes).
4. **As 19 entradas** no fixture de revisão (inimigos mortos, câmera de ombro após a porta — não é a campanha). Brilho: mínimo média 9,11 e cena 9,48 na sala gerador (limiares 7 e 5). Sem ajuste posterior.

**Não verificado de ponta a ponta numa sessão contínua:**

- **Derrotar a Preceptora até 0 HP** com a automação oficial (melhor resto: 22 HP, C7b ombro a1, Helena morreu no gerador).
- **O trecho pós-chefe:** atravessar a porta do visor com o crachá (`flags.preceptora` / `flags.cracha`), registrar o crachá em (0, −6,5), obter `flags.cirurgia`, a tela de vitória («Água do outro lado.» / `pediatricWin`) e o modo `win`. Esse caminho existe no código (`preceptoraWin` → porta do visor exige a flag → interação do visor → `pediatricWin`) e o teste de grafo confirma que a sala é alcançável; a fotografia `sala-visor.png` é do **fixture de revisão**, não de uma campanha que tenha derrubado a B02. A automação do smoke tem esses passos escritos, mas nunca os concluiu ao vivo. **Não afirmamos que o final foi jogado até o fim nesta sessão.**

## QA real
Segmento 1 oficial passou em ombro e tank, com saves reais. Segmento 2 (Preceptora → visor → `cirurgia`) **não passou**. Porta 13 em modo play, confirmado no segmento 1. Fotografias de porta com fade zero nas campanhas do segmento 1 e no caminho até o círculo. Mínimo de brilho das 19 entradas (fixture de revisão, média RGB sRGB 0–255, recorte sem HUD): **9,11 / 9,48** (gerador), todas passaram (limiares 7 e 5). Detalhe em [brilho.json](screenshots/v070/brilho.json).

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
- A campanha oficial da 0.7.0 foi validada em segmentos com gravações reais. O segmento 1 (até o abrigo, inclusive B01 e Porta 13) passou em ombro e tank. O segmento 2 não chegou ao visor: a melhor tentativa deixou a Preceptora com 22 HP. O final (`flags.cirurgia`, tela «Água do outro lado.») não foi verificado ao vivo. Sem save fabricado nem flag inventada para forçar esse trecho.
