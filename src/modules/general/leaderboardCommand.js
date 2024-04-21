const Command = require("../../../structures/Command");
const { EmbedBuilder } = require("discord.js");

class leaderboardCommand extends Command {
    constructor() {
        super({
            name: "leaderboard",
            description: "View leaderboard website",
            cooldown: 1.5
        })
    }
    async execute(client, interaction) {

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor("#ffc20c")
                .setTitle("Work in Progress - View Updates Here")
                .setURL("https://github.com/Yincard/ChatFlow")
            ]
        })
    }

}

module.exports = leaderboardCommand