const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

exports.getSignup = (req, res) => {
	res.render('sign-up');
};

exports.postSignup = [
	body('firstName')
		.trim()
		.notEmpty()
		.withMessage('First name is required.')
		.escape(),
	body('lastName')
		.trim()
		.notEmpty()
		.withMessage('Last name is required.')
		.escape(),
	body('username')
		.trim()
		.isEmail()
		.withMessage('Please enter a valid email address')
		.normalizeEmail(),
	body('password')
		.isLength({ min: 6 })
		.withMessage('Password must be more than 6 characters.'),

	body('confirmPassword').custom((value, { req }) => {
		if (value !== req.body.password) {
			throw new Error('Password does not match.');
		}
		return true;
	}),

	async (req, res) => {
		const errors = validationResult(req);

		if (!errors.isEmpty()) {
			return res.render('sign-up', {
				errors: errors.array(),
				formData: req.body,
			});
		}
		try {
			const { firstName, lastName, username, password, isAdmin } = req.body;
			const hashedPassword = await bcrypt.hash(password, 10);
			const adminStatus = isAdmin === "true";

			await pool.query(
				`
                INSERT INTO users (first_name, last_name, username, password, membership_status, is_admin)
                VALUES ($1, $2, $3, $4, $5, $6)`,
				[firstName, lastName, username, hashedPassword, false, adminStatus],
			);
			res.redirect('/log-in');
		} catch (err) {
			console.error(
				'User registration error: This email address may already be in use.',
				err,
			);
			res.status(500).render('sign-up', {
				errors: [{ msg: 'A database error occurred. Please try again.' }],
				formData: req.body,
			});
		}
	},
];

exports.getLogIn = (req, res) => {
	res.render('log-in');
};

exports.getJoinClub = (req, res) => {
	if (!req.isAuthenticated()) {
		return res.redirect('/log-in');
	}
	res.render('join-club');
};

exports.postJoinClub = async (req, res) => {
	if (!req.isAuthenticated()) {
		return res.redirect('/log-in');
	}
	const { passcode } = req.body;
	const SECRET_CODE = process.env.CLUB_PASSCODE || 'secretclub';

	if (passcode === SECRET_CODE) {
		try {
			await pool.query(
				'UPDATE users SET membership_status = true WHERE id = $1',
				[req.user.id],
			);
			return res.redirect('/');
		} catch (err) {
			console.error(err);
			return res.render('join-club', {
				error: 'A database error has occurred.',
			});
		}
	} else {
		return res.render('join-club', {
			error: 'The membership code is incorrect!',
		});
	}
};

exports.deleteMessage = async (req, res) => {
    if (!req.isAuthenticated() || !req.user.is_admin) {
        return res.status(403).send('Access denied. Admins only.')
    }
    const messageId = req.params.id;

    try {
        await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
        res.redirect('/')
    } catch (err) {
        console.error('Message deletion error:', err);
        res.status(500).send('A database error occurred while deleting the message.')
    }
}

exports.getCreateMessage = (req, res) => {
	if (!req.isAuthenticated()) {
		return res.redirect('/log-in')
	}
	res.render('create-message')
}

exports.postCreateMessage = [
	(req, res, next) => {
		if (!req.isAuthenticated()) {
			return res.redirect('/log-in')
		}
		next()
	},

	body('title').trim().notEmpty().withMessage('Title is required.').escape(),
	body('text').trim().notEmpty().withMessage('Message text is required.').escape(),

	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.render('create-message', {
				errors: errors.array(),
				formData: req.body
			});
		}
		try {
			const { title, text } = req.body;
			const userId = req.user.id;
			await pool.query(`INSERT INTO messages (title, text, user_id) VALUES ($1, $2, $3)`,
				[title, text, userId]
			);
			res.redirect('/')
		} catch (err) {
			console.error('Message creation error:', err);
			res.status(500).render('create-message', {
				errors: [
					{ msg: 'A database error occurred while creating the message.' },
				],
				formData: req.body
			});
		}
	}

]