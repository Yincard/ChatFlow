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

        const currentDate = new Date();
        const today = currentDate.toISOString().split('T')[0];

        const { id: guildId } = message.guild;
        const { id: channelId } = message.channel;
        const { id: authorId } = message.author;

        if (!client.cache.batchQueue[guildId]) {
            client.cache.batchQueue[guildId] = {};
        }

        if (!client.cache.batchQueue[guildId][channelId]) {
            client.cache.batchQueue[guildId][channelId] = {};
        }

        if (!client.cache.batchQueue[guildId][channelId][today]) {
            client.cache.batchQueue[guildId][channelId][today] = {};
        }

        if (!client.cache.batchQueue[guildId][channelId][today][authorId]) {
            client.cache.batchQueue[guildId][channelId][today][authorId] = 0; // Initialize to 0
        }

        client.cache.batchQueue[guildId][channelId][today][authorId]++; // Increment count
    }
}

module.exports = ParseChat;
