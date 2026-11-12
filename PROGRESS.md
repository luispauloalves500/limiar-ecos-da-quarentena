# 0.6.0 progresso
C1: 0.5 publicada/verificada (release.json). node_modules tinha sumido: npm ci + chromium reinstalado (mesma 158.0.8127.18). Baseline exata 9c68c5e em /workspace/limiar-v060-baseline (preview 4175). scripts/room-bench.mjs criado (save fixture v1 por sala, inimigos mortos, câmera parada, 3 perfis, hook WebGL de textura). Commit local wip.
C2: src/locomotion.ts (funções puras: ramp, turnToward, strideScale, nativeSpeed, moveBlend, lean, hitReaction, breath, telegraph, gaitVariation, groundLift).

## C3 — 18:41 (UTC-3) wip animações + experimentos de custo
- Helena: stride sync medido (src/stride.ts), backpedal/strafe com quadril, lean, respiração, reação direcional, recuo 2 mãos, foot IK chão plano, corpo morto não afunda; rampa de aceleração em main.ts.
- Zumbis: stride sync, telegraph, gait por ID, hit por região, perceive, yaw limitado (turnToward), deathYaw/deathSpeed, clamp no chão.
- Bench A/B com "work" (readPixels 1px) — ab4: base 33–34 ms; merge completo +7 ms; arch sem merge +2 ms. Merge estático NÃO compensa no SwiftShader → investigar índices/tessellation; flags TEMP-EXP ainda no código.
## C4 — 19:00 (UTC-3): luz prática assada (sem PointLights práticas/porta), light probe Helena/zumbis, bakedGain flicker, 0.6.0 + meta. ab7/ab8: work ≈ base com 40–60% menos draws. Flags TEMP-EXP removidas; fica a configuração vencedora (arquitetura + bake completo + tessellation + luz assada).
## C5 — 19:12 (UTC-3): campanha ombro SMOKE PASS (hunch reduzido p/ não cobrir a cabeça).
## C6 — 19:31 (UTC-3): campanhas ombro/tank, quality/zombie/player/environment passam. Ajuste de mira na nota da recepção por causa da rampa.
## C7 — 10:35 (UTC-3): camadas de marcha visíveis na galeria QA (preview); scripts/pose-sheet.mjs.
## C8 — 10:36 (UTC-3): prettier nos módulos 0.6.
## C9 — publicação 0.6.0: folha de poses esconde o painel depois de trocar o clip; CHANGELOG/README/QA; lint/testes/build/smoke finais e push na main (mesmo fluxo das versões anteriores: Pages, sem tag/GitHub Release).
## C10 — 11:14 (UTC-3): medição final 3 perfis REPEAT=2 (144 pares). draws −41–44%; workMedian −2,0/−0,1/−1,5%. Campanha ombro final-shoulder PASS (final, 100 HP). Folhas de pose e pares antes/depois inspecionados. Docs atualizados com a tabela oficial. Aguardando tank em final-tank e bench de 6 zumbis vs baseline antes do squash/push.
