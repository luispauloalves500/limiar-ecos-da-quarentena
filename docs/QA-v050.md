# QA — LIMIAR 0.5.0

## Método
Linux / Node 24, Chromium 158.0.8127.18, ANGLE SwiftShader, viewport 1280×800. Testes headless por GPU de software, não certificação de hardware físico. Histórico em [QA-v040.md](QA-v040.md). Comandos reais de teclado/mouse e diagnósticos somente leitura; nenhum teleporte, HP artificial ou flags de progressão criadas pelo bot.

## Gates
171 testes em oito arquivos, lint, TypeScript e build. Novos casos: fade por relógio real mesmo após stall, luz mínima nas 12 salas, meia-volta exclusiva de Z/tank, migração dos volumes/legendas, pistas preservadas, envelopes/canais de dez sons, defesa frontal sem dano/boss imune, título 3D e orçamento de chuva, ausência de frases desenhadas no mundo e variação determinística dos zumbis. O chunk Three/loader continua >500 KB; o aviso Vite não é ocultado.

## Causas e correções
- **Imagens quase pretas:** havia DOIS problemas, não só exposição. Mesmo após fade zero, a câmera podia ficar entre a parede externa e a folha da porta, olhando para o verso opaco e não iluminado da porta. As folhas/batentes agora participam da colisão do boom e do raycast. Regressão reproduz a entrada lateral do posto. Havia também capturas durante o fade de retorno. O delta da simulação limitado a 100 ms podia prolongá-lo depois de compilação/GPU stall. O fade agora termina por performance.now; a automação espera `transition=false` e `fade=0`, não apenas 400 ms. O piso de iluminação também foi reforçado para permitir lanterna vazia, sem mudar os pixels depois da captura.
- **Braço/arma:** interação escondia a pistola enquanto estendia a mão direita. A arma permanece na direita e a esquerda alcança o objeto. Há CCD curto de baixo pronto/lanterna; a mira continua apontando fisicamente para o alvo. Corrigida ainda uma chamada de QuickTurn fora do if: toda tecla acionava a animação. Crossfade 180 ms e velocidade de ciclo acompanham cautela/corrida/mira.
- **Relógio da porta:** o smoke encontrou outro limite real: o timestamp RAF pode anteceder performance.now do input, deixando elapsed negativo e desabilitando o incremento seguinte. O relógio agora usa performance.now com clamp >=0, e a resolução da passagem não depende do incremento do frame. Regressão unitária cobre timestamp anterior ao input.
- **Tab:** a primeira campanha 0.5 encontrou saída do foco ao fechar inventário, disparando auto-pausa. Fechamento agora previne Tab nativo, mas opções continuam navegáveis. Smoke aguarda 250 ms e exige que continue jogando.
- **Menu:** inspeção visual encontrou contraste insuficiente no botão primário; corrigido e medido >4,5:1. O fundo é uma cena 3D separada, não screenshot/vídeo ou galeria de modelos.

## QA real
`smoke:published`: câmera/mira sustentada 4,5 s, convergência física da pistola >0,995, pointer lock, perfis, ambos os modos, inventário/foco e preferências.

`smoke:quality`: navegação ↑/↓/Enter, créditos, sliders dos quatro canais, legendas, arma na mão direita em poses de idle/lanterna/andar/correr/mira/tiro/recarga/interação e baixa vida; aproximação real a E01, cinco ataques até 25 HP, empurrão real e cura. Não modifica HP pelo console. Uma primeira tentativa do bot esperou fora do alcance de ativação da IA; o bot passou a se aproximar normalmente, sem alterar a IA.

`smoke:environment`: passos empurram lixo, tiro rompe vidro/deixa impacto, evento do telefone único e densidade/vidro nos dois modos. A campanha verifica save/load e reentrada do vidro/impacto.

**Campanhas novas de ombro E tank PASS:** 12 salas, final com 100 HP (cura consumida), save/load real de retorno ao posto, zero erros JS/warnings/HTTP. Todas as travessias fotografadas têm fade zero, e os únicos labels 3D restantes são numéricos. [Resumo](campaign-qa-v050.json).

Resultados reais: [campanha](campaign-qa-v050.json), [brilho](brightness-v050.json), [18 poses](poses-qa-v050.json) e [capturas inspecionadas](screenshots/v050/README.md). Smoke quality/environment/UI passou com zero erros/warnings/HTTP. Imagens originais em `/workspace/limiar-v050-smoke/`; sem ajuste de brilho posterior. A média é o RGB sRGB médio 0–255 (também calculamos média da região sem HUD). Pass da fotografia exige 12 salas, fade observado zero, média geral >7 e cena >5, além de inspeção visual.

## Áudio e orçamento
Áudio próprio sintetizado: camadas de ruído filtrado/osciladores, transientes, corpos/caudas, quatro barramentos, limitador e reverb aproximado. Três fontes de ambiente + três notas por sala; temporários param e desconectam, grafo anterior é liberado na troca. Tensão segue proximidade; postos usam harmonia calma. Sem arquivo sonoro externo ou fala inteligível sintetizada. Headless verifica execução/grafo, não qualidade auditiva humana. Auditoria das dependências de produção: zero vulnerabilidades no comando `npm audit --omit=dev`.

Título usa geometria simples e 60/180 pontos de chuva por perfil; só a cena atual é renderizada. Remoção de placas reduz draws. Para comparação justa, a galeria de seis zumbis usa agora Z=4,5 em AMBAS as versões (0.4 arquivada e 0.5), longe da porta. O fixture antigo em Z=6 podia ficar atrás da folha, invalidando comparação visual. Só essa linha do cenário QA é igualada na cópia base; o código 0.4 de jogo/render/GLBs não muda. Main/renderer 0.5 mantiveram hashes idênticos ao playthrough após essa alteração exclusiva de QA. [Benchmark real](benchmark-v050.json): seis GLBs, Baixo/ombro, 3 s de aquecimento + 8 s por modelo, sequencial e sem browsers concorrentes: **80,47 → 75,97 ms/frame (−5,6%)**, draws **116 → 109**, 66.302 → 66.288 triângulos. Mediana 83,3 → 83,2 ms, p99 183,3 → 166,7 ms; frames >100 ms subiram 12/100 → 15/106. Procedural: 56,57 → 54,66 ms (−3,4%). É uma amostra curta e ruidosa; não prova estabilidade dos piores frames nem recuperação de uma regressão histórica de outro fixture. Galeria mede render/animação, não toda a simulação/áudio. Seis clones compartilham duas geometrias/quatro materiais, 12 skeletons (dois LODs/clone); teste confirma suspensão dos mixers fora do quadro e apenas dois requests de GLB. Não prometer FPS físico.

## Publicação
Um commit/push normal na main, com checkpoint local cedo e amend somente antes de publicar. Workflow oficial roda lint/tipos/testes/build. Depois do deploy, `verify:published` exige 0.5.0 e compara todos os hashes dos 12 recursos HTTP, inclusive os três GLBs. O smoke de UI volta a rodar no site público. SHA/run/deployment ficam em `/workspace/limiar-v050-smoke/release.json` e na entrega.

## Limitações explícitas
- Doze salas e a mesma expansão, não novos capítulos/R-18. Munição/cura não foram rebalanceadas arbitrariamente; a rota completa deve continuar demonstrável.
- Empurrão curto tem cooldown de 3 s, não stamina, rolamento ou física de ragdoll. Agarrão orienta participantes/limita movimento 0,5 s e permite empurrão, mas não QTE de mash ou sincronização de mocap.
- Não foram implementados arrombamento de portas fracas, navegação/IA entre salas, audição tática nova ou bando coordenado. Zumbis mantêm seus padrões anteriores com variação visual/sons.
- Crossfade e time scale não são uma blend tree contínua ou foot planting/IK dos pés. Pode haver deslizamento/clipping em extremos. Recarga não anima um carregador físico; mão não encaixa cada maçaneta. A arma pode ficar ocluída pelo corpo conforme o ângulo, mas não é ocultada/trocada de mão pelo código.
- Música é um tema tonal/drone procedural discreto, não trilha orquestral; grunhidos são estilizados, não atores gravados. Audição/mixagem humana e hardware físico continuam pendentes.
- Física/vidro/volumetria continuam aproximados conforme QA anterior. Sem gamepad, inventário Tetris ou baú. Licença original dos modelos fornecidos não foi verificada; créditos mantidos.
