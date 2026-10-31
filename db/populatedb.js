require('dotenv').config();

const bcrypt = require('bcryptjs');

const pool = require('./pool');

async function populateDB() {
	console.log('データベースのセットアップとデータ投入を開始します...');
	try {
		await pool.query(`
            CREATE TABLE IF NOT EXISTS users(
            id SERIAL PRIMARY KEY,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NOT NULL,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            membership_status BOOLEAN DEFAULT false,
            is_admin BOOLEAN DEFAULT false
            );
        `);

		await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            text TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
            );
            `);
		console.log('テーブルの確認・作成が完了しました。');

		await pool.query('DELETE FROM messages;');
		await pool.query('DELETE FROM users;');
		console.log('既存のデータをクリアしました。');

		const hashedPassword = await bcrypt.hash('testpassword123', 10);

		const adminRes = await pool.query(
			`
            INSERT INTO users (first_name, last_name, username, password, membership_status, is_admin)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
			['Admin', 'User', 'adminr@example.com', hashedPassword, true, true],
		);
		const adminId = adminRes.rows[0].id;

		const membersRes = await pool.query(
			`
            INSERT INTO users (first_name, last_name, username, password, membership_status, is_admin)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
			['John', 'Doe', 'member@example.com', hashedPassword, true, false],
		);
		const memberId = membersRes.rows[0].id;

		const guestRes = await pool.query(
			`
            INSERT INTO users (first_name, last_name, username, password, membership_status, is_admin)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
			['Jane', 'Smith', 'guest@example.com', hashedPassword, false, false],
		);
		const guestId = guestRes.rows[0].id;

		console.log('テストユーザーを作成しました。');

		await pool.query(
			`INSERT INTO messages (title, text, user_id) VALUES ($1, $2, $3);`,
			[
				'秘密のクラブへようこそ',
				'ここは会員だけが投稿者の名前を見られる特別な場所です.',
				adminId,
			],
		);
		await pool.query(
			`INSERT INTO messages (title, text, user_id) VALUES ($1, $2, $3)`,
			[
				'初投稿です！',
				'無事にログインしてメッセージが書けるようになりました。',
				memberId,
			],
		);
		await pool.query(
			`
            INSERT INTO messages (title, text, user_id) VALUES ($1, $2, $3);`,
			[
				'誰が書いたでしょう？',
				'非会員からは投稿者が匿名に見えるはずです。',
				guestId,
			],
		);

		console.log('テストメッセージを作成しました。');
		console.log('データベースの初期化とデータ投入が完了しました！');
    } catch (err) {
        console.error('データ投入中にエラーが発生しました:', err);
    } finally {
        await pool.end();
    }   
}

populateDB();
