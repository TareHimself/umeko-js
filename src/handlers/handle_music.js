const { sync, bot, queues, perGuildData, LavaManager, modulesLastReloadTime } = require(`${process.cwd()}/passthrough.js`);

const { reply, reloadCommandCategory } = sync.require(`${process.cwd()}/utils.js`);
const { queueTimeout, queueItemsPerPage, maxQueueFetchTime, maxRawVolume, defaultVolumeMultiplier } = sync.require(`${process.cwd()}/config.json`);

const play = require('play-dl');

const { MessageEmbed, MessageActionRow, MessageButton, InteractionCollector, Interaction } = require('discord.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, NoSubscriberBehavior, AudioPlayerState, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const EventEmitter = require("events");



const axios = require('axios');

const { URLSearchParams } = require("url");


module.exports.createQueue = async function (ctx) {

    if (queues.get(ctx.member.guild.id) == undefined) {

        return createNewQueue(ctx);
    }
    else {
        return queues.get(ctx.member.guild.id);
    }

}

function createNewQueue(ctx) {
    const newQueue = new Queue(ctx);

    newQueue.on('state', (state) => {
        console.log(state);
    })

    queues.set(ctx.member.guild.id, newQueue);

    return newQueue;
}


// function to create a song class (for the sake of consistency and sanity)
const createSong = function (songData, songRequester, songGroupURL = "") {
    return {
        id: songData.info.identifier,
        track: songData.track,
        title: songData.info.title,
        uri: songData.info.uri,
        length: songData.info.length,
        requester: songRequester,
        groupURL: songGroupURL
    }
}

const createNowPlayingMessage = async function (ref) {
    const channel = ref.channel;
    let song = ref.currentSong;

    if (ref.isCreatingNowPlaying) return undefined;

    ref.isCreatingNowPlaying = true;


    if (song == undefined) {
        // wait for half a second
        await new Promise(r => setTimeout(r, 500));

        song = ref.currentSong;

        if (song == undefined) {
            ref.isCreatingNowPlaying = false;
            return;
        }
    }

    // remove previous NowPlaying
    if (ref.nowPlayingMessage != undefined) {
        ref.nowPlayingMessage.stop('EndOfLife');
        ref.nowPlayingMessage = undefined;
    }

    const Embed = new MessageEmbed();
    console.log(ref.Id)
    Embed.setColor(perGuildData.get(ref.Id).pColor);
    Embed.setTitle(`**${song.title}**`);
    Embed.setURL(`${song.uri}`);
    Embed.setDescription(`**Volume** : **${parseInt(ref.volume * 100)}%**`);
    Embed.setFooter(`${song.requester.displayName}`, song.requester.displayAvatarURL({ format: 'png', size: 32 }));
    const nowButtons = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('skip')
                .setLabel('Skip')
                .setStyle('PRIMARY'),
            new MessageButton()
                .setCustomId(ref.isPaused() ? 'resume' : 'pause')
                .setLabel(ref.isPaused() ? 'Resume' : 'Pause')
                .setStyle(`SUCCESS`),
            new MessageButton()
                .setCustomId('stop')
                .setLabel('Stop')
                .setStyle('DANGER'),
            new MessageButton()
                .setCustomId('queue')
                .setLabel('Queue')
                .setStyle('SECONDARY'),
        );

    const message = await channel.send({ embeds: [Embed], components: [nowButtons] });
    if (message) {

        const nowPlayingCollector = new InteractionCollector(bot, { message: message, componentType: 'BUTTON' });
        nowPlayingCollector.queue = ref;


        nowPlayingCollector.on('collect', async (button) => {

            await button.deferUpdate();

            button.cType = 'COMMAND';

            button.forceChannelReply = true;

                switch (button.customId) {
                    case 'pause':
                        await nowPlayingCollector.queue.pauseSong(button);
                        break;
    
                    case 'resume':
                        await nowPlayingCollector.queue.resumeSong(button);
                        break;
    
                    case 'queue':
                        await nowPlayingCollector.queue.showQueue(button);
                        break;
    
                    case 'skip':
                        await nowPlayingCollector.queue.skipSong(button);
                        break;
    
                    case 'stop':
                        await nowPlayingCollector.queue.stop(button);
                        break;
                }

                button.forceChannelReply = undefined;
                
                const editedNowButtons = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('skip')
                        .setLabel('Skip')
                        .setStyle('PRIMARY'),
                    new MessageButton()
                        .setCustomId(nowPlayingCollector.queue.isPaused() ? 'resume' : 'pause')
                        .setLabel(nowPlayingCollector.queue.isPaused() ? 'Resume' : 'Pause')
                        .setStyle(`SUCCESS`),
                    new MessageButton()
                        .setCustomId('stop')
                        .setLabel('Stop')
                        .setStyle('DANGER'),
                    new MessageButton()
                        .setCustomId('queue')
                        .setLabel('Queue')
                        .setStyle('SECONDARY'),
                );

                await button.editReply({ embeds: [Embed], components: [editedNowButtons] });
        });

        nowPlayingCollector.on('end', (collected, reason) => {

            const editedNowButtons = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('skip')
                        .setLabel('Skip')
                        .setStyle('PRIMARY')
                        .setDisabled(true),
                    new MessageButton()
                        .setCustomId(nowPlayingCollector.queue.isPaused() ? 'resume' : 'pause')
                        .setLabel(nowPlayingCollector.queue.isPaused() ? 'Resume' : 'Pause')
                        .setStyle(`SUCCESS`)
                        .setDisabled(true),
                    new MessageButton()
                        .setCustomId('stop')
                        .setLabel('Stop')
                        .setStyle('DANGER')
                        .setDisabled(true),
                    new MessageButton()
                        .setCustomId('queue')
                        .setLabel('Queue')
                        .setStyle('SECONDARY')
                        .setDisabled(true),
                );

            nowPlayingCollector.options.message.fetch().then((message) => {
                if (message) message.edit({ embeds: [message.embeds[0]], components: [editedNowButtons] });
            });
        });

        ref.nowPlayingMessage = nowPlayingCollector;

    }

    ref.isCreatingNowPlaying = false;

}

const generateQueueEmbed = function (page, ref) {

    const currentQueueLenth = ref.queue.length;
    const itemsPerPage = queueItemsPerPage;
    const prevCurrentPages = Math.ceil((currentQueueLenth / itemsPerPage))
    const currentPages = prevCurrentPages < 1 ? 1 : prevCurrentPages;

    const Embed = new MessageEmbed();
    Embed.setColor(perGuildData.get(ref.Id).pColor);
    Embed.setTitle(`${currentQueueLenth} in Queue`);
    Embed.setURL('https://www.oyintare.dev/');

    const max = currentQueueLenth > itemsPerPage ? itemsPerPage * page : currentQueueLenth;

    const startIndex = max > itemsPerPage ? (max - itemsPerPage) : 0;

    for (let i = startIndex; i < max; i++) {
        let currentSong = ref.queue[i];

        if (currentSong != undefined) Embed.addField(`${i}) \`${currentSong.title}\``, `**Requested by** ${currentSong.requester} \n`, false);

    }

    Embed.setFooter(`Page ${page} of ${currentPages}`);
    

    return [Embed, currentPages];
}



class Queue extends EventEmitter {

    constructor(ctx) {
        super();
        this.Id = ctx.member.guild.id;
        this.channel = ctx.channel;
        this.voiceChannel = ctx.member.voice.channel;
        this.player = undefined;
        this.queue = []
        this.nowPlayingMessage = undefined;
        this.currentSong = undefined
        this.volume = defaultVolumeMultiplier;
        this.isIdle = true;
        this.isLooping = false;
        this.isCreatingNowPlaying = false;
        this.ensurePlayTimeout = undefined
        this.isFirstPlay = true;
        this.timeout = setTimeout(this.destroyQueue, queueTimeout, this);
        console.log(maxRawVolume);
    }

    async ensurePlay(ref) {
        if (!ref.isPlaying() && !ref.isPaused() && ref.queue.length > 0) {
            console.log('THE QUEUE IS TRIPPING ENSURING PLAY');
            ref.playNextSong();
        }
    }

    async fixFirstVolume(ref,max){
        console.log(ref.volume * max);
        ref.player.volume(ref.volume * max);
    }

    async playNextSong() {

        if (this.timeout != undefined) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }

        if (this.queue.length == 0) {
            console.log('Queue Empty');
            this.timeout = setTimeout(this.destroyQueue, queueTimeout, this);
            this.isIdle = true;
            this.emit('state', 'Idle');
            return;
        }

        try {



            console.log('Trying to play');

            const song = this.queue[0];

            this.currentSong = song;

            await this.player.play(song.track);

            if(this.isFirstPlay)
            {
                setTimeout(this.fixFirstVolume,1000,this,maxRawVolume);
                this.isFirstPlay = false;
            }
            

            createNowPlayingMessage(this);

            this.queue.shift();

            console.log('FINISHED tryinig to play');



            this.emit('state', 'Playing');

        } catch (error) {

            console.log(`\n\n Play Song Error \n\n${error}`);

            this.queue.shift();

            this.playNextSong();

            return
        }


    }

    async parseInput(ctx) {


        console.log('Play Recieved');
        console.time('ParseSong');
        let url = "";

        if (ctx.cType != "MESSAGE") await command.deferReply(); // defer because this might take a while

        if (this.player === undefined) {

            this.player = await LavaManager.join({
                guild: ctx.member.guild.id, // Guild id
                channel: ctx.member.voice.channel.id, // Channel id
                node: "1", // lavalink node id, based on array of nodes
            });

            this.player.on("end", data => {
                if (data.reason === "REPLACED") return; // Ignore REPLACED reason to prevent skip loops
                
                // Play next song
                this.emit('state', 'Finished');

                if (this.nowPlayingMessage != undefined) {
                    this.nowPlayingMessage.stop('EndOfLife');
                    this.nowPlayingMessage = undefined;
                }

                if (this.isLooping) {
                    this.queue.push(this.currentSong);
                }


                this.playNextSong();

                //this.ensurePlayTimeout = setTimeout(this.ensurePlay, 1000, this);
            });
        }

        // handle different command types
        switch (ctx.cType) {
            case 'MESSAGE':
                url = ctx.pureContent;
                break;
            case 'COMMAND':
                url = ctx.options.getString('url');
                break;
            case 'CONTEXT_MENU':
                const contextMessage = ctx.options.getMessage('message');
                if (contextMessage.embeds[0] !== undefined) {
                    url = contextMessage.embeds[0].url;
                }
                else if (contextMessage.content !== '') {
                    const contentLow = contextMessage.content.toLowerCase();
                    url = contextMessage.content;
                }
                break;
        }


        if (url.length == 0) return reply(ctx,'What even is that ?');


        let newSongs = [];


        const check = await play.validate(url);

        async function getSong(search, user, isDirectLink = false) {
            try {
                const node = LavaManager.idealNodes[0];

                const params = new URLSearchParams();

                params.append("identifier", "ytsearch:" + search);

                const data = (await axios.get(`http://${node.host}:${node.port}/loadtracks?${params}`, { headers: { Authorization: node.password } })).data;

                const songData = data.tracks[0];

                return createSong(songData, user, songData.info.uri);
            } catch (error) {
                console.log(`Error fetching song for ${search} \n ${error}`);
                return undefined;
            }

        }

        // Fetch song data
        try {
            // Simple yt video shit
            if (check === "search") // handle just a regular search term
            {
                const song = await getSong(url, ctx.member, false);

                if (song) newSongs.push(song);
            }
            else if (check == 'yt_video') {

                const song = await getSong(url, ctx.member, true);

                if (song) newSongs.push(song);
            }
            else if (check === 'sp_track' || check === 'sp_album' || check === 'sp_playlist') // handle spotify
            {

                if (play.is_expired()) {
                    await play.refreshToken();
                }

                function timeout(ms) {
                    return new Promise(resolve => setTimeout(resolve, ms));
                }



                // helper function to convert spotify links to youtube search terms (needs more special sauce)
                const convertTrackToYTSearch = async function (trackData) {
                    let artists = "";
                    if (trackData.type === 'track') {
                        trackData.artists.forEach(element => artists += ' ' + element.name);
                    }
                    const searchToMake = trackData.name + ' ' + artists + ' audio';

                    return (await getSong(searchToMake, ctx.member, false));
                }

                const processSpotifyData = async function (trackData) {

                    const song = await Promise.race([convertTrackToYTSearch(trackData), timeout(maxQueueFetchTime)]);

                    if (song == undefined) return;

                    newSongs.push(song); // add if details checks out

                }

                // fetch the spofity data, could be a song, playlist or albumn
                const dataGotten = await play.spotify(url);

                // time for the serious shit
                if (check == 'sp_track') // for just tracks
                {
                    await processSpotifyData(dataGotten);

                }
                else //  for albumns and playlists (same process)
                {

                    // iterate through all the albumn/playlist pages
                    for (let i = 1; i <= dataGotten.total_pages; i++) {

                        let currentData = dataGotten.page(i);// fetch the songs in this page

                        let promisesToAwait = []


                        currentData.forEach(data => {
                            promisesToAwait.push(processSpotifyData(data));
                        });

                        await Promise.all(promisesToAwait);

                    }
                }
            }
        } catch (error) { console.log(error) }

        console.log('Search End');

        this.queue.push.apply(this.queue, newSongs);

        console.timeEnd('ParseSong');


        if (this.isIdle) {
            this.isIdle = false;
            console.log('Play Called');
            this.playNextSong();
        }
        else {
            console.log('Sent to Queue');
            const Embed = new MessageEmbed();

            Embed.setColor(perGuildData.get(this.Id).pColor);
            Embed.setFooter(`Added to the Queue`, ctx.member.displayAvatarURL({ format: 'png', size: 32 }));

            if (newSongs.length > 1) {
                Embed.setTitle(`${newSongs.length} Songs`);
                Embed.setURL(`${url}`);
            }
            else {
                if (newSongs[0] == undefined) return;

                Embed.setTitle(`${newSongs[0].title}`);
                Embed.setURL(`${newSongs[0].uri}`)

            }

            reply(ctx, { embeds: [Embed] })
        }


    }

    async pauseSong(ctx) {
        if (this.isPlaying() && !this.isPaused()) {
            this.emit('state', 'Paused');

            await this.player.pause(true);

            const Embed = new MessageEmbed();
            Embed.setColor(perGuildData.get(this.Id).pColor);
            Embed.setURL('https://www.oyintare.dev/');
            Embed.setFooter(`${ctx.member.displayName} paused the music`, ctx.member.displayAvatarURL({ format: 'png', size: 32 }));

            reply(ctx, { embeds: [Embed] })
        }
    }

    async resumeSong(ctx) {

        if (this.isPaused()) {
            this.emit('state', 'Resumed');

            await this.player.pause(false);

            const Embed = new MessageEmbed();
            Embed.setColor(perGuildData.get(this.Id).pColor);
            Embed.setURL('https://www.oyintare.dev/');
            Embed.setFooter(`${ctx.member.displayName} Un-Paused the music`, ctx.member.displayAvatarURL({ format: 'png', size: 32 }));

            reply(ctx, { embeds: [Embed] })
        }


    }

    async removeSong(ctx) {

    }

    async showNowPlaying(ctx) {

        if (this.isPlaying()) {
            if (this.nowPlayingMessage != undefined) {
                this.nowPlayingMessage.stop('EndOfLife');
                this.nowPlayingMessage = undefined;
            }

            await createNowPlayingMessage(this);
        }
    }

    async setLooping(ctx) {


        if (ctx.args[0] == undefined) return reply(ctx, 'Please use either `loop on` or `loop off`');

        const Embed = new MessageEmbed();
        Embed.setColor(perGuildData.get(this.Id).pColor);

        Embed.setURL('https://www.oyintare.dev/');
        Embed.setFooter(`${ctx.member.displayName}`, ctx.member.displayAvatarURL({ format: 'png', size: 32 }));



        if (ctx.args[0].toLowerCase() == 'on') {
            this.isLooping = true;
            Embed.setFooter(`Looping On`, ctx.member.displayAvatarURL({ format: 'png', size: 32 }));
        } else if (ctx.args[0].toLowerCase() == 'off') {
            this.isLooping = false;
            Embed.setFooter(`Looping Off`, ctx.member.displayAvatarURL({ format: 'png', size: 32 }));
        } else {
            reply(ctx, 'Please use either `loop on` or `loop true`');
            return
        }

        reply(ctx, { embeds: [Embed] })

    }

    async showQueue(ctx) {


        if (this.queue.length > queueItemsPerPage) {
            const showQueueButtons = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId('previous')
                        .setLabel('⬅️')
                        .setStyle('PRIMARY')
                        .setDisabled(true),
                    new MessageButton()
                        .setCustomId('next')
                        .setLabel(`➡️`)
                        .setStyle(`PRIMARY`),
                );

            const message = await reply(ctx, { embeds: [generateQueueEmbed(1, this)[0]], components: [showQueueButtons] });
            if (message) {

                const queueCollector = new InteractionCollector(bot, { message: message, componentType: 'BUTTON', idle: 7000 });
                queueCollector.resetTimer({ time: 7000 });
                queueCollector.currentPage = 1;
                queueCollector.queue = this;

                queueCollector.on('collect', async (button) => {

                    await button.deferUpdate();

                    const newButtons = new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                                .setCustomId('previous')
                                .setLabel('⬅️')
                                .setStyle('PRIMARY'),
                            new MessageButton()
                                .setCustomId('next')
                                .setLabel(`➡️`)
                                .setStyle(`PRIMARY`),
                        );


                    if (button.customId == 'previous') {
                        queueCollector.currentPage--;
                    }

                    if (button.customId == 'next') {
                        queueCollector.currentPage++;
                    }

                    const generatedData = generateQueueEmbed(queueCollector.currentPage, queueCollector.queue);

                    const newEmbed = generatedData[0];

                    if (queueCollector.currentPage == 1) newButtons.components[0].setDisabled(true);
                    if (queueCollector.currentPage == generatedData[1]) newButtons.components[1].setDisabled(true);

                    queueCollector.resetTimer({ time: 7000 });

                    await button.editReply({ embeds: [newEmbed], components: [newButtons] });
                });

                queueCollector.on('end', (collected, reason) => {

                    const newButtons = new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                                .setCustomId('previous')
                                .setLabel('⬅️')
                                .setStyle('PRIMARY')
                                .setDisabled(true),
                            new MessageButton()
                                .setCustomId('next')
                                .setLabel(`➡️`)
                                .setStyle(`PRIMARY`)
                                .setDisabled(true),
                        );

                    queueCollector.options.message.fetch().then((message) => {
                        if (message) message.edit({ embeds: [message.embeds[0]], components: [newButtons] });
                    });
                });

            }
            else {

                reply(ctx, { embeds: [generateQueueEmbed(1, this)[0]] });
            }


        }
        else {
            reply(ctx, { embeds: [generateQueueEmbed(1, this)[0]] });
        }

    }

    async saveQueue(ctx) {
    }

    async loadQueue(ctx) {
    }

    async setVolume(ctx) {
        if (ctx.args[0] == undefined) return reply(ctx, 'IDK what song you wanna set the volume to');


        const volume = parseInt(ctx.args[0]);

        if (volume !== volume) {
            reply(ctx, 'Bruh is that even a number ?');
            return;
        }

        if (volume < 1 || volume > 100) {
            reply(ctx, 'Please use a value between 1 and 100');
            return;
        }

        this.volume = (volume / 100);

        this.player.volume(this.volume * maxRawVolume);

        console.log(this.volume * maxRawVolume)


        const Embed = new MessageEmbed();
        Embed.setColor(perGuildData.get(this.Id).pColor);
        Embed.setURL('https://www.oyintare.dev/');
        Embed.setFooter(`${ctx.member.displayName} Changed the volume to ${parseInt(this.volume * 100)}`, ctx.member.displayAvatarURL({ format: 'png', size: 32 }));

        reply(ctx, { embeds: [Embed] })
    }

    async skipSong(ctx) {
        if (this.queue.length != 0 || (this.isPlaying && this.isLooping === true)) {
            
            const Embed = new MessageEmbed();
            Embed.setColor(perGuildData.get(this.Id).pColor);
            Embed.setURL('https://www.oyintare.dev/');
            Embed.setFooter(`${ctx.member.displayName} Skipped the song`, ctx.member.displayAvatarURL({ format: 'png', size: 32 }));

            await this.player.stop();


            reply(ctx, { embeds: [Embed] });

            
        }
        else
        {
            const Embed = new MessageEmbed();
            Embed.setColor(perGuildData.get(this.Id).pColor);
            Embed.setURL('https://www.oyintare.dev/');
            Embed.setFooter(`The Queue is empty`, ctx.member.displayAvatarURL({ format: 'png', size: 32 }));

            reply(ctx, { embeds: [Embed] });
        }

        
    }

    async stop(ctx) {

        const Embed = new MessageEmbed();
        Embed.setColor(perGuildData.get(this.Id).pColor);
        Embed.setURL('https://www.oyintare.dev/');
        Embed.setFooter(`${ctx.member.displayName} Disconnected Me`, ctx.member.displayAvatarURL({ format: 'png', size: 32 }));


        reply(ctx, { embeds: [Embed] })

        this.destroyQueue(this);
    }

    isPlaying() {
        return this.player.playing || this.player.paused;
    }

    isPaused() {
        return this.player.paused;
    }

    async destroyQueue(ref) {
        
        if (ref.nowPlayingMessage != undefined) {
            ref.nowPlayingMessage.stop('EndOfLife');
            ref.nowPlayingMessage = undefined;
        }

        if (ref.timeout != undefined) {
            clearTimeout(ref.timeout);
            ref.timeout = undefined;
        }

        ref.queue = [];
        ref.isLooping = false;

        ref.emit('state', 'Destroyed');

        LavaManager.leave(ref.Id);

        queues.delete(ref.Id);
    }

}

module.exports.Queue = Queue;

console.log(' Music Module loaded ');

if(modulesLastReloadTime.music !== undefined)
{
    reloadCommandCategory('Music');
}

modulesLastReloadTime.music = bot.uptime;




