const { ChannelType  } = require("discord.js");
const Event = require('../../../../structures/Event');
require('dotenv').config();

class ParseChat extends Event {
	constructor() {
		super({
			name: 'messageCreate',
			once: false,
		});
	}

	async execute(client, message) {
		
		if (message.author.bot) return;
		if (message.channel.type === ChannelType.DM) return;

		const { id: guildId } = message.guild;
		const { id: channelId } = message.channel;
		const { id: authorId } = message.author;
		const currentDate = new Date();
		currentDate.setDate(currentDate.getDate() - 1);
		const today = currentDate.toISOString().split('T')[0];
		let guildCache = await client.cache.getGuildData(guildId);

		if (!guildCache) {
			guildCache = {
				channels: {
					[channelId]: {
						[today]: {
							[authorId]: 1,
						},
					},
				},
			};

		} else {
			guildCache.channels[channelId] = {
				[today]: {
					...guildCache.channels[channelId]?.[today],
					[authorId]: (guildCache.channels[channelId]?.[today]?.[authorId] || 0) + 1,
				},
			};
		}

		await client.cache.setGuildData(guildId, guildCache);
	}
}

module.exports = ParseChat;
