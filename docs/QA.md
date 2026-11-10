# QA — LIMIAR 0.3.0

## Escopo e ambiente

Validação em Linux, Node 24, Chromium headless 158.0.8127.18 / ANGLE SwiftShader, viewport 1280×800. Trata-se de GPU por software, não certificação de notebook/celular/GPU física. Interface e fluxo são desktop. Relatório histórico da atualização anterior: [QA-v020.md](QA-v020.md). O GDD inteiro não foi entregue/certificado.

## Gates automatizados

- `npm ci`, lint ESLint, TypeScript `--noEmit`, `npm test`, build de produção e audit.
- **131 testes em cinco arquivos**: lógica de combate/luz/save/portas, câmeras/controles/preferências/raycast, expansão e coleta/cadáver, clips/clone skeletal do zumbi e clips/máscaras de Helena.
- Cobertura inclui limites de 4,5/5 s, relógio real em menus/saves, remoção permanente de todos os tipos inclusive chefe/rastejo, migração dos saves anteriores, coletáveis de todas as categorias, acesso às salas novas e puzzle 3→1→2 com reset por erro.
- Arquitetura dos assets: clips válidos com tempos/valores finitos, in-place sem modificar os originais, SkeletonUtils com ossos independentes/geometria compartilhada, máscaras superiores/inferiores sem sobreposição, convergência do apoio esquerdo sem deslocar arma/collider, abaixar quadril na morte e voltar à mira após recarga.
- Aviso conhecido do Vite: chunk compartilhado Three.js/loader/decoder/render maior que 500 KB. Não foi ocultado elevando limite. `audit` sem vulnerabilidades no momento da execução final, não garantia permanente.

## Playthrough real (não galeria)

`GAME_MODE=shoulder npm run smoke` e `GAME_MODE=tank npm run smoke`. Usa somente teclado/mouse e cópias diagnósticas somente leitura: não define HP, itens, inimigos, flags ou posição. Bot de ombro alinha a retícula física pelas setas e só atira quando o raycast retorna a região desejada; tank usa a seleção regional projetada para esse modo. O bot usa sensibilidade 0,7 pelo menu e assistência desligada; confere o raycast antes/depois de olhar para não perder um alvo que já estava alinhado. Captura de mouse é exercitada separadamente pelo smoke de UI.

**PASSOU nos dois modos, em expedições novas completas:** ombro 359,2 s; tank 474,8 s. Ambos visitaram as 12 salas, concluíram isolamento com `flags.final=true` e 100 HP, depois recarregaram a gravação real no segundo posto. Zero erros JS, warnings ou HTTP em ambos. Resumo versionado: [campaign-qa-v030.json](campaign-qa-v030.json).

Rota exercitada: recepção/documento → corredor/E01 com queda em perna/rastejo/morte → rádio seguro/save → arquivo/relógio 03:15/chave → manutenção/fusível/energia → átrio/B01/trava → patamar → internação/E02 → enfermaria203/E02/pulseira → posto seguro/save/load → lavanderia/E04/pressão → isolamento/E04/terminal/final → troca V e recarregar o save do segundo posto. A abertura/cinemática de porta bloqueia input; ida/volta e reentrada são verificadas.

Antes/depois comprovados por estado **e** render: corpo ainda existe após morrer e não está no mapa de atores após cinco segundos; munição/bateria não somem junto. Documento, seu beacon e interação saem imediatamente, continuam no arquivo e não reaparecem após reentrada/save. B01 também é removido depois de cinco segundos, sem exceção de progressão. Novos itens/chaves/documentos seguem a mesma fonte de verdade.

Após o refinamento visual final da pegada de duas mãos, a campanha de ombro foi revalidada em duas etapas: expedição nova até o segundo gravador e retomada do **save genuíno, intocado** para lavanderia/isolamento/final. A retomada passou em 70,2 s, final com 68 HP e zero erros JS/warnings/HTTP, seguida de reload no posto. Nenhum HP, inventário ou flag foi fabricado. Tentativas do bot mirando a cabeça pequena do rastejador falharam; o teste final usa tiros legítimos no torso após derrubar a perna. Isso é limite da automação, não prova de playthrough fresco completo após esse último ajuste visual.

Saídas: `/workspace/limiar-v030-smoke/final-tank` (pass completo), `/workspace/limiar-v030-smoke/final-shoulder` (evidências e checkpoint, último report é tentativa falha de alinhamento do bot), `/workspace/limiar-v030-smoke/resumed-shoulder` (retomada final aprovada). O resumo versionado preserva os passes completos anteriores e distingue a retomada. Tentativas não são contadas como passes. Screenshots selecionados em [screenshots/v030](screenshots/v030/README.md).

## Galerias e modelo recebido

`npm run smoke:zombie`: ambos os modos, andando/correndo/atacando/rastejando/morrendo, todos os clips adicionais, remoção pós-morte, bone head hitbox, seis clones, LOD, geometrias/materiais compartilhados, somente duas requisições GLB e mixers parados fora do quadro. Zero erros/warnings de console na execução validada.

`npm run smoke:player`: ambos os modos, andando/mirando/atirando/recarregando, valida todos os 17 clips (3 recebidos +14 criados), 66 ossos, arma acompanhando mão, uma única requisição GLB, zero erros/warnings. As poses de tiro/recarga são amostradas em tempos definidos **somente na galeria**, para a imagem não perder um recoil de 0,22 s em SwiftShader. Não são screenshots alegadamente espontâneos da campanha; o jogo usa os mesmos clips sem amostragem forçada.

Evidências: `/workspace/limiar-v030-smoke/zombie/` e `/workspace/limiar-v030-smoke/player/`. Página da galeria de Helena foi revisada visualmente: corrigido um container canvas incorreto que podia passar sem erro JS mas produzir imagem vazia. Somente imagens regeneradas com cena visível são aceitas.

A amostra final isolada com seis zumbis teve 51,08 ms/frame procedural versus 55,78 ms/frame GLB (+9,2%), mediana 50 ms nos dois, e 230 → 104 draw calls. É resultado real de software, não certificação de FPS.

Medições completas antes/depois, res/formato de cada textura, triângulos/ossos/influências, draw calls e limites de autoria: [MODELOS.md](MODELOS.md), [JSON dos assets](asset-optimization-v030.json), [CREDITS.md](CREDITS.md). Comparação dos seis inimigos é isolada no mesmo ambiente, não comparação integral entre builds de campanhas diferentes. A regressão de frametime por skinning não é escondida nem convertida em promessa de FPS.

## UI e publicação

`npm run smoke:published` verifica versão 0.3.0, modelos prontos, mouse pointer lock e yaw, V nos dois sentidos, Z, C, mapa/inventário, opções/inversão/sensibilidade, três perfis, tiro, recarga real de Helena, caminhada cautelosa por input real e preferências após reload. O procedimento pós-push repete o smoke contra a URL pública depois de Actions/deployment concluídos. HTTP da página e todos os arquivos de produção (incluindo GLBs) deve ser comparado com o build local e o bundle deve conter 0.3.0. Push sozinho não é aceito como prova de publicação.

Este documento acompanha o commit antes do próprio deploy. O relatório de entrega externo informa URL/Actions/SHA e o resultado HTTP/browser pós-deploy, que não pode ser incluído retroativamente neste mesmo commit sem outro push.

## Correções e limites honestos

- O bot de QA inicialmente tentava um destino arredondado sobre a margem de uma lavadora; a rota de teste foi corrigida para o corredor central e a face norte. Não foram desligadas colisões ou reduzidos danos para passar.
- Painel de pressão foi afastado da porta e sai das interações após solucionar; antes interceptava E e impedia chegar ao novo final.
- E04 tem investida contínua anunciada, não teleporte instantâneo. Perna derrubada cancela corrida. E02 usa recuo curto antes do agarrão.
- Doze salas, três tipos comuns e B01 adaptado. Não há oito capítulos, R-18, B02 completo, 64 salas nem campanha de pediatria; o final é gancho.
- Modelos fornecidos são otimizados, mas autoria/licença original não foi verificada independentemente. Não são atribuídos como arte nossa nem como licença aberta.
- Keyframes estilizados: sem IK em runtime/facial/ragdoll (apoio da mão usa CCD no bake), mordida sincronizada/QTE ou carregador físico. Há gesto de abrir porta, não mão geométrica em cada maçaneta. Hitboxes ósseas são caixas aproximadas.
- Colisão/navegação de atores são 2D simples; decoração periférica repetida não tem toda colisão própria. Camera boom tem margem, não física volumétrica completa; pode ocultar Helena em cantos muito próximos.
- Salas são definições locais no bundle; só os modelos têm preload assíncrono. Sem streaming de capítulos, gamepad, mobile, PWA, inventário por grade, baú ou outras armas.
- Relógio do sistema adulterado manualmente pode afetar o timeout de cadáver. Não há servidor autoritativo/save em nuvem.
- Falha WebGL/context loss, baixa memória, acessibilidade completa, playtest humano prolongado e matriz de hardware real seguem pendentes. `high` é opção, não garantia de desempenho.
