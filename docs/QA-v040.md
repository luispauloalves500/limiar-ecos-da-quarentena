# QA — LIMIAR 0.4.0

## Ambiente e método
Linux/Node 24, Chromium 158.0.8127.18 headless, ANGLE SwiftShader, viewport 1280×800. GPU por software, não certificação de hardware físico. Relatório anterior preservado em [QA-v030.md](QA-v030.md). Nenhum mutador de gameplay é exposto; os smokes usam teclas/mouse e diagnósticos somente leitura.

## Gates
149 testes em seis arquivos, ESLint, TypeScript sem emissão, produção Vite e npm audit. Incluem regressões anteriores e novos casos: temas nas 12 salas, densidade/perfil/preferência, eventos idempotentes com pausa/save, migração/validação de vidro e decais, limite de 16 marcas/sala, física amortecida, volume lateral de câmera e **600 frames de uma track constante sem acumular pitch/IK**. O Vite ainda avisa sobre chunk compartilhado Three/loader >500 KB; não escondemos o aviso.

## Bug de Helena e evidência real
O problema não era apenas composição de uma galeria: aplicar rotações procedurais sobre uma track constante podia acumular inclinação, pois AnimationMixer não reescreve propriedades constantes. `PoseRestore` restaura a pose anterior ao override antes de avaliar o mixer; a arma também restaura sua orientação de bind fora da mira. CCD curto resolve o apoio/alcance e a direção física da pistola converge para a retícula. Tank usa direção/muzzle do personagem, não o centro da câmera fixa, para efeitos de impacto.

Enquadramento menos extremo, FOV de mira 52°, cinco sondas de colisão e margem de 34 cm. O spawn permanece voltado para o interior. A automação anterior tinha mostrado o estado de stress após C/Z (ombro espelhado e direção contra a parede), sem restaurar o padrão. Agora ela testa esses controles e reinicia pela UI antes da evidência de enquadramento.

`smoke:published` no jogo real exige Helena à esquerda sem cortar a borda, mira sustentada por 4,5 s sem dobrar, estado Aim após disparo e dot >0,995 entre direção física da pistola e alvo da retícula. Também cobre pointer lock, ambos os modos, perfis, preferências, recarga e caminhada cautelosa. Galerias não são usadas como prova dessa correção. Antes: `/workspace/limiar-v040-smoke/helena-antes.png`; depois local: `final-ui/helena-mira-sustentada.png`, depois público: `published/helena-mira-sustentada.png`.

## Ambiente reativo
`npm run smoke:environment` usa inputs reais: telefone consumido uma vez, passos deslocando lixo, tiro rompendo o vidro, marca de impacto, densidade desligada/alta, estado do vidro nos dois modos e preferência após reload. `smoke` de ombro acrescenta vidro rompido na recepção, save/load no primeiro gravador e volta física à recepção para conferir vidro ausente/impacto restaurado.

Eventos têm flag por sala e não consomem tempo em menus/portas. Fauna/lixo/CRT/fans são cosméticos; vidro e impactos são persistidos. Posições/velocidades de lixo não são persistidas. Áudio tem três fontes por sala e reverb aproximado; o grafo é exercitado sem erros, mas audição humana/mixagem final não foi certificada por um teste headless.

## Playthrough e imagens
**PASS final, expedição nova completa:** pipeline de 393,8 s (incluindo formatação/lint), 12 salas, novo final concluído com 84 HP, reload real no posto, zero erros JS/warnings/HTTP. Vidro/impacto ausentes/restaurados após gravador e volta à recepção, comprovados no mundo. [Resumo versionado](campaign-qa-v040.json). Tank foi validado no smoke real de UI/ambiente, não em nova campanha completa 0.4.

Campanha de ombro usa somente comandos reais: recepção → corredor/E01 derrubado/rastejo/morte → rádio seguro/save/load → arquivo/03:15/chave → gerador/fusível → átrio/B01 → patamar → internação/E02 → enfermaria203/pulseira → segundo posto/save → lavanderia/E04/pressão 3→1→2 → isolamento/E04/terminal/final. Confere cadáver após cinco segundos, coleta/arquivo e reload final no posto. Captura `sala-{id}.png` nas 12 salas, sem teleporte ou criação manual de flags.

Evidências finais ficam em `/workspace/limiar-v040-smoke/final-shoulder-pass/`, `final-ui/`, `final-environment/`, `final-benchmark/`. A primeira campanha de desenvolvimento em `shoulder/` passou antes da correção final de pose e não substitui a execução final. Uma tentativa do bot falhou ao exigir torso quando a cabeça do rastejador estava fisicamente à frente. O teste foi corrigido para atirar na primeira região exposta após a queda; hitboxes, dano e gameplay não foram alterados. A tentativa falha permanece em `final-shoulder/` e não conta como pass. Tank recebe smoke real de UI/ambiente; campanha completa adicional só é declarada se constar no relatório externo.

## Performance
Comparação sequencial com seis GLBs, mesma galeria de isolamento, perfil Baixo, modo ombro, 3 s aquecimento +8 s amostra. Base 0.3.0 intacta em `baseline/benchmark.json`, final em `final-benchmark/benchmark.json`. Ambos usam Helena procedural constante nessa galeria. A 0.4 inclui o ambiente novo; isso não é um benchmark do GLB cru de 104 mil triângulos. Parâmetros de composição seguem o novo ombro, portanto não são capturas pixel-idênticas.

Instancing para peças/lixo/fauna, merge dos exaustores/cadeira, transforms estáticos congelados, somente sala corrente, partículas no vertex shader, culling de fans/CRT e mixers distantes a 12 Hz no Baixo. Resultado: **64,51 → 59,81 ms/frame (−7,3%)**, mediana 66,6 → 50,1, p99 133,3 → 116,8. Draws da cena 104 → 127 e triângulos 32.542 → 33.584 pelo ambiente novo; updates por mixer na amostra 173 → 88. [JSON completo](benchmark-v040.json). O resultado numérico e sua variabilidade ficam no JSON versionado; não há promessa de 30/60 FPS. Histórico anterior tinha 55,78 ms; repetir a referência intacta nesta sessão deu 64,51 ms, evidenciando variação de SwiftShader. Não comparar diretamente medições de sessões diferentes para alegar ganho.

## Publicação
Workflow oficial valida e publica pelo Pages. Após o único push, `verify:published` compara SHA-256 de todos os 12 recursos HTTP de produção, incluindo três GLBs, e exige 0.4.0 no JS. O smoke de UI é repetido contra a URL pública. SHA/URL/run/status e resultado pós-deploy são registrados fora deste commit, em `/workspace/limiar-v040-smoke/release.json` e na entrega, não inventados retroativamente no histórico.

## Limitações
- Ainda 12 salas/uma fatia vertical; não acrescentamos capítulos, R-18, outras armas ou área externa.
- Lixo tem dinâmica 2D aproximada e limites de sala, não rigid bodies com colisão entre todos os móveis. Vidro decorativo quebra e o mesmo tiro pode atravessá-lo; não é balística universal.
- Marcas são planos aproximados por superfície, até 16/sala; não são decals projetados sobre qualquer malha curva. Não se desenham marcas suspensas em inimigos vivos.
- Fauna é estilizada/low-poly; moscas e poeira são Points. Feixes são cones transparentes, não volumetria física. Ruídos de CRT são Canvas pequeno, não vídeo.
- Reverb/HRTF e sons são sintetizados estilizados, sem ray tracing acústico, música gravada ou fala inteligível sintetizada. Sem avaliação auditiva humana nesta QA.
- Eventos são genéricos adaptados por sala e consumidos ao começar; sair no meio não os repete. Densidade off não silencia áudio/história; há botão de áudio na pausa.
- Câmera ainda pode ocultar Helena em canto fisicamente impossível; não é cápsula volumétrica completa. CCD tem poucas iterações e pode ter clipping em ângulos extremos; não é rig facial/ragdoll/mocap novo.
- GPU física/fraca/mobile/acessibilidade completa e playtest humano prolongado seguem pendentes. Licença original dos modelos enviados não foi verificada; proveniência em CREDITS.
