var Discord = require('discord.io');
var logger = require('winston');
const _ = require('lodash')
const fs = require('fs');
require('dotenv').config();
// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    level: 'debug',
    colorize: true
});
// Initialize Discord Bot
var bot = new Discord.Client({
   token: process.env.token,
   autorun: true
});
var channels = {}

class channelVariablesModel  {
    constructor(channelJson){
        this._botAdmins = []
        this._guildMembers= []
        this._joinedMembers= {}
        Object.assign(this, channelJson)
    }
    get botAdmins(){
        return this._botAdmins;
    }
    set botAdmins(value){
        this._botAdmins.push(value);
        saveFile();
    }
    get guildMembers(){
        return this._guildMembers;
    }
    set guildMembers(value){
        this._guildMembers.push(value);
        saveFile();
    }
    get joinedMembers(){
        return this._joinedMembers;
    }
    setJoinedMembers(key, value){
        this._joinedMembers[key] = value;
        saveFile();
    }
    clearJoinedMembers(){
        for (const prop of Object.keys(this._joinedMembers)) {
            delete this._joinedMembers[prop];
        }
        saveFile();
    }
};

bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
    const tmpChannels = JSON.parse(fs.readFileSync('channelVariables.json'));  
    channels = _.mapValues(tmpChannels, c => new channelVariablesModel(c))
});
var authorizeUser = function(userId, channelID){
    if(bot.servers[bot.channels[channelID].guild_id].owner_id === userId){
        return true;
    }
    var result = false;
    channels[channelID].botAdmins.forEach(element => {
        if(element == userId){
            result = true;
        }
    });
    bot.sendMessage({
        to: channelID,
        message: 'Sorry, no Permission.'
    });
    return result;
}
function saveFile() {
    fs.writeFileSync('channelVariables.json', JSON.stringify(channels));
}
bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if(!channels[channelID]){
        channels[channelID] = new channelVariablesModel()

    }
    var channelVars = channels[channelID];
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0].toLowerCase();
        bot.deleteMessage({
            channelID: channelID,
            messageID: evt.d.id
        });        
        switch(cmd) {
            case'log':
             console.log(channels);
             break;
            case 'letsraid':
                if(!authorizeUser(userID, channelID)){
                    break;  
                }                
                channelVars.clearJoinedMembers();
                bot.sendMessage({
                    to: channelID,
                    message: 'Alrighty! I cleared the member list.\n@here Everyone can signup now and set their preferred class by typing !join [preferences]'
                });
            break;

            case 'join': 
                var prefs = args[1] || '';
                var joinedAlready = !!channelVars.joinedMembers[userID];
                if(joinedAlready){
                    channelVars.setJoinedMembers(userID, {prefs: prefs});
                    bot.sendMessage({
                        to: channelID,
                        message: 'You are already on the list. I replaced your prefs though...'
                    });   
                    break;
                }

                channelVars.setJoinedMembers(userID, {name: user, prefs: prefs, guildmember: channelVars.guildMembers.indexOf(userID) !== -1});
                
                bot.sendMessage({
                    to: channelID,
                    message: 'I added '+user+' to the member list!'
                });
            break;
            
            case 'leave':
                var joinedAlready = !!channelVars.joinedMembers[userID];
                if(!joinedAlready){
                    bot.sendMessage({
                        to: channelID,
                        message: 'You were not even signed up...'
                    });   
                    break;
                }
                delete channelVars.joinedMembers[userID];
                bot.sendMessage({
                    to: channelID,
                    message: 'I removed you from the list.'
                });   
            break;

            case 'clear': 
                if(!authorizeUser(userID, channelID)){
                    break;
                }
                channelVars.clearJoinedMembers();
                bot.sendMessage({
                    to: channelID,
                    message: 'Memberlist cleared!'
                });
                   
            break;

            case 'status':
                var message = 'Current member list:\n';
                var count = 1;
                var keysSorted = Object.keys(channelVars.joinedMembers).sort(function(a,b){return channelVars.joinedMembers[b].guildmember - channelVars.joinedMembers[a].guildmember})
                keysSorted.forEach(key => {
                    var element = channelVars.joinedMembers[key]
                    message += count + '. ' + element.name;
                    if(element.prefs){
                        message += ' - ' + element.prefs;
                    }
                    if(element.guildmember){
                        message += ' (Guildmember!)'
                    }
                    message += '\n';
                    count++;
                });
                if(Object.keys(channelVars.joinedMembers).length === 0 && channelVars.joinedMembers.constructor === Object){
                    message += 'No one signed up yet :('
                }
                bot.sendMessage({
                    to: channelID,
                    message: message
                })
            break;

            case 'addadmin':
                if(!authorizeUser(userID, channelID)){
                    break;
                }
                if(args[1]){
                    var index = channelVars.botAdmins.indexOf(args[1]);  
                    if (index === -1) {
                        channelVars.botAdmins.push(args[1])
                        bot.sendMessage({
                            to: channelID,
                            message: 'Added new Admin'
                        });
                    }else{
                        bot.sendMessage({
                            to: channelID,
                            message: 'UserId already in list'
                        });
                    }
                    break;
                }
                bot.sendMessage({
                    to: channelID,
                    message: 'No UserId set.'
                });
            break;
            case 'help':
            case 'info':                
                bot.sendMessage({
                    to: channelID,
                    message: 'letsraid - start your raid signup with a fresh list and a \'here\' mention in this channel (Admin permission)\n' +
                    'join [preference] - signup to the current list with optional preference\n' +
                    'leave - remove yourself from the member list\n' +
                    'status - display the current member list\n' +
                    'clear - clears the current member list (Admin permission)\n' +
                    'addadmin [userID] - add admin permission to userID\n' +
                    'removeadmin [userID] - removes userid from admin (Admin permission)\n' +
                    'myuserid - display your userID\n' +
                    'addguildmember [userID] - add userid to guildmember list. guildmembers get an addition in the status list (Admin permission)\n' +
                    'removeguildmember [userID] - remove userid from guildmember list (Admin permission)\n'
                });
            break;

            case 'myuserid':                
                bot.sendMessage({
                    to: channelID,
                    message: userID
                });
            break;

            
            case 'removeadmin':   
            if(!authorizeUser(userID, channelID)){
                break;
            }
                if(!args[1]){
                    bot.sendMessage({
                        to: channelID,
                        message: 'no userid'
                    });
                    break;
                }   
                var index = channelVars.botAdmins.indexOf(args[1]);  
                    if (index !== -1) {
                        channelVars.botAdmins.splice(index, 1);
                    }
                bot.sendMessage({
                    to: channelID,
                    message: 'userID removed'
                });
            break;

            
            case 'removeguildmember':  
            if(!authorizeUser(userID, channelID)){
                break;
            }
            if(!args[1]){
                bot.sendMessage({
                    to: channelID,
                    message: 'no userid'
                });
                break;
            }   var index = channelVars.guildMembers.indexOf(args[1]);  
            if (index !== -1) {
                channelVars.guildMembers.splice(index, 1);
                bot.sendMessage({
                    to: channelID,
                    message: 'userID removed'
                });
                break;
            }
            bot.sendMessage({
                to: channelID,
                message: 'userID not found'
            });
            break;

            case 'addguildmember':    
            if(!authorizeUser(userID, channelID)){
                break;
            }
            if(!args[1]){
                bot.sendMessage({
                    to: channelID,
                    message: 'no userid'
                });
                break;
            }         
            if(channelVars.guildMembers.indexOf(args[1]) === -1){
                channelVars.guildMembers.push(args[1]);
                bot.sendMessage({
                    to: channelID,
                    message: 'guildmember added'
                });
                channelVars.joinedMembers[args[1]].guildmember = true;
            }else{
                bot.sendMessage({
                    to: channelID,
                    message: 'already a guild member'
                });
            }
            
            break;

            default:
                bot.sendMessage({
                    to: channelID,
                    message: 'I dont know the '+message+' command :('
                })
                break;
         }
     }
});

const http = require('http');
const express = require('express');
const app = express();
app.get("/", (request, response) => {
  console.log(Date.now() + " Ping Received");
  response.sendStatus(200);
});
app.listen(process.env.PORT);
setInterval(() => {
  http.get(`http://${process.env.PROJECT_DOMAIN}.glitch.me/`);
}, 280000);