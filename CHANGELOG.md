# Changelog

## 0.5.0
- Retira frases/etiquetas do mundo; preserva pistas em documentos, HUD, mapa e diário. Números pequenos nas portas e brilho de coleta próximo.
- Corrige câmera atrás de folhas fechadas (mundo preto), elapsed negativo de RAF na porta e fade prolongado por delta limitado, reforça luz mínima e espera opacidade zero nas capturas.
- Corrige QuickTurn involuntário em qualquer tecla e arma ocultada em interação/porta; baixo pronto e lanterna recebem CCD, crossfades e ritmo variável.
- Adiciona áudio procedural em camadas/reverb, recarga por etapas, grunhidos 3D, tensão musical, respiração/batimento e quatro volumes/legendas persistentes.
- Título 3D animado com chuva/silhueta, navegação por teclado e créditos; recuo leve e empurrão frontal com cooldown.
- Testes e QA real da campanha, poses, entradas legíveis e publicação em docs/QA.md.

## 0.4.0
- Corrige enquadramento/pose de mira no jogo real, orientação física da pistola, margem da câmera e evidência de spawn.
- Acrescenta movimento, fauna, props reativos, vidro quebrável, impactos persistentes e identidade ambiental às 12 salas.
- Eventos únicos por sala persistidos; áudio espacial/reverb/solos; densidade configurável por perfil.
- Instancing/merge, cache de transforms estáticos, animação GPU e throttling de mixers distantes. Comparação SwiftShader com seis GLBs: 64,51 → 59,81 ms/frame (−7,3%), sem garantia de FPS físico.
- Corrigida acumulação de pitch/IK em tracks constantes do mixer, com teste de 600 frames.
- Testes de migração/validação ambiental, idempotência, física leve, densidade e volume da câmera. QA real e limitações em docs/QA.md.

## 0.3.0
- Expansão de seis salas, E02/E04, segundo posto seguro, puzzle de pressão e final Porta 13.
- Modelos GLB fornecidos pelo usuário, animações adicionais e otimização/LODs.
- Corpos removidos em cinco segundos e coleta persistente com remoção imediata.

## 0.2.0
- Visão sobre o ombro padrão, tank secundário e materiais/iluminação procedural.
