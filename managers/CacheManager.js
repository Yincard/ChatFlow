const { createClient } = require('redis');

class CacheManager {

    constructor() {
        this.prefix = '[CACHE]';
        this.redisClient;
        this.batchQueue = {};
        this.existingData = {};
        this.batchInterval = 10000;
        this.invalidateInterval = 30000;
    }

    async connect(redisURI) {
        this.redisClient = await createClient({ url: redisURI })
            .on('connect', () => this.log("Established connection with Cache"))
            .on('error', error => this.log("Error in Redis connection:", error))
            .connect();

        await this.bulkReadRedisCache();
    }

    async bulkReadRedisCache() {
        const keys = await this.redisClient.keys('bot_*'),
        length = keys.length; 
        if (length) {
            for (const key of keys) {
                const rawData = await this.redisClient.get(key);
                const guildId = key.split('_')[1];
                this.existingData[guildId] = JSON.parse(rawData);
                console.log(`${this.prefix} Locally Cached Redis-Cache Keys [${length}]`);
            }
        } else {
            console.log(`${this.prefix} Initialized With Empty Redis-Cache`);
        }
    }

    async bulkWriteRedisCache(commands) {
        const multiCommand = this.redisClient.multi();

        commands.forEach(([command, ...args]) => multiCommand[command](...args));

        try {
            const results = await new Promise((resolve, reject) => {
                multiCommand.exec((error, results) => error ? reject(error) : resolve(results));
            });
            return results;
        } catch (error) {
            this.log("Error in bulk write to Redis:", error);
            throw error;
        }
    }

    async parseLocalCache() {

        for (const [guildId, channels] of Object.entries(this.batchQueue)) {

            const bulkOperations = [];
            const key = `bot_${guildId}`;
            let existingData = this.existingData[guildId] || {};

            for (const [channelId, channelData] of Object.entries(channels)) {
                for (const [date, userData] of Object.entries(channelData)) {
                    existingData[channelId] ??= {};
                    existingData[channelId][date] ??= {};

                    for (const [authorId, count] of Object.entries(userData)) {
                        existingData[channelId][date][authorId] ??= 0;
                        existingData[channelId][date][authorId] += count;
                    }
                }
            }

            const value = JSON.stringify(existingData);
            bulkOperations.push(['SET', key, value]);
            delete this.batchQueue[guildId];
            this.existingData[guildId] = existingData;
            this.log(`Redis-Cached Guild Queue: ${guildId}`);
            this.log("Synced Local Memory Storage");

            try {
                await this.bulkWriteRedisCache(bulkOperations);
            } catch (err) {
                this.log("Error while writing Local Cache to Redis Cache for guilds:", err);
            }
        }
    }

    async invalidateRedisCache(client, keys) {
        const batchSize = 50;
        const batches = Array.from({ length: Math.ceil(keys.length / batchSize) }, (_, i) => keys.slice(i * batchSize, (i + 1) * batchSize));
        await Promise.all(batches.map(batch => this.bulkMongoWrite(client, batch)));
    }

    async bulkMongoWrite(client, keys) {

        const Messages = client.database.messageSchema;
        await Promise.all(keys.map(async key => {
            const startTime = Date.now();
            const guildId = key.split('_')[1];
            let data = await this.redisClient.get(key);
            data = JSON.parse(data) || {};

            const filter = { guildId };

            const bulkOperations = Object.entries(data).flatMap(([channelID, channelDataForDates]) =>
                Object.entries(channelDataForDates).flatMap(([date, userData]) =>
                    Object.entries(userData).map(([userId, count]) => ({
                        updateOne: {
                            filter,
                            update: { $inc: { [`channels.${channelID}.${date}.${userId}`]: count } },
                            upsert: true,
                        },
                    }))
                )
            );

            try {
                await Messages.bulkWrite(bulkOperations);
            } catch (err) {
                this.log("Error Bulk Writing Operations:", err);
            }

            try {
                await this.redisClient.del(key);
                this.existingData[guildId] = {}
            } catch (err) {
                this.log("Error deleting Redis key:", err);
            }

            this.log(`Redis cache invalidated & Stored successfully - ${Date.now() - startTime}ms.`);
        }));
    }

    async startInvalidationInterval(client) {
        setInterval(async () => {
            const keys = await this.redisClient.keys('bot_*');
            if (keys.length) {
                this.log("Processing Redis-Cache Queue.");
                try {
                    await this.invalidateRedisCache(client, keys);
                } catch (error) {
                    this.log("Error during cache invalidation and storage:", error);
                }
            } else {
                this.log("No Queued Redis-Cache for Cache Invalidation.");
            }
        }, this.invalidateInterval);
    }

    async startWriteToCacheInterval() {
        setInterval(async () => {
            if (Object.keys(this.batchQueue).length) {
                this.log("Processing Local Memory Queue.");
                try {
                    await this.parseLocalCache();
                    this.log("Cache cleared.");
                } catch (error) {
                    this.log("Error writing to cache:", error);
                }
            } else {
                this.log("No Queued Local Memory Storage to Redis-Cache.");
            }
        }, this.batchInterval);
    }

    log(msg, err) {
        return err ? console.error(`${this.prefix} ${msg}`, err) : console.log(`${this.prefix} ${msg}`)
    }
}

module.exports = CacheManager;
