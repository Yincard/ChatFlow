const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    guildId: String,
    channels: {
        type: Object,
        default: {},
        required: true,
    },
}, { versionKey: false });

module.exports = mongoose.model('Message', messageSchema);
