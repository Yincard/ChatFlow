const Event = require('../../../../structures/Event');
require('dotenv').config();


class parseChat extends Event {
	constructor() {
		super({
			name: 'messageCreate',
			once: false,
		});
	}
	async execute(client, message) {
		if (client.user.id == message.author.id) return;

		const guildId = message.guild.id
		const channelId = message.channel.id
		const authorId = message.author.id
		let currentDate = new Date();
		currentDate.setDate(currentDate.getDate() - 1);
		let today = currentDate.toISOString().split('T')[0];
		const guildCache = await client.cache.getGuildData(guildId)

		if (!guildCache) {
			await client.cache.setGuildData(guildId, {
				channels: {
					[channelId]: {
						[today]: {
							[authorId]: 1,
						},
					},

				}
			})
		} else {

			if (!guildCache.channels[channelId]) {
				guildCache.channels[channelId] = {
					[today]: {
						[authorId]: 1,
					},
				};
			} else {
				guildCache.channels[channelId][today] = {
					...(guildCache.channels[channelId][today] || {}),
					[authorId]: (guildCache.channels[channelId][today]?.[authorId] || 0) + 1,
				};
			}

			await client.cache.setGuildData(guildId, guildCache)

		}
		
	}
}



module.exports = parseChat;


