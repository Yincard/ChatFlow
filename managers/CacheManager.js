const { createClient } = require('redis');

class CacheManager {

    constructor() {
        this.prefix = '[CACHE]';
        this.redisClient;
    }

    async connect(redisURI) {
        this.redisClient = await createClient({
                url: redisURI
            })
            .on('connect', () => {
                console.log(`${this.prefix} Established connection with Cache`);
            })
            .connect();
    }

    async setGuildData(guildID, data) {
        const key = `bot_${guildID}`;
        const value = JSON.stringify(data);
        await this.redisClient.set(key, value);
    }

    async getGuildData(guildID) {
        const key = `bot_${guildID}`;
        const data = await this.redisClient.get(key);
        return data ? JSON.parse(data) : false;
    }

    async invalidate(client, keys) {
        const Messages = client.database.messageSchema;

        for (const key of keys) {

            const startTime = Date.now();
            const guildId = key.split('_')[1];
            let data = await this.redisClient.get(key);
            data = JSON.parse(data);
            const filter = { guildId };

            const bulkOperations = Object.entries(data.channels)
                .flatMap(([channelID, channelDataForDates]) =>
                    Object.entries(channelDataForDates)
                        .flatMap(([date, userData]) =>
                            Object.entries(userData)
                                .map(([userId, count]) => ({
                                    updateOne: {
                                        filter,
                                        update: {
                                            $inc: {
                                                [`channels.${channelID}.${date}.${userId}`]: count,
                                            },
                                        },
                                        upsert: true,
                                    },
                                }))
                        )
                );

            try {
                await Messages.bulkWrite(bulkOperations);
            } catch (err) {
                console.error(`${this.prefix} Error Bulk Writing Operations:`, err);
            }

            try {
                await this.redisClient.del(key);
            } catch (err) {
                console.error(`${this.prefix} Error deleting Redis key:`, err);
            }

            console.log(`${this.prefix} Redis cache invalidated successfully for: ${guildId} - ${Date.now() - startTime}ms.`);
        }
    }

    async startInvalidationInterval(client) {
        setInterval(async () => {
            const keys = await this.redisClient.keys('bot_*');
            if (keys.length) {
                console.log(`${this.prefix} Redis cache beginning to invalidate & store.`);
                await this.invalidate(client, keys);
            } else {
                console.log(`${this.prefix} No Queued Guilds for Cache Invalidation.`);
            }
        }, 10000);
    }

}

module.exports = CacheManager;
