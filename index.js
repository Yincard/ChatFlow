const { ShardingManager } = require('discord.js');
require('dotenv').config();

const shard = new ShardingManager('./bot.js', {
    totalShards: 'auto',
    token: process.env.TOKEN
});

shard.on("shardCreate", async (shard) => {
    console.table([
        { "[SHARDING]": `Launched shard #${shard.id}`}
    ]);
})




shard.spawn({ timeout: -1 })