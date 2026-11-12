# LIMIAR: Ecos da Quarentena — 0.6.0

Survival horror original em português, com Helena Duarte no hospital fictício de Santa Avelina. **Fatia vertical experimental**, não a campanha inteira do [GDD v1.6](docs/GDD-LIMIAR-v1.6.md).

[Jogar no navegador](https://luispauloalves500.github.io/limiar-ecos-da-quarentena/) · [QA e limitações](docs/QA.md)

## Novo na 0.6.0 — luz assada e animações no chão

- **Luz e AO por vértice:** cada sala recebe arquitetura procedural e um bake de AO/luz prática no vértice, com caixas grandes retesseladas e malhas estáticas unidas por material. As PointLights práticas e o fill preso à câmera saem da cena; o flicker das lâmpadas passa por um ganho compartilhado, e Helena/zumbis leem um light probe da sala. A lanterna, o hemisfério e as sombras da qualidade Médio/Alto continuam em tempo real.
- **Helena no chão:** a passada acompanha a velocidade real, com quadril em backpedal/strafe, inclinação, respiração, recuo com as duas mãos, IK dos pés em chão plano, corpo morto que não afunda e rampa de aceleração (o smoke da 0.5 precisou mirar mais perto da nota por causa dessa rampa).
- **Zumbis mais contidos:** passada sincronizada, aviso de ataque, marcha e postura por ID (inclinação e corcunda reduzidas para não cobrir a cabeça), impacto por região, giro limitado e corpo preso ao chão. As mesmas camadas aparecem nas páginas de QA e na folha de poses.
- **Sem flags de experimento:** `?exp=` foi retirado. Fica o resultado medido: arquitetura + bake completo + tessellation + luz assada + cores por vértice, com casters e não-casters em malhas separadas para a sombra da lanterna.
- **Medição da 0.6:** room-bench intercalado com a 0.5.0 (12 salas, 3 perfis, REPEAT=2, 1,5 s de aquecimento + 4 s de amostra, SwiftShader). Draws **107 → 63 (−41%)** no Baixo, **161 → 91 (−44%)** no Médio e **162 → 91 (−44%)** no Alto. workMedian (JS+GPU, independente do vsync) **−2,0% / −0,1% / −1,5%**. Entrada igual ou um pouco mais rápida; textura estimada idêntica; transferência HTTP +6 KB; GLBs iguais; JS de render 801 → 819 KB. workMean no Baixo ficou +5,9% numa passagem com campanha concorrente (load ~15); a mediana e uma passagem anterior mais ociosa apontam custo igual ou menor. Triângulos **+33% a +55%** pela tessellation, compensados pelo merge e pela retirada das PointLights práticas/de porta (3 luzes dinâmicas no total: hemisfério, lanterna, flash). Amostra em GPU de software, não garantia de FPS físico. Campanhas completas de ombro e tank passaram; 184 testes.

[QA e medições](docs/QA.md) · [12 salas, menu e poses reais](docs/screenshots/v060/README.md)

## 0.5.0 preservada — menos ruído, mais presença

- **Cenário sem cartazes explicativos:** prosa e etiquetas flutuantes foram retiradas. Restam números discretos nas portas; nome da sala no HUD, prompts só perto do objeto e sinal de coleta sutil a menos de 2,6 m. Relógio/purga continuam explicados nos documentos, mapa e objetivos. Narrativa ambiental recuperável no diário do inventário.
- **Entrada legível:** folhas/batentes entram na colisão para impedir câmera atrás da porta fechada (o mundo preto não era só fade). O fade final usa relógio real, independente do delta limitado da simulação e de travadas de compilação de shader. A QA espera a transição e opacidade zero antes de fotografar. Luz mínima e práticas reforçadas sem apagar a atmosfera escura.
- **Helena e arma:** corrigida uma chamada de QuickTurn que ocorria em toda tecla, não apenas Z em tank. A pistola fica na mão direita durante interação/porta; a esquerda alcança objetos. Pose baixa com CCD curto, apoio da lanterna, crossfade de 180 ms e velocidade de animação proporcional a correr/cautela/mira. Ritmos dos zumbis variam por ID. Não há IK dos pés ou mocap novo.
- **Som próprio em camadas:** tiro com transiente de ruído, corpo grave e cauda/reverb; recarga em quatro etapas; porta pesada, passos, carne/crânio, grunhidos 3D e respiração/batimento de baixa vida. Tema tonal procedural por sala, harmonia calma nos postos e tensão conforme a proximidade de inimigos. Quatro volumes persistentes: geral, música, efeitos e vozes; legendas opcionais. Tudo sintetizado, sem áudio de terceiros ou fala gravada.
- **Game feel:** pequeno recuo de câmera, impactos sonoros e **Espaço para empurrar** uma ameaça frontal próxima, sem dano, com recuperação de 3 s. Chefes são imunes. Agarrão curto orienta os participantes e admite empurrão; não é QTE longo nem sistema novo de arrombar portas.
- **Medição da 0.5:** no fixture comum de seis GLBs em SwiftShader, média 80,47 → 75,97 ms (−5,6%), draws 116 → 109; amostra curta/ruidosa, sem garantia de FPS ou dos piores frames. Campanhas completas passaram em ombro e tank; 171 testes, 18 poses reais e as 12 entradas fotografadas/inspecionadas.
- **Título 3D:** corredor original animado, chuva leve, luz oscilante, silhueta e logo. Navegação por ↑/↓/Enter, mouse/Tab, créditos e opções. O tema só começa após gesto real do navegador.

[Arquivo histórico de capturas 0.5](docs/screenshots/v050/README.md)

## Ambiente 0.4.0 preservado (sem as antigas placas)

- **Ombro no jogo real:** enquadramento menos extremo, FOV de mira mais aberto, colisão com cinco sondas/margem de 34 cm e ocultação correta em espaços impossíveis. Rotações procedurais são restauradas antes do mixer, evitando inclinação acumulada em tracks constantes. Mira recebe ajuste CCD curto dos braços e a pistola física converge sobre o ponto da retícula. Spawn olha para dentro da recepção. A automação agora restaura ombro/direção depois dos testes de C/Z, em vez de apresentar a pose de stress contra a parede como padrão.
- **Doze ambientes vivos:** exaustores girando, tecido/plástico ondulando em shader, papel suspenso, partículas GPU de poeira/gotas/vapor/faíscas/moscas, poças com ondas, CRT com ruído/scanlines e feixes de luz baratos. Cada sala tem cor/neblina, superfície acústica e evento próprios; a mensagem agora está no diário. Sem assets ambientais externos.
- **Reação leve:** latas, garrafas, papel e cadeira de rodas recebem impulso de passos/tiros, com amortecimento. Vidro decorativo quebrável, estilhaços e até 16 marcas de projétil por sala. Vidro/impactos e eventos consumidos persistem em saves antigos compatíveis; posição dos objetos soltos é temporária.
- **Fauna e sustos discretos:** ratos/baratas estilizados e moscas reagem ao cone da lanterna. Telefone, rádio, batidas, sombra, maca e porta têm um evento por sala, consumido no save; não disparam durante menus/portas. Não existem áreas externas/pássaros.
- **Áudio próprio espacial:** três fontes de ambiente com atenuação HRTF, ruído/vento/zumbido, gotas, passos por superfície e reverb aproximado por sala. Não é simulação acústica física nem gravação de hospital.
- **Opções de vida ambiental:** seguir qualidade ou densidade Baixa/Média/Alta/desligada. Reduz partículas, fauna e movimento cosmético; não silencia narrativa/áudio ou remove objetos interativos.
- **Orçamento:** instancing de peças/lixo/fauna, merge de exaustores e cadeira, transforms estáticos congelados, simulação só da sala atual e mixers distantes limitados a 12 Hz no Baixo. Medição **histórica da 0.4**, com fixture antigo: 64,51 → 59,81 ms/frame (−7,3%) em SwiftShader. A comparação justa 0.4→0.5 usa novo fixture comum e consta no QA; os números antigos não são diretamente comparáveis. [Método/limites](docs/QA.md), sem promessa de FPS.

[Arquivo histórico de capturas 0.4](docs/screenshots/v040/README.md) — não representa a limpeza visual atual.

## Expansão 0.3.0 preservada

- **Mortos somem em cinco segundos reais após a morte**, sem esperar corte de câmera. Queda curta, fade nos últimos 0,5 s e descarte da instância, skeleton, hitboxes e recursos exclusivos. Geometria/material/texturas compartilhados ficam no cache até sair da página, sem prejudicar os outros zumbis. Vale para E01, E02, E04, rastejadores e B01, sem exceção para o chefe. O relógio continua em menus/portas e o save mantém o instante da morte; carregar depois do prazo não recria o corpo. Recursos soltos não são removidos junto.
- **Coleta única de verdade:** documentos, munição, bateria, cura, fusível e pulseira saem imediatamente da cena junto com o marcador e o prompt. Documentos ficam no arquivo do inventário. Saves anteriores com documentos já lidos são migrados para não reaparecerem no chão.
- **Doze salas no total:** seis novas — patamar da internação, corredor de internação, enfermaria 203, posto de enfermagem seguro, lavanderia e galeria de isolamento — conectadas ao átrio após B01. Segundo gravador, nova pulseira de acesso, puzzle de pressão, documentos, recursos e final “Fita 03:16 / Porta 13”. O antigo final após o Porteiro vira passagem intermediária.
- **Dois arquétipos novos do GDD, adaptados:** E02 Enfermeiro Contorcido (85 HP, falso recuo e avanço/agarrão de 18); E04 Corredor Febril (65 HP, aviso, investida reta e recuperação de 1,1 s; rastejo cancela corrida). Dois encontros de cada, além dos três E01 e B01 existentes. Não é R-18 nem B02 completo.
- **Identidade das 12 salas:** arquivos empilhados, mobiliário de plantão, macas/leitos, soro, lavadoras, patamar, quadros elétricos, cabos, manchas, prontuários e sinalização numérica discreta. Repetições em InstancedMesh mantêm o custo de draw calls limitado; a decoração periférica não vira um sistema novo de destruição/colisão dinâmica.
- **Modelos enviados pelo usuário:** Helena e zumbi E01 agora usam GLB skinned; E02/E04 são variantes do zumbi. 11 clips adicionais do zumbi (incluindo tremor aditivo) e 14 de Helena criados em keyframes. Walking/Running recebidos são preservados; Helena também usa caminhada cautelosa. Pistola/lanterna nas mãos, camadas superior/inferior, mira por pitch e hitboxes nos ossos. [Créditos](docs/CREDITS.md).
- **Otimização medida:** zumbi 9.529.864 → 461.476 bytes + LOD de 243.784; 104.176 → 15.626/4.684 triângulos. Helena 2.969.100 → 606.528 bytes, 10.185 triângulos. WebP, meshopt, clones com materiais/geometria compartilhados, LOD/culling/mixers seletivos. [Medições e limitações](docs/MODELOS.md).
- Ombro direito mais deslocado: Helena fica à esquerda da retícula, também ao mirar. C espelha o enquadramento. Tank/câmeras fixas continuam secundários.

## Base 0.2 preservada


- **Sobre o ombro por padrão:** câmera atrás do ombro direito, mouse com pointer lock, pitch limitado, sensibilidade/inversão Y, movimento relativo à câmera, rotação corporal suave, mira com zoom e troca de ombro. Colisão do boom contra paredes, teto e móveis impede a câmera de atravessar superfícies; em distâncias muito curtas Helena é ocultada para evitar obstruir o quadro.
- **Tank secundário:** câmeras fixas com corte por zona, W/S no eixo corporal, A/D girando e meia-volta em Z. Não é apenas a câmera antiga com controles modernos. Troca em V ou nas opções; preferência persiste separadamente do save.
- **Mira física sobre o ombro:** retícula central gera raycast contra hitboxes transformadas de cabeça, torso e cada perna. A superfície mais próxima vence, com teste adicional entre arma e impacto para impedir tiros através da cobertura. 1/2/3 só seleciona região no tank. Assistência de cone mínimo é opcional e começa desligada.
- **Hospital fechado e mais sombrio:** quatro paredes, teto e tubulação; modo tank usa cutaway para tornar o interior visível. Materiais PBR com texturas Canvas de azulejo sujo, ferrugem, umidade e manchas; macas com colchões/grades, estantes, monitores, quadros, sinalização, bolsas de soro e decals de sangue.
- Lanterna SpotLight, cookie procedural e sombra nos perfis Médio/Alto; falloff convencional no Baixo. Luzes práticas garantem navegação com lanterna desligada e oscilam sutilmente. Neblina, poeira, ACES/sRGB e pós leve com glow de cinco amostras, vinheta, granulação e aberração cromática discreta.
- B01 procedural articulado; modelos procedurais anteriores permanecem como fallback explícito se falhar a rede/decodificação de GLB. Flash de disparo, sangue/impacto e núcleo do chefe com feedback de vulnerabilidade.
- Perfis **Baixo / Médio / Alto** controlam resolução, sombras, pós e poeira. Não é uma garantia de FPS em hardware desconhecido.

## Conteúdo preservado

Doze salas, portas cinematográficas bidirecionais e estado persistente; pistola de 12 tiros com reserva finita; três E01 com crítico craniano de 8%, dano de cabeça 1,8×, integridade de cada perna e rastejo funcional; lanterna/baterias/exposição/atordoamento; saúde e kits; documentos; inventário simplificado; mapa; relógio 03:15, chave e fusível; gravador com save/load versionado; chefe B01 adaptado com 560 HP, ataques anunciados, núcleo vulnerável e trava elétrica recarregável que evita softlock por falta de balas. Conclusão curta e atalho após vencer.

Os saves **v1 da 0.1.0 permanecem compatíveis**. O modo de câmera e as opções ficam em `limiar-preferences-v1`, não substituem o slot `limiar-save-v1`. Armazenamento é local a este navegador/domínio. O jogo não envia saves/telemetria a servidores.

## Controles

| Ação | Controle |
|---|---|
| Alternar ombro / tank | V ou Opções |
| Ombro: controlar visão | Clique na cena para capturar mouse; Esc libera/pausa |
| Ombro: mover / correr / cauteloso | WASD relativo à câmera / Shift / Alt esquerdo |
| Alternativa sem captura de mouse | Setas para olhar; RMB arrastado também gira |
| Trocar ombro direito/esquerdo | C |
| Tank: avançar/recuar / girar | W/S / A/D |
| Tank: meia-volta | Z |
| Mirar / atirar | Segurar RMB ou J / LMB ou K |
| Tank: cabeça / tronco / perna esquerda | 1 / 2 / 3; T alterna alvo |
| Interagir / recarregar | E / R |
| Empurrar ameaça frontal próxima | Espaço (recuperação de 3 s, não afeta B01) |
| Navegar no título | ↑ / ↓ / Enter ou mouse / Tab |
| Lanterna / foco | F / segurar Q mirando |
| Bateria / kit médico | B / H |
| Inventário / mapa / pausa | Tab / M / Esc |

Fechar um menu solta as teclas. No ombro, clique novamente na cena para recapturar o mouse. Durante a porta, movimento, tiros, câmera e menus ficam bloqueados. Use Opções no menu principal ou na pausa para sensibilidade, inversão Y, qualidade e assistência.

[Mapa de portas e progressão](docs/MAPA.md)

## Rota curta

Leia o bilhete na recepção → corredor → posto de rádio à esquerda (salve no gravador) → arquivo (relógio **03:15**, obtenha a chave) → manutenção (pegue fusível na entrada e instale no fundo à direita) → átrio. Contorne colunas, fuja dos avisos e use a trava no fundo para expor/danificar o Porteiro. O circuito recarrega em 12 s. Após B01, use a porta à direita do átrio → patamar → internação. Pegue a pulseira no leito 203, visite/salve no posto de enfermagem, entre na lavanderia e purgue **3 → 1 → 2**. Na galeria de isolamento, neutralize o Febril e use o terminal no fundo para transmitir a fita e selar a Porta 13. O atalho administrativo continua permitindo retorno à recepção. Salve novamente no posto para preservar exploração posterior.

## Executar e testar

Node.js 24 recomendado; dependências fixadas no lockfile.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run preview -- --port 4173
```

Preview: `http://localhost:4173/limiar-ecos-da-quarentena/`. Vite usa a base do repositório Pages. O workflow oficial valida lint, tipos, testes e build antes da publicação.

```sh
npx playwright install chromium
GAME_MODE=shoulder npm run smoke
GAME_MODE=tank npm run smoke
npm run smoke:published
npm run smoke:environment
npm run smoke:quality
npm run smoke:zombie
npm run smoke:player
npm run smoke:poses
npm run verify:published # compara HTTP público com dist local
```

Os playthroughs usam somente comandos reais e diagnósticos somente leitura; não alteram HP, inimigos ou progressão. A automação de mira usa as setas acessíveis para alinhar a retícula física; a captura de mouse é exercitada separadamente pelo smoke curto. Evidências padrão: `/workspace/limiar-v060-smoke/shoulder`, `/workspace/limiar-v060-smoke/tank`. `GAME_URL` e `SMOKE_OUT` são configuráveis. Não confundir testes de unidade de 100 passagens com 100 passagens renderizadas em hardware real.

## Organização e autoria

`environment.ts`/`environment-logic.ts`: ambiente reativo e persistência; `world.ts`: salas/grafo/colisões; `logic.ts`: dano, luz, save e transações; `controls.ts`: preferências e regras de controles; `aim.ts`: raycast e colisão de câmera; `actors.ts`: fallback/B01; `player.ts`/`zombie.ts`: assets/mixers/LOD; `player-clips.ts`/`zombie-clips.ts`: keyframes; `art.ts`: texturas/geometria procedural; `post.ts`: pós leve; `render.ts`: cenas/câmeras/efeitos; `main.ts`: coordenação, UI e simulação; `audio.ts`/`sound-design.ts`: síntese e mixagem WebAudio; `title.ts`: título 3D; `presentation.ts`: relógio visual/luz/variações; `gameplay.ts`: empurrão testável; `architecture.ts`/`bake.ts`: trim por sala e AO/luz por vértice; `locomotion.ts`/`stride.ts`: rampa, giro, passada e variação de marcha.

Cenário, props, placas, efeitos e síntese sonora foram criados para esta implementação. **Os dois modelos e clips incluídos vieram do usuário**, não são de nossa autoria. Sua origem/licença original não foi verificada independentemente e não é apresentada como licença aberta. Consulte `docs/CREDITS.md`. Não foram importados assets de Resident Evil. Three.js/ferramentas mantêm suas licenças próprias; este repositório não atribui nova licença ao GDD ou aos assets recebidos.

## Limitações

- São doze salas, três arquétipos comuns e B01 simplificado; não são 8 capítulos, 64 salas, 18 arquétipos ou 7 chefes completos. Sem R-18, destruição de cenário, campanha posterior ou finais ramificados.
- Modelos recebidos são estilizados; clips adicionais são keyframes, não mocap/ragdoll. A 0.6 acrescenta IK dos pés só em chão plano, sincronia de passada e camadas de postura; não é blend tree contínua nem plantio em escadas/desníveis. Pode haver deslizamento ou clipping em extremos. A mira recebe CCD limitado em runtime para braços/mãos e orientação física da pistola. Recarga não possui carregador físico; agarrão curto orienta participantes e limita movimento por 0,5 s; Espaço pode interromper, mas não é QTE de mash ou sync de mocap. Interação de porta roda na passagem, mas não mostra mão casando geometricamente com cada maçaneta. Hitboxes são aproximações presas aos ossos. Colisão corporal e navegação continuam 2D.
- Colisão de câmera testa o boom e margem, não uma cápsula física completa. Em cantos muito apertados pode aproximar/ocultar Helena. O tank oculta teto e paredes próximas intencionalmente.
- A luz prática da 0.6 é assada por vértice (AO + contribuições das lâmpadas da sala), não GI, lightmaps de textura, SSR ou RT. Objetos dinâmicos e atores não projetam no bake; recebem um light probe aproximado. Pós continua um glow econômico de cinco amostras, não bloom multi-mip/HDR cinematográfico ou SSAO. Sombras/cookie/bump são desligados no Baixo (texturas de cor e o bake permanecem). Queda real de contexto WebGL e hardware fraco ainda precisam de QA adicional.
- Sem gamepad, remapeamento completo, inventário Tetris/gestão de espaço, baú, outras armas, faca ou esquiva com rolamento (há empurrão). R-18 não foi acrescentado nesta atualização gráfica.
- Salas são procedurais e suas definições cabem no bundle inicial; sem streaming remoto de capítulos, PWA/service worker ou garantia offline.
- Performance e matrizes completas do GDD não estão certificadas. O GLB melhora a qualidade visual, mas skeletal skinning/mixers custam mais CPU que bonecos procedurais. Não prometemos 30/60 FPS: benchmark comparativo real e regressões estão em `docs/QA.md`/`docs/MODELOS.md`. SwiftShader não representa GPU física. Há aviso de chunk JS >500 KB no build, não escondido.
