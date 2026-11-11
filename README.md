# Kidoria ABC

Livro falante digital para crianças de 3 a 8 anos: letras, números, cores, formas, animais, frutas e música, com voz em português, inglês, espanhol e italiano. Faz parte do ecossistema Kidoria.

- `index.html` – landing page (crianças e pais)
- `app/index.html` – o app (arquivo único, sem build)
- `assets/` – logomarcas e imagens otimizadas (WebP, ampliadas com super-resolução)
- Domínio: kidoria.abc.agourmix.tech
- Hospedagem: Vercel (Framework "Other", sem build, diretório raiz)

## Locução (ElevenLabs)

As falas em espanhol (voz **Nancy Narradora Dulce**) e italiano (voz **Giulietta**) são gravadas uma única vez na ElevenLabs e ficam em `app/audio/`. Tocar não gasta crédito. Idioma sem áudio gravado usa a voz do aparelho.

Para gerar ou atualizar:
1. No GitHub, em **Settings → Secrets and variables → Actions**, crie o segredo `ELEVENLABS_API_KEY` com a sua chave da ElevenLabs.
2. Em **Actions → Gerar locução (ElevenLabs) → Run workflow**, escolha os idiomas (padrão `es,it`).
3. O workflow grava os MP3 em `app/audio/` e faz commit. A Vercel republica sozinha.

- Vozes de cada idioma: `scripts/vozes.json` (para gravar PT ou EN, preencha o `voice_id`).
- Rodar de novo só gera as frases que faltam; frases alteradas no app ganham áudio novo.
- Marque "Só calcular o custo" para ver quantos créditos serão gastos antes de gerar.
- Se aparecer erro de voz não liberada, adicione a voz em ElevenLabs → Voices → Library → "Add to my voices".
