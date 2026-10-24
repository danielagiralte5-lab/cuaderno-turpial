# Cuaderno Turpial

App de estudio para 5.º de Primaria con Tupi, un turpial con inteligencia artificial.

## Puesta en marcha en Vercel

1. Importa este repositorio en Vercel (Add New → Project → Import).
2. En **Settings → Environment Variables** añade:
   - `ANTHROPIC_API_KEY`: clave de https://console.anthropic.com
   - `TUPI_PIN`: el código familiar que se escribe una vez en el iPad
   - `TUPI_MODEL` (opcional): modelo de Claude; por defecto `claude-haiku-5-5`
3. Redeploy. En el iPad: Safari → Compartir → Añadir a pantalla de inicio.

El progreso del niño se guarda solo en el iPad. La carpeta `api/` contiene la función que habla con Claude: la clave nunca llega al navegador.
