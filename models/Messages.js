const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    guildId: String,
    channels: Object,
}, { versionKey: false });

module.exports = mongoose.model('Message', messageSchema);
