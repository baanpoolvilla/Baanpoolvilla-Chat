# Unified Chat Management System

ระบบจัดการแชทรวมศูนย์ รองรับ LINE, Facebook, Instagram, TikTok พร้อม AI Bot อัตโนมัติ

## สถาปัตยกรรม

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Nginx     │────▶│  Next.js 14  │     │  Express API │
│  (Reverse   │     │  (Frontend)  │     │  + Socket.io │
│   Proxy)    │────▶│  Port 3000   │     │  Port 3001   │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │
                                    ┌───────────┼───────────┐
                                    │           │           │
                              ┌─────▼─────┐ ┌───▼───┐ ┌────▼────┐
                              │PostgreSQL │ │ Redis │ │ BullMQ  │
                              │   16      │ │   7   │ │ (Queue) │
                              └───────────┘ └───────┘ └─────────┘
```

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Express 4, TypeScript, Socket.io |
| Database | PostgreSQL 16, Prisma ORM |
| Cache/Queue | Redis 7, BullMQ |
| AI | OpenAI / Anthropic (pluggable) |
| Auth | JWT (access + refresh tokens) |
| Container | Docker Compose |
| Proxy | Nginx (SSL termination) |

## โครงสร้างไฟล์

```
unified-chat/
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf
├── apps/
│   ├── server/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── lib/          (prisma, redis, socket, logger)
│   │       ├── middleware/    (auth, rateLimit, webhookVerify)
│   │       ├── services/     (Message, Conversation, Broadcast, AiBot)
│   │       ├── routes/       (auth, conversations, messages, tags, contacts, broadcast, admins)
│   │       ├── socket/       (chatHandler, presenceHandler)
│   │       └── jobs/         (broadcastWorker)
│   └── web/
│       ├── Dockerfile
│       ├── package.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── types/
│       ├── lib/              (api, socket, utils)
│       ├── hooks/            (useSocket, useAuth, useConversations, useMessages)
│       ├── components/
│       │   ├── layout/       (Sidebar, Header)
│       │   ├── chat/         (ConversationList, ChatWindow, ConversationInfo, ...)
│       │   └── broadcast/    (BroadcastComposer, TargetSelector)
│       └── app/
│           ├── (auth)/login/
│           └── (dashboard)/  (conversations, contacts, broadcast, tags, analytics, settings)
```

---

## การติดตั้งและเริ่มต้นใช้งาน

### ข้อกำหนดเบื้องต้น

- **Docker Desktop** (Windows/Mac) หรือ **Docker Engine + Docker Compose** (Linux)
- **Node.js 20+** (สำหรับ development mode)
- **Git**

### ขั้นตอนที่ 1: Clone และตั้งค่า Environment

```bash
cd unified-chat
cp .env.example .env
```

แก้ไขไฟล์ `.env` ตามต้องการ (ดูรายละเอียดด้านล่าง)

### ขั้นตอนที่ 2: รันด้วย Docker Compose

```bash
docker-compose up -d
```

ระบบจะ:
1. สร้าง PostgreSQL 16 + Redis 7
2. Build และรัน Express API server (port 3001)
3. Build และรัน Next.js frontend (port 3000)
4. รัน Nginx reverse proxy (port 80/443)

### ขั้นตอนที่ 3: Migrate Database + Seed

```bash
docker-compose exec server npx prisma migrate dev --name init
docker-compose exec server npx prisma db seed
```

### ขั้นตอนที่ 4: เข้าใช้งาน

- **URL**: `http://localhost` (หรือ domain ที่ตั้งค่า)
- **Default login**: `admin@chat.local` / `Admin1234!`

---

## Development Mode (ไม่ใช้ Docker)

### Server

```bash
cd apps/server
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

### Web

```bash
cd apps/web
npm install
npm run dev
```

ต้องมี PostgreSQL และ Redis รันอยู่ก่อน (ตั้งค่าใน `.env`)

---

## สิ่งที่คุณต้องทำเพิ่มเติม

### 1. ตั้งค่า LINE Official Account

1. ไปที่ [LINE Developers Console](https://developers.line.biz/)
2. สร้าง Messaging API Channel
3. คัดลอก **Channel ID**, **Channel Secret**, **Channel Access Token**
4. ใส่ใน `.env`:
   ```
   LINE_CHANNEL_ID=xxx
   LINE_CHANNEL_SECRET=xxx
   LINE_CHANNEL_ACCESS_TOKEN=xxx
   ```
5. ตั้ง **Webhook URL**: `https://your-domain.com/api/webhooks/line`
6. เปิด **Use webhook** และปิด **Auto-reply messages**

### 2. ตั้งค่า Facebook Page

1. ไปที่ [Meta for Developers](https://developers.facebook.com/)
2. สร้าง App → เพิ่ม product **Messenger**
3. เชื่อมต่อ Facebook Page และรับ **Page Access Token**
4. ใส่ใน `.env`:
   ```
   META_APP_SECRET=xxx
   META_PAGE_ACCESS_TOKEN=xxx
   META_VERIFY_TOKEN=your-random-string
   ```
5. ตั้ง **Webhook URL**: `https://your-domain.com/api/webhooks/facebook`
6. เลือก subscribe events: `messages`, `messaging_postbacks`

### 3. ตั้งค่า Instagram Business

1. ใช้ Meta App เดียวกับ Facebook
2. เพิ่ม product **Instagram** ใน App settings
3. เชื่อมต่อ Instagram Business Account
4. ตั้ง **Webhook URL**: `https://your-domain.com/api/webhooks/instagram`
5. Token เดียวกับ Facebook (Meta unified token)

### 4. ตั้งค่า TikTok Business

1. ไปที่ [TikTok for Developers](https://developers.tiktok.com/)
2. สร้าง App และขอ **Business API access**
3. ใส่ใน `.env`:
   ```
   TIKTOK_CLIENT_KEY=xxx
   TIKTOK_CLIENT_SECRET=xxx
   TIKTOK_ACCESS_TOKEN=xxx
   ```
4. ตั้ง **Webhook URL**: `https://your-domain.com/api/webhooks/tiktok`

### 5. ตั้งค่า SSL Certificate

สำหรับ production ต้องมี SSL (webhook platforms ต้องการ HTTPS):

**Option A: Let's Encrypt (แนะนำ)**
```bash
# ติดตั้ง certbot
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# Certificate จะอยู่ที่:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

แก้ `nginx/nginx.conf` ให้ชี้ไปที่ certificate paths

**Option B: Cloudflare SSL**
ใช้ Cloudflare proxy เพื่อจัดการ SSL โดยไม่ต้อง cert ฝั่ง server

### 6. ตั้งค่า AI Bot (ไม่บังคับ)

**OpenAI:**
1. ไปที่ [OpenAI Platform](https://platform.openai.com/)
2. สร้าง API Key
3. ใส่ใน `.env`:
   ```
   AI_PROVIDER=OPENAI
   OPENAI_API_KEY=sk-xxx
   AI_MODEL=gpt-4o-mini
   ```

**Anthropic:**
1. ไปที่ [Anthropic Console](https://console.anthropic.com/)
2. สร้าง API Key
3. ใส่ใน `.env`:
   ```
   AI_PROVIDER=ANTHROPIC
   ANTHROPIC_API_KEY=sk-ant-xxx
   AI_MODEL=claude-3-haiku-20240307
   ```

หรือตั้งค่าผ่านหน้า **Settings > AI Bot** ในเว็บ

### 7. ตั้งค่า Domain และ DNS

1. ซื้อ domain name
2. ชี้ A record ไปที่ IP ของ server
3. แก้ `nginx/nginx.conf` เปลี่ยน `server_name` เป็น domain ของคุณ

### 8. Prisma Migrations

เมื่อแก้ไข schema.prisma:
```bash
npx prisma migrate dev --name your_migration_name
```

Production:
```bash
npx prisma migrate deploy
```

---

## API Endpoints

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| POST | `/api/auth/login` | เข้าสู่ระบบ |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/conversations` | รายการสนทนา (พร้อม filters) |
| GET | `/api/conversations/:id` | รายละเอียดสนทนา |
| PUT | `/api/conversations/:id` | อัปเดตสนทนา |
| POST | `/api/conversations/:id/assign` | มอบหมายสนทนา |
| POST | `/api/conversations/:id/tags` | เพิ่มแท็ก |
| GET | `/api/messages/:conversationId` | รายการข้อความ |
| POST | `/api/messages/:conversationId` | ส่งข้อความ |
| GET | `/api/contacts` | รายการผู้ติดต่อ |
| GET | `/api/tags/categories` | หมวดหมู่แท็ก |
| POST | `/api/broadcasts` | สร้าง broadcast |
| POST | `/api/broadcasts/:id/send` | ส่ง broadcast |
| POST | `/api/admins` | สร้างผู้ดูแล (SUPER_ADMIN) |
| POST | `/api/webhooks/line` | LINE webhook |
| POST | `/api/webhooks/facebook` | Facebook webhook |
| POST | `/api/webhooks/instagram` | Instagram webhook |
| POST | `/api/webhooks/tiktok` | TikTok webhook |

## Socket.io Events

| Event | ทิศทาง | คำอธิบาย |
|-------|--------|----------|
| `new-message` | Server → Client | ข้อความใหม่ |
| `conversation-updated` | Server → Client | สนทนาอัปเดต |
| `send-message` | Client → Server | ส่งข้อความ |
| `join-conversation` | Client → Server | เข้าร่วมห้อง |
| `leave-conversation` | Client → Server | ออกจากห้อง |
| `typing` | Client → Server | กำลังพิมพ์ |
| `admin-typing` | Server → Client | แอดมินกำลังพิมพ์ |
| `admin-online` | Server → Client | แอดมินออนไลน์ |
| `admin-offline` | Server → Client | แอดมินออฟไลน์ |

---

## สิ่งที่สามารถเพิ่มเติมในอนาคต

- [ ] **Analytics API** - สร้าง endpoint สำหรับ dashboard สถิติขั้นสูง (messages/day, response time, platform distribution)
- [ ] **File upload** - รองรับอัปโหลดไฟล์/รูปภาพผ่าน S3/MinIO แทน URL
- [ ] **Email notifications** - แจ้งเตือนทางอีเมลเมื่อมีข้อความใหม่
- [ ] **Quick replies / Templates** - ข้อความสำเร็จรูปสำหรับตอบเร็ว
- [ ] **Customer satisfaction** - ระบบ rating หลังจบสนทนา
- [ ] **Multi-language** - i18n สำหรับ UI หลายภาษา
- [ ] **Audit log** - บันทึกการดำเนินการของผู้ดูแล
- [ ] **Export data** - ส่งออกข้อมูลเป็น CSV/Excel
- [ ] **Webhook retry** - ระบบ retry สำหรับ webhook ที่ส่งไม่สำเร็จ
- [ ] **Rate limit per platform** - จำกัดอัตราการส่งตาม quota ของแต่ละแพลตฟอร์ม

---

## Troubleshooting

**Docker build ช้า?**
```bash
# ใช้ BuildKit
DOCKER_BUILDKIT=1 docker-compose build
```

**Database connection error?**
```bash
# ตรวจสอบ PostgreSQL container
docker-compose logs postgres
# ตรวจสอบ connection string ใน .env
```

**Webhook ไม่ทำงาน?**
- ตรวจสอบว่า URL เป็น HTTPS
- ตรวจสอบ verify token (Facebook/Instagram)
- ตรวจสอบ channel secret (LINE)
- ดู logs: `docker-compose logs server`

**Socket.io ไม่เชื่อมต่อ?**
- ตรวจสอบ nginx config มี WebSocket upgrade headers
- ตรวจสอบ CORS settings ใน server

---

## License

Private - Internal use only
