module.exports = {
    displayRoutes() {
        const endpoints = [

            {
                method: 'GET',
                path: '/guild/:guildId',
                description: 'Retrieve data for a specific guild',
                usage: 'GET /guild/:guildId',
                returns: 'Data for the specified guild in JSON format',
                example: 'GET /guild/768577588569309254'
            },
            {
                method: 'GET',
                path: '/guild/:guildId/user/:userId',
                description: 'Retrieve data for a specific user within a guild',
                usage: 'GET /guild/:guildId/user/:userId',
                returns: 'Data for the specified user in the specified guild in JSON format',
                example: 'GET /guild/768577588569309254/user/298554512136863747'
            },
            {
                method: 'GET',
                path: '/guild/:guildId/user/:userId/channel/:channelId',
                description: 'Retrieve data for a specific user within a specific channel within a guild',
                usage: 'GET /guild/:guildId/user/:userId/channel/:channelId',
                returns: 'Data for the specified user in the specified channel within the specified guild in JSON format',
                example: 'GET /guild/768577588569309254/user/298554512136863747/channel/1236220991810568242'
            },

            {
                method: 'GET',
                path: '/guild/:guildId/channel/:channelId',
                description: 'Retrieve data for a specific channel within a guild',
                usage: 'GET /guild/:guildId/channel/:channelId',
                returns: 'Data for the specified channel within the specified guild in JSON format',
                example: 'GET /guild/768577588569309254/channel/1236220991810568242',
            }
        ];

        const endpointList = endpoints.map(endpoint => `
        <li>
            <strong>${endpoint.method}</strong> ${endpoint.path} - ${endpoint.description}<br>
            <strong>Usage:</strong> ${endpoint.usage}<br>
            <strong>Returns:</strong> ${endpoint.returns}<br>
            <strong>Example:</strong> ${endpoint.example}
        </li><br>`
        ).join('');

        return `
        <h1>Available Endpoints</h1>
        <ul>${endpointList}</ul>
    `;
    },

    async fetchChatData(database, cacheManager, guildId, prefix) {
        let data = cacheManager.cache.apiCache[guildId];

        if (!data) {
            console.log(`${prefix} Fetching data for guildId: ${guildId}`);
            data = await database.mongoose.messageSchema.findOne({ guildId }, { _id: 0 });

            if (!data) {
                const errorData = { error: "No data found" };
                cacheManager.cache.apiCache[guildId] = errorData;
                console.log(`${prefix} Caching error data for guildId: ${guildId}`);
                return errorData;
            }

            cacheManager.cache.apiCache[guildId] = data;
            console.log(`${prefix} Caching data for guildId: ${guildId}`);
        } else {
            console.log(`${prefix} Cache hit for guildId: ${guildId}`);
        }

        return data;
    },

    filterChatData(data, userId = null, channelId = null) {
        if (!data || !Object.keys(data).length) return { error: "No data found" };
    
        const channels = channelId
            ? { [channelId]: data.channels[channelId] }
            : data.channels;
    
        if (!Object.keys(channels).length) return { error: "No data found" };
    
        const result = {};
    
        for (const [channelId, channelData] of Object.entries(channels)) {
            // Check if channelData is undefined or null
            if (!channelData) {
                return { error: "No data found" };
            }
    
            const channelResult = {};
    
            for (const [date, dateData] of Object.entries(channelData)) {
                if (!dateData) continue;
    
                const usersToIterate = userId ? [userId] : Object.keys(dateData);
    
                const dateResult = usersToIterate
                    .flatMap((user) => {
                        const userData = dateData[user];
                        if (!userData || !Object.keys(userData).length) return [];
    
                        return { userId: user, userData };
                    })
                    .filter(Boolean);
    
                if (dateResult.length) {
                    channelResult[date] = dateResult;
                }
            }
    
            if (Object.keys(channelResult).length) {
                result[channelId] = channelResult;
            }
        }
    
        return Object.keys(result).length ? result : { error: "No data found" };
    }
}

