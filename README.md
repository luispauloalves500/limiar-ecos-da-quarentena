# LIMIAR: Ecos da Quarentena

**Protótipo jogável 0.1.0** de terror e sobrevivência original, inspirado no GDD v1.6 fornecido pelo autor. Helena Duarte procura o irmão Caio no hospital fictício de Santa Avelina, onde o composto A-13 alterou os pacientes.

[Jogar no navegador](https://luispauloalves500.github.io/limiar-ecos-da-quarentena/) · [Documento de concepção](docs/GDD-LIMIAR-v1.6.md)

> Esta entrega é uma **fatia vertical curta e experimental**, não o jogo completo de 8–12 horas. O GDD descreve a visão futura e não uma lista de recursos já entregues. Desktop com teclado/mouse e WebGL 2. Não há rastreamento, contas, compras ou servidor de jogo.

## O que funciona

- Seis salas interligadas: recepção, corredor leste, posto de rádio, arquivo clínico, sala do gerador e átrio das catracas; rota principal, retorno e atalho final.
- Duas câmeras fixas por sala, com retenção do vetor mundial enquanto a mesma direção fica pressionada. Piso, obstáculos e portas delimitam o percurso.
- Portas 3D em uma cena cinematográfica separada, transição bidirecional transacional, bloqueio de input, proteção na chegada e preservação de itens, estado de inimigos e puzzle.
- Helena low-poly animada proceduralmente, pistola 9 mm com carregador de 12, munição finita, recarga, mira assistida e seleção de cabeça/tronco/perna esquerda.
- Três instâncias de E01, com telegráfico, perseguição com navegação em grade, reação, morte, crítico craniano de 8%, dano de cabeça 1,8×, integridade separada de pernas e rastejo por incapacidade funcional. A pistola não amputa pernas.
- Cadáveres ficam visíveis até a saída; os meshes são descartados ao trocar de sala e os mortos não reaparecem. Não há loot de cadáver nem coleta duplicada.
- Lanterna de exploração/foco, consumo de bateria por tempo, baterias coletáveis, exposição, lentidão e atordoamento com cooldown. Luz e tiros são barrados pelos mesmos obstáculos lógicos.
- Saúde, kits médicos, inventário simplificado e documentos legíveis em português, mapa, pausa, derrota e carregamento.
- P01 simplificado: relógio 03:15, chave de manutenção, fusível e restauração da energia.
- **B01 simplificado**, com 560 HP, golpe de área, investida anunciada, maior agressividade na segunda fase e armadura vulnerável temporariamente pela trava elétrica. O circuito recarregável também causa dano: não é obrigatório ter munição para concluir.
- Final curto da fatia vertical, continuação da exploração e liberação do atalho.
- Gravação manual ilimitada no posto de rádio usando localStorage; schema v1 validado e backup do slot anterior. Áudio sintetizado com WebAudio, silenciável. Resolução de renderização alternável na pausa.
- Simulação em passo fixo de 60 Hz; diagnósticos locais somente leitura em `window.limiar` para reprodução de testes.

## Controles

| Ação | Tecla |
|---|---|
| Mover / correr | WASD / Shift |
| Interagir / guardar documento | E |
| Mirar | Segurar botão direito ou J |
| Disparar | Botão esquerdo ou K, mirando |
| Região: cabeça / tronco / perna | 1 / 2 / 3 |
| Alternar alvo | T |
| Recarregar pistola | R |
| Lanterna / foco intenso | F / segurar Q mirando |
| Usar bateria / kit médico | B / H |
| Inventário / mapa / pausa | Tab / M / Esc |

A movimentação é relativa à câmera: **solte a direção após um corte para recalcular o referencial**. A mira é assistida por cone, distância e visibilidade lógica; ela não exige precisão pixel a pixel. Para mirar uma ameaça, primeiro vire Helena na direção dela. Disparos sem alvo gastam munição. Durante uma porta, o jogo não recebe comandos de combate, menus ou interação.

## Percurso

1. Leia o bilhete e recolha munição na recepção.
2. Cruze para o corredor e visite o posto de rádio à esquerda. Salve no gravador.
3. No arquivo, ajuste o relógio para **03:15** e obtenha a chave.
4. Vá à manutenção pelo fundo do corredor. Pegue o fusível na entrada e instale no painel no fundo à direita.
5. Entre no átrio. Contorne as colunas, afaste-se dos avisos de ataque e use a trava elétrica no fundo da sala. A janela de núcleo aberto dura quatro segundos; o circuito recarrega em 12 segundos.
6. Derrote o Porteiro. O atalho retorna à recepção. Para preservar o progresso após explorar, volte ao gravador.

## Executar e validar

Node.js 24 recomendado. Dependências fixadas em `package-lock.json`.

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run preview -- --port 4173
```

Abra `http://localhost:4173/limiar-ecos-da-quarentena/` para a build. O caminho-base de Vite corresponde ao repositório Pages; altere `vite.config.ts` se renomear o projeto.

Smoke de navegador (em outro terminal, com preview ativo):

```sh
npx playwright install chromium
npm run smoke
npm run smoke:published # validação curta de mouse, corrida e menus
# Opcional: GAME_URL=https://... SMOKE_OUT=/caminho/evidencias npm run smoke
```

O smoke utiliza apenas teclado e interface do jogo, consulta diagnósticos somente leitura e salva screenshots e relatório em `/workspace/limiar-smoke` por padrão. Consulte [QA](docs/QA.md) para resultados e limitações reais. O workflow oficial de Pages valida lint, tipos, testes e build antes de publicar; o smoke local não está incluído na CI.

## Estrutura e autoria dos recursos

- `src/world.ts`: salas, grafo bidirecional, objetos, documentos e colisões.
- `src/logic.ts`: estado, dano localizado, bateria/exposição, save e transações de portas.
- `src/render.ts`: cenas Three.js, personagens, cenários, sinais e porta cinematográfica.
- `src/main.ts`: simulação, controles, HUD, menus e progressão.
- `src/audio.ts`: osciladores WebAudio originais.
- `tests/logic.test.ts`: testes de regras e persistência.

Toda a arte é geometria procedural, materiais e placas Canvas originais; o áudio é sintetizado em código. Não são usados modelos, sons, personagens, cenários ou marcas de Resident Evil, nem downloads de assets com licença incerta. Three.js (MIT) e ferramentas têm suas próprias licenças de dependência. Não é concedida aqui uma licença de terceiros para o GDD fornecido pelo usuário.

## Ainda não implementado / limites importantes

- Não representa M2 completo: são **6 salas, 1 arquétipo comum e um chefe simplificado**, não 8 salas/3 arquétipos/60 minutos.
- Sem os demais capítulos, 64 salas, 18 arquétipos, 7 chefes completos, finais ramificados, aliados ou diálogos dublados.
- Sem R-18, perseguição de três salas, cenário destrutível, lente A-13, outras armas, faca, esquiva, gamepad, controle tanque ou remapeamento.
- Inventário é por contadores e flags, sem grade de oito espaços, baú compartilhado ou combinação de itens.
- Dano localizado por região assistida e linha de visão 2D, **não raycast anatômico pixel a pixel**, física avançada, IK ou animações artísticas finais.
- Portas têm modelo cinematográfico e transação assíncrona reais, mas as seis definições de sala estão no bundle inicial. Geometria é gerada/descarregada por sala: **não há streaming remoto de capítulos ou scheduler de VRAM**.
- Sem PWA/service worker ou garantia offline. Save restrito a este navegador/domínio; limpar dados do site apaga a gravação. Sem importação/exportação ou recuperação de backup na UI.
- O B01 adapta o GDD: a trava elétrica pode causar dano independentemente de colisão prévia e serve de proteção contra softlock por falta de munição. Não implementa todos os quatro padrões/duas fases artísticas da especificação.
- Não há certificação das matrizes completas PERF/FLASH/CHASE/HEAD/LEG do GDD nem teste de gamepad/mobile. Desempenho em Chromium por software não garante FPS em outros dispositivos. Há um aviso de bundle acima de 500 kB no build (Three.js incluído).
