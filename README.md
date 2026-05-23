# Tarifa.ao

MVP estático para comparação de tarifas estimadas de apps de táxi em Angola.

O Tarifa.ao permite que o utilizador indique origem e destino, calcula a distância pelos pontos da rota, aplica um horário actual em tempo real e apresenta estimativas comparativas para apps como Yango, Heetch, Kubinga, T'Leva e inDrive.

## Estado do MVP

Este MVP está pronto para ser publicado como site estático. Não tem backend, build step, base de dados ou autenticação.

Principais entregas já implementadas:

- Interface responsiva para mobile e desktop.
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
- Rotas rápidas populares em Luanda.
- Histórico local de pesquisas via `localStorage`.
- Envio de contribuições de preço real por WhatsApp.
- Guardar contribuições localmente no dispositivo.
- Transições suaves entre 200ms e 300ms.
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
9. O utilizador pode contribuir com preços reais por WhatsApp ou guardar localmente.

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
├── README.md
├── styles.css
└── vercel.json
```

## Ficheiros principais

`index.html`

- Estrutura da app.
- Liga favicon, fontes, Leaflet e ficheiros locais.
- Inclui o loading screen, views principais, modal de contribuição e modal do mapa.

`styles.css`

- Design system visual da app.
- Layout mobile e desktop.
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

As rotas rápidas ficam no `index.html`, nos botões com classe `quick-route`.

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
- A localização não é enviada para um backend próprio, porque este MVP não tem backend.
- O geocoding/reverse geocoding usa Nominatim/OpenStreetMap.
- Histórico e contribuições locais ficam apenas no `localStorage` do dispositivo.
- Ao enviar por WhatsApp, os dados são enviados para o número configurado em `OWNER_WHATSAPP`.

## Limitações actuais

- A distância é calculada em linha recta entre dois pontos, não por estrada.
- As tarifas são estimativas beta e não preços oficiais das apps.
- Não há backend para validação centralizada das contribuições.
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
- Supabase.
- Firebase.
- Airtable.
- API própria simples em Node/Express.

## Licença

Proprietário. Definir licença antes de aceitar contribuições externas.
