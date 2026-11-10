# Notas de implementação — protótipo 0.1

## Persistência

`GameState` é a fonte de verdade. Cada inimigo e item tem ID estável. Salas são reconstruídas a partir desse estado, nunca a partir da presença de um mesh. Cadáveres são visuais temporários e não bloqueiam a navegação; sair da sala libera seus recursos sem apagar a marca de morte.

O gravador aceita somente estados completos de gameplay na sala segura. `parseSave` valida versão, coordenadas navegáveis, HP, contadores e os inimigos esperados. `writeSave` primeiro serializa e valida; preserva a gravação anterior em um backup antes de substituir o slot principal. A UI informa falhas de armazenamento. Não existe migração de versões futuras ainda: uma versão incompatível é recusada sem sobrescrever o slot.

## Portas

O grafo contém doze conexões com duas extremidades cada. O spawn de chegada fica deslocado para o interior, distante do gatilho. Uma transação mantém a origem como estado autoritativo enquanto a cena de porta é desenhada. O input é limpo e bloqueado durante toda a passagem. O destino procedural é construído oculto, o spawn é validado, e só então a sala e a posição persistentes são alteradas. Erros recuperam a geometria da origem e liberam o controle; a lógica de rollback é coberta por teste com loader rejeitado.

Não há arquivos de salas baixados pela rede: todas as definições pequenas estão no bundle. O ponto de extensão assíncrono aceita um loader, mas não deve ser confundido com streaming de campanha implementado.

## Simulação e câmeras

O loop acumula tempo e executa `tick` a 60 Hz, com limite de recuperação para evitar espiral de atraso após travamento da aba. Menus pausam a simulação; trocar de aba pausa o gameplay. A animação visual usa delta de render, sem interpolação física completa. A telemetria local mede o delta real antes do limite de simulação.

As duas câmeras fixas de cada ambiente têm uma região de histerese em torno do centro e intervalo mínimo de 0,6 s entre cortes. `InputLatch` calcula o vetor relativo à câmera somente quando a combinação direcional muda, conservando movimento mundial no corte. Soltar a direção libera a trava.

## Visibilidade e combate

Movimento usa limites e retângulos de mobília, não um motor de física geral. Linha de visão de tiros e luz usa amostragem do segmento a cada ~15 cm contra esses mesmos retângulos. A assistência exige alvo no enquadramento, cone frontal e distância, mas não testa silhueta anatômica em pixels. A região é escolhida pelo jogador, e o mesmo evento aplica dano de HP uma única vez.

Cabeça de E01 recebe 1,8× e chance de crítico de 8% quando o dano normal não seria letal. Pernas recebem 0,8× em HP e contadores estruturais separados. Dois impactos na mesma perna incapacitam e convertem para rastejo sem amputação. Morte tem precedência absoluta sobre a conversão. A luz não aumenta a chance de crítico; pode aumentar dano estrutural da perna durante exposição.

O chefe não recebe crítico instantâneo nem perda funcional de membros. A adaptação da trava elétrica causa dano e expõe o núcleo independentemente de munição. É uma solução de protótipo contra softlock, não a mecânica final de colisão com catraca do GDD.

## Recursos e segurança

Geometrias, materiais e texturas Canvas de uma sala são descartados com `dispose` na saída. Recursos comuns (personagem, cenas de porta e luzes globais) permanecem. O conteúdo não baixa fontes, áudio ou imagens externos. Não são lidas credenciais, nem enviados saves ou telemetria a servidores. `window.limiar` fornece cópias de estado para diagnóstico; não expõe mutadores nem cheats.

## Próximos passos

1. Playtest humano para ajustar enquadramentos, acessibilidade, duração e economia.
2. Separar os controladores de UI/combate do coordenador `main.ts` conforme o conteúdo crescer.
3. Animações artísticas, raycast anatômico, baú e inventário por espaços.
4. Loader de pacotes reais com orçamentos, testes de contexto WebGL e falhas de rede.
5. Só então expandir arquétipos, R-18 e campanha, com as matrizes do GDD medidas em hardware definido.

# Atualização 0.2.0

A visão padrão agora é sobre o ombro. `controls.ts` separa preferências versionadas e funções puras de movimento/olhar. `aim.ts` resolve o raio central contra hitboxes físicas do ator e obstáculos, além de bloquear a linha do cano à superfície e encurtar o boom da câmera. O tank usa yaw corporal, independente de cortes; o antigo InputLatch permanece apenas como utilitário legado testado, não como o controle tank atual.

O save de gameplay continua v1 compatível. Opções ficam em chave própria e podem falhar por restrições de armazenamento sem impedir a sessão. `actors.ts`, `art.ts` e `post.ts` isolam arte e efeitos da coordenação. Texturas Canvas compartilhadas recebem marca de recurso persistente para não serem descartadas na troca de sala; geometrias e materiais específicos são liberados. Há apenas uma sombra dinâmica da lanterna nos perfis Médio/Alto, atualizada em intervalos controlados; o Baixo dispensa sombra/pós.

As salas são fechadas no ombro. O tank oculta teto e paredes próximas por cutaway, sem alterar o grafo, inimigos ou estado persistente. A câmera suavizada é revalidada contra paredes após interpolar; a proximidade extrema oculta Helena para evitar obstrução. A linha de luz considera também o cone tridimensional e obstáculos físicos.

# Atualização 0.3.0

O formato raiz continua `version:1`, com `contentVersion:3`. A leitura migra saves 0.1/0.2: adiciona os inimigos novos, converte documentos lidos em coletados e considera cadáveres legados já removidos. `deathAt` usa epoch de relógio real; `removed` sela a remoção. `updateCorpses` e `corpseOpacity` não dependem de sala, taxa de simulação ou corte de câmera. Em save novo, carregar depois dos cinco segundos remove imediatamente. Mudanças manuais grandes no relógio do sistema podem afetar este prazo.

`collect/isCollected` é a origem única para interação/render/inventário. A coleta descarta o grupo inteiro e a entrada do mapa de objetos, inclusive beacon. `roomDetails` usa instâncias para decoração repetida; a mobília principal continua nas colisões do mundo. E02/E04 compartilham o rig, mas têm stats e máquina de ataque próprios. O grafo agora tem 12 salas e duas seguras; B01 libera D07 e não encerra mais o jogo. A conclusão exige pressão liberada e Febril final neutralizado, então sela a transmissão no terminal de isolamento. R-18 é reservado ao capítulo 6 do GDD e não é simulado nesta expansão.

## Modelos recebidos na 0.3.0

`preloadZombie` carrega near/LOD uma vez; `preloadPlayer` carrega Helena uma vez. GLTFLoader usa MeshoptDecoder; SkeletonUtils.clone separa ossos/mixers por instância sem duplicar geometria ou imagens. Skeleton/hitboxes/props exclusivos são liberados na saída/morte; caches compartilhados só no pagehide sem bfcache. Eventos e estado de gameplay escolhem clips; os clips não deslocam a colisão (Hips XZ in-place).

Helena usa máscaras disjuntas de membros inferiores/superiores. Marcha/corrida/cautela podem coexistir com mira/recarga/lanterna, sem média indesejada de braços balançando com a pose de mira. Correções de pitch e yaw limitado são aplicadas sobre Spine2/Arm em seus referenciais Mixamo. Pistol/lanterna estão nas mãos, e muzzle/SpotLight usam posições desses ossos. Collider de navegação de Helena continua raio 0,3; tamanho do asset recebido é aproximadamente 1,84 m. A câmera já deslocada à direita mantém a personagem à esquerda da retícula.

Hitboxes dos inimigos são caixas invisíveis presas a Head, Spine2, UpLeg/Leg, selecionadas no LOD ativo. O mixer fora do frustum é pulado, mas a IA permanece simulada; volta ao enquadramento atualiza a pose antes do próximo tiro. O LOD é visual, nunca ressuscita/reinicia HP/estado. Templates, geometrias, texturas e materiais por perfil/variante são compartilhados. B01 permanece procedural.

As páginas `qa-zombies.html` e `qa-player.html` são galerias técnicas encenadas separadas, sem acesso ao save do jogo. Não devem ser confundidas com o playthrough real de `scripts/smoke.mjs`.

O apoio da mão esquerda da pistola foi refinado com um solver CCD executado apenas no bake dos keyframes próprios Aim/WalkAim/Fire, durante preload. Os quaternions resultantes viram tracks normais; não se roda IK por frame, não se desloca a arma/mão direita nem o collider, e não se altera os clips recebidos.


## Ambiente 0.4.0

`environment-logic.ts` mantém temas das 12 salas, densidade, reivindicação idempotente de eventos, integração amortecida e validação dos impactos/vidros no save v1. O novo campo opcional `ambience` migra saves anteriores para arrays vazios, sem apagar a progressão. Máximo de 16 marcas por sala e 12 vidros quebrados. Eventos usam flags com prefixo `ambient:`; a primeira execução é consumida no save. Sem servidor/telemetria.

`Environment` vive e é descartado junto à sala do `View`; compartilha geometria por instancing/merge dentro dela. Pontos são animados no vertex shader. Matriz estática não é recalculada por frame; rotores, objetos reativos e eventos optam explicitamente por movimento. Vidro é decoração penetrável ao primeiro tiro: não bloqueia navegação nem é um novo sistema balístico. Objetos reativos têm física 2D com limites/fricção, não colisões rígidas universais; posições não são salvas.

A mira de Helena no gameplay (não apenas na galeria) agora resolve mão direita/suporte com CCD curto e alinha +Z da pistola ao ponto do raycast central. A geometria da arma foi orientada nesse eixo. Colisão de câmera usa cinco sondas e margem de 34 cm; não substitui física volumétrica completa.

`Audio` cria três fontes posicionais da sala atual, panners HRTF/inverse distance, reverb sintético por categoria de sala e passos por superfície. Fontes/grafo anterior são interrompidos/desconectados ao trocar de sala. Sons de eventos são originais sintetizados, estilizados.
