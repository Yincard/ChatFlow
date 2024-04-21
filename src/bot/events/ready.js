const { ActivityType } = require("discord.js");
const Event = require('../../../structures/Event');
require('dotenv').config();

class Ready extends Event {
	constructor() {
		super({
			name: 'ready',
			once: true,
		});
	}
	async execute(client) {

		client.user.presence.set({
			activities: [{ name: "To Your Messages", type: ActivityType.Listening }],
		});

		await client.cache.startInvalidationInterval(client);

	}
}

module.exports = Ready;

