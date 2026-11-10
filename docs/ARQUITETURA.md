# Notas de implementação — protótipo 0.1

## Persistência

`GameState` é a fonte de verdade. Cada inimigo e item tem ID estável. Salas são reconstruídas a partir desse estado, nunca a partir da presença de um mesh. Cadáveres são visuais temporários e não bloqueiam a navegação; sair da sala libera seus recursos sem apagar a marca de morte.

O gravador aceita somente estados completos de gameplay na sala segura. `parseSave` valida versão, coordenadas navegáveis, HP, contadores e os inimigos esperados. `writeSave` primeiro serializa e valida; preserva a gravação anterior em um backup antes de substituir o slot principal. A UI informa falhas de armazenamento. Não existe migração de versões futuras ainda: uma versão incompatível é recusada sem sobrescrever o slot.

## Portas

O grafo contém seis conexões com duas extremidades cada. O spawn de chegada fica deslocado para o interior, distante do gatilho. Uma transação mantém a origem como estado autoritativo enquanto a cena de porta é desenhada. O input é limpo e bloqueado durante toda a passagem. O destino procedural é construído oculto, o spawn é validado, e só então a sala e a posição persistentes são alteradas. Erros recuperam a geometria da origem e liberam o controle; a lógica de rollback é coberta por teste com loader rejeitado.

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
