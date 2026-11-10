# LIMIAR: Ecos da Quarentena — 0.2.0

Survival horror original em português, com Helena Duarte no hospital fictício de Santa Avelina. **Fatia vertical experimental**, não a campanha inteira do [GDD v1.6](docs/GDD-LIMIAR-v1.6.md).

[Jogar no navegador](https://luispauloalves500.github.io/limiar-ecos-da-quarentena/) · [QA e limitações](docs/QA.md)

## Novo na 0.2.0

- **Sobre o ombro por padrão:** câmera atrás do ombro direito, mouse com pointer lock, pitch limitado, sensibilidade/inversão Y, movimento relativo à câmera, rotação corporal suave, mira com zoom e troca de ombro. Colisão do boom contra paredes, teto e móveis impede a câmera de atravessar superfícies; em distâncias muito curtas Helena é ocultada para evitar obstruir o quadro.
- **Tank secundário:** câmeras fixas com corte por zona, W/S no eixo corporal, A/D girando e meia-volta em Z. Não é apenas a câmera antiga com controles modernos. Troca em V ou nas opções; preferência persiste separadamente do save.
- **Mira física sobre o ombro:** retícula central gera raycast contra hitboxes transformadas de cabeça, torso e cada perna. A superfície mais próxima vence, com teste adicional entre arma e impacto para impedir tiros através da cobertura. 1/2/3 só seleciona região no tank. Assistência de cone mínimo é opcional e começa desligada.
- **Hospital fechado e mais sombrio:** quatro paredes, teto e tubulação; modo tank usa cutaway para tornar o interior visível. Materiais PBR com texturas Canvas de azulejo sujo, ferrugem, umidade e manchas; macas com colchões/grades, estantes, monitores, quadros, sinalização, bolsas de soro e decals de sangue.
- Lanterna SpotLight, cookie procedural e sombra nos perfis Médio/Alto; falloff convencional no Baixo. Luzes práticas garantem navegação com lanterna desligada e oscilam sutilmente. Neblina, poeira, ACES/sRGB e pós leve com glow de cinco amostras, vinheta, granulação e aberração cromática discreta.
- Personagens articulados com cápsulas, ombros/cotovelos/joelhos, rosto/cabelo, roupa/equipamento e animação procedural de respiração, marcha, mira, recuo e reação. Flash de disparo, partículas de sangue/impacto e núcleo do chefe com feedback visual de vulnerabilidade.
- Perfis **Baixo / Médio / Alto** controlam resolução, sombras, pós e poeira. Não é uma garantia de FPS em hardware desconhecido.

## Conteúdo preservado

Seis salas, portas cinematográficas bidirecionais e estado persistente; pistola de 12 tiros com reserva finita; três E01 com crítico craniano de 8%, dano de cabeça 1,8×, integridade de cada perna e rastejo funcional; lanterna/baterias/exposição/atordoamento; saúde e kits; documentos; inventário simplificado; mapa; relógio 03:15, chave e fusível; gravador com save/load versionado; chefe B01 adaptado com 560 HP, ataques anunciados, núcleo vulnerável e trava elétrica recarregável que evita softlock por falta de balas. Conclusão curta e atalho após vencer.

Os saves **v1 da 0.1.0 permanecem compatíveis**. O modo de câmera e as opções ficam em `limiar-preferences-v1`, não substituem o slot `limiar-save-v1`. Armazenamento é local a este navegador/domínio. O jogo não envia saves/telemetria a servidores.

## Controles

| Ação | Controle |
|---|---|
| Alternar ombro / tank | V ou Opções |
| Ombro: controlar visão | Clique na cena para capturar mouse; Esc libera/pausa |
| Ombro: mover / correr | WASD relativo à câmera / Shift |
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

## Rota curta

Leia o bilhete na recepção → corredor → posto de rádio à esquerda (salve no gravador) → arquivo (relógio **03:15**, obtenha a chave) → manutenção (pegue fusível na entrada e instale no fundo à direita) → átrio. Contorne colunas, fuja dos avisos e use a trava no fundo para expor/danificar o Porteiro. O circuito recarrega em 12 s. Após vencer, o atalho volta à recepção. Salve novamente no posto para preservar exploração posterior.

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
```

Os playthroughs usam somente comandos reais e diagnósticos somente leitura; não alteram HP, inimigos ou progressão. A automação de mira usa as setas acessíveis para alinhar a retícula física; a captura de mouse é exercitada separadamente pelo smoke curto. Evidências padrão: `/workspace/limiar-v020-smoke/shoulder`, `/workspace/limiar-v020-smoke/tank`. `GAME_URL` e `SMOKE_OUT` são configuráveis. Não confundir testes de unidade de 100 passagens com 100 passagens renderizadas em hardware real.

## Organização e autoria

`world.ts`: salas/grafo/colisões; `logic.ts`: dano, luz, save e transações; `controls.ts`: preferências e regras de controles; `aim.ts`: raycast e colisão de câmera; `actors.ts`: modelos/articulações; `art.ts`: texturas/geometria procedural; `post.ts`: pós leve; `render.ts`: cenas/câmeras/efeitos; `main.ts`: coordenação, UI e simulação; `audio.ts`: síntese WebAudio original.

Arte, modelos, placas, texturas, partículas, sons e história implementada são procedurais/originais. Não há assets/personagens/sons/cenários de Resident Evil nem pacotes de licença incerta. Three.js e ferramentas mantêm suas licenças próprias. O GDD fornecido pelo usuário não recebe aqui uma licença de terceiros.

## Limitações

- São seis salas, um arquétipo comum e B01 simplificado; não são 8 capítulos, 64 salas, 18 arquétipos ou 7 chefes completos. Sem R-18, destruição de cenário, campanha posterior ou finais ramificados.
- Modelos continuam estilizados low-poly/procedurais, sem escultura, animações capturadas, IK ou ragdolls. Hitboxes aproximam a anatomia; não são malhas anatômicas perfeitas. Contato do personagem ainda usa colisão 2D e navegação simples.
- Colisão de câmera testa o boom e margem, não uma cápsula física completa. Em cantos muito apertados pode aproximar/ocultar Helena. O tank oculta teto e paredes próximas intencionalmente.
- Pós é um glow econômico de cinco amostras, não bloom multi-mip/HDR cinematográfico, SSAO, SSR ou iluminação global. Sombras/cookie/bump são desligados no Baixo (texturas de cor permanecem). Queda real de contexto WebGL e hardware fraco ainda precisam de QA adicional.
- Sem gamepad, remapeamento completo, inventário por grade, baú, outras armas, faca ou esquiva. R-18 não foi acrescentado nesta atualização gráfica.
- Salas são procedurais e suas definições cabem no bundle inicial; sem streaming remoto de capítulos, PWA/service worker ou garantia offline.
- Performance e matrizes completas do GDD não estão certificadas. O benchmark SwiftShader teve custo maior que a 0.1.0, sobretudo no Médio; o Baixo mitiga esse custo. SwiftShader não representa GPU real. Consulte medições e escopo efetivamente testado em `docs/QA.md`.
