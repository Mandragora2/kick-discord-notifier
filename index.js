require('dotenv').config();
const { Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const http = require('http');
const https = require('https');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let isLive = false;
let messageSent = false;

const livestreamUrl = 'https://kick.com/api/v1/channels/' + process.env.STREAMER_SLUG;

function poll(chan) {
	const rand = Math.floor(Math.random() * 999999999);

	const headers = {
		'Accept': 'text/html,application/xhtml+xml,application/xml',
		'Accept-Encoding': 'gzip, deflate',
		'User-Agent': 'Firefox/108.0',
		'Cookie': '',
	};
	const url = `${livestreamUrl}`;

	console.log('Polling kick…');

	axios.get(livestreamUrl, {
		headers: headers,
		httpAgent: new http.Agent({ keepAlive: false }),
		httpsAgent: new https.Agent({ keepAlive: false }),
	})
		.then((response) => {
			data = response.data;
			if (data.livestream === null) {
				isLive = false;
				messageSent = false;
				return;
			}

			if (messageSent) {
				return;
			}

			console.log('Streamer is live, send message.');

			const embed = new EmbedBuilder()
				.setTitle(data.livestream.session_title)
				.setURL(`https://kick.com/${data.slug}`)
				.setThumbnail(data.user.profile_pic)
				.setImage(data.livestream.thumbnail.url)
				.setTimestamp(new Date(data.livestream.created_at).getTime())
				.setFooter({ text: 'Kick' })
        ;

			chan.send({ embeds: [embed] });
			messageSent = true;
		});
}

client.once(Events.ClientReady, async c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);

	c.channels.fetch(process.env.CHAN_ID).then(
		(channel) => {
			poll(channel);
			setInterval(() => {
				poll(channel);
			}, 1000 * 60);
		},
		(err) => {
			console.error(err);
		},
	);

	process.on('SIGINT', function() {
		c.destroy();
		process.exit();
	});

	process.on('unhandledRejection', (err, p) => {
		console.log('An unhandledRejection occurred');
		console.log(`Rejected Promise: ${p}`);
		console.log('Rejection:');
		console.error(err);
	});
});

client.login(process.env.TOKEN);