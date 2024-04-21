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

client.slashData = [];
client.commands = new Collection();
client.token = process.env.TOKEN;

const ResourceManager = new (require('./managers/ResourceManager'))(client);
const DatabaseManager = new (require('./managers/DatabaseManager'))();
const CacheManager = new (require('./managers/CacheManager'))();

client.login(client.token).finally(async () => {
	
	await ResourceManager.loadCmdData('../src');
	console.log(
		`${ResourceManager.prefix} Loaded ${(ResourceManager.totalSize / 1024).toFixed(2)}MB of resources`
	);

	DatabaseManager.connect(process.env.DATABASE);
	CacheManager.connect(process.env.REDIS_CACHE);

	client.database = DatabaseManager;
	client.cache = CacheManager;

	console.log(`[DISCORD] Logged in as ${client.user.tag}`);
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
