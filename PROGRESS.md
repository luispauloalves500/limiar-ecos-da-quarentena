# 0.6.0 progresso
C1: 0.5 publicada/verificada (release.json). node_modules tinha sumido: npm ci + chromium reinstalado (mesma 158.0.8127.18). Baseline exata 9c68c5e em /workspace/limiar-v060-baseline (preview 4175). scripts/room-bench.mjs criado (save fixture v1 por sala, inimigos mortos, câmera parada, 3 perfis, hook WebGL de textura). Commit local wip.
C2: src/locomotion.ts (funções puras: ramp, turnToward, strideScale, nativeSpeed, moveBlend, lean, hitReaction, breath, telegraph, gaitVariation, groundLift).

## C3 — 18:41 (UTC-3) wip animações + experimentos de custo
- Helena: stride sync medido (src/stride.ts), backpedal/strafe com quadril, lean, respiração, reação direcional, recuo 2 mãos, foot IK chão plano, corpo morto não afunda; rampa de aceleração em main.ts.
- Zumbis: stride sync, telegraph, gait por ID, hit por região, perceive, yaw limitado (turnToward), deathYaw/deathSpeed, clamp no chão.
- Bench A/B com "work" (readPixels 1px) — ab4: base 33–34 ms; merge completo +7 ms; arch sem merge +2 ms. Merge estático NÃO compensa no SwiftShader → investigar índices/tessellation; flags TEMP-EXP ainda no código.
