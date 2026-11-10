# Modelos, animações e orçamento — 0.3.0

## Proveniência

Os dois GLBs foram enviados pelo usuário. **Modelo/texturas/rig e clips recebidos não são de nossa autoria.** Créditos e ressalva sobre licença original em [CREDITS.md](CREDITS.md). O arquivo original não é distribuído junto, somente os resultados otimizados. Dados exatos, hashes e imagens em [asset-optimization-v030.json](asset-optimization-v030.json). MB abaixo são decimais; o zumbi original tem aproximadamente 9,09 MiB.

| Modelo | Bytes GLB | Triângulos | Vértices | Juntas / influências máximas | Texturas |
|---|---:|---:|---:|---|---|
| Zumbi recebido | 9.529.864 | 104.176 | 60.255 | 66 / 4 | 3 JPEG 2048² |
| Zumbi próximo | 461.476 | 15.626 | 12.802 | 66 / 4 | 3 WebP 1024² |
| Zumbi LOD distante | 243.784 | 4.684 | 4.644 | 66 / 4 | 3 WebP 512² |
| Player recebida | 2.969.100 | 10.319 | 17.623 | 66 / 4 | 3 JPEG 1024² |
| Player otimizada | 606.528 | 10.185 | 17.511 | 66 / 4 | cor WebP 1024²; normal/metal-rough WebP 512² |

- Zumbi próximo: **95,2% menos bytes**, 85% menos triângulos. Mesmo incluindo os dois LODs, 705.260 bytes representam redução de **92,6%** frente ao único original. Nenhuma duplicação do original de 9,5 MB no bundle.
- Helena: **79,6% menos bytes**. A malha já era pequena; bordas UV foram preservadas e a simplificação conservadora reduziu apenas 1,3% dos triângulos. Não se afirma que a redução nominal de 20% do comando foi atingida. Não há LOD de Helena: é uma única personagem próxima da câmera, com ~10 mil triângulos.
- Cada corpo tem uma primitive/material: **1 draw call de cor por zumbi opaco** (tanto original quanto otimizado), não 66 por ter 66 ossos. E02 soma o gorro procedural (+1); aviso de ataque soma o círculo (+1). Sombras podem adicionar passagens no Alto. Pistola/lanterna de Helena somam quatro meshes ao corpo (cinco no total com ambos visíveis). A otimização de bytes não significa redução proporcional de draw calls ou VRAM.
- WebP é compressão de transmissão, **não** textura comprimida em GPU como KTX2. A memória descomprimida permanece relevante. Meshopt comprime buffers e o decoder está no bundle local, sem CDN.

## Reprodução da otimização

Ferramenta usada: `@gltf-transform/cli@4.5.1` (meshoptimizer e sharp). Exemplos, com o original fora do repositório:

```sh
npx --yes @gltf-transform/cli@4.5.1 optimize /caminho/zumbi-base.glb src/assets/zumbi-base.glb \
  --compress meshopt --flatten false --join false --instance false --palette false \
  --simplify-ratio 0.15 --simplify-error 0.001 --simplify-lock-border true \
  --texture-compress webp --texture-size 1024
# LOD: mesmo comando, ratio 0.045, error 0.003, texture-size 512.
```

Helena: foram filtrados do JSON glTF os seis clips não usados; imagens foram redimensionadas com Pillow/Lanczos (cor 1024; normal/metal-rough 512) e convertidas em WebP qualidade 85/método 6 antes do optimize. O optimize final usou meshopt, flatten/join/instance/palette false, ratio 0.8, error 0.0005, lock-border true. O prune elimina buffers/keys sem referência. A altura nativa (~1,84 m) foi preservada, compatível com collider de 0,3 m e câmera atual. Não houve acesso a Blender comercial nem serviço externo de animação.

## Animações

### Zumbi

Walking/Running do arquivo, convertidos em in-place. Onze clips adicionais gerados no código: Idle cambaleante, AttackBite, HitTorso, HitHead, LightStun, LegFall, Crawl, CrawlAttack, Death, DeathHead e Tremor aditivo. Mixers próprios e crossfades; cabeça crítica escala o osso Head e gera partículas. Pernas levam à queda/rastejo; a hitbox acompanha o osso, não fica no lugar da postura em pé. É aproximação por caixas, não interseção de cada triângulo da pele. Morte normal e morte por cabeça têm clips distintos. Todos, inclusive B01 e rastejadores, somem em cinco segundos reais.

### Helena

Walking, Running e Sneaky_Walk_inplace recebidos. O apoio da mão esquerda na pistola é resolvido por CCD apenas durante o bake dos keyframes de Aim/WalkAim/Fire, preservando a arma/mão direita e o collider. Não há IK por frame ou custo desse solver durante gameplay.

Quatorze clips próprios em keyframes: PlayerIdle, Aim, WalkAim, Fire, Reload, Flashlight, Hit, InjuredWalk, Grabbed, BreakFree, QuickTurn, Interact, Door e PlayerDeath. As máscaras não sobrepõem as tracks superiores/inferiores; andar/correr e mirar/recarregar são combinados. Hips XZ são travados para não mover o collider por animação. `compactRigClips` remove somente posição/escala constantes que correspondem ao bind dentro de 1 µm; mantém Hips e offsets reais (UpLeg do zumbi difere ~1 cm). Quaternions são preservados. Isso reduz bindings do mixer sem alterar poses ou remover ossos. No zumbi importado, Walking/Running caem de 192 para 127 tracks; clips próprios de 198 para 129. Posições constantes que não correspondem ao bind importado são deliberadamente mantidas, não removidas por uma meta arbitrária de contagem. Mira aplica pitch e yaw limitado sobre Spine2/Arm no referencial Mixamo. Pistola e lanterna procedurais ficam nas mãos; flash/obstrução do tiro e SpotLight usam essas posições.

Não há sistema novo de golpe corpo a corpo: Attack/combos/arco/escalada/Run_and_Shoot foram descartados. Agarrão/soltura são reações visuais, não QTE ou IK sincronizado com mordida. A recarga não manipula um carregador físico. Porta tem gesto na transição, não mão resolvida sobre cada maçaneta. Não há rig facial, mocap adicional, ragdoll nem retarget universal; usamos o mesmo padrão de nomes/pose do rig recebido e utilitários in-place/BonePose compartilhados.

## Cache, LOD, culling e descarte

GLTFLoader + MeshoptDecoder carregam os dois zumbis uma vez e Helena uma vez, com tela de espera. Falha mostra aviso de fallback procedural; não há tela silenciosamente vazia. SkeletonUtils.clone mantém skeleton/mixer independentes e compartilha geometria/imagens; materiais são cacheados por LOD/variante/perfil. No Baixo, cor é 512² e normal/metal-rough são desligados; cor 1024² próxima no Médio/Alto.

LOD do zumbi usa histerese: Baixo distante >5,2 m / próximo <4; Médio >8 / <6; Alto >11 / <8. Só um rig fica visível e só seu mixer é atualizado. Fora do frustum o mixer é pulado; além de 9 m é limitado a ~12 Hz. A IA/estado continuam ativos, sem teleporte/ressurreição. Sombra do zumbi somente no Alto e perto (<7 m). Helena tem um mixer com duas camadas, sombra somente no Alto.

Cada instância mantém dois rigs em CPU para troca rápida; isso não equivale a renderizar os dois. A sala de seis verificou 12 skeletons independentes, **duas geometrias e dois materiais compartilhados**, com somente seis meshes de corpo visíveis. A morte/sair da sala libera skeleton/hitboxes/props/materiais de fade exclusivos. Cache compartilhado vive até pagehide sem bfcache, pois descartá-lo na primeira morte quebraria os outros clones.

## Benchmark comparativo (não certificação de FPS)

`npm run smoke:zombie`, Chromium 158 / SwiftShader, viewport 1280×800 (buffer Baixo 896×560), Baixo, ombro, mesma galeria de isolamento com seis inimigos, 3 s de aquecimento + 8 s amostrados por caso. Comparação isolada do boneco procedural anterior com o GLB otimizado na mesma sala/renderizador; a Helena procedural é constante nessa galeria. **Não é comparação integral das versões publicadas 0.2 e 0.3**, nem benchmark do original de 104 mil triângulos, nem GPU física.

| Seis inimigos | Média ms/frame | Mediana | p99 | Draws da cena | Triângulos da cena |
|---|---:|---:|---:|---:|---:|
| Procedural anterior | 51,08 | 50,0 | 100,1 | 230 | 16.258 |
| GLB otimizado, LOD distante | 55,78 | 50,0 | 116,7 | 104 | 32.542 |

Média **9,2% mais lenta** nessa amostra de software, apesar de 54,8% menos draws. Não escondemos a regressão: deformação skeletal/mixers e mais triângulos custam mais que o boneco anterior. LOD/culling/texturas e perfil Baixo tornam o modelo recebido muito mais barato que distribuí-lo cru; isso não transforma SwiftShader em 60 FPS. Medição sequencial final é registrada em `docs/zombie-benchmark-v030.json`; os valores devem ser lidos com a variabilidade de uma amostra curta. Hardware real, várias repetições e GPU fraca continuam pendentes.

Galerias são **encenadas**: `/qa-zombies.html` e `/qa-player.html`. Seus screenshots validam poses e compartilhar recursos; a conclusão da campanha é testada separadamente por inputs reais em `scripts/smoke.mjs`, sem mutadores do estado.
