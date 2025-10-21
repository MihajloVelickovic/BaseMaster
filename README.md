# Base Master

Browser-bazirana edukativna igrica za vežbanje konverzije brojnih sistema (binarni, decimalni, heksadecimalni, itd.). Igrači se takmiče u real-time multiplayer lobijima. Edukativna i zabavna za sve uzraste! (3-103)

## Sadržaj

- [Tehnologije](#tehnologije)
- [Preduslovi](#preduslovi)
- [Instalacija](#instalacija)
- [Konfiguracija](#konfiguracija)
- [Pokretanje](#pokretanje)
- [Struktura Projekta](#struktura-projekta)

## Tehnologije

**Frontend:** React 19 + TypeScript, Bootstrap 5, WebSockets

**Backend:** Node.js + Express + TypeScript, WebSocket, Neo4j, Redis

**Autentifikacija:** JWT tokeni

## Preduslovi

Potrebno je da imate instalirano:

- **Node.js** (v16 ili noviji)
- **npm** (v8 ili noviji)

## Instalacija

### 1. Kloniranje Repozitorijuma

```bash
git clone <repository-url>
cd BaseMaster
```

### 2. Instalacija Backend Zavisnosti

```bash
cd server
npm install
```

### 3. Instalacija Frontend Zavisnosti

```bash
cd ../client/app
npm install
```

## Konfiguracija

### Backend Konfiguracija

Kreirajte `config.env` fajl u `server/app/` direktorijumu:

```env
# Server
SERVER_PORT=1738

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=vasa_neo4j_lozinka
NEO4J_DATABASE=neo4j

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secrets
JWT_SECRET=vas_access_token_secret
JWT_REFRESH=vas_refresh_token_secret
```

**Napomena:** Generišite sigurne JWT secret-e pomoću `openssl rand -base64 32`

### Frontend Konfiguracija

Ako promenite backend port, ažurirajte baseURL u `client/app/src/utils/axiosInstance.ts`:

```typescript
const instance = axios.create({
  baseURL: 'http://127.0.0.1:1738',
});
```

## Pokretanje

### 1. Pokretanje Backend Servera

```bash
cd server
npm run dev
```

Server će se pokrenuti na portu 1738. Očekivani output:
```
Server running on port 1738
Redis connected
Neo4j connection successful
```

### 2. Pokretanje Frontend-a

U novom terminalu:

```bash
cd client/app
npm start
```

Aplikacija će se otvoriti na `http://localhost:3000`

### 3. Inicijalizacija Baze (Prvi Put)

Server će automatski inicijalizovati Neo4j strukturu i pri svakom narednom pokretanju osigurava konzistentnost strukture.

## Struktura Projekta

```
BaseMaster/
├── client/app/          # React frontend
│   ├── src/
│   │   ├── components/  # React komponente
│   │   ├── utils/       # Context-i i utility-ji
│   │   └── shared_modules/  # Deljeni enum-i
│   └── package.json
│
└── server/              # Express backend
    ├── app/
    │   ├── routers/     # API endpoint-i
    │   ├── graph/       # Neo4j repository sloj
    │   ├── utils/       # Servisi
    │   ├── config/      # Konfiguracija
    │   └── index.ts     # Server entry point
    └── package.json
```

## Režimi Igre

- **Classic**: Konverzija iz decimalne u ciljnu bazu
- **Reverse**: Konverzija iz ciljne baze u decimalnu
- **Chaos**: Random baze za svaku rundu

## Nivoi Težine

- **Layman**: Početni nivo
- **Chill Guy**: Srednji nivo
- **ELFAK Enjoyer**: Napredni nivo
- **Based Master**: Ekspertski nivo

## Troubleshooting

**Backend se ne pokreće:**
- Proverite `config.env` kredencijale
- Proverite da je port 1738 dostupan
- Proverite konekciju sa Neo4j i Redis instance

**Frontend ne može da se konektuje:**
- Proverite da je backend pokrenut
- Proverite baseURL u `axiosInstance.ts`

**Problemi sa bazom:**
- Proverite Neo4j i Redis korisničke podatke u `config.env`
- Proverite da su hostovane instance dostupne