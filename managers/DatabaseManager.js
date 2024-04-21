const mongoose = require('mongoose');
const messageSchema = require('../models/Messages')

class DatabaseManager {
	constructor() {
		this.prefix = '[DATABASE]';
		this.messageSchema = messageSchema;
		this.localCache = {
			guildId: String,
			channels: {
				[String]: {
					[String]: {
						[String]: Number,
					},
				},
			},
		}
	}
	async connect(mongoURI) {
		mongoose.connect(mongoURI)
		mongoose.connection.once('error', console.error);
		mongoose.connection.on('open', () => {
			console.log(`${this.prefix} Established connection with database`);
		});
	}
	
}

module.exports = DatabaseManager;