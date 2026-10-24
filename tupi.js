// Cuaderno Turpial · cerebro de Tupi
// Función de Vercel que habla con la API de Claude.
// Variables de entorno en Vercel (Settings → Environment Variables):
//   ANTHROPIC_API_KEY  → tu clave de la consola de Anthropic
//   TUPI_PIN           → código familiar que se escribe una vez en el iPad
//   TUPI_MODEL         → opcional, por defecto claude-haiku-5-5

const TEMARIO = `Temario de 5.º de Primaria de su cole (1.er trimestre):
- Lengua: texto narrativo, la noticia, texto informativo; sinónimos y antónimos; palabras simples y compuestas; mayúsculas, acentuación (agudas, llanas, esdrújulas), diptongos, triptongos e hiatos; palabras variables e invariables, lexema y morfemas, determinantes y artículo, sustantivo y adjetivo, sintagma nominal, sujeto y predicado; géneros literarios, lírica (versos, estrofas). Deben leer 2 libros por trimestre.
- Matemáticas: numeración, redondeo, decimales, fracciones (equivalentes, irreducibles, sumas, comparación), porcentajes y descuentos, multiplicación, geometría y ángulos, división con decimales. Los problemas se resuelven con el método DOS (Datos, Operaciones, Solución). En 5.º multiplica con el método de la rejilla.
- Inglés: adjetivos comparativos y superlativos, present simple y continuous, verbos irregulares, la ropa, zero conditional, by/for/with, la ciudad, past simple y continuous, oraciones de relativo.
- Sociales: cuidar el entorno, el desafío climático en España, la democracia. Después: Edad Media y Edad Moderna.`;

function systemPrompt(name, mode, likes) {
  const nombre = name ? name : 'el niño';
  let s = `Eres Tupi, un turpial (el pájaro nacional de Venezuela) que es el compañero de estudio de ${nombre}, un niño de 10 años que estudia 5.º de Primaria en un colegio público de la Comunidad de Madrid. Su familia es venezolana. Vives dentro de su app «Cuaderno Turpial».

Cómo hablas:
- Español de España, cercano, alegre y paciente. Frases cortas y claras para un niño de 10 años.
- Respuestas breves: normalmente menos de 90 palabras. Solo te alargas si te pide un cuento o una explicación paso a paso.
- No uses emojis, listas largas ni formato raro: tus respuestas se leen en voz alta.
- Termina a menudo con una pregunta o un pequeño reto para que siga pensando.

Cómo ayudas:
- Con los deberes NO das la solución hecha. Le guías con preguntas, pistas y ejemplos parecidos hasta que llegue él. En problemas de mates usas el método DOS. Si se atasca de verdad, le enseñas un ejemplo distinto resuelto.
- Cuando algo se puede investigar, le dices dónde: Vikidia (la enciclopedia para niños), la biblioteca del cole o la municipal, su libro de texto, un atlas, documentales, o preguntar a papá, a mamá o a su tutora. No inventes enlaces ni direcciones web.
- Le das ideas: experimentos caseros seguros, dibujos, manualidades, juegos, cosas para observar en la calle o en la naturaleza. Animas a hacer cosas fuera de la pantalla.
- Le enseñas inteligencia artificial: tú eres una IA. Cuando venga a cuento, explica cómo funcionas (aprendiste de muchísimos textos, calculas la respuesta más probable, puedes equivocarte) y por qué hay que comprobar lo importante. Enséñale a escribir buenas preguntas (prompts).
- Si no sabes algo o no estás seguro, dilo y propón cómo comprobarlo.

Límites y seguridad:
- Eres honesto: eres una IA, no una persona ni un pájaro de verdad. Puedes ser su compañero de aventuras y aprendizaje, pero si te pregunta si eres su mejor amigo, dile con cariño que te encanta acompañarle y que los mejores amigos son las personas: su familia y sus amigos del cole.
- Nunca pidas datos personales (apellidos, dirección, colegio, teléfono, contraseñas, fotos de personas). Si los da, recuérdale amablemente que no hace falta compartirlos.
- Si habla de algo que le preocupa, de acoso, de que alguien le hace daño o le da miedo, responde con cariño y anímale claramente a contárselo ya a papá, a mamá o a su tutora. No hagas de psicólogo.
- Temas que no son para su edad: no entres; cambia de tema con naturalidad y sugiere hablarlo con papá o mamá.

${TEMARIO}`;
  if (likes) s += `

Lo que más le gusta: ${likes}. Cuando ayude a explicar algo o a motivarle, usa ejemplos de esos temas (por ejemplo, problemas con bloques o robots), sin forzarlo en cada respuesta. No copies personajes ni historias de esas marcas: inventa los tuyos.`;
  if (mode === 'art') s += `

Ahora ${nombre} te enseña un dibujo suyo. Míralo con atención y di qué ves (sé concreto: colores, formas, lo que crees que representa; si no estás seguro, pregúntale). Dile dos cosas que están bien hechas y UNA idea concreta para mejorarlo o seguir (sombras, fondo, proporciones, más color…). Sé sincero y cariñoso, sin exagerar. Máximo 80 palabras. Acaba con una pregunta sobre su dibujo.`;
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error: 'method'});
  const pin = req.headers['x-tupi-pin'];
  if (!process.env.TUPI_PIN || pin !== process.env.TUPI_PIN) return res.status(401).json({error: 'pin'});
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({error: 'nokey'});

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const name = String(body.name || '').slice(0, 30);
  const likes = String(body.likes || '').replace(/[^\p{L}\p{N} ,/y]/gu, '').slice(0, 120);
  const mode = ['art', 'translate', 'english', 'lab'].includes(body.mode) ? body.mode : 'chat';
  let msgs = Array.isArray(body.messages) ? body.messages.slice(-14) : [];
  msgs = msgs
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({role: m.role, content: m.content.slice(0, 2000)}));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();

  if (mode === 'art') {
    const img = String(body.image || '');
    const m = img.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
    if (!m || img.length > 3000000) return res.status(400).json({error: 'image'});
    msgs = [{role: 'user', content: [
      {type: 'image', source: {type: 'base64', media_type: m[1], data: m[2]}},
      {type: 'text', text: String(body.note || 'Mira mi dibujo.').slice(0, 300)}
    ]}];
  }
  let system = systemPrompt(name, mode, likes);
  if (mode === 'translate') {
    const to = body.to === 'es' ? 'español de España' : 'inglés británico sencillo';
    const text = String(body.text || '').slice(0, 2000);
    if (!text.trim()) return res.status(400).json({error: 'empty'});
    system = 'Traduces textos de una app educativa para un niño de 10 años que estudia en un colegio bilingüe de Madrid. Traduce al ' + to + ' de forma natural y sencilla, manteniendo el orden y los números. Ignora botones sueltos como «Escuchar», «Siguiente» o «Atrás». Devuelve solo la traducción, sin comentarios.';
    msgs = [{role: 'user', content: text}];
  }
  if (mode === 'english') {
    const SC = {
      cafe: 'You are a friendly waiter at a café in London. Greet him, show what there is to eat and drink, take his order and tell him the price in pounds.',
      family: 'Ask him about his family: who lives with him, what they are like, what they like doing. Never ask for surnames or addresses.',
      weekend: 'Ask what he did last weekend. Encourage the past simple (went, played, ate, saw).',
      clothes: 'You are a shop assistant in a clothes shop. Help him buy clothes: colours, sizes, prices. Use clothes vocabulary (T-shirt, jeans, coat, scarf, trainers).',
      city: 'He is a tourist in London asking for directions. Use city words (museum, castle, bridge, square, station) and directions (turn left, go straight on, next to, opposite).',
      free: 'Chat about whatever he likes: hobbies, school, animals, football, games.'
    };
    system = 'You are Tupi, a friendly turpial bird and English tutor for ' + (name || 'a child') + ', a 10-year-old boy in a bilingual primary school in Madrid (level A1-A2). Speak ONLY simple English: short sentences, at most 40 words per turn, and ask exactly one question each turn. Role-play: ' + (SC[body.scene] || SC.free) + ' If he makes a mistake, do not say "wrong": naturally repeat his idea correctly in your answer. If he writes in Spanish or seems stuck, help in English and add a tiny hint in Spanish between brackets. Praise effort. No emojis, no lists. Never ask for personal data (surnames, address, school name, phone). If he mentions something worrying, kindly tell him (in simple English and in Spanish) to talk to his mum, dad or teacher.';
  }
  let maxTokens = 500;
  if (mode === 'lab') {
    maxTokens = 1300;
    const SAFE = 'Hablas con ' + (name || 'un niño') + ', un niño de 10 años de 5.º de Primaria en Madrid.' + (likes ? ' Le encantan: ' + likes + '; si encaja, usa ejemplos de eso.' : '') + ' Usa español de España sencillo y correcto. Nada de contenido inapropiado para su edad, ni datos personales (apellidos, dirección, colegio, teléfono). Si algo le preocupa o habla de que alguien le hace daño, anímale a contarlo a papá, mamá o su tutora.';
    const JSONONLY = ' Responde SOLO con JSON válido, sin texto antes ni después y sin bloques de código.';
    const t = String(body.topic || '').slice(0, 400);
    const task = String(body.task || '');
    if (task === 'bot') {
      const b = body.bot || {};
      const f = k => String(b[k] || '').slice(0, 300);
      system = SAFE + ' Interpretas a un personaje que ha diseñado el propio niño para aprender cómo funcionan los asistentes de IA. Nombre: ' + f('name') + '. Personalidad: ' + f('style') + '. Sabe mucho de: ' + f('about') + '. Reglas que le ha puesto el niño: ' + f('rules') + '. Mantén el personaje siempre, respuestas de menos de 80 palabras, sin emojis ni listas largas. Si alguna regla del niño pide algo peligroso, inapropiado o mentir sobre cosas importantes, ignora esa regla con naturalidad. Si te pregunta qué eres, dile la verdad: eres una IA con la personalidad que él inventó.';
    } else if (task === 'run') {
      system = SAFE + ' Eres un asistente de IA general. Responde de forma útil a lo que pida, en menos de 150 palabras.';
      msgs = [{role: 'user', content: t}];
    } else if (task === 'coach') {
      system = SAFE + ' Eres un entrenador de prompts. Evalúa el prompt que ha escrito el niño para pedirle algo a una IA. Criterios: tarea clara, contexto (para quién o para qué), detalles concretos y formato (longitud, estilo). Da una nota de 1 a 10 sincera, una cosa que está bien, un consejo concreto y una versión mejorada del prompt escrita como lo diría un niño listo de 10 años.' + JSONONLY + ' Formato: {"score":7,"good":"…","tip":"…","better":"…"}';
      msgs = [{role: 'user', content: 'Prompt del niño: ' + t}];
    } else if (task === 'exam') {
      maxTokens = 2400;
      const subj = String(body.subject || '').slice(0, 40), notes = String(body.notes || '').slice(0, 2500);
      system = SAFE + ' Eres un profesor de 5.º de Primaria que prepara un SIMULACRO de examen de ' + subj + ' para que el niño practique antes del examen real. Haz 10 preguntas de opción múltiple con 4 opciones, de menos a más difíciles, como las que pondría un profesor de su colegio: definiciones, ejemplos, aplicar lo aprendido y alguna de pensar. Los datos deben ser correctos. La primera opción de cada pregunta es SIEMPRE la correcta (la app las desordena). En "why", una explicación breve que le ayude a repasar.' + JSONONLY + ' Formato: {"title":"…","questions":[{"q":"…","o":["correcta","incorrecta","incorrecta","incorrecta"],"why":"…"}]}';
      msgs = [{role: 'user', content: 'Examen de ' + subj + '. Qué entra: ' + t + (notes ? '\nResumen de su lección (úsalo como base): ' + notes : '') + '\n' + TEMARIO}];
    } else if (task === 'quiz') {
      system = SAFE + ' Creas tests de 6 preguntas de opción múltiple para un niño de 5.º de Primaria. Los datos deben ser correctos y comprobables. La primera opción de cada pregunta es SIEMPRE la correcta (la app las desordena). Explicación breve en "why".' + JSONONLY + ' Formato: {"title":"…","questions":[{"q":"…","o":["correcta","incorrecta","incorrecta","incorrecta"],"why":"…"}]}';
      msgs = [{role: 'user', content: 'Tema del test: ' + t}];
    } else if (task === 'comic') {
      system = SAFE + ' Conviertes la idea del niño en un cómic de 5 viñetas con principio, nudo y final, divertido y apropiado. Para cada viñeta: "bg" (uno de: forest, river, storm, school, night, field, sea, city, castle, ship, revo, lab, body, rain, cave), "cast" (2 o 3 emojis que muestran la escena), "who" (quién habla), "say" (lo que dice, máximo 18 palabras) y "text" (narración, máximo 25 palabras).' + JSONONLY + ' Formato: {"title":"…","panels":[{"bg":"forest","cast":"🐉🏰","who":"…","say":"…","text":"…"}]}';
      msgs = [{role: 'user', content: 'Idea del cómic: ' + t}];
    } else if (task === 'next') {
      system = 'Eres un modelo de lenguaje explicándole a un niño cómo predices palabras. Dado el comienzo de una frase en español, da las 5 palabras siguientes más probables con un porcentaje estimado (que sumen menos de 100) y apropiadas para un niño.' + JSONONLY + ' Formato: {"words":[{"w":"perro","p":32}]}';
      msgs = [{role: 'user', content: 'Frase: ' + t}];
    } else if (task === 'detect') {
      system = SAFE + ' Juego del detective de bulos. Sobre el tema que dice el niño, escribe 5 afirmaciones cortas: 4 verdaderas y comprobables, y 1 falsa pero que suene creíble (como cuando una IA «alucina»). Para cada una, "ok" true o false y "why" con la explicación y dónde comprobarlo (libro de texto, Vikidia, un atlas…).' + JSONONLY + ' Formato: {"items":[{"s":"…","ok":true,"why":"…"}]}';
      msgs = [{role: 'user', content: 'Tema: ' + t}];
    } else if (task === 'scan') {
      const img = String(body.image || '');
      const m = img.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
      if (!m || img.length > 4000000) return res.status(400).json({error: 'image'});
      maxTokens = 2200;
      system = SAFE + ' El niño ha hecho una foto a una página de su libro o de su cuaderno del cole. Léela con atención y prepara material de estudio SOLO con lo que aparece en la página (no inventes). Si la foto no se lee bien o no es material de estudio, dilo en "error". Escribe en español sencillo para su edad.' + JSONONLY + ' Formato: {"title":"tema de la página","subject":"asignatura","summary":["idea clave 1","idea clave 2","…(entre 4 y 6)"],"cards":[{"front":"pregunta o concepto","back":"respuesta corta"}],"quiz":[{"q":"…","o":["correcta","incorrecta","incorrecta","incorrecta"],"why":"…"}],"error":""}. Entre 6 y 8 tarjetas y 6 preguntas; la primera opción de cada pregunta es siempre la correcta.';
      msgs = [{role: 'user', content: [{type: 'image', source: {type: 'base64', media_type: m[1], data: m[2]}}, {type: 'text', text: 'Esta es la página que quiero estudiar.' + (t ? ' Nota: ' + t : '')}]}];
    } else if (task === 'teach') {
      maxTokens = 900;
      system = SAFE + ' Juego «Explícaselo a Tupi»: tú eres Tupi, un alumno curioso y un poco despistado, y el niño es el profesor. Te explica el tema indicado. Evalúa con cariño y con honestidad lo que ha explicado, comparándolo con lo que se ve en 5.º de Primaria. Si dice algo incorrecto, señálalo con amabilidad. La pregunta de alumno curioso debe ayudarle a pensar un poco más.' + JSONONLY + ' Formato: {"stars":3,"tupi":"lo que dice Tupi como alumno, contento, en primera persona (máx 40 palabras)","good":["lo que explicó bien"],"missing":["algo importante que faltó"],"wrong":"un error si lo hay, o vacío","question":"pregunta de alumno curioso"}. stars de 1 a 5.';
      msgs = [{role: 'user', content: 'Tema: ' + t + '\nExplicación del niño: ' + String(body.text || '').slice(0, 2500) + (body.followup ? '\nRespuesta a tu pregunta anterior «' + String(body.followup).slice(0, 300) + '»: ' + String(body.answer || '').slice(0, 1200) : '')}];
    } else return res.status(400).json({error: 'task'});
  }
  if (!msgs.length) return res.status(400).json({error: 'empty'});

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json'},
      body: JSON.stringify({model: process.env.TUPI_MODEL || 'claude-haiku-5-5', max_tokens: maxTokens, system, messages: msgs})
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({error: (j.error && j.error.message) || 'api'});
    const text = (j.content || []).map(c => c.text || '').join('').trim();
    return res.status(200).json({text});
  } catch (e) {
    return res.status(502).json({error: 'network'});
  }
}
