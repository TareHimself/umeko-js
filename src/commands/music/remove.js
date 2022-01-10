const { sync, queues } = require(`${process.cwd()}/passthrough.js`);
const { removeSong } = sync.require(`${process.cwd()}/handlers/handle_music`);

const utils = sync.require(`${process.cwd()}/utils`);

module.exports = {
    name: 'remove',
    category: 'Music',
    description: 'Removes a song from the queue',
    ContextMenu: {},
    syntax : '{prefix}{name} <song index>',
    options: [
        {
            name: 'index',
            description: "The index of the song in the queue",
            type: 4,
            required: true
        }
    ],
    async execute(ctx) {
        
            if (!ctx.guild || !ctx.member.voice.channel) return utils.reply(ctx,"You need to be in a voice channel to use this command");

            const Queue = queues.get(ctx.member.guild.id);

            if (Queue == undefined) return utils.reply(ctx,"Theres no Queue");

            await removeSong(ctx,Queue);
        

    }
}