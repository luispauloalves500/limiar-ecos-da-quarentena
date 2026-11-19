# Capturas 0.10.0 — câmera, animações e tronco dos zumbis

- [Ângulo do tronco, antes/depois](torso-angulo-antes-depois.png): ângulo quadril→peito de um zumbi Mixamo medido quadro a quadro (galeria `qa-zombies.html`) na 0.9.0 e na 0.10.0, em ociosa, depois de impactos, depois do bote e andando/virando. Na 0.9.0 o ângulo sobe até ~3,13 rad (meia-volta) parado e depois de golpes; na 0.10.0 fica em ≤0,29 rad. Andando e virando ficou igual.
- [Zumbi ao longo do tempo](zumbi-tronco-antes-depois.jpg): o mesmo zumbi ocioso aos 1, 4, 8 e 12 s. Na 0.9.0 o tronco dobra e torce; na 0.10.0 fica estável.
- [Tamanho do rastejador](rastejador-tamanho-antes-depois.jpg): rastejador ao lado da Helena com a escala da 0.9.0 (0,74) e da 0.10.0 (0,58), mesma câmera (`qa-rastejador.html?helena=1&scale=…`).
- [Passada do rastejador](rastejador-passada-antes-depois.jpg): rastejar de lado a cada 250 ms (pares diagonais na 0.9.0, quatro tempos na 0.10.0, mesma escala).
- [Preceptora](preceptora-brilho-antes-depois.jpg): mesma pose e câmera. Brilho médio (PIL) de perto 38,8 → 42,8 e na média 33,0 → 37,2.
- [Helena arrancando e parando](helena-arranque-parada-antes-depois.jpg): jogo real (gravação do abrigo, Baixa), segurando D e soltando; quadros a 100/250/450/900 ms do arranque e 80/250 ms depois de soltar. A 0.9.0 vira e sai em velocidade cheia no primeiro quadro; a 0.10.0 vira e acelera em rampa.
- [Câmera com rastejador colado](camera-rastejador-colado.jpg): rastejador a 0,85 m da Helena com a câmera no novo limite (−1,3 rad). O braço encurta e abre para o lado, e o rastejador aparece inteiro, acima do retículo. Na 0.9.0, a −1,05 rad, o retículo só tocava o chão a ~0,96 m e a câmera subia até y≈4,06, acima do teto (4,0).
- [Berçário no jogo](bercario-rastejador-ombro.jpg): campanha real no ombro, HUD 0.10.0, rastejador menor.

Chromium com SwiftShader (GPU de software).
