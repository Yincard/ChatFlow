const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();

class APIManager {

    constructor(MongoDB, cache) {
        this.prefix = '[API]';
        this.MongoDB = MongoDB;
        this.cache = cache;
    }

    connect(port) {
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100
        });

        app.use(limiter);
        app.listen(port);
    }

    setupRoutes() {

        app.get('/guild/:guildId', async (req, res) => {
            const guildId = req.params.guildId;

            try {
                const cachedData = this.cache.apiCache[guildId];
                if (cachedData) {
                    console.log(`${this.prefix} Cache hit for guildId: ${guildId}`);
                    return res.json(cachedData);
                }

                console.log(`${this.prefix} Fetching data for guildId: ${guildId}`);
                const data = await this.MongoDB.messageSchema.findOne({ guildId }, { _id: 0 });

                if (!data) {
                    const errorData = { error: "No data found" };
                    this.cache.apiCache[guildId] = errorData;
                    console.log(`${this.prefix} Caching error data for guildId: ${guildId}`);
                    return res.json(errorData);
                }

                this.cache.apiCache[guildId] = data;
                console.log(`${this.prefix} Caching data for guildId: ${guildId}`);

                return res.json(data);
            } catch (error) {
                console.error(`[Error] ${error.message}`);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });
    }


}

module.exports = APIManager;