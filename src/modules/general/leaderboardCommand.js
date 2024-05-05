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
                .setTitle("Click Here")
                .setURL("http://54.146.234.160/")
            ]
        })
    }

}

module.exports = leaderboardCommand