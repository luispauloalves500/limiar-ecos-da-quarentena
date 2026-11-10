# LIMIAR: Ecos da Quarentena — 0.3.0

Survival horror original em português, com Helena Duarte no hospital fictício de Santa Avelina. **Fatia vertical experimental**, não a campanha inteira do [GDD v1.6](docs/GDD-LIMIAR-v1.6.md).

[Jogar no navegador](https://luispauloalves500.github.io/limiar-ecos-da-quarentena/) · [QA e limitações](docs/QA.md)

## Novo na 0.3.0

- **Mortos somem em cinco segundos reais após a morte**, sem esperar corte de câmera. Queda curta, fade nos últimos 0,5 s e descarte da instância, skeleton, hitboxes e recursos exclusivos. Geometria/material/texturas compartilhados ficam no cache até sair da página, sem prejudicar os outros zumbis. Vale para E01, E02, E04, rastejadores e B01, sem exceção para o chefe. O relógio continua em menus/portas e o save mantém o instante da morte; carregar depois do prazo não recria o corpo. Recursos soltos não são removidos junto.
- **Coleta única de verdade:** documentos, munição, bateria, cura, fusível e pulseira saem imediatamente da cena junto com o marcador e o prompt. Documentos ficam no arquivo do inventário. Saves anteriores com documentos já lidos são migrados para não reaparecerem no chão.
- **Doze salas no total:** seis novas — patamar da internação, corredor de internação, enfermaria 203, posto de enfermagem seguro, lavanderia e galeria de isolamento — conectadas ao átrio após B01. Segundo gravador, nova pulseira de acesso, puzzle de pressão, documentos, recursos e final “Fita 03:16 / Porta 13”. O antigo final após o Porteiro vira passagem intermediária.
- **Dois arquétipos novos do GDD, adaptados:** E02 Enfermeiro Contorcido (85 HP, falso recuo e avanço/agarrão de 18); E04 Corredor Febril (65 HP, aviso, investida reta e recuperação de 1,1 s; rastejo cancela corrida). Dois encontros de cada, além dos três E01 e B01 existentes. Não é R-18 nem B02 completo.
- **Identidade das 12 salas:** arquivos empilhados, mobiliário de plantão, macas/leitos, soro, lavadoras, patamar, quadros elétricos, cabos, manchas, prontuários e placas narrativas. Repetições em InstancedMesh mantêm o custo de draw calls limitado; a decoração periférica não vira um sistema novo de destruição/colisão dinâmica.
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
npm run smoke:zombie
npm run smoke:player
npm run verify:published # compara HTTP público com dist local
```

Os playthroughs usam somente comandos reais e diagnósticos somente leitura; não alteram HP, inimigos ou progressão. A automação de mira usa as setas acessíveis para alinhar a retícula física; a captura de mouse é exercitada separadamente pelo smoke curto. Evidências padrão: `/workspace/limiar-v030-smoke/shoulder`, `/workspace/limiar-v030-smoke/tank`. `GAME_URL` e `SMOKE_OUT` são configuráveis. Não confundir testes de unidade de 100 passagens com 100 passagens renderizadas em hardware real.

## Organização e autoria

`world.ts`: salas/grafo/colisões; `logic.ts`: dano, luz, save e transações; `controls.ts`: preferências e regras de controles; `aim.ts`: raycast e colisão de câmera; `actors.ts`: fallback/B01; `player.ts`/`zombie.ts`: assets/mixers/LOD; `player-clips.ts`/`zombie-clips.ts`: keyframes; `art.ts`: texturas/geometria procedural; `post.ts`: pós leve; `render.ts`: cenas/câmeras/efeitos; `main.ts`: coordenação, UI e simulação; `audio.ts`: síntese WebAudio original.

Cenário, props, placas, efeitos e síntese sonora foram criados para esta implementação. **Os dois modelos e clips incluídos vieram do usuário**, não são de nossa autoria. Sua origem/licença original não foi verificada independentemente e não é apresentada como licença aberta. Consulte `docs/CREDITS.md`. Não foram importados assets de Resident Evil. Three.js/ferramentas mantêm suas licenças próprias; este repositório não atribui nova licença ao GDD ou aos assets recebidos.

## Limitações

- São doze salas, três arquétipos comuns e B01 simplificado; não são 8 capítulos, 64 salas, 18 arquétipos ou 7 chefes completos. Sem R-18, destruição de cenário, campanha posterior ou finais ramificados.
- Modelos recebidos são estilizados; clips adicionais são keyframes, não mocap/ragdoll. O apoio da mão esquerda usa CCD somente no bake dos keyframes, sem IK em runtime. Recarga não possui carregador físico; agarrão/soltura são reação visual, não QTE sincronizado. Interação de porta roda na passagem, mas não mostra mão casando geometricamente com cada maçaneta. Hitboxes são aproximações presas aos ossos. Colisão corporal e navegação continuam 2D.
- Colisão de câmera testa o boom e margem, não uma cápsula física completa. Em cantos muito apertados pode aproximar/ocultar Helena. O tank oculta teto e paredes próximas intencionalmente.
- Pós é um glow econômico de cinco amostras, não bloom multi-mip/HDR cinematográfico, SSAO, SSR ou iluminação global. Sombras/cookie/bump são desligados no Baixo (texturas de cor permanecem). Queda real de contexto WebGL e hardware fraco ainda precisam de QA adicional.
- Sem gamepad, remapeamento completo, inventário por grade, baú, outras armas, faca ou esquiva. R-18 não foi acrescentado nesta atualização gráfica.
- Salas são procedurais e suas definições cabem no bundle inicial; sem streaming remoto de capítulos, PWA/service worker ou garantia offline.
- Performance e matrizes completas do GDD não estão certificadas. O GLB melhora a qualidade visual, mas skeletal skinning/mixers custam mais CPU que bonecos procedurais. Não prometemos 30/60 FPS: benchmark comparativo real e regressões estão em `docs/QA.md`/`docs/MODELOS.md`. SwiftShader não representa GPU física. Há aviso de chunk JS >500 KB no build, não escondido.
