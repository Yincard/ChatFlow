const mongoose = require('mongoose');
const messageSchema = require('../models/Messages')

class DatabaseManager {
	constructor() {
		this.prefix = '[DATABASE]';
		this.messageSchema = messageSchema;
	}
	async connect(mongoURI) {
		mongoose.connect(mongoURI)
		mongoose.connection.once('error', (error) => {
			console.error(error);
			return false;
		})
		mongoose.connection.on('open', () => { return true; });
	}

}

module.exports = DatabaseManager;
