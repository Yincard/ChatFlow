const { config } = require('dotenv');
config();

class CacheManager {

    constructor(database) {
        this.prefix = '[CACHE]';

        this.database = database;

        this.batchInterval = 15000;
        this.invalidateInterval = 30000;
        this.approveMongoWrite = false;

        this.cache = {
            redisCached: false,
            localCacheQueue: {},
            redisCache: {},
            apiCache: {}
        }

        this.chatKey = process.env.CHAT_KEY
        this.vcKey = process.env.VC_KEY
        
    }

    async bulkReadRedisCache() {
        const keys = await this.database.redis.client.keys(`${this.chatKey}*`)
        const length = keys.length;

        if (length) {
            const rawData = await Promise.all(keys.map(key => this.database.redis.client.get(key)));
            rawData.forEach((data, index) => {
                const guildId = keys[index].split('_')[1];
                this.cache.redisCache[guildId] = JSON.parse(data);
            });
            this.approveMongoWrite = true;
        }

        this.cache.redisCached = true;
    }

    async bulkWriteRedisCache(commands) {
        const multiCommand = this.database.redis.client.multi();

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
        for (const [guildId, channels] of Object.entries(this.cache.localCacheQueue)) {
            const startTime = Date.now();
            let existingData = this.cache.redisCache[guildId] || {};
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
            delete this.cache.localCacheQueue[guildId];
            this.cache.redisCache[guildId] = existingData;
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
        const Messages = this.database.mongoose.messageSchema;
        const bulkOperations = [];
        let startTime;
        for (const key of keys) {
            startTime = Date.now();
            const guildId = key;
            const data = this.cache.redisCache[guildId];
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
                await this.database.redis.client.del(`${this.chatKey}${guildId}`);
                delete this.cache.apiCache[guildId];
                this.cache.redisCache[guildId] = {};
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
            const keys = Object.keys(this.cache.redisCache);
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
            const queueLength = Object.keys(this.cache.localCacheQueue).length;

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