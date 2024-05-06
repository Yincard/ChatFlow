const { ChannelType } = require("discord.js");
const Event = require('../../../../structures/Event');
const { addListener } = require("../../../../models/Messages");
require('dotenv').config();
let startTime;
let leftTime;

class ParseVC extends Event {
    constructor() {
        super({ name: 'voiceStateUpdate', once: false });
    }

    async execute(client, oldState, newState) {

        if (newState.member.user.bot) return;
        
        const today = new Date().toISOString().split('T')[0];
        const { member: { user: { username } }, channel: newChannel } = newState;
        const { channel: oldChannel } = oldState;

        

        if (!oldChannel && newChannel) {
            console.log(`${username} joined ${newChannel.name}`);
            startTime = Date.now();
        } else if (oldChannel && newChannel) {
            console.log(`${username} switched to ${newChannel.name} from ${oldChannel.name}`);
            leftTime = Date.now();
            const duration = leftTime - startTime;
            console.log(`${username} stayed in ${oldChannel.name} for ${duration / 1000} seconds`);
            startTime = Date.now();
        } else if (!newChannel) {
            console.log(`${username} left ${oldChannel.name}`);
            leftTime = Date.now();
            const duration = leftTime - startTime;
            console.log(`${username} stayed in ${oldChannel.name} for ${duration / 1000} seconds`);
        }
    }
}

module.exports = ParseVC;
