// Gera a locução do Kidoria ABC na ElevenLabs, uma única vez.
// Uso: ELEVENLABS_API_KEY=... node scripts/gerar-audios.mjs --idiomas es,it [--modelo eleven_v4] [--estimar]
// Arquivos que já existem são pulados, então rodar de novo não cobra duas vezes.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const idiomas = String(arg('idiomas', 'pt,en,es,it')).split(',').map(s => s.trim()).filter(Boolean);
let modelo = String(arg('modelo', 'eleven_v4'));
const estimar = !!arg('estimar', false);
const vozes = JSON.parse(fs.readFileSync(path.join(raiz, 'scripts/vozes.json'), 'utf8'));

// Carrega o próprio app para listar exatamente as frases que ele fala
const html = fs.readFileSync(path.join(raiz, 'app/index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1].split('/* ---------- Voz e sons')[0];
const ctx = { window: {}, document: { getElementById: () => ({}) }, localStorage: { getItem: () => null, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(js + `
function phraseKey(l,t){let h=0x811c9dc5;const s=l+'|'+t.normalize('NFC');
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');}
${html.match(/function fixSpeech[\s\S]*?\n}\n/)[0]}
${html.match(/function allPhrases[\s\S]*?\n}\n/)[0]}
globalThis.__k = { allPhrases, phraseKey, fixSpeech };`, ctx);
const { allPhrases, phraseKey, fixSpeech } = ctx.__k;

const pastaAudio = path.join(raiz, 'app/audio');
const manifestPath = path.join(pastaAudio, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const chave = process.env.ELEVENLABS_API_KEY;
if (!estimar && !chave) { console.error('Falta o segredo ELEVENLABS_API_KEY.'); process.exit(1); }

async function tts(voiceId, texto) {
  for (let tent = 0; tent < 4; tent++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': chave, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: texto, model_id: modelo, voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true, speed: 0.9 } })
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const corpo = (await r.text()).slice(0, 300);
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 3000 * (tent + 1))); continue; }
    if ((r.status === 400 || r.status === 422) && /model/i.test(corpo) && modelo !== 'eleven_multilingual_v2') {
      console.warn(`Modelo ${modelo} recusado; usando eleven_multilingual_v2.`); modelo = 'eleven_multilingual_v2'; continue;
    }
    if (r.status === 401) throw new Error('Chave da ElevenLabs inválida (401).');
    if (/voice/i.test(corpo) && (r.status === 400 || r.status === 404)) throw new Error(`A voz ${voiceId} não está liberada na conta. Na ElevenLabs, abra Voices > Library, procure a voz e clique em "Add to my voices". Detalhe: ${corpo}`);
    throw new Error(`ElevenLabs ${r.status}: ${corpo}`);
  }
  throw new Error('ElevenLabs não respondeu depois de 4 tentativas.');
}

let totalChars = 0, gerados = 0;
for (const l of idiomas) {
  const v = vozes[l];
  if (!v || !v.voice_id) { console.log(`[${l}] sem voice_id em scripts/vozes.json; pulando.`); continue; }
  const frases = allPhrases(l);
  fs.mkdirSync(path.join(pastaAudio, l), { recursive: true });
  const faltam = frases.filter(t => !fs.existsSync(path.join(pastaAudio, l, phraseKey(l, t) + '.mp3')));
  const chars = faltam.reduce((s, t) => s + fixSpeech(t, l).length, 0);
  totalChars += chars;
  console.log(`[${l}] ${v.voz}: ${frases.length} frases, faltam ${faltam.length} (${chars} caracteres).`);
  if (estimar) continue;
  for (const [i, t] of faltam.entries()) {
    const mp3 = await tts(v.voice_id, fixSpeech(t, l));
    fs.writeFileSync(path.join(pastaAudio, l, phraseKey(l, t) + '.mp3'), mp3);
    gerados++;
    if ((i + 1) % 20 === 0) console.log(`[${l}] ${i + 1}/${faltam.length}`);
  }
  manifest[l] = frases.map(t => phraseKey(l, t)).filter(k => fs.existsSync(path.join(pastaAudio, l, k + '.mp3'))).sort();
}
if (!estimar) fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n');
console.log(estimar ? `Estimativa: ${totalChars} caracteres (≈ ${totalChars} créditos).` : `Pronto: ${gerados} áudios novos, modelo ${modelo}.`);
