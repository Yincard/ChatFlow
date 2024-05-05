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


        app.get('/', (req, res) => {
            const availableEndpoints = [
                {
                    method: 'GET', path: '/',
                    description: 'API is up and running'
                },
                {
                    method: 'GET', path: '/guild/:guildId',
                    description: 'Retrieve data for a specific guild'
                },
                {
                    method: 'GET', path: '/guild/:guildId/user/:userId',
                    description: 'Retrieve data for a specific user within a guild'
                },
                {
                    method: 'GET', path: '/guild/:guildId/channel/:channelId/user/:userId',
                    description: 'Retrieve data for a specific user within a specific channel within a guild'
                }
            ];

            let htmlContent = '<h1>Available Endpoints</h1>';
            htmlContent += '<ul>';
            availableEndpoints.forEach(endpoint => {
                htmlContent += `<li><strong>${endpoint.method}</strong> ${endpoint.path} - ${endpoint.description}</li>`;
            });
            htmlContent += '</ul>';

            res.send(htmlContent);
        });

        app.get('/guild/:guildId', async (req, res) => {
            this.prefix = '[Guild Data Route]';
            const guildId = req.params.guildId;

            try {
                let data = this.cache.apiCache[guildId];

                if (!data) {
                    console.log(`${this.prefix} Fetching data for guildId: ${guildId}`);
                    data = await this.MongoDB.messageSchema.findOne({ guildId }, { _id: 0 });

                    if (!data) {
                        const errorData = { error: "No data found" };
                        this.cache.apiCache[guildId] = errorData; // Cache error data
                        console.log(`${this.prefix} Caching error data for guildId: ${guildId}`);
                        return res.json(errorData);
                    }

                    this.cache.apiCache[guildId] = data;
                    console.log(`${this.prefix} Caching data for guildId: ${guildId}`);
                } else {
                    console.log(`${this.prefix} Cache hit for guildId: ${guildId}`);
                }

                return res.json(data);
            } catch (error) {
                console.error(`[Error] ${error.message}`);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        app.get('/guild/:guildId/channel/:channelId/user/:userId', async (req, res) => {
            this.prefix = '[Channel Data Route]';
            const guildId = req.params.guildId;
            const channelId = req.params.channelId;
            const userId = req.params.userId;

            try {
                let data = this.cache.apiCache[guildId];

                if (!data) {
                    console.log(`${this.prefix} Fetching data for guildId: ${guildId}`);
                    data = await this.MongoDB.messageSchema.findOne({ guildId }, { _id: 0 });

                    if (!data) {
                        const errorData = { error: "No data found" };
                        this.cache.apiCache[guildId] = errorData
                        console.log(`${this.prefix} Caching error data for guildId: ${guildId}`);
                        return res.json(errorData);
                    }

                    this.cache.apiCache[guildId] = data;
                    console.log(`${this.prefix} Caching data for guildId: ${guildId}`);
                } else {
                    console.log(`${this.prefix} Cache hit for guildId: ${guildId}`);
                }
                return this.cache.apiCache[guildId].error != "No data found"
                    ? res.json({
                        [guildId]: this.sumCounts(data, userId, [channelId])
                    }) : res.json({ error: "No data found" });

            } catch (error) {
                console.error(`[Error] ${error.message}`);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        })

        app.get('/guild/:guildId/user/:userId', async (req, res) => {
            this.prefix = '[User Data Route]';
            const guildId = req.params.guildId;
            const userId = req.params.userId;

            try {
                let data = this.cache.apiCache[guildId];

                if (!data) {
                    console.log(`${this.prefix} Fetching data for guildId: ${guildId}`);
                    data = await this.MongoDB.messageSchema.findOne({ guildId }, { _id: 0 });

                    if (!data) {
                        const errorData = { error: "No data found" };
                        this.cache.apiCache[guildId] = errorData
                        console.log(`${this.prefix} Caching error data for guildId: ${guildId}`);
                        return res.json(errorData);
                    }

                    this.cache.apiCache[guildId] = data;
                    console.log(`${this.prefix} Caching data for guildId: ${guildId}`);
                } else {
                    console.log(`${this.prefix} Cache hit for guildId: ${guildId}`);
                }
                return this.cache.apiCache[guildId].error != "No data found"
                    ? res.json({ [guildId]: this.sumCounts(data, userId) }) : res.json({ error: "No data found" });

            } catch (error) {
                console.error(`[Error] ${error.message}`);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });
    }

    sumCounts(data, userId, channelIds = null) {
        let sum = 0;

        const iterateOverChannels = channelIds
            ? channelIds.map(channelId => data.channels[channelId]).filter(Boolean)
            : Object.values(data.channels);

        for (const channelData of iterateOverChannels) {
            if (channelData) {
                for (const dateData of Object.values(channelData)) {
                    if (dateData && dateData[userId]) {
                        const userData = dateData[userId];
                        sum += userData.count;
                    }
                }
            }
        }

        return sum;
    }


}

module.exports = APIManager;