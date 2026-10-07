require('dotenv').config();
const session = require('express-session');
const AtlasSessionStore = require('./atlas-session-store');
const express = require('express');
const path = require('path');
const { engine } = require('express-handlebars');

const {
  connectDatabase,
  closeDatabase,
  readDb,
  writeDb
} = require('./db');

const app = express();

const studentName = process.env.STUDENT_NAME;
const studentId = process.env.STUDENT_ID;

if (!studentName || !studentId || !/\d{3}$/.test(studentId)) {
  throw new Error('Kiểm tra STUDENT_NAME và STUDENT_ID trong .env');
}

const codePrefix = studentId.slice(-3);
const vatPercent = Number(studentId.slice(-1)) + 6;

app.engine('handlebars', engine({
  defaultLayout: false,
  helpers: {
    money(value) {
      return Number(value).toLocaleString('vi-VN');
    }
  }
}));

app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
if (!process.env.SESSION_SECRET) {
  throw new Error('Thiếu SESSION_SECRET trong .env');
}

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(session({
  name: 'book.sid',
  secret: process.env.SESSION_SECRET,
  store: new AtlasSessionStore(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.locals.studentName = studentName;
app.locals.studentId = studentId;
app.locals.codePrefix = codePrefix;
app.locals.vatPercent = vatPercent;

async function renderBooks(res, options = {}) {
  // Đọc sách bằng tài khoản reader.
  const books = await readDb
    .collection('books')
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return res.render('home', { books, ...options });
}

app.get('/', async (req, res, next) => {
  try {
    req.session.views = (req.session.views || 0) + 1;

    // Chờ Atlas lưu xong; nếu lỗi sẽ chuyển tới error handler.
    await new Promise((resolve, reject) => {
      req.session.save((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    await renderBooks(res, {
      sessionViews: req.session.views
    });
  } catch (error) {
    next(error);
  }
});

app.post('/books', async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim();
    const title = String(req.body.title || '').trim();
    const rawPrice = String(req.body.price || '').trim();
    const price = Number(rawPrice);

    // Backend từ chối mã sai trước khi ghi database.
    if (!code.startsWith(codePrefix)) {
      res.status(400);

      return await renderBooks(res, {
        error: `Mã sách phải bắt đầu bằng ${codePrefix}.`,
        form: { code, title, price: rawPrice }
      });
    }

    if (!title || !rawPrice || !Number.isFinite(price) || price < 0) {
      res.status(400);

      return await renderBooks(res, {
        error: 'Nhập tên sách và giá hợp lệ, không âm.',
        form: { code, title, price: rawPrice }
      });
    }

    // Tính VAT từ chữ số cuối MSSV trước khi lưu.
    const priceAfterTax = Math.round(
      price * (1 + vatPercent / 100) * 100
    ) / 100;

    const book = {
      code,
      title,
      price,
      vatPercent,
      priceAfterTax,
      createdAt: new Date()
    };

    // Thêm sách bằng tài khoản writer.
    await writeDb.collection('books').insertOne(book);

    console.log(`Writer thêm sách ${code} thành công.`);

    // Trình duyệt quay về GET /, danh sách được đọc bằng reader.
    return res.redirect(303, '/');
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  const safeMessage = String(error.message || '')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[URI đã ẩn]');

  console.error('Loại lỗi:', error.name);
  console.error('Mã lỗi:', error.code || 'N/A');
  console.error('Chi tiết:', safeMessage);

  res.status(500).send(
    'Không thể xử lý yêu cầu. Xem chi tiết trong terminal.'
  );
});

async function start() {
  try {
    await connectDatabase();

    const port = Number(process.env.PORT) || 3000;

    app.listen(port, '0.0.0.0', () => {
      console.log(`Ứng dụng chạy tại http://localhost:${port}`);
      console.log(`Tiền tố mã sách: ${codePrefix}; VAT: ${vatPercent}%`);
    });
  } catch (error) {
    console.error('Khởi động thất bại:', error.name, error.code || '');

    await closeDatabase();
    process.exitCode = 1;
  }
}

start();