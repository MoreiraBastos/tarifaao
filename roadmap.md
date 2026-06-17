# Roadmap de Estudo — Tarifa.ao (3 Dias)

> Objectivo: Dominar completamente o projecto — arquitectura, lógica de negócio, base de dados, design system e deployment.

---

## Dia 1 — Fundação: O Que É e Como Funciona

### Manhã (2–3h) — Visão Geral e HTML

**1. README e Documentação**
- Ler `README.md` completo
- Ler `tarifaao_design_system.md` — entender a filosofia visual (Uber Base + Porsche Design System)
- Ler `LICENSE.md` — contexto legal do projecto

**2. Estrutura HTML (`index.html`, 376 linhas)**
- Identificar as 4 views: `#homeView`, `#resultsView`, `#redirectView`, `#historyView`
- Identificar os 5 modais: `#contributeDialog`, `#privacyDialog`, `#termsDialog`, `#mapDialog`, `#registerDialog`
- Notar como Supabase é configurado via `<meta>` tags (linhas iniciais do `<head>`)
- Verificar a integração do Leaflet via CDN e do IBM Plex Sans via Google Fonts

**Perguntas a responder:**
- Como é que as views são alternadas? (sem router, sem framework)
- Que elementos têm ARIA labels e porquê?

---

### Tarde (2–3h) — CSS e Design System

**3. Estilos (`styles.css`, 1815 linhas)**

Estudar por secções na seguinte ordem:

| Secção | O que aprender |
|--------|---------------|
| CSS Custom Properties (topo do ficheiro) | Tokens de cor, espaçamento, sombras, motion |
| Loading screen | Animação de entrada, branding |
| Mapa de fundo | `position: fixed`, `z-index` layering, fallback sem Leaflet |
| Search panel / Glass cards | `backdrop-filter: blur()`, glassmorphism |
| Ride cards | Layout de comparação, logo + dados |
| Modais | `dialog` element, transições de entrada/saída |
| Toast notifications | Auto-dismiss, posicionamento |
| Media queries | Mobile-first, breakpoints |

**Exercício prático:**
- Abrir o projecto no browser: `python -m http.server 4173 --bind 127.0.0.1`
- Inspecionar elementos no DevTools enquanto lê o CSS
- Identificar qual classe CSS corresponde a cada componente visual

---

### Noite (1–2h) — Revisão do Dia 1

- Desenhar (papel ou digital) a estrutura visual do app: views, modais, sobreposições
- Anotar as variáveis CSS mais importantes de memória
- Listar as 5 apps de táxi e os seus dados (preço base, preço/km, ETA base, disponibilidade)

---

## Dia 2 — Núcleo: JavaScript e Lógica de Negócio

### Manhã (3h) — Inicialização e Estado Global (`app.js`, 1602 linhas)

**4. Estado Global e Configuração (linhas 1–100)**

Variáveis a entender profundamente:

```js
const APPS              // Array com os 5 apps e tarifas base
const TIME_MULTIPLIERS  // Multiplicadores por hora do dia
currentRoute            // Rota activa (origem, destino, distância, hora)
currentResults          // Estimativas calculadas
fieldLocations          // Cache de coordenadas dos inputs
userCurrentLocation     // Posição detectada do utilizador
backgroundMap           // Instância Leaflet do mapa de fundo
pickerMap               // Instância Leaflet do picker interactivo
geocodeCache            // Cache de respostas Nominatim
```

**5. Fluxo de Inicialização**

Seguir a cadeia de chamadas:
```
initApp()
  └── initLoadingScreen()
  └── initEvents()         ← todos os event listeners
  └── initLocationField()  ← autocomplete de moradas
  └── initMapBackground()  ← mapa Leaflet de fundo
  └── requestCurrentLocation() ← Geolocation API
```

---

### Tarde (3h) — Lógica de Negócio Central

**6. Cálculo de Tarifas**

Dominar estas funções por ordem:

1. `calculateDistanceKm(lat1, lon1, lat2, lon2)` — fórmula de Haversine
2. `getCurrentTimeBucket()` — determina `agora/manha/pico/noite`
3. `estimateRides(distanceKm, timeBucket)` — gera estimativas para os 5 apps
   - Fórmula: `(min_fare + distance * per_km) * time_multiplier`
   - Blending com contribuições da comunidade: `65% community + 35% base`
4. `getSortedResults(results, mode)` — ordenação por preço ou por ETA

**7. Geocoding e Mapa**

Entender o fluxo assíncrono:
```
Input de texto → geocodeSuggestions() → Nominatim API
                                       → renderAddressSuggestions()
                                       → utilizador selecciona
                                       → fieldLocations[field] = coords
                                       → calculateFieldDistance()
                                       → updateDistanceDisplay()
```

Funções de mapa:
- `initMapBackground()` — Leaflet com tiles OpenStreetMap
- `openMapPicker()` / `selectMapPoint()` / `closeMapPicker()`
- `updateRouteMap()` — desenha linha entre origem e destino

**8. Fluxo Principal de Comparação**

```
submitRouteForm()
  └── compareRoute()
        └── estimateRides()
        └── renderResults()
        └── trackRouteSearch()  ← analytics Supabase (opcional)
```

---

### Noite (1–2h) — Revisão do Dia 2

- Reproduzir de memória a fórmula de cálculo de tarifas
- Explicar por escrito (em português) o que acontece desde que o utilizador clica "Comparar" até ver os resultados
- Listar todas as chamadas assíncronas do `app.js` (Nominatim, Supabase, Geolocation)

---

## Dia 3 — Profundidade: Base de Dados, Analytics e Deploy

### Manhã (2–3h) — Supabase e Persistência

**9. Schema da Base de Dados (`supabase/schema.sql`)**

Estudar as 3 tabelas principais:

| Tabela | Propósito | Colunas-chave |
|--------|-----------|---------------|
| `route_searches` | Analytics de pesquisas | device_id, distance_km, time_bucket, sort_mode |
| `fare_contributions` | Preços reais da comunidade | route_key, app_name, price_kz, source |
| `user_feedback` | Feedback geral | feedback_type, message, context (jsonb) |

Tabelas implícitas no código (sem schema definido):
- `visitors` — registo opcional (email, first_name, last_name, device_id)
- `events` — eventos de analytics (app_open, contribute_open, app_view, app_click, register)

**10. Políticas RLS (Row Level Security)**

Perceber que utilizadores anónimos só podem fazer `INSERT` — nunca `SELECT`, `UPDATE` ou `DELETE`. Isto garante privacidade e segurança sem autenticação.

**11. Funções de Analytics no `app.js`**

```js
supabaseInsert(table, data)     // POST genérico para Supabase REST API
supabaseUpsert(table, data)     // POST com resolution=merge-duplicates
trackRouteSearch()              // Regista cada pesquisa
trackFareContribution()         // Regista contribuição de preço
trackEvent(eventName, context)  // Regista eventos gerais
```

**12. Persistência Local (LocalStorage)**

| Chave | Conteúdo |
|-------|---------|
| `device_id` | UUID gerado uma vez, permanente |
| `search_history` | Últimas 30 pesquisas |
| `fare_contributions` | Preços submetidos pelo utilizador |
| `visitor_profile` | Dados de registo (email, nome) |

---

### Tarde (2–3h) — Funcionalidades Avançadas e Deploy

**13. Sistema de Contribuições**

Fluxo completo:
```
openContributeDialog()
  └── utilizador preenche: app, preço, ETA, nota
  └── buildContribution()      ← valida e estrutura os dados
  └── saveContribution()       ← guarda em LocalStorage + Supabase
  └── sendContributionWhatsApp() ← abre wa.me com mensagem pré-formatada
```

**14. Registo de Visitantes**

```
shouldShowRegistrationModal()  ← lógica de quando mostrar
registerVisitor()              ← POST para tabela visitors + trackEvent
updateSettingsProfile()        ← mostra dados na view de settings
```

**15. Utilitários Críticos**

| Função | Propósito |
|--------|-----------|
| `getDeviceId()` | Cria/recupera UUID persistente |
| `makeRouteKey()` | Normaliza `"origem__destino"` para índice |
| `escapeHtml()` | Sanitização XSS para inputs do utilizador |
| `formatKz(value)` | Formata valores em Kwanzas |
| `formatDistance(km)` | Formata distância (m ou km) |
| `labelTime(bucket)` | Traduz bucket de tempo para português |

**16. Deployment**

- Entender `vercel.json`: `cleanUrls: true` remove `.html` das URLs
- Configuração de variáveis de ambiente: via `<meta>` tags no HTML ou `window.TARIFAAO_SUPABASE_*`
- Testar localmente: `python -m http.server 4173 --bind 127.0.0.1`
- Fluxo de deploy: push para GitHub → Vercel detecta automaticamente → build estático

---

### Noite (1–2h) — Revisão Final e Consolidação

**17. Exercício Final: Fazer uma Feature Completa de Memória**

Sem olhar para o código, implementar mentalmente (ou em rascunho):

1. Como adicionar um 6.º app de táxi (ex: "Bolt")
2. Que ficheiros precisariam de ser alterados?
3. Que dados seriam necessários (preço base, per_km, ETA base, disponibilidade, URL)?

**18. Checklist de Domínio**

Verificar se consegues responder a estas perguntas sem consultar o código:

- [ ] Qual é a fórmula exacta de estimativa de tarifa?
- [ ] Quais são os 4 buckets de tempo e os seus multiplicadores?
- [ ] Como funciona o sistema de cache de geocoding?
- [ ] Que dados são guardados no LocalStorage e em que formato?
- [ ] Qual é a diferença entre `supabaseInsert` e `supabaseUpsert`?
- [ ] Como é que o mapa de fundo e o mapa picker são instâncias separadas?
- [ ] Que política RLS impede leituras não autorizadas na Supabase?
- [ ] Como é que o blending de contribuições da comunidade funciona (65/35)?
- [ ] Quais são os 5 modais e quando é que cada um é aberto?
- [ ] Como é que `showView()` funciona sem router?

---

## Referência Rápida — Ficheiros por Prioridade

| Prioridade | Ficheiro | Tamanho | Foco |
|-----------|---------|---------|------|
| 1 | `app.js` | 1602 linhas | Lógica central — ler linha a linha |
| 2 | `styles.css` | 1815 linhas | Design system — ler por secções |
| 3 | `index.html` | 376 linhas | Estrutura — entender hierarquia |
| 4 | `supabase/schema.sql` | ~100 linhas | Base de dados — entender RLS |
| 5 | `README.md` | — | Contexto e decisões de produto |
| 6 | `tarifaao_design_system.md` | — | Filosofia visual |

---

## Dicas de Estudo

- **Usa o DevTools** — inspeciona o DOM enquanto navegas no app para ligar HTML a CSS a JS
- **Adiciona `console.log` temporários** em funções-chave para ver os dados a fluir
- **Lê o código em português** — o projecto usa português angolano em variáveis e comentários
- **Testa casos extremos** — distância 0 km, sem internet, sem geolocalização
- **Acompanha o estado** — o `currentRoute` e `currentResults` são o coração do app; imprime-os no console durante as interacções

---

*Roadmap criado para estudo intensivo de 3 dias — Tarifa.ao v1.01-beta*
