# Tarifa.ao

MVP estático para comparação de tarifas estimadas de apps de táxi em Angola.

O Tarifa.ao permite que o utilizador indique origem e destino, calcula a distância pelos pontos da rota, aplica um horário actual em tempo real e apresenta estimativas comparativas para apps como Yango, Heetch, Kubinga, T'Leva e inDrive.

## Estado do MVP

Este MVP está pronto para ser publicado como site estático. Não tem backend, build step, base de dados ou autenticação.

Principais entregas já implementadas:

- Interface responsiva para mobile e desktop.
- Novo fluxo visual baseado no `TARIFA.AO DESIGN SYSTEM`.
- Home com mapa full-screen e pesquisa directa de origem/destino.
- Loading screen inicial com marca Tarifa.ao.
- Favicon e assets visuais da app.
- Geolocalização automática para preencher a origem quando o utilizador autoriza.
- Origem vazia quando o utilizador nega a autorização de localização.
- Opção "Definir no mapa" ao escrever origem ou destino.
- Mapa interactivo com Leaflet e OpenStreetMap para seleccionar pontos.
- Reverse geocoding para transformar ponto no mapa em endereço.
- Geocoding de texto para calcular coordenadas de origem/destino.
- Hora actual em tempo real, sem input manual.
- Distância calculada automaticamente pelos dois pontos.
- Estimativas de tarifa por app, ordenadas do mais barato ao mais caro.
- Toggle para ordenar por menor preço ou por motorista mais próximo.
- Histórico local de pesquisas via `localStorage`.
- Envio de contribuições de preço real por WhatsApp.
- Guardar contribuições localmente no dispositivo.
- Transições suaves entre 200ms e 300ms.
- Rodapé com autoria, copyright, disclaimer e atribuição OpenStreetMap.
- Modais de Privacidade e Termos dentro do webapp.
- Licença proprietária em `LICENSE.md`.
- Documentação do design system em `tarifaao_design_system.md`.
- Preparação para deploy na Vercel.

## Como funciona

1. Ao abrir a app, aparece um loading screen por alguns instantes.
2. A app tenta obter a localização actual do utilizador.
3. Se o utilizador autorizar, a origem é preenchida automaticamente.
4. Se o utilizador negar, a origem fica vazia.
5. O utilizador escreve ou define no mapa a origem e o destino.
6. A app calcula a distância real em linha recta entre os dois pontos.
7. A hora usada é sempre a hora actual do dispositivo.
8. A app calcula e apresenta estimativas de tarifas.
9. O utilizador pode ordenar por preço ou por app com carro mais próximo.
10. O utilizador pode contribuir com preços reais por WhatsApp ou guardar localmente.

## Estrutura

```text
tarifaao/
├── assets/
│   ├── favicon.png
│   ├── heetch.png
│   ├── indrive.png
│   ├── kubinga.png
│   ├── logotipo+textoembaixo.png
│   ├── t'leva.png
│   └── yango.png
├── app.js
├── index.html
├── LICENSE.md
├── README.md
├── styles.css
├── tarifaao_design_system.md
└── vercel.json
```

## Ficheiros principais

`index.html`

- Estrutura da app.
- Liga favicon, fontes, Leaflet e ficheiros locais.
- Inclui o loading screen, views principais, modal de contribuição e modal do mapa.

`styles.css`

- Tokens e fundações do Tarifa.ao Design System.
- Layout mobile e desktop sobre mapa full-screen.
- Transições suaves.
- Loading screen.
- Estados de botões, inputs, cards, modal e mapa.

`app.js`

- Estado da rota actual.
- Cálculo de distância.
- Geolocalização do utilizador.
- Geocoding e reverse geocoding.
- Estimativas de tarifa.
- Histórico local.
- Contribuições por WhatsApp.
- Controlo de views e modais.

`vercel.json`

- Configuração simples para clean URLs na Vercel.

`LICENSE.md`

- Licença proprietária do projecto.
- Proíbe cópia, redistribuição, uso comercial e criação de derivados sem autorização escrita.

`tarifaao_design_system.md`

- Regista a fusão conceptual Uber Base + Porsche Design System aplicada ao Tarifa.ao.
- Define princípios, tokens, componentes e regras de uso visual.

## Tecnologias

- HTML
- CSS
- JavaScript puro
- Leaflet
- OpenStreetMap tiles
- Nominatim/OpenStreetMap para geocoding
- `localStorage`
- WhatsApp deep link

## Como testar localmente

Opção simples:

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Depois abre:

```text
http://127.0.0.1:4173
```

Também é possível abrir `index.html` directamente no browser, mas a geolocalização funciona melhor em `localhost` ou HTTPS.

## Configuração

### WhatsApp

O número que recebe contribuições fica no início do `app.js`:

```js
const OWNER_WHATSAPP = "244963201382";
```

Troca este valor sempre que quiseres mudar o destino das contribuições.

### Apps e preços

As apps, tarifas base, preço por quilómetro, disponibilidade e links ficam no array `APPS` em `app.js`.

### Rotas rápidas

As rotas rápidas foram removidas da home para manter o fluxo inicial focado apenas em origem e destino.

### Mapa

O novo design usa mapa full-screen como superfície principal com Leaflet e tiles OpenStreetMap.

Se o Leaflet ou a ligação aos tiles falhar, a app continua funcional com fallback visual em CSS. O selector "Definir no mapa" também usa Leaflet/OpenStreetMap.

### Supabase

O MVP já está preparado para gravar dados comunitários no Supabase, sem login obrigatório.

1. Abre o projecto no Supabase.
2. Vai a `SQL Editor`.
3. Executa o ficheiro `supabase/schema.sql`.
4. Vai a `Settings > API Keys`.
5. Copia a `Project URL`.
6. Copia uma `Publishable key` ou a legacy `anon public key`.
7. Coloca estes valores no `index.html`:

```html
<meta name="supabase-url" content="https://PROJECT_REF.supabase.co" />
<meta name="supabase-publishable-key" content="sb_publishable_..." />
```

Alternativa avançada:

```html
<script>
  window.TARIFAAO_SUPABASE_URL = "https://PROJECT_REF.supabase.co";
  window.TARIFAAO_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_...";
</script>
```

Nunca colocar no frontend: database password, secret key ou service role key.

Tabelas criadas:

- `route_searches`: pesquisas de origem/destino.
- `fare_contributions`: contribuições reais de preço.
- `user_feedback`: feedback futuro da comunidade.

As tabelas têm RLS activo e permitem apenas `insert` para clientes públicos.

## Publicação na Vercel

1. Cria ou importa o repositório no GitHub.
2. Entra na Vercel.
3. Importa o repositório `MoreiraBastos/tarifaao`.
4. Framework Preset: `Other`.
5. Build Command: deixa vazio.
6. Output Directory: deixa vazio ou usa `./`.
7. Publica.

## Privacidade

- A localização é pedida pelo navegador.
- Quando Supabase estiver configurado, pesquisas e contribuições podem ser guardadas para melhorar estimativas comunitárias.
- O geocoding/reverse geocoding pode usar serviços de mapa/geocoding configurados no frontend.
- Histórico local fica no `localStorage` do dispositivo; contribuições também podem ser sincronizadas com Supabase.
- Ao enviar por WhatsApp, os dados são enviados para o número configurado em `OWNER_WHATSAPP`.
- O webapp inclui um modal de Privacidade com estes pontos resumidos para o utilizador final.

## Termos e avisos no webapp

O app inclui avisos para o utilizador final:

- Tarifa.ao apresenta estimativas beta, não preços oficiais.
- Tarifa.ao não é afiliado, patrocinado ou endossado pela Yango, Heetch, Kubinga, T'Leva ou inDrive.
- App by Edson Moreira Bastos.
- © 2026 Edson Moreira Bastos. Todos os direitos reservados.
- Dados de mapa: © OpenStreetMap contributors.

## Limitações actuais

- A distância é calculada em linha recta entre dois pontos, não por estrada.
- As tarifas são estimativas beta e não preços oficiais das apps.
- O backend Supabase é insert-only no cliente; validação/admin continuam como próximos passos.
- O histórico é local e pode ser apagado pelo navegador.
- O Nominatim pode limitar pedidos se houver muito tráfego.

## Próximos passos recomendados

- Ligar contribuições a uma base de dados simples.
- Trocar cálculo em linha recta por distância/tempo por estrada.
- Adicionar cache de geocoding mais robusta.
- Criar painel admin para validar contribuições.
- Adicionar página de privacidade.
- Criar PWA instalável.
- Medir eventos principais com analytics leve.

## Ideias de backend simples

- Google Sheets via Apps Script.
- Supabase com RLS insert-only.
- Firebase.
- Airtable.
- API própria simples em Node/Express.

## Licença

Este projecto é proprietário.

Copyright (c) 2026 Edson Moreira Bastos.

Todos os direitos reservados.

Consulta `LICENSE.md` para os termos completos. O acesso ao código, repositório ou aplicação não concede autorização para copiar, modificar, distribuir, sublicenciar, vender, republicar, explorar comercialmente ou criar trabalhos derivados sem autorização prévia e por escrito.
