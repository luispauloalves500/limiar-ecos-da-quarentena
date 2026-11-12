# QA — LIMIAR 0.6.0

## Método
Linux / Node 24.22.1, Chromium 158.0.8127.18, ANGLE SwiftShader, viewport 1280×800. Testes headless por GPU de software, não certificação de hardware físico. Histórico em [QA-v050.md](QA-v050.md). Comandos reais de teclado/mouse e diagnósticos somente leitura; nenhum teleporte, HP artificial ou flags de progressão criadas pelo bot.

## Gates
184 testes em dez arquivos (inclui locomoção e cenário da 0.6), lint, TypeScript e build. Novos casos: rampa/giro/passada, variação de marcha com postura contida, bake sem flags `TEMP-EXP`, luz prática fora da cena, light probe e merge por material com casters separados. O chunk Three/loader continua >500 KB; o aviso Vite não é ocultado.

## Causas e decisões
- **Custo da cena:** PointLights práticas por porta e um fill preso à câmera competiam com a lanterna. Experimentos A/B (`?exp=`) mediram merge, tessellation e bake. Merge estático sozinho não compensou no SwiftShader; a combinação vencedora (arquitetura + bake completo + tessellation + luz assada, sem fill) ficou permanente e as flags foram removidas. Luzes práticas não entram na cena: o flicker dirige `bakedGain` e os atores leem um probe. Casters e não-casters ficam em malhas distintas para a passagem de sombra da lanterna.
- **Animações no chão:** Helena e zumbis ganharam sincronia de passada, camadas de postura e clamp para o corpo não afundar. A corcunda/inclinação dos zumbis foi reduzida depois que a campanha de ombro mostrou a cabeça coberta. O IK dos pés vale só em chão plano.
- **Rampa de aceleração:** o smoke de qualidade da 0.5 alcançava a nota da recepção em (−3, 4) por inércia. Com a rampa, o ponto caiu fora do raio de 1,8 m; a automação passou a mirar (−3, 3,2). A interação em si não mudou.
- **QA de poses:** as camadas de postura (antes só no jogo) também rodam no modo preview, para a folha de poses mostrar o mesmo hunch/lean do playthrough. O gerador esconde o painel *depois* de trocar o clip, porque um `<select>` oculto não aceita `selectOption`.
- **Distância do Febril:** a automação da campanha parava em z=4,5 na lavanderia/isolamento, quase em cima do E04. Numa tentativa a Helena morreu no meio da mira. O smoke agora para em z=5,5 e cura se o HP cair durante a mira. Não é mudança de jogo.

## QA real
`smoke` (ombro e tank): 12 salas, final com 100 HP e a flag `final`, save/load real de retorno ao posto, zero erros JS/warnings/HTTP. Fotografias de porta com fade zero. Mínimo de brilho das 12 entradas: média 13,94 e cena 14,61 (0–255).

`smoke:quality`: navegação de menu, créditos, 18 poses, aproximação real e combate sem alterar HP pelo console.

`smoke:environment`: passos empurram lixo, tiro rompe vidro/deixa impacto, evento do telefone único e densidade nos dois modos, com persistência.

`smoke:player` / `smoke:zombie` / `smoke:poses`: páginas de QA e folha de poses de Helena e zumbis.

Resultados: [campanha](campaign-qa-v060.json), [room-bench](benchmark-v060.json) e [capturas](screenshots/v060/README.md). Imagens originais em `/workspace/limiar-v060-smoke/`. Sem ajuste de brilho posterior.

## Orçamento
Room-bench intercalado (`scripts/room-bench.mjs`) contra a baseline exata 9c68c5e em `/workspace/limiar-v060-baseline` (:4175). 12 salas, câmera de ombro parada, inimigos mortos, perfis Baixo/Médio/Alto, REPEAT=2, 1,5 s de aquecimento + 4 s de amostra. `work*` é o tempo JS+GPU por quadro (readPixels de 1 px), independente do vsync. Chromium 158.0.8127.18, ANGLE SwiftShader, viewport 1280×800. Dados em [benchmark-v060.json](benchmark-v060.json).

| Perfil | workMedian 0.5→0.6 | workMean | Draws | Triângulos | Entrada |
|---|---|---|---|---|---|
| Baixo | 72,2 → 70,8 ms (−2,0%) | 49,7 → 52,6 ms (+5,9%)* | 107 → 63 (−41%) | 14,4k → 19,1k (+33%) | 3596 → 3512 ms (−2%) |
| Médio | 233,0 → 232,7 ms (−0,1%) | 141,6 → 138,7 ms (−2,0%) | 161 → 91 (−44%) | 16,0k → 24,8k (+55%) | 5515 → 5193 ms (−6%) |
| Alto | 305,0 → 300,5 ms (−1,5%) | 185,6 → 187,7 ms (+1,2%) | 162 → 91 (−44%) | 26,2k → 35,0k (+34%) | 6386 → 6336 ms (−1%) |

\* Uma campanha ombro concorrente (load médio ~15) começou no meio do perfil Baixo e inflou as caudas do workMean; workMedian, menos sensível a isso, ficou melhor nos três perfis. Textura estimada idêntica por sala (~2,4–3,2 MB). Transferência HTTP 1505 → 1511 KB. GLBs inalterados; JS de render 800.671 → 818.952 bytes. Luzes dinâmicas caem para 3 (hemisfério, lanterna, flash): práticas e portas vão no bake. Amostra em GPU de software, não garantia de FPS físico, nem o fixture de galeria de seis GLBs da 0.5. Auditoria de produção: `npm audit --omit=dev` — zero vulnerabilidades. Galeria de seis zumbis (mesmo fixture, sequencial, caixa relativamente ociosa): asset 74,4 → 72,3 ms (−2,8%), draws 109 → 79 (−28%), mediana 66,7 = 66,7, dois GLBs/quatro materiais/12 skeletons compartilhados como na 0.5; procedural 51,8 → 51,4 ms, draws 236 → 206.

## Publicação
Versões anteriores (0.1.0–0.5.0) não usaram tag Git nem GitHub Release: um commit/push normal na `main` dispara o workflow oficial (lint/tipos/testes/build) e o deploy no Pages. Depois do deploy, `verify:published` exige 0.6.0 e compara os hashes HTTP com o `dist` local. O smoke de UI volta a rodar no site público. SHA/run/deployment ficam em `/workspace/limiar-v060-smoke/release.json` e na entrega, não inventados no histórico do commit.

## Limitações explícitas
- Doze salas e a mesma expansão, não novos capítulos/R-18. Munição/cura não foram rebalanceadas arbitrariamente; a rota completa deve continuar demonstrável.
- Luz assada é por vértice, não GI/lightmap de textura/RT. Dinâmicos e atores não alimentam o bake; o probe é uma média aproximada da sala. Sem PointLights práticas na cena, reflexos e especular de lâmpada pontual somem.
- IK dos pés só em chão plano; não há blend tree contínua, plantio em desnível nem mocap novo. Pode haver deslizamento/clipping em extremos. Recarga não anima um carregador físico; mão não encaixa cada maçaneta.
- Empurrão curto tem cooldown de 3 s, não stamina, rolamento ou física de ragdoll. Agarrão orienta participantes/limita movimento 0,5 s e permite empurrão, mas não QTE de mash.
- Não foram implementados arrombamento de portas fracas, navegação/IA entre salas, audição tática nova ou bando coordenado.
- Música é um tema tonal/drone procedural discreto, não trilha orquestral; grunhidos são estilizados, não atores gravados. Audição/mixagem humana e hardware físico continuam pendentes.
- Física/vidro/volumetria continuam aproximados conforme QA anterior. Sem gamepad, inventário Tetris ou baú. Licença original dos modelos fornecidos não foi verificada; créditos mantidos.
