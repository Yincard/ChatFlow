const mongoose = require('mongoose');
const { createClient } = require('redis');
require('dotenv').config();

const messageSchema = require('../models/Messages')

class DatabaseManager {
	constructor() {
		this.prefix = '[DATABASE]';

		this.mongoose = {
			messageSchema: messageSchema,
			mongoReady: false
		}

		this.redis = {
			client: null,
			redisReady: false,
		}

	}
	async reqMongoose(mongoURI) {

		try {
			await mongoose.connect(mongoURI);
			this.mongoose.mongoReady = true;
		} catch (error) {
			console.error(error);
		}
		return this.mongoReady;
	}

	async reqRedis(redisURI) {
		this.redis.client = await createClient({ url: redisURI })
			.on('connect', async () => {
				this.redis.redisReady = true;
			})
			.on('error', (error) => {
				console.err(error)
			})
			.connect();
		return this.redis.redisReady;
	}
	

	
}

module.exports = DatabaseManager;
