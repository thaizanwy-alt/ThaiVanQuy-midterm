const {
  connectDatabase,
  closeDatabase,
  readDb,
  writeDb
} = require('./db');

async function main() {
  try {
    await connectDatabase();

    const books = await readDb
      .collection('books')
      .find({})
      .toArray();

    console.log('Reader đọc books thành công.');
    console.log('Số sách hiện có:', books.length);

    try {
      await writeDb.collection('books').findOne({});

      console.error(
        'CHƯA ĐÚNG: Writer có quyền đọc. Kiểm tra lại role Atlas.'
      );

      process.exitCode = 1;
    } catch (error) {
      if (
  error.code === 13 ||
  (
    error.code === 8000 &&
    /not authorized|unauthorized|not allowed to do action/i.test(error.message)
  )
) {
        console.log(
          'ĐÚNG PHÂN QUYỀN: Writer bị từ chối đọc books.'
        );
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Kiểm tra thất bại. Mã lỗi:', error.code || 'N/A');
    console.error(
      'Kiểm tra URI, mật khẩu, IP Access List và quyền Atlas.'
    );
    console.error('Nội dung lỗi:', error.message);

    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

main();