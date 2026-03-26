# HCH Restaurant

HCH Restaurant la he thong menu QR + trang admin quan ly nha hang duoc xay dung bang Next.js.

Project hien co cac khu vuc chinh:

- `app/page.tsx`: giao dien menu cho khach hang
- `app/admin/page.tsx`: trang quan tri san pham, danh muc, don hang, tai khoan
- `app/kitchen/page.tsx`: giao dien bep
- `app/api/*`: cac API cho auth, menu, categories, orders, accounts
- `data/*`: du lieu JSON seed/fallback
- `lib/*`: auth, mailer, MySQL, dong bo catalog, admin store

## Tinh nang chinh

- Dang nhap admin va OTP 2FA
- Quan ly san pham va danh muc
- Menu cho khach quet QR
- Tao va theo doi don hang
- Giao dien bep de xem va xu ly mon
- Luu tru MySQL va tu dong tuong thich voi mot so schema cu

## Cong nghe su dung

- Next.js 16
- React 19
- TypeScript
- MySQL (`mysql2`)
- JWT (`jsonwebtoken`)
- Nodemailer
- Chart.js

## Yeu cau moi truong

Can cai san:

- Node.js 20+
- npm
- MySQL / XAMPP MySQL
- Git

## Cai dat project

Tai thu muc project, chay:

```bash
npm install
```

## Cau hinh env

Tao file `.env.local` dua tren `.env.example` va dien cac gia tri can thiet.

Vi du:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=hch_restaurant

JWT_SECRET=change-this-to-a-long-random-secret-key

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-gmail-app-password
SMTP_FROM=your-gmail@gmail.com
```

Luu y:

- `.env.local` dang duoc ignore, se khong bi day len GitHub
- Neu bat 2FA cho admin thi can cau hinh `SMTP_PASS` bang Gmail App Password that

## Chay project

Chay development server:

```bash
npm run dev
```

Sau do mo:

- Menu khach hang: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- Kitchen: `http://localhost:3000/kitchen`

## Lenh huu ich

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Ghi chu du lieu

- `menu_items`, `categories`, `orders`, `accounts` dang doc/ghi tu MySQL
- `data/*.json` duoc dung lam seed/fallback cho mot so truong hop
- App da duoc cap nhat de dong bo lai danh muc tu `menu_items` khi can

## Day code len GitHub lan dau

Project da duoc noi voi repo:

```bash
https://github.com/conghuy62324-design/DACS.git
```

## Workflow cap nhat GitHub ve sau

Mình da them 2 script de ban chi can chay 2 lenh:

### 1. Tao commit moi

```bash
npm run git:save -- "cap nhat noi dung"
```

Vi du:

```bash
npm run git:save -- "fix admin va dong bo orders"
```

### 2. Day len GitHub

```bash
npm run git:publish
```

## Script Git da them

- `scripts/git-save.ps1`: add + commit tat ca thay doi
- `scripts/git-publish.ps1`: push len nhanh `main`

## Neu muon update moi nhat trong tuong lai

Moi lan sua code xong, chi can:

```bash
npm run git:save -- "mo ta thay doi"
npm run git:publish
```

## Luu y an toan khi push

Khong day len GitHub:

- `.env.local`
- `node_modules`
- `.next`

Da duoc cau hinh trong [`.gitignore`](c:/Users/PC/hch-restaurant/.gitignore).

## Cau truc thu muc

```text
app/
  admin/
  api/
  kitchen/
  pay/
  qr/
data/
lib/
public/
scripts/
```

## Gop y

Neu ban muon, co the bo sung tiep:

- README co hinh anh giao dien
- file huong dan deploy len Vercel / VPS
- script backup database MySQL
