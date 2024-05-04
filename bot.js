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
const CacheManager = new (require('./managers/CacheManager'))(DatabaseManager, client);
const APIManager = new (require('./managers/APIManager'))(DatabaseManager, CacheManager);

client.slashData = [];
client.commands = new Collection();
client.token = process.env.TOKEN;
client.database = DatabaseManager;
client.cache = CacheManager;
client.resources = ResourceManager

client.login(client.token).finally(async () => {

	await ResourceManager.loadData('../src');
	const loadDatabaseSystem = DatabaseManager.connect(process.env.DATABASE);
	const initCacheSystem = CacheManager.connect(process.env.REDIS_CACHE);
	const apiSystem = APIManager.connect(process.env.PORT);
	APIManager.setupRoutes(); 

	console.table(client.resources.logs)
	console.table({
		"[DISCORD]": `Logged in as ${client.user.tag}`,
		"[RESOURCE]": `Loaded ${(ResourceManager.totalSize / 1024).toFixed(2)}MB of resources`,
		"[DATABASE]": loadDatabaseSystem ? "Connected to MongoDB Instance" : "Error Connecting",
		"[CACHE]": initCacheSystem ? "Loaded & Connected Cache Instances" : "Error Loading",
		"[API]": !apiSystem ? `Listening on port ${process.env.PORT}` : "Error Loading",
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

