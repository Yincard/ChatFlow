const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const { config } = require('dotenv');

config();

const client = new Client({
	intents: Object.values(GatewayIntentBits),
	partials: Object.values(Partials),
	shards: "auto",
	allowedMentions: {
		parse: ["roles", "users", "everyone"],
		repliedUser: false,
	},
});

const ResourceManager = new (require('./managers/ResourceManager'))(client);
const DatabaseManager = new (require('./managers/DatabaseManager'))();
const CacheManager = new (require('./managers/CacheManager'))(DatabaseManager);
const APIManager = new (require('./managers/APIManager'))(DatabaseManager, CacheManager);

client.slashData = [];
client.commands = new Collection();
client.token = process.env.TOKEN;
client.database = DatabaseManager;
client.cacheManager = CacheManager;
client.resources = ResourceManager
client.api = APIManager;

(async () => {
	try {

		await DatabaseManager.reqMongoose(process.env.DATABASE);
		await DatabaseManager.reqRedis(process.env.REDIS_CACHE);

		APIManager.connect(process.env.PORT);
		
		await client.cacheManager.bulkReadRedisCache();
		await client.cacheManager.startInvalidationInterval();
		await client.cacheManager.startWriteToCacheInterval();

	} catch (error) {
		console.error('An error occurred during initialization:', error);
	}
})();

client.login(client.token).finally(async () => {

	await ResourceManager.loadData('../src');
	console.table(client.resources.logs)
	console.table({
		"[DISCORD]": `Logged in as ${client.user.tag}`,
		"[RESOURCE]": `Loaded ${(ResourceManager.totalSize / 1024).toFixed(2)}MB of resources`,
		"[DATABASE]": client.database.mongoose.mongoReady ? "Connected to Database Instances" : "Error Connecting",
		"[CACHE]": (client.database.redis.redisReady && client.cacheManager.cache.redisCached) ? "Loaded & Connected Cache Instances" : "Error Loading",
		"[API]": client.api.serverReady ? `Listening on port ${process.env.PORT}` : "Error Loading",
	});
});

const handleErrors = (type, err, origin) => {
	console.log(`\n\n\n\n\n=== ${type.toUpperCase()} ===`);
	console.log(type === 'unhandledRejection' ? `Reason: ${err.stack ? String(err.stack) : String(err)}` : `Exception: ${err.stack ? err.stack : err}`);
	console.log(`=== ${type.toUpperCase()} ===\n\n\n\n\n`);
};

process.on('unhandledRejection', (reason, p) => handleErrors('unhandledRejection', reason));
process.on('uncaughtException', (err, origin) => handleErrors('uncaughtException', err));
process.on('uncaughtExceptionMonitor', (err, origin) => console.log('=== uncaught Exception Monitor ==='.toUpperCase()));
process.on('beforeExit', code => {
	console.log('\n\n\n\n\n=== before Exit ==='.toUpperCase());
	console.log(`Code: ${code}`);
	console.log('=== before Exit ===\n\n\n\n\n');
});
process.on('exit', code => {
	console.log('\n\n\n\n\n=== exit ==='.toUpperCase());
	console.log(`Code: ${code}`);
	console.log('=== exit ===\n\n\n\n\n');
});

