# Créditos e proveniência

## Modelo de zumbi fornecido pelo usuário

O arquivo original `zumbi-base.glb` foi enviado pelo usuário para uso neste projeto. Metadados indicam exportação Blender/glTF 2.0, esqueleto SmartRigArmature com 66 juntas de nomenclatura `mixamorig`, três imagens JPEG e clips `Walking`/`Running`.

**Não reivindicamos autoria do modelo, malha, texturas, esqueleto nem dos dois clips recebidos.** O nome dos ossos não comprova por si só criador ou licença original. A origem/licença original não foi verificada independentemente; não foi atribuída aqui uma licença aberta ao arquivo. Os direitos dos respectivos titulares permanecem preservados. O usuário forneceu o material para inclusão no jogo/repositório solicitado.

Original: SHA-256 `1b064c6f105f0c7a914bd5c49df8f4a9df51d6f63112a26ef377d3d46105ac80`. O original de 9.529.864 bytes fica fora do repositório; somente as versões otimizadas são distribuídas. Dados exatos em [asset-optimization-v030.json](asset-optimization-v030.json).

## Trabalho criado para esta implementação

- Código Three.js/TypeScript, cenário/props/texturas ambientais procedurais, interface, partículas e síntese WebAudio.
- Dez clips adicionais em keyframes sobre o rig recebido: Idle, AttackBite, HitTorso, HitHead, LightStun, LegFall, Crawl, CrawlAttack, Death e DeathHead. Mais Tremor aditivo. Curvas e poses são geradas em `src/zombie-clips.ts`; usam a pose de referência do rig e não se apresentam como captura de movimento.
- Otimização, LOD, materiais compartilhados, clone de skeleton, mixers/crossfade, hitboxes anatômicas e integração ao combate. As variantes E02/E04 reaproveitam o modelo com tint/identificação, não são novos modelos esculpidos.
- B01 continua modelo procedural estilizado. A mordida é encenada por braços/cabeça, sem IK, animação facial ou novo rig de mandíbula.

## Dependências

Three.js (incluindo GLTFLoader, SkeletonUtils e MeshoptDecoder distribuídos em seus addons), Vite, TypeScript, Vitest, ESLint, Prettier e Playwright mantêm suas licenças próprias. Otimização executada com glTF Transform CLI 4.5.1/meshoptimizer e sharp. A ferramenta de otimização não vira dependência runtime.

O GDD e o nome/história fornecidos pelo usuário permanecem identificados como material de concepção do projeto; este documento não cria uma licença de terceiros sobre eles.

## Helena: modelo da player fornecido pelo usuário

`player.glb` também foi enviado pelo usuário: exportação Blender, uma malha skinned, 66 juntas SmartRigArmature/Mixamo e três JPEG. Modelo, texturas, rig e nove clips recebidos **não são de nossa autoria**; origem/licença original não foi verificada independentemente, e não se presume licença aberta. Do arquivo aproveitamos Walking, Running e Sneaky_Walk_inplace; Archery_Shot, Attack, Climb_Attempt_and_Fall, Double_Combo_Attack, Run_and_Shoot e Sneaky_Walk redundante foram removidos da distribuição. Não há novo golpe corpo a corpo no jogo.

Foram criados 14 clips em keyframes: idle, mira, andar mirando, tiro/recuo, recarga, lanterna, dano, marcha ferida, agarrada, soltura, meia-volta, interação, porta e morte. Código em `player-clips.ts`, camadas inferiores/superiores em `player.ts`. Não são mocap ou animação facial; o apoio de mão é ajustado com CCD no bake dos keyframes, na 0.3.0; desde 0.4.0, a mira adiciona CCD limitado em runtime; a recarga é gesto estilizado, sem carregador físico. Pistola e lanterna procedurais são presas às mãos.

## Atualização 0.5
Título 3D, chuva, síntese musical e efeitos WebAudio em camadas são procedurais e originais deste projeto. Não foram usados áudio CC0 ou outros arquivos de terceiros. Modelos enviados e seus créditos permanecem inalterados.

## Rastejador e Preceptora (0.9.0): modelos fornecidos pelo usuário

Dois GLBs enviados pelo usuário para o rastejador (E05) e para a Preceptora (B02): exportação com rig SmartRig de 69 juntas, uma malha skinned cada, três PNG 2048² cada, sem clips. **Modelo, texturas e rig não são de nossa autoria**; origem/licença original não foi verificada independentemente, e não se presume licença aberta. Originais fora do repositório: rastejador 16.183.396 bytes, SHA-256 `0d98e707bce948a7daea139e29a8f139f6f16b3aa371708cd14dbfb2a5f8c398`; Preceptora 11.874.432 bytes, SHA-256 `c16e14b26207ff39bc32df1dac1ea760e3d81cbf48417477dc19d5aaa6148a7c`. Distribuímos só as versões otimizadas (`src/assets/rastejador.glb`, `src/assets/preceptora.glb`).

Criado para esta implementação: animação procedural por osso do rastejador (`src/crawler-pose.ts`, `src/crawler.ts`), o retarget do rig procedural da Preceptora 0.8 para o esqueleto recebido, placas/núcleo/lençol/rim procedurais, hitboxes e o carregamento preguiçoso do Capítulo 2.

## Porta de aço (0.13.0): modelo fornecido pelo usuário

GLB enviado pelo usuário para as portas do jogo: exportação Blender 4.5 com rig automático SmartRig (10 ossos, sem clips), uma malha e um PNG 2048². **Modelo e textura não são de nossa autoria**; origem/licença original não foi verificada independentemente, e não se presume licença aberta. Original fora do repositório: 2.853.940 bytes, SHA-256 `0df142a739f8d61e3e890087e67b6c48bae1801d89205f1cf8176d416548fc86`. Distribuímos só a versão otimizada e dividida em batente/folha (`src/assets/porta.glb`, 98.496 bytes). Criado aqui: a divisão em batente e folha (`scripts/door-asset.mjs`), a colocação rente à parede, as luzes de tranca e o giro da folha na cinemática.
