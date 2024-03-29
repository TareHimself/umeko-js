
const { sync, queues } = require(`${process.cwd()}/dataBus.js`);
const { saveQueue } = sync.require(`${process.cwd()}/handlers/handleMusic`);

const utils = sync.require(`${process.cwd()}/utils`);

module.exports = {
    name: 'save',
    category: 'Music',
    description: 'Saves the current queue',
    ContextMenu: {},
    syntax : '{prefix}{name} <name to save as>',
    options: [
        {
            name: 'name',
            description: "The name to save the queue as",
            type: 3,
            required: true
        }
    ],
    async execute(ctx) {
        
            if (!ctx.guild || !ctx.member.voice.channel) return utils.reply(ctx,"You need to be in a voice channel to use this command");

            const Queue = queues.get(ctx.member.guild.id);

            if (Queue == undefined) return utils.reply(ctx,"Theres no Queue");

            await saveQueue(ctx,Queue);
    }
}