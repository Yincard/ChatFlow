const { ChannelType } = require("discord.js");
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
        if (message.author.bot || message.channel.type === ChannelType.DM) return;

        const today = new Date().toISOString().split('T')[0];
        const { guild, channel, author } = message;
        const { id: guildId } = guild;
        const { id: channelId } = channel;
        const { id: authorId } = author;

        const { batchQueue } = client.cache;

        batchQueue[guildId] ??= {};
        batchQueue[guildId][channelId] ??= {};
        batchQueue[guildId][channelId][today] ??= {};
        batchQueue[guildId][channelId][today][authorId] ??= 0;

        batchQueue[guildId][channelId][today][authorId]++;
    }
}

module.exports = ParseChat;