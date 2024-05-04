const { createClient } = require('redis');
const { config } = require('dotenv');
config();

class CacheManager {

    constructor(MongoDB, client = null) {
        this.prefix = '[CACHE]';
        this.client = client;
        this.redisClient;

        this.localCacheQueue = {};
        this.redisCache = {};
        this.apiCache = {}

        this.batchInterval = 15000;
        this.invalidateInterval = 30000;

        this.MongoDB = MongoDB;
        this.approveMongoWrite = false;
        this.redisReady = false;
        this.redisCached = false;

        this.chatKey = process.env.CHAT_KEY
    }

    async connect(redisURI) {
        this.redisClient = await createClient({ url: redisURI })
            .on('connect', async () => {
                this.redisReady = true;
            })
            .on('error', (error) => {
                console.err(error)
            })
            .connect();

        await this.bulkReadRedisCache();
    }

    async bulkReadRedisCache() {
        const keys = await this.redisClient.keys(`${this.chatKey}*`)
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

        this.redisCached = true;
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

                    for (const [authorId, userObj] of Object.entries(userData)) {
                        existingData[channelId][date][authorId] = {
                            count: (existingData[channelId][date][authorId]?.count || 0) + userObj.count,
                            username: userObj.username,
                            avatar: userObj.avatar,
                        };
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
                    for (const [userId, userObj] of Object.entries(userData)) {
                        const updateDocument = {
                            $inc: { [`channels.${channelID}.${date}.${userId}.count`]: userObj.count },
                            $set: {
                                [`channels.${channelID}.${date}.${userId}.username`]: userObj.username,
                                [`channels.${channelID}.${date}.${userId}.avatar`]: userObj.avatar
                            }
                        };

                        bulkOperations.push({
                            updateOne: {
                                filter,
                                update: updateDocument,
                                upsert: true,
                            },
                        });
                    }
                }
            }

            try {
                await this.redisClient.del(`bot_${guildId}`);
                delete this.apiCache[guildId];
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