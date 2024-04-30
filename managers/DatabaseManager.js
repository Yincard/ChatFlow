const mongoose = require('mongoose');
const messageSchema = require('../models/Messages')

class DatabaseManager {
	constructor() {
		this.prefix = '[DATABASE]';
		this.messageSchema = messageSchema;
	}
	async connect(mongoURI) {
		try {
			await mongoose.connect(mongoURI);
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	}
}

module.exports = DatabaseManager;
