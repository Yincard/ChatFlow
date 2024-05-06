const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();
const { displayRoutes, fetchChatData, filterChatData } = require('./helpers/APIUtil');

class APIManager {
    constructor(database, cache) {
        this.database = database;
        this.cacheManager = cache;
        this.limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 500
        });
        this.serverReady = false;
    }

    connect(port) {
        app.use(this.limiter);
        app.listen(port);
        this.setupRoutes();
        this.serverReady = true;
    }

    setupRoutes() {
        app.get('/', (req, res) => res.send(displayRoutes()));

        app.get('/guild/:guildId', async (req, res) => {
            const { guildId } = req.params;
            const data = await fetchChatData(this.database, this.cacheManager, guildId, '[Guild Data Route]');
            if (data.error) return res.json(data);
            return res.json(filterChatData(data));
        });

        app.get('/guild/:guildId/user/:userId', async (req, res) => {
            const { guildId, userId } = req.params;
            const data = await fetchChatData(this.database, this.cacheManager, guildId, '[User Data Route]');
            if (data.error) return res.json(data);
            return res.json(filterChatData(data, userId));
        });


        app.get('/guild/:guildId/user/:userId/channel/:channelId', async (req, res) => {
            const { guildId, userId, channelId } = req.params;
            const data = await fetchChatData(this.database, this.cacheManager, guildId, '[Channel User Data Route]');
            if (data.error) return res.json(data);
            return res.json(filterChatData(data, userId, channelId));
        });

        app.get('/guild/:guildId/channel/:channelId', async (req, res) => {
            const { guildId, channelId } = req.params;
            const data = await fetchChatData(this.database, this.cacheManager, guildId, '[Channel Data Route]');
            if (data.error) return res.json(data);
            return res.json(filterChatData(data, null, channelId));
        });

        app.get('*', (req, res) => {
            res.redirect('/');
        });

    }
}

module.exports = APIManager;