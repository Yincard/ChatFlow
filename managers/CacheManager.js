const { createClient } = require('redis');

class CacheManager {

    constructor() {
        this.prefix = '[CACHE]';
        this.redisClient;
        this.batchQueue = {};
        this.existingData = {};
        this.batchInterval = 10000; // 5 seconds
        this.invalidateInterval = 5000; // 60 seconds
        this.batchTimeout = null;
    }

    async connect(redisURI) {
        this.redisClient = await createClient({
            url: redisURI
        })
            .on('connect', () => {
                console.log(`${this.prefix} Established connection with Cache`);
            })
            .on('error', (error) => {
                console.error(`${this.prefix} Error in Redis connection:`, error);
            })
            .connect();
        await this.initializeBatchQueueFromRedis();
    }

    async initializeBatchQueueFromRedis() {
        const keys = await this.redisClient.keys('bot_*');

        for (const key of keys) {
            const rawData = await this.redisClient.get(key);
            const guildId = key.split('_')[1];
            this.existingData[guildId] = JSON.parse(rawData);
            console.log(`${this.prefix} Cached Existing Data`);
        }
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

    async bulkWrite(commands) {
        const multiCommand = this.redisClient.multi();

        commands.forEach(([command, ...args]) => {
            multiCommand[command](...args);
        });

        try {
            const results = await new Promise((resolve, reject) => {
                multiCommand.exec((error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results);
                    }
                });
            });
            return results;
        } catch (error) {
            console.error(`${this.prefix} Error in bulk write to Redis:`, error);
            throw error;
        }
    }

    async writeToCache() {
        const bulkOperations = [];

        for (const [guildId, channels] of Object.entries(this.batchQueue)) {
            const key = `bot_${guildId}`;
            let existingData = this.existingData[guildId] || {};

            for (const [channelId, channelData] of Object.entries(channels)) {
                for (const [date, userData] of Object.entries(channelData)) {
                    if (!existingData[channelId]) {
                        existingData[channelId] = {};
                    }

                    if (!existingData[channelId][date]) {
                        existingData[channelId][date] = {};
                    }

                    for (const [authorId, count] of Object.entries(userData)) {
                        if (!existingData[channelId][date][authorId]) {
                            existingData[channelId][date][authorId] = 0;
                        }

                        existingData[channelId][date][authorId] += count;
                    }
                }
            }

            const value = JSON.stringify(existingData);
            bulkOperations.push(['SET', key, value]);

            delete this.batchQueue[guildId];
            this.existingData[guildId] = existingData;
            console.log(`${this.prefix} Synced Existing Local Cache & Deleted Queue for: ${guildId}`);
        }

        try {
            await this.bulkWrite(bulkOperations);
        } catch (err) {
            console.log(`${this.prefix} Error while writing Local Cache to Redis Cache for guilds:`, err);
        }
        console.log(`${this.prefix} Bulk Wrote Local Cache -> Redis Cache`);

        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
    }
    async invalidate(client, keys) {
        const batchSize = 50;
        const batches = [];

        for (let i = 0; i < keys.length; i += batchSize) {
            batches.push(keys.slice(i, i + batchSize));
        }

        await Promise.all(
            batches.map(batch => this.processBatch(client, batch))
        );
    }

    async processBatch(client, keys) {
        const Messages = client.database.messageSchema;

        await Promise.all(
            keys.map(async key => {
                const startTime = Date.now();
                const guildId = key.split('_')[1];
                let data = await this.redisClient.get(key);
                data = JSON.parse(data);

                if (!data) {
                    console.error(`${this.prefix} Data not found for key: ${key}`);
                    return;
                }

                const filter = { guildId };

                const bulkOperations = Object.entries(data)
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
            })
        );
    }

    async startInvalidationInterval(client) {
        setInterval(async () => {
            const keys = await this.redisClient.keys('bot_*');
            if (keys.length) {
                console.log(`${this.prefix} Redis cache beginning to invalidate & store.`);

                try {
                    await this.invalidate(client, keys);
                } catch (error) {
                    console.error(`${this.prefix} Error during cache invalidation and storage:`, error);
                }
            } else {
                console.log(`${this.prefix} No Queued Guilds for Cache Invalidation.`);
            }
        }, this.invalidateInterval);
    }

    async startWriteToCacheInterval() {
        this.batchTimeout = setInterval(async () => {
            if (Object.keys(this.batchQueue).length) {
                console.log(`${this.prefix} Writing to cache...`);
                try {
                    await this.writeToCache();
                    console.log(`${this.prefix} Cache cleared.`);
                } catch (error) {
                    console.error(`${this.prefix} Error writing to cache:`, error);
                }
            } else {
                console.log(`${this.prefix} No data to write to cache.`);
            }
        }, this.batchInterval);
    }
}

module.exports = CacheManager;
