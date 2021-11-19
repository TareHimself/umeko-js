const { MessageEmbed } = require('discord.js');

module.exports = {
    name: 'delete',
    category: 'Main',
    description : 'Deletes messages in a channel',
    ContextMenu: {},
    options : [
        {
            name : 'ammount',
            description: "The ammount of messages to delete, 100 max.",
            type: 4,
            required: true
        }
    ],
    async execute(bot,ctx)
    {
        const ammount = ctxType  == "COMMAND" ? ctx.options.getInteger('ammount') : parseInt(ctx.args[0]);

        if (!ctx.guild) return ctx.reply("you need to be in a server to use this command");

        if (ammount == 0 || ammount == NaN || ammount > 100 || ammount < 1) return ctx.reply("Ammount must be a value between 1 and 100");

        let deletedMsgs = null;

        try {
            deletedMsgs = await ctx.channel.bulkDelete(ammount);
        } catch (error) {
            console.log(error);
        }
        
        return;
    }
}