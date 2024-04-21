const Event = require('../../../structures/Event');
const { Collection } = require('discord.js')

const cooldowns = new Collection();

class CommandHandler extends Event {
	constructor() {
		super({
			name: 'interactionCreate',
			once: false,
		});
	}
	async execute(client, interaction) {
		if (interaction.isCommand()) {
			try {
				let { commandName } = interaction;
				const command = client.commands.get(commandName)
				if (!command) return;
				if (!cooldowns.has(command.name)) {
					cooldowns.set(command.name, new Collection());
				}

				interaction.member = interaction.guild.members.cache.get(interaction.user.id);
				const now = Date.now();
				const timestamps = cooldowns.get(command.name);
				const cooldownAmount = (command.cooldown || 0) * 1000;
				if (timestamps.has(interaction.user.id)) {
					const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
					if (now < expirationTime) {
						const timeLeft = (expirationTime - now) / 1000;
						await interaction.deferReply({ ephemeral: true }).catch(err => { })
						return interaction.followUp({
							content:
								`You still have \`${timeLeft.toFixed(1)} second(s)\` left before you can run this command again. 
						  `
							, ephemeral: true
						})
					}
				}
				timestamps.set(interaction.user.id, now);
				setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);


				await command
					.execute(client, interaction);
			} catch (err) {
				console.log(err)
				await interaction.deferReply({ ephemeral: true }).catch(err => { })
				return interaction.followUp({ content: `Something went wrong while executing the command.`, ephemeral: true });
			}
		}
	}
}

module.exports = CommandHandler;