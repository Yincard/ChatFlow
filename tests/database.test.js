const DatabaseManager = new (require('../managers/DatabaseManager'))();
const CacheManager = new (require('../managers/CacheManager'))(DatabaseManager);


const { config } = require('dotenv');
config();

test("Check Database Connections", async () => {

    const databaseResult = await DatabaseManager.connect(process.env.DATABASE);
    await CacheManager.connect(process.env.REDIS_CACHE);

    expect(databaseResult).toEqual(true);
    expect(CacheManager.redisReady).toEqual(true);

});

test("Check Redis Cache Bulk Read", async () => {
    await CacheManager.bulkReadRedisCache();
    expect(CacheManager.redisCached).toEqual(true);
});