const { createClient } = require('redis');
const { config } = require('dotenv');
config();

class CacheManager {

    constructor(MongoDB) {
        this.prefix = '[CACHE]';
        this.redisClient;
        this.localCacheQueue = {};
        this.redisCache = {};
        this.batchInterval = 15000;
        this.invalidateInterval = 30000;
        this.chatKey = process.env.CHAT_KEY
        this.MongoDB = MongoDB;
        this.approveMongoWrite = false;
    }

    async connect(redisURI) {
        this.redisClient = await createClient({ url: redisURI })
            .on('connect', () => { return true; })
            .on('error', (error) => {
                this.log("Error in Redis connection:", error)
                return false;
            })
            .connect();

        await this.bulkReadRedisCache();
    }

    async bulkReadRedisCache() {
        const keys = await this.redisClient.keys(`${this.chatKey}*`);
        const length = keys.length;

        if (length) {
            const rawData = await Promise.all(keys.map(key => this.redisClient.get(key)));
            rawData.forEach((data, index) => {
                const guildId = keys[index].split('_')[1];
                this.redisCache[guildId] = JSON.parse(data);
            });
            this.log(`Locally Cached Redis-Cache Keys [${length}]`);
            this.approveMongoWrite = true;
        } else {
            this.log("Initialized With Empty Redis-Cache");
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
        for (const [guildId, channels] of Object.entries(this.localCacheQueue)) {
            const startTime = Date.now();
            let existingData = this.redisCache[guildId] || {};
            const bulkOperations = [];

            for (const [channelId, channelData] of Object.entries(channels)) {
                existingData[channelId] ??= {};

                for (const [date, userData] of Object.entries(channelData)) {
                    existingData[channelId][date] ??= {};

                    for (const [authorId, count] of Object.entries(userData)) {
                        existingData[channelId][date][authorId] = (existingData[channelId][date][authorId] || 0) + count;
                    }
                }
            }

            const value = JSON.stringify(existingData);
            bulkOperations.push(['SET', `bot_${guildId}`, value]);
            delete this.localCacheQueue[guildId];
            this.redisCache[guildId] = existingData;
            this.approveMongoWrite = true;
            this.log(`Redis-Cached Local Storage - ${Date.now() - startTime}ms.`);
            this.log("Synced Local Memory Storage");

            try {
                await this.bulkWriteRedisCache(bulkOperations);
            } catch (err) {
                this.log("Error while writing Local Cache to Redis Cache for guilds:", err);
            }
        }
    }

    async invalidateRedisCache(keys) {
        const batchSize = 50;
        const batches = Array.from({ length: Math.ceil(keys.length / batchSize) }, (_, i) => keys.slice(i * batchSize, (i + 1) * batchSize));
        await Promise.all(batches.map(batch => this.bulkMongoWrite(batch)));
    }

    async bulkMongoWrite(keys) {
        const Messages = this.MongoDB.messageSchema;
        const bulkOperations = [];
        let startTime;
        for (const key of keys) {
            startTime = Date.now();
            const guildId = key;
            const data = this.redisCache[guildId];
            const filter = { guildId };


            for (const [channelID, channelDataForDates] of Object.entries(data)) {
                for (const [date, userData] of Object.entries(channelDataForDates)) {
                    for (const [userId, count] of Object.entries(userData)) {
                        bulkOperations.push({
                            updateOne: {
                                filter,
                                update: { $inc: { [`channels.${channelID}.${date}.${userId}`]: count } },
                                upsert: true,
                            },
                        });
                    }
                }
            }

            try {
                await this.redisClient.del(`bot_${guildId}`);
                this.redisCache[guildId] = {};
                this.approveMongoWrite = false;
            } catch (err) {
                this.log("Error deleting Redis key:", err);
            }
        }
        this.log(`Redis Cache Invalidated - ${Date.now() - startTime}ms.`);

        try {
            await Messages.bulkWrite(bulkOperations);

        } catch (err) {
            this.log("Error Bulk Writing Operations:", err);
        }
    }

    async startInvalidationInterval() {
        setInterval(async () => {
            const keys = Object.keys(this.redisCache);
            const length = keys.length;

            if (length && this.approveMongoWrite) {
                this.log("Processing Redis-Cache Queue.");
                try {
                    await this.invalidateRedisCache(keys);
                } catch (error) {
                    this.log("Error during cache invalidation and storage:", error);
                }
            }
        }, this.invalidateInterval);
    }

    async startWriteToCacheInterval() {
        setInterval(async () => {
            const queueLength = Object.keys(this.localCacheQueue).length;

            if (queueLength) {
                this.log("Processing Local Memory Queue.");
                try {
                    await this.parseLocalCache();
                    this.log("Cache cleared.");
                } catch (error) {
                    this.log("Error writing to cache:", error);
                }
            }
        }, this.batchInterval);
    }

    log(msg, err) {
        return err ? console.error(`${this.prefix} ${msg}`, err) : console.log(`${this.prefix} ${msg}`)
    }
}

module.exports = CacheManager;