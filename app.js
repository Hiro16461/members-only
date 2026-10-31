require('dotenv').config();

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const pool = require('./db/pool');

const userController = require('./controllers/userController');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
	session({
		secret: process.env.SESSION_SECRET || 'cats',
		resave: false,
		saveUninitialized: false,
	}),
);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
	new LocalStrategy(async (username, password, done) => {
		try {
			const { rows } = await pool.query(
				'SELECT * FROM users WHERE username = $1',
				[username],
			);
			const user = rows[0];

			if (!user) {
				return done(null, false, { message: 'Wrong email address.' });
			}

			const match = await bcrypt.compare(password, user.password);
			if (!match) {
				return done(null, false, { message: 'Wrong password.' });
			}
			return done(null, user);
		} catch (err) {
			return done(err);
		}
	}),
);

passport.serializeUser((user, done) => {
	done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
	try {
		const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [
			id,
		]);
		done(null, rows[0]);
	} catch (err) {
		done(err);
	}
});

app.use((req, res, next) => {
	res.locals.currentUser = req.user;
	next();
});

app.get('/', async (req, res) => {
	try {
		const { rows: messages } = await pool.query(`
            SELECT messages.*, users.first_name, users.last_name, users.username
            FROM messages
            JOIN users ON messages.user_id = users.id
            ORDER BY timestamp DESC;`);
		res.render('index', { messages });
	} catch (err) {
		console.error(err);
		res.status(500).send('Server error happens.');
	}
});

app.get('/sign-up', userController.getSignup)
app.post('/sign-up', userController.postSignup);
app.get('/log-in', userController.getLogIn);
app.post('/log-in', passport.authenticate('local', {
    successRedirect: "/",
    failureRedirect: "/log-in"
}))
app.get('/log-out', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err) }
        res.redirect('/')
    })
})
app.get('/join-club', userController.getJoinClub);
app.post('/join-club', userController.postJoinClub);
app.post('/messages/:id/delete', userController.deleteMessage);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    
})