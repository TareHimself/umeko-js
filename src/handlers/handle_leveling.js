const ps = require(`${process.cwd()}/passthrough.js`);
const { sync, bot, modulesLastReloadTime, perGuildSettings, perGuildLeveling } = ps;

const parser = sync.require('./handle_commands');
const guildDataModule = sync.require('./handle_guild_data');
const { xpUpdateThreshold } = sync.require(`${process.cwd()}/config.json`);

const axios = require("axios");


async function onMessageCreate(message) {
    try {
        if (message.author.id === bot.user.id) return;
        if (message.author.bot) return;
        if (message.guild === null || message.member === null) return;

        const guildId = message.guild.id;
        const userId = message.member.id;
        const username = message.member.displayName;

        const options = new URLSearchParams(perGuildSettings.get(guildId).levelingOptions);

        if(!options.get('enabled') || options.get('enabled') !== 'true') return;

        if (perGuildLeveling.get(guildId) === undefined) perGuildLeveling.set(guildId, {});

        const levelingData = perGuildLeveling.get(guildId);

        if (levelingData[userId] === undefined) levelingData[userId] = {level : 0, currentXp : 0};

        levelingData[userId].currentXp += randomIntegerInRange(5, 10) * 5;

        const nextLevelXp = getXpForNextLevel(levelingData[userId].level)
        
        if(levelingData[userId].currentXp >= nextLevelXp)
        {
            levelingData[userId].level += 1;
            levelingData[userId].currentXp = levelingData[userId].currentXp - nextLevelXp;
            
            let levelUpNotification = perGuildSettings.get(guildId).leveling_message;

            levelUpNotification = levelUpNotification.replace(/{user}/gi, `<@${userId}>`);
            levelUpNotification = levelUpNotification.replace(/{username}/gi, `${username}`);
            levelUpNotification = levelUpNotification.replace(/{level}/gi, `${levelingData[userId].level}`);
            levelUpNotification = levelUpNotification.replace(/{server}/gi, `${message.guild.name}`);
            levelUpNotification = levelUpNotification.replace(/{id}/gi, `${userId}`);

            levelingData[userId].lastXpUpdateAmmount = levelingData[userId].currentXp - xpUpdateThreshold;//  force an update to the backend
            
            if(options.get('channel') && options.get('channel') !== '')
            {
                if(options.get('channel') === "dm"){
                    message.author.send(levelUpNotification).catch((error)=>{log('Error sending level up message',error)})
                }
                else
                {
                    const channel = await message.guild.channels.fetch(options.get('channel'));
                    if(channel)
                    {
                        channel.send(levelUpNotification);
                    }
                    else
                    {
                        message.forceChannelReply = true;
                        reply(message,levelUpNotification);
                    }
                }
            }
            else
            {
                message.forceChannelReply = true;
                reply(message,levelUpNotification);
            }
            
        }

        // update backend only if xp is past the specified threshold
        if(levelingData[userId].lastXpUpdateAmmount !== undefined && (levelingData[userId].currentXp - levelingData[userId].lastXpUpdateAmmount) < xpUpdateThreshold) return;

        levelingData[userId].lastXpUpdateAmmount = levelingData[userId].currentXp;

        const postData = {
            userId : userId,
            level : levelingData[userId].level,
            xp_current : levelingData[userId].currentXp
        }

        log('Updating Backend XP',levelingData[userId]);
         
        axios.post(`${process.env.DB_API}/tables/guild_leveling_${guildId}/rows`,postData,{ headers: {'x-umeko-token': process.env.DB_TOKEN}}).then((levelingUpdateResponse) =>{
        }).catch((error)=>{log("Error updating back end XP",error.data)});

    } catch (error) {
        log('Error handeling leveling', error)
    }

}

async function onGuildCreate(guild) {

}


const levelingEvents = [
    { id: 'messageCreate', event: onMessageCreate },
    { id: 'guildCreate', event: onGuildCreate }
]

if (bot !== undefined) {
    if (ps.levelingEvents !== undefined) {
        const previousEvents = ps.levelingEvents;

        previousEvents.forEach(function (levelingEvent, index) {
            try {
                bot.removeListener(levelingEvent.id, levelingEvent.event);
            } catch (error) {
                log(`\x1b[31mError unbinding event ${levelingEvent.id} from bot\x1b[0m\n`, error);
            }
        });

    }

    levelingEvents.forEach(function (levelingEvent, index) {
        try {
            bot.on(levelingEvent.id, levelingEvent.event);
        } catch (error) {
            log(`\x1b[31mError binding event ${levelingEvent.id} to bot\x1b[0m\n`, error);
        }
    });

    ps.levelingEvents = levelingEvents;
}



if (modulesLastReloadTime.leveling !== undefined) {
    log('\x1b[32mLeveling Module Reloaded\x1b[0m');
}
else {
    log('\x1b[32mLeveling Module Loaded\x1b[0m');
}

if(bot)
{
    modulesLastReloadTime.leveling = bot.uptime;
}




